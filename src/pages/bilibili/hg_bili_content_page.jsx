import React from "react";
import { generatePath } from "react-router-dom";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import HGVideoPlayerPage from "../../components/hg_video_player/hg_video_player_page";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import withRouter from "../../utils/WithRouter";
import styles from "./hg_bili_content_page.module.css";
import HGBiliContentPageVM from "./hg_bili_content_page_vm";

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
          <HGVideoPlayerPage
            video={video}
            relatedVideos={relatedVideos}
            onVideoClick={this.handleVideoClick}
          />
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
