import React from "react";
import { generatePath } from "react-router-dom";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import withRouter from "../../utils/WithRouter";
import { getDougaTags, getVideoList, normalizeVideoListItem } from "./hg_bili_api";
import styles from "./hg_bili_douga.module.css";
import HGBiliContentPageVM from "./video_detail/hg_bili_content_page_vm";

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
      videos: [],
      loading: false,
      hasMore: false,
      page: 1,
      pageSize: 20,
      jumpPage: "",
      cursorByPage: { 1: "" },
      // 后端复合游标，格式由后端定义，前端只透传，不解析或转成数字。
      nextCursor: "",
    };
    this.requestSequence = 0;
    this.unmounted = false;
  }

  /**
   * 组件挂载后加载视频列表。
   */
  componentDidMount() {
    this.loadInitialData();
  }

  componentWillUnmount() {
    this.unmounted = true;
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
   * @param {number} page - 当前前端页码，仅用于保存 cursor 映射。
   * @param {number} pageSize - 当前每页条数，切换后必须重建 cursor 链。
   */
  fetchVideoList = async (tag = "推荐", cursor = "", page = 1, pageSize = this.state.pageSize) => {
    const sequence = ++this.requestSequence;
    this.setState({ loading: true });
    try {
      const response = await getVideoList(cursor, pageSize, tag === "推荐" ? "" : tag);
      if (this.unmounted || sequence !== this.requestSequence) return;
      if (Array.isArray(response?.videos)) {
        // 播放路由使用 videoId；评论按稿件聚合，因此必须同时保留 submissionId。
        const videos = response.videos.map(normalizeVideoListItem);

        this.setState((state) => {
          const cursorByPage = { ...state.cursorByPage };
          if (response.hasMore && response.nextCursor) {
            cursorByPage[page + 1] = response.nextCursor;
          } else {
            delete cursorByPage[page + 1];
          }
          return {
            videos,
            loading: false,
            hasMore: Boolean(response.hasMore),
            nextCursor: response.nextCursor || "",
            page,
            pageSize,
            jumpPage: "",
            cursorByPage,
          };
        });
      } else {
        this.setState({
          videos: [],
          hasMore: false,
          nextCursor: "",
        });
      }
    } catch (error) {
      if (!this.unmounted && sequence === this.requestSequence) {
        console.error("获取视频列表失败:", error);
        this.setState((state) => ({
          hasMore: state.videos.length > 0 ? state.hasMore : false,
          nextCursor: state.videos.length > 0 ? state.nextCursor : "",
        }));
      }
    } finally {
      if (!this.unmounted && sequence === this.requestSequence) this.setState({ loading: false });
    }
  };

  /**
   * 处理标签切换：重置 cursor 和页码，并从新标签首页开始加载。
   */
  handleTagChange = (tag) => {
    const { pageSize } = this.state;
    this.setState(
      { activeTag: tag, loading: true, page: 1, jumpPage: "", nextCursor: "", hasMore: false, cursorByPage: { 1: "" } },
      () => this.fetchVideoList(tag, "", 1, pageSize),
    );
  };

  /**
   * 处理视频点击，进入独立播放页。
   * @param {Object} video 被点击的视频。
   */
  handleVideoClick = (video) => {
    if (!video?.id || (video.playbackType !== "external_link" && !video.filePath)) return;
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
   * 使用已缓存的后端 cursor 跳转到指定页。
   */
  handlePageChange = (nextPage) => {
    const { activeTag, cursorByPage, loading, pageSize } = this.state;
    if (loading || nextPage < 1) return;
    const cursor = cursorByPage[nextPage];
    if (cursor === undefined) return;
    this.fetchVideoList(activeTag, cursor, nextPage, pageSize);
  };

  /** 切换每页条数后从首页重新建立与 pageSize 对应的 opaque cursor 链。 */
  handlePageSizeChange = (event) => {
    const pageSize = Number(event.target.value);
    if (!pageSize || pageSize === this.state.pageSize) return;
    this.setState(
      { pageSize, page: 1, jumpPage: "", cursorByPage: { 1: "" }, hasMore: false, nextCursor: "" },
      () => this.fetchVideoList(this.state.activeTag, "", 1, pageSize),
    );
  };

  /** opaque cursor 只能跳转到已获取 cursor 的页码，避免构造无效后端游标。 */
  handleQuickJump = () => {
    const nextPage = Number(this.state.jumpPage);
    if (!Number.isInteger(nextPage)) return;
    this.handlePageChange(nextPage);
  };

  /** 返回已发现 cursor 对应的页码，供用户直接跳转。 */
  getAvailablePages = () => Object.keys(this.state.cursorByPage)
    .map(Number)
    .filter(Number.isInteger)
    .sort((left, right) => left - right);

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
    const { videos, loading, page, pageSize, jumpPage, cursorByPage } = this.state;
    const availablePages = this.getAvailablePages();
    const maxAvailablePage = availablePages[availablePages.length - 1] || 1;

    return (
      <div className={styles.listContainer}>
        {/* 分区标题 */}
        {this.renderSectionTitle()}

        {/* 视频网格 */}
        <HGVideoGridPage
          videos={videos}
          onVideoClick={this.handleVideoClick}
          loading={loading}
          hasMore={false}
          columns={5}
        />
        <div className={styles.pagination}>
          <label className={styles.pageSizeControl}>
            每页
            <select value={pageSize} disabled={loading} onChange={this.handlePageSizeChange}>
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size} 条</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={loading || page <= 1} onClick={() => this.handlePageChange(page - 1)}>上一页</button>
          <div className={styles.pageNumbers}>
            {availablePages.map((availablePage) => (
              <button
                type="button"
                key={availablePage}
                disabled={loading}
                className={availablePage === page ? styles.activePage : ""}
                onClick={() => this.handlePageChange(availablePage)}
              >
                {availablePage}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={loading || cursorByPage[page + 1] === undefined}
            onClick={() => this.handlePageChange(page + 1)}
          >
            下一页
          </button>
          <label className={styles.quickJump}>
            跳至
            <input
              type="number"
              min="1"
              max={maxAvailablePage}
              value={jumpPage}
              disabled={loading}
              onChange={(event) => this.setState({ jumpPage: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") this.handleQuickJump();
              }}
            />
            页
          </label>
          <button
            type="button"
            disabled={loading || cursorByPage[Number(jumpPage)] === undefined}
            onClick={this.handleQuickJump}
          >
            跳转
          </button>
        </div>
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
