import React from "react";
import { HG_IM_MIME, hgIMPrepareUpload, hgIMPut } from "../../manager_antd/net_handle/hg_im_media";
import styles from "./hg_im_composer.module.css";

/** 真实 IM 输入：api、conversationId、onSend 为页面提供，无默认值；发送仅解释为 Go 持久化。 */
export default class HGIMComposer extends React.Component {
  state = {
    hgDraft: "", // 当前文本草稿，不写入浏览器持久存储。
    hgBusy: false, // 文件准备/上传/发送互斥，防止重复预留配额。
    hgJob: null, // 单个附件的目标会话、mediaId、审核状态；未开始时 null。
    hgPending: null, // 待确认或失败命令，重试保留 clientMsgId 和原会话。
    hgError: "", // 业务阶段错误提示，不输出签名 URL。
    hgRecording: false, // 麦克风已启动采集，最长60秒。
    hgRequestingMic: false, // 等待系统权限，卸载/取消后不得启动采集。
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
  hgMicVersion = 0; // 权限回调栅栏，取消后忽略迟到 getUserMedia。
  hgActionBusy = false; // setState 前的同步互斥，阻止同一事件循环连点。
  hgReviewBusy = false; // 审核查询单飞，防止手动检查与后台轮询竞态。
  hgFileConversation = ""; // 打开原生文件选择器时绑定的会话，选择器关闭前不改变。

  componentDidMount() { this.hgMounted = true; }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgController.abort();
    clearTimeout(this.hgReviewTimer);
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
      await this.props.onSend(hgCommand);
      if (!this.hgMounted) return;
      this.setState((hgPrevious) => ({ hgPending: null,
        hgDraft: hgCommand.messageType === "text" && hgPrevious.hgDraft.trim() === hgCommand.content.text ? "" : hgPrevious.hgDraft,
        hgJob: hgCommand.messageType === "text" ? hgPrevious.hgJob : null }));
      if (hgCommand.messageType !== "text") { this.hgGrant = null; this.hgFile = null; }
    } catch { this.hgFail("发送结果未确认；请用原命令重试，避免重复消息。"); }
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

  hgChoose = (hgKind) => {
    if (this.state.hgBusy || this.state.hgJob || this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic) return;
    this.hgKind = hgKind;
    this.hgFileConversation = this.props.conversationId;
    this.hgInput.current.accept = HG_IM_MIME[hgKind].join(",");
    this.hgInput.current.click();
  };

