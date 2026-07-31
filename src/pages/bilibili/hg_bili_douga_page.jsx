import React from "react";
import { generatePath } from "react-router-dom";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import withRouter from "../../utils/WithRouter";
import { getDougaTags, getVideoList } from "./hg_bili_api";
import styles from "./hg_bili_douga.module.css";
import { HOT_VIDEOS } from "./hg_mock_data";
import HGBiliContentPageVM from "./hg_bili_content_page_vm";

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
      // “推荐”是系统保留项，对应后端 tagName 为空的无过滤视频列表。
      activeTag: "推荐",
      // 顶部频道优先使用远端启用标签；接口返回前或无数据时使用 VM 默认频道。
      tags: [],
      videos: HOT_VIDEOS,
      loading: false,
      hasMore: true,
      page: 1,
      // 后端复合游标，格式由后端定义，前端只透传，不解析或转成数字。
      nextCursor: "",
    };
  }

  /**
   * 组件挂载后加载视频列表。
   */
  componentDidMount() {
    this.loadInitialData();
  }

  /**
   * 加载顶部频道标签，再按系统保留的“推荐”加载首屏视频。
   * 标签接口失败时顶部频道使用默认配置，视频列表仍可独立加载，避免两个请求相互阻断。
   */
  loadInitialData = async () => {
    try {
      const response = await getDougaTags();
      const remoteTags = (response?.list || []).map((item) => item.name).filter(Boolean);
      this.setState({ tags: remoteTags.filter((tag) => tag !== "推荐") });
    } catch (error) {
      console.error("动画标签加载失败:", error);
    }
    this.fetchVideoList("推荐");
  };

  /**
   * 从后端获取视频列表。
   * @param {string} tag - 视频标签；“推荐”会转换为空 tagName。
   * @param {string} cursor - 后端 nextCursor，空字符串表示首页。
   * @param {boolean} append - 是否追加到当前列表；false 时替换当前标签的数据。
   */
  fetchVideoList = async (tag = "推荐", cursor = "", append = false) => {
    this.setState({ loading: true });
    try {
      const response = await getVideoList(cursor, 20, tag === "推荐" ? "" : tag);
      if (response && response.videos) {
        const videos = response.videos.map((item) => ({
          id: item.videoId || item.submissionId,
          title: item.title,
          cover: item.coverUrl || "",
          url: item.filePath || "",
          author: item.userId,
          authorId: item.userId,
          play: Math.floor(Math.random() * 100000),
          danmaku: Math.floor(Math.random() * 10000),
          duration: Number(item.duration) || 0,
          category: item.category,
          description: item.description,
          filePath: item.filePath,
          pubDate: item.createdAt || new Date().toISOString(),
        }));

        this.setState((state) => ({
          videos: append ? [...state.videos, ...videos] : videos,
          loading: false,
          hasMore: Boolean(response.hasMore),
          nextCursor: response.nextCursor || "",
          page: append ? state.page + 1 : 1,
        }));
      }
    } catch (error) {
      console.error("获取视频列表失败，使用本地数据:", error);
      this.setState({ loading: false });
    }
  };

  /**
   * 处理标签切换：重置 cursor 和页码，并从新标签首页开始加载。
   */
  handleTagChange = (tag) => {
    this.setState({ activeTag: tag, loading: true, page: 1, nextCursor: "" });

    this.fetchVideoList(tag);
  };

  /**
   * 处理视频点击，进入独立播放页。
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

  /**
   * 进入指定频道页面。
   * @param {string} channelKey 频道标识。
   */
  handleChannelClick = (channelKey) => {
    this.props.navigate(
      generatePath(ROUTE_PATH.BILI_CHANNEL_CONTENT, {
        contentKey: encodeURIComponent(channelKey),
      }),
    );
  };

  /**
   * 处理加载更多；只在未加载、仍有下一页且后端返回有效 cursor 时发起请求。
   */
  handleLoadMore = () => {
    const { activeTag, nextCursor, loading, hasMore } = this.state;
    if (loading || !hasMore || !nextCursor) return;
    this.fetchVideoList(activeTag, nextCursor, true);
  };

  /**
   * 渲染页面头部（B 站风格）。
   */
  renderHeader = () => {
    const { tags } = this.state;
    const defaultPrimaryChannels = HGBiliContentPageVM.CHANNEL_NAV.primary;
    const primaryChannels = tags?.length
      ? tags.map((tag) => {
          const defaultChannel = defaultPrimaryChannels.find((item) => item.label === tag);
          return defaultChannel || { key: tag, label: tag };
        })
      : defaultPrimaryChannels;

    return (
      <nav className={styles.channelNav} aria-label="哔哩哔哩频道导航">
        <div className={styles.channelNavContent}>
          <div className={styles.featuredNav}>
            {HGBiliContentPageVM.CHANNEL_NAV.featured.map((item) => (
              <button
                type="button"
                key={item.key}
                className={styles.featuredItem}
                onClick={() => this.handleChannelClick(item.key)}
              >
                <img src={item.image} alt="" className={styles.featuredImage} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.primaryNav}>
            {primaryChannels.map((item) => (
              <button
                type="button"
                key={item.key}
                className={styles.primaryItem}
                onClick={() => this.handleChannelClick(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.secondaryNav}>
            {HGBiliContentPageVM.CHANNEL_NAV.secondary.map((item) => (
              <button
                type="button"
                key={item.key}
                className={styles.secondaryItem}
                onClick={() => this.handleChannelClick(item.key)}
              >
                <span className={styles.secondaryIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
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
    const { videos, loading, hasMore } = this.state;

    return (
      <div className={styles.listContainer}>
        {/* 分区标题 */}
        {this.renderSectionTitle()}

        {/* 视频网格 */}
        <HGVideoGridPage
          videos={videos}
          onVideoClick={this.handleVideoClick}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={this.handleLoadMore}
          columns={5}
        />
      </div>
    );
  };

  render() {
    return (
      <div className={styles.pageContainer}>
        {this.renderHeader()}
        {this.renderListView()}
      </div>
    );
  }
}

const WrappedBiliDougaPage = withRouter(BiliDougaPage);
export default WrappedBiliDougaPage;
