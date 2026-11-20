/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_tree_select/hg_tree_select_page.jsx
 * @Description: 自定义树选择组件，替代 antd TreeSelect，支持多选、勾选框、展示策略和下拉树形结构
 */
import React from "react";
import { createPortal } from "react-dom";
import styles from "./hg_tree_select.module.css";

let hgTreeSelectGroupSequence = 0; // 单选 radio 组序号；不同选择器不可互相取消选中。

/**
 * 获取节点的所有后代 value 列表。
 * @param {Object} node 树节点。
 * @returns {string[]} 后代 value 数组。
 */
const getDescendantValues = (node) => {
  const result = [];
  const walk = (n) => {
    if (n.children) {
      n.children.forEach((child) => {
        result.push(child.value);
        walk(child);
      });
    }
  };
  walk(node);
  return result;
};

/**
 * 根据 showCheckedStrategy 过滤选中值。
 * @param {Array} treeData 树形数据。
 * @param {Set} checkedSet 当前选中的 value 集合。
 * @param {string} strategy 展示策略。
 * @returns {string[]} 过滤后的 value 数组。
 */
const filterByStrategy = (treeData, checkedSet, strategy) => {
  if (strategy === "SHOW_ALL") {
    return Array.from(checkedSet);
  }

  const result = [];
  const walk = (nodes, ancestors) => {
    if (!nodes) return;
    nodes.forEach((node) => {
      const isChecked = checkedSet.has(node.value);
      const descendants = getDescendantValues(node);
      const hasCheckedDescendant = descendants.some((v) => checkedSet.has(v));

      if (strategy === "SHOW_CHILD") {
        if (isChecked && (!node.children || node.children.length === 0)) {
          result.push(node.value);
        } else if (hasCheckedDescendant && node.children) {
          walk(node.children, [...ancestors, node.value]);
        }
      } else if (strategy === "SHOW_PARENT") {
        if (isChecked && ancestors.length > 0) {
          // skip, parent will cover
        } else if (isChecked) {
          result.push(node.value);
        } else if (hasCheckedDescendant) {
          walk(node.children, [...ancestors, node.value]);
        }
      }
    });
  };

  if (strategy === "SHOW_PARENT") {
    const walkParent = (nodes) => {
      if (!nodes) return;
      nodes.forEach((node) => {
        const isChecked = checkedSet.has(node.value);
        if (isChecked) {
          result.push(node.value);
        } else {
          walkParent(node.children);
        }
      });
    };
    walkParent(treeData);
  } else {
    walk(treeData, []);
  }

  return result;
};

/**
 * 在树中查找指定 value 的节点。
 * @param {Array} treeData 树形数据。
 * @param {*} targetValue 目标 value。
 * @returns {Object|null} 找到的节点或 null。
 */
