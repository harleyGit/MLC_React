import React from "react";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import HGVideoPlayerPage from "../../components/hg_video_player/hg_video_player_page";
import withRouter from "../../utils/WithRouter";
import { getVideoList } from "./hg_bili_api";
import styles from "./hg_bili_douga.module.css";
import { DOUGA_TAGS, generateMockVideos, HOT_VIDEOS } from "./hg_mock_data";

/**
 * B 站动画区页面。
 * 职责：模仿 B 站动画区 (https://www.bilibili.com/c/douga/) 的页面布局和交互。
 *
 * 功能：
 *   - 分区标签导航
 *   - 视频卡片网格展示
 *   - 视频播放页面
 *   - 相关视频推荐
 */
class BiliDougaPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTag: "推荐",
      videos: HOT_VIDEOS,
      loading: false,
      hasMore: true,
      page: 1,
      // 播放页状态
      showPlayer: false,
      currentVideo: null,
      relatedVideos: [],
    };
  }

  /**
   * 组件挂载后加载视频列表。
   */
  componentDidMount() {
    this.fetchVideoList(this.state.activeTag);
  }

  /**
   * 从后端获取视频列表。
   * @param {string} tag - 分区标签，用于过滤视频。
   */
  fetchVideoList = async (tag = "推荐") => {
    this.setState({ loading: true });
    try {
      const response = await getVideoList("", 20);
      if (response && response.videos) {
        const videos = response.videos.map((item) => ({
          id: item.videoId || item.submissionId,
          title: item.title,
          cover: item.coverUrl || "",
          url: item.filePath || "",
          author: item.userId,
          play: Math.floor(Math.random() * 100000),
          danmaku: Math.floor(Math.random() * 10000),
          duration: "00:00",
          category: item.category,
          description: item.description,
          filePath: item.filePath,
        }));

        // 按标签过滤视频（如果后端不支持标签过滤，则在客户端过滤）
        const filteredVideos = videos.filter((video) => {
          // 如果视频有 category 字段，则按 category 过滤
          if (video.category) {
            return video.category === tag;
          }
          // 如果没有 category 字段，则返回所有视频（或根据其他逻辑过滤）
          return true;
        });

        this.setState({
          videos: filteredVideos.length > 0 ? filteredVideos : videos,
          loading: false,
        });
      }
    } catch (error) {
      console.error("获取视频列表失败，使用本地数据:", error);
      this.setState({ loading: false });
    }
  };

  /**
   * 处理标签切换。
   */
  handleTagChange = (tag) => {
    this.setState({ activeTag: tag, loading: true, page: 1 });

    // 模拟接口请求
    /* setTimeout(() => {
      const videos = generateMockVideos(tag, 20);
      this.setState({ videos, loading: false });
    }, 500); */
    // 使用 fetchVideoList 请求接口数据
    this.fetchVideoList(tag);
  };

  /**
   * 处理视频点击（进入播放页）。
   */
  handleVideoClick = (video) => {
    const { activeTag } = this.state;
    const relatedVideos = generateMockVideos(activeTag, 8).filter(
      (v) => v.id !== video.id
    );

    this.setState({
      showPlayer: true,
      currentVideo: video,
      relatedVideos,
    });

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * 返回列表页。
   */
  handleBackToList = () => {
    this.setState({ showPlayer: false, currentVideo: null });
  };

  /**
   * 处理加载更多。
   */
  handleLoadMore = () => {
    const { page, videos, activeTag } = this.state;
    this.setState({ loading: true });

    // 模拟接口请求
    setTimeout(() => {
      const newVideos = generateMockVideos(activeTag, 12);
      this.setState({
        videos: [...videos, ...newVideos],
        loading: false,
        page: page + 1,
      });
    }, 800);
  };

  /**
   * 渲染页面头部（B 站风格）。
   */
  renderHeader = () => {
    return (
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo} onClick={this.handleBackToList}>
            <span className={styles.logoText}>bilibili</span>
            <span className={styles.logoSub}>动画</span>
          </div>
          <div className={styles.headerNav}>
            <span className={styles.navItem}>首页</span>
            <span className={styles.navItem}>排行榜</span>
            <span className={styles.navItem}>番剧列表</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染分区标题。
   */
  renderSectionTitle = () => {
    const { activeTag } = this.state;

    return (
      <div className={styles.sectionTitle}>
        <h2 className={styles.titleText}>{activeTag}</h2>
        <div className={styles.titleActions}>
          <button
            className={styles.refreshBtn}
            onClick={() => this.handleTagChange(activeTag)}
          >
            ↻ 换一换
          </button>
        </div>
      </div>
    );
  };

  /**
   * 渲染列表视图。
   */
  renderListView = () => {
    const { videos, loading, hasMore, activeTag } = this.state;

    return (
      <div className={styles.listContainer}>
        {/* 分区标题 */}
        {this.renderSectionTitle()}

        {/* 视频网格 */}
        <HGVideoGridPage
          videos={videos}
          tags={DOUGA_TAGS}
          activeTag={activeTag}
          onTagChange={this.handleTagChange}
          onVideoClick={this.handleVideoClick}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={this.handleLoadMore}
          columns={5}
        />
      </div>
    );
  };

  /**
   * 渲染播放视图。
   */
  renderPlayerView = () => {
    const { currentVideo, relatedVideos } = this.state;

    return (
      <div className={styles.playerContainer}>
        <div className={styles.playerContent}>
          {/* 返回按钮 */}
          <button className={styles.backBtn} onClick={this.handleBackToList}>
            ← 返回列表
          </button>

          {/* 播放器 */}
          <HGVideoPlayerPage
            video={currentVideo}
            relatedVideos={relatedVideos}
            onVideoClick={this.handleVideoClick}
          />
        </div>

        {/* 侧边栏推荐 */}
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>推荐视频</h3>
          <HGVideoGridPage
            videos={relatedVideos}
            layout="horizontal"
            onVideoClick={this.handleVideoClick}
          />
        </div>
      </div>
    );
  };

  render() {
    const { showPlayer } = this.state;

    return (
      <div className={styles.pageContainer}>
        {this.renderHeader()}
        {showPlayer ? this.renderPlayerView() : this.renderListView()}
      </div>
    );
  }
}

const WrappedBiliDougaPage = withRouter(BiliDougaPage);
export default WrappedBiliDougaPage;
