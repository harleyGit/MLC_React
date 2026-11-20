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
/** @extends {React.PureComponent<Partial<typeof HGDetailGridPage.defaultProps>>} */
class HGDetailGridPage extends React.PureComponent {
  static defaultProps = {
    /** 详情区标题，默认 undefined 不展示。 @type {React.ReactNode} */
    title: undefined,
    /** 详情字段列表，默认 []；每项提供 label、value，可携带展示配置。 @type {Array<any>} */
    items: [],
    /** 网格列数，默认 2；小屏仍由响应式样式调整。 */
    columns: 2,
    /** 溢出内容提示方向，默认 top。 */
    tooltipPlacement: "top",
    /** 字段值最多显示的行数，默认 1，超出时通过提示查看。 */
    maxValueLines: 1,
    /** 根节点附加样式类，默认空字符串。 */
    className: "",
  };

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
