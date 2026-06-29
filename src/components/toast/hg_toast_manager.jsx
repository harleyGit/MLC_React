/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import HGToast, { normalizeToastType } from "./hg_toast";

const DEFAULT_TOAST_OPTIONS = {
  closable: false,
  duration: 2400,
  message: "",
  position: "top",
  type: "info",
};

let toastRoot = null;
let toastContainer = null;
let toastHostRef = React.createRef();

/**
 * Toast 宿主组件：承接命令式调用，并渲染受控 HGToast。
 */
class HGToastManagerHost extends React.PureComponent {
  /**
   * 构造函数：初始化当前 Toast 展示状态。
   * @param {Object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.state = {
      ...DEFAULT_TOAST_OPTIONS,
      visible: false,
    };
  }

  /**
   * 显示一条 Toast，后一次调用覆盖前一次调用。
   * @param {Object} options Toast 配置。
   */
  showToast = (options) => {
    this.setState({
      ...DEFAULT_TOAST_OPTIONS,
      ...options,
      type: normalizeToastType(options.type),
      visible: true,
    });
  };

  /** 隐藏当前 Toast，保留文案用于关闭动画。 */
  hideToast = () => {
    this.setState({
      visible: false,
    });
  };

  /**
   * 渲染 Toast 宿主。
   * @returns {React.ReactNode} 受控 Toast 节点。
   */
  render() {
    return <HGToast {...this.state} onClose={this.hideToast} />;
  }
}

/**
 * 获取或创建 Toast 挂载容器。
 * @returns {HTMLElement|null} Toast DOM 容器；非浏览器环境返回 null。
 */
function ensureToastContainer() {
  if (typeof document === "undefined") {
    return null;
  }

  if (toastContainer) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.setAttribute("data-hg-toast-manager", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * 获取或创建 Toast 宿主实例。
 * @returns {HGToastManagerHost|null} Toast 宿主实例；非浏览器环境返回 null。
 */
function ensureToastHost() {
  const container = ensureToastContainer();
  if (!container) {
    return null;
  }

  if (!toastRoot) {
    toastHostRef = React.createRef();
    toastRoot = createRoot(container);
    flushSync(() => {
      toastRoot.render(<HGToastManagerHost ref={toastHostRef} />);
    });
  }

  return toastHostRef.current;
}

/**
 * 归一化 Toast 入参，兼容旧工具类的 duration 数字第二参。
 * @param {string|Object} messageOrOptions 提示内容或完整配置。
 * @param {Object|number} extraOptions 附加配置或持续时长。
 * @returns {Object} 归一化后的 Toast 配置。
 */
function normalizeToastOptions(messageOrOptions, extraOptions = {}) {
  const normalizedExtraOptions =
    typeof extraOptions === "number" ? { duration: extraOptions } : extraOptions;

  if (typeof messageOrOptions === "object" && messageOrOptions !== null) {
    return {
      ...messageOrOptions,
      ...normalizedExtraOptions,
      type: normalizeToastType(messageOrOptions.type ?? normalizedExtraOptions.type),
    };
  }

  return {
    ...normalizedExtraOptions,
    message: messageOrOptions,
    type: normalizeToastType(normalizedExtraOptions.type),
  };
}

/**
 * Toast 命令式管理器：统一提供组件版和旧工具类调用能力。
 */
const HGToastManager = {
  /**
   * 显示指定类型 Toast。
   * @param {string|Object} messageOrOptions 提示内容或完整配置。
   * @param {Object|number} [extraOptions] 附加配置或持续时长。
   * @returns {() => void} 手动关闭函数。
   */
  show(messageOrOptions, extraOptions = {}) {
    const toastHost = ensureToastHost();
    if (!toastHost) {
      return () => {};
    }

    const nextOptions = normalizeToastOptions(messageOrOptions, extraOptions);
    if (!nextOptions.message) {
      return () => {};
    }

    toastHost.showToast(nextOptions);
    return () => {
      toastHost.hideToast();
    };
  },

  /** 显示信息 Toast。 */
  info(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...(typeof extraOptions === "number" ? { duration: extraOptions } : extraOptions),
      type: "info",
    });
  },

  /** 显示成功 Toast。 */
  success(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...(typeof extraOptions === "number" ? { duration: extraOptions } : extraOptions),
      type: "success",
    });
  },

  /** 显示警告 Toast。 */
  warning(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...(typeof extraOptions === "number" ? { duration: extraOptions } : extraOptions),
      type: "warning",
    });
  },

  /** 兼容旧工具类 warn 写法。 */
  warn(messageOrOptions, extraOptions = {}) {
    return this.warning(messageOrOptions, extraOptions);
  },

  /** 兼容旧工具类 warm 拼写。 */
  warm(messageOrOptions, extraOptions = {}) {
    return this.warning(messageOrOptions, extraOptions);
  },

  /** 显示错误 Toast。 */
  error(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...(typeof extraOptions === "number" ? { duration: extraOptions } : extraOptions),
      type: "error",
    });
  },

  /**
   * 隐藏当前 Toast。
   * @returns {boolean} 是否成功触发隐藏。
   */
  hide() {
    const toastHost = ensureToastHost();
    if (!toastHost) {
      return false;
    }
    toastHost.hideToast();
    return true;
  },

  /** 销毁 Toast Root 与 DOM 容器，通常只在应用卸载或测试清理时调用。 */
  destroy() {
    if (toastRoot) {
      toastRoot.unmount();
      toastRoot = null;
    }

    if (toastContainer?.parentNode) {
      toastContainer.parentNode.removeChild(toastContainer);
    }

    toastContainer = null;
    toastHostRef = React.createRef();
  },
};

const showHGToast = (options) => HGToastManager.show(options);

export { HGToastManagerHost, showHGToast };
export default HGToastManager;
