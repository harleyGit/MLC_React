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
class HGButtonPage extends React.PureComponent {
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
