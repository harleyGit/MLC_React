/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-29
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/components/hg_status_tag/hg_status_tag_page.jsx
 * @Description: 状态标签组件，带圆点的语义化状态徽标（启用/禁用/审核中等场景通用）
 */
import React from "react";
import styles from "./hg_status_tag.module.css";

/** 语义色调映射：success 成功 / error 失败或禁用 / warning 警告 / info 信息 / neutral 中性。 */
const TONE_CLASS_MAP = {
  success: styles.toneSuccess,
  error: styles.toneError,
  warning: styles.toneWarning,
  info: styles.toneInfo,
  neutral: styles.toneNeutral,
};

/**
 * 状态标签组件。
 * 职责：以圆点 + 文本的胶囊形式展示状态，只负责展示。
 *
 * Props:
 * - tone: 语义色调，默认 neutral。
 * - dot: 是否展示前置圆点，默认 true。
 * - children: 标签文本。
 */
class HGStatusTagPage extends React.PureComponent {
  render() {
    const { tone = "neutral", dot = true, children } = this.props;
    const rootClass = [
      styles.statusTag,
      TONE_CLASS_MAP[tone] || TONE_CLASS_MAP.neutral,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span className={rootClass}>
        {dot ? <span className={styles.dot} /> : null}
        {children}
      </span>
    );
  }
}

export default HGStatusTagPage;
