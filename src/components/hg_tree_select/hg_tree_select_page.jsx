/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_tree_select/hg_tree_select_page.jsx
 * @Description: 自定义树选择组件，替代 antd TreeSelect，支持多选、勾选框、展示策略和下拉树形结构
 */
import React from "react";
import styles from "./hg_tree_select.module.css";

/**
 * 展平树节点，返回所有节点的 value 列表。
 * @param {Array} treeData 树形数据。
 * @returns {string[]} 所有节点 value 数组。
 */
const flattenTreeValues = (treeData) => {
  const result = [];
  const walk = (nodes) => {
    if (!nodes) return;
    nodes.forEach((node) => {
      result.push(node.value);
      if (node.children) walk(node.children);
    });
  };
  walk(treeData);
  return result;
};

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
class HGTreeSelectPage extends React.Component {
  constructor(props) {
    super(props);
    const defaultVal = props.defaultValue ?? [];
    this.state = {
      open: false,
      expandedKeys: this.getInitialExpandedKeys(props.treeData, props.treeDefaultExpandAll),
      checkedValues: new Set(defaultVal),
    };
    this.containerRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener("mousedown", this.handleOutsideClick);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleOutsideClick);
  }

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
    if (value !== undefined) return new Set(value);
    return this.state.checkedValues;
  };

  /**
   * 点击外部关闭下拉。
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
   */
  handleToggleOpen = () => {
    const { disabled } = this.props;
    if (disabled) return;
    this.setState((prev) => ({ open: !prev.open }));
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
    const { onChange, treeData, showCheckedStrategy = "SHOW_CHILD" } = this.props;
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
    onChange?.([]);
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
    const isChecked = this.isNodeFullyChecked(node, checkedSet);
    const isIndeterminate = this.isNodeIndeterminate(node, checkedSet);

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
            <span
              className={styles.nodeTitle}
              onClick={() => this.handleCheck(node, !isChecked)}
            >
              {node.title}
            </span>
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
    const { treeData = [], showCheckedStrategy = "SHOW_CHILD" } = this.props;
    const checkedSet = this.getCheckedSet();
    const displayValues = filterByStrategy(treeData, checkedSet, showCheckedStrategy);
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
        <div className={dropdownClassName_}>{this.renderTree()}</div>
      </div>
    );
  }
}

HGTreeSelectPage.SHOW_CHILD = "SHOW_CHILD";
HGTreeSelectPage.SHOW_ALL = "SHOW_ALL";
HGTreeSelectPage.SHOW_PARENT = "SHOW_PARENT";

export default HGTreeSelectPage;
