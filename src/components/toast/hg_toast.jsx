import React from "react";
import styles from "./hg_toast.module.css";

const TOAST_TYPE_CLASS_MAP = {
  error: "toastError",
  info: "toastInfo",
  success: "toastSuccess",
  warning: "toastWarning",
};

const TOAST_ICON_MAP = {
  error: "×",
  info: "i",
  success: "✓",
  warning: "!",
};

const TOAST_POSITION_CLASS_MAP = {
  bottom: "positionBottom",
  center: "positionCenter",
  top: "positionTop",
};

/**
 * 归一化 Toast 类型，兼容旧工具类的 warn/warm 写法。
 * @param {string} type 输入类型。
 * @returns {"info"|"success"|"warning"|"error"} 标准类型。
 */
export function normalizeToastType(type) {
  const lowerType = String(type ?? "info").toLowerCase();
  if (lowerType === "warn" || lowerType === "warm") {
    return "warning";
  }
  if (lowerType === "success" || lowerType === "warning" || lowerType === "error") {
    return lowerType;
  }
  return "info";
}

/**
 * 通用 Toast 展示组件：只负责渲染和自动关闭，不持有全局状态。
 */
class HGToast extends React.PureComponent {
  /**
   * 构造函数：初始化自动关闭定时器引用。
   * @param {Object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.closeTimer = null;
  }

  /** 生命周期挂载：首次显示时启动自动关闭计时。 */
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

  /** 生命周期卸载：清理自动关闭定时器，避免回调泄漏。 */
  componentWillUnmount() {
    this.clearCloseTimer();
  }

  /** 清理自动关闭定时器。 */
  clearCloseTimer = () => {
    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  };

  /** 同步自动关闭定时器；duration<=0 时不自动关闭。 */
  syncAutoCloseTimer = () => {
    const { duration = 2400, visible = false } = this.props;
    this.clearCloseTimer();
    if (!visible || duration <= 0) {
      return;
    }
    this.closeTimer = window.setTimeout(this.handleClose, duration);
  };

  /** 触发关闭回调，visible 状态由上层宿主管理。 */
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
    const normalizedType = normalizeToastType(this.props.type);
    return [
      styles.toastContent,
      styles[TOAST_TYPE_CLASS_MAP[normalizedType] ?? TOAST_TYPE_CLASS_MAP.info],
    ].join(" ");
  };

  /**
   * 渲染 Toast。
   * @returns {React.ReactNode} Toast 节点；未传内容时不渲染。
   */
  render() {
    const { closable = false, message, visible = false } = this.props;
    const type = normalizeToastType(this.props.type);
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
