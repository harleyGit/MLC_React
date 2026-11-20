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
/**
 * @typedef {object} HGVideoCardDataProps
 * @property {number} playCount 播放次数，必传，无默认值；由调用方提供真实统计。
 */
/** @extends {Component<Partial<typeof HGVideoCardPage.defaultProps> & HGVideoCardDataProps>} */
class HGVideoCardPage extends Component {
  static defaultProps = {
    /** 封面图片地址，默认 undefined 无图片源。 @type {string|undefined} */
    cover: undefined,
    /** 视频标题及图片替代文字，默认空字符串。 */
    title: "",
    /** 时长（秒），默认 undefined 隐藏时长标签，不把未知时长显示成 0。 @type {number|undefined} */
    duration: undefined,
    /** 已格式化发布时间，默认空字符串不展示。 */
    publishTime: "",
    /** 卡片点击通知，默认 undefined 不跳转。 @type {React.MouseEventHandler<HTMLDivElement>|undefined} */
    onClick: undefined,
  };

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
