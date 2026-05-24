/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_menu/hg_menu_page.jsx
 * @Description: 自定义菜单组件，替代 antd Menu，支持图标、多级子菜单缩进、horizontal/inline 模式
 */
import React from "react";
import styles from "./hg_menu.module.css";

/**
 * 展开箭头 SVG 图标（向下小三角）。
 * 职责：渲染子菜单展开/折叠指示箭头。
 * @param {{ open: boolean }} props - open 控制箭头方向。
 * @returns {React.ReactNode} SVG 图标节点。
 */
const ArrowIcon = ({ open }) => (
  <svg
    className={`${styles.arrowIcon} ${open ? styles.arrowIconOpen : ""}`}
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 自定义菜单组件，替代 antd Menu。
 * 职责：根据 items 渲染可交互菜单，支持图标、horizontal/inline 模式、多级子菜单展开折叠。
 * 输入：items, mode, selectedKeys, onClick, onOpenChange, openKeys, theme, className。
 * 约束：items 格式为 [{key, label, icon?, children?}]，支持无限层级嵌套。
 * 特性：
 *   - icon：每个菜单项可传入 React 元素作为左侧图标
 *   - 子菜单缩进：inline 模式下子级菜单自动缩进 24px/级
 *   - 主题：dark（深色侧边栏）/ light（浅色）
 *   - 模式：horizontal（顶部水平）/ inline（侧边栏垂直）
 */
class HGMenuPage extends React.Component {
  /**
   * 判断给定 key 是否为当前选中项。
   * @param {string} key - 菜单项 key。
   * @returns {boolean} 是否选中。
   */
  isSelected = (key) => {
    const { selectedKeys = [] } = this.props;
    return selectedKeys.includes(key);
  };

  /**
   * 判断子菜单是否展开。
   * @param {string} key - 子菜单 key。
   * @returns {boolean} 是否展开。
   */
  isOpen = (key) => {
    const { openKeys = [] } = this.props;
    return openKeys.includes(key);
  };

  /**
   * 处理叶子菜单项点击，触发 onClick 回调。
   * @param {string} key - 被点击的菜单项 key。
   * @param {React.MouseEvent} e - 鼠标事件。
   */
  handleClick = (key, e) => {
    e.stopPropagation();
    const { onClick } = this.props;
    if (onClick) {
      onClick({ key });
    }
  };

  /**
   * 处理子菜单标题点击，切换展开/折叠状态。
   * @param {string} key - 子菜单 key。
   * @param {React.MouseEvent} e - 鼠标事件。
   */
  handleSubMenuClick = (key, e) => {
    e.stopPropagation();
    const { openKeys = [], onOpenChange } = this.props;
    if (onOpenChange) {
      const nextOpenKeys = openKeys.includes(key)
        ? openKeys.filter((k) => k !== key)
        : [...openKeys, key];
      onOpenChange(nextOpenKeys);
    }
  };

  /**
   * 渲染单个菜单项或子菜单（递归）。
   * 职责：递归渲染 items 数组，支持图标、子菜单缩进、展开折叠动画。
   * @param {object} item - {key, label, icon?, children?}。
   * @param {number} level - 当前嵌套层级（0 为顶级），用于计算缩进。
   * @returns {React.ReactNode} 菜单项节点。
   */
  renderItem = (item, level = 0) => {
    const { mode } = this.props;
    const isInline = mode === "inline";
    const hasChildren = item.children && item.children.length > 0;
    const indentPx = level * 24;

    if (hasChildren) {
      const open = this.isOpen(item.key);
      return (
        <li key={item.key} className={styles.subMenu}>
          {/* 子菜单标题行：图标 + 标签 + 展开箭头 */}
          <div
            className={`${styles.subMenuTitle} ${open ? styles.subMenuTitleOpen : ""}`}
            style={isInline ? { paddingLeft: 16 + indentPx } : undefined}
            onClick={(e) => this.handleSubMenuClick(item.key, e)}
          >
            {item.icon && <span className={styles.menuIcon}>{item.icon}</span>}
            <span className={styles.menuLabel}>{item.label}</span>
            {isInline && <ArrowIcon open={open} />}
          </div>
          {/* 子菜单列表：inline 模式内联展开，horizontal 模式弹出 */}
          {isInline && open && (
            <ul className={styles.subMenuList}>
              {item.children.map((child) => this.renderItem(child, level + 1))}
            </ul>
          )}
          {!isInline && (
            <ul className={styles.popupMenu}>
              {item.children.map((child) => this.renderItem(child, level + 1))}
            </ul>
          )}
        </li>
      );
    }

    // 叶子菜单项
    return (
      <li
        key={item.key}
        className={`${styles.menuItem} ${this.isSelected(item.key) ? styles.menuItemSelected : ""}`}
        style={isInline ? { paddingLeft: 16 + indentPx } : undefined}
        onClick={(e) => this.handleClick(item.key, e)}
      >
        {item.icon && <span className={styles.menuIcon}>{item.icon}</span>}
        <span className={styles.menuLabel}>{item.label}</span>
      </li>
    );
  };

  /**
   * 渲染菜单组件根节点。
   * @returns {React.ReactNode} 菜单节点。
   */
  render() {
    const { items = [], mode = "horizontal", theme = "light", className = "" } = this.props;
    const rootClass = [
      styles.menu,
      mode === "inline" ? styles.inline : styles.horizontal,
      theme === "dark" ? styles.dark : styles.light,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <ul className={rootClass}>
        {items.map((item) => this.renderItem(item, 0))}
      </ul>
    );
  }
}

export default HGMenuPage;
