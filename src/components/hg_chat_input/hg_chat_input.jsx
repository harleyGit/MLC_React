import React from "react";
import { HG_IM_MIME, hgIMPrepareUpload, hgIMPut } from "../../manager_antd/net_handle/hg_im_media";
import HGIconPage from "../hg_icon/hg_icon_page.jsx";
import styles from "./hg_chat_input.module.css";

/** 输入模式和展开面板仅控制本组件的 UI；消息归属始终以操作开始时的会话为准。 */
const MODE_TEXT = "text";
const MODE_VOICE = "voice";
const PANEL_NONE = "none";
const PANEL_EMOJI = "emoji";
const PANEL_PLUS = "plus";
const EMOJI_OPTIONS = ["😀", "😄", "😂", "🤣", "😊", "😍", "😘", "😜", "😎", "🤔", "😴", "😭", "😡", "👍", "👏", "🙏", "💪", "🤝", "🌹", "🎉", "🔥", "❤️", "💔", "💯"];
const PLUS_ACTIONS = [
  { key: "image", label: "图片", icon: "image" },
  { key: "video", label: "视频", icon: "video" },
  { key: "audio", label: "音频", icon: "mic" },
  { key: "file", label: "文件", icon: "file" },
  { key: "call-audio", label: "语音通话", icon: "mic", mediaType: "audio" },
  { key: "call-video", label: "视频通话", icon: "video", mediaType: "video" },
];

/** IM 输入：api、conversationId、onSend、onUploadChange、onCall、callReady 均由首页提供，无默认值；审核通过才发送附件。 */
export default class HGChatInput extends React.Component {
  state = {
    hgDraft: "", // 当前文本草稿，不写入浏览器持久存储。
    hgBusy: false, // 文件准备/上传/发送互斥，防止重复预留配额。
    hgJob: null, // 单个附件的目标会话、mediaId、审核状态；未开始时 null。
    hgPending: null, // 待确认或失败命令，重试保留 clientMsgId 和原会话。
    hgError: "", // 业务阶段错误提示，不输出签名 URL。
    hgRecording: false, // 麦克风已启动采集，最长60秒。
    hgRequestingMic: false, // 等待系统权限，卸载/取消后不得启动采集。
    hgMode: MODE_TEXT, // 默认文字；voice 模式展示真实录音按钮。
    hgPanel: PANEL_NONE, // 默认收起；emoji/plus 分别展示表情和附件。
    hgRecordSeconds: 0, // 已录制秒数，停止后归零；最大60。
  };
  hgMounted = false; // 卸载后拒绝异步回写。
  hgController = new AbortController(); // 上传/审核生命周期取消。
  hgGrant = null; // S3 预签名仅驻留内存，不进入 state/日志/存储。
  hgFile = null; // 单个待上传 Blob，发送/撤销后释放。
  hgInput = React.createRef(); // 原生文件选择器，无自制路径访问。
  hgKind = "file"; // 本次选择的白名单类型。
  hgReviewTimer = null; // 审核状态每10秒查询，最多40次。
  hgReviewAttempts = 0; // 有界审核轮询次数，手动检查可重新发起单次查询。
  hgRecorder = null; // 实际 MediaRecorder，非演示计时。
  hgStream = null; // 本次麦克风流，结束/卸载必须停止全部 track。
  hgRecordTimer = null; // 60秒录音硬上限。
  hgRecordTicker = null; // 仅供 UI 展示的秒数计时器，不作为录音内容。
  hgRecordStartAt = 0; // 实际开始采集时间戳，用于拒绝过短录音。
  hgMicVersion = 0; // 权限回调栅栏，取消后忽略迟到 getUserMedia。
  hgFinishingRecording = false; // stop 到 onstop 期间不允许另起附件或录音。
  hgActionBusy = false; // setState 前的同步互斥，阻止同一事件循环连点。
  hgReviewBusy = false; // 审核查询单飞，防止手动检查与后台轮询竞态。
  hgReviewVersion = 0; // 撤销/换附件后拒绝迟到审核响应覆盖当前状态。
  hgFileConversation = ""; // 打开原生文件选择器时绑定的会话，选择器关闭前不改变。

