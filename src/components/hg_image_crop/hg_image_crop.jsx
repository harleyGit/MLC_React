import React from "react";
import styles from "./hg_image_crop.module.css";

const HG_CROP_SHAPE_OPTIONS = [
  { value: "rect", label: "矩形" },
  { value: "round", label: "圆形" },
  { value: "ellipse", label: "椭圆" },
];

let hgImageCropUid = 0;

/** 仅保留组件支持的裁切形状；无有效配置时回退为矩形。 */
function hgNormalizeCropShapes(hgShapes) {
  const hgSupportedShapes = new Set(
    HG_CROP_SHAPE_OPTIONS.map((hgOption) => hgOption.value)
  ); // 可用于 Canvas 和预览遮罩的形状集合。
  const hgNormalizedShapes = Array.isArray(hgShapes)
    ? [...new Set(hgShapes)].filter((hgShape) => hgSupportedShapes.has(hgShape))
    : []; // 去重后的调用方配置；空数组表示配置无效。
  return hgNormalizedShapes.length ? hgNormalizedShapes : ["rect"];
}

/** 非矩形裁切统一输出 PNG，并同步文件扩展名与 MIME 类型。 */
function hgReplaceFileExtension(hgName, hgExtension) {
  const hgBaseName = hgName.replace(/\.[^./\\]+$/, "") || "cropped-image"; // 无扩展名时保留完整原名。
  return `${hgBaseName}.${hgExtension}`;
}

/** 将图片文件读取为可供 Canvas 绘制的 HTMLImageElement。 */
function hgLoadImage(hgURL) {
  return new Promise((hgResolve, hgReject) => {
    const hgImage = new Image(); // 仅加载本地 blob URL，不向外部发送资源请求。
    hgImage.onload = () => hgResolve(hgImage);
    hgImage.onerror = () => hgReject(new Error("图片读取失败，请重新选择"));
    hgImage.src = hgURL;
  });
}

/** 将 Canvas 异步编码为 Blob，浏览器编码失败时返回明确错误。 */
function hgCanvasToBlob(hgCanvas, hgType) {
  return new Promise((hgResolve, hgReject) => {
    hgCanvas.toBlob(
      (hgBlob) =>
        hgBlob ? hgResolve(hgBlob) : hgReject(new Error("裁切图片生成失败")),
      hgType,
      0.92
    );
  });
}

/**
 * 上传前图片裁切包装器。
 * 通过克隆唯一子上传组件注入 beforeUpload，确认后返回裁切生成的新 File。
 */
export default class HGImageCrop extends React.Component {
  static defaultProps = {
    aspect: 1, // 默认裁切为 1:1 正方形。
    cropShape: "rect", // 默认使用矩形裁切区域。
    cropShapes: ["rect", "round", "ellipse"], // 默认允许在矩形、圆形和椭圆形间切换。
    outputWidth: 800, // 默认输出宽度 800 像素，高度由 aspect 推导。
    rotationSlider: false, // 默认不显示旋转滑杆；传 true 开启 -180° 至 180° 调节。
    title: "裁切图片", // 裁切弹窗默认标题。
  };

  state = {
    hgOpen: false, // 是否显示裁切弹窗；默认关闭。
    hgSourceURL: "", // 待裁切图片的 blob 地址；空字符串表示无待处理图片。
    hgFile: null, // 原始图片 File；null 表示当前没有裁切任务。
    hgZoom: 0, // 相对完整显示尺寸的缩放档位，取值 -1 至 1；0 位于滑杆中央并表示 100%。
    hgRotation: 0, // 顺时针旋转角度，取值 -180 至 180，默认为 0。
    hgOffsetX: 0, // 图片相对裁切区域中心的水平偏移百分比，取值 -100 至 100。
    hgOffsetY: 0, // 图片相对裁切区域中心的垂直偏移百分比，取值 -100 至 100。
    hgCropShape: "rect", // 当前裁切形状；打开弹窗时根据 cropShape 与 cropShapes 初始化。
    hgBusy: false, // 正在生成裁切文件时为 true，阻止重复确认。
    hgError: "", // 最近一次裁切错误；空字符串表示无错误。
  };

  hgPendingResolve = null; // 当前 beforeUpload Promise 的完成函数；无裁切任务时为 null。
  hgDragStart = null; // 当前拖动起点及初始偏移；未拖动或拖动结束时为 null。
  hgShapeGroupName = `hg-crop-shape-${hgImageCropUid++}`; // 实例唯一单选组名，避免页面存在多个裁切器时互相取消选择。

