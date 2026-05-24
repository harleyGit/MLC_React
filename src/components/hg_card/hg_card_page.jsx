/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_card/hg_card_page.jsx
 * @Description: 自定义卡片组件，替代 antd Card，支持 title、extra 等属性
 */
import React from "react";
import styles from "./hg_card.module.css";

/**
 * 自定义卡片组件，兼容 antd Card 主要 props。
 * 支持 title、extra、className、style 等属性。
 */
class HGCardPage extends React.PureComponent {
  /**
   * 判断是否需要渲染卡片头部。
   * @returns {boolean} 有 title 或 extra 时返回 true。
   */
  hasHeader = () => {
    const { title, extra } = this.props;
    return title != null || extra != null;
  };

  /**
   * 渲染卡片头部。
   * @returns {React.ReactNode} 头部节点或 null。
   */
  renderHeader = () => {
    const { title, extra } = this.props;
    if (!this.hasHeader()) {
      return null;
    }

    return (
      <div className={styles.cardHeader}>
        {title != null ? (
          <div className={styles.cardTitle}>{title}</div>
        ) : null}
        {extra != null ? (
          <div className={styles.cardExtra}>{extra}</div>
        ) : null}
      </div>
    );
  };

  /**
   * 渲染卡片内容区。
   * @returns {React.ReactNode} 内容节点。
   */
  renderBody = () => {
    const { children } = this.props;
    return <div className={styles.cardBody}>{children}</div>;
  };

  /**
   * 获取卡片根节点 className。
   * @returns {string} 组合后的 className。
   */
  getClassName = () => {
    const { className = "" } = this.props;
    return [styles.card, className].filter(Boolean).join(" ");
  };

  /**
   * 渲染卡片组件。
   * @returns {React.ReactNode} 卡片节点。
   */
  render() {
    const { style } = this.props;

    return (
      <div className={this.getClassName()} style={style}>
        {this.renderHeader()}
        {this.renderBody()}
      </div>
    );
  }
}

export default HGCardPage;
