import React from "react";
import { hgIMReadMedia } from "../../manager_antd/net_handle/hg_im_media";
import styles from "./hg_im_media.module.css";

/** 仅当前聊天列表会话内存复用已鉴权字节；LRU 最多 12 件/320MiB、五分钟，离开会话即清空。 */
export class HGIMMediaCache {
  hgEntries = new Map(); // mediaId -> {blob, expires}；不写磁盘、不跨账号共享。
  hgBytes = 0; // 当前缓存的 Blob 字节总数，不包含正在显示或下载的额外临时内存。
  hgLimit = 320 * 1024 * 1024; // 允许保留一段 300MiB 视频；超过上限不缓存。

  hgGet(hgID) {
    const hgEntry = this.hgEntries.get(hgID); // 过期或撤销后必须重新向 Go 鉴权。
    if (!hgEntry) return null;
    if (hgEntry.expires <= Date.now()) { this.hgDelete(hgID); return null; }
    this.hgEntries.delete(hgID);
    this.hgEntries.set(hgID, hgEntry);
    return hgEntry.blob;
  }

  hgSet(hgID, hgBlob) {
    this.hgDelete(hgID);
    if (hgBlob.size > this.hgLimit) return;
    this.hgEntries.set(hgID, { blob: hgBlob, expires: Date.now() + 5 * 60 * 1000 });
    this.hgBytes += hgBlob.size;
    while (this.hgBytes > this.hgLimit || this.hgEntries.size > 12) this.hgDelete(this.hgEntries.keys().next().value);
  }

  hgDelete(hgID) {
    const hgEntry = this.hgEntries.get(hgID); // 仅移除缓存；已打开的 Blob URL 由查看器卸载/撤销释放。
    if (hgEntry) this.hgBytes -= hgEntry.blob.size;
    this.hgEntries.delete(hgID);
  }

  hgClear() { this.hgEntries.clear(); this.hgBytes = 0; }
}

/** 单条已发送附件：api/message/onDelete 由列表提供；仅图片/视频进入视口后自动读取。 */
export default class HGIMMediaPreview extends React.Component {
  state = {
    hgURL: "", // 已完成鉴权下载的本机 Blob URL，卸载/撤销时释放。
    hgProgress: 0, // 已确认下载字节百分比，未开始为0。
    hgBusy: false, // 单附件读取单飞，避免重复占用至多300MiB内存。
    hgError: "", // 权限或网络失败提示，空字符串表示无错误。
    hgExpanded: false, // 默认在气泡内；true 时展示同一 Blob 的放大弹窗。
    hgMenu: false, // 默认隐藏；长按、右键或更多按钮打开操作菜单。
  };
  hgController = new AbortController(); // 卸载/撤销时取消未完成的分段读取。
  hgURL = ""; // 和 state 中的 URL 配对，仅组件持有撤销权限。
  hgMIME = ""; // 下载后的 MIME，用于安全生成下载文件扩展名。
  hgMounted = false; // 卸载后禁止异步写回。
  hgLoading = false; // 在 React setState 提交前也阻止重复读取。
  hgDeleting = false; // 服务端撤销单飞，长按菜单连点不得重复请求。
  hgPressTimer = null; // 指针持续按住550ms才打开菜单，松开即取消。
  hgDialog = React.createRef(); // 弹窗打开后聚焦，方便键盘关闭。

  componentDidMount() {
    this.hgMounted = true;
    if (this.props.autoLoad) void this.hgLoad();
  }

  componentDidUpdate(hgPrevious, hgState) {
    if (this.props.autoLoad && !hgPrevious.autoLoad) void this.hgLoad();
    if (this.state.hgExpanded && !hgState.hgExpanded) this.hgDialog.current?.focus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    clearTimeout(this.hgPressTimer);
    this.hgController.abort();
    if (this.hgURL) URL.revokeObjectURL(this.hgURL);
  }