  componentWillUnmount() {
    this.hgReleaseSource();
    this.hgPendingResolve?.(false);
    this.hgPendingResolve = null;
  }

  /** 释放当前源图临时地址，避免反复选择图片造成内存占用。 */
  hgReleaseSource = () => {
    if (this.state.hgSourceURL) URL.revokeObjectURL(this.state.hgSourceURL);
  };

  /** 接管图片上传；非图片继续执行子组件原有 beforeUpload。 */
  hgBeforeUpload = async (hgFile, hgFileList) => {
    const hgChild = React.Children.only(this.props.children); // 包装器只接受一个上传组件。
    if (!hgFile.type.startsWith("image/")) {
      return hgChild.props.beforeUpload?.(hgFile, hgFileList) ?? hgFile;
    }
    if (this.hgPendingResolve) return false;
    const hgSourceURL = URL.createObjectURL(hgFile); // 弹窗关闭或组件卸载时回收。
    const hgCropShapes = hgNormalizeCropShapes(this.props.cropShapes); // 本次弹窗可选形状，至少包含矩形。
    const hgCropShape = hgCropShapes.includes(this.props.cropShape)
      ? this.props.cropShape
      : hgCropShapes[0]; // 初始形状无效时使用第一个有效配置。
    return new Promise((hgResolve) => {
      this.hgPendingResolve = hgResolve;
      this.setState({
        hgOpen: true,
        hgSourceURL,
        hgFile,
        hgZoom: 0,
        hgRotation: 0,
        hgOffsetX: 0,
        hgOffsetY: 0,
        hgCropShape,
        hgBusy: false,
        hgError: "",
      });
    }).then(async (hgResult) => {
      if (!(hgResult instanceof File)) return false;
      return hgChild.props.beforeUpload
        ? await hgChild.props.beforeUpload(hgResult, [hgResult])
        : hgResult;
    });
  };

  /** 取消当前裁切并通知上传组件跳过该文件。 */
  hgCancel = () => {
    if (this.state.hgBusy) return;
    this.hgDragStart = null;
    this.hgReleaseSource();
    this.hgPendingResolve?.(false);
    this.hgPendingResolve = null;
    this.setState({ hgOpen: false, hgSourceURL: "", hgFile: null });
  };

  /** 将图片偏移限制在视口一倍范围内，避免拖出后难以找回。 */
  hgSetOffset = (hgOffsetX, hgOffsetY) => {
    const hgClamp = (hgValue) => Math.max(-100, Math.min(100, hgValue)); // 百分比边界与键盘、指针操作共用。
    this.setState({
      hgOffsetX: hgClamp(hgOffsetX),
      hgOffsetY: hgClamp(hgOffsetY),
    });
  };

  /** 记录拖动起点；Pointer Events 同时覆盖鼠标、触控笔和触摸屏。 */
  hgStartMove = (hgEvent) => {
    if (this.state.hgBusy) return;
    hgEvent.preventDefault();
    hgEvent.currentTarget.setPointerCapture?.(hgEvent.pointerId);
    this.hgDragStart = {
      pointerId: hgEvent.pointerId,
      clientX: hgEvent.clientX,
      clientY: hgEvent.clientY,
      offsetX: this.state.hgOffsetX,
      offsetY: this.state.hgOffsetY,
    }; // 偏移快照用于把屏幕移动量换算为相对视口百分比。
  };

  /** 根据指针移动量实时调整图片位置，使裁切区域可覆盖目标内容。 */
  hgMove = (hgEvent) => {
    if (!this.hgDragStart || this.hgDragStart.pointerId !== hgEvent.pointerId)
      return;
    const hgBounds = hgEvent.currentTarget.getBoundingClientRect(); // 当前响应式视口尺寸。
    const hgDeltaX =
      ((hgEvent.clientX - this.hgDragStart.clientX) / hgBounds.width) * 100; // 水平移动占视口宽度的百分比。
    const hgDeltaY =
      ((hgEvent.clientY - this.hgDragStart.clientY) / hgBounds.height) * 100; // 垂直移动占视口高度的百分比。
    this.hgSetOffset(
      this.hgDragStart.offsetX + hgDeltaX,
      this.hgDragStart.offsetY + hgDeltaY
    );
  };

  /** 结束当前指针拖动，后续移动不再改变图片位置。 */
  hgEndMove = (hgEvent) => {
    if (this.hgDragStart?.pointerId !== hgEvent.pointerId) return;
    if (hgEvent.currentTarget.hasPointerCapture?.(hgEvent.pointerId)) {
      hgEvent.currentTarget.releasePointerCapture(hgEvent.pointerId);
    }
    this.hgDragStart = null;
  };

