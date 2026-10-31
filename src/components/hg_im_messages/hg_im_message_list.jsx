import React from "react";
import HGIMMediaPreview, { HGIMMediaCache } from "../hg_im_media/hg_im_media_preview.jsx";
import styles from "./hg_im_messages.module.css";

/** 媒体只在进入列表可视区时自动读取；短暂离屏仍保持组件直到虚拟槽被复用。 */
class HGIMVisibleMedia extends React.Component {
  hgNode = React.createRef(); // 单条附件可见性观察目标。
  hgObserver = null; // IntersectionObserver；卸载后取消回调。
  state = { hgSeen: !globalThis.IntersectionObserver }; // 不支持观察器时仍允许点击，默认不自动读取。

  componentDidMount() {
    if (!globalThis.IntersectionObserver) return;
    this.hgObserver = new IntersectionObserver(([hgEntry]) => {
      if (hgEntry.isIntersecting) { this.setState({ hgSeen: true }); this.hgObserver?.disconnect(); }
    }, { root: this.props.scrollRef.current });
    this.hgObserver.observe(this.hgNode.current);
  }

  componentWillUnmount() { this.hgObserver?.disconnect(); }

  render() {
    return <div ref={this.hgNode}><HGIMMediaPreview api={this.props.api} message={this.props.message}
      cache={this.props.cache} autoLoad={!!globalThis.IntersectionObserver && this.state.hgSeen} onDelete={this.props.onDelete} /></div>;
  }
}

/** 虚拟行复用 DOM 容器；内部附件以 messageId 为 key，换消息时必须清理旧 Blob/请求。 */
class HGIMMessageCell extends React.Component {
  hgNode = React.createRef(); // 当前复用槽的 DOM 节点，不持有消息内容。
  hgObserver = null; // 行高度测量器，槽位销毁时断开。

  componentDidMount() {
    if (!globalThis.ResizeObserver) return;
    this.hgObserver = new ResizeObserver(() => this.props.onHeight(this.props.message.seq, this.hgNode.current?.offsetHeight));
    this.hgObserver.observe(this.hgNode.current);
  }

  componentDidUpdate(hgPrevious) {
    if (hgPrevious.message.seq !== this.props.message.seq) this.props.onHeight(this.props.message.seq, this.hgNode.current?.offsetHeight);
  }

  componentWillUnmount() { this.hgObserver?.disconnect(); }

  render() {
    const hgMessage = this.props.message; // 槽位重用时只显示当前消息，不保留前一消息局部状态。
    const hgName = hgMessage.isSelf ? "我" : this.props.peerName || hgMessage.senderId || "用户"; // 协议没有头像 URL，使用文本占位。
    return <li ref={this.hgNode} className={`${styles.message} ${hgMessage.isSelf ? styles.mine : ""}`}>
      <span className={styles.avatar} aria-label={`${hgName}的头像`}>{[...String(hgName)][0] || "用"}</span>
      <div className={styles.messageBody}>
        <div className={styles.bubble}>
          {hgMessage.messageType === "text" ? <span>{hgMessage.content.text}</span> : <div>
            {["image", "video"].includes(hgMessage.messageType)
              ? <HGIMVisibleMedia key={hgMessage.messageId} api={this.props.api} message={hgMessage}
                cache={this.props.cache} scrollRef={this.props.scrollRef} onDelete={this.props.onDelete} />
              : <HGIMMediaPreview key={hgMessage.messageId} api={this.props.api} message={hgMessage}
                cache={this.props.cache} onDelete={this.props.onDelete} />}
            {hgMessage.content.durationMs > 0 && <span> {Math.ceil(hgMessage.content.durationMs / 1000)}秒</span>}
          </div>}
        </div>
        <small>{hgMessage.isSelf ? "我 · 已发送" : hgMessage.senderId} · #{hgMessage.seq}{hgMessage.createdAt ? ` · ${new Date(hgMessage.createdAt).toLocaleString()}` : ""}</small>
      </div>
    </li>;
  }
}

