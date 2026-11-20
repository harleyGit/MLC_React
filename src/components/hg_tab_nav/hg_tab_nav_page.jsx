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
/** @extends {Component<Partial<typeof HGTabNavPage.defaultProps>>} */
class HGTabNavPage extends Component {
  static defaultProps = {
    /** 导航标签，默认 []；key 为稳定标识，label 为标题，count 为可选计数。 @type {Array<{key: React.Key, label: React.ReactNode, count?: number}>} */
    tabs: [],
    /** 受控当前标签，默认 undefined 不选中任何标签。 @type {React.Key|undefined} */
    activeKey: undefined,
    /** 点击返回标签 key，默认 undefined 不通知；父级负责更新 activeKey。 @type {((key: React.Key) => void)|undefined} */
    onChange: undefined,
  };

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
