/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-30
 * @FilePath: /MLC_React/src/components/hg_tab_nav/hg_tab_nav_page.jsx
 * @Description: 标签导航组件，支持横向标签切换，可选下划线指示器
 */
import React, { Component } from "react";
import styles from "./hg_tab_nav.module.css";

/**
 * 标签导航组件
 * 职责：渲染横向标签列表，支持选中状态和切换回调
 * props:
 * - tabs: Array<{ key, label, count? }> 标签列表
 * - activeKey: string 当前选中 key
 * - onChange: (key) => void 切换回调
 */
class HGTabNavPage extends Component {
  render() {
    const { tabs, activeKey, onChange } = this.props;
    return (
      <div className={styles.tabNav}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`${styles.tabItem} ${activeKey === tab.key ? styles.tabItemActive : ""}`}
            onClick={() => onChange && onChange(tab.key)}
          >
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={styles.tabCount}>{tab.count}</span>
            )}
            {activeKey === tab.key && <div className={styles.indicator} />}
          </div>
        ))}
      </div>
    );
  }
}

export default HGTabNavPage;
