import React from "react";
import styles from "./hg_tag_selector.module.css";

/**
 * 标签选择组件：支持单选/多选，底部标签列表、顶部已选展示、取消选中。
 * @param {Object} props
 * @param {Array<{value: string, label: string, icon?: string}>} props.options 可选标签列表。
 * @param {string|string[]} props.value 当前选中值（单选为 string，多选为 string[]）。
 * @param {boolean} props.multiple 是否多选，默认 false。
 * @param {number} props.maxCount 多选时最大可选数量，0 表示不限制。
 * @param {Function} props.onChange 选中变化回调，参数为新的选中值。
 */
/** @extends {React.Component<Partial<typeof HGTagSelector.defaultProps>>} */
class HGTagSelector extends React.Component {
  static defaultProps = {
    /** 标签候选项，默认 []；value 为标识、label 为文字、icon 为可选图片地址。 @type {Array<{value: string, label: string, icon?: string}>} */
    options: [],
    /** 受控选择值，默认 undefined 未选择；多选传字符串数组。 @type {string|Array<string>|undefined} */
    value: undefined,
    /** 默认单选；true 允许多选与逐项取消。 */
    multiple: false,
    /** 多选数量上限，默认 0 不限制；正数达到上限后禁用未选项。 */
    maxCount: 0,
    /** 选择变化返回新值或数组，默认 undefined 不提交变化。 @type {((value: string|Array<string>) => void)|undefined} */
    onChange: undefined,
  };

  /**
   * 判断某个标签是否被选中。
   * @param {string} tagValue 标签值。
   * @returns {boolean} 是否选中。
   */
  isSelected = (tagValue) => {
    const { value, multiple } = this.props;
    if (multiple) {
      return Array.isArray(value) && value.includes(tagValue);
    }
    return value === tagValue;
  };

  /**
   * 处理标签点击：选中或取消选中。
   * @param {string} tagValue 被点击的标签值。
   * 约束：多选模式下受 maxCount 限制。
   */
  handleTagClick = (tagValue) => {
    const { value, multiple, maxCount, onChange } = this.props;
    if (!onChange) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const isAlreadySelected = currentValues.includes(tagValue);
      if (isAlreadySelected) {
        onChange(currentValues.filter((v) => v !== tagValue));
      } else {
        if (maxCount > 0 && currentValues.length >= maxCount) return;
        onChange([...currentValues, tagValue]);
      }
    } else {
      onChange(tagValue);
    }
  };

  /**
   * 处理顶部已选标签的取消操作。
   * @param {string} tagValue 要取消的标签值。
   * 约束：多选模式移除单项，单选模式清空。
   */
  handleRemoveSelected = (tagValue) => {
    const { value, multiple, onChange } = this.props;
    if (!onChange) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter((v) => v !== tagValue));
    } else {
      onChange("");
    }
  };

  /**
   * 渲染顶部已选标签区域。
   * @returns {React.ReactNode} 已选标签 JSX。
   */
  renderSelectedTags = () => {
    const { value, multiple, options } = this.props;
    const selectedValues = multiple
      ? Array.isArray(value) ? value : []
      : value ? [value] : [];

    if (selectedValues.length === 0) return null;

    return (
      <div className={styles.selectedWrap}>
        {selectedValues.map((tagValue) => {
          const option = options.find((o) => o.value === tagValue);
          const label = option ? option.label : tagValue;
          return (
            <span key={tagValue} className={styles.selectedTag}>
              <span className={styles.selectedTagText}>{label}</span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => this.handleRemoveSelected(tagValue)}
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染底部标签列表。
   * @returns {React.ReactNode} 标签列表 JSX。
   */
  renderTagList = () => {
    const { options, multiple, maxCount, value } = this.props;
    const currentCount = multiple && Array.isArray(value) ? value.length : 0;

    return (
      <div className={styles.tagList}>
        {options.map((option) => {
          const selected = this.isSelected(option.value);
          const disabled =
            multiple && maxCount > 0 && !selected && currentCount >= maxCount;
          return (
            <button
              key={option.value}
              type="button"
              className={`${styles.tagItem} ${selected ? styles.tagItemActive : ""} ${
                disabled ? styles.tagItemDisabled : ""
              }`}
              onClick={() => !disabled && this.handleTagClick(option.value)}
              disabled={disabled}
            >
              {option.icon ? (
                <img src={option.icon} alt="" className={styles.tagIcon} />
              ) : null}
              <span>{option.label}</span>
              {selected ? (
                <span className={styles.checkMark}>✓</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * 组件主渲染：顶部已选 + 底部标签列表。
   * @returns {React.ReactNode} 标签选择器 JSX。
   */
  render() {
    return (
      <div className={styles.container}>
        {this.renderSelectedTags()}
        {this.renderTagList()}
      </div>
    );
  }
}

export default HGTagSelector;
