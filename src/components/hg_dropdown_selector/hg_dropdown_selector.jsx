import React from "react";
import styles from "./hg_dropdown_selector.module.css";

/**
 * 下拉选择框组件：支持单选/多选，点击展开列表，选中项显示在顶部。
 * @param {Object} props
 * @param {Array<{value: string, label: string}>} props.options 可选项列表。
 * @param {string|string[]} props.value 当前选中值（单选为 string，多选为 string[]）。
 * @param {boolean} props.multiple 是否多选，默认 false。
 * @param {string} props.placeholder 未选中时的占位文案。
 * @param {boolean} props.disabled 是否禁用。
 * @param {Function} props.onChange 选中变化回调。
 */
class HGDropdownSelector extends React.Component {
  /**
   * 构造函数：初始化下拉展开状态。
   * @param {Object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
    this.containerRef = React.createRef();
  }

  /**
   * 生命周期挂载：监听外部点击以关闭下拉。
   */
  componentDidMount() {
    document.addEventListener("mousedown", this.handleOutsideClick);
  }

  /**
   * 生命周期卸载：移除外部点击监听。
   */
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleOutsideClick);
  }

  /**
   * 处理外部点击：点击组件外部时关闭下拉。
   * @param {MouseEvent} event 鼠标事件。
   */
  handleOutsideClick = (event) => {
    if (
      this.containerRef.current &&
      !this.containerRef.current.contains(event.target)
    ) {
      this.setState({ open: false });
    }
  };

  /**
   * 切换下拉展开/收起。
   * 约束：禁用状态下不响应。
   */
  toggleDropdown = () => {
    if (this.props.disabled) return;
    this.setState((prev) => ({ open: !prev.open }));
  };

  /**
   * 处理选项点击。
   * @param {string} optionValue 被点击的选项值。
   * 约束：多选模式切换选中状态，单选模式直接选中并关闭。
   */
  handleOptionClick = (optionValue) => {
    const { value, multiple, onChange } = this.props;
    if (!onChange) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((v) => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      this.setState({ open: false });
    }
  };

  /**
   * 判断某个选项是否被选中。
   * @param {string} optionValue 选项值。
   * @returns {boolean} 是否选中。
   */
  isSelected = (optionValue) => {
    const { value, multiple } = this.props;
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  /**
   * 获取顶部显示文案。
   * @returns {string} 已选内容文案或占位符。
   */
  getDisplayText = () => {
    const { value, multiple, options, placeholder } = this.props;
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.length === 0) return placeholder || "请选择";
      return currentValues
        .map((v) => {
          const opt = options.find((o) => o.value === v);
          return opt ? opt.label : v;
        })
        .join("、");
    }
    if (!value) return placeholder || "请选择";
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : value;
  };

  /**
   * 渲染下拉选项列表。
   * @returns {React.ReactNode} 选项列表 JSX。
   */
  renderOptions = () => {
    const { options } = this.props;
    const { open } = this.state;
    if (!open) return null;

    return (
      <div className={styles.dropdownList}>
        {options.map((option) => {
          const selected = this.isSelected(option.value);
          return (
            <div
              key={option.value}
              className={`${styles.dropdownItem} ${selected ? styles.dropdownItemActive : ""}`}
              onClick={() => this.handleOptionClick(option.value)}
            >
              <span>{option.label}</span>
              {selected ? <span className={styles.checkIcon}>✓</span> : null}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 组件主渲染：顶部选择框 + 下拉列表。
   * @returns {React.ReactNode} 下拉选择器 JSX。
   */
  render() {
    const { disabled } = this.props;
    const { open } = this.state;

    return (
      <div className={styles.container} ref={this.containerRef}>
        <div
          className={`${styles.selector} ${open ? styles.selectorOpen : ""} ${
            disabled ? styles.selectorDisabled : ""
          }`}
          onClick={this.toggleDropdown}
        >
          <span className={styles.displayText}>{this.getDisplayText()}</span>
          <span className={`${styles.arrow} ${open ? styles.arrowUp : ""}`}>▾</span>
        </div>
        {this.renderOptions()}
      </div>
    );
  }
}

export default HGDropdownSelector;
