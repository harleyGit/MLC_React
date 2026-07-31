import React from "react";
import { generatePath } from "react-router-dom";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import HGVideoPlayerPage from "../../components/hg_video_player/hg_video_player_page";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import withRouter from "../../utils/WithRouter";
import styles from "./hg_bili_content_page.module.css";
import HGBiliContentPageVM from "./hg_bili_content_page_vm";

/** 格式化页面展示的播放量。 */
function formatCount(num) {
  return num >= 10000 ? `${(num / 10000).toFixed(1)}万` : String(num);
}

/**
 * 视频互动按钮图标。
 * @param {{type: "like"|"coin"|"star"|"share"}} props 图标类型。
 */
function VideoActionIcon({ type }) {
  const paths = {
    like: "M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3",
    coin: "M12 6v12M8 8h8M8 16h8",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    share: "M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {type === "coin" && <circle cx="12" cy="12" r="10" />}
      {type === "share" && (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
        </>
      )}
      <path d={paths[type]} />
    </svg>
  );
}

/**
 * B 站风格内容页。
 * 职责：根据路由展示频道推荐列表或独立视频播放页面。
 */
class HGBiliContentPage extends React.Component {
  /**
   * 从 pathname 中提取内容类型和标识，避免页面依赖函数式路由 Hook。
   * @returns {{contentType: string, contentKey: string}} 路由内容参数。
   */
  getRouteContent = () => {
    const pathParts = (this.props.location?.pathname || "").split("/").filter(Boolean);
    return {
      contentType: pathParts[2] || "channel",
      contentKey: decodeURIComponent(pathParts.slice(3).join("/")) || "popular",
    };
  };

  /**
   * 进入视频播放路由，并携带完整视频对象供播放器立即使用。
   * @param {Object} video 被点击的视频。
   */
  handleVideoClick = (video) => {
    this.props.navigate(
      generatePath(ROUTE_PATH.BILI_VIDEO_CONTENT, {
        contentKey: encodeURIComponent(video.id),
      }),
      {
        state: { video },
      },
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** 返回动画推荐首页。 */
  handleBackHome = () => {
    this.props.navigate(ROUTE_PATH.BILI_DOUGA);
  };

  /** 返回上一个历史页面，无历史时由浏览器保持当前页。 */
  handleBack = () => {
    this.props.navigate(-1);
  };

  /** 渲染视频标题、播放数据和页面级互动操作。 */
  renderVideoInfo = (video) => (
    <section className={styles.videoInfo}>
      <h1 className={styles.videoTitle}>{video.title}</h1>
      <div className={styles.videoMeta}>
        <span>{formatCount(video.play)}播放</span>
        <span>{video.danmaku}弹幕</span>
        <span>{video.pubDate}</span>
      </div>
      <div className={styles.videoActions}>
        {[
          { type: "like", label: "点赞" },
          { type: "coin", label: "投币" },
          { type: "star", label: "收藏" },
          { type: "share", label: "分享" },
        ].map((action) => (
          <button key={action.type} type="button" className={styles.actionButton}>
            <VideoActionIcon type={action.type} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );

  /** 渲染视频作者信息和关注入口。 */
  renderAuthorInfo = (video) => (
    <section className={styles.authorInfo}>
      <img
        className={styles.authorAvatar}
        src={video.authorAvatar || "https://via.placeholder.com/40"}
        alt={video.author}
      />
      <div className={styles.authorDetail}>
        <span className={styles.authorName}>{video.author}</span>
        <span className={styles.authorFans}>{video.authorFans || "0"}粉丝</span>
      </div>
      <button type="button" className={styles.followButton}>+ 关注</button>
    </section>
  );

  /** 渲染频道视频列表。 */
  renderChannel = (channelKey) => {
    const channel = HGBiliContentPageVM.getChannel(channelKey);
    const videos = HGBiliContentPageVM.getChannelVideos(channelKey);

    return (
      <main className={styles.channelContent}>
        <div className={styles.channelHeading}>
          <div>
            <span className={styles.eyebrow}>CHANNEL</span>
            <h1>{channel.label}</h1>
            <p>精选 {channel.label} 内容，点击任意视频进入独立播放页。</p>
          </div>
          <span className={styles.videoCount}>{videos.length} 个推荐</span>
        </div>
        <HGVideoGridPage
          videos={videos}
          onVideoClick={this.handleVideoClick}
          columns={5}
          hasMore={false}
        />
      </main>
    );
  };

  /** 渲染独立视频播放页。 */
  renderVideo = (videoId) => {
    const video = HGBiliContentPageVM.getVideo(videoId, this.props.location?.state?.video);
    const relatedVideos = HGBiliContentPageVM.getRelatedVideos(video);

    return (
      <main className={styles.playerLayout}>
        <section className={styles.playerMain}>
          <button type="button" className={styles.backButton} onClick={this.handleBack}>
            ← 返回上一页
          </button>
          <HGVideoPlayerPage video={video} />
          {this.renderVideoInfo(video)}
          {this.renderAuthorInfo(video)}
        </section>
        <aside className={styles.playerSidebar}>
          <h2>接下来播放</h2>
          <HGVideoGridPage
            videos={relatedVideos}
            layout="horizontal"
            onVideoClick={this.handleVideoClick}
            hasMore={false}
          />
        </aside>
      </main>
    );
  };

  render() {
    const { contentType, contentKey } = this.getRouteContent();

    return (
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}>
          <button type="button" className={styles.brand} onClick={this.handleBackHome}>
            <span className={styles.brandName}>bilibili</span>
            <span className={styles.brandLabel}>{contentType === "video" ? "视频" : "频道"}</span>
          </button>
          <button type="button" className={styles.homeButton} onClick={this.handleBackHome}>
            推荐首页
          </button>
        </header>
        {contentType === "video"
          ? this.renderVideo(contentKey)
          : this.renderChannel(contentKey)}
      </div>
    );
  }
}

const WrappedHGBiliContentPage = withRouter(HGBiliContentPage);
export default WrappedHGBiliContentPage;
