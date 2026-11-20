/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_input/hg_input_page.jsx
 * @Description: 输入框组件集，包含基础输入、密码输入、搜索输入、多行文本输入
 */

import React from "react";
import styles from "./hg_input.module.css";

/**
 * 基础输入框组件，兼容 antd Input 主要 props。
 * 支持 prefix、allowClear、maxLength 等属性。
 */
/** @extends {React.PureComponent<Partial<typeof HGInputPage.defaultProps>>} */
class HGInputPage extends React.PureComponent {
  static defaultProps = {
    /** 受控文本，默认 undefined 使用内部值；不能设为 ""，否则会锁定非受控输入。 @type {string|undefined} */
    value: undefined,
    /** 非受控初始文本，默认空字符串；后续修改请使用 value。 */
    defaultValue: "",
    /** 文本变化事件，读取 event.target.value；默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
    /** 聚焦通知，默认 undefined。 @type {React.FocusEventHandler<HTMLInputElement>|undefined} */
    onFocus: undefined,
    /** 失焦通知，默认 undefined。 @type {React.FocusEventHandler<HTMLInputElement>|undefined} */
    onBlur: undefined,
    /** 按键通知，默认 undefined；业务可处理回车和候选项导航。 @type {React.KeyboardEventHandler<HTMLInputElement>|undefined} */
    onKeyDown: undefined,
    /** 最大字符数，默认 undefined 不截断且不显示计数。 @type {number|undefined} */
    maxLength: undefined,
    /** 默认不显示清除按钮；true 且有值时允许清空。 */
    allowClear: false,
    /** 默认可输入；true 禁用输入与清除。 */
    disabled: false,
    /** 输入前缀节点，默认 undefined 不占位。 @type {React.ReactNode} */
    prefix: undefined,
    /** 空值占位文字，默认 undefined 不显示。 @type {string|undefined} */
    placeholder: undefined,
    /** 原生表单字段名，默认 undefined；由业务指定。 @type {string|undefined} */
    name: undefined,
    /** 浏览器自动填充标记，默认 undefined 使用浏览器行为。 @type {string|undefined} */
    autoComplete: undefined,
    /** 输入框辅助技术角色，默认 undefined 使用原生语义。 @type {React.AriaRole|undefined} */
    role: undefined,
    /** 自动补全方式，默认 undefined 不声明候选补全。 @type {React.AriaAttributes['aria-autocomplete']} */
    "aria-autocomplete": undefined,
    /** 受控候选列表的 DOM id，默认 undefined 无关联。 @type {string|undefined} */
    "aria-controls": undefined,
    /** 候选列表展开状态，默认 undefined 不声明展开关系。 @type {React.AriaAttributes['aria-expanded']} */
    "aria-expanded": undefined,
    /** 当前键盘选中候选项的 DOM id，默认 undefined 无激活项。 @type {string|undefined} */
    "aria-activedescendant": undefined,
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
      innerValue: hasValue ? undefined : (props.defaultValue || ""),
    };
  }

  /**
   * 受控模式下同步 innerValue。
   */
  static getDerivedStateFromProps(nextProps) {
    if (nextProps.value !== undefined) {
      return { innerValue: nextProps.value };
    }
    return null;
  }

  /**
   * 获取当前显示值。
   * @returns {string} 当前输入值。
   */
  getValue = () => {
    const { value } = this.props;
    if (value !== undefined) return value;
    return this.state.innerValue;
  };

  /**
   * 处理输入变化。
   * @param {React.ChangeEvent} e - 输入事件。
   */
  handleChange = (e) => {
    const { onChange, maxLength } = this.props;
    let val = e.target.value;
    if (maxLength !== undefined && val.length > maxLength) {
      val = val.slice(0, maxLength);
    }
    if (this.props.value === undefined) {
      this.setState({ innerValue: val });
    }
    if (onChange) {
      onChange({ ...e, target: { ...e.target, value: val } });
    }
  };

  /**
   * 清空输入内容。
   */
  handleClear = () => {
    const { onChange } = this.props;
    if (this.props.value === undefined) {
      this.setState({ innerValue: "" });
    }
    if (onChange) {
      onChange({ target: { value: "" } });
    }
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  /**
   * 同步输入框聚焦状态，并把原生事件继续交给业务组件。
   * @param {React.FocusEvent} e - 输入框聚焦事件。
   * @returns {void}
   */
  handleFocus = (e) => {
    this.setState({ focused: true });
    this.props.onFocus?.(e);
  };

  /**
   * 同步输入框失焦状态，并把原生事件继续交给业务组件。
   * @param {React.FocusEvent} e - 输入框失焦事件。
   * @returns {void}
   */
  handleBlur = (e) => {
    this.setState({ focused: false });
    this.props.onBlur?.(e);
  };

  /**
   * 渲染前缀图标/文本。
   * @returns {React.ReactNode} prefix 节点或 null。
   */
  renderPrefix = () => {
    const { prefix } = this.props;
    if (!prefix) return null;
    return <span className={styles.prefix}>{prefix}</span>;
  };

  /**
   * 渲染清除按钮。
   * @returns {React.ReactNode} 清除按钮或 null。
   */
  renderClearIcon = () => {
    const { allowClear, disabled } = this.props;
    if (!allowClear || disabled) return null;
    const val = this.getValue();
    if (!val) return null;
    return (
      <span className={styles.clearIcon} onClick={this.handleClear} role="button" aria-label="清除">
        ✕
      </span>
    );
  };

  /**
   * 渲染字数统计。
   * @returns {React.ReactNode} 字数统计节点或 null。
   */
  renderCount = () => {
    const { maxLength } = this.props;
    if (maxLength === undefined) return null;
    const val = this.getValue() || "";
    return (
      <span className={styles.count}>
        {val.length}/{maxLength}
      </span>
    );
  };

  /**
   * 渲染基础输入框 DOM 结构。
   * 职责：组装 wrapper、prefix、input、清除按钮、字数统计。
   * 输入：placeholder、disabled、className、style、prefix 等 props。
   * 输出：React 节点。
   * 约束：受控/非受控模式均支持；maxLength 限制输入长度。
   */
  render() {
    const {
      placeholder,
      disabled,
      className = "",
      style,
      prefix,
      name,
      autoComplete,
      onKeyDown,
      role,
    } = this.props;
    const { focused } = this.state;
    const val = this.getValue();

    const wrapperClass = [
      styles.wrapper,
      focused ? styles.focused : "",
      disabled ? styles.disabled : "",
      prefix ? styles.hasPrefix : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={wrapperClass} style={style}>
        {this.renderPrefix()}
        <input
          ref={this.inputRef}
          className={styles.input}
          value={val}
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          role={role}
          aria-autocomplete={this.props["aria-autocomplete"]}
          aria-controls={this.props["aria-controls"]}
          aria-expanded={this.props["aria-expanded"]}
          aria-activedescendant={this.props["aria-activedescendant"]}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          onKeyDown={onKeyDown}
        />
        {this.renderClearIcon()}
        {this.renderCount()}
      </div>
    );
  }
}

