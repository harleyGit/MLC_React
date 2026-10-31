import React from "react";
import { hgIMSession } from "../../manager_antd/storage/hg_im_session";
import { hgIMEndpoint } from "../../manager_antd/net_handle/hg_im_endpoint";
import styles from "./hg_im_call.module.css";

/** 单条 LiveKit 媒体轨道；track/local 均来自 Room，无默认值。 */
class HGIMTrack extends React.Component {
  hgElement = React.createRef(); // SDK track 绑定的原生 video/audio 元素。
  componentDidMount() { this.props.track.attach(this.hgElement.current); }
  componentWillUnmount() { this.props.track.detach(this.hgElement.current); }
  render() {
    return this.props.track.kind === "video"
      ? <video ref={this.hgElement} autoPlay playsInline muted={this.props.local} className={styles.video} aria-label={this.props.local ? "本机摄像头" : "对方视频"} />
      : <audio ref={this.hgElement} autoPlay muted={this.props.local} />;
  }
}

/** 通话控制面板：vm 提供已鉴权 API/设备，deviceReady 与 conversationId 由首页传入，无默认值；发起入口位于聊天输入框。 */
export default class HGIMCallPanel extends React.Component {
  state = {
    hgCall: null, // 从 Go 读取的权威状态；null 时没有已知呼叫。
    hgBusy: false, // 命令/加入操作互斥。
    hgError: "", // 操作失败提示，不包含 SDK 原始响应。
    hgConnection: "未连接音视频", // WebRTC 状态，与 accepted 业务状态区分。
    hgTracks: [], // 当前发布/订阅的轨道，最多两位参与者。
    hgMicrophone: false, // 本机麦克风当前启用状态。
    hgCamera: false, // 本机摄像头当前启用状态。
    hgRetryCreate: false, // 创建结果未知，必须重用 requestId。
  };
  hgMounted = false; // 关闭面板后拒绝异步回调。
  hgRoom = null; // 当前 LiveKit Room，终态/卸载即 disconnect(true)。
  hgGeneration = 0; // 建连栅栏，结束/卸载使迟到 token/connect 结果无效。
  hgTimer = null; // 三秒权威状态核对定时器，仅在已知活跃通话时运行。
  hgRefreshing = false; // callGet 单飞，合并重复信令。
  hgHints = new Set(); // 最多8个待查询 callId，避免无界事件队列。
  hgCommand = null; // 未确认的 create 命令，失败重试保持幂等键与目标。
  hgCall = null; // 同步权威快照，避免 React 批量 setState 期间读取旧版本。
  hgActionBusy = false; // 防止 state 尚未更新时连点。
  hgJoining = false; // 加入单飞，但不阻止用户在建连期间结束通话。

  componentDidMount() {
    this.hgMounted = true;
    const hgCallID = hgIMSession(this.props.vm.hgOwner).callId; // 同账号刷新后的已知呼叫。
    if (/^[a-f0-9]{32}$/.test(hgCallID)) this.hgHint(hgCallID);
  }
  componentWillUnmount() {
    this.hgMounted = false;
    clearTimeout(this.hgTimer);
    this.hgDisconnect();
  }

  hgActive = (hgCall = this.hgCall) => hgCall && ["ringing", "accepted"].includes(hgCall.state);
  hgAlive = () => this.hgMounted && this.props.vm.hgAlive();

  /** 所有状态更新按业务版本单调合并；迟到的旧 callId 不替换当前活跃通话。 */
  hgApply = (hgCall) => {
    if (!this.hgAlive() || !hgCall || !/^[a-f0-9]{32}$/.test(hgCall.callId) || !Number.isSafeInteger(hgCall.version)) return;
    const hgCurrent = this.hgCall; // 面板当前业务会话。
    if (hgCurrent?.callId === hgCall.callId && hgCurrent.version > hgCall.version) return;
    if (hgCurrent?.callId !== hgCall.callId && this.hgActive(hgCurrent)) return;
    if (hgCurrent?.callId !== hgCall.callId && !this.hgActive(hgCall)) return;
    if (!this.hgActive(hgCall)) this.hgDisconnect();
    hgIMSession(this.props.vm.hgOwner, { callId: this.hgActive(hgCall) ? hgCall.callId : "" });
    this.hgCall = hgCall;
    this.setState({ hgCall });
  };

