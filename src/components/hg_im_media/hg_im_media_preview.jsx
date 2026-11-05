import React from "react";
import { hgIMReadMedia } from "../../manager_antd/net_handle/hg_im_media";
import {
  HGBounceBars,
  HGRingSpinner,
} from "../hg_loading_animations/hg_loading_animations.jsx";
import HGIMFileCard from "./hg_im_file_card.jsx";
import styles from "./hg_im_media.module.css";

/** 单条已发送附件：api/message/onDelete 由列表提供；仅图片/视频进入视口后自动读取。 */
export default class HGIMMediaPreview extends React.Component {
  state = {
    hgURL: "", // 已完成鉴权下载的本机 Blob URL，卸载/撤销时释放。
    hgProgress: 0, // 已确认下载字节百分比，未开始为0。
    hgBusy: false, // 单附件读取单飞，避免重复占用至多300MiB内存。
    hgError: "", // 权限或网络失败提示，空字符串表示无错误。
    hgExpanded: false, // 默认在气泡内；true 时展示同一 Blob 的放大弹窗。
    hgMenu: false, // 默认隐藏；右键或长按打开浮动菜单，点击空白处关闭。
    hgMenuPos: null, // 菜单锚点：触发时的鼠标/手指视口坐标，固定定位展示。
    hgMeta: null, // 文件卡片元数据：审核状态返回的名称/大小/MIME；协议未提供时留空。
  };
  hgController = new AbortController(); // 卸载/撤销时取消未完成的分段读取。
  hgURL = ""; // 和 state 中的 URL 配对，仅组件持有撤销权限。
  hgMIME = ""; // 下载后的 MIME，用于安全生成下载文件扩展名。
  hgMounted = false; // 卸载后禁止异步写回。
  hgLoading = false; // 在 React setState 提交前也阻止重复读取。
  hgDeleting = false; // 服务端撤销单飞，长按菜单连点不得重复请求。
  hgPressTimer = null; // 指针持续按住550ms才打开菜单，松开即取消。
  hgPressPos = { x: 0, y: 0 }; // 长按起点的视口坐标，菜单弹在按下位置。
  hgDialog = React.createRef(); // 弹窗打开后聚焦，方便键盘关闭。
  hgRoot = React.createRef(); // 菜单外点击判定范围。

  constructor(hgProps) {
    super(hgProps);
    // 虚拟槽重新创建时直接展示当前会话缓存；不先闪回“加载”再异步创建 Blob URL。
    if (!["image", "video"].includes(hgProps.message.messageType)) return;
    const hgCached = hgProps.cache?.hgGet(hgProps.message.content.mediaId); // 缓存仍按原 TTL 校验，不发起未授权请求。
    if (!hgCached) return;
    this.hgMIME = hgCached.type;
    this.hgURL = URL.createObjectURL(hgCached);
    this.state = { ...this.state, hgURL: this.hgURL, hgProgress: 100 };
  }

  componentDidMount() {
    this.hgMounted = true;
    if (this.props.autoLoad) void this.hgLoad();
    window.addEventListener("hg:im-ctx-menu", this.hgMenuBroadcast); // 打开本菜单时关闭其他气泡的菜单。
    document.addEventListener("mousedown", this.hgDocPress); // 点击气泡外空白处关闭菜单。
    if (this.props.message.messageType === "file" && !this.hgURL)
      void this.hgLoadMeta(); // 文件卡片尽量展示名称与大小，失败不阻塞下载。
  }

  componentDidUpdate(hgPrevious, hgState) {
    if (this.props.autoLoad && !hgPrevious.autoLoad) void this.hgLoad();
    if (this.state.hgExpanded && !hgState.hgExpanded)
      this.hgDialog.current?.focus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    clearTimeout(this.hgPressTimer);
    this.hgController.abort();
    if (this.hgURL) URL.revokeObjectURL(this.hgURL);
    window.removeEventListener("hg:im-ctx-menu", this.hgMenuBroadcast);
    document.removeEventListener("mousedown", this.hgDocPress);
  }

