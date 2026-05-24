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
class HGCheckbox extends React.Component {
  handleChange = (e) => {
    const { onChange, disabled } = this.props;
    if (disabled) return;
    onChange?.(e.target.checked);
  };

  render() {
    const { checked = false, disabled = false, children } = this.props;
    const rootClass = [
      styles.checkbox,
      checked ? styles.checked : "",
      disabled ? styles.disabled : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label className={rootClass}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={checked}
          disabled={disabled}
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
class HGCheckboxGroup extends React.Component {
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
