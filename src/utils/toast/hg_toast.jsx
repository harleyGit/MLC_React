/* eslint-disable react-refresh/only-export-components */
/**
 * HGToast：基于原生 DOM 的轻量提示组件工具类。
 * 约束：不依赖第三方 UI 库；支持自动消失、动画和多类型提示。
 */
class HGToast {
  static TOAST_STYLE_ID = "hg-toast-style";

  static TOAST_CONTAINER_ID = "hg-toast-container";

  static TOAST_TYPE_MAP = {
    info: {
      icon: "ℹ️",
      borderColor: "#87b6ff",
      background: "#f4f8ff",
      color: "#1958cc",
    },
    success: {
      icon: "✅",
      borderColor: "#8fd7b3",
      background: "#f2fcf6",
      color: "#0e8a4e",
    },
    warn: {
      icon: "⚠️",
      borderColor: "#ffd59a",
      background: "#fff8ef",
      color: "#ad6300",
    },
    error: {
      icon: "❌",
      borderColor: "#ffb3b3",
      background: "#fff3f3",
      color: "#c72f2f",
    },
  };

  /**
   * 标准化 toast 类型，兼容 warm/warning 写法。
   * @param {string} type 输入类型。
   * @returns {"info"|"success"|"warn"|"error"} 标准化类型。
   */
  static normalizeType(type) {
    const lowerType = String(type ?? "info").toLowerCase();
    if (lowerType === "warm" || lowerType === "warning") {
      return "warn";
    }
    if (lowerType === "success" || lowerType === "error" || lowerType === "warn") {
      return lowerType;
    }
    return "info";
  }

  /**
   * 注入 toast 样式（仅注入一次）。
   * 约束：若 style 已存在则不重复注入，避免重复样式节点。
   */
  static ensureStyle() {
    if (document.getElementById(HGToast.TOAST_STYLE_ID)) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.id = HGToast.TOAST_STYLE_ID;
    styleElement.textContent = `
      #${HGToast.TOAST_CONTAINER_ID} {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        max-width: min(88vw, 460px);
        width: fit-content;
      }
      .hg-toast-item {
        min-width: 220px;
        max-width: min(88vw, 460px);
        border-radius: 10px;
        border: 1px solid;
        padding: 10px 14px;
        box-shadow: 0 10px 22px rgba(16, 26, 58, 0.14);
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0.2px;
        display: inline-flex;
        align-items: flex-start;
        gap: 8px;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
        transition: opacity 0.2s ease, transform 0.2s ease;
        backdrop-filter: blur(4px);
      }
      .hg-toast-item-show {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .hg-toast-item-hide {
        opacity: 0;
        transform: translateY(-6px) scale(0.98);
      }
      .hg-toast-icon {
        flex-shrink: 0;
        margin-top: 1px;
      }
      .hg-toast-message {
        word-break: break-word;
      }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * 获取或创建 toast 容器节点。
   * @returns {HTMLDivElement} 页面 toast 容器。
   */
  static ensureContainer() {
    const existingContainer = document.getElementById(HGToast.TOAST_CONTAINER_ID);
    if (existingContainer) {
      return existingContainer;
    }
    const container = document.createElement("div");
    container.id = HGToast.TOAST_CONTAINER_ID;
    document.body.appendChild(container);
    return container;
  }

  /**
   * 创建单个 toast 节点。
   * @param {string} message 提示文案。
   * @param {"info"|"success"|"warn"|"error"} toastType 标准类型。
   * @returns {HTMLDivElement} toast 节点。
   */
  static createNode(message, toastType) {
    const palette = HGToast.TOAST_TYPE_MAP[toastType];
    const toastElement = document.createElement("div");
    toastElement.className = "hg-toast-item";
    toastElement.style.borderColor = palette.borderColor;
    toastElement.style.background = palette.background;
    toastElement.style.color = palette.color;
    toastElement.innerHTML = `
      <span class="hg-toast-icon">${palette.icon}</span>
      <span class="hg-toast-message">${String(message ?? "")}</span>
    `;
    return toastElement;
  }

  /**
   * 统一显示 toast。
   * @param {string|{message: string, type?: string, duration?: number}} options 文案或配置对象。
   * @returns {() => void} 手动关闭函数。
   */
  static show(options) {
    const normalizedOptions =
      typeof options === "string" ? { message: options } : options ?? {};
    const message = normalizedOptions.message ?? "";
    const toastType = HGToast.normalizeType(normalizedOptions.type);
    const duration = Math.max(Number(normalizedOptions.duration ?? 2200), 800);

    HGToast.ensureStyle();
    const toastContainer = HGToast.ensureContainer();
    const toastNode = HGToast.createNode(message, toastType);
    toastContainer.appendChild(toastNode);

    requestAnimationFrame(() => {
      toastNode.classList.add("hg-toast-item-show");
    });

    let removed = false;
    let hideTimer = null;

    /**
     * 执行隐藏并移除节点。
     * 约束：只允许移除一次，避免重复 remove 导致异常。
     */
    const removeToast = () => {
      if (removed) {
        return;
      }
      removed = true;
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      toastNode.classList.remove("hg-toast-item-show");
      toastNode.classList.add("hg-toast-item-hide");
      window.setTimeout(() => {
        toastNode.remove();
        if (toastContainer.childElementCount === 0) {
          toastContainer.remove();
        }
      }, 220);
    };

    hideTimer = window.setTimeout(removeToast, duration);
    return removeToast;
  }

  /**
   * 普通信息提示。
   * @param {string} message 提示文案。
   * @param {number} duration 自动消失时长（毫秒）。
   * @returns {() => void} 手动关闭函数。
   */
  static info(message, duration) {
    return HGToast.show({
      message,
      type: "info",
      duration,
    });
  }

  /**
   * 成功提示。
   * @param {string} message 提示文案。
   * @param {number} duration 自动消失时长（毫秒）。
   * @returns {() => void} 手动关闭函数。
   */
  static success(message, duration) {
    return HGToast.show({
      message,
      type: "success",
      duration,
    });
  }

  /**
   * 警告提示。
   * @param {string} message 提示文案。
   * @param {number} duration 自动消失时长（毫秒）。
   * @returns {() => void} 手动关闭函数。
   */
  static warn(message, duration) {
    return HGToast.show({
      message,
      type: "warn",
      duration,
    });
  }

  /**
   * 兼容 warm 拼写，行为与 warn 一致。
   * @param {string} message 提示文案。
   * @param {number} duration 自动消失时长（毫秒）。
   * @returns {() => void} 手动关闭函数。
   */
  static warm(message, duration) {
    return HGToast.warn(message, duration);
  }

  /**
   * 错误提示。
   * @param {string} message 提示文案。
   * @param {number} duration 自动消失时长（毫秒）。
   * @returns {() => void} 手动关闭函数。
   */
  static error(message, duration) {
    return HGToast.show({
      message,
      type: "error",
      duration,
    });
  }
}

/**
 * 向外兼容的函数式调用入口。
 * @param {string|{message: string, type?: string, duration?: number}} options 文案或配置对象。
 * @returns {() => void} 手动关闭函数。
 */
export const showHGToast = (options) => HGToast.show(options);

export default HGToast;
