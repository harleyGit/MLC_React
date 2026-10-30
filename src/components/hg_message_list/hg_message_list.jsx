/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-31 00:05:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-31 00:05:00
 * @FilePath: /MLC_React/src/components/hg_message_list/hg_message_list.jsx
 * @Description: 消息气泡列表组件，复用 HGCollectionView 的虚拟滚动/复用池/下拉刷新/上拉加载。
 */
import React from "react";
import HGCollectionView from "../hg_collection_view/hg_collection_view.jsx";
import { HGBounceBars } from "../hg_loading_animations/hg_loading_animations.jsx";
import HGIconPage from "../hg_icon/hg_icon_page.jsx";
import styles from "./hg_message_list.module.css";

/**
 * 消息类型常量：文字、图片、语音、视频、系统时间、表情贴纸、红包、联系人名片。
 * 约束：renderCell 依据 type 分派，未知类型回退为文字渲染。
 */
export const HG_MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  VOICE: "voice",
  VIDEO: "video",
  TIME: "time",
  EMOJI: "emoji",
  RED_PACKET: "red_packet",
  CARD: "card",
};

/**
 * 文字渲染：气泡内纯文本，保留换行。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 文字节点。
 */
const hgRenderText = (message) => <span className={styles.bubbleText}>{message.text}</span>;

/**
 * 图片渲染：SVG 占位插画 + 可选标题，点击回调冒泡到外层气泡。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 图片节点。
 */
const hgRenderImage = (message) => (
  <div className={styles.imageBox}>
    <div
      className={styles.imagePlaceholder}
      style={message.color ? { background: message.color } : undefined}
      role="img"
      aria-label={message.alt || "图片消息"}
    >
      <HGIconPage type="file" className={styles.imageIcon} />
    </div>
    {message.text ? <div className={styles.mediaCaption}>{message.text}</div> : null}
  </div>
);

/**
 * 语音渲染：静态音量柱 + 时长；播放中（message.playing）改用弹跳柱条动画。
 * 约束：柱条颜色跟随气泡文字色（currentColor），深浅气泡均自适应。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 语音节点。
 */
const hgRenderVoice = (message) => (
  <span className={styles.voiceBox}>
    {message.playing ? (
      <HGBounceBars size="small" className={styles.voicePlayingBars} />
    ) : (
      <span className={styles.voiceBars} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} className={styles.voiceBar} style={{ height: `${6 + ((index * 7) % 14)}px` }} />
        ))}
      </span>
    )}
    <span className={styles.voiceDuration}>{message.duration || 0}&quot;</span>
  </span>
);

/**
 * 视频渲染：带播放按钮的视频封面占位。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 视频节点。
 */
const hgRenderVideo = (message) => (
  <div className={styles.videoBox} role="img" aria-label={message.alt || "视频消息"}>
    <div
      className={styles.videoCover}
      style={message.color ? { background: message.color } : undefined}
    >
      <span className={styles.videoPlay}>
        <HGIconPage type="play" className={styles.videoPlayIcon} />
      </span>
    </div>
    {message.text ? <div className={styles.mediaCaption}>{message.text}</div> : null}
  </div>
);

/**
 * 表情渲染：大号贴纸，气泡内不套额外底色。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 表情节点。
 */
const hgRenderEmoji = (message) => (
  <span className={styles.emojiLarge} role="img" aria-label={message.alt || "表情"}>
    {message.text}
  </span>
);

/**
 * 红包渲染：橙色红包气泡（自带底色，气泡外层做透明处理）。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 红包节点。
 */
const hgRenderRedPacket = (message) => (
  <div className={styles.redPacketBox} role="img" aria-label="红包消息">
    <span className={styles.redPacketIcon} aria-hidden="true">¥</span>
    <span className={styles.redPacketText}>{message.text || "恭喜发财，大吉大利"}</span>
  </div>
);

/**
 * 联系人名片渲染：头像字 + 姓名与说明。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 名片节点。
 */
const hgRenderCard = (message) => (
  <div className={styles.cardBox}>
    <span className={styles.cardAvatar} aria-hidden="true">
      {(message.cardName || "联").slice(0, 1)}
    </span>
    <span className={styles.cardInfo}>
      <span className={styles.cardName}>{message.cardName || "联系人"}</span>
      <span className={styles.cardDesc}>{message.text || "个人名片"}</span>
    </span>
  </div>
);

/**
 * 根据消息类型分派渲染内容。
 * @param {object} message 消息对象。
 * @returns {React.ReactNode} 对应类型的内容节点。
 */