  /** 本机进度只发给所属会话的发送方，不把未审核附件广播为已发送消息。 */
  hgReportUpload = (hgUpdate) => { if (this.hgMounted) this.props.onUploadChange(hgUpdate); };

  componentDidMount() { this.hgMounted = true; }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgController.abort();
    clearTimeout(this.hgReviewTimer);
    clearInterval(this.hgRecordTicker);
    this.hgStopRecording(false);
    this.hgGrant = null;
    this.hgFile = null;
  }

  /** API 错误只映射当前操作，保留幂等命令与附件身份供重试。 */
  hgFail = (hgMessage) => { if (this.hgMounted) this.setState({ hgError: hgMessage }); };

  /** 发送失败保留原命令；切换会话也不能把失败内容发给新的对象。 */
  hgSubmit = async (hgCommand) => {
    if (this.hgActionBusy || this.props.disabled) return;
    this.hgActionBusy = true;
    this.setState({ hgBusy: true, hgError: "", hgPending: hgCommand });
    try {
      const hgReceipt = await this.props.onSend(hgCommand);
      if (!this.hgMounted) return;
      if (hgCommand.messageType !== "text") this.hgReportUpload({ clientMsgId: hgCommand.clientMsgId, state: "sent", messageId: hgReceipt.messageId });
      this.setState((hgPrevious) => ({ hgPending: null,
        hgDraft: hgCommand.messageType === "text" && hgPrevious.hgDraft.trim() === hgCommand.content.text ? "" : hgPrevious.hgDraft,
        hgJob: hgCommand.messageType === "text" ? hgPrevious.hgJob : null }));
      if (hgCommand.messageType !== "text") { this.hgGrant = null; this.hgFile = null; }
    } catch {
      if (hgCommand.messageType !== "text") this.hgReportUpload({ clientMsgId: hgCommand.clientMsgId, state: "uncertain" });
      this.hgFail("发送结果未确认；请用原命令重试，避免重复消息。");
    }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  hgSendText = () => {
    const hgText = this.state.hgDraft.trim(); // 保留发送时的内容快照。
    if (!hgText || this.state.hgPending) return;
    if ([...hgText].length > 1000 || new TextEncoder().encode(JSON.stringify({ text: hgText })).length > 4096) {
      this.hgFail("文本最多1000字符，编码后内容不得超过4096字节"); return;
    }
    void this.hgSubmit({ conversationId: this.props.conversationId, clientMsgId: crypto.randomUUID(), messageType: "text", content: { text: hgText } });
  };

  /** 切换语音模式只改变输入 UI；正在采集时先取消，不能把未完成录音发送出去。 */
  hgSwitchMode = (hgMode) => {
    if (this.state.hgRecording || this.state.hgRequestingMic) this.hgStopRecording(false);
    this.setState({ hgMode, hgPanel: PANEL_NONE });
  };

  /** 表情插入草稿而非绕开 Go 幂等发送流程。 */
  hgTogglePanel = (hgPanel) => {
    this.setState((hgPrevious) => ({ hgPanel: hgPrevious.hgPanel === hgPanel ? PANEL_NONE : hgPanel }));
  };

  hgInsertEmoji = (hgEmoji) => {
    if (this.props.disabled || this.state.hgBusy || this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic) return;
    this.setState((hgPrevious) => ({ hgDraft: hgPrevious.hgDraft + hgEmoji }));
  };

  hgChoose = (hgKind) => {
    if (this.props.disabled || this.hgActionBusy || this.hgFinishingRecording || this.state.hgBusy || this.state.hgJob || this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic) return;
    this.hgKind = hgKind;
    this.hgFileConversation = this.props.conversationId;
    this.hgInput.current.accept = HG_IM_MIME[hgKind].join(",");
    this.hgInput.current.click();
    this.setState({ hgPanel: PANEL_NONE });
  };

  /** 更多面板中的通话沿用首页面板的设备鉴权及会话幂等控制，不走附件选择器。 */
  hgStartCall = (hgMediaType) => {
    if (this.props.disabled || this.state.hgBusy || this.state.hgRecording || this.state.hgRequestingMic) return;
    this.setState({ hgPanel: PANEL_NONE });
    if (!this.props.callReady) {
      this.hgFail("当前标签页没有有效聊天设备，请退出后重新登录再发起通话。");
      return;
    }
    this.setState({ hgError: "" });
    this.props.onCall(hgMediaType);
  };

  /** 捕获选择文件时的会话；审核完成后仍向此会话发送，不跟随之后切换。 */
  hgPrepare = async (hgFile, hgKind, hgConversation = this.props.conversationId) => {
    if (this.hgActionBusy || !hgFile || this.props.disabled) return;
    this.hgActionBusy = true;
    let hgJob = null; // 预留成功后保留媒体身份供重试，即使 React 尚未提交状态。
    const hgClientMsgId = crypto.randomUUID(); // 本次选择到服务端发送均复用同一幂等 ID。
    this.setState({ hgBusy: true, hgError: "" });
    this.hgReportUpload({ clientMsgId: hgClientMsgId, conversationId: hgConversation, messageType: hgKind, state: "hashing", file: hgFile });
    try {
      this.hgFile = hgFile;
      this.hgGrant = await hgIMPrepareUpload(this.props.api, hgFile, hgKind, hgConversation);
      if (!this.hgMounted) { this.hgGrant = null; this.hgFile = null; return; }
      hgJob = { mediaId: this.hgGrant.mediaId, conversationId: hgConversation, messageType: hgKind, state: "uploading", clientMsgId: hgClientMsgId };
      this.setState({ hgJob });
      this.hgReportUpload({ clientMsgId: hgClientMsgId, state: "uploading" });
      await this.hgUpload(hgJob);
    } catch (hgError) {
      if (!hgJob) { this.hgFile = null; this.hgGrant = null; }
      this.hgReportUpload({ clientMsgId: hgClientMsgId, state: "failed" });
      this.hgFail(hgError?.status === 503 ? "IM 媒体未启用或依赖不可用，请联系管理员检查实时模块、对象存储和审核服务。" : "附件准备或上传失败，请检查格式/大小、配额和后端媒体配置；已取得媒体ID时可重试。");
    }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  /** PUT 重试复用同一对象；complete 可重复提交，避免再次占用上传配额。 */
  hgUpload = async (hgJob) => {
    await hgIMPut(this.hgGrant, this.hgFile, AbortSignal.any([this.hgController.signal, this.props.api.hgOptions.signal]));
    await this.props.api.hgUploadComplete(hgJob.mediaId);
    if (!this.hgMounted) return;
    this.hgFile = null;
    this.hgGrant = null;
    this.hgReviewAttempts = 0;
    await new Promise((hgResolve) => this.setState({ hgJob: { ...hgJob, state: "verifying" } }, hgResolve));
    this.hgReportUpload({ clientMsgId: hgJob.clientMsgId, state: "verifying" });
    // 下轮事件循环再查审核，让上传互斥先释放；ready 时自动发送。
    this.hgReviewTimer = setTimeout(() => void this.hgReview(hgJob), 0);
  };

  hgRetryUpload = async () => {
    if (this.hgActionBusy || !this.hgGrant || !this.hgFile) return;
    this.hgActionBusy = true;
    this.setState({ hgBusy: true, hgError: "" });
    try { await this.hgUpload(this.state.hgJob); }
    catch {
      this.hgReportUpload({ clientMsgId: this.state.hgJob.clientMsgId, state: "failed" });
      this.hgFail("上传未确认；预签名可能已过期，可撤销后重新选择附件。");
    }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  /** 只使用审核器的实际宽高/时长；pending 超时后保留手动查询，不自动放行。 */
  hgReview = async (hgJob = this.state.hgJob) => {
    clearTimeout(this.hgReviewTimer);
    if (!hgJob || !this.hgMounted) return;
    if (this.hgReviewBusy) {
      this.hgReviewTimer = setTimeout(() => void this.hgReview(), 1000);
      return;
    }
    this.hgReviewBusy = true;
    const hgVersion = this.hgReviewVersion;
    try {
      const hgStatus = await this.props.api.hgMediaStatus(hgJob.mediaId); // 真实审核状态。
      if (!this.hgMounted || hgVersion !== this.hgReviewVersion || this.state.hgJob?.mediaId !== hgJob.mediaId) return;
      const hgNextJob = { ...hgJob, ...hgStatus, mediaId: hgJob.mediaId }; // ready 元数据只取审核器返回值。
      this.setState({ hgJob: hgNextJob }, () => {
        if (hgStatus.state === "ready" && this.hgMounted && hgVersion === this.hgReviewVersion) this.hgSendMedia(hgNextJob);
      });
      if (hgStatus.state === "rejected" || hgStatus.state === "deleted") this.hgReportUpload({ clientMsgId: hgJob.clientMsgId, state: hgStatus.state });
      if (hgStatus.state === "verifying" && ++this.hgReviewAttempts < 40) this.hgReviewTimer = setTimeout(() => void this.hgReview(), 10000);
    } catch {
      if (hgVersion === this.hgReviewVersion) {
        this.hgReportUpload({ clientMsgId: hgJob.clientMsgId, state: "failed" });
        this.hgFail("审核状态查询失败，可手动继续检查；未通过审核不能发送。");
      }
    }
    finally { this.hgReviewBusy = false; }
  };

  hgSendMedia = (hgJob) => {
    if (hgJob?.state !== "ready") return;
    if (this.state.hgPending || this.hgActionBusy || this.props.disabled) {
      this.hgReportUpload({ clientMsgId: hgJob.clientMsgId, state: "failed" });
      this.hgFail("审核已通过，但当前无法发送；请恢复会话后重试。");
      return;
    }
    this.hgReportUpload({ clientMsgId: hgJob.clientMsgId, state: "sending" });
    void this.hgSubmit({ conversationId: hgJob.conversationId, clientMsgId: hgJob.clientMsgId, messageType: hgJob.messageType,
      content: { mediaId: hgJob.mediaId, width: hgJob.width, height: hgJob.height, durationMs: hgJob.durationMs } });
  };

  hgDelete = async () => {
    if (this.hgActionBusy || this.state.hgPending || !this.state.hgJob) return;
    this.hgActionBusy = true;
    clearTimeout(this.hgReviewTimer);
    this.hgReviewVersion++;
    this.setState({ hgBusy: true });
    try {
      await this.props.api.hgMediaDelete(this.state.hgJob.mediaId);
      if (this.hgMounted) this.setState({ hgJob: null, hgError: "" });
      this.hgReportUpload(null);
      this.hgFile = null; this.hgGrant = null;
    } catch { this.hgFail("撤销失败，附件状态仍需服务端确认。"); }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  /** 真正采集音频，仅选择后端支持的容器；浏览器仅支持 WebM 时提示上传音频文件。 */
  hgStartRecording = async () => {
    if (this.props.disabled || this.state.hgRecording || this.state.hgRequestingMic || this.state.hgJob || this.state.hgPending || this.hgActionBusy || this.hgFinishingRecording) return;
    const hgMIME = ["audio/mp4", "audio/ogg;codecs=opus"].find((hgType) => globalThis.MediaRecorder?.isTypeSupported(hgType));
    if (!hgMIME || !navigator.mediaDevices?.getUserMedia) { this.hgFail("此浏览器不能录制后端支持的音频容器，请选择 MP3/OGG/M4A/AAC 文件。"); return; }
    const hgVersion = ++this.hgMicVersion; // 用户取消后使系统权限响应失效。
    const hgConversation = this.props.conversationId; // 录音归属固定，不跟随切换。
    this.setState({ hgRequestingMic: true, hgError: "" });
    try {
      const hgStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.hgMounted || hgVersion !== this.hgMicVersion) { hgStream.getTracks().forEach((hgTrack) => hgTrack.stop()); return; }
      this.hgStream = hgStream;
      const hgChunks = []; // 最长60秒，最多10MiB内存录音。
      let hgSize = 0; // 已收集字节数，超限取消录音。
      const hgRecorder = new MediaRecorder(hgStream, { mimeType: hgMIME, audioBitsPerSecond: 64000 });
      this.hgRecorder = hgRecorder;
      hgRecorder.ondataavailable = (hgEvent) => {
        hgSize += hgEvent.data.size;
        if (hgSize > 10 * 1024 * 1024) { this.hgStopRecording(false); this.hgFail("录音超过10MiB，已取消"); return; }
        if (hgEvent.data.size) hgChunks.push(hgEvent.data);
      };
      hgRecorder.onstop = () => {
        if (this.hgMounted && hgRecorder.hgSend) {
          if (hgChunks.length) void this.hgPrepare(new Blob(hgChunks, { type: hgMIME.split(";")[0] }), "audio", hgConversation);
          else this.hgFail("录音内容为空，请重试");
        }
        this.hgFinishingRecording = false;
      };
      hgRecorder.onerror = () => {
        if (this.hgRecorder !== hgRecorder) return;
        this.hgStopRecording(false);
        this.hgFail("录音设备异常，请重试");
      };
      hgRecorder.start(1000);
      this.hgRecordStartAt = Date.now();
      this.setState({ hgRecording: true, hgRequestingMic: false, hgRecordSeconds: 0 });
      this.hgRecordTicker = setInterval(() => {
        if (this.hgMounted) this.setState({ hgRecordSeconds: Math.min(60, Math.floor((Date.now() - this.hgRecordStartAt) / 1000)) });
      }, 1000);
      this.hgRecordTimer = setTimeout(() => this.hgStopRecording(true), 60000);
    } catch {
      if (!this.hgMounted || hgVersion !== this.hgMicVersion) return;
      this.hgStopRecording(false);
      this.hgFail("无法访问麦克风，请检查系统权限与 HTTPS");
    }
  };

  hgStopRecording = (hgSend) => {
    this.hgMicVersion++;
    clearTimeout(this.hgRecordTimer);
    clearInterval(this.hgRecordTicker);
    if (hgSend && Date.now() - this.hgRecordStartAt < 1000) {
      hgSend = false;
      this.hgFail("说话时间太短，请至少录制1秒");
    }
    if (this.hgRecorder && this.hgRecorder.state !== "inactive") {
      this.hgFinishingRecording = hgSend;
      this.hgRecorder.hgSend = hgSend;
      this.hgRecorder.stop();
    }
    this.hgStream?.getTracks().forEach((hgTrack) => hgTrack.stop());
    this.hgStream = null;
    this.hgRecorder = null;
    if (this.hgMounted) this.setState({ hgRecording: false, hgRequestingMic: false, hgRecordSeconds: 0 });
  };

  /** 权限弹窗未完成时松手即作废；pointercancel/移出按钮同样不发送。 */
  hgRecordEnd = () => {
    this.hgStopRecording(this.state.hgRecording);
  };

  renderAttachment() {
    const hgJob = this.state.hgJob; // null 表示没有正在审核/待发送的附件。
    if (!hgJob || (!this.state.hgError && (this.state.hgBusy || hgJob.state === "ready" ||
      (hgJob.state === "verifying" && this.hgReviewAttempts < 40)))) return null;
    return <div className={styles.job}>
      <span>附件 · 会话 {hgJob.conversationId} · {({ uploading: "待完成上传", verifying: "审核中", ready: "审核通过", rejected: "审核拒绝", deleted: "已撤销" })[hgJob.state] || "未知状态"}</span>
      {hgJob.state === "uploading" && <button type="button" disabled={this.state.hgBusy} onClick={this.hgRetryUpload}>重试上传/完成</button>}
      {hgJob.state === "verifying" && <button type="button" disabled={this.state.hgBusy || this.hgReviewBusy} onClick={() => void this.hgReview()}>检查审核</button>}
      {hgJob.state === "ready" && <button type="button" disabled={this.state.hgBusy || !!this.state.hgPending || this.props.disabled} onClick={() => this.hgSendMedia(hgJob)}>重试发送</button>}
      <button type="button" disabled={this.state.hgBusy || !!this.state.hgPending} onClick={this.hgDelete}>撤销附件</button>
      <small>撤销不返还当前服务端预留配额</small>
    </div>;
  }

  /** 更多面板将附件与通话分流；通话不使用文件 MIME 白名单。 */
  renderPanel() {
    const hgBlocked = this.props.disabled || this.state.hgBusy || this.hgFinishingRecording || !!this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic;
    if (this.state.hgPanel === PANEL_EMOJI) return <div className={styles.panel}>
      <div className={styles.emojiGrid}>{EMOJI_OPTIONS.map((hgEmoji) =>
        <button key={hgEmoji} type="button" className={styles.emojiItem} disabled={hgBlocked} aria-label={`插入表情 ${hgEmoji}`} onClick={() => this.hgInsertEmoji(hgEmoji)}>{hgEmoji}</button>
      )}</div>
    </div>;
    if (this.state.hgPanel === PANEL_PLUS) return <div className={styles.panel}>
      <div className={styles.plusGrid}>{PLUS_ACTIONS.map((hgAction) =>
        <button key={hgAction.key} type="button" className={styles.plusItem} disabled={hgBlocked || (!hgAction.mediaType && !!this.state.hgJob)} onClick={() => hgAction.mediaType ? this.hgStartCall(hgAction.mediaType) : this.hgChoose(hgAction.key)}>
          <span className={styles.plusIcon}><HGIconPage type={hgAction.icon} className={styles.actionIcon} /></span>
          <span className={styles.plusLabel}>{hgAction.label}</span>
        </button>
      )}</div>
    </div>;
    return null;
  }

  /** 左侧语音/键盘切换不影响已有附件、草稿或失败命令。 */
  renderModeButton() {
    const hgVoice = this.state.hgMode === MODE_VOICE;
    return <button type="button" className={styles.toolButton} disabled={this.props.disabled} title={hgVoice ? "切换到键盘输入" : "切换到语音输入"} onClick={() => this.hgSwitchMode(hgVoice ? MODE_TEXT : MODE_VOICE)}>
      <HGIconPage type={hgVoice ? "keyboard" : "mic"} className={styles.toolIcon} />
    </button>;
  }

  /** 录音使用 MediaRecorder；权限尚未返回时松开/取消会失效化权限请求。 */
  renderInputBody() {
    const hgBlocked = this.props.disabled || this.state.hgBusy || this.hgFinishingRecording || !!this.state.hgPending || !!this.state.hgJob;
    if (this.state.hgMode === MODE_VOICE) return <button
      type="button" className={`${styles.holdButton} ${this.state.hgRecording ? styles.holdButtonActive : ""}`}
      disabled={hgBlocked && !this.state.hgRecording && !this.state.hgRequestingMic}
      onPointerDown={(hgEvent) => { if (hgEvent.pointerType !== "mouse" || hgEvent.button === 0) { hgEvent.preventDefault(); void this.hgStartRecording(); } }}
      onPointerUp={this.hgRecordEnd}
      onPointerLeave={() => { if (this.state.hgRecording || this.state.hgRequestingMic) this.hgStopRecording(false); }}
      onPointerCancel={() => this.hgStopRecording(false)}
      onKeyDown={(hgEvent) => { if (!hgEvent.repeat && (hgEvent.key === " " || hgEvent.key === "Enter")) { hgEvent.preventDefault(); void this.hgStartRecording(); } }}
      onKeyUp={(hgEvent) => { if (hgEvent.key === " " || hgEvent.key === "Enter") { hgEvent.preventDefault(); this.hgRecordEnd(); } }}
      onContextMenu={(hgEvent) => hgEvent.preventDefault()}
    >{this.state.hgRequestingMic ? "等待麦克风权限…" : this.state.hgRecording ? `松开发送（${this.state.hgRecordSeconds}/60秒）` : "按住说话（最多60秒）"}</button>;
    return <textarea aria-label="聊天消息" className={styles.input} placeholder="输入消息，Enter发送，Shift+Enter换行" value={this.state.hgDraft} disabled={hgBlocked || this.state.hgRecording || this.state.hgRequestingMic}
      onChange={(hgEvent) => this.setState({ hgDraft: hgEvent.target.value })}
      onKeyDown={(hgEvent) => { if (hgEvent.key === "Enter" && !hgEvent.shiftKey && !hgEvent.nativeEvent.isComposing && hgEvent.keyCode !== 229) { hgEvent.preventDefault(); this.hgSendText(); } }} />;
  }

  renderRightActions() {
    const hgBlocked = this.props.disabled || this.state.hgBusy || this.hgFinishingRecording || !!this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic;
    return <>
      <button type="button" className={`${styles.toolButton} ${this.state.hgPanel === PANEL_PLUS ? styles.toolButtonActive : ""}`} disabled={hgBlocked} title={this.state.hgPanel === PANEL_PLUS ? "收起" : "更多功能"} onClick={() => this.hgTogglePanel(PANEL_PLUS)}>
        <HGIconPage type="plus-circle" className={styles.toolIcon} />
      </button>
      {this.state.hgMode === MODE_TEXT && !!this.state.hgDraft.trim() &&
        <button type="button" className={styles.sendButton} disabled={hgBlocked} onClick={this.hgSendText}>发送</button>}
    </>;
  }

  render() {
    const hgBlocked = this.props.disabled || this.state.hgBusy || this.hgFinishingRecording || !!this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic;
    return <div className={styles.root}>
      {this.state.hgError && <p className={styles.error} role="alert">{this.state.hgError}</p>}
      {this.state.hgPending && !this.state.hgBusy && <div className={styles.job}>
        <span>待确认命令 · 会话 {this.state.hgPending.conversationId}</span>
        <button type="button" onClick={() => void this.hgSubmit(this.state.hgPending)}>原幂等ID重试</button>
        <button type="button" onClick={() => this.setState({ hgPending: null, hgError: "已放弃本地重试；原消息可能已在服务端保存，请先同步核对。" })}>放弃本地重试</button>
      </div>}
      {this.renderAttachment()}
      <input type="file" hidden ref={this.hgInput} onChange={(hgEvent) => { const hgFile = hgEvent.target.files?.[0]; hgEvent.target.value = ""; void this.hgPrepare(hgFile, this.hgKind, this.hgFileConversation); }} />
      <div className={styles.inputBar}>
        {this.renderModeButton()}
        {this.renderInputBody()}
        <button type="button" className={`${styles.toolButton} ${this.state.hgPanel === PANEL_EMOJI ? styles.toolButtonActive : ""}`} disabled={hgBlocked} title="表情" onClick={() => this.hgTogglePanel(PANEL_EMOJI)}>
          <HGIconPage type="emotion" className={styles.toolIcon} />
        </button>
        {this.renderRightActions()}
      </div>
      {this.renderPanel()}
    </div>;
  }
}