/** 有界消息窗口：下拉到顶取旧页，上拉到底取新页；可复用可见槽而不一次挂载 200 个媒体节点。 */
export default class HGIMMessageList extends React.Component {
  hgList = React.createRef(); // 原生滚动容器，窗口变化时按序号锚定原视野。
  hgResize = null; // 容器尺寸观察器，挂载时创建、卸载时断开。
  hgCache = new HGIMMediaCache(); // 仅此会话持有，组件销毁即清理。
  hgHeights = new Map(); // seq -> 行高像素，最多当前 200 条窗口，未知使用估计高度。
  hgRequest = ""; // 当前翻页方向，空字符串表示空闲。
  hgExhausted = { older: false, newer: false }; // 服务端返回空页时停止边缘重复请求，窗口变化时重置。
  hgAnchor = null; // 翻页前首个可见消息的 seq 和距容器顶部的像素位置。
  hgFrame = 0; // 滚动合并至下一帧，卸载时取消。
  hgMounted = false; // 卸载后不处理请求完成。
  hgTouchStart = null; // 手指起点纵坐标；null 表示没有顶端下拉手势。
  hgTouchEndStart = null; // 底端上拉手势起点；null 表示未在底端触摸。
  hgPinToBottom = true; // 首次测量前保持最新消息在底部；用户上滑后关闭。
  state = { hgTop: 0, hgViewport: 500 }; // 当前滚动偏移和容器可视高度，单位 px。

  componentDidMount() {
    this.hgMounted = true;
    const hgNode = this.hgList.current; // 初始只定位到最新窗口底部，不自动翻页。
    this.hgResize = globalThis.ResizeObserver ? new ResizeObserver(() => this.hgUpdateViewport()) : null;
    this.hgResize?.observe(hgNode);
    window.addEventListener("resize", this.hgUpdateViewport);
    this.hgUpdateViewport();
    this.hgScrollToBottom();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgResize?.disconnect();
    window.removeEventListener("resize", this.hgUpdateViewport);
    cancelAnimationFrame(this.hgFrame);
    this.hgCache.hgClear();
  }

  /** 高度来自真实 DOM；消息变化或宽度重排后重新定位，但保留有限测量表。 */
  hgMeasure = (hgSeq, hgHeight) => {
    if (!this.hgMounted || !Number.isFinite(hgHeight) || hgHeight <= 0 || this.hgHeights.get(hgSeq) === hgHeight) return;
    const hgIndex = this.props.messages.findIndex((hgMessage) => hgMessage.seq === hgSeq); // 已被窗口裁剪的旧行不测量。
    if (hgIndex < 0) return;
    const hgBefore = this.hgOffset(hgIndex); // 在视野上方的高度变化需补偿同等 scrollTop。
    const hgOldHeight = this.hgEstimate(this.props.messages[hgIndex]); // 首次使用估计高度，后续为 DOM 实测。
    this.hgHeights.set(hgSeq, hgHeight);
    const hgNode = this.hgList.current; // 用户仍看着同一条消息，测量不会突然推走阅读位置。
    if (this.hgPinToBottom) this.hgScrollToBottom();
    else if (hgNode && hgBefore + hgOldHeight <= hgNode.scrollTop) hgNode.scrollTop += hgHeight - hgOldHeight;
    this.hgScheduleScroll();
  };

  hgEstimate = (hgMessage) => this.hgHeights.get(hgMessage.seq) || (["image", "video"].includes(hgMessage.messageType) ? 285 : 96); // 未测量行的保守占位高度。

  hgOffset(hgIndex) {
    let hgPixels = 0; // 当前至多 200 条；求和无需无界索引或第三方依赖。
    for (let hgAt = 0; hgAt < hgIndex; hgAt++) hgPixels += this.hgEstimate(this.props.messages[hgAt]);
    return hgPixels;
  }

  hgUpdateViewport = () => {
    if (this.hgMounted && this.hgList.current) this.setState({ hgViewport: this.hgList.current.clientHeight || 500 });
  };

  hgScheduleScroll = () => {
    if (this.hgFrame) return;
    this.hgFrame = requestAnimationFrame(() => {
      this.hgFrame = 0;
      if (this.hgMounted && this.hgList.current) this.setState({ hgTop: this.hgList.current.scrollTop });
    });
  };

  hgScrollToBottom() {
    const hgNode = this.hgList.current; // DOM 更新后再跟随新消息，不打断用户的历史阅读。
    if (hgNode) { hgNode.scrollTop = hgNode.scrollHeight; this.hgScheduleScroll(); }
  }

