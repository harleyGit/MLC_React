/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-30
 * @FilePath: /MLC_React/src/components/hg_video_card/hg_video_card_page.jsx
 * @Description: 视频卡片组件，展示视频封面、标题、播放量、时长
 */
import React, { Component } from "react";
import styles from "./hg_video_card.module.css";

/**
 * 格式化播放量
 * @param {number} num 播放量
 * @returns {string} 格式化后的字符串
 */
const formatPlayCount = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return String(num);
};

/**
 * 格式化时长（秒 -> mm:ss）
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时长
 */
const formatDuration = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

/**
 * 视频卡片组件
 * 职责：展示视频封面缩略图、标题、播放量、时长、发布时间
 * props:
 * - cover: string 封面图地址
 * - title: string 视频标题
 * - playCount: number 播放量
 * - duration: number 时长（秒）
 * - publishTime: string 发布时间
 * - onClick: () => void 点击回调
 */
class HGVideoCardPage extends Component {
  render() {
    const { cover, title, playCount, duration, publishTime, onClick } = this.props;
    return (
      <div className={styles.videoCard} onClick={onClick}>
        <div className={styles.coverWrapper}>
          <img src={cover} alt={title} className={styles.cover} />
          {duration !== undefined && (
            <span className={styles.duration}>{formatDuration(duration)}</span>
          )}
        </div>
        <div className={styles.infoSection}>
          <h4 className={styles.title} title={title}>{title}</h4>
          <div className={styles.metaRow}>
            <span className={styles.playCount}>
              <svg className={styles.playIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {formatPlayCount(playCount)}
            </span>
            {publishTime && <span className={styles.publishTime}>{publishTime}</span>}
          </div>
        </div>
      </div>
    );
  }
}

export default HGVideoCardPage;