  /** 允许聚焦裁切区域后用方向键精细移动，按 Shift 时加速。 */
  hgMoveByKeyboard = (hgEvent) => {
    const hgStep = hgEvent.shiftKey ? 10 : 2; // 普通方向键微调 2%，Shift 加速到 10%。
    const hgDirection = {
      ArrowLeft: [-hgStep, 0],
      ArrowRight: [hgStep, 0],
      ArrowUp: [0, -hgStep],
      ArrowDown: [0, hgStep],
    }[hgEvent.key]; // 非方向键返回 undefined，不拦截浏览器默认行为。
    if (!hgDirection || this.state.hgBusy) return;
    hgEvent.preventDefault();
    this.hgSetOffset(
      this.state.hgOffsetX + hgDirection[0],
      this.state.hgOffsetY + hgDirection[1]
    );
  };

  /** 按当前缩放和旋转参数绘制居中裁切结果。 */
  hgConfirm = async () => {
    if (this.state.hgBusy || !this.state.hgFile) return;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgImage = await hgLoadImage(this.state.hgSourceURL); // 已解码源图，用于 Canvas 绘制。
      const hgWidth = Math.max(1, Math.round(this.props.outputWidth)); // 输出像素宽度，最小为 1。
      const hgAspect = Math.max(0.01, Number(this.props.aspect) || 1); // 防止无效宽高比导致零尺寸画布。
      const hgHeight = Math.max(1, Math.round(hgWidth / hgAspect)); // 根据裁切比例计算输出高度。
      const hgCanvas = document.createElement("canvas"); // 离屏画布仅用于生成结果，不插入 DOM。
      hgCanvas.width = hgWidth;
      hgCanvas.height = hgHeight;
      const hgContext = hgCanvas.getContext("2d");
      if (!hgContext) throw new Error("当前浏览器不支持图片裁切");

      const hgBaseScale = Math.min(
        hgWidth / hgImage.naturalWidth,
        hgHeight / hgImage.naturalHeight
      ); // contain 缩放确保初始状态可完整查看源图。
      const hgZoomScale = 2 ** this.state.hgZoom; // 中央档位为 1，左右端分别为 0.5 和 2 倍。
      const hgScale = hgBaseScale * hgZoomScale; // 用户缩放在完整显示尺寸上叠加。
      if (this.state.hgCropShape !== "rect") {
        hgContext.beginPath();
        if (this.state.hgCropShape === "round") {
          hgContext.arc(
            hgWidth / 2,
            hgHeight / 2,
            Math.min(hgWidth, hgHeight) / 2,
            0,
            Math.PI * 2
          );
        } else {
          hgContext.ellipse(
            hgWidth / 2,
            hgHeight / 2,
            hgWidth / 2,
            hgHeight / 2,
            0,
            0,
            Math.PI * 2
          );
        }
        hgContext.clip();
      }
      const hgType =
        this.state.hgCropShape === "rect" &&
        ["image/jpeg", "image/png", "image/webp"].includes(
          this.state.hgFile.type
        )
          ? this.state.hgFile.type
          : "image/png"; // 非矩形强制 PNG，保留裁切区域外的透明像素。
      if (hgType === "image/jpeg") {
        hgContext.fillStyle = "#fff";
        hgContext.fillRect(0, 0, hgWidth, hgHeight);
      }
      hgContext.translate(
        hgWidth / 2 + (this.state.hgOffsetX / 100) * hgWidth,
        hgHeight / 2 + (this.state.hgOffsetY / 100) * hgHeight
      );
      hgContext.rotate((this.state.hgRotation * Math.PI) / 180);
      hgContext.scale(hgScale, hgScale);
      hgContext.drawImage(
        hgImage,
        -hgImage.naturalWidth / 2,
        -hgImage.naturalHeight / 2
      );
      const hgBlob = await hgCanvasToBlob(hgCanvas, hgType); // 编码后的裁切内容。
      const hgFileName =
        hgType === "image/png" && this.state.hgFile.type !== "image/png"
          ? hgReplaceFileExtension(this.state.hgFile.name, "png")
          : this.state.hgFile.name; // MIME 改为 PNG 时同步扩展名，避免服务端按后缀误判。
      const hgCroppedFile = new File([hgBlob], hgFileName, {
        type: hgBlob.type || hgType,
        lastModified: Date.now(),
      }); // 保留文件名，替换内容和修改时间。
      this.hgReleaseSource();
      this.hgPendingResolve?.(hgCroppedFile);
      this.hgPendingResolve = null;
      this.setState({
        hgOpen: false,
        hgSourceURL: "",
        hgFile: null,
        hgBusy: false,
      });
    } catch (hgError) {
      this.setState({
        hgBusy: false,
        hgError: hgError?.message || "图片裁切失败",
      });
    }
  };

  renderCropDialog() {
    if (!this.state.hgOpen) return null;
    const hgZoomScale = 2 ** this.state.hgZoom; // 预览和 Canvas 共用指数缩放关系。
    const hgCropShapes = hgNormalizeCropShapes(this.props.cropShapes); // 当前允许显示的形状按钮。
    const hgAspect = Math.max(0.01, Number(this.props.aspect) || 1); // 预览宽高比，与输出画布保持一致。
    const hgPreviewStyle = {
      transform: `translate(${this.state.hgOffsetX}%, ${this.state.hgOffsetY}%) scale(${hgZoomScale}) rotate(${this.state.hgRotation}deg)`,
    }; // 与滑杆同步的视觉预览；实际输出由 Canvas 使用同组参数生成。
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <section className={styles.dialog} aria-labelledby="hg-crop-title">
          <header className={styles.header}>
            <h3 id="hg-crop-title">{this.props.title}</h3>
          </header>
          <div className={styles.body}>
            <div
              className={`${styles.cropViewport} ${styles[`cropViewport_${this.state.hgCropShape}`]}`}
              style={{
                aspectRatio: hgAspect,
                width: `min(100%, 380px, ${52 * hgAspect}vh)`,
              }}
              role="application"
              tabIndex={0}
              aria-label="裁切区域，可拖动图片或使用方向键移动"
              onPointerDown={this.hgStartMove}
              onPointerMove={this.hgMove}
              onPointerUp={this.hgEndMove}
              onPointerCancel={this.hgEndMove}
              onKeyDown={this.hgMoveByKeyboard}
            >
              <img
                src={this.state.hgSourceURL}
                alt="待裁切图片"
                draggable={false}
                style={hgPreviewStyle}
              />
              <span className={styles.cropFrame} aria-hidden="true" />
            </div>
            <div className={styles.moveTools}>
              <span>拖动图片调整位置，聚焦后也可使用方向键微调。</span>
              <button
                type="button"
                disabled={this.state.hgBusy}
                onClick={() => this.hgSetOffset(0, 0)}
              >
                居中
              </button>
            </div>
            {hgCropShapes.length > 1 && (
              <fieldset className={styles.shapeSelector}>
                <legend>裁切形状</legend>
                {HG_CROP_SHAPE_OPTIONS.filter((hgOption) =>
                  hgCropShapes.includes(hgOption.value)
                ).map((hgOption) => (
                  <label key={hgOption.value}>
                    <input
                      type="radio"
                      name={this.hgShapeGroupName}
                      value={hgOption.value}
                      checked={this.state.hgCropShape === hgOption.value}
                      disabled={this.state.hgBusy}
                      onChange={() =>
                        this.setState({ hgCropShape: hgOption.value })
                      }
                    />
                    <span>{hgOption.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <label className={styles.sliderRow}>
              <span>缩放</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={this.state.hgZoom}
                onChange={(hgEvent) =>
                  this.setState({ hgZoom: Number(hgEvent.target.value) })
                }
              />
              <output>{Math.round(hgZoomScale * 100)}%</output>
            </label>
            {this.props.rotationSlider && (
              <label className={styles.sliderRow}>
                <span>旋转</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={this.state.hgRotation}
                  onChange={(hgEvent) =>
                    this.setState({ hgRotation: Number(hgEvent.target.value) })
                  }
                />
                <output>{this.state.hgRotation}°</output>
              </label>
            )}
            {this.state.hgError && (
              <p className={styles.error} role="alert">
                {this.state.hgError}
              </p>
            )}
          </div>
          <footer className={styles.footer}>
            <button type="button" disabled={this.state.hgBusy} onClick={this.hgCancel}>
              取消
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={this.state.hgBusy}
              onClick={this.hgConfirm}
            >
              {this.state.hgBusy ? "处理中…" : "确认裁切"}
            </button>
          </footer>
        </section>
      </div>
    );
  }

  render() {
    const hgChild = React.Children.only(this.props.children); // 唯一上传子组件，注入裁切前置处理。
    return (
      <>
        {React.cloneElement(hgChild, { beforeUpload: this.hgBeforeUpload })}
        {this.renderCropDialog()}
      </>
    );
  }
}
