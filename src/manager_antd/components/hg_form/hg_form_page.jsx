/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_form/hg_form_page.jsx
 * @Description: 自定义表单容器与表单项组件，替代 antd Form，支持校验、布局与受控字段管理
 */
import React, { createContext } from "react";
import styles from "./hg_form.module.css";

const FormContext = createContext(null);

/**
 * 校验单条规则。
 * @param {*} value - 字段当前值。
 * @param {Object} rule - 校验规则。
 * @returns {string|null} 错误信息，通过返回 null。
 */
function validateRule(value, rule) {
  const isEmpty = value === undefined || value === null || value === "";

  if (rule.required && isEmpty) {
    return rule.message || "此字段为必填项";
  }

  if (isEmpty) {
    return null;
  }

  if (rule.pattern && typeof value === "string" && !rule.pattern.test(value)) {
    return rule.message || "格式不正确";
  }

  if (rule.min !== undefined && typeof value === "string" && value.length < rule.min) {
    return rule.message || `最少输入 ${rule.min} 个字符`;
  }

  if (rule.max !== undefined && typeof value === "string" && value.length > rule.max) {
    return rule.message || `最多输入 ${rule.max} 个字符`;
  }

  if (rule.type === "email" && typeof value === "string") {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(value)) {
      return rule.message || "请输入有效的邮箱地址";
    }
  }

  if (rule.type === "url" && typeof value === "string") {
    try {
      new URL(value);
    } catch {
      return rule.message || "请输入有效的 URL";
    }
  }

  if (rule.type === "number" && isNaN(Number(value))) {
    return rule.message || "请输入有效的数字";
  }

  return null;
}

/**
 * 校验字段所有规则。
 * @param {*} value - 字段值。
 * @param {Array} rules - 规则数组。
 * @returns {string|null} 第一条未通过的错误信息，全部通过返回 null。
 */
function validateFieldRules(value, rules) {
  if (!rules || rules.length === 0) {
    return null;
  }
  for (let i = 0; i < rules.length; i++) {
    const err = validateRule(value, rules[i]);
    if (err) {
      return err;
    }
  }
  return null;
}

/**
 * 自定义表单容器组件，兼容 antd Form 主要 props。
 * 通过 ref 暴露 getFieldsValue / getFieldValue / setFieldsValue / resetFields / validateFields 方法。
 * 支持 layout、size、initialValues、onFinish 等属性。
 */
class HGFormPage extends React.Component {
  constructor(props) {
    super(props);
    this.fields = {};
    this.state = {
      values: { ...(props.initialValues || {}) },
      errors: {},
    };
  }

  /**
   * 注册表单项字段。
   * @param {string} name - 字段名。
   * @param {Object} config - 字段配置（rules、valuePropName 等）。
   */
  registerField = (name, config) => {
    this.fields[name] = config;
  };

  /**
   * 注销表单项字段。
   * @param {string} name - 字段名。
   */
  unregisterField = (name) => {
    delete this.fields[name];
  };

  /**
   * 更新字段值并清除对应错误。
   * @param {string} name - 字段名。
   * @param {*} value - 新值。
   */
  setFieldValue = (name, value) => {
    this.setState((prev) => ({
      values: { ...prev.values, [name]: value },
      errors: { ...prev.errors, [name]: null },
    }));
  };

  /**
   * 获取所有字段值。
   * @returns {Object} 字段值对象。
   */
  getFieldsValue = () => {
    return { ...this.state.values };
  };

  /**
   * 获取单个字段值。
   * @param {string} name - 字段名。
   * @returns {*} 字段值。
   */
  getFieldValue = (name) => {
    return this.state.values[name];
  };

  /**
   * 批量设置字段值。
   * @param {Object} newValues - 字段值对象。
   */
  setFieldsValue = (newValues) => {
    this.setState((prev) => ({
      values: { ...prev.values, ...newValues },
    }));
  };

  /**
   * 重置所有字段为初始值并清除错误。
   */
  resetFields = () => {
    this.setState({
      values: { ...(this.props.initialValues || {}) },
      errors: {},
    });
  };

  /**
   * 校验所有字段。
   * @returns {Promise<Object>} 校验通过 resolve 字段值，校验失败 reject 错误信息。
   */
  validateFields = () => {
    return new Promise((resolve, reject) => {
      const { values } = this.state;
      const newErrors = {};
      let hasError = false;

      Object.keys(this.fields).forEach((name) => {
        const config = this.fields[name];
        const rules = config?.rules || [];
        const err = validateFieldRules(values[name], rules);
        if (err) {
          newErrors[name] = err;
          hasError = true;
        }
      });

      if (hasError) {
        this.setState({ errors: newErrors });
        reject(newErrors);
      } else {
        resolve({ ...values });
      }
    });
  };