  /** 网关只给 callId；查询成员授权后的 Go 状态，绝不从 publication 直接接听。 */
  hgHint = (hgCallID) => {
    if (!this.hgAlive() || !/^[a-f0-9]{32}$/.test(hgCallID) || this.hgHints.size >= 8) return;
    this.hgHints.add(hgCallID);
    void this.hgRefresh();
  };

  hgRefresh = async () => {
    if (!this.hgAlive() || this.hgRefreshing) return;
    this.hgRefreshing = true;
    clearTimeout(this.hgTimer);
    try {
      if (this.hgActive()) {
        const hgCall = await this.props.vm.hgAPI.hgCallGet(this.hgCall.callId);
        this.hgApply(hgCall);
      }
      // 每轮最多处理4个信令；其余留下一轮，不由外部事件制造无限请求。
      for (const hgID of [...this.hgHints].slice(0, 4)) {
        this.hgHints.delete(hgID);
        if (!this.hgAlive()) return;
        this.hgApply(await this.props.vm.hgAPI.hgCallGet(hgID));
      }
      if (this.hgActive() && Date.parse(this.hgCall.expiresAt) <= Date.now()) {
        this.hgDisconnect(); // 本机截止也停止设备；最终状态仍等 Go 确认。
      }
    } catch {
      // 无法核对权威状态时停止本机媒体，避免撤权后因网络故障持续采集。
      this.hgDisconnect();
      if (this.hgAlive()) this.setState({ hgError: "无法核对通话状态，已停止本机音视频；恢复后可手动重新加入。" });
    } finally {
      this.hgRefreshing = false;
      if (this.hgAlive() && (this.hgActive() || this.hgHints.size)) this.hgTimer = setTimeout(this.hgRefresh, 3000);
    }
  };

  hgCreate = async (hgMediaType) => {
    if (!this.hgAlive() || this.hgActionBusy) return;
    if (!this.props.deviceReady || !this.props.vm.hgCredential) {
      this.setState({ hgError: "当前标签页没有有效聊天设备，请退出后重新登录。" });
      return;
    }
    if (!this.props.conversationId || this.hgActive()) {
      this.setState({ hgError: this.hgActive() ? "当前已有通话，请先处理本次通话。" : "请先选择单聊会话。" });
      return;
    }
    if (this.hgCommand && (this.hgCommand.conversationId !== this.props.conversationId || this.hgCommand.mediaType !== hgMediaType)) {
      this.setState({ hgError: "上次呼叫结果未确认，请回到原会话按原类型重试，不能改发给其他会话。" });
      return;
    }
    this.hgActionBusy = true;
    this.setState({ hgBusy: true, hgError: "" });
    this.hgCommand ||= { ...this.props.vm.hgCredential, conversationId: this.props.conversationId, mediaType: hgMediaType, requestId: crypto.randomUUID() };
    try {
      const hgCall = await this.props.vm.hgAPI.hgCallCreate(this.hgCommand);
      this.hgApply(hgCall);
      this.hgCommand = null;
      if (this.hgAlive()) this.setState({ hgRetryCreate: false }, this.hgRefresh);
    } catch {
      if (this.hgAlive()) this.setState({ hgRetryCreate: true, hgError: "发起结果未确认（忙线、配置关闭或网络异常）；请按原请求重试。" });
    } finally { this.hgActionBusy = false; if (this.hgAlive()) this.setState({ hgBusy: false }); }
  };

  /** 接听胜者由 Go 裁决；结束/取消先停本机媒体，再提交业务状态。 */
  hgAction = async (hgAction) => {
    if (!this.hgAlive() || this.hgActionBusy || !this.state.hgCall || !this.props.vm.hgCredential) return;
    this.hgActionBusy = true;
    if (["end", "cancel", "reject"].includes(hgAction)) this.hgDisconnect();
    this.setState({ hgBusy: true, hgError: "" });
    try { this.hgApply(await this.props.vm.hgAPI.hgCallAction(this.props.vm.hgCredential, this.state.hgCall.callId, hgAction)); }
    catch { if (this.hgAlive()) this.setState({ hgError: "通话操作未确认，可能已由另一设备处理；请刷新状态后重试。" }); }
    finally { this.hgActionBusy = false; if (this.hgAlive()) this.setState({ hgBusy: false }, this.hgRefresh); }
  };

