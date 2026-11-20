import React from "react";
import styles from "./hg_loading.module.css";

const LOADING_SIZE_CLASS_MAP = {
  small: "sizeSmall",
  default: "sizeDefault",
  large: "sizeLarge",
};

/**
 * 通用加载组件：支持默认渐变旋转器 loading、图片动画和点状 loading 三种模式。
 */
/** @extends {React.PureComponent<Partial<typeof HGLoading.defaultProps>>} */
class HGLoading extends React.PureComponent {
  static defaultProps = {
    /** 默认展示加载组件；false 不渲染。 */
    visible: true,
    /** 默认局部加载；true 覆盖整个视口。 */
    fullscreen: false,
    /** 默认显示遮罩背景；false 仅保留加载内容。 */
    mask: true,
    /** 动画尺寸档位，默认 default。 */
    size: "default",
    /** 加载展示模式，默认 default；图片等模式按既有渲染分支处理。 */
    mode: "default",
    /** 加载提示，默认“加载中...”；空字符串可隐藏。 @type {React.ReactNode} */
    text: "加载中...",
    /** 自定义加载图片地址，默认 undefined 使用内置动画。 @type {string|undefined} */
    imageUrl: undefined,
    /** 加载图片替代文字，默认“加载中”。 */
    imageAlt: "加载中",
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
  };

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
   * 渲染默认请求 loading（conic-gradient 渐变旋转器）。
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
