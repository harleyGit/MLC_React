/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/components/hg_detail_grid/hg_detail_grid_page.jsx
 * @Description: 通用详情网格组件，用于展示已选对象的字段摘要
 */
import React from "react";
import HGTooltipPage from "../hg_tooltip/hg_tooltip_page";
import styles from "./hg_detail_grid.module.css";

/**
 * 通用详情网格组件。
 * 职责：按 label/value 列表展示对象详情；只负责展示，不处理业务选择和提交逻辑。
 */
class HGDetailGridPage extends React.PureComponent {
  getColumnStyle = () => {
    const { columns = 2 } = this.props;
    const safeColumns = Math.max(1, Math.min(Number(columns) || 2, 6));
    return {
      gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))`,
    };
  };

  /**
   * 渲染详情字段。
   * @param {Object} item 字段配置 {label, value}
   * @returns {React.ReactNode} 字段节点
   */
  renderItem = (item) => {
    const { tooltipPlacement = "top", maxValueLines = 1 } = this.props;
    const value = item.value === undefined || item.value === null || item.value === "" ? "-" : item.value;
    const tooltipContent = `${item.label}：${value}`;
    const valueStyle = {
      WebkitLineClamp: Math.max(1, Number(maxValueLines) || 1),
    };

    return (
      <span key={item.label} className={styles.item}>
        <span className={styles.label}>{item.label}：</span>
        <HGTooltipPage
          content={tooltipContent}
          placement={tooltipPlacement}
          delay={120}
          className={styles.tooltipWrapper}
          contentClassName={styles.tooltipContent}
        >
          <span className={styles.value} style={valueStyle}>
            {value}
          </span>
        </HGTooltipPage>
      </span>
    );
  };

  render() {
    const { title, items = [], className = "" } = this.props;
    const rootClassName = [styles.card, className].filter(Boolean).join(" ");

    return (
      <div className={rootClassName}>
        {title ? <div className={styles.title}>{title}</div> : null}
        <div className={styles.grid} style={this.getColumnStyle()}>
          {items.map(this.renderItem)}
        </div>
      </div>
    );
  }
}

export default HGDetailGridPage;
