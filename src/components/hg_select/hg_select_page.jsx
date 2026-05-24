/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_select/hg_select_page.jsx
 * @Description: 自定义下拉选择组件，兼容 antd Select 主要 props
 */

import React from "react";
import styles from "./hg_select.module.css";

/**
 * 自定义下拉选择组件：替代 antd Select，支持原生 select 样式化。
 * Props 兼容 antd Select 接口。
 */
class HGSelectPage extends React.Component {
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
   * 处理值变更，通知父组件并更新内部状态。
   * @param {Event} event 原生 select change 事件。
   */
  handleChange = (event) => {
    const { onChange, options } = this.props;
    const rawValue = event.target.value;
    const matchedOption = (options || []).find(
      (opt) => String(opt.value) === rawValue
    );
    const nextValue = matchedOption ? matchedOption.value : rawValue;
    this.setState({ value: nextValue });
    onChange?.(nextValue);
  };

  /**
   * 处理清除操作，重置为 undefined 并通知父组件。
   */
  handleClear = () => {
    const { onChange } = this.props;
    this.setState({ value: undefined });
    onChange?.(undefined);
  };

  /**
   * 渲染清除按钮。
   * @returns {React.ReactNode} 清除按钮节点。
   */
  renderClearButton = () => {
    const { allowClear, disabled } = this.props;
    const currentValue = this.getControlledValue();
    if (!allowClear || disabled || currentValue === undefined || currentValue === null) {
      return null;
    }
    return (
      <span
        className={styles.clearBtn}
        onClick={(e) => {
          e.stopPropagation();
          this.handleClear();
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        ×
      </span>
    );
  };

  /**
   * 渲染组件。
   * @returns {React.ReactNode} 选择器节点。
   */
  render() {
    const {
      options = [],
      placeholder,
      disabled,
      style,
      className,
    } = this.props;
    const currentValue = this.getControlledValue();
    const hasValue = currentValue !== undefined && currentValue !== null;

    const rootClassName = [
      styles.selectWrapper,
      disabled ? styles.disabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={rootClassName} style={style}>
        <select
          className={styles.selectControl}
          value={hasValue ? String(currentValue) : ""}
          disabled={disabled}
          onChange={this.handleChange}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={String(opt.value)}
              value={String(opt.value)}
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {this.renderClearButton()}
        <span className={styles.arrowIcon} />
      </div>
    );
  }
}

export default HGSelectPage;
