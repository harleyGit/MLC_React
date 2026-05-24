import React from "react";
import styles from "./hg_input.module.css";

/**
 * 基础输入框组件，兼容 antd Input 主要 props。
 * 支持 prefix、allowClear、maxLength 等属性。
 */
class HGInputPage extends React.PureComponent {
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
  static getDerivedStateFromProps(nextProps, prevState) {
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

  render() {
    const { placeholder, disabled, className = "", style, prefix } = this.props;
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
          placeholder={placeholder}
          disabled={disabled}
          onChange={this.handleChange}
          onFocus={() => this.setState({ focused: true })}
          onBlur={() => this.setState({ focused: false })}
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
class HGInputPassword extends React.PureComponent {
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

  render() {
    const { placeholder, disabled, prefix, className = "", style } = this.props;
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
          placeholder={placeholder}
          disabled={disabled}
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
class HGInputSearch extends React.PureComponent {
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

  render() {
    const { placeholder, disabled, allowClear, className = "", style, enterButton } = this.props;
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
class HGInputTextArea extends React.PureComponent {
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
