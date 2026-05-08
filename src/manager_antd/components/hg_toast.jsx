import React from "react";
import styles from "./hg_toast.module.css";

const TOAST_TYPE_CLASS_MAP = {
  error: "toastError",
  warning: "toastWarning",
  info: "toastInfo",
};

const TOAST_ICON_MAP = {
  error: "×",
  warning: "!",
  info: "i",
};

const TOAST_POSITION_CLASS_MAP = {
  top: "positionTop",
  center: "positionCenter",
  bottom: "positionBottom",
};

/**
 * 通用 Toast 组件：支持 error、warning、info 三种提示类型。
 */
class HGToast extends React.PureComponent {
  /**
   * 构造函数：初始化自动关闭定时器引用。
   * @param {Object} props 组件属性。
   * 约束：Toast 可受控显示，定时器只在 visible=true 时创建。
   */
  constructor(props) {
    super(props);
    this.closeTimer = null;
  }

  /**
   * 生命周期挂载：首次显示时启动自动关闭计时。
   */
  componentDidMount() {
    this.syncAutoCloseTimer();
  }

  /**
   * 生命周期更新：visible 或 duration 变化时同步自动关闭计时器。
   * @param {Object} prevProps 上一次 props。
   */
  componentDidUpdate(prevProps) {
    if (
      prevProps.visible !== this.props.visible ||
      prevProps.duration !== this.props.duration
    ) {
      this.syncAutoCloseTimer();
    }
  }

  /**
   * 生命周期卸载：清理自动关闭定时器，避免回调泄漏。
   */
  componentWillUnmount() {
    this.clearCloseTimer();
  }

  /**
   * 清理自动关闭定时器。
   * 约束：每次重新计时前必须调用，避免重复 onClose。
   */
  clearCloseTimer = () => {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  };

  /**
   * 同步自动关闭定时器。
   * 约束：duration<=0 时不自动关闭，适合全受控场景。
   */
  syncAutoCloseTimer = () => {
    const { duration = 2400, visible = false } = this.props;
    this.clearCloseTimer();
    if (!visible || duration <= 0) {
      return;
    }
    this.closeTimer = setTimeout(() => {
      this.handleClose();
    }, duration);
  };

  /**
   * 触发关闭回调。
   * 约束：组件不自行维护 visible，由父组件负责隐藏状态。
   */
  handleClose = () => {
    this.clearCloseTimer();
    this.props.onClose?.();
  };

  /**
   * 获取 Toast 根节点样式。
   * @returns {string} 根节点 className。
   */
  getRootClassName = () => {
    const { className = "", position = "top", visible = false } = this.props;
    return [
      styles.toastRoot,
      styles[TOAST_POSITION_CLASS_MAP[position] ?? TOAST_POSITION_CLASS_MAP.top],
      visible ? styles.toastVisible : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * 获取 Toast 内容样式。
   * @returns {string} 内容容器 className。
   */
  getContentClassName = () => {
    const { type = "info" } = this.props;
    return [
      styles.toastContent,
      styles[TOAST_TYPE_CLASS_MAP[type] ?? TOAST_TYPE_CLASS_MAP.info],
    ].join(" ");
  };

  /**
   * 渲染 Toast。
   * @returns {React.ReactNode} Toast 节点；未传内容时不渲染。
   */
  render() {
    const {
      closable = false,
      message,
      type = "info",
      visible = false,
    } = this.props;
    if (!message) {
      return null;
    }

    return (
      <div
        className={this.getRootClassName()}
        aria-hidden={!visible}
        role={type === "error" ? "alert" : "status"}
      >
        <div className={this.getContentClassName()}>
          <span className={styles.toastIcon}>{TOAST_ICON_MAP[type] ?? TOAST_ICON_MAP.info}</span>
          <span className={styles.toastMessage}>{message}</span>
          {closable ? (
            <button
              type="button"
              className={styles.toastCloseButton}
              aria-label="关闭提示"
              onClick={this.handleClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}

export default HGToast;
