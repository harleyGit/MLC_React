/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_input_number/hg_input_number_page.jsx
 * @Description: 数字输入组件，兼容 antd InputNumber 主要 props
 */

import React from "react";
import styles from "./hg_input_number.module.css";

/**
 * 数字输入组件，兼容 antd InputNumber 主要 props。
 * 支持 min、max、step、disabled、placeholder 等属性。
 */
/** @extends {React.PureComponent<Partial<typeof HGInputNumberPage.defaultProps>>} */
class HGInputNumberPage extends React.PureComponent {
  static defaultProps = {
    /** 受控数值，默认 undefined 使用内部状态；清空可传 null。 @type {number|null|undefined} */
    value: undefined,
    /** 非受控初始数值，默认 undefined 由既有初始化逻辑留空。 @type {number|undefined} */
    defaultValue: undefined,
    /** 下限，默认 undefined 不限制。 @type {number|undefined} */
    min: undefined,
    /** 上限，默认 undefined 不限制。 @type {number|undefined} */
    max: undefined,
    /** 加减按钮步长，默认 1；单位与输入数值一致。 */
    step: 1,
    /** 变化返回数值或清空值，默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
    /** 默认可编辑；true 禁用输入和加减按钮。 */
    disabled: false,
    /** 空值占位文案，默认 undefined。 @type {string|undefined} */
    placeholder: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 根节点行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    const hasValue = props.value !== undefined;
    this.state = {
      focused: false,
      innerValue: hasValue ? undefined : (props.defaultValue ?? ""),
    };
  }

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.value !== undefined) {
      return { innerValue: nextProps.value };
    }
    return null;
  }

  /**
   * 获取当前值。
   * @returns {number|string} 当前数值。
   */
  getValue = () => {
    const { value } = this.props;
    if (value !== undefined) return value;
    return this.state.innerValue;
  };

  /**
   * 将值限制在 min/max 范围内。
   * @param {number} num - 原始数值。
   * @returns {number} 限制后的数值。
   */
  clampValue = (num) => {
    const { min, max } = this.props;
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    return num;
  };

  /**
   * 触发 onChange 回调，同步内部状态。
   * @param {number|string} newVal - 新值。
   */
  triggerChange = (newVal) => {
    const { onChange, value } = this.props;
    if (value === undefined) {
      this.setState({ innerValue: newVal });
    }
    if (onChange) {
      onChange(newVal);
    }
  };

  /**
   * 处理输入变化，解析为数值。
   * @param {React.ChangeEvent} e - 输入事件。
   */
  handleChange = (e) => {
    const raw = e.target.value;
    if (raw === "" || raw === "-" || raw === ".") {
      this.triggerChange(raw);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      this.triggerChange(num);
    }
  };

  /**
   * 失焦时将值 clamp 到合法范围。
   */
  handleBlur = () => {
    this.setState({ focused: false });
    const val = this.getValue();
    if (val !== "" && val !== undefined) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const clamped = this.clampValue(num);
        if (clamped !== val) {
          this.triggerChange(clamped);
        }
      }
    }
  };

  /**
   * 步进增加。
   */
  handleStepUp = () => {
    const { step = 1 } = this.props;
    const val = parseFloat(this.getValue()) || 0;
    const next = this.clampValue(val + step);
    this.triggerChange(next);
  };

  /**
   * 步进减少。
   */
  handleStepDown = () => {
    const { step = 1 } = this.props;
    const val = parseFloat(this.getValue()) || 0;
    const next = this.clampValue(val - step);
    this.triggerChange(next);
  };

  /**
   * 渲染步进按钮。
   * @returns {React.ReactNode} 步进按钮组。
   */
  renderControls = () => {
    const { disabled } = this.props;
    return (
      <div className={styles.controls}>
        <button
          className={styles.stepBtn}
          type="button"
          disabled={disabled}
          onClick={this.handleStepUp}
          aria-label="增加"
        >
          ▲
        </button>
        <button
          className={styles.stepBtn}
          type="button"
          disabled={disabled}
          onClick={this.handleStepDown}
          aria-label="减少"
        >
          ▼
        </button>
      </div>
    );
  };

  /**
   * 渲染数字输入框 DOM 结构。
   * 职责：组装 wrapper、input、步进按钮（增/减）。
   * 输入：placeholder、disabled、style、className 等 props。
   * 输出：React 节点。
   * 约束：失焦时自动 clamp 到 min/max 范围；步进值由 step prop 控制。
   */
  render() {
    const { placeholder, disabled, style, className = "" } = this.props;
    const { focused } = this.state;
    const val = this.getValue();

    const wrapperClass = [
      styles.wrapper,
      focused ? styles.focused : "",
      disabled ? styles.disabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={wrapperClass} style={style}>
        <input
          ref={this.inputRef}
          className={styles.input}
          type="text"
          inputMode="decimal"
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          onChange={this.handleChange}
          onFocus={() => this.setState({ focused: true })}
          onBlur={this.handleBlur}
        />
        {this.renderControls()}
      </div>
    );
  }
}

export default HGInputNumberPage;