  /** 文件卡片元数据尽力获取；审核状态缺少字段时保持占位，不冒充真实名称或大小。 */
  hgLoadMeta = async () => {
    try {
      const hgStatus = await this.props.api.hgMediaStatus(
        this.props.message.content.mediaId
      );
      if (!this.hgMounted || !hgStatus) return;
      const hgMeta = {};
      if (typeof hgStatus.fileName === "string" && hgStatus.fileName)
        hgMeta.name = hgStatus.fileName;
      else if (typeof hgStatus.name === "string" && hgStatus.name)
        hgMeta.name = hgStatus.name;
      if (Number.isFinite(hgStatus.size)) hgMeta.size = hgStatus.size;
      if (typeof hgStatus.mime === "string" && hgStatus.mime)
        hgMeta.mime = hgStatus.mime;
      if (hgMeta.name || hgMeta.size != null || hgMeta.mime)
        this.setState({ hgMeta });
    } catch {
      /* 元数据失败仅缺名称/大小，卡片仍可点击下载 */
    }
  };

  /** 其他气泡打开菜单时关闭自身；事件 detail 为发起实例。 */
  hgMenuBroadcast = (hgEvent) => {
    if (hgEvent.detail !== this && this.state.hgMenu)
      this.setState({ hgMenu: false });
  };

  /** 菜单与气泡以外的空白处按下即关闭；菜单项自身的点击不受影响。 */
  hgDocPress = (hgEvent) => {
    if (!this.state.hgMenu) return;
    if (this.hgRoot.current?.contains(hgEvent.target)) return;
    this.setState({ hgMenu: false });
  };

  /** 右键/长按统一入口：菜单弹在触发点的视口坐标，先广播关闭其他实例。 */
  hgOpenMenu = (hgX, hgY) => {
    window.dispatchEvent(new CustomEvent("hg:im-ctx-menu", { detail: this }));
    // 按预估菜单尺寸夹在视口内，避免贴边溢出。
    const hgLeft = Math.max(
      4,
      Math.min(hgX, (globalThis.innerWidth || 800) - 150)
    );
    const hgTop = Math.max(
      4,
      Math.min(hgY, (globalThis.innerHeight || 600) - 130)
    );
    this.setState({ hgMenu: true, hgMenuPos: { x: hgLeft, y: hgTop } });
  };

