import React from "react";
import { generatePath } from "react-router-dom";
import HGVideoGridPage from "../../components/hg_video_grid/hg_video_grid_page";
import HGVideoPlayerPage from "../../components/hg_video_player/hg_video_player_page";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import withRouter from "../../utils/WithRouter";
import HGVideoComments from "../video_commpent/hg_video_comments";
import {
  getVideoInteractionState,
  getBiliAuthorProfile,
  setAuthorFollow,
  setVideoInteraction,
} from "./hg_bili_api";
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
  constructor(props) {
    super(props);
    this.state = {
      interaction: {
        liked: false,
        favorited: false,
        followed: false,
        coinCount: 0,
        userCoinCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        shareCount: 0,
        followerCount: 0,
      },
      authorProfile: null,
      interactionLoading: false,
      pendingAction: "",
      interactionFeedback: "",
      interactionFeedbackError: false,
    };
    this.hgInteractionRequestSequence = 0;
  }

  /** 视频页挂载后读取当前登录用户的互动状态。 */
  componentDidMount() {
    this.loadCurrentVideoInteraction();
  }

  /** 相关推荐切换视频后重新读取互动状态，避免沿用上一个视频的数据。 */
  componentDidUpdate(prevProps) {
    if (prevProps.location?.pathname !== this.props.location?.pathname) {
      this.loadCurrentVideoInteraction();
    }
  }

  /**
   * 从 pathname 中提取内容类型和标识，避免页面依赖函数式路由 Hook。
   * @returns {{contentType: string, contentKey: string}} 路由内容参数。
   */
  getRouteContent = () => {
    const pathParts = (this.props.location?.pathname || "")
      .split("/")
      .filter(Boolean);
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
      }
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

  /** 读取当前路由视频及其作者标识并请求后端互动状态。 */
  loadCurrentVideoInteraction = () => {
    const { contentType, contentKey } = this.getRouteContent();
    if (contentType !== "video") return;
    const video = HGBiliContentPageVM.getVideo(
      contentKey,
      this.props.location?.state?.video
    );
    this.loadVideoInteraction(video);
  };

  /**
   * 加载指定视频互动状态；序列号用于丢弃快速切换视频产生的过期响应。
   * @param {Object} video 当前视频。
   */
  loadVideoInteraction = async (video) => {
    const requestSequence = ++this.hgInteractionRequestSequence;
    this.setState({
      interactionLoading: true,
      pendingAction: "",
      interactionFeedback: "",
      interactionFeedbackError: false,
      authorProfile: null,
    });
    this.loadAuthorProfile(video);

    try {
      const response = await getVideoInteractionState(
        video.submissionId || video.id,
        video.authorId || video.userId || ""
      );
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState({
        interaction: {
          liked: Boolean(response?.liked),
          favorited: Boolean(response?.favorited),
          followed: Boolean(response?.followed),
          coinCount: Number(response?.coinCount) || 0,
          userCoinCount: Number(response?.userCoinCount) || 0,
          likeCount: Number(response?.likeCount) || 0,
          favoriteCount: Number(response?.favoriteCount) || 0,
          shareCount: Number(response?.shareCount) || 0,
          followerCount: Number(response?.followerCount) || 0,
        },
        interactionLoading: false,
      });
    } catch (error) {
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState({
        interactionLoading: false,
        interactionFeedback: error?.message || "互动状态加载失败",
        interactionFeedbackError: true,
      });
    }
  };

  /** 独立加载作者公开资料，失败时保留视频中的 userId 回退展示。 */
  loadAuthorProfile = async (video) => {
    const userId = String(video.authorId || video.userId || "").trim();
    if (!userId) return;
    const requestSequence = this.hgInteractionRequestSequence;
    try {
      const profile = await getBiliAuthorProfile(userId);
      if (requestSequence === this.hgInteractionRequestSequence) {
        this.setState({ authorProfile: profile });
      }
    } catch (error) {
      console.error("作者资料加载失败:", error);
    }
  };

  /** 关注或取消关注当前视频作者，并在后端接受命令后更新按钮状态。 */
  handleAuthorFollow = async (video) => {
    const { interaction, interactionLoading, pendingAction } = this.state;
    if (interactionLoading || pendingAction) return;

    const requestSequence = this.hgInteractionRequestSequence;
    const active = !interaction.followed;
    const followeeId = video.authorId || video.userId || "";
    this.setState({
      pendingAction: "follow",
      interactionFeedback: "",
      interactionFeedbackError: false,
    });

    try {
      await setAuthorFollow(followeeId, active);
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState((state) => ({
        interaction: {
          ...state.interaction,
          followed: active,
        },
        pendingAction: "",
        interactionFeedback: active ? "关注成功" : "已取消关注",
        interactionFeedbackError: false,
      }));
    } catch (error) {
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState({
        pendingAction: "",
        interactionFeedback: error?.message || "关注操作失败，请稍后重试",
        interactionFeedbackError: true,
      });
    }
  };

  /**
   * 提交视频互动并在后端接受命令后更新页面状态和计数。
   * @param {Object} video 当前视频。
   * @param {"like"|"coin"|"favorite"|"share"} action 互动操作。
   */
  handleVideoAction = async (video, action) => {
    const { interaction, interactionLoading, pendingAction } = this.state;
    if (interactionLoading || pendingAction) return;
    const requestSequence = this.hgInteractionRequestSequence;

    const active =
      action === "like"
        ? !interaction.liked
        : action === "favorite"
        ? !interaction.favorited
        : true;
    const requestId =
      action === "coin"
        ? globalThis.crypto?.randomUUID?.() ||
          `coin_${Date.now()}_${Math.random().toString(16).slice(2)}`
        : "";

    this.setState({
      pendingAction: action,
      interactionFeedback: "",
      interactionFeedbackError: false,
    });

    try {
      await setVideoInteraction(video.submissionId || video.id, action, active, requestId);
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState((state) => {
        const nextInteraction = { ...state.interaction };
        if (action === "like") {
          nextInteraction.liked = active;
          nextInteraction.likeCount = Math.max(
            0,
            nextInteraction.likeCount + (active ? 1 : -1)
          );
        } else if (action === "favorite") {
          nextInteraction.favorited = active;
          nextInteraction.favoriteCount = Math.max(
            0,
            nextInteraction.favoriteCount + (active ? 1 : -1)
          );
        } else if (action === "coin") {
          nextInteraction.coinCount += 1;
          nextInteraction.userCoinCount += 1;
        } else if (action === "share") {
          nextInteraction.shareCount += 1;
        }

        const actionLabels = {
          like: active ? "点赞成功" : "已取消点赞",
          coin: "投币成功",
          favorite: active ? "收藏成功" : "已取消收藏",
          share: "分享已记录",
        };
        return {
          interaction: nextInteraction,
          pendingAction: "",
          interactionFeedback: actionLabels[action],
          interactionFeedbackError: false,
        };
      });
    } catch (error) {
      if (requestSequence !== this.hgInteractionRequestSequence) return;
      this.setState({
        pendingAction: "",
        interactionFeedback: error?.message || "互动操作失败，请稍后重试",
        interactionFeedbackError: true,
      });
    }
  };

  /** 渲染视频标题、播放数据和页面级互动操作。 */
  renderVideoInfo = (video) => {
    const {
      interaction,
      interactionLoading,
      pendingAction,
      interactionFeedback,
      interactionFeedbackError,
    } = this.state;
    const actions = [
      {
        type: "like",
        action: "like",
        label: "点赞",
        active: interaction.liked,
        count: interaction.likeCount,
      },
      {
        type: "coin",
        action: "coin",
        label: "投币",
        active: false,
        count: interaction.coinCount,
      },
      {
        type: "star",
        action: "favorite",
        label: "收藏",
        active: interaction.favorited,
        count: interaction.favoriteCount,
      },
      {
        type: "share",
        action: "share",
        label: "分享",
        active: false,
        count: interaction.shareCount,
      },
    ];

    return (
      <section className={styles.videoInfo}>
        <h1 className={styles.videoTitle}>{video.title}</h1>
        <div className={styles.videoMeta}>
          <span>{formatCount(video.play)}播放</span>
          <span>{video.danmaku}弹幕</span>
          <span>{video.pubDate}</span>
        </div>
        <div className={styles.videoActions}>
          {actions.map((item) => (
            <button
              key={item.action}
              type="button"
              className={`${styles.actionButton} ${
                item.active ? styles.actionButtonActive : ""
              }`}
              disabled={interactionLoading || Boolean(pendingAction)}
              aria-pressed={
                item.action === "like" || item.action === "favorite"
                  ? item.active
                  : undefined
              }
              onClick={() => this.handleVideoAction(video, item.action)}
            >
              <VideoActionIcon type={item.type} />
              <span>
                {pendingAction === item.action ? "处理中..." : item.label}
              </span>
              <span className={styles.actionCount}>
                {formatCount(item.count)}
              </span>
            </button>
          ))}
        </div>
        {interactionFeedback && (
          <p
            className={`${styles.interactionFeedback} ${
              interactionFeedbackError ? styles.interactionFeedbackError : ""
            }`}
            role={interactionFeedbackError ? "alert" : "status"}
          >
            {interactionFeedback}
          </p>
        )}
      </section>
    );
  };

  /** 渲染视频作者信息和关注入口。 */
  renderAuthorInfo = (video) => {
    const { interaction, interactionLoading, pendingAction } = this.state;
    const profile = this.state.authorProfile;
    const authorId = video.authorId || video.userId || profile?.userId || "";
    const authorName = profile?.displayName || video.author || authorId || "未知用户";
    const avatarURL = profile?.avatarUrl || video.authorAvatar || "";
    const followerCount = interaction.followerCount || Number(video.authorFans) || 0;
    const followerLabel = interaction.followerCount || !video.authorFans
      ? formatCount(followerCount)
      : String(video.authorFans);
    const followSubmitting = pendingAction === "follow";

    return (
      <section className={styles.authorInfo}>
        <button type="button" className={styles.authorIdentity} onClick={() => this.handleAuthorClick(video, profile)}>
          {avatarURL ? (
            <img className={styles.authorAvatar} src={avatarURL} alt={authorName} />
          ) : (
            <span className={styles.authorAvatarFallback}>{authorName.slice(0, 1)}</span>
          )}
          <span className={styles.authorDetail}>
            <span className={styles.authorName}>{authorName}</span>
            <span className={styles.authorFans}>{followerLabel}粉丝</span>
          </span>
        </button>
        <button
          type="button"
          className={`${styles.followButton} ${
            interaction.followed ? styles.followButtonActive : ""
          }`}
          disabled={interactionLoading || Boolean(pendingAction)}
          aria-pressed={interaction.followed}
          onClick={() => this.handleAuthorFollow(video)}
        >
          {followSubmitting
            ? "处理中..."
            : interaction.followed
            ? "已关注"
            : "+ 关注"}
        </button>
      </section>
    );
  };

  /** 点击作者身份进入 Bilibili 作者空间。 */
  handleAuthorClick = (video, profile) => {
    const userId = video.authorId || video.userId || profile?.userId;
    if (!userId) return;
    this.props.navigate(generatePath(ROUTE_PATH.BILI_AUTHOR_SPACE, { userId: encodeURIComponent(userId) }), {
      state: { profile },
    });
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
    const video = HGBiliContentPageVM.getVideo(
      videoId,
      this.props.location?.state?.video
    );
    const relatedVideos = HGBiliContentPageVM.getRelatedVideos(video);

    return (
      <main className={styles.playerLayout}>
        <section className={styles.playerMain}>
          <button
            type="button"
            className={styles.backButton}
            onClick={this.handleBack}
          >
            ← 返回上一页
          </button>
          <HGVideoPlayerPage key={String(video.id)} video={video} />
          {this.renderVideoInfo(video)}
          {this.renderAuthorInfo(video)}
          {/* 接口数据按 submissionId 聚合评论，本地回退视频仅有 id。 */}
          <HGVideoComments submissionId={video.submissionId || video.id} />
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
          <button
            type="button"
            className={styles.brand}
            onClick={this.handleBackHome}
          >
            <span className={styles.brandName}>bilibili</span>
            <span className={styles.brandLabel}>
              {contentType === "video" ? "视频" : "频道"}
            </span>
          </button>
          <button
            type="button"
            className={styles.homeButton}
            onClick={this.handleBackHome}
          >
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
