import React from "react";
import styles from "./hg_input_number.module.css";

/**
 * 数字输入组件，兼容 antd InputNumber 主要 props。
 * 支持 min、max、step、disabled、placeholder 等属性。
 */
class HGInputNumberPage extends React.PureComponent {
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
