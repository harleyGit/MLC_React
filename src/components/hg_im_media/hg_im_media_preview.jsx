import React from "react";
import { hgIMReadMedia } from "../../manager_antd/net_handle/hg_im_media";
import styles from "./hg_im_media.module.css";

/** 单附件查看器：api/message/onClose 均由聊天页提供，无默认值；下载一律经 Go 授权。 */
export default class HGIMMediaPreview extends React.Component {
  state = {
    hgURL: "", // 已完整下载的本地 Blob URL，关闭时立即撤销。
    hgProgress: 0, // 当前下载百分比，0 表示未开始。
    hgBusy: false, // 一次仅一个有界分段下载。
    hgError: "", // 下载失败或权限失效提示。
  };
  hgController = new AbortController(); // 关闭查看器时中断全部媒体分段。
  hgURL = ""; // 与渲染状态配对的资源句柄，用于卸载释放。
  hgMounted = false; // 阻止已关闭查看器接收异步结果。

  componentDidMount() { this.hgMounted = true; }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgController.abort();
    if (this.hgURL) URL.revokeObjectURL(this.hgURL);
  }

  hgLoad = async () => {
    if (this.state.hgBusy) return;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgBlob = await hgIMReadMedia(this.props.api, this.props.message.content.mediaId, this.props.message.messageType,
        AbortSignal.any([this.hgController.signal, this.props.api.hgOptions.signal]),
        (hgProgress) => this.hgMounted && this.setState({ hgProgress }));
      if (!this.hgMounted) return;
      this.hgURL = URL.createObjectURL(hgBlob);
      this.setState({ hgURL: this.hgURL, hgProgress: 100 });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError?.name === "AbortError" ? "下载已取消" : "读取失败：请检查权限、网络与媒体审核状态" });
    } finally { if (this.hgMounted) this.setState({ hgBusy: false }); }
  };

  renderMedia() {
    const hgKind = this.props.message.messageType; // 仅服务端批准的 image/video/audio/file。
    const hgURL = this.state.hgURL; // 本地 URL 不向外部服务发送。
    if (hgKind === "image") return <img src={hgURL} alt="已审核聊天图片" className={styles.media} />;
    if (hgKind === "video") return <video src={hgURL} controls playsInline className={styles.media} />;
    if (hgKind === "audio") return <audio src={hgURL} controls />;
    return <a href={hgURL} download={`附件-${this.props.message.content.mediaId}`}>保存文件</a>;
  }

  render() {
    return <section className={styles.panel} aria-label="私有附件查看器">
      <header><strong>私有附件</strong><button type="button" onClick={this.props.onClose}>关闭并释放内容</button></header>
      {this.state.hgURL ? this.renderMedia() : <button type="button" disabled={this.state.hgBusy} onClick={this.hgLoad}>
        {this.state.hgBusy ? `鉴权下载 ${this.state.hgProgress}%` : "读取附件（最多128MiB）"}
      </button>}
      {this.state.hgError && <p role="alert">{this.state.hgError}</p>}
    </section>;
  }
}