const hgRenderMessageContent = (message) => {
  switch (message.type) {
    case HG_MESSAGE_TYPES.IMAGE:
      return hgRenderImage(message);
    case HG_MESSAGE_TYPES.VOICE:
      return hgRenderVoice(message);
    case HG_MESSAGE_TYPES.VIDEO:
      return hgRenderVideo(message);
    case HG_MESSAGE_TYPES.EMOJI:
      return hgRenderEmoji(message);
    case HG_MESSAGE_TYPES.RED_PACKET:
      return hgRenderRedPacket(message);
    case HG_MESSAGE_TYPES.CARD:
      return hgRenderCard(message);
    case HG_MESSAGE_TYPES.TEXT:
    default:
      return hgRenderText(message);
  }
};

/**
 * 消息气泡列表组件。
 * 职责：以复用列表承载消息气泡，支持文字/图片/语音/视频/表情/时间分隔。
 * 输入：messages、currentUserId、onSendRead、onRefresh、loading、hasMore、onLoadMore。
 * 约束：复用 HGCollectionView 的虚拟滚动；cell 自身无业务状态，由 getKey 隔离。
 */
export default class HGMessageList extends React.Component {
  /**
   * 渲染顶部下拉刷新指示。
   * @returns {React.ReactNode} 指示节点。
   */
  renderRefreshIndicator = () => {
    const { loading } = this.props;
    if (!loading) return null;
    return <div className={styles.refreshHint}>下拉刷新…</div>;
  };

  /**
   * 渲染消息头像：有 avatar 图片字段时展示图片，否则回退为文字（发送者首字）。
   * @param {object} message 消息对象。
   * @param {boolean} isMine 是否本人发送。
   * @returns {React.ReactNode} 头像节点。
   */
  renderAvatar = (message, isMine) => {
    if (message.avatar) {
      return (
        <img
          className={styles.avatarImage}
          src={message.avatar}
          alt={message.sender || "头像"}
        />
      );
    }
    return <span className={styles.avatar}>{isMine ? "我" : message.sender || "友"}</span>;
  };

  /**
   * 渲染单条消息 cell（含气泡、头像、时间），作为 HGCollectionView 的 renderCell。
   * @param {object} message 消息对象。
   * @param {number} index 消息下标（复用池内业务 key，与列表 index 无关）。
   * @returns {React.ReactNode} 消息行节点。
   */
  renderCell = (message) => {
    if (message.type === HG_MESSAGE_TYPES.TIME) {
      return <div className={styles.timeRow}>{message.text}</div>;
    }

    const { currentUserId } = this.props;
    const isMine = message.from === "me" || message.userId === currentUserId;
    const rowClassName = `${styles.messageRow} ${
      isMine ? styles.messageRowMine : styles.messageRowPeer
    }`;
    // 红包/名片内容自带底色，外层气泡做透明处理避免双层描边。
    const isPlain =
      message.type === HG_MESSAGE_TYPES.RED_PACKET ||
      message.type === HG_MESSAGE_TYPES.CARD;
    const bubbleClassName = `${styles.bubble} ${
      isMine ? styles.bubbleMine : styles.bubblePeer
    } ${message.type === HG_MESSAGE_TYPES.EMOJI || isPlain ? styles.bubblePlain : ""}`;

    return (
      <div className={rowClassName}>
        {this.renderAvatar(message, isMine)}
        <div className={styles.messageBody}>
          <div
            className={bubbleClassName}
            onClick={() => this.props.onSendRead?.(message)}
          >
            {hgRenderMessageContent(message)}
          </div>
          {message.time ? <span className={styles.messageTime}>{message.time}</span> : null}
        </div>
      </div>
    );
  };

  /**
   * 渲染底部加载指示（复用组件本身已提供状态栏，这里补充自定义占位）。
   * @returns {React.ReactNode} 底部指示节点。
   */
  renderFooter = () => {
    const { loading, hasMore } = this.props;
    if (loading) return <div className={styles.loadingHint}>加载中…</div>;
    if (!hasMore) return <div className={styles.loadingHint}>没有更多消息</div>;
    return null;
  };

  render() {
    const {
      messages,
      loading,
      hasMore,
      onRefresh,
      onLoadMore,
      height,
    } = this.props;

    return (
      <div className={styles.listRoot}>
        <HGCollectionView
          items={messages}
          getKey={(message) => message.id}
          renderCell={this.renderCell}
          loading={loading}
          hasMore={hasMore}
          onRefresh={onRefresh}
          onLoadMore={onLoadMore}
          height={height}
          ariaLabel="消息列表"
          emptyText="暂无消息"
          loadedText="没有更多消息"
        />
        {this.renderFooter()}
      </div>
    );
  }
}
