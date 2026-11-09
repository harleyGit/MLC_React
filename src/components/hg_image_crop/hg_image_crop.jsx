import React from "react";
import styles from "./hg_image_crop.module.css";

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
    outputWidth: 800, // 默认输出宽度 800 像素，高度由 aspect 推导。
    rotationSlider: false, // 默认不显示旋转滑杆；传 true 开启 -180° 至 180° 调节。
    title: "裁切图片", // 裁切弹窗默认标题。
  };

  state = {
    hgOpen: false, // 是否显示裁切弹窗；默认关闭。
    hgSourceURL: "", // 待裁切图片的 blob 地址；空字符串表示无待处理图片。
    hgFile: null, // 原始图片 File；null 表示当前没有裁切任务。
    hgZoom: 1, // 图片缩放倍率，取值 1 至 3，默认不额外放大。
    hgRotation: 0, // 顺时针旋转角度，取值 -180 至 180，默认为 0。
    hgBusy: false, // 正在生成裁切文件时为 true，阻止重复确认。
    hgError: "", // 最近一次裁切错误；空字符串表示无错误。
  };

  hgPendingResolve = null; // 当前 beforeUpload Promise 的完成函数；无裁切任务时为 null。

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
    return new Promise((hgResolve) => {
      this.hgPendingResolve = hgResolve;
      this.setState({
        hgOpen: true,
        hgSourceURL,
        hgFile,
        hgZoom: 1,
        hgRotation: 0,
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
    this.hgReleaseSource();
    this.hgPendingResolve?.(false);
    this.hgPendingResolve = null;
    this.setState({ hgOpen: false, hgSourceURL: "", hgFile: null });
  };

  /** 按当前缩放和旋转参数绘制居中裁切结果。 */
  hgConfirm = async () => {
    if (this.state.hgBusy || !this.state.hgFile) return;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgImage = await hgLoadImage(this.state.hgSourceURL); // 已解码源图，用于 Canvas 绌制。
      const hgWidth = Math.max(1, Math.round(this.props.outputWidth)); // 输出像素宽度，最小为 1。
      const hgAspect = Math.max(0.01, Number(this.props.aspect) || 1); // 防止无效宽高比导致零尺寸画布。
      const hgHeight = Math.max(1, Math.round(hgWidth / hgAspect)); // 根据裁切比例计算输出高度。
      const hgCanvas = document.createElement("canvas"); // 离屏画布仅用于生成结果，不插入 DOM。
      hgCanvas.width = hgWidth;
      hgCanvas.height = hgHeight;
      const hgContext = hgCanvas.getContext("2d");
      if (!hgContext) throw new Error("当前浏览器不支持图片裁切");

      const hgBaseScale = Math.max(
        hgWidth / hgImage.naturalWidth,
        hgHeight / hgImage.naturalHeight
      ); // cover 缩放确保未旋转时裁切区域无空白。
      const hgScale = hgBaseScale * this.state.hgZoom; // 用户缩放在 cover 基础上叠加。
      hgContext.translate(hgWidth / 2, hgHeight / 2);
      hgContext.rotate((this.state.hgRotation * Math.PI) / 180);
      hgContext.scale(hgScale, hgScale);
      hgContext.drawImage(
        hgImage,
        -hgImage.naturalWidth / 2,
        -hgImage.naturalHeight / 2
      );

      const hgType = ["image/jpeg", "image/png", "image/webp"].includes(
        this.state.hgFile.type
      )
        ? this.state.hgFile.type
        : "image/png"; // Canvas 仅输出页面允许使用的常见格式。
      const hgBlob = await hgCanvasToBlob(hgCanvas, hgType); // 编码后的裁切内容。
      const hgCroppedFile = new File([hgBlob], this.state.hgFile.name, {
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
    const hgPreviewStyle = {
      transform: `scale(${this.state.hgZoom}) rotate(${this.state.hgRotation}deg)`,
    }; // 与滑杆同步的视觉预览；实际输出由 Canvas 使用同组参数生成。
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <section className={styles.dialog} aria-labelledby="hg-crop-title">
          <header className={styles.header}>
            <h3 id="hg-crop-title">{this.props.title}</h3>
          </header>
          <div className={styles.body}>
            <div
              className={styles.cropViewport}
              style={{ aspectRatio: this.props.aspect }}
            >
              <img src={this.state.hgSourceURL} alt="待裁切图片" style={hgPreviewStyle} />
              <span className={styles.cropFrame} aria-hidden="true" />
            </div>
            <label className={styles.sliderRow}>
              <span>缩放</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={this.state.hgZoom}
                onChange={(hgEvent) =>
                  this.setState({ hgZoom: Number(hgEvent.target.value) })
                }
              />
              <output>{this.state.hgZoom.toFixed(2)}×</output>
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