/**
 * 密码输入组件，支持可见性切换。
 */
/** @extends {React.PureComponent<Partial<typeof HGInputPassword.defaultProps>>} */
class HGInputPassword extends React.PureComponent {
  static defaultProps = {
    /** 受控密码，默认 undefined 使用内部值；缺省不切换为受控模式。 @type {string|undefined} */
    value: undefined,
    /** 非受控初始密码，默认空字符串，仅初始化读取。 */
    defaultValue: "",
    /** 原生输入变化事件，默认 undefined 不通知。 @type {React.ChangeEventHandler<HTMLInputElement>|undefined} */
    onChange: undefined,
    /** 默认可输入；true 禁用原生输入。 */
    disabled: false,
    /** 密码框前缀节点，默认 undefined 不展示。 @type {React.ReactNode} */
    prefix: undefined,
    /** 空值占位文案，默认 undefined 不展示。 @type {string|undefined} */
    placeholder: undefined,
    /** 原生字段名，默认 undefined；供表单和密码管理器识别。 @type {string|undefined} */
    name: undefined,
    /** 密码管理器提示，如 current-password/new-password；默认 undefined。 @type {string|undefined} */
    autoComplete: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 根节点行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.state = {
      visible: false,
      focused: false,
      innerValue: props.value !== undefined ? undefined : (props.defaultValue || ""),
    };
  }

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.value !== undefined) {
      return { innerValue: nextProps.value };
    }
    return null;
  }

  getValue = () => {
    const { value } = this.props;
    if (value !== undefined) return value;
    return this.state.innerValue;
  };

  handleChange = (e) => {
    const { onChange } = this.props;
    const val = e.target.value;
    if (this.props.value === undefined) {
      this.setState({ innerValue: val });
    }
    if (onChange) {
      onChange(e);
    }
  };

  toggleVisible = () => {
    this.setState((prev) => ({ visible: !prev.visible }));
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  /**
   * 把焦点移入原生密码输入框，供账号切换后触发浏览器密码管理器。
   * @returns {void}
   */
  focus = () => {
    this.inputRef.current?.focus();
  };

  /**
   * 渲染密码可见性切换按钮。
   * @returns {React.ReactNode} 切换按钮。
   */
  renderToggle = () => {
    const { visible } = this.state;
    return (
      <span className={styles.toggleBtn} onClick={this.toggleVisible} role="button" aria-label={visible ? "隐藏密码" : "显示密码"}>
        {visible ? "🙈" : "👁"}
      </span>
    );
  };

  /**
   * 渲染密码输入框 DOM 结构。
   * 职责：组装 wrapper、prefix、input（密码/明文切换）、可见性切换按钮。
   * 输入：placeholder、disabled、prefix、className、style 等 props。
   * 输出：React 节点。
   * 约束：受控/非受控模式均支持；通过 visible 状态控制 input type。
   */
  render() {
    const {
      placeholder,
      disabled,
      prefix,
      className = "",
      style,
      name,
      autoComplete,
    } = this.props;
    const { visible, focused } = this.state;
    const val = this.getValue();

    const wrapperClass = [
      styles.wrapper,
      focused ? styles.focused : "",
      disabled ? styles.disabled : "",
      prefix ? styles.hasPrefix : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={wrapperClass} style={style}>
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <input
          ref={this.inputRef}
          className={styles.input}
          type={visible ? "text" : "password"}
          value={val}
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={this.handleChange}
          onFocus={() => this.setState({ focused: true })}
          onBlur={() => this.setState({ focused: false })}
        />
        {this.renderToggle()}
      </div>
    );
  }
}

