import React from "react";
import styles from "./hg_tab_selector.module.css";

/**
 * 顶部 Tab 切换组件：支持多个 tab 切换，当前 tab 底部有横条高亮。
 * @param {Object} props
 * @param {Array<{key: string, label: string}>} props.tabs tab 列表。
 * @param {string} props.activeKey 当前激活的 tab key。
 * @param {Function} props.onChange 切换 tab 回调，参数为新的 tab key。
 */
/** @extends {React.Component<Partial<typeof HGTabSelector.defaultProps>>} */
class HGTabSelector extends React.Component {
  static defaultProps = {
    /** 标签列表，默认 []；key 标识标签、label 显示文字。 @type {Array<{key: React.Key, label: React.ReactNode}>} */
    tabs: [],
    /** 受控激活 key，默认 undefined 不选中任何标签。 @type {React.Key|undefined} */
    activeKey: undefined,
    /** 切换到不同标签时返回 key，默认 undefined 不通知。 @type {((key: React.Key) => void)|undefined} */
    onChange: undefined,
  };

  /**
   * 处理 tab 点击。
   * @param {string} tabKey 被点击的 tab key。
   * 约束：与当前激活 key 相同时不触发回调。
   */
  handleTabClick = (tabKey) => {
    const { activeKey, onChange } = this.props;
    if (tabKey !== activeKey && onChange) {
      onChange(tabKey);
    }
  };

  /**
   * 组件主渲染：tab 列表与底部激活横条。
   * @returns {React.ReactNode} Tab 选择器 JSX。
   */
  render() {
    const { tabs, activeKey } = this.props;

    return (
      <div className={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""}`}
              onClick={() => this.handleTabClick(tab.key)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              {isActive ? <span className={styles.tabIndicator} /> : null}
            </button>
          );
        })}
      </div>
    );
  }
}

export default HGTabSelector;
