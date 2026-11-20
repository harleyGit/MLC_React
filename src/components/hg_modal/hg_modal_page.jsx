/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/components/hg_modal/hg_modal_page.jsx
 * @Description: 通用弹窗组件，支持自定义内容、尺寸、按钮
 */

import React from "react";
import styles from "./hg_modal.module.css";

/**
 * SVG 关闭图标。
 */
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/**
 * 通用弹窗组件。
 * 职责：展示弹窗，支持自定义标题、内容、底部按钮。
 * 输入：visible, title, size, onClose, children, footer, className。
 * 约束：visible 控制显示隐藏，onClose 关闭回调。
 */
/** @extends {React.Component<Partial<typeof HGModalPage.defaultProps>>} */
class HGModalPage extends React.Component {
  static defaultProps = {
    /** 受控显示开关，默认 false 隐藏弹窗。 */
    visible: false,
    /** 标题节点，默认 undefined 不提供标题内容。 @type {React.ReactNode} */
    title: undefined,
    /** 弹窗正文，默认 undefined 无内容。 @type {React.ReactNode} */
    children: undefined,
    /** 默认允许关闭；控制关闭图标、遮罩点击及 Escape。 */
    closable: true,
    /** 关闭请求回调，默认 undefined；父级需将 visible 改为 false。 @type {Function|undefined} */
    onClose: undefined,
    /** 确认回调，默认 undefined 不执行提交。 @type {Function|undefined} */
    onOk: undefined,
    /** 取消按钮回调，默认 undefined 不执行取消操作。 @type {Function|undefined} */
    onCancel: undefined,
    /** 底栏节点，默认 undefined 使用内置确认/取消按钮；null 隐藏底栏。 @type {React.ReactNode} */
    footer: undefined,
    /** 确认按钮文字，默认 undefined 使用内置“确定”。 @type {React.ReactNode} */
    okText: undefined,
    /** 取消按钮文字，默认 undefined 使用内置“取消”。 @type {React.ReactNode} */
    cancelText: undefined,
    /** 确认按钮视觉类型，默认 primary。 */
    okType: "primary",
    /** 弹窗尺寸档位，默认 default。 */
    size: "default",
    /** 弹窗附加样式类，默认空字符串。 */
    className: "",
  };

  /**
   * 处理遮罩层点击。
   * @param {React.MouseEvent} e 鼠标事件。
   */
  handleOverlayClick = (e) => {
    const { closable = true, onClose } = this.props;
    if (closable && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  /**
   * 处理键盘 Esc 按下。
   * @param {KeyboardEvent} e 键盘事件。
   */
  handleKeyDown = (e) => {
    const { closable = true, onClose } = this.props;
    if (closable && e.key === "Escape" && onClose) {
      onClose();
    }
  };

  /**
   * 生命周期挂载：监听键盘事件。
   */
  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyDown);
  }

  /**
   * 生命周期卸载：移除键盘事件监听。
   */
  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  /**
   * 渲染头部。
   * @returns {React.ReactNode} 头部节点。
   */
  renderHeader = () => {
    const { title, closable = true, onClose } = this.props;
    if (!title && !closable) return null;

    return (
      <div className={styles.header}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {closable && (
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
    );
  };

  /**
   * 渲染底部。
   * @returns {React.ReactNode} 底部节点。
   */
  renderFooter = () => {
    const { footer, onOk, onCancel, okText, cancelText, okType = "primary" } = this.props;

    // 自定义 footer
    if (footer !== undefined) {
      if (footer === null) return null;
      return <div className={styles.footer}>{footer}</div>;
    }

    // 默认 footer（确认/取消按钮）
    if (onOk || onCancel) {
      const btnClass = okType === "danger" ? styles.btnDanger : styles.btnPrimary;
      return (
        <div className={styles.footer}>
          {onCancel && (
            <button type="button" className={`${styles.btn} ${styles.btnDefault}`} onClick={onCancel}>
              {cancelText || "取消"}
            </button>
          )}
          {onOk && (
            <button type="button" className={`${styles.btn} ${btnClass}`} onClick={onOk}>
              {okText || "确认"}
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  render() {
    const { visible, size = "default", className = "", children } = this.props;

    if (!visible) return null;

    const sizeClass = styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || styles.sizeDefault;
    const contentClass = [styles.content, sizeClass, className].filter(Boolean).join(" ");

    return (
      <div className={styles.overlay} onClick={this.handleOverlayClick}>
        <div className={contentClass}>
          {this.renderHeader()}
          <div className={styles.body}>
            {children}
          </div>
          {this.renderFooter()}
        </div>
      </div>
    );
  }
}

export default HGModalPage;
