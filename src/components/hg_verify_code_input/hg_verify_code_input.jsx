import React from "react";
import styles from "./hg_verify_code_input.module.css";

/**
 * 通用 6 位验证码输入组件：负责方格输入、粘贴、自动跳格和焦点高亮。
 */
class HGVerifyCodeInput extends React.Component {
  /**
   * 构造函数：初始化输入框引用与焦点状态。
   * @param {Object} props 组件属性。
   * 约束：验证码值由父组件受控传入，组件不保存业务验证码。
   */
  constructor(props) {
    super(props);
    this.inputRefs = [];
    this.state = {
      focusedIndex: -1,
    };
  }

  /**
   * 获取验证码长度。
   * @returns {number} 验证码方格数量，默认 6 位。
   */
  getCodeLength = () => {
    return this.props.length || 6;
  };

  /**
   * 获取当前验证码数组。
   * @returns {string[]} 每一格对应的字符数组。
   */
  getCodeList = () => {
    const codeValue = `${this.props.value ?? ""}`;
    return Array.from({ length: this.getCodeLength() }, (_, index) => {
      return codeValue[index] ?? "";
    });
  };

  /**
   * 通知父组件验证码变化。
   * @param {string[]} nextCodeList 下一份验证码数组。
   * 约束：只输出数字验证码字符串。
   */
  emitCodeChange = (nextCodeList) => {
    this.props.onChange?.(nextCodeList.join(""));
  };

  /**
   * 处理单格输入与粘贴。
   * @param {number} codeIndex 当前输入框下标。
   * @param {string} inputValue 用户输入内容。
   * 约束：只接受数字；粘贴多位时从当前格依次填充。
   */
  handleInputChange = (codeIndex, inputValue) => {
    const digitList = inputValue.replace(/\D/g, "").split("");
    if (digitList.length === 0 && inputValue) {
      return;
    }

    const nextCodeList = this.getCodeList();
    if (digitList.length > 1) {
      digitList.slice(0, nextCodeList.length - codeIndex).forEach((digit, offset) => {
        nextCodeList[codeIndex + offset] = digit;
      });
    } else {
      nextCodeList[codeIndex] = digitList[0] ?? "";
    }

    this.emitCodeChange(nextCodeList);

    const nextFocusIndex = Math.min(
      codeIndex + Math.max(digitList.length, 1),
      this.inputRefs.length - 1
    );
    if (digitList.length > 0) {
      this.inputRefs[nextFocusIndex]?.focus();
    }
  };

  /**
   * 处理退格键回退。
   * @param {number} codeIndex 当前输入框下标。
   * @param {KeyboardEvent} event 键盘事件。
   * 约束：当前格为空且按 Backspace 时回到上一格。
   */
  handleKeyDown = (codeIndex, event) => {
    if (event.key === "Backspace" && !this.getCodeList()[codeIndex] && codeIndex > 0) {
      this.inputRefs[codeIndex - 1]?.focus();
    }
  };

  /**
   * 渲染验证码方格输入框。
   * @returns {React.ReactNode} 验证码输入框组。
   */
  render() {
    const codeList = this.getCodeList();
    const { disabled } = this.props;
    const { focusedIndex } = this.state;

    return (
      <div className={styles.codeGroup}>
        {codeList.map((codeValue, codeIndex) => {
          const isActive = focusedIndex === codeIndex || Boolean(codeValue);
          return (
            <input
              key={codeIndex}
              ref={(inputElement) => {
                this.inputRefs[codeIndex] = inputElement;
              }}
              className={`${styles.codeInput} ${isActive ? styles.codeInputActive : ""}`}
              disabled={disabled}
              inputMode="numeric"
              maxLength={this.getCodeLength()}
              value={codeValue}
              onChange={(event) =>
                this.handleInputChange(codeIndex, event.target.value)
              }
              onKeyDown={(event) => this.handleKeyDown(codeIndex, event)}
              onFocus={() => this.setState({ focusedIndex: codeIndex })}
              onBlur={() => this.setState({ focusedIndex: -1 })}
            />
          );
        })}
      </div>
    );
  }
}

export default HGVerifyCodeInput;