  /** 返回本机 Blob URL；读取失败不发起下载，不绕过 Go 的逐段鉴权。 */
  hgLoad = async () => {
    if (this.hgURL) return this.hgURL;
    if (this.hgLoading) return "";
    this.hgLoading = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgCached = this.props.cache?.hgGet(this.props.message.content.mediaId); // 命中不延长原鉴权有效期。
      const hgBlob = hgCached || await hgIMReadMedia(this.props.api, this.props.message.content.mediaId, this.props.message.messageType,
        AbortSignal.any([this.hgController.signal, this.props.api.hgOptions.signal]),
        (hgProgress) => this.hgMounted && this.setState({ hgProgress }));
      if (!this.hgMounted || this.hgController.signal.aborted) return "";
      if (!hgCached) this.props.cache?.hgSet(this.props.message.content.mediaId, hgBlob);
      this.hgMIME = hgBlob.type;
      this.hgURL = URL.createObjectURL(hgBlob);
      this.setState({ hgURL: this.hgURL, hgProgress: 100 });
      return this.hgURL;
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError?.name === "AbortError" ? "下载已取消" : "读取失败：请检查权限、网络与媒体审核状态" });
      return "";
    } finally {
      this.hgLoading = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 保存本机已授权 Blob，文件名不使用服务端或消息正文中的不可信路径。 */
  hgDownload = async () => {
    const hgURL = await this.hgLoad(); // 文件不自动读取，点击下载时才申请权限。
    if (!hgURL || !this.hgMounted) return;
    const hgExt = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4",
      "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/aac": ".aac",
      "application/pdf": ".pdf", "application/zip": ".zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx" })[this.hgMIME] || ""; // 仅后端允许的 MIME 扩展名。
    const hgLink = document.createElement("a"); // 临时链接只指向已授权本地 Blob。
    hgLink.href = hgURL;
    hgLink.download = `附件-${this.props.message.content.mediaId}${hgExt}`;
    hgLink.click();
    this.setState({ hgMenu: false });
  };

  hgDelete = async () => {
    if (this.hgDeleting) return;
    this.hgDeleting = true;
    try {
      if (await this.props.onDelete(this.props.message)) {
        this.props.cache?.hgDelete(this.props.message.content.mediaId);
        this.hgController.abort();
        if (this.hgURL) URL.revokeObjectURL(this.hgURL);
        this.hgURL = "";
        if (this.hgMounted) this.setState({ hgURL: "", hgExpanded: false, hgMenu: false, hgError: "附件已撤销" });
      }
    } finally {
      this.hgDeleting = false;
    }
  };

  hgStartPress = (hgEvent) => {
    if (hgEvent.button !== 0) return;
    clearTimeout(this.hgPressTimer);
    this.hgPressTimer = setTimeout(() => this.setState({ hgMenu: true }), 550);
  };

  hgStopPress = () => { clearTimeout(this.hgPressTimer); };

  hgContextMenu = (hgEvent) => { hgEvent.preventDefault(); this.hgStopPress(); this.setState({ hgMenu: true }); };

  hgOpen = () => {
    if (this.state.hgMenu) return;
    if (this.props.message.messageType === "file") { void this.hgDownload(); return; }
    if (this.state.hgURL) this.setState({ hgExpanded: true });
    else void this.hgLoad().then((hgURL) => { if (hgURL && this.hgMounted) this.setState({ hgExpanded: true }); });
  };

  /** 气泡复用同一媒体字节；仅弹窗中的视频/音频显示播放控件。 */
  renderMedia(hgExpanded = false) {
    const hgKind = this.props.message.messageType; // 后端批准的 image/video/audio/file。
    if (hgKind === "image") return <img src={this.state.hgURL} alt="已审核聊天图片" className={hgExpanded ? styles.largeMedia : styles.media} />;
    if (hgKind === "video") return <video src={this.state.hgURL} controls={hgExpanded} playsInline preload="metadata"
      onLoadedMetadata={(hgEvent) => { if (!hgExpanded && hgEvent.currentTarget.duration > 0.2) hgEvent.currentTarget.currentTime = 0.1; }}
      className={hgExpanded ? styles.largeMedia : styles.media} />;
    if (hgKind === "audio") return hgExpanded ? <audio src={this.state.hgURL} controls autoPlay /> : <span>🔊 点击播放语音</span>;
    return <span>📄 附件 · 点击下载</span>;
  }

  render() {
    const hgKind = this.props.message.messageType; // 视频/图片气泡直接展示，文件需主动下载。
    return <section className={styles.panel} aria-label="私有附件查看器">
      <div className={styles.bubble} onPointerDown={this.hgStartPress} onPointerUp={this.hgStopPress}
        onPointerLeave={this.hgStopPress} onPointerCancel={this.hgStopPress} onContextMenu={this.hgContextMenu}>
        {this.state.hgURL && hgKind !== "file"
          ? <button type="button" className={styles.mediaButton} onClick={this.hgOpen} aria-label={`放大${hgKind === "image" ? "图片" : hgKind === "video" ? "视频" : "音频"}`}>
            {this.renderMedia()}{hgKind === "video" && <span className={styles.playIcon}>▶</span>}
          </button>
          : <button type="button" disabled={this.state.hgBusy} onClick={this.hgOpen}>
            {this.state.hgBusy ? `鉴权加载 ${this.state.hgProgress}%` : hgKind === "file" ? "📄 点击下载文件" : `加载${hgKind === "video" ? "视频" : "图片"}`}
          </button>}
        <button type="button" className={styles.more} onClick={() => this.setState((hgState) => ({ hgMenu: !hgState.hgMenu }))} aria-label="附件操作">⋯</button>
      </div>
      {this.state.hgBusy && <div role="status">{this.state.hgProgress ? `加载 ${this.state.hgProgress}%` : "鉴权加载中…"}<progress max="100" value={this.state.hgProgress || undefined} /></div>}
      {this.state.hgError && <p role="alert">{this.state.hgError}</p>}
      {this.state.hgMenu && <div className={styles.menu} role="group" aria-label="附件操作菜单">
        <button type="button" onClick={() => void this.hgDownload()}>下载</button>
        {this.props.message.isSelf && <button type="button" onClick={() => void this.hgDelete()}>撤销附件</button>}
        <button type="button" onClick={() => this.setState({ hgMenu: false })}>关闭菜单</button>
      </div>}
      {this.state.hgExpanded && <div className={styles.overlay} onMouseDown={(hgEvent) => { if (hgEvent.target === hgEvent.currentTarget) this.setState({ hgExpanded: false }); }}>
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="放大查看附件" tabIndex={-1} ref={this.hgDialog}
          onKeyDown={(hgEvent) => { if (hgEvent.key === "Escape") this.setState({ hgExpanded: false }); }}>
          <button type="button" onClick={() => this.setState({ hgExpanded: false })}>关闭</button>
          {this.renderMedia(true)}
        </div>
      </div>}
    </section>;
  }
}