const findNodeByValue = (treeData, targetValue) => {
  for (const node of treeData) {
    if (node.value === targetValue) return node;
    if (node.children) {
      const found = findNodeByValue(node.children, targetValue);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 自定义树选择组件：替代 antd TreeSelect。
 * 支持多选、勾选框、展示策略和下拉树形结构。
 */
/** @extends {React.Component<Partial<typeof HGTreeSelectPage.defaultProps>>} */
class HGTreeSelectPage extends React.Component {
  static defaultProps = {
    /** 树节点，默认 []；每项包含 value、title 与可选 children。 @type {Array<any>} */
    treeData: [],
    /** 受控值默认 undefined 使用内部状态；单选传标量、null 表示清空，多选传数组。 @type {string|number|Array<string|number>|null|undefined} */
    value: undefined,
    /** 非受控初始值默认 undefined 未选择；单选传标量、多选传数组，仅初始化读取。 @type {string|number|Array<string|number>|null|undefined} */
    defaultValue: undefined,
    /** 默认单选；true 显示复选框并启用父子节点勾选逻辑。 */
    treeCheckable: false,
    /** 默认不展开全部树节点；true 在初始化时展开目录。 */
    treeDefaultExpandAll: false,
    /** 勾选结果策略，默认 SHOW_CHILD；SHOW_ALL 保留父节点与子节点。 */
    showCheckedStrategy: "SHOW_CHILD",
    /** 空选中占位文案，默认“请选择”。 */
    placeholder: "请选择",
    /** 默认不显示清除入口；true 可清空选择。 */
    allowClear: false,
    /** 默认允许选择；true 禁用交互。 */
    disabled: false,
    /** 单选返回标量（清空为 null）；多选返回数组；默认 undefined 不通知。 @type {Function|undefined} */
    onChange: undefined,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
    /** 下拉面板附加样式类，默认空字符串。 */
    dropdownClassName: "",
  };

  constructor(props) {
    super(props);
    const defaultVal = props.defaultValue; // 单选默认标量，多选默认数组；null/undefined 表示未选。
    this.state = {
      open: false, // 下拉面板默认关闭。
      expandedKeys: this.getInitialExpandedKeys(props.treeData, props.treeDefaultExpandAll), // 初始展开的节点值；空集合表示全折叠。
      checkedValues: new Set(defaultVal == null ? [] : Array.isArray(defaultVal) ? defaultVal : [defaultVal]), // 非受控值；单选最多一个，多选保留所有选择。
      dropdownStyle: {}, // 下拉浮层定位；首次展开前为空对象。
    };
    this.containerRef = React.createRef(); // 选择器锚点；挂载前为空。
    this.dropdownRef = React.createRef(); // 浮层根节点；关闭时为空。
    this.hgRadioGroupName = `hg-tree-select-${++hgTreeSelectGroupSequence}`; // 同一组件的选项共享原生 radio 组。
  }

  componentDidMount() {
    document.addEventListener("mousedown", this.handleOutsideClick);
    window.addEventListener("resize", this.updateDropdownPosition);
    window.addEventListener("scroll", this.updateDropdownPosition, true);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleOutsideClick);
    window.removeEventListener("resize", this.updateDropdownPosition);
    window.removeEventListener("scroll", this.updateDropdownPosition, true);
  }

  /**
   * 根据选择框视口位置计算浮层坐标，浮层挂载到 body 后不受弹窗滚动容器裁切。
   */
  updateDropdownPosition = () => {
    const anchor = this.containerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    this.setState({
      dropdownStyle: {
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        boxSizing: "border-box",
      },
    });
  };

  /**
   * 获取初始展开的节点 key。
   * @param {Array} treeData 树形数据。
   * @param {boolean} expandAll 是否全部展开。
   * @returns {Set} 展开的 key 集合。
   */
  getInitialExpandedKeys = (treeData, expandAll) => {
    if (!expandAll) return new Set();
    const keys = new Set();
    const walk = (nodes) => {
      if (!nodes) return;
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          keys.add(node.value);
          walk(node.children);
        }
      });
    };
    walk(treeData);
    return keys;
  };

  /**
   * 获取当前受控/非受控选中值集合。
   * @returns {Set} 当前选中的 value 集合。
   */
  getCheckedSet = () => {
    const { value } = this.props;
    if (value !== undefined) return new Set(value == null ? [] : Array.isArray(value) ? value : [value]);
    return this.state.checkedValues;
  };

  /**
   * 点击外部关闭下拉。
   * @param {MouseEvent} event 鼠标事件。
   */
  handleOutsideClick = (event) => {
    if (this.dropdownRef.current?.contains(event.target)) return;
    if (
      this.containerRef.current &&
      !this.containerRef.current.contains(event.target)
    ) {
      this.setState({ open: false });
    }
  };

  /**
   * 切换下拉展开/收起。
   */
  handleToggleOpen = () => {
    const { disabled } = this.props;
    if (disabled) return;
    const open = !this.state.open;
    if (open) this.updateDropdownPosition();
    this.setState({ open });
  };

  /**
   * 切换节点展开/收起。
   * @param {*} nodeValue 节点 value。
   */
  handleToggleExpand = (nodeValue) => {
    this.setState((prev) => {
      const next = new Set(prev.expandedKeys);
      if (next.has(nodeValue)) {
        next.delete(nodeValue);
      } else {
        next.add(nodeValue);
      }
      return { expandedKeys: next };
    });
  };

  /**
   * 处理勾选节点，联动父/子节点。
   * @param {Object} node 被操作的节点。
   * @param {boolean} isChecked 是否选中。
   */
  handleCheck = (node, isChecked) => {
    const { onChange, treeData, showCheckedStrategy, treeCheckable } = this.props;
    if (!treeCheckable) {
      const selected = isChecked ? node.value : null; // 单选永远替换旧节点；清空使用 null 保持受控状态。
      this.setState({ checkedValues: new Set(selected === null ? [] : [selected]), open: false });
      onChange?.(selected);
      return;
    }
    const currentSet = this.getCheckedSet();
    const nextSet = new Set(currentSet);
    const descendantValues = getDescendantValues(node);

    if (isChecked) {
      nextSet.add(node.value);
      descendantValues.forEach((v) => nextSet.add(v));
    } else {
      nextSet.delete(node.value);
      descendantValues.forEach((v) => nextSet.delete(v));
    }

    const filteredValues = filterByStrategy(treeData, nextSet, showCheckedStrategy);
    const finalSet = new Set(filteredValues);
    this.setState({ checkedValues: finalSet });
    onChange?.(filteredValues);
  };

  /**
   * 清除所有选中值。
   */
  handleClear = (event) => {
    event.stopPropagation();
    const { onChange } = this.props;
    this.setState({ checkedValues: new Set() });
    onChange?.(this.props.treeCheckable ? [] : null);
  };

  /**
   * 判断节点是否全部后代被选中。
   * @param {Object} node 树节点。
   * @param {Set} checkedSet 选中集合。
   * @returns {boolean} 是否全选。
   */
  isNodeFullyChecked = (node, checkedSet) => {
    if (!checkedSet.has(node.value)) return false;
    if (!node.children || node.children.length === 0) return true;
    return node.children.every((child) => this.isNodeFullyChecked(child, checkedSet));
  };

  /**
   * 判断节点是否有部分后代被选中（半选状态）。
   * @param {Object} node 树节点。
   * @param {Set} checkedSet 选中集合。
   * @returns {boolean} 是否半选。
   */
  isNodeIndeterminate = (node, checkedSet) => {
    if (checkedSet.has(node.value)) return false;
    if (!node.children || node.children.length === 0) return false;
    return node.children.some(
      (child) =>
        checkedSet.has(child.value) || this.isNodeIndeterminate(child, checkedSet)
    );
  };

  /**
   * 渲染单个树节点。
   * @param {Object} node 树节点。
   * @param {number} depth 层级深度。
   * @returns {React.ReactNode} 节点 DOM。
   */
  renderTreeNode = (node, depth) => {
    const { treeCheckable } = this.props;
    const { expandedKeys } = this.state;
    const checkedSet = this.getCheckedSet();
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.has(node.value);
    const isChecked = treeCheckable ? this.isNodeFullyChecked(node, checkedSet) : checkedSet.has(node.value); // 单选父节点不依赖子节点是否选中。
    const isIndeterminate = treeCheckable && this.isNodeIndeterminate(node, checkedSet);

    const nodeClassName = [
      styles.treeNode,
      isChecked ? styles.treeNodeChecked : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div key={String(node.value)} className={styles.treeNodeWrapper}>
        <div
          className={nodeClassName}
          style={{ paddingLeft: depth * 20 + 8 }}
        >
          {hasChildren ? (
            <span
              className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                this.handleToggleExpand(node.value);
              }}
            >
              ▶
            </span>
          ) : (
            <span className={styles.expandIconPlaceholder} />
          )}

          {treeCheckable ? (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={isChecked}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={(e) => this.handleCheck(node, e.target.checked)}
              />
              <span className={styles.checkboxCustom} />
              <span className={styles.nodeTitle}>{node.title}</span>
            </label>
          ) : (
            <label className={styles.checkboxLabel}>
              <input
                type="radio"
                name={this.hgRadioGroupName}
                className={styles.checkboxInput}
                checked={isChecked}
                onChange={() => this.handleCheck(node, true)}
              />
              <span className={styles.radioCustom} aria-hidden="true" />
              <span className={styles.nodeTitle}>{node.title}</span>
            </label>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className={styles.treeChildren}>
            {node.children.map((child) =>
              this.renderTreeNode(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染下拉树列表。
   * @returns {React.ReactNode} 树节点列表。
   */
  renderTree = () => {
    const { treeData = [] } = this.props;
    if (treeData.length === 0) {
      return <div className={styles.emptyText}>暂无数据</div>;
    }
    return (
      <div className={styles.treeContainer}>
        {treeData.map((node) => this.renderTreeNode(node, 0))}
      </div>
    );
  };

  /**
   * 获取已选中节点的标题文本，用于显示在选择框中。
   * @returns {string} 已选标题。
   */
  getSelectedTitles = () => {
    const { treeData, showCheckedStrategy, treeCheckable } = this.props;
    const checkedSet = this.getCheckedSet();
    const displayValues = treeCheckable ? filterByStrategy(treeData, checkedSet, showCheckedStrategy) : [...checkedSet];
    return displayValues
      .map((v) => {
        const node = findNodeByValue(treeData, v);
        return node ? node.title : v;
      })
      .join("、");
  };

  /**
   * 渲染组件。
   * @returns {React.ReactNode} 树选择器节点。
   */
  render() {
    const {
      placeholder = "请选择",
      allowClear,
      disabled,
      className,
      dropdownClassName,
    } = this.props;
    const { open } = this.state;
    const checkedSet = this.getCheckedSet();
    const hasValue = checkedSet.size > 0;
    const selectedText = this.getSelectedTitles();

    const rootClassName = [
      styles.selectRoot,
      disabled ? styles.selectDisabled : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const dropdownClassName_ = [
      styles.dropdown,
      open ? styles.dropdownVisible : "",
      dropdownClassName,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={this.containerRef} className={rootClassName}>
        <div
          className={styles.selection}
          onClick={this.handleToggleOpen}
        >
          {hasValue ? (
            <span className={styles.selectedText}>{selectedText}</span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
          <div className={styles.selectionActions}>
            {allowClear && hasValue && !disabled && (
              <span
                className={styles.clearBtn}
                onClick={this.handleClear}
                onMouseDown={(e) => e.preventDefault()}
              >
                ×
              </span>
            )}
            <span
              className={`${styles.arrowIcon} ${open ? styles.arrowIconOpen : ""}`}
            />
          </div>
        </div>
        {open && createPortal(
          <div
            ref={this.dropdownRef}
            className={`${dropdownClassName_} ${styles.dropdownPortal}`}
            style={this.state.dropdownStyle}
          >
            {this.renderTree()}
          </div>,
          document.body
        )}
      </div>
    );
  }
}

HGTreeSelectPage.SHOW_CHILD = "SHOW_CHILD";
HGTreeSelectPage.SHOW_ALL = "SHOW_ALL";
HGTreeSelectPage.SHOW_PARENT = "SHOW_PARENT";

export default HGTreeSelectPage;