  /** 加入动作由用户触发；按业务终态栅栏拒绝迟到的异步连接。 */
  hgJoin = async () => {
    if (!this.hgAlive() || this.hgActionBusy || this.hgJoining || this.hgRoom || !this.props.vm.hgCredential || this.state.hgCall?.state !== "accepted") return;
    this.hgJoining = true;
    const hgGeneration = ++this.hgGeneration; // 连接期间被终态打断时停止一切媒体发布。
    const hgCall = this.state.hgCall; // 本次房间业务快照。
    this.setState({ hgBusy: true, hgError: "", hgConnection: "正在连接音视频" });
    let hgRoom = null; // 即使初始化中途失败也负责释放。
    try {
      const [{ Room, RoomEvent, setLogLevel }, hgGrant] = await Promise.all([import("livekit-client"), this.props.vm.hgAPI.hgCallToken(this.props.vm.hgCredential, hgCall.callId)]);
      if (!this.hgAlive() || hgGeneration !== this.hgGeneration) return;
      setLogLevel("silent"); // 厂商调试上下文可能包含参与者身份，不进入浏览器控制台。
      hgRoom = new Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: true });
      this.hgRoom = hgRoom;
      const hgTracks = () => this.hgUpdateTracks(hgRoom); // SDK publication 变化统一映射当前轨道集合。
      [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantDisconnected].forEach((hgEvent) => hgRoom.on(hgEvent, hgTracks));
      hgRoom.on(RoomEvent.Reconnecting, () => this.hgAlive() && this.setState({ hgConnection: "音视频重连中" }));
      hgRoom.on(RoomEvent.Reconnected, () => { if (this.hgAlive()) this.setState({ hgConnection: "音视频已连接" }); void this.hgRefresh(); });
      hgRoom.on(RoomEvent.Disconnected, () => { if (this.hgRoom === hgRoom) this.hgDisconnect(); });
      if (hgGrant.room !== `im_${hgCall.callId}` || !hgGrant.token) throw new Error("房间凭据与呼叫不一致");
      await hgRoom.connect(hgIMEndpoint(hgGrant.serverUrl), hgGrant.token, { autoSubscribe: true });
      if (!this.hgAlive() || hgGeneration !== this.hgGeneration) { await hgRoom.disconnect(true); return; }
      // connect 期间可能已结束，发布摄像头前再次读取权威状态。
      const hgCurrent = await this.props.vm.hgAPI.hgCallGet(hgCall.callId);
      this.hgApply(hgCurrent);
      if (!this.hgAlive() || hgGeneration !== this.hgGeneration || hgCurrent.state !== "accepted") { await hgRoom.disconnect(true); return; }
      await hgRoom.localParticipant.setMicrophoneEnabled(true);
      if (!this.hgAlive() || hgGeneration !== this.hgGeneration) { await hgRoom.disconnect(true); return; }
      if (hgCall.mediaType === "video") await hgRoom.localParticipant.setCameraEnabled(true);
      if (!this.hgAlive() || hgGeneration !== this.hgGeneration) { await hgRoom.disconnect(true); return; }
      this.hgUpdateTracks(hgRoom);
      this.setState({ hgConnection: "音视频已连接", hgMicrophone: true, hgCamera: hgCall.mediaType === "video" });
    } catch {
      if (hgRoom) await hgRoom.disconnect(true);
      if (this.hgRoom === hgRoom) this.hgRoom = null;
      if (this.hgAlive() && hgGeneration === this.hgGeneration) this.setState({ hgTracks: [], hgConnection: "音视频连接失败", hgError: "请检查通话设备归属、麦克风/摄像头权限与 LiveKit/TURN 配置。" });
    } finally { this.hgJoining = false; if (this.hgAlive() && !this.hgActionBusy) this.setState({ hgBusy: false }); }
  };

  hgUpdateTracks(hgRoom) {
    if (!this.hgAlive() || this.hgRoom !== hgRoom) return;
    const hgTracks = []; // 两位参与者，每人最多音频/视频两条。
    for (const hgParticipant of [hgRoom.localParticipant, ...hgRoom.remoteParticipants.values()]) {
      for (const hgPublication of hgParticipant.trackPublications.values()) {
        if (hgPublication.track) hgTracks.push({ track: hgPublication.track, local: hgParticipant === hgRoom.localParticipant });
      }
    }
    this.setState({ hgTracks: hgTracks.slice(0, 4) });
  }

  hgToggle = async (hgKind) => {
    if (!this.hgRoom || this.hgActionBusy) return;
    this.hgActionBusy = true;
    const hgRoom = this.hgRoom; // 捕获当前实例，终态后不得更新开关状态。
    try {
      if (hgKind === "audio") await hgRoom.localParticipant.setMicrophoneEnabled(!this.state.hgMicrophone);
      else await hgRoom.localParticipant.setCameraEnabled(!this.state.hgCamera);
      if (this.hgRoom !== hgRoom || !this.hgAlive()) { await hgRoom.disconnect(true); return; }
      this.setState({ hgMicrophone: hgRoom.localParticipant.isMicrophoneEnabled, hgCamera: hgRoom.localParticipant.isCameraEnabled });
    } catch { if (this.hgAlive()) this.setState({ hgError: "切换媒体设备失败，请检查浏览器权限" }); }
    finally { this.hgActionBusy = false; }
  };

  /** disconnect(true) 停止 SDK 管理的本机轨道，移除监听后再断开防止递归回调。 */
  hgDisconnect = () => {
    this.hgGeneration++;
    const hgRoom = this.hgRoom; // 从实例解绑，迟到回调不得操作新房间。
    this.hgRoom = null;
    if (hgRoom) { hgRoom.removeAllListeners(); void hgRoom.disconnect(true).catch(() => {}); }
    if (this.hgMounted) this.setState({ hgTracks: [], hgConnection: "未连接音视频", hgMicrophone: false, hgCamera: false });
  };

  renderActions() {
    const hgCall = this.state.hgCall; // 当前已知权威状态。
    const hgCaller = hgCall?.callerId === this.props.vm.hgOwner; // 只决定按钮，实际权限由 Go 判断。
    if (!this.hgActive()) return this.state.hgRetryCreate && this.hgCommand
      ? <button type="button" disabled={this.state.hgBusy || this.hgCommand.conversationId !== this.props.conversationId} onClick={() => void this.hgCreate(this.hgCommand.mediaType)}>按原请求重试呼叫</button>
      : null;
    if (hgCall.state === "ringing") return hgCaller
      ? <button type="button" disabled={this.state.hgBusy} onClick={() => void this.hgAction("cancel")}>取消呼叫</button>
      : <><button type="button" disabled={this.state.hgBusy} onClick={() => void this.hgAction("accept")}>接听</button><button type="button" disabled={this.state.hgBusy} onClick={() => void this.hgAction("reject")}>拒绝</button></>;
    return <>
      {!this.hgRoom && <button type="button" disabled={this.state.hgBusy} onClick={this.hgJoin}>加入音视频</button>}
      {this.hgRoom && <>
        <button type="button" onClick={() => void this.hgToggle("audio")}>{this.state.hgMicrophone ? "静音" : "开启麦克风"}</button>
        {hgCall.mediaType === "video" && <button type="button" onClick={() => void this.hgToggle("video")}>{this.state.hgCamera ? "关闭摄像头" : "开启摄像头"}</button>}
        <button type="button" onClick={() => void this.hgRoom?.startAudio().catch(() => this.setState({ hgError: "浏览器仍阻止声音播放，请检查站点设置" }))}>开启声音播放</button>
      </>}
      <button type="button" disabled={this.hgActionBusy} onClick={() => void this.hgAction("end")}>结束通话</button>
    </>;
  }

  render() {
    const hgCall = this.state.hgCall; // 无呼叫、无失败状态时不占据聊天区域。
    if (!hgCall && !this.state.hgError && !this.state.hgRetryCreate) return null;
    return <section className={styles.panel} aria-label="单聊通话">
      {hgCall && <div aria-live="polite">会话 {hgCall.conversationId} · {({ ringing: "振铃中", accepted: "业务已接听", ended: "已结束", rejected: "已拒绝", cancelled: "已取消", timeout: "已超时" })[hgCall.state]} · {this.state.hgConnection}</div>}
      <div className={styles.actions}>{this.renderActions()}</div>
      {this.state.hgError && <p role="alert">{this.state.hgError} <button type="button" onClick={this.hgRefresh}>刷新状态</button></p>}
      <div className={styles.tracks}>{this.state.hgTracks.map(({ track: hgTrack, local: hgLocal }) => <HGIMTrack key={hgTrack.sid || hgTrack.mediaStreamTrack.id} track={hgTrack} local={hgLocal} />)}</div>
    </section>;
  }
}
