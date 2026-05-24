import React from "react";
import styles from "./hg_video_player.module.css";

/**
 * 格式化时长（秒 -> mm:ss）。
 * @param {number} seconds - 秒数。
 * @returns {string} 格式化后的时长字符串。
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/**
 * 格式化播放量数字。
 * @param {number} num - 播放量数字。
 * @returns {string} 格式化后的字符串。
 */
function formatCount(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return String(num);
}

/**
 * 视频播放组件，模仿 B 站播放器风格。
 *
 * 功能：
 *   - 视频播放/暂停
 *   - 进度条拖拽
 *   - 音量控制
 *   - 全屏切换
 *   - 播放速度调节
 *   - 弹幕显示（模拟）
 *
 * 输入：video（视频信息）、relatedVideos（相关视频列表）、onVideoClick。
 */
class HGVideoPlayerPage extends React.Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.progressBarRef = React.createRef();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      isFullscreen: false,
      showControls: true,
      playbackRate: 1,
      showRateMenu: false,
      showDanmaku: true,
      danmakuList: [],
    };
    this.controlsTimer = null;
  }

  componentDidMount() {
    this.initDanmaku();
  }

  componentWillUnmount() {
    if (this.controlsTimer) {
      clearTimeout(this.controlsTimer);
    }
  }

  /**
   * 初始化弹幕数据（模拟）。
   */
  initDanmaku = () => {
    const { video } = this.props;
    if (!video) return;

    const mockDanmaku = [
      { id: 1, time: 2, text: "前排", color: "#fff" },
      { id: 2, time: 5, text: "来了来了", color: "#fe0302" },
      { id: 3, time: 8, text: "太强了", color: "#00ff00" },
      { id: 4, time: 12, text: "哈哈哈哈哈", color: "#fff" },
      { id: 5, time: 15, text: "草", color: "#fe0302" },
      { id: 6, time: 18, text: "绝了", color: "#00ff00" },
      { id: 7, time: 22, text: "好家伙", color: "#fff" },
      { id: 8, time: 25, text: "太强了", color: "#fe0302" },
      { id: 9, time: 30, text: "awsl", color: "#00ff00" },
      { id: 10, time: 35, text: "下次一定", color: "#fff" },
    ];
    this.setState({ danmakuList: mockDanmaku });
  };

  /**
   * 处理播放/暂停。
   */
  togglePlay = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play();
      this.setState({ isPlaying: true });
    } else {
      videoEl.pause();
      this.setState({ isPlaying: false });
    }
    this.resetControlsTimer();
  };

  /**
   * 处理时间更新。
   */
  handleTimeUpdate = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;

    this.setState({
      currentTime: videoEl.currentTime,
      duration: videoEl.duration || 0,
    });
  };

  /**
   * 处理进度条点击。
   */
  handleProgressClick = (e) => {
    const progressBar = this.progressBarRef.current;
    const videoEl = this.videoRef.current;
    if (!progressBar || !videoEl) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = pos * videoEl.duration;
  };

  /**
   * 处理音量变化。
   */
  handleVolumeChange = (e) => {
    const volume = parseFloat(e.target.value);
    const videoEl = this.videoRef.current;
    if (videoEl) {
      videoEl.volume = volume;
    }
    this.setState({ volume, isMuted: volume === 0 });
  };

  /**
   * 切换静音。
   */
  toggleMute = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;

    const newMuted = !this.state.isMuted;
    videoEl.muted = newMuted;
    this.setState({ isMuted: newMuted });
  };

  /**
   * 切换全屏。
   */
  toggleFullscreen = () => {
    const { isFullscreen } = this.state;
    if (!isFullscreen) {
      this.playerRef.requestFullscreen?.() ||
        this.playerRef.webkitRequestFullscreen?.() ||
        this.playerRef.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.msExitFullscreen?.();
    }
    this.setState({ isFullscreen: !isFullscreen });
  };

  /**
   * 设置播放速度。
   */
  setPlaybackRate = (rate) => {
    const videoEl = this.videoRef.current;
    if (videoEl) {
      videoEl.playbackRate = rate;
    }
    this.setState({ playbackRate: rate, showRateMenu: false });
  };

  /**
   * 切换弹幕显示。
   */
  toggleDanmaku = () => {
    this.setState({ showDanmaku: !this.state.showDanmaku });
  };

  /**
   * 重置控件显示计时器。
   */
  resetControlsTimer = () => {
    if (this.controlsTimer) {
      clearTimeout(this.controlsTimer);
    }
    this.setState({ showControls: true });
    this.controlsTimer = setTimeout(() => {
      if (this.state.isPlaying) {
        this.setState({ showControls: false });
      }
    }, 3000);
  };

  /**
   * 处理鼠标移动（显示控件）。
   */
  handleMouseMove = () => {
    this.resetControlsTimer();
  };

  /**
   * 渲染弹幕层。
   */
  renderDanmaku = () => {
    const { showDanmaku, danmakuList, currentTime } = this.state;
    if (!showDanmaku) return null;

    const visibleDanmaku = danmakuList.filter(
      (d) => Math.abs(d.time - currentTime) < 3
    );

    return (
      <div className={styles.danmakuLayer}>
        {visibleDanmaku.map((danmaku, idx) => (
          <div
            key={danmaku.id}
            className={styles.danmakuItem}
            style={{
              color: danmaku.color,
              top: `${(idx * 30) % 200}px`,
              animationDelay: `${idx * 0.5}s`,
            }}
          >
            {danmaku.text}
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染播放控件。
   */
  renderControls = () => {
    const {
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      showRateMenu,
      playbackRate,
      showDanmaku,
    } = this.state;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className={`${styles.controls} ${this.state.showControls ? styles.controlsVisible : ""}`}>
        {/* 进度条 */}
        <div
          className={styles.progressBar}
          ref={this.progressBarRef}
          onClick={this.handleProgressClick}
        >
          <div className={styles.progressBg}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            <div className={styles.progressThumb} style={{ left: `${progress}%` }} />
          </div>
        </div>

        {/* 底部控件 */}
        <div className={styles.controlsBottom}>
          <div className={styles.controlsLeft}>
            {/* 播放/暂停 */}
            <button className={styles.controlBtn} onClick={this.togglePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* 时间显示 */}
            <span className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.controlsRight}>
            {/* 弹幕开关 */}
            <button
              className={`${styles.controlBtn} ${showDanmaku ? styles.controlBtnActive : ""}`}
              onClick={this.toggleDanmaku}
            >
              弹
            </button>

            {/* 播放速度 */}
            <div className={styles.rateWrapper}>
              <button
                className={styles.controlBtn}
                onClick={() => this.setState({ showRateMenu: !showRateMenu })}
              >
                {playbackRate}x
              </button>
              {showRateMenu && (
                <div className={styles.rateMenu}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      className={`${styles.rateOption} ${playbackRate === rate ? styles.rateOptionActive : ""}`}
                      onClick={() => this.setPlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 音量 */}
            <div className={styles.volumeWrapper}>
              <button className={styles.controlBtn} onClick={this.toggleMute}>
                {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              <input
                className={styles.volumeSlider}
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={this.handleVolumeChange}
              />
            </div>

            {/* 全屏 */}
            <button className={styles.controlBtn} onClick={this.toggleFullscreen}>
              ⛶
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染视频信息。
   */
  renderVideoInfo = () => {
    const { video } = this.props;
    if (!video) return null;

    return (
      <div className={styles.videoInfo}>
        <h1 className={styles.videoTitle}>{video.title}</h1>
        <div className={styles.videoMeta}>
          <span className={styles.playCount}>{formatCount(video.play)}播放</span>
          <span className={styles.danmakuCount}>{video.danmaku}弹幕</span>
          <span className={styles.pubDate}>{video.pubDate}</span>
        </div>
        <div className={styles.videoActions}>
          <button className={styles.actionBtn}>
            <span className={styles.actionIcon}>👍</span>
            <span>点赞</span>
          </button>
          <button className={styles.actionBtn}>
            <span className={styles.actionIcon}>🪙</span>
            <span>投币</span>
          </button>
          <button className={styles.actionBtn}>
            <span className={styles.actionIcon}>⭐</span>
            <span>收藏</span>
          </button>
          <button className={styles.actionBtn}>
            <span className={styles.actionIcon}>↗</span>
            <span>分享</span>
          </button>
        </div>
      </div>
    );
  };

  /**
   * 渲染作者信息。
   */
  renderAuthorInfo = () => {
    const { video } = this.props;
    if (!video) return null;

    return (
      <div className={styles.authorInfo}>
        <div className={styles.authorAvatar}>
          <img src={video.authorAvatar || "https://via.placeholder.com/40"} alt={video.author} />
        </div>
        <div className={styles.authorDetail}>
          <span className={styles.authorName}>{video.author}</span>
          <span className={styles.authorFans}>{video.authorFans || "0"}粉丝</span>
        </div>
        <button className={styles.followBtn}>+ 关注</button>
      </div>
    );
  };

  /**
   * 渲染相关视频推荐。
   */
  renderRelatedVideos = () => {
    const { relatedVideos = [], onVideoClick } = this.props;
    if (relatedVideos.length === 0) return null;

    return (
      <div className={styles.relatedSection}>
        <h3 className={styles.relatedTitle}>相关推荐</h3>
        <div className={styles.relatedList}>
          {relatedVideos.map((video) => (
            <div
              key={video.id}
              className={styles.relatedItem}
              onClick={() => onVideoClick && onVideoClick(video)}
            >
              <div className={styles.relatedCover}>
                <img src={video.cover} alt={video.title} />
                <span className={styles.relatedDuration}>
                  {formatTime(video.duration)}
                </span>
              </div>
              <div className={styles.relatedInfo}>
                <h4 className={styles.relatedVideoTitle}>{video.title}</h4>
                <span className={styles.relatedAuthor}>{video.author}</span>
                <span className={styles.relatedPlay}>{formatCount(video.play)}播放</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  render() {
    const { video, className = "" } = this.props;
    if (!video) {
      return <div className={styles.emptyText}>请选择一个视频</div>;
    }

    return (
      <div className={`${styles.playerContainer} ${className}`}>
        {/* 播放器区域 */}
        <div
          className={styles.playerWrapper}
          ref={(ref) => (this.playerRef = ref)}
          onMouseMove={this.handleMouseMove}
          onClick={this.togglePlay}
        >
          <video
            ref={this.videoRef}
            className={styles.videoElement}
            src={video.url}
            onTimeUpdate={this.handleTimeUpdate}
            onEnded={() => this.setState({ isPlaying: false })}
          />
          {this.renderDanmaku()}
          {this.renderControls()}

          {/* 播放按钮覆盖层 */}
          {!this.state.isPlaying && (
            <div className={styles.playOverlay}>
              <div className={styles.playButton}>▶</div>
            </div>
          )}
        </div>

        {/* 视频信息 */}
        {this.renderVideoInfo()}

        {/* 作者信息 */}
        {this.renderAuthorInfo()}

        {/* 相关推荐 */}
        {this.renderRelatedVideos()}
      </div>
    );
  }
}

export default HGVideoPlayerPage;