import React from "react";
import styles from "./hg_video_grid.module.css";

/**
 * 格式化播放量数字。
 * @param {number} num - 播放量数字。
 * @returns {string} 格式化后的字符串。
 */
function formatPlayCount(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return String(num);
}

/**
 * 格式化时长（秒 -> mm:ss）。
 * @param {number} seconds - 秒数。
 * @returns {string} 格式化后的时长字符串。
 */
function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/**
 * 格式化发布时间。
 * @param {string} dateStr - 日期字符串。
 * @returns {string} 格式化后的发布时间。
 */
function formatPubDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 0 ? "刚刚" : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  }
  if (days === 1) return "昨天";
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

/**
 * 视频卡片组件（PureComponent）。
 * 职责：渲染单个视频卡片，包含封面、标题、播放量、作者等信息。
 */
class VideoCard extends React.PureComponent {
  /**
   * 处理整个卡片点击。
   */
  handleClick = () => {
    const { video, onClick } = this.props;
    if (onClick) onClick(video);
  };

  /**
   * 处理作者名称点击，跳转到用户空间页面。
   * @param {Event} e - 点击事件对象
   */
  handleAuthorClick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击
    const { video, onAuthorClick } = this.props;
    if (onAuthorClick && video) {
      onAuthorClick(video);
    }
  };

  render() {
    const { video, layout } = this.props;
    if (!video) return null;

    const isHorizontal = layout === "horizontal";

    return (
      <div
        className={`${styles.videoCard} ${isHorizontal ? styles.videoCardHorizontal : ""}`}
        onClick={this.handleClick}
      >
        {/* 封面区域 */}
        <div className={styles.coverWrapper}>
          <img
            className={styles.coverImage}
            src={video.cover}
            alt={video.title}
            loading="lazy"
          />
          {/* 时长标签 */}
          <span className={styles.durationTag}>{formatDuration(video.duration)}</span>
          {/* 播放量覆盖层 */}
          <div className={styles.coverOverlay}>
            <span className={styles.playIcon}>▶</span>
            <span className={styles.playCount}>{formatPlayCount(video.play)}</span>
            <span className={styles.danmakuIcon}>💬</span>
            <span className={styles.danmakuCount}>{video.danmaku}</span>
          </div>
        </div>

        {/* 信息区域 */}
        <div className={styles.infoWrapper}>
          {/* 标题 */}
          <h3 className={styles.videoTitle} title={video.title}>
            {video.title}
          </h3>
          {/* 底部信息 */}
          <div className={styles.metaInfo}>
            {/* 作者名称，点击可进入用户空间 */}
            <span
              className={styles.author}
              onClick={this.handleAuthorClick}
              style={{ cursor: "pointer" }}
              title={`查看 ${video.author} 的空间`}
            >
              {video.author}
            </span>
            <span className={styles.pubDate}>{formatPubDate(video.pubDate)}</span>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * 视频网格组件，模仿 B 站视频列表布局。
 *
 * 功能：
 *   - 支持网格布局（默认）和水平布局
 *   - 支持分区标签切换
 *   - 支持加载更多
 *   - 支持虚拟滚动（可选）
 *
 * 输入：videos, layout, tags, activeTag, onTagChange, onVideoClick, onLoadMore, loading。
 */
class HGVideoGridPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTag: props.activeTag || (props.tags && props.tags[0]) || "推荐",
    };
  }

  /**
   * 处理标签切换。
   */
  handleTagChange = (tag) => {
    this.setState({ activeTag: tag });
    const { onTagChange } = this.props;
    if (onTagChange) onTagChange(tag);
  };

  /**
   * 处理视频点击。
   */
  handleVideoClick = (video) => {
    const { onVideoClick } = this.props;
    if (onVideoClick) onVideoClick(video);
  };

  /**
   * 处理作者点击，跳转到用户空间页面。
   * @param {Object} video - 视频对象，包含作者信息
   */
  handleAuthorClick = (video) => {
    // 如果视频有 uid，使用 uid 跳转；否则使用作者名称作为标识
    const uid = video.uid || video.authorId || video.author;
    // 使用 window.location.href 进行页面跳转
    // 这种方式适用于类组件，避免使用 hooks
    window.location.href = `/space/${encodeURIComponent(uid)}`;
  };

  /**
   * 渲染标签栏。
   */
  renderTags = () => {
    const { tags } = this.props;
    const { activeTag } = this.state;
    if (!tags || tags.length === 0) return null;

    return (
      <div className={styles.tagBar}>
        {tags.map((tag) => (
          <button
            key={tag}
            className={`${styles.tagBtn} ${activeTag === tag ? styles.tagBtnActive : ""}`}
            onClick={() => this.handleTagChange(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    );
  };

  /**
   * 渲染视频网格。
   */
  renderGrid = () => {
    const { videos = [], layout = "grid", columns = 4 } = this.props;
    if (videos.length === 0) {
      return <div className={styles.emptyText}>暂无视频</div>;
    }

    const gridStyle = layout === "grid" ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : {};

    return (
      <div className={`${styles.videoGrid} ${layout === "horizontal" ? styles.videoGridHorizontal : ""}`} style={gridStyle}>
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            layout={layout}
            onClick={this.handleVideoClick}
            onAuthorClick={this.handleAuthorClick}
          />
        ))}
      </div>
    );
  };

  /**
   * 渲染加载更多按钮。
   */
  renderLoadMore = () => {
    const { loading, hasMore } = this.props;
    if (!hasMore) return null;

    return (
      <div className={styles.loadMoreWrapper}>
        <button
          className={styles.loadMoreBtn}
          onClick={this.props.onLoadMore}
          disabled={loading}
        >
          {loading ? "加载中..." : "加载更多"}
        </button>
      </div>
    );
  };

  /**
   * 渲染 loading 遮罩。
   */
  renderLoading = () => {
    const { loading } = this.props;
    if (!loading) return null;

    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} />
      </div>
    );
  };

  render() {
    const { className = "" } = this.props;

    return (
      <div className={`${styles.gridContainer} ${className}`}>
        {this.renderLoading()}
        {this.renderTags()}
        {this.renderGrid()}
        {this.renderLoadMore()}
      </div>
    );
  }
}

export default HGVideoGridPage;