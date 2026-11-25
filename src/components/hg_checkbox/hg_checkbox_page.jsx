/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/components/hg_checkbox/hg_checkbox_page.jsx
 * @Description: 自定义复选框组件，替代 antd Checkbox / Checkbox.Group，支持单选与分组多选
 */
import React from "react";
import styles from "./hg_checkbox.module.css";

/**
 * 单个复选框组件
 * Props：checked, onChange, disabled, children（标签文本）
 * 约束：受控组件，需外部管理 checked 状态
 */
/** @extends {React.Component<Partial<typeof HGCheckbox.defaultProps>>} */
class HGCheckbox extends React.Component {
  static defaultProps = {
    /** 受控勾选状态，默认 false 不勾选；变更由调用方回填。 */
    checked: false,
    /** 默认允许勾选；true 禁用交互。 */
    disabled: false,
    /** 默认可交互；true 只读展示选中状态，不接收点击或变更，视觉上保持清晰。 */
    readOnly: false,
    /** 复选框旁的标签，默认 undefined 不显示。 @type {React.ReactNode} */
    children: undefined,
    /** 勾选变化事件，可读取 event.target.checked；默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
  };

  handleChange = (e) => {
    const { onChange, disabled, readOnly } = this.props;
    if (disabled || readOnly) return;
    onChange?.(e.target.checked);
  };

  render() {
    const { checked = false, disabled = false, readOnly = false, children } = this.props;
    const rootClass = [
      styles.checkbox,
      checked ? styles.checked : "",
      disabled ? styles.disabled : "",
      readOnly ? styles.readOnly : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label className={rootClass}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={checked}
          disabled={disabled || readOnly}
          onChange={this.handleChange}
        />
        <span className={styles.checkboxInner}>
          {checked && <span className={styles.checkIcon}>✓</span>}
        </span>
        {children !== undefined && children !== null && (
          <span className={styles.checkboxLabel}>{children}</span>
        )}
      </label>
    );
  }
}

/**
 * 复选框组组件
 * Props：options（[{label, value, disabled?}]）, value（已选值数组）, onChange（值变更回调）, disabled
 * 约束：兼容 antd Checkbox.Group API，value 为 value 数组，onChange 回调 value 数组
 */
/** @extends {React.Component<Partial<typeof HGCheckboxGroup.defaultProps>>} */
class HGCheckboxGroup extends React.Component {
  static defaultProps = {
    /** 可选项，默认 []；支持值或 {label, value, disabled} 对象。 @type {Array<any>} */
    options: [],
    /** 受控已选值，默认 undefined 使用内部状态；不要以 [] 代替非受控缺省值。 @type {Array<any>|undefined} */
    value: undefined,
    /** 非受控初始勾选项，默认 []；仅初始化时读取。 @type {Array<any>} */
    defaultValue: [],
    /** 默认允许操作整组；true 禁用全部选项。 */
    disabled: false,
    /** 变化后返回已选值数组，默认 undefined 不通知。 @type {((values: Array<any>) => void)|undefined} */
    onChange: undefined,
  };

  constructor(props) {
    super(props);
    this.state = {
      innerValue: props.defaultValue || [],
    };
  }

  /**
   * 获取当前受控/非受控值。
   * @returns {Array} 当前选中值数组。
   */
  getControlledValue = () => {
    const { value } = this.props;
    return value !== undefined ? value : this.state.innerValue;
  };

  /**
   * 处理单个复选框变更：toggle value。
   * @param {*} optionValue - 被点击的选项值。
   * @param {boolean} isChecked - 是否选中。
   */
  handleChange = (optionValue, isChecked) => {
    const { onChange, disabled } = this.props;
    if (disabled) return;

    const current = this.getControlledValue();
    let next;
    if (isChecked) {
      next = [...current, optionValue];
    } else {
      next = current.filter((v) => v !== optionValue);
    }

    if (this.props.value === undefined) {
      this.setState({ innerValue: next });
    }
    onChange?.(next);
  };

  render() {
    const { options = [], disabled: groupDisabled } = this.props;
    const currentValue = this.getControlledValue();

    return (
      <div className={styles.checkboxGroup}>
        {options.map((opt) => {
          const isChecked = currentValue.includes(opt.value);
          const isDisabled = groupDisabled || opt.disabled;
          return (
            <HGCheckbox
              key={String(opt.value)}
              checked={isChecked}
              disabled={isDisabled}
              onChange={(checked) => this.handleChange(opt.value, checked)}
            >
              {opt.label}
            </HGCheckbox>
          );
        })}
      </div>
    );
  }
}

export { HGCheckbox, HGCheckboxGroup };
export default HGCheckboxGroup;
