import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import HGToast from "./hg_toast";
/*

  import HGToastManager from "src/manager_antd/components/
  hg_toast_manager";

  HGToastManager.info("保存成功");
  HGToastManager.warning("请先填写手机号", { duration: 3000 });
  HGToastManager.error("提交失败，请稍后重试", {
    closable: true,
    duration: 0,
    position: "center",
  });

  HGToastManager.hide();
*/
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
 * Toast 宿主组件：承接命令式管理器调用，并渲染受控 HGToast。
 */
class HGToastManagerHost extends React.PureComponent {
  /**
   * 构造函数：初始化当前 Toast 展示状态。
   * @param {Object} props 组件属性。
   * 约束：宿主只持有当前一条 Toast，后一次调用覆盖前一次调用，减少 DOM 节点数量。
   */
  constructor(props) {
    super(props);
    this.state = {
      ...DEFAULT_TOAST_OPTIONS,
      visible: false,
    };
  }

  /**
   * 显示一条 Toast。
   * @param {Object} options Toast 配置。
   * @param {string} options.message 提示内容。
   * @param {string} options.type 提示类型，error/warning/info。
   * @param {number} options.duration 自动关闭时长，<=0 时不自动关闭。
   * @param {string} options.position 显示位置，top/center/bottom。
   * @param {boolean} options.closable 是否显示关闭按钮。
   * 约束：同一宿主只展示最新一条 Toast，避免高频提示堆叠造成重排。
   */
  showToast = (options) => {
    this.setState({
      ...DEFAULT_TOAST_OPTIONS,
      ...options,
      visible: true,
    });
  };

  /**
   * 隐藏当前 Toast。
   * 约束：保留 message 等配置，方便关闭动画读取当前类型样式。
   */
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
 * 约束：全局只创建一个容器，避免重复挂载 Root。
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
 * 约束：使用 React 单 Root 单宿主，降低频繁提示时的创建成本。
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
 * 归一化 Toast 入参。
 * @param {string|Object} messageOrOptions 提示内容或完整配置。
 * @param {Object} extraOptions 附加配置。
 * @returns {Object} 归一化后的 Toast 配置。
 */
function normalizeToastOptions(messageOrOptions, extraOptions = {}) {
  if (typeof messageOrOptions === "object" && messageOrOptions !== null) {
    return {
      ...messageOrOptions,
      ...extraOptions,
    };
  }

  return {
    ...extraOptions,
    message: messageOrOptions,
  };
}

/**
 * Toast 命令式管理器：提供 info/warning/error/show/hide/destroy 方法。
 */
const HGToastManager = {
  /**
   * 显示指定类型 Toast。
   * @param {string|Object} messageOrOptions 提示内容或完整配置。
   * @param {Object} [extraOptions] 附加配置。
   * @returns {boolean} 是否成功触发展示。
   */
  show(messageOrOptions, extraOptions = {}) {
    const toastHost = ensureToastHost();
    if (!toastHost) {
      return false;
    }

    const nextOptions = normalizeToastOptions(messageOrOptions, extraOptions);
    if (!nextOptions.message) {
      return false;
    }

    toastHost.showToast(nextOptions);
    return true;
  },

  /**
   * 显示信息 Toast。
   * @param {string|Object} messageOrOptions 提示内容或完整配置。
   * @param {Object} [extraOptions] 附加配置。
   * @returns {boolean} 是否成功触发展示。
   */
  info(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...extraOptions,
      type: "info",
    });
  },

  /**
   * 显示警告 Toast。
   * @param {string|Object} messageOrOptions 提示内容或完整配置。
   * @param {Object} [extraOptions] 附加配置。
   * @returns {boolean} 是否成功触发展示。
   */
  warning(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...extraOptions,
      type: "warning",
    });
  },

  /**
   * 显示错误 Toast。
   * @param {string|Object} messageOrOptions 提示内容或完整配置。
   * @param {Object} [extraOptions] 附加配置。
   * @returns {boolean} 是否成功触发展示。
   */
  error(messageOrOptions, extraOptions = {}) {
    return this.show(messageOrOptions, {
      ...extraOptions,
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

  /**
   * 销毁 Toast Root 与 DOM 容器。
   * 约束：通常只在应用卸载或测试清理时调用。
   */
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

export { HGToastManagerHost };
export default HGToastManager;