  hgOnScroll = () => {
    this.hgScheduleScroll();
    const hgNode = this.hgList.current; // 边界判定使用真实滚动位置，不依赖尚未提交的 state。
    if (hgNode) this.hgPinToBottom = hgNode.scrollHeight - hgNode.scrollTop - hgNode.clientHeight < 80;
    if (!hgNode || this.hgRequest || this.props.loading || !this.props.messages.length) return;
    if (hgNode.scrollTop < 80 && this.props.messages[0].seq > 1) void this.hgLoad("older");
    else if (hgNode.scrollTop + hgNode.clientHeight >= hgNode.scrollHeight - 80 && this.props.messages.at(-1).seq < this.props.latestSeq) void this.hgLoad("newer");
  };

  /** 移动端顶端下拉触发旧页；普通滚动到顶/底也可触发，服务端单飞。 */
  hgTouchDown = (hgEvent) => {
    const hgNode = this.hgList.current; // 手势起点必须处于顶端或底端，防止正常阅读误翻页。
    this.hgTouchStart = hgNode.scrollTop <= 0 ? hgEvent.touches[0]?.clientY : null;
    this.hgTouchEndStart = hgNode.scrollTop + hgNode.clientHeight >= hgNode.scrollHeight - 2 ? hgEvent.touches[0]?.clientY : null;
  };
  hgTouchUp = (hgEvent) => {
    if (this.hgTouchStart !== null && hgEvent.changedTouches[0]?.clientY - this.hgTouchStart > 60) void this.hgLoad("older");
    else if (this.hgTouchEndStart !== null && hgEvent.changedTouches[0]?.clientY - this.hgTouchEndStart < -60 &&
      this.hgList.current.scrollTop + this.hgList.current.clientHeight >= this.hgList.current.scrollHeight - 80) void this.hgLoad("newer");
    this.hgTouchStart = null;
    this.hgTouchEndStart = null;
  };

  hgLoad = async (hgDirection) => {
    if (this.hgRequest || this.props.loading || this.hgExhausted[hgDirection] || !this.props.messages.length) return;
    if (hgDirection === "older" && this.props.messages[0].seq <= 1) return;
    if (hgDirection === "newer" && this.props.messages.at(-1).seq >= this.props.latestSeq) return;
    const hgNode = this.hgList.current; // 记录首个可见行的绝对序号，增删另一端仍定位原消息。
    let hgIndex = 0;
    while (hgIndex < this.props.messages.length - 1 && this.hgOffset(hgIndex + 1) <= hgNode.scrollTop) hgIndex++;
    this.hgAnchor = { seq: this.props.messages[hgIndex].seq, offset: this.hgOffset(hgIndex) - hgNode.scrollTop, direction: hgDirection };
    this.hgRequest = hgDirection;
    this.forceUpdate();
    try {
      const hgCount = await this.props.onHistory(hgDirection); // Go VM 负责 seq 连续性及最多 200 条内存裁剪。
      if (this.hgMounted && !hgCount) this.hgExhausted[hgDirection] = true;
    } catch (hgError) {
      if (this.hgMounted) this.props.onHistoryError(hgError);
    } finally {
      this.hgRequest = "";
      this.hgAnchor = null;
      if (this.hgMounted) this.forceUpdate();
    }
  };

  getSnapshotBeforeUpdate(hgPrevious) {
    const hgNode = this.hgList.current; // React 提交前保存实际像素快照，避免测量与异步翻页使视野跳动。
    if (!hgNode || hgPrevious.messages === this.props.messages) return null;
    return { follow: hgNode.scrollHeight - hgNode.scrollTop - hgNode.clientHeight < 80,
      previousLast: hgPrevious.messages.at(-1)?.seq, previousFirst: hgPrevious.messages[0]?.seq };
  }