  /**
   * 处理表单提交事件，阻止默认行为后执行校验。
   * @param {React.FormEvent} e - 表单事件。
   */
  handleSubmit = (e) => {
    e.preventDefault();
    this.validateFields()
      .then((vals) => {
        this.props.onFinish?.(vals);
      })
      .catch(() => {});
  };

  /**
   * 获取表单根节点 className。
   * @returns {string} 组合后的 className。
   */
  getFormClassName = () => {
    const { layout = "vertical", size = "middle", name, className = "" } = this.props;
    return [
      styles.form,
      styles[`layout-${layout}`],
      styles[`size-${size}`],
      name ? styles[`name-${name}`] : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * 获取 context 值，供 FormItem 消费。
   * @returns {Object} context 对象。
   */
  getContextValue = () => {
    return {
      values: this.state.values,
      errors: this.state.errors,
      registerField: this.registerField,
      unregisterField: this.unregisterField,
      setFieldValue: this.setFieldValue,
    };
  };

  /**
   * 渲染表单组件。
   * @returns {React.ReactNode} 表单节点。
   */
  render() {
    const { children, style } = this.props;

    return (
      <FormContext.Provider value={this.getContextValue()}>
        <form className={this.getFormClassName()} style={style} onSubmit={this.handleSubmit} noValidate>
          {children}
        </form>
      </FormContext.Provider>
    );
  }
}

/**
 * 表单项组件，配合 HGFormPage 使用。
 * 通过 Context 与父表单通信，自动注入 value / onChange，支持校验规则与错误展示。
 */
class HGFormItem extends React.Component {
  static contextType = FormContext;

  constructor(props) {
    super(props);
    this.state = {
      touched: false,
    };
  }

  /**
   * 挂载时向父表单注册字段。
   */
  componentDidMount() {
    const { name, rules } = this.props;
    if (name && this.context) {
      this.context.registerField(name, { rules });
    }
  }

  /**
   * 更新时同步规则到父表单。
   */
  componentDidUpdate(prevProps) {
    const { name, rules } = this.props;
    if (name && this.context && prevProps.rules !== rules) {
      this.context.registerField(name, { rules });
    }
  }

  /**
   * 卸载时注销字段。
   */
  componentWillUnmount() {
    const { name } = this.props;
    if (name && this.context) {
      this.context.unregisterField(name);
    }
  }

  /**
   * 处理字段值变更。
   * @param {*} value - 新值。
   */
  handleChange = (value) => {
    const { name } = this.props;
    if (name && this.context) {
      this.context.setFieldValue(name, value);
    }
    this.setState({ touched: true });
  };

  /**
   * 获取当前字段值。
   * @returns {*} 字段值。
   */
  getValue = () => {
    const { name, initialValue } = this.props;
    if (!name || !this.context) {
      return initialValue;
    }
    const val = this.context.values[name];
    return val !== undefined ? val : initialValue;
  };

  /**
   * 获取当前字段错误信息。
   * @returns {string|null} 错误信息。
   */
  getError = () => {
    const { name } = this.props;
    if (!name || !this.context) {
      return null;
    }
    return this.context.errors[name] || null;
  };

  /**
   * 克隆子元素并注入受控属性。
   * @returns {React.ReactNode} 注入 value/onChange 的子元素。
   */
  renderControl = () => {
    const { children, valuePropName = "value", name } = this.props;
    const value = this.getValue();

    if (!React.isValidElement(children)) {
      return children;
    }

    const childProps = {
      [valuePropName]: value,
      onChange: (...args) => {
        const childOnChange = children.props.onChange;
        if (valuePropName === "checked") {
          this.handleChange(args[0]);
          childOnChange?.(args[0]);
        } else if (args[0]?.target) {
          this.handleChange(args[0].target.value);
          childOnChange?.(args[0]);
        } else {
          this.handleChange(args[0]);
          childOnChange?.(args[0]);
        }
      },
      name,
    };

    return React.cloneElement(children, childProps);
  };

  /**
   * 渲染表单项组件。
   * @returns {React.ReactNode} 表单项节点。
   */
  render() {
    const { label, extra, style } = this.props;
    const error = this.getError();

    return (
      <div className={styles.formItem} style={style}>
        {label ? <label className={styles.label}>{label}</label> : null}
        <div className={styles.control}>{this.renderControl()}</div>
        {error ? <div className={styles.errorMsg}>{error}</div> : null}
        {extra && !error ? <div className={styles.extra}>{extra}</div> : null}
      </div>
    );
  }
}

export { HGFormPage, HGFormItem, FormContext };
export default HGFormPage;
