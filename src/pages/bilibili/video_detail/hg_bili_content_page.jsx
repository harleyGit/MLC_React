// 视频详情Page

import React from "react";
import HGVideoGridPage from "../../../components/hg_video_grid/hg_video_grid_page";
import HGVideoPlayerPage from "../../../components/hg_video_player/hg_video_player_page";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import withRouter from "../../../utils/WithRouter";
import HGVideoComments from "../../video_commpent/hg_video_comments";
import HGExternalPlayer from "../../../components/hg_external_player/hg_external_player";
import {
  getBiliAuthorProfile,
  getVideoDetail,
  normalizeVideoListItem,
  getVideoInteractionState,
  setAuthorFollow,
  setVideoInteraction,
} from "../hg_bili_api";
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
	  video: props.location?.state?.video || null,
	  videoLoading: false,
	  videoError: "",
	  hgSelectedPage: 1,
    };
    this.hgInteractionRequestSequence = 0;
	this.hgVideoRequestSequence = 0;
	this.hgUnmounted = false;
  }

  /** 视频页挂载后读取当前登录用户的互动状态。 */
  componentDidMount() {
	this.loadCurrentVideo();
  }

  /** 相关推荐切换视频后重新读取互动状态，避免沿用上一个视频的数据。 */
  componentDidUpdate(prevProps) {
    if (prevProps.location?.pathname !== this.props.location?.pathname) {
	  this.loadCurrentVideo();
    }
  }

  /** 卸载后丢弃在途详情及互动响应。 */
  componentWillUnmount() {
	this.hgUnmounted = true;
	this.hgVideoRequestSequence += 1;
	this.hgInteractionRequestSequence += 1;
  }

  /** 外部列表只含摘要，始终回源自有详情API；序列号隔离快速切换产生的旧响应。 */
  loadCurrentVideo = async () => {
	const { contentType, contentKey } = this.getRouteContent();
	const hgSequence = ++this.hgVideoRequestSequence;
	this.hgInteractionRequestSequence += 1;
	if (contentType !== "video") return;
	const routeVideo = this.props.location?.state?.video;
	if (routeVideo && String(routeVideo.id) === String(contentKey) && routeVideo.playbackType !== "external_link") {
	  this.setState({ video: routeVideo, videoLoading: false, videoError: "" }, () => this.loadVideoInteraction(routeVideo));
	  return;
	}
	this.setState({ video: null, videoLoading: true, videoError: "", hgSelectedPage: 1 });
	try {
	  const response = await getVideoDetail(contentKey);
	  if (this.hgUnmounted || hgSequence !== this.hgVideoRequestSequence) return;
	  const video = normalizeVideoListItem(response);
	  this.setState({ video, videoLoading: false }, () => this.loadVideoInteraction(video));
	} catch (error) {
	  if (this.hgUnmounted || hgSequence !== this.hgVideoRequestSequence) return;
	  this.setState({ videoLoading: false, videoError: error?.message || "视频加载失败" });
	}
  };

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
    this.props.pageNavigator.open({
      page: PAGE.BILI_VIDEO_CONTENT,
      pathParams: {
        contentKey: video.id,
      },
      state: { video },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** 返回动画推荐首页。 */
  handleBackHome = () => {
    this.props.pageNavigator.open({ page: PAGE.BILI_DOUGA });
  };

  /** 返回上一个历史页面，无历史时由浏览器保持当前页。 */
  handleBack = () => {
    this.props.pageNavigator.back();
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
	if (video?.playbackType === "external_link") {
	  this.hgInteractionRequestSequence += 1;
	  this.setState({ interactionLoading: false, authorProfile: null, interactionFeedback: "" });
	  return;
	}
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
      await setVideoInteraction(
        video.submissionId || video.id,
        action,
        active,
        requestId
      );
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
	if (video.playbackType === "external_link") {
	  return (
	    <section className={styles.videoInfo}>
	      <h1 className={styles.videoTitle}>{video.title}</h1>
	      <div className={styles.videoMeta}>
	        <span>{formatCount(video.play)}播放</span>
	        <span>{video.danmaku}原站弹幕（采集快照）</span>
	        <span>{video.pubDate}</span>
	      </div>
	      {this.renderHGExternalDetail(video)}
	      <a className={styles.externalLink} href={video.targetUrl} target="_blank" rel="noreferrer">
	        在 Bilibili 打开原视频
	      </a>
	    </section>
	  );
	}
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
	/** 展示自有数据库的详情快照，采集中和失败状态不伪装成已完成。 */
	renderHGExternalDetail = (video) => {
	  const hgDetail = video.externalDetail;
	  const hgLabels = { pending: "等待详情采集", raw: "详情已采集，等待清洗", cleaned: "清洗完成，等待入库", stored: "详情已入库", failed: "详情采集失败", not_collected: "尚未采集详情，请重新执行采集任务" };
	  return (
	    <div>
	      <p role="status">{hgLabels[hgDetail?.status] || "详情流水线尚未启用"}{hgDetail?.errorMessage ? `：${hgDetail.errorMessage}` : ""}</p>
	      <button type="button" className={styles.actionButton} onClick={this.loadCurrentVideo}>刷新详情状态</button>
	      {hgDetail?.collectedAt && <>
	        <p>原站统计：{formatCount(video.likeCount)} 点赞 · {formatCount(hgDetail.coin)} 投币 · {formatCount(hgDetail.favorite)} 收藏 · {formatCount(hgDetail.share)} 分享 · {formatCount(hgDetail.reply)} 评论</p>
	        <p>采集时间：{new Date(hgDetail.collectedAt).toLocaleString()}</p>
	      </>}
	      {video.description && <p className={styles.hgDescription}>{video.description}</p>}
	      {hgDetail?.parts?.length > 0 && <label>分 P：
	        <select value={this.state.hgSelectedPage} onChange={(event) => this.setState({ hgSelectedPage: Number(event.target.value) })}>
	          {hgDetail.parts.map((hgPart) => <option key={hgPart.cid} value={hgPart.page}>P{hgPart.page} {hgPart.title}</option>)}
	        </select>
	      </label>}
	    </div>
	  );
	};

  /** 渲染视频作者信息和关注入口。 */
  renderAuthorInfo = (video) => {
	if (video.playbackType === "external_link") {
	  const authorName = video.author || video.authorId || "未知作者";
	  return (
	    <section className={styles.authorInfo}>
	      {video.authorAvatar ? <img className={styles.authorAvatar} src={video.authorAvatar} alt={authorName} referrerPolicy="no-referrer" /> : <span className={styles.authorAvatarFallback}>{authorName.slice(0, 1)}</span>}
	      <span className={styles.authorDetail}>
	        <span className={styles.authorName}>{authorName}</span>
	        <span className={styles.authorFans}>Bilibili 创作者</span>
	      </span>
	    </section>
	  );
	}
    const { interaction, interactionLoading, pendingAction } = this.state;
    const profile = this.state.authorProfile;
    const authorId = video.authorId || video.userId || profile?.userId || "";
    const authorName =
      profile?.displayName || video.author || authorId || "未知用户";
    const avatarURL = profile?.avatarUrl || video.authorAvatar || "";
    const followerCount =
      interaction.followerCount || Number(video.authorFans) || 0;
    const followerLabel =
      interaction.followerCount || !video.authorFans
        ? formatCount(followerCount)
        : String(video.authorFans);
    const followSubmitting = pendingAction === "follow";

    return (
      <section className={styles.authorInfo}>
        <button
          type="button"
          className={styles.authorIdentity}
          onClick={() => this.handleAuthorClick(video, profile)}
        >
          {avatarURL ? (
            <img
              className={styles.authorAvatar}
              src={avatarURL}
              alt={authorName}
            />
          ) : (
            <span className={styles.authorAvatarFallback}>
              {authorName.slice(0, 1)}
            </span>
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
    this.props.pageNavigator.open({
      page: PAGE.BILI_AUTHOR_SPACE,
      pathParams: {
        userId,
      },
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
  renderVideo = () => {
	const { video, videoLoading, videoError } = this.state;
	if (videoLoading) return <main className={styles.playerState}>视频加载中...</main>;
	if (videoError || !video) return <main className={styles.playerState}>{videoError || "视频不存在"}</main>;
    const relatedVideos = HGBiliContentPageVM.getRelatedVideos(video);
	const hgPart = video.externalDetail?.parts?.find((hgItem) => hgItem.page === this.state.hgSelectedPage);
	const hgExternalID = `external:bilibili:${video.externalContentId}`;

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
	      {video.playbackType === "external_link" ? (
	        <HGExternalPlayer video={video} part={hgPart} />
	      ) : (
	        <HGVideoPlayerPage key={String(video.id)} video={video} />
	      )}
	      {this.renderVideoInfo(video)}
	      {this.renderAuthorInfo(video)}
          {/* 接口数据按 submissionId 聚合评论，本地回退视频仅有 id。 */}
	      {(video.playbackType !== "external_link" || video.externalDetail?.collectedAt) && (
	        <HGVideoComments key={video.playbackType === "external_link" ? hgExternalID : video.submissionId || video.id} submissionId={video.playbackType === "external_link" ? hgExternalID : video.submissionId || video.id} />
	      )}
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
