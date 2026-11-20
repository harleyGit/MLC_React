import React from "react";
import styles from "./hg_tooltip.module.css";

/**
 * 气泡提示组件。
 *
 * 功能：
 *   - 鼠标悬浮显示提示文字
 *   - 支持上下左右四个方向
 *   - 支持自定义延迟显示/隐藏
 *   - 支持自定义样式
 *
 * 输入：content, placement, delay, children, className, style, tooltipClassName, contentClassName。
 */
/** @extends {React.Component<Partial<typeof HGTooltipPage.defaultProps>>} */
class HGTooltipPage extends React.Component {
  static defaultProps = {
    /** 浮层内容，默认 undefined 不提供提示正文。 @type {React.ReactNode} */
    content: undefined,
    /** 触发提示的包裹内容，默认 undefined 无触发内容。 @type {React.ReactNode} */
    children: undefined,
    /** 显示/隐藏延迟，默认 200 毫秒。 */
    delay: 200,
    /** 提示位置，默认 top；支持组件已有的位置样式。 */
    placement: "top",
    /** 触发容器附加样式类，默认空字符串。 */
    className: "",
    /** 触发容器行内样式，默认空对象，仅使用组件样式。 @type {React.CSSProperties} */
    style: {},
    /** 浮层附加样式类，默认空字符串。 */
    tooltipClassName: "",
    /** 提示正文附加样式类，默认空字符串。 */
    contentClassName: "",
  };

  constructor(props) {
    super(props);
    this.state = {
      visible: false,
    };
    this.showTimer = null;
    this.hideTimer = null;
    this.tooltipRef = React.createRef();
    this.triggerRef = React.createRef();
  }

  componentWillUnmount() {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }

  /**
   * 处理鼠标进入。
   */
  handleMouseEnter = () => {
    const { delay = 200 } = this.props;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.showTimer = setTimeout(() => {
      this.setState({ visible: true });
    }, delay);
  };

  /**
   * 处理鼠标离开。
   */
  handleMouseLeave = () => {
    const { delay = 200 } = this.props;
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    this.hideTimer = setTimeout(() => {
      this.setState({ visible: false });
    }, delay);
  };

  /**
   * 获取提示框位置样式。
   */
  getTooltipStyle = () => {
    const { placement = "top" } = this.props;
    const style = {};

    switch (placement) {
      case "top":
        style.bottom = "100%";
        style.left = "50%";
        style.transform = "translateX(-50%)";
        style.marginBottom = "8px";
        break;
      case "bottom":
        style.top = "100%";
        style.left = "50%";
        style.transform = "translateX(-50%)";
        style.marginTop = "8px";
        break;
      case "left":
        style.right = "100%";
        style.top = "50%";
        style.transform = "translateY(-50%)";
        style.marginRight = "8px";
        break;
      case "right":
        style.left = "100%";
        style.top = "50%";
        style.transform = "translateY(-50%)";
        style.marginLeft = "8px";
        break;
      default:
        break;
    }

    return style;
  };

  /**
   * 获取箭头类名。
   */
  getArrowClass = () => {
    const { placement = "top" } = this.props;
    switch (placement) {
      case "top":
        return styles.arrowBottom;
      case "bottom":
        return styles.arrowTop;
      case "left":
        return styles.arrowRight;
      case "right":
        return styles.arrowLeft;
      default:
        return styles.arrowBottom;
    }
  };

  render() {
    const {
      content,
      children,
      className = "",
      style = {},
      tooltipClassName = "",
      contentClassName = "",
    } = this.props;
    const { visible } = this.state;

    if (!content) {
      return children;
    }

    return (
      <div
        className={`${styles.tooltipWrapper} ${className}`}
        style={style}
        ref={this.triggerRef}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        {children}
        {visible && (
          <div
            ref={this.tooltipRef}
            className={`${styles.tooltip} ${styles[`tooltip-${this.props.placement || "top"}`]} ${tooltipClassName}`}
            style={this.getTooltipStyle()}
          >
            <div className={`${styles.tooltipContent} ${contentClassName}`}>{content}</div>
            <div className={`${styles.arrow} ${this.getArrowClass()}`} />
          </div>
        )}
      </div>
    );
  }
}

export default HGTooltipPage;
