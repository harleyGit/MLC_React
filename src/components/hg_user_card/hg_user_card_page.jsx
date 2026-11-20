/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-07 17:34:57
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
/**
 * @typedef {object} HGUserCardDataProps
 * @property {number} following 关注人数，必传，无默认值；未知数据由调用方处理，不伪造为 0。
 * @property {number} followers 粉丝人数，必传，无默认值。
 * @property {number} plays 总播放次数，必传，无默认值。
 */
/** @extends {Component<Partial<typeof HGUserCardPage.defaultProps> & HGUserCardDataProps>} */
class HGUserCardPage extends Component {
  static defaultProps = {
    /** 用户头像地址，默认 undefined 无图片源。 @type {string|undefined} */
    avatar: undefined,
    /** 昵称及头像替代文字，默认空字符串。 */
    name: "",
    /** 用户简介，默认空字符串不展示。 */
    bio: "",
    /** 用户等级，默认 undefined 隐藏等级标记。 @type {number|undefined} */
    level: undefined,
    /** 用户标识，默认 undefined 隐藏 UID。 @type {string|number|undefined} */
    uid: undefined,
    /** 受控关注状态，默认 false 显示关注入口。 */
    isFollowed: false,
    /** 默认不提交关注；true 禁用关注按钮并显示处理中。 */
    followLoading: false,
    /** 点击关注通知，默认 undefined 不发起关注。 @type {React.MouseEventHandler<HTMLButtonElement>|undefined} */
    onFollow: undefined,
    /** 发消息入口通知，默认 undefined 不跳转。 @type {React.MouseEventHandler<HTMLButtonElement>|undefined} */
    onMessage: undefined,
  };

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
          <span className={styles.statValue}>
            {this.formatNumber(following)}
          </span>
          <span className={styles.statLabel}>关注</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {this.formatNumber(followers)}
          </span>
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
    const {
      onFollow,
      onMessage,
      isFollowed = false,
      followLoading = false,
    } = this.props;
    return (
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={`${styles.followButton} ${
            isFollowed ? styles.followButtonActive : ""
          }`}
          onClick={onFollow}
          disabled={followLoading}
          aria-pressed={isFollowed}
        >
          {followLoading ? "处理中..." : isFollowed ? "已关注" : "+ 关注"}
        </button>
        <button
          type="button"
          className={styles.messageButton}
          onClick={onMessage}
        >
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