  componentDidUpdate(hgPrevious, hgState, hgSnapshot) {
    if (hgPrevious.messages !== this.props.messages) {
      const hgValid = new Set(this.props.messages.map((hgMessage) => hgMessage.seq)); // 限制测量表随历史窗口移动增长。
      for (const hgSeq of this.hgHeights.keys()) if (!hgValid.has(hgSeq)) this.hgHeights.delete(hgSeq);
      const hgAnchor = this.hgAnchor; // 翻页时保留用户看到的第一条及其像素偏移。
      const hgIndex = hgAnchor && this.props.messages.findIndex((hgMessage) => hgMessage.seq === hgAnchor.seq);
      if (hgAnchor && hgIndex >= 0) this.hgList.current.scrollTop = Math.max(0, this.hgOffset(hgIndex) - hgAnchor.offset);
      else if (hgSnapshot?.follow && this.props.messages.at(-1)?.seq >= hgSnapshot.previousLast) this.hgScrollToBottom();
      this.hgScheduleScroll();
    }
    if (hgPrevious.latestSeq !== this.props.latestSeq) this.hgExhausted.newer = false;
  }

  /** 本机审核进度不作为已送达消息，也参与发送者头像排版。 */
  renderUpload() {
    const hgUpload = this.props.upload; // 当前会话最多一条，切换会话时父组件过滤。
    if (!hgUpload) return null;
    const hgStages = { hashing: "校验文件中", uploading: "上传中", verifying: "审核中", sending: "发送中",
      sent: "已提交，等待同步", uncertain: "发送结果未确认，请用原命令重试", failed: "附件处理失败，请检查输入区",
      rejected: "审核未通过", deleted: "附件已撤销" }; // 不将阶段冒充字节进度。
    return <li key={hgUpload.clientMsgId} className={`${styles.message} ${styles.mine}`}>
      <span className={styles.avatar} aria-label="我的头像">我</span>
      <div className={styles.messageBody}><div className={styles.bubble}>
        {hgUpload.url && hgUpload.messageType === "image" && <img className={styles.localMedia} src={hgUpload.url} alt="本机待发送图片" />}
        {hgUpload.url && hgUpload.messageType === "video" && <video className={styles.localMedia} src={hgUpload.url} preload="metadata" muted playsInline />}
        {!hgUpload.url && <span>📎 {hgUpload.fileName}</span>}
        <span role="status">{hgStages[hgUpload.state] || "准备中"}</span>
        {!(["failed", "uncertain", "rejected", "deleted", "sent"].includes(hgUpload.state)) && <progress aria-label="附件处理进行中" />}
      </div><small>我 · 本机待发送 · 未审核完成前对方不可见</small></div>
    </li>;
  }

  render() {
    const hgMessages = this.props.messages; // VM 至多 200 条；这里只挂载视口与前后 400px 缓冲区。
    const hgMinimum = Math.max(0, this.state.hgTop - 400); // 滚动时提前创建相邻行，降低闪烁。
    const hgMaximum = this.state.hgTop + this.state.hgViewport + 400; // 视口之后的末端。
    let hgStart = 0;
    while (hgStart < hgMessages.length && this.hgOffset(hgStart + 1) < hgMinimum) hgStart++;
    let hgEnd = hgStart;
    while (hgEnd < hgMessages.length && this.hgOffset(hgEnd) <= hgMaximum) hgEnd++;
    const hgTopHeight = this.hgOffset(hgStart); // 上方虚拟空白高度。
    const hgBottomHeight = this.hgOffset(hgMessages.length) - this.hgOffset(hgEnd); // 下方虚拟空白高度。
    return <ul className={styles.list} ref={this.hgList} aria-label="聊天消息" onScroll={this.hgOnScroll}
      onTouchStart={this.hgTouchDown} onTouchEnd={this.hgTouchUp}>
      {(this.hgRequest === "older" || this.props.loading) && <li className={styles.hint} role="status">正在加载消息…</li>}
      {hgMessages.length > 0 && <li className={styles.spacer} style={{ height: hgTopHeight }} aria-hidden="true" />}
      {hgMessages.slice(hgStart, hgEnd).map((hgMessage, hgSlot) => <HGIMMessageCell key={hgSlot} message={hgMessage}
        peerName={this.props.peerName} api={this.props.api} cache={this.hgCache} scrollRef={this.hgList}
        onDelete={this.props.onDelete} onHeight={this.hgMeasure} />)}
      {hgMessages.length > 0 && <li className={styles.spacer} style={{ height: hgBottomHeight }} aria-hidden="true" />}
      {!hgMessages.length && !this.props.upload && <li className={styles.empty}>当前窗口暂无消息</li>}
      {this.renderUpload()}
      {this.hgRequest === "newer" && <li className={styles.hint} role="status">正在加载更新消息…</li>}
    </ul>;
  }
}
