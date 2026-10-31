import React from "react";
import HGIMMediaPreview from "../hg_im_media/hg_im_media_preview.jsx";
import styles from "./hg_im_messages.module.css";

/** 图片和视频进入视口才读取已审核真实字节；离开视口立即释放 Blob。 */
class HGIMVisibleMedia extends React.Component {
  state = { hgVisible: false }; // false 表示尚未进入视口或已离开，不保留媒体 Blob。
  hgNode = React.createRef(); // 图片消息的可见性观察目标，卸载后不再观察。
  hgObserver = null; // 当前 IntersectionObserver；不支持时保留点击加载入口。

  componentDidMount() {
    if (!globalThis.IntersectionObserver) return;
    this.hgObserver = new IntersectionObserver(([hgEntry]) => {
      this.setState({ hgVisible: hgEntry.isIntersecting });
    });
    this.hgObserver.observe(this.hgNode.current);
  }

  componentWillUnmount() { this.hgObserver?.disconnect(); }

  render() {
    return <div ref={this.hgNode}>
      {(this.state.hgVisible || !globalThis.IntersectionObserver) && <HGIMMediaPreview api={this.props.api}
        message={this.props.message} autoLoad={this.state.hgVisible} onDelete={this.props.onDelete} />}
    </div>;
  }
}

/** 当前会话最多200条服务端消息，另有最多一条仅发送方可见的本机待发送气泡。 */
export default class HGIMMessageList extends React.Component {
  hgList = React.createRef(); // 原生滚动容器；用户离开底部时不强制打断阅读。
  componentDidMount() { this.hgList.current.scrollTop = this.hgList.current.scrollHeight; }
  getSnapshotBeforeUpdate(hgPrevious) {
    const hgNode = this.hgList.current; // 更新前的位置快照，用于判断是否跟随新消息。
    return (hgPrevious.messages !== this.props.messages || hgPrevious.upload?.clientMsgId !== this.props.upload?.clientMsgId)
      && hgNode.scrollHeight - hgNode.scrollTop - hgNode.clientHeight < 80;
  }
  componentDidUpdate(hgPrevious, hgState, hgFollow) {
    if (hgFollow && hgPrevious.messages.at(-1)?.seq <= this.props.messages.at(-1)?.seq) this.hgList.current.scrollTop = this.hgList.current.scrollHeight;
    else if (hgPrevious.messages[0]?.seq > this.props.messages[0]?.seq) this.hgList.current.scrollTop = 0;
  }

  renderMessage(hgMessage) {
    return <li key={hgMessage.messageId} className={`${styles.message} ${hgMessage.isSelf ? styles.mine : ""}`}>
      <div className={styles.bubble}>
        {hgMessage.messageType === "text" ? <span>{hgMessage.content.text}</span> : <div>
          {["image", "video"].includes(hgMessage.messageType)
            ? <HGIMVisibleMedia api={this.props.api} message={hgMessage} onDelete={this.props.onDelete} />
            : <HGIMMediaPreview api={this.props.api} message={hgMessage} onDelete={this.props.onDelete} />}
          {hgMessage.content.durationMs > 0 && <span> {Math.ceil(hgMessage.content.durationMs / 1000)}秒</span>}
        </div>}
      </div>
      <small>{hgMessage.isSelf ? "我 · 已发送" : hgMessage.senderId} · #{hgMessage.seq}{hgMessage.createdAt ? ` · ${new Date(hgMessage.createdAt).toLocaleString()}` : ""}</small>
    </li>;
  }

  /** 审核前仅本机预览；进度不冒充已送达或传输字节百分比。 */
  renderUpload() {
    const hgUpload = this.props.upload; // 切换会话时父组件只传当前会话的待发送项。
    if (!hgUpload) return null;
    const hgStages = { hashing: "校验文件中", uploading: "上传中", verifying: "审核中", sending: "发送中",
      sent: "已提交，等待同步", uncertain: "发送结果未确认，请用原命令重试", failed: "附件处理失败，请检查输入区",
      rejected: "审核未通过", deleted: "附件已撤销" }; // 只有补拉到消息后才算已展示。
    return <li key={hgUpload.clientMsgId} className={`${styles.message} ${styles.mine}`}>
      <div className={styles.bubble}>
        {hgUpload.url && hgUpload.messageType === "image" && <img className={styles.localMedia} src={hgUpload.url} alt="本机待发送图片" />}
        {hgUpload.url && hgUpload.messageType === "video" && <video className={styles.localMedia} src={hgUpload.url} preload="metadata" muted playsInline />}
        {!hgUpload.url && <span>📎 {hgUpload.fileName}</span>}
        <span role="status">{hgStages[hgUpload.state] || "准备中"}</span>
        {!(["failed", "uncertain", "rejected", "deleted", "sent"].includes(hgUpload.state)) && <progress aria-label="附件处理进行中" />}
      </div>
      <small>我 · 本机待发送 · 未审核完成前对方不可见</small>
    </li>;
  }

  render() {
    return <ul className={styles.list} ref={this.hgList} aria-label="聊天消息">
      {this.props.messages.length ? this.props.messages.map((hgMessage) => this.renderMessage(hgMessage)) : !this.props.upload && <li className={styles.empty}>当前窗口暂无消息</li>}
      {this.renderUpload()}
    </ul>;
  }
}
