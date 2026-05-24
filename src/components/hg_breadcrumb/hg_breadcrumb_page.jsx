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
class HGBreadcrumbPage extends React.Component {
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
        <span key={index} className={styles.breadcrumbItem}>
          {item.label}
        </span>
      );
    }

    const handleClick = (e) => {
      if (item.onClick) {
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