/**
 * 搜索输入组件，支持 onSearch 回车搜索和清除。
 */
/** @extends {React.PureComponent<Partial<typeof HGInputSearch.defaultProps>>} */
class HGInputSearch extends React.PureComponent {
  static defaultProps = {
    /** 受控搜索词，默认 undefined 使用内部值。 @type {string|undefined} */
    value: undefined,
    /** 非受控初始搜索词，默认空字符串，仅初始化读取。 */
    defaultValue: "",
    /** 输入变化事件，默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
    /** 回车、搜索按钮或清空时返回搜索词，默认 undefined 不执行搜索。 @type {((value: string) => void)|undefined} */
    onSearch: undefined,
    /** 默认不显示搜索按钮；true 显示“搜索”，节点可自定义按钮内容。 @type {React.ReactNode} */
    enterButton: false,
    /** 默认不显示清除入口；true 且有值时可清空并触发空词搜索。 */
    allowClear: false,
    /** 默认可输入；true 禁用输入和搜索按钮。 */
    disabled: false,
    /** 空搜索词占位文案，默认 undefined。 @type {string|undefined} */
    placeholder: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 根节点行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.state = {
      focused: false,
      innerValue: props.value !== undefined ? undefined : (props.defaultValue || ""),
    };
  }

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.value !== undefined) {
      return { innerValue: nextProps.value };
    }
    return null;
  }

  getValue = () => {
    const { value } = this.props;
    if (value !== undefined) return value;
    return this.state.innerValue;
  };

  handleChange = (e) => {
    const { onChange } = this.props;
    const val = e.target.value;
    if (this.props.value === undefined) {
      this.setState({ innerValue: val });
    }
    if (onChange) {
      onChange(e);
    }
  };

  handleClear = () => {
    const { onChange, onSearch } = this.props;
    if (this.props.value === undefined) {
      this.setState({ innerValue: "" });
    }
    if (onChange) {
      onChange({ target: { value: "" } });
    }
    if (onSearch) {
      onSearch("");
    }
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  handleKeyDown = (e) => {
    const { onSearch } = this.props;
    if (e.key === "Enter" && onSearch) {
      onSearch(this.getValue() || "");
    }
  };

  /**
   * 渲染搜索按钮。
   * @returns {React.ReactNode} 搜索按钮。
   */
  renderSearchButton = () => {
    const { enterButton, disabled } = this.props;
    if (!enterButton) return null;
    const label = enterButton === true ? "搜索" : enterButton;
    return (
      <button
        className={styles.searchBtn}
        type="button"
        disabled={disabled}
        onClick={() => {
          const { onSearch } = this.props;
          if (onSearch) onSearch(this.getValue() || "");
        }}
      >
        {label}
      </button>
    );
  };

  /**
   * 渲染搜索输入框 DOM 结构。
   * 职责：组装 wrapper、input、清除按钮、搜索按钮。
   * 输入：placeholder、disabled、allowClear、className、style、enterButton 等 props。
   * 输出：React 节点。
   * 约束：回车触发 onSearch；allowClear 为 true 时显示清除按钮。
   */
  render() {
    const { placeholder, disabled, allowClear, className = "", style } = this.props;
    const { focused } = this.state;
    const val = this.getValue();

    const wrapperClass = [
      styles.wrapper,
      styles.searchWrapper,
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
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          onFocus={() => this.setState({ focused: true })}
          onBlur={() => this.setState({ focused: false })}
        />
        {allowClear && val ? (
          <span className={styles.clearIcon} onClick={this.handleClear} role="button" aria-label="清除">
            ✕
          </span>
        ) : null}
        {this.renderSearchButton()}
      </div>
    );
  }
}