  /** 捕获选择文件时的会话；审核完成后仍向此会话发送，不跟随之后切换。 */
  hgPrepare = async (hgFile, hgKind, hgConversation = this.props.conversationId) => {
    if (this.hgActionBusy || !hgFile || this.props.disabled) return;
    this.hgActionBusy = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      this.hgFile = hgFile;
      this.hgGrant = await hgIMPrepareUpload(this.props.api, hgFile, hgKind, hgConversation);
      if (!this.hgMounted) return;
      const hgJob = { mediaId: this.hgGrant.mediaId, conversationId: hgConversation, messageType: hgKind, state: "uploading", clientMsgId: crypto.randomUUID() };
      this.setState({ hgJob });
      await this.hgUpload(hgJob);
    } catch { this.hgFail("附件准备或上传失败，请检查格式/大小、配额和后端媒体配置；已取得媒体ID时可重试。"); }
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
    await this.hgReview(hgJob);
  };

  hgRetryUpload = async () => {
    if (this.hgActionBusy || !this.hgGrant || !this.hgFile) return;
    this.hgActionBusy = true;
    this.setState({ hgBusy: true, hgError: "" });
    try { await this.hgUpload(this.state.hgJob); }
    catch { this.hgFail("上传未确认；预签名可能已过期，可撤销后重新选择附件。"); }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  /** 只使用审核器的实际宽高/时长；pending 超时后保留手动查询，不自动放行。 */
  hgReview = async (hgJob = this.state.hgJob) => {
    clearTimeout(this.hgReviewTimer);
    if (!hgJob || !this.hgMounted || this.hgReviewBusy) return;
    this.hgReviewBusy = true;
    try {
      const hgStatus = await this.props.api.hgMediaStatus(hgJob.mediaId); // 真实审核状态。
      if (!this.hgMounted || this.state.hgJob?.mediaId !== hgJob.mediaId) return;
      this.setState({ hgJob: { ...hgJob, ...hgStatus, mediaId: hgJob.mediaId } });
      if (hgStatus.state === "verifying" && ++this.hgReviewAttempts < 40) this.hgReviewTimer = setTimeout(() => void this.hgReview(), 10000);
    } catch { this.hgFail("审核状态查询失败，可手动继续检查；未通过审核不能发送。"); }
    finally { this.hgReviewBusy = false; }
  };

  hgSendMedia = () => {
    const hgJob = this.state.hgJob; // ready 的权威元数据，不接受本地猜测尺寸。
    if (hgJob?.state !== "ready" || this.state.hgPending) return;
    void this.hgSubmit({ conversationId: hgJob.conversationId, clientMsgId: hgJob.clientMsgId, messageType: hgJob.messageType,
      content: { mediaId: hgJob.mediaId, width: hgJob.width, height: hgJob.height, durationMs: hgJob.durationMs } });
  };

  hgDelete = async () => {
    if (this.hgActionBusy || this.state.hgPending) return;
    this.hgActionBusy = true;
    clearTimeout(this.hgReviewTimer);
    this.setState({ hgBusy: true });
    try {
      await this.props.api.hgMediaDelete(this.state.hgJob.mediaId);
      if (this.hgMounted) this.setState({ hgJob: null, hgError: "" });
      this.hgFile = null; this.hgGrant = null;
    } catch { this.hgFail("撤销失败，附件状态仍需服务端确认。"); }
    finally { this.hgActionBusy = false; if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  /** 真正采集音频，仅选择后端支持的容器；浏览器仅支持 WebM 时提示上传音频文件。 */
  hgStartRecording = async () => {
    if (this.state.hgRecording || this.state.hgRequestingMic || this.state.hgJob || this.hgActionBusy) return;
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
        if (this.hgMounted && hgRecorder.hgSend && hgChunks.length) void this.hgPrepare(new Blob(hgChunks, { type: hgMIME.split(";")[0] }), "audio", hgConversation);
      };
      hgRecorder.onerror = () => { this.hgStopRecording(false); this.hgFail("录音设备异常，请重试"); };
      hgRecorder.start(1000);
      this.setState({ hgRecording: true, hgRequestingMic: false });
      this.hgRecordTimer = setTimeout(() => this.hgStopRecording(true), 60000);
    } catch {
      this.hgStopRecording(false);
      this.hgFail("无法访问麦克风，请检查系统权限与 HTTPS");
    }
  };

  hgStopRecording = (hgSend) => {
    this.hgMicVersion++;
    clearTimeout(this.hgRecordTimer);
    if (this.hgRecorder && this.hgRecorder.state !== "inactive") {
      this.hgRecorder.hgSend = hgSend;
      this.hgRecorder.stop();
    }
    this.hgStream?.getTracks().forEach((hgTrack) => hgTrack.stop());
    this.hgStream = null;
    this.hgRecorder = null;
    if (this.hgMounted) this.setState({ hgRecording: false, hgRequestingMic: false });
  };

  renderAttachment() {
    const hgJob = this.state.hgJob; // null 表示没有正在审核/待发送的附件。
    if (!hgJob) return null;
    return <div className={styles.job}>
      <span>附件 · 会话 {hgJob.conversationId} · {({ uploading: "待完成上传", verifying: "审核中", ready: "审核通过", rejected: "审核拒绝", deleted: "已撤销" })[hgJob.state] || "未知状态"}</span>
      {hgJob.state === "uploading" && <button type="button" disabled={this.state.hgBusy} onClick={this.hgRetryUpload}>重试上传/完成</button>}
      {hgJob.state === "verifying" && <button type="button" onClick={() => void this.hgReview()}>检查审核</button>}
      {hgJob.state === "ready" && <button type="button" disabled={this.state.hgBusy || !!this.state.hgPending} onClick={this.hgSendMedia}>发送附件</button>}
      <button type="button" disabled={this.state.hgBusy || !!this.state.hgPending} onClick={this.hgDelete}>撤销附件</button>
      <small>撤销不返还当前服务端预留配额</small>
    </div>;
  }

  render() {
    const hgBlocked = this.props.disabled || this.state.hgBusy || !!this.state.hgPending || this.state.hgRecording || this.state.hgRequestingMic; // 当前互斥状态。
    return <div className={styles.composer}>
      {this.state.hgError && <p role="alert">{this.state.hgError}</p>}
      {this.state.hgPending && !this.state.hgBusy && <div className={styles.job}>
        <span>待确认命令 · 会话 {this.state.hgPending.conversationId}</span>
        <button type="button" onClick={() => void this.hgSubmit(this.state.hgPending)}>原幂等ID重试</button>
        <button type="button" onClick={() => this.setState({ hgPending: null, hgError: "已放弃本地重试；原消息可能已在服务端保存，请先同步核对。" })}>放弃本地重试</button>
      </div>}
      {this.renderAttachment()}
      <div className={styles.tools}>
        {[ ["image", "图片"], ["video", "视频"], ["audio", "音频"], ["file", "文件"] ].map(([hgKind, hgLabel]) => <button key={hgKind} type="button" disabled={hgBlocked || !!this.state.hgJob} onClick={() => this.hgChoose(hgKind)}>{hgLabel}</button>)}
        <button type="button" disabled={hgBlocked || !!this.state.hgJob} onClick={this.hgStartRecording}>录音（最多60秒）</button>
        {(this.state.hgRecording || this.state.hgRequestingMic) && <>
          {this.state.hgRecording && <button type="button" onClick={() => this.hgStopRecording(true)}>停止并送审</button>}
          <button type="button" onClick={() => this.hgStopRecording(false)}>取消录音</button>
        </>}
        {["😀", "👍", "❤️"].map((hgEmoji) => <button key={hgEmoji} type="button" disabled={hgBlocked} aria-label={`插入表情 ${hgEmoji}`} onClick={() => this.setState((hgPrevious) => ({ hgDraft: hgPrevious.hgDraft + hgEmoji }))}>{hgEmoji}</button>)}
      </div>
      <input type="file" hidden ref={this.hgInput} onChange={(hgEvent) => { const hgFile = hgEvent.target.files?.[0]; hgEvent.target.value = ""; void this.hgPrepare(hgFile, this.hgKind, this.hgFileConversation); }} />
      <div className={styles.row}>
        <textarea aria-label="聊天消息" placeholder="输入消息，Enter发送，Shift+Enter换行" value={this.state.hgDraft} disabled={hgBlocked}
          onChange={(hgEvent) => this.setState({ hgDraft: hgEvent.target.value })}
          onKeyDown={(hgEvent) => { if (hgEvent.key === "Enter" && !hgEvent.shiftKey && !hgEvent.nativeEvent.isComposing && hgEvent.keyCode !== 229) { hgEvent.preventDefault(); this.hgSendText(); } }} />
        <button type="button" disabled={hgBlocked || !this.state.hgDraft.trim()} onClick={this.hgSendText}>{this.state.hgBusy ? "处理中…" : "发送"}</button>
      </div>
    </div>;
  }
}
