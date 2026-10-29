/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-29
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/components/hg_stat_card/hg_stat_card_page.jsx
 * @Description: 统计概览卡片组件，对标管理后台顶部的 KPI 指标卡（一组横排小卡片）
 */
import React from "react";
import styles from "./hg_stat_card.module.css";

/** 指标色调映射：用于区分不同指标的强调色。 */
const TONE_CLASS_MAP = {
  blue: styles.toneBlue,
  green: styles.toneGreen,
  orange: styles.toneOrange,
  purple: styles.tonePurple,
  gray: styles.toneGray,
};

/**
 * 统计概览卡片组件。
 * 职责：按 items 横排展示指标卡，只负责展示，不处理业务数据请求。
 *
 * Props:
 * - items: [{ label, value, suffix, tone, icon }] 指标配置数组。
 * - columns: 每行卡片数，默认按 items.length 自适应。
 * - className: 追加到根节点的样式类。
 */
class HGStatCardPage extends React.PureComponent {
  /**
   * 渲染单个指标卡。
   * @param {Object} item 指标配置 {label, value, suffix, tone, icon}。
   * @param {number} index 序号，用于 key。
   * @returns {React.ReactNode} 指标卡节点。
   */
  renderItem = (item, index) => {
    const toneClass = TONE_CLASS_MAP[item.tone] || TONE_CLASS_MAP.blue;
    const itemClass = [styles.item, toneClass].filter(Boolean).join(" ");

    return (
      <div key={item.label || index} className={itemClass}>
        {item.icon ? <span className={styles.itemIcon}>{item.icon}</span> : null}
        <div className={styles.itemMeta}>
          <div className={styles.itemLabel}>{item.label}</div>
          <div className={styles.itemValueRow}>
            <span className={styles.itemValue}>{item.value ?? "-"}</span>
            {item.suffix ? <span className={styles.itemSuffix}>{item.suffix}</span> : null}
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { items = [], className = "", style } = this.props;
    const columns = Number(this.props.columns) || Math.max(items.length, 1);
    const rootClass = [styles.statCard, className].filter(Boolean).join(" ");

    return (
      <div
        className={rootClass}
        style={{ ...style, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map(this.renderItem)}
      </div>
    );
  }
}

export default HGStatCardPage;
