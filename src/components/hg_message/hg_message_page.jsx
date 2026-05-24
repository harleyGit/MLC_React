/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_message/hg_message_page.jsx
 * @Description: 命令式消息提示组件，替代 antd message，支持 success/error/warning/info 类型
 */
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import styles from "./hg_message.module.css";

const MESSAGE_TYPE_CONFIG = {
  success: { className: "typeSuccess", icon: "✓" },
  error: { className: "typeError", icon: "×" },
  warning: { className: "typeWarning", icon: "!" },
  info: { className: "typeInfo", icon: "i" },
};

const DEFAULT_DURATION = 3000;

let messageRoot = null;
let messageContainer = null;
let messageHostRef = React.createRef();

/**
 * 消息宿主组件：承接命令式调用并渲染消息列表。
 */
class HGMessageHost extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
    };
    this.nextId = 0;
  }

  /**
   * 添加一条消息。
   * @param {string} type - 消息类型 success/error/warning/info。
   * @param {string} content - 消息内容。
   * @param {number} duration - 持续时间（毫秒）。
   */
  addMessage = (type, content, duration) => {
    const id = this.nextId++;
    const msg = { id, type, content, visible: true };

    this.setState((prev) => ({
      messages: [...prev.messages, msg],
    }));

    if (duration > 0) {
      setTimeout(() => {
        this.removeMessage(id);
      }, duration);
    }
  };

  /**
   * 移除指定消息。
   * @param {number} id - 消息 id。
   */
  removeMessage = (id) => {
    this.setState((prev) => ({
      messages: prev.messages.filter((m) => m.id !== id),
    }));
  };

  /**
   * 渲染单条消息。
   * @param {Object} msg - 消息对象。
   * @returns {React.ReactNode} 消息节点。
   */
  renderMessage = (msg) => {
    const config = MESSAGE_TYPE_CONFIG[msg.type] || MESSAGE_TYPE_CONFIG.info;

    return (
      <div
        key={msg.id}
        className={`${styles.messageItem} ${styles[config.className]}`}
        role="alert"
      >
        <span className={styles.messageIcon}>{config.icon}</span>
        <span className={styles.messageContent}>{msg.content}</span>
      </div>
    );
  };

  /**
   * 渲染消息列表容器。
   * @returns {React.ReactNode} 消息列表节点或 null。
   */
  render() {
    const { messages } = this.state;
    if (messages.length === 0) {
      return null;
    }

    return (
      <div className={styles.messageContainer}>
        {messages.map(this.renderMessage)}
      </div>
    );
  }
}

/**
 * 获取或创建消息挂载容器。
 * @returns {HTMLElement|null} DOM 容器。
 */
function ensureMessageContainer() {
  if (typeof document === "undefined") {
    return null;
  }

  if (messageContainer) {
    return messageContainer;
  }

  messageContainer = document.createElement("div");
  messageContainer.setAttribute("data-hg-message", "true");
  document.body.appendChild(messageContainer);
  return messageContainer;
}

/**
 * 获取或创建消息宿主实例。
 * @returns {HGMessageHost|null} 宿主实例。
 */
function ensureMessageHost() {
  const container = ensureMessageContainer();
  if (!container) {
    return null;
  }

  if (!messageRoot) {
    messageHostRef = React.createRef();
    messageRoot = createRoot(container);
    flushSync(() => {
      messageRoot.render(<HGMessageHost ref={messageHostRef} />);
    });
  }

  return messageHostRef.current;
}

/**
 * 显示一条消息。
 * @param {string} type - 消息类型。
 * @param {string} content - 消息内容。
 * @param {number} duration - 持续时间。
 */
function showMessage(type, content, duration = DEFAULT_DURATION) {
  const host = ensureMessageHost();
  if (!host) {
    return;
  }
  host.addMessage(type, content, duration);
}

const hgMessage = {
  success(content, duration) {
    showMessage("success", content, duration);
  },
  error(content, duration) {
    showMessage("error", content, duration);
  },
  warning(content, duration) {
    showMessage("warning", content, duration);
  },
  info(content, duration) {
    showMessage("info", content, duration);
  },
  destroy() {
    if (messageRoot) {
      messageRoot.unmount();
      messageRoot = null;
    }
    if (messageContainer?.parentNode) {
      messageContainer.parentNode.removeChild(messageContainer);
    }
    messageContainer = null;
    messageHostRef = React.createRef();
  },
};

export { hgMessage, HGMessageHost };
export default hgMessage;
