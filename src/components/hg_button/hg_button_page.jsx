/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_button/hg_button_page.jsx
 * @Description: 自定义按钮组件，兼容 antd Button 主要 props
 */

import React from "react";
import styles from "./hg_button.module.css";

const SIZE_CLASS_MAP = {
  small: "sizeSmall",
  middle: "sizeMiddle",
  large: "sizeLarge",
};

const TYPE_CLASS_MAP = {
  primary: "typePrimary",
  default: "typeDefault",
  link: "typeLink",
  text: "typeText",
};

/**
 * 自定义按钮组件，兼容 antd Button 主要 props。
 * 支持 type、size、loading、block、danger、disabled 等属性。
 */
/** @extends {React.PureComponent<Partial<typeof HGButtonPage.defaultProps>>} */
class HGButtonPage extends React.PureComponent {
  static defaultProps = {
    /** 按钮视觉类型，默认 default；支持 primary、dashed、text、link 等既有样式。 */
    type: "default",
    /** 尺寸档位，默认 middle；可选 small/middle/large。 */
    size: "middle",
    /** 默认不占满整行；true 将按钮宽度拉伸到容器宽度。 */
    block: false,
    /** 默认普通配色；true 表示危险操作。 */
    danger: false,
    /** 默认可点击；true 禁止触发 onClick。 */
    disabled: false,
    /** 默认不加载；true 显示加载指示并阻止重复点击。 */
    loading: false,
    /** 原生 button 类型，默认 button；提交表单时传 submit。 @type {'button'|'submit'|'reset'} */
    htmlType: "button",
    /** 按钮内容，默认 undefined 不显示文案。 @type {React.ReactNode} */
    children: undefined,
    /** 点击回调，默认 undefined 不执行额外操作。 @type {React.MouseEventHandler<HTMLButtonElement>|undefined} */
    onClick: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 根节点行内样式，默认 undefined 使用组件样式。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  /**
   * 获取按钮根节点 className。
   * @returns {string} 组合后的 className。
   */
  getClassName = () => {
    const {
      type = "default",
      size = "middle",
      block = false,
      danger = false,
      disabled = false,
      loading = false,
      className = "",
    } = this.props;

    return [
      styles.btn,
      styles[TYPE_CLASS_MAP[type] || TYPE_CLASS_MAP.default],
      styles[SIZE_CLASS_MAP[size] || SIZE_CLASS_MAP.middle],
      block ? styles.block : "",
      danger ? styles.danger : "",
      disabled || loading ? styles.disabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * 渲染 loading 旋转图标。
   * @returns {React.ReactNode} spinner 节点或 null。
   */
  renderLoadingIcon = () => {
    const { loading } = this.props;
    if (!loading) return null;
    return <span className={styles.spinner} aria-hidden="true" />;
  };

  /**
   * 处理点击事件，loading 或 disabled 时阻止冒泡。
   * @param {React.MouseEvent} e - 鼠标事件。
   */
  handleClick = (e) => {
    const { loading, disabled, onClick } = this.props;
    if (loading || disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  /**
   * 渲染按钮 DOM 结构。
   * 职责：组装 button 元素，包含 loading 图标和内容区域。
   * 输入：htmlType、children、style 等 props。
   * 输出：React 节点。
   * 约束：loading 或 disabled 时点击事件被阻止。
   */
  render() {
    const { htmlType = "button", children, style } = this.props;

    return (
      <button
        type={htmlType}
        className={this.getClassName()}
        style={style}
        onClick={this.handleClick}
      >
        {this.renderLoadingIcon()}
        <span className={styles.content}>{children}</span>
      </button>
    );
  }
}

export default HGButtonPage;
