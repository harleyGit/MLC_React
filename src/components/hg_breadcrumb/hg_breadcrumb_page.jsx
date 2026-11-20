/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/components/hg_breadcrumb/hg_breadcrumb_page.jsx
 * @Description: 面包屑导航组件，兼容 antd Breadcrumb 主要 props
 */

import React from "react";
import styles from "./hg_breadcrumb.module.css";

/**
 * 默认分隔符图标（右箭头）。
 */
const DefaultSeparator = () => (
  <svg viewBox="0 0 10 10" fill="none">
    <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/**
 * 面包屑导航组件。
 * 职责：显示当前页面的层级路径导航。
 * 输入：items, separator, className。
 * 约束：items 格式为 [{label, href?, onClick?}]，最后一项为当前页。
 */
/** @extends {React.Component<Partial<typeof HGBreadcrumbPage.defaultProps>>} */
class HGBreadcrumbPage extends React.Component {
  static defaultProps = {
    /** 路径节点，默认 [] 不展示路径；末项为当前页，href/onClick 控制前级导航。 @type {Array<{label: React.ReactNode, href?: string, onClick?: (event: React.MouseEvent) => void}>} */
    items: [],
    /** 自定义分隔节点；默认 undefined 使用内置箭头。 @type {React.ReactNode} */
    separator: undefined,
    /** 普通点击链接时的站内导航回调；默认 undefined 由浏览器打开 href。 @type {((href: string) => void)|undefined} */
    onNavigate: undefined,
    /** 根节点附加样式类；默认空字符串。 */
    className: "",
  };

  /**
   * 渲染单个面包屑项。
   * @param {Object} item - 面包屑项配置 {label, href?, onClick?}。
   * @param {number} index - 当前索引。
   * @param {boolean} isLast - 是否为最后一项。
   * @returns {React.ReactNode} 面包屑项节点。
   */
  renderItem = (item, index, isLast) => {
    const { onNavigate } = this.props;

    if (isLast || (!item.href && !item.onClick)) {
      return (
        <span key={index} className={styles.breadcrumbItem} aria-current={isLast ? "page" : undefined}>
          {item.label}
        </span>
      );
    }

    const handleClick = (e) => {
      // 仅接管普通左键；Ctrl/Cmd、Shift 和中键保持浏览器链接行为。
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (item.onClick) {
        if (item.href) e.preventDefault();
        item.onClick(e);
      } else if (item.href && onNavigate) {
        e.preventDefault();
        onNavigate(item.href);
      }
    };

    return (
      <span key={index} className={styles.breadcrumbItem}>
        {item.href ? (
          <a
            href={item.href}
            className={styles.breadcrumbLink}
            onClick={handleClick}
          >
            {item.label}
          </a>
        ) : (
          <button
            type="button"
            className={styles.breadcrumbLink}
            onClick={handleClick}
          >
            {item.label}
          </button>
        )}
      </span>
    );
  };

  /**
   * 渲染分隔符。
   * @param {number} index - 当前索引。
   * @returns {React.ReactNode} 分隔符节点。
   */
  renderSeparator = (index) => {
    const { separator } = this.props;
    return (
      <span key={`sep-${index}`} className={styles.breadcrumbSeparator}>
        {separator || <DefaultSeparator />}
      </span>
    );
  };

  render() {
    const { items = [], className = "" } = this.props;

    if (!items || items.length === 0) {
      return null;
    }

    const rootClass = [styles.breadcrumb, className].filter(Boolean).join(" ");

    const children = [];
    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      children.push(this.renderItem(item, index, isLast));
      if (!isLast) {
        children.push(this.renderSeparator(index));
      }
    });

    return (
      <nav className={rootClass} aria-label="面包屑导航">
        {children}
      </nav>
    );
  }
}

export default HGBreadcrumbPage;
