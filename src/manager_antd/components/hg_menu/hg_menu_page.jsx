import React from "react";
import styles from "./hg_menu.module.css";

/**
 * 自定义菜单组件，替代 antd Menu。
 * 职责：根据 items 渲染可交互的菜单，支持 horizontal/inline 模式、多级子菜单展开折叠。
 * 输入：items, mode, selectedKeys, onClick, onOpenChange, openKeys, theme, className。
 * 约束：items 格式为 [{key, label, children?}]，支持无限层级嵌套。
 */
class HGMenuPage extends React.Component {
  /**
   * 判断给定 key 是否为当前选中项（或包含选中子项）。
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
   * 处理菜单项点击，触发 onClick 回调。
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
   * @param {object} item - {key, label, children?}。
   * @returns {React.ReactNode} 菜单项节点。
   */
  renderItem = (item) => {
    const { mode, theme } = this.props;
    const isInline = mode === "inline";
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      const open = this.isOpen(item.key);
      return (
        <li key={item.key} className={styles.subMenu}>
          <div
            className={`${styles.subMenuTitle} ${open ? styles.subMenuOpen : ""}`}
            onClick={(e) => this.handleSubMenuClick(item.key, e)}
          >
            <span>{item.label}</span>
            {isInline && (
              <span className={`${styles.arrow} ${open ? styles.arrowOpen : ""}`}>
                ▾
              </span>
            )}
          </div>
          {isInline && open && (
            <ul className={`${styles.subMenuList} ${theme === "dark" ? styles.darkSub : ""}`}>
              {item.children.map((child) => this.renderItem(child))}
            </ul>
          )}
          {!isInline && (
            <ul className={styles.popupMenu}>
              {item.children.map((child) => this.renderItem(child))}
            </ul>
          )}
        </li>
      );
    }

    return (
      <li
        key={item.key}
        className={`${styles.menuItem} ${this.isSelected(item.key) ? styles.menuItemSelected : ""}`}
        onClick={(e) => this.handleClick(item.key, e)}
      >
        {item.label}
      </li>
    );
  };

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
        {items.map((item) => this.renderItem(item))}
      </ul>
    );
  }
}

export default HGMenuPage;