  /** 自动预览短期避开已拒绝附件；用户主动点击仍可重新向 Go 鉴权。 */
  hgLoad = async (hgManual = false) => {
    if (this.hgURL) return this.hgURL;
    if (this.hgLoading) return "";
    const hgMediaID = this.props.message.content.mediaId; // 当前消息的媒体 ID，仅在本会话缓存拒绝结果。
    if (!hgManual && this.props.cache?.hgIsDenied(hgMediaID)) {
      if (this.hgMounted)
        this.setState({
          hgError: "无权读取此附件：请确认审核状态、撤销状态及当前会话权限",
        });
      return "";
    }
    this.hgLoading = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgCached = this.props.cache?.hgGet(
        this.props.message.content.mediaId
      ); // 命中不延长原鉴权有效期。
      const hgBlob =
        hgCached ||
        (await hgIMReadMedia(
          this.props.api,
          this.props.message.content.mediaId,
          this.props.message.messageType,
          AbortSignal.any([
            this.hgController.signal,
            this.props.api.hgOptions.signal,
          ]),
          (hgProgress) => this.hgMounted && this.setState({ hgProgress })
        ));
      if (!this.hgMounted || this.hgController.signal.aborted) return "";
      if (!hgCached)
        this.props.cache?.hgSet(this.props.message.content.mediaId, hgBlob);
      this.hgMIME = hgBlob.type;
      this.hgURL = URL.createObjectURL(hgBlob);
      // 下载完成后回填文件卡片的大小与类型，接收方展示真实字节数。
      this.setState((hgState) => ({
        hgURL: this.hgURL,
        hgProgress: 100,
        hgMeta: {
          ...(hgState.hgMeta || {}),
          size: hgBlob.size,
          mime: hgBlob.type,
        },
      }));
      return this.hgURL;
    } catch (hgError) {
      if (hgError?.status === 403) this.props.cache?.hgDeny(hgMediaID); // 虚拟行重建不重复请求已拒绝附件。
      if (this.hgMounted)
        this.setState({
          hgError:
            hgError?.name === "AbortError"
              ? "下载已取消"
              : hgError?.status === 403
              ? "无权读取此附件：请确认审核状态、撤销状态及当前会话权限"
              : "读取失败：请检查网络与媒体审核状态",
        });
      return "";
    } finally {
      this.hgLoading = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 保存本机已授权 Blob，文件名不使用服务端或消息正文中的不可信路径。 */
  hgDownload = async () => {
    const hgURL = await this.hgLoad(true); // 用户点击可重试；仍逐次由 Go 鉴权。
    if (!hgURL || !this.hgMounted) return;
    const hgExt =
      {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/mp4": ".m4a",
        "audio/aac": ".aac",
        "application/pdf": ".pdf",
        "application/zip": ".zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          ".docx",
      }[this.hgMIME] || ""; // 仅后端允许的 MIME 扩展名。
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
        if (this.hgMounted)
          this.setState({
            hgURL: "",
            hgExpanded: false,
            hgMenu: false,
            hgError: "附件已撤销",
          });
      }
    } finally {
      this.hgDeleting = false;
    }
  };

  hgStartPress = (hgEvent) => {
    if (hgEvent.button !== 0) return;
    this.hgPressPos = { x: hgEvent.clientX, y: hgEvent.clientY }; // 长按菜单弹在按下位置。
    clearTimeout(this.hgPressTimer);
    this.hgPressTimer = setTimeout(
      () => this.hgOpenMenu(this.hgPressPos.x, this.hgPressPos.y),
      550
    );
  };

  hgStopPress = () => {
    clearTimeout(this.hgPressTimer);
  };

  hgContextMenu = (hgEvent) => {
    hgEvent.preventDefault();
    this.hgStopPress();
    this.hgOpenMenu(hgEvent.clientX, hgEvent.clientY);
  };

  hgOpen = () => {
    if (this.state.hgMenu) return; // 菜单刚打开时的同一点击不触发媒体操作。
    if (this.props.message.messageType === "file") {
      void this.hgDownload();
      return;
    }
    if (this.state.hgURL) this.setState({ hgExpanded: true });
    else
      void this.hgLoad(true).then((hgURL) => {
        if (hgURL && this.hgMounted) this.setState({ hgExpanded: true });
      });
  };

  /** 接收进度指示：环形加载动画 + 百分比，替代原生 progress。 */
  hgSpinner() {
    return <HGRingSpinner style={{ width: 20, height: 20, borderWidth: 2 }} />;
  }

  /** 气泡蒙层：半透明遮罩盖住媒体/卡片，居中展示加载或接收进度。 */
  hgMask(hgText) {
    return (
      <div className={styles.mediaMask} role="status">
        {this.hgSpinner()}
        <span>{hgText}</span>
      </div>
    );
  }

  /** 文件气泡：微信式卡片（图标/名称/大小），下载期间覆盖接收进度蒙层。 */
  hgFileBody() {
    const hgMeta = this.state.hgMeta || {};
    const hgName =
      hgMeta.name ||
      `附件-${String(this.props.message.content.mediaId).slice(0, 8)}`;
    return (
      <div className={styles.mediaWrap}>
        <HGIMFileCard name={hgName} size={hgMeta.size} mime={hgMeta.mime} />
        {this.state.hgBusy &&
          this.hgMask(`接收中 ${this.state.hgProgress}%`)}
      </div>
    );
  }

  /** 气泡内不放可见按钮：图片/视频点击放大，文件点击下载，其余操作在右键菜单。 */
  hgBody() {
    const hgKind = this.props.message.messageType; // 后端批准的 image/video/audio/file。
    if (hgKind === "file") return this.hgFileBody();
    if (hgKind === "audio")
      return (
        <span className={styles.mediaWrap}>
          <span className={styles.audioHint}>
            <HGBounceBars size="small" />
            <span>{this.state.hgURL ? "点击播放语音" : "语音"}</span>
          </span>
          {this.state.hgBusy &&
            this.hgMask(`接收中 ${this.state.hgProgress}%`)}
        </span>
      );
    return (
      <div className={styles.mediaBox}>
        {this.state.hgURL && hgKind === "image" && (
          <img
            src={this.state.hgURL}
            alt="已审核聊天图片"
            className={styles.media}
          />
        )}
        {this.state.hgURL && hgKind === "video" && (
          <video
            src={this.state.hgURL}
            playsInline
            preload="metadata"
            className={styles.media}
            onLoadedMetadata={(hgEvent) => {
              if (hgEvent.currentTarget.duration > 0.2)
                hgEvent.currentTarget.currentTime = 0.1;
            }}
          />
        )}
        {this.state.hgURL && hgKind === "video" && (
          <span className={styles.playIcon}>▶</span>
        )}
        {this.state.hgBusy &&
          this.hgMask(
            this.state.hgProgress
              ? `接收中 ${this.state.hgProgress}%`
              : "准备接收…"
          )}
      </div>
    );
  }

  /** 放大弹窗内展示同一 Blob；仅此处提供播放控件。 */
  hgExpandedBody() {
    const hgKind = this.props.message.messageType;
    if (hgKind === "image")
      return (
        <img
          src={this.state.hgURL}
          alt="已审核聊天图片"
          className={styles.largeMedia}
        />
      );
    if (hgKind === "video")
      return (
        <video
          src={this.state.hgURL}
          controls
          playsInline
          className={styles.largeMedia}
        />
      );
    return <audio src={this.state.hgURL} controls autoPlay />;
  }

  render() {
    return (
      <section
        className={styles.panel}
        aria-label="私有附件查看器"
        ref={this.hgRoot}
      >
        <div
          className={styles.bubble}
          onClick={this.hgOpen}
          onPointerDown={this.hgStartPress}
          onPointerUp={this.hgStopPress}
          onPointerLeave={this.hgStopPress}
          onPointerCancel={this.hgStopPress}
          onContextMenu={this.hgContextMenu}
        >
          {this.hgBody()}
        </div>
        {this.state.hgError && (
          <p className={styles.error} role="alert">
            {this.state.hgError}
          </p>
        )}
        {this.state.hgMenu && (
          <div
            className={styles.ctxMenu}
            role="group"
            aria-label="附件操作菜单"
            style={{
              left: this.state.hgMenuPos?.x,
              top: this.state.hgMenuPos?.y,
            }}
          >
            <button type="button" onClick={() => void this.hgDownload()}>
              下载
            </button>
            {this.props.message.isSelf && (
              <button type="button" onClick={() => void this.hgDelete()}>
                撤销附件
              </button>
            )}
          </div>
        )}
        {this.state.hgExpanded && (
          <div
            className={styles.overlay}
            onMouseDown={(hgEvent) => {
              if (hgEvent.target === hgEvent.currentTarget)
                this.setState({ hgExpanded: false });
            }}
          >
            <div
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-label="放大查看附件"
              tabIndex={-1}
              ref={this.hgDialog}
              onKeyDown={(hgEvent) => {
                if (hgEvent.key === "Escape")
                  this.setState({ hgExpanded: false });
              }}
            >
              <button
                type="button"
                onClick={() => this.setState({ hgExpanded: false })}
              >
                关闭
              </button>
              {this.hgExpandedBody()}
            </div>
          </div>
        )}
      </section>
    );
  }
}
