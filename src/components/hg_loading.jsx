import React from "react";
import styles from "./hg_loading.module.css";

const LOADING_SIZE_CLASS_MAP = {
  small: "sizeSmall",
  default: "sizeDefault",
  large: "sizeLarge",
};

/**
 * 通用加载组件：支持默认旋转 loading、图片动画和点状 loading 三种模式。
 */
class HGLoading extends React.PureComponent {
  /**
   * 获取组件根节点样式。
   * @returns {string} 根节点 className。
   * 约束：只根据 props 组合样式，避免 render 内复杂计算。
   */
  getRootClassName = () => {
    const { className = "", fullscreen = false, mask = true } = this.props;
    return [
      fullscreen ? styles.fullscreenRoot : styles.inlineRoot,
      mask ? styles.maskRoot : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * 获取加载图形尺寸样式。
   * @returns {string} 尺寸 className。
   * 约束：未知尺寸回退为 default，保证样式稳定。
   */
  getSizeClassName = () => {
    const { size = "default" } = this.props;
    return styles[LOADING_SIZE_CLASS_MAP[size] ?? LOADING_SIZE_CLASS_MAP.default];
  };

  /**
   * 渲染默认旋转 loading。
   * @returns {React.ReactNode} 默认 loading 节点。
   */
  renderDefaultLoading = () => {
    return (
      <span
        className={`${styles.defaultSpinner} ${this.getSizeClassName()}`}
        aria-hidden="true"
      />
    );
  };

  /**
   * 渲染图片动画 loading。
   * @returns {React.ReactNode} 图片 loading 节点。
   * 约束：未传 imageUrl 时自动回退为默认 loading。
   */
  renderImageLoading = () => {
    const { imageAlt = "加载中", imageUrl } = this.props;
    if (!imageUrl) {
      return this.renderDefaultLoading();
    }

    return (
      <img
        className={`${styles.imageSpinner} ${this.getSizeClassName()}`}
        src={imageUrl}
        alt={imageAlt}
        draggable={false}
      />
    );
  };

  /**
   * 渲染点状 loading。
   * @returns {React.ReactNode} 点状 loading 节点。
   */
  renderDotsLoading = () => {
    return (
      <span className={`${styles.dotsSpinner} ${this.getSizeClassName()}`}>
        <i className={styles.dotItem} />
        <i className={styles.dotItem} />
        <i className={styles.dotItem} />
      </span>
    );
  };

  /**
   * 根据模式渲染 loading 图形。
   * @returns {React.ReactNode} loading 图形节点。
   */
  renderLoadingIcon = () => {
    const { mode = "default" } = this.props;
    if (mode === "image") {
      return this.renderImageLoading();
    }
    if (mode === "dots") {
      return this.renderDotsLoading();
    }
    return this.renderDefaultLoading();
  };

  /**
   * 渲染加载组件。
   * @returns {React.ReactNode} 加载节点；visible=false 时不渲染。
   */
  render() {
    const { text = "加载中...", visible = true } = this.props;
    if (!visible) {
      return null;
    }

    return (
      <div className={this.getRootClassName()} role="status" aria-live="polite">
        <div className={styles.loadingBox}>
          {this.renderLoadingIcon()}
          {text ? <span className={styles.loadingText}>{text}</span> : null}
        </div>
      </div>
    );
  }
}

export default HGLoading;
