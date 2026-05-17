import React from "react";
import styles from "./hg_schedule_publish.module.css";

/**
 * 定时发布组件：开关控制，开启后选择发布时间。
 * @param {Object} props
 * @param {boolean} props.enabled 是否开启定时发布。
 * @param {string} props.publishTime 发布时间字符串。
 * @param {Function} props.onEnabledChange 开关变更回调。
 * @param {Function} props.onTimeChange 时间变更回调。
 */
class HGSchedulePublish extends React.Component {
  /**
   * 组件主渲染：开关 + 时间选择。
   * @returns {React.ReactNode} 定时发布 JSX。
   */
  render() {
    const { enabled, publishTime, onEnabledChange, onTimeChange } = this.props;

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={enabled}
              onChange={(e) => onEnabledChange?.(e.target.checked)}
            />
            <span className={styles.switchTrack}>
              <span className={styles.switchThumb} />
            </span>
            <span className={styles.switchText}>定时发布</span>
          </label>
          <span className={styles.hint}>
            可选择距离当前最早≥5分钟/最晚≤15天时间
          </span>
        </div>
        {enabled ? (
          <div className={styles.timeRow}>
            <input
              type="datetime-local"
              className={styles.timeInput}
              value={publishTime || ""}
              onChange={(e) => onTimeChange?.(e.target.value)}
            />
          </div>
        ) : null}
      </div>
    );
  }
}

export default HGSchedulePublish;
