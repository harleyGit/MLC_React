import React from "react";
import styles from "./hg_im_messages.module.css";

/** 当前会话最多200条消息窗口；messages/onPreview/onDelete 由首页注入，无默认值。 */
export default class HGIMMessageList extends React.Component {
  hgList = React.createRef(); // 原生滚动容器；用户离开底部时不强制打断阅读。
  componentDidMount() { this.hgList.current.scrollTop = this.hgList.current.scrollHeight; }
  getSnapshotBeforeUpdate(hgPrevious) {
    const hgNode = this.hgList.current; // 更新前的位置快照，用于判断是否跟随新消息。
    return hgPrevious.messages !== this.props.messages && hgNode.scrollHeight - hgNode.scrollTop - hgNode.clientHeight < 80;
  }
  componentDidUpdate(hgPrevious, hgState, hgFollow) {
    if (hgFollow && hgPrevious.messages.at(-1)?.seq <= this.props.messages.at(-1)?.seq) this.hgList.current.scrollTop = this.hgList.current.scrollHeight;
    else if (hgPrevious.messages[0]?.seq > this.props.messages[0]?.seq) this.hgList.current.scrollTop = 0;
  }

  renderMessage(hgMessage) {
    const hgLabels = { image: "图片", video: "视频", audio: "语音", file: "文件" }; // 服务端支持的媒体类型。
    return <li key={hgMessage.messageId} className={`${styles.message} ${hgMessage.isSelf ? styles.mine : ""}`}>
      <div className={styles.bubble}>
        {hgMessage.messageType === "text" ? <span>{hgMessage.content.text}</span> : <div>
          <button type="button" onClick={() => this.props.onPreview(hgMessage)}>读取{hgLabels[hgMessage.messageType] || "附件"}</button>
          {hgMessage.content.durationMs > 0 && <span> {Math.ceil(hgMessage.content.durationMs / 1000)}秒</span>}
          {hgMessage.isSelf && <button type="button" onClick={() => void this.props.onDelete(hgMessage)}>撤销附件</button>}
        </div>}
      </div>
      <small>{hgMessage.isSelf ? "我 · 已发送" : hgMessage.senderId} · #{hgMessage.seq}{hgMessage.createdAt ? ` · ${new Date(hgMessage.createdAt).toLocaleString()}` : ""}</small>
    </li>;
  }

  render() {
    return <ul className={styles.list} ref={this.hgList} aria-label="聊天消息">
      {this.props.messages.length ? this.props.messages.map((hgMessage) => this.renderMessage(hgMessage)) : <li className={styles.empty}>当前窗口暂无消息</li>}
    </ul>;
  }
}
