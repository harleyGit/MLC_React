/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_switch/hg_switch_page.jsx
 * @Description: 自定义开关组件，兼容 antd Switch 主要 props
 */

import React from "react";
import styles from "./hg_switch.module.css";

/**
 * 自定义开关组件：替代 antd Switch。
 * 支持受控/非受控模式、自定义文案和禁用状态。
 */
/** @extends {React.Component<Partial<typeof HGSwitchPage.defaultProps>>} */
class HGSwitchPage extends React.Component {
  static defaultProps = {
    /** 受控开关值，默认 undefined 使用内部状态；不能默认 false 否则会锁定非受控开关。 @type {boolean|undefined} */
    checked: undefined,
    /** 非受控初始状态，默认 false 关闭。 */
    defaultChecked: false,
    /** 默认允许切换；true 禁用操作。 */
    disabled: false,
    /** 开启时的标签，默认 undefined 不显示。 @type {React.ReactNode} */
    checkedChildren: undefined,
    /** 关闭时的标签，默认 undefined 不显示。 @type {React.ReactNode} */
    unCheckedChildren: undefined,
    /** 切换后返回布尔值，默认 undefined 不通知。 @type {((checked: boolean) => void)|undefined} */
    onChange: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
  };

  constructor(props) {
    super(props);
    this.state = {
      checked: props.defaultChecked ?? false,
    };
  }

  /**
   * 获取当前受控/非受控选中状态。
   * @returns {boolean} 是否选中。
   */
  getControlledChecked = () => {
    const { checked } = this.props;
    return checked !== undefined ? checked : this.state.checked;
  };

  /**
   * 处理开关切换，通知父组件并更新内部状态。
   */
  handleToggle = () => {
    const { disabled, onChange } = this.props;
    if (disabled) return;
    const nextChecked = !this.getControlledChecked();
    this.setState({ checked: nextChecked });
    onChange?.(nextChecked);
  };

  /**
   * 渲染开关内部文案。
   * @returns {React.ReactNode} 文案节点。
   */
  renderInnerContent = () => {
    const { checkedChildren, unCheckedChildren } = this.props;
    const isChecked = this.getControlledChecked();
    const content = isChecked ? checkedChildren : unCheckedChildren;
    if (!content && content !== 0) return null;
    return (
      <span className={isChecked ? styles.textOn : styles.textOff}>
        {content}
      </span>
    );
  };

  /**
   * 渲染组件。
   * @returns {React.ReactNode} 开关节点。
   */
  render() {
    const { disabled, className } = this.props;
    const isChecked = this.getControlledChecked();

    const rootClassName = [
      styles.switchRoot,
      isChecked ? styles.switchChecked : styles.switchUnchecked,
      disabled ? styles.switchDisabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        className={rootClassName}
        onClick={this.handleToggle}
      >
        {this.renderInnerContent()}
        <span className={styles.handle} />
      </button>
    );
  }
}

export default HGSwitchPage;
