/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-30
 * @FilePath: /MLC_React/src/components/hg_user_card/hg_user_card_page.jsx
 * @Description: 用户信息卡片组件，展示头像、昵称、简介、关注/粉丝/播放量统计
 */
import React, { Component } from "react";
import styles from "./hg_user_card.module.css";

/**
 * 用户信息卡片组件
 * 职责：展示用户头像、昵称、签名、统计数据（关注、粉丝、播放量）
 * 约束：类组件，通过 props 接收用户数据
 */
class HGUserCardPage extends Component {
  /**
   * 格式化数字：大于10000显示为x.x万
   * @param {number} num 数字
   * @returns {string} 格式化后的字符串
   */
  formatNumber = (num) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + "万";
    }
    return String(num);
  };

  /**
   * 渲染统计数据
   * @returns {React.ReactNode} 统计节点
   */
  renderStats = () => {
    const { following, followers, plays } = this.props;
    return (
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{this.formatNumber(following)}</span>
          <span className={styles.statLabel}>关注</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{this.formatNumber(followers)}</span>
          <span className={styles.statLabel}>粉丝</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{this.formatNumber(plays)}</span>
          <span className={styles.statLabel}>播放</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染操作按钮
   * @returns {React.ReactNode} 按钮节点
   */
  renderActions = () => {
    const { onFollow, onMessage } = this.props;
    return (
      <div className={styles.actionsRow}>
        <button className={styles.followButton} onClick={onFollow}>
          + 关注
        </button>
        <button className={styles.messageButton} onClick={onMessage}>
          发消息
        </button>
      </div>
    );
  };

  render() {
    const { avatar, name, bio, level, uid } = this.props;
    return (
      <div className={styles.userCard}>
        <div className={styles.avatarWrapper}>
          <img src={avatar} alt={name} className={styles.avatar} />
          {level !== undefined && (
            <span className={styles.levelBadge}>Lv{level}</span>
          )}
        </div>
        <div className={styles.infoSection}>
          <div className={styles.nameRow}>
            <span className={styles.userName}>{name}</span>
            {uid && <span className={styles.uid}>UID:{uid}</span>}
          </div>
          {bio && <p className={styles.userBio}>{bio}</p>}
          {this.renderStats()}
          {this.renderActions()}
        </div>
      </div>
    );
  }
}

export default HGUserCardPage;