/**
 * 多行文本输入组件。
 */
/** @extends {React.PureComponent<Partial<typeof HGInputTextArea.defaultProps>>} */
class HGInputTextArea extends React.PureComponent {
  static defaultProps = {
    /** 受控正文，默认 undefined 使用内部文本，不改变非受控语义。 @type {string|undefined} */
    value: undefined,
    /** 非受控初始正文，默认空字符串，仅初始化读取。 */
    defaultValue: "",
    /** 文本变化事件，读取 event.target.value；默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
    /** 最大字符数，默认 undefined 不截断且不显示字数统计。 @type {number|undefined} */
    maxLength: undefined,
    /** 默认显示 4 行；实际高度仍可由样式覆盖。 */
    rows: 4,
    /** 默认可输入；true 禁用正文编辑。 */
    disabled: false,
    /** 空正文占位文案，默认 undefined。 @type {string|undefined} */
    placeholder: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 根节点行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  constructor(props) {
    super(props);
    this.textareaRef = React.createRef();
    this.state = {
      focused: false,
      innerValue: props.value !== undefined ? undefined : (props.defaultValue || ""),
    };
  }

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.value !== undefined) {
      return { innerValue: nextProps.value };
    }
    return null;
  }

  getValue = () => {
    const { value } = this.props;
    if (value !== undefined) return value;
    return this.state.innerValue;
  };

  handleChange = (e) => {
    const { onChange, maxLength } = this.props;
    let val = e.target.value;
    if (maxLength !== undefined && val.length > maxLength) {
      val = val.slice(0, maxLength);
    }
    if (this.props.value === undefined) {
      this.setState({ innerValue: val });
    }
    if (onChange) {
      onChange({ ...e, target: { ...e.target, value: val } });
    }
  };

  /**
   * 渲染字数统计。
   * @returns {React.ReactNode} 字数统计节点或 null。
   */
  renderCount = () => {
    const { maxLength } = this.props;
    if (maxLength === undefined) return null;
    const val = this.getValue() || "";
    return (
      <span className={styles.count}>
        {val.length}/{maxLength}
      </span>
    );
  };

  /**
   * 渲染多行文本输入框 DOM 结构。
   * 职责：组装 wrapper、textarea、字数统计。
   * 输入：placeholder、disabled、rows、className、style 等 props。
   * 输出：React 节点。
   * 约束：maxLength 限制输入长度；rows 控制默认行数。
   */
  render() {
    const { placeholder, disabled, rows = 4, className = "", style } = this.props;
    const { focused } = this.state;
    const val = this.getValue();

    const wrapperClass = [
      styles.wrapper,
      styles.textareaWrapper,
      focused ? styles.focused : "",
      disabled ? styles.disabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={wrapperClass} style={style}>
        <textarea
          ref={this.textareaRef}
          className={styles.textarea}
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          onChange={this.handleChange}
          onFocus={() => this.setState({ focused: true })}
          onBlur={() => this.setState({ focused: false })}
        />
        {this.renderCount()}
      </div>
    );
  }
}

export default HGInputPage;
export { HGInputPassword, HGInputSearch, HGInputTextArea };
