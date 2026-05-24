import React from "react";
import styles from "./hg_radio.module.css";

/**
 * 自定义单选按钮组组件：替代 antd Radio.Group。
 * 支持默认样式和按钮样式两种模式。
 */
class HGRadioGroup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.defaultValue ?? undefined,
    };
  }

  /**
   * 获取当前受控/非受控值。
   * @returns {*} 当前选中值。
   */
  getControlledValue = () => {
    const { value } = this.props;
    return value !== undefined ? value : this.state.value;
  };

  /**
   * 处理选项变更，通知父组件并更新内部状态。
   * @param {*} optionValue 选中的选项值。
   */
  handleChange = (optionValue) => {
    const { onChange } = this.props;
    this.setState({ value: optionValue });
    onChange?.(optionValue);
  };

  /**
   * 渲染默认样式单选按钮。
   * @param {Object} option 选项配置 {label, value, disabled?}。
   * @param {*} currentValue 当前选中值。
   * @returns {React.ReactNode} 单选按钮节点。
   */
  renderDefaultRadio = (option, currentValue) => {
    const isChecked = currentValue === option.value;
    const radioClassName = [
      styles.radioItem,
      isChecked ? styles.radioItemChecked : "",
      option.disabled ? styles.radioItemDisabled : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label key={String(option.value)} className={radioClassName}>
        <input
          type="radio"
          className={styles.radioInput}
          checked={isChecked}
          disabled={option.disabled}
          onChange={() => this.handleChange(option.value)}
        />
        <span className={styles.radioDot} />
        <span className={styles.radioLabel}>{option.label}</span>
      </label>
    );
  };

  /**
   * 渲染按钮样式单选按钮。
   * @param {Object} option 选项配置 {label, value, disabled?}。
   * @param {*} currentValue 当前选中值。
   * @returns {React.ReactNode} 按钮单选节点。
   */
  renderButtonRadio = (option, currentValue) => {
    const isChecked = currentValue === option.value;
    const btnClassName = [
      styles.btnItem,
      isChecked ? styles.btnItemChecked : "",
      option.disabled ? styles.btnItemDisabled : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label key={String(option.value)} className={btnClassName}>
        <input
          type="radio"
          className={styles.radioInput}
          checked={isChecked}
          disabled={option.disabled}
          onChange={() => this.handleChange(option.value)}
        />
        <span>{option.label}</span>
      </label>
    );
  };

  /**
   * 渲染组件。
   * @returns {React.ReactNode} 单选按钮组节点。
   */
  render() {
    const { options = [], optionType = "default", className } = this.props;
    const currentValue = this.getControlledValue();
    const isButton = optionType === "button";

    const rootClassName = [
      isButton ? styles.btnGroup : styles.radioGroup,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={rootClassName}>
        {options.map((option) =>
          isButton
            ? this.renderButtonRadio(option, currentValue)
            : this.renderDefaultRadio(option, currentValue)
        )}
      </div>
    );
  }
}

export default HGRadioGroup;
