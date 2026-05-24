import React from "react";
import styles from "./hg_switch.module.css";

/**
 * 自定义开关组件：替代 antd Switch。
 * 支持受控/非受控模式、自定义文案和禁用状态。
 */
class HGSwitchPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      checked: props.defaultChecked ?? false,
    };
  }

  /**
   * 获取当前受控/非受控选中状态。
   * @returns {boolean} 是否选中。
   */
  getControlledChecked = () => {
    const { checked } = this.props;
    return checked !== undefined ? checked : this.state.checked;
  };

  /**
   * 处理开关切换，通知父组件并更新内部状态。
   */
  handleToggle = () => {
    const { disabled, onChange } = this.props;
    if (disabled) return;
    const nextChecked = !this.getControlledChecked();
    this.setState({ checked: nextChecked });
    onChange?.(nextChecked);
  };

  /**
   * 渲染开关内部文案。
   * @returns {React.ReactNode} 文案节点。
   */
  renderInnerContent = () => {
    const { checkedChildren, unCheckedChildren } = this.props;
    const isChecked = this.getControlledChecked();
    const content = isChecked ? checkedChildren : unCheckedChildren;
    if (!content && content !== 0) return null;
    return (
      <span className={isChecked ? styles.textOn : styles.textOff}>
        {content}
      </span>
    );
  };

  /**
   * 渲染组件。
   * @returns {React.ReactNode} 开关节点。
   */
  render() {
    const { disabled, className } = this.props;
    const isChecked = this.getControlledChecked();

    const rootClassName = [
      styles.switchRoot,
      isChecked ? styles.switchChecked : styles.switchUnchecked,
      disabled ? styles.switchDisabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        className={rootClassName}
        onClick={this.handleToggle}
      >
        {this.renderInnerContent()}
        <span className={styles.handle} />
      </button>
    );
  }
}

export default HGSwitchPage;
