import React from "react";
import { generatePath } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { setAuthorFollow } from "./hg_bili_api";
import styles from "./hg_bili_author_space_page.module.css";
import HGBiliAuthorSpacePageVM from "./hg_bili_author_space_page_vm";

/** Bilibili 风格作者空间，首屏读取聚合接口，视频区使用游标增量加载。 */
class HGBiliAuthorSpacePage extends React.Component {
  state = {
    profile: null,
    stats: { followers: 0, following: 0, videos: 0 },
    videos: [],
    nextCursor: "",
    hasMore: false,
    loading: true,
    loadingMore: false,
    followed: false,
    followSubmitting: false,
    error: "",
  };

  componentDidMount() {
    this.loadHomepage();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params?.userId !== this.props.params?.userId) {
      this.loadHomepage();
    }
  }

  getUserId = () => decodeURIComponent(String(this.props.params?.userId || "").trim());

  loadHomepage = async () => {
    const userId = this.getUserId();
    this.setState({ loading: true, error: "", videos: [], nextCursor: "", hasMore: false });
    try {
      const response = await HGBiliAuthorSpacePageVM.getHomepage(userId);
      this.setState({
        profile: response.profile,
        stats: response.stats,
        videos: response.videos.videos,
        nextCursor: response.videos.nextCursor,
        hasMore: response.videos.hasMore,
      });
    } catch (error) {
      this.setState({ error: error?.message || "作者空间加载失败，请稍后重试" });
    } finally {
      this.setState({ loading: false });
    }
  };

  loadMore = async () => {
    const { hasMore, loadingMore, nextCursor } = this.state;
    if (!hasMore || loadingMore || !nextCursor) return;
    this.setState({ loadingMore: true });
    try {
      const response = await HGBiliAuthorSpacePageVM.getVideos(this.getUserId(), nextCursor);
      this.setState((state) => ({
        videos: [...state.videos, ...response.videos],
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
      }));
    } catch (error) {
      this.setState({ error: error?.message || "更多投稿加载失败" });
    } finally {
      this.setState({ loadingMore: false });
    }
  };

  handleFollow = async () => {
    if (this.state.followSubmitting) return;
    const active = !this.state.followed;
    this.setState({ followSubmitting: true, error: "" });
    try {
      await setAuthorFollow(this.getUserId(), active);
      this.setState((state) => ({
        followed: active,
        stats: {
          ...state.stats,
          followers: Math.max(0, state.stats.followers + (active ? 1 : -1)),
        },
      }));
    } catch (error) {
      this.setState({ error: error?.message || "关注操作失败" });
    } finally {
      this.setState({ followSubmitting: false });
    }
  };

  handleVideoClick = (video) => {
    const { profile, stats } = this.state;
    this.props.navigate(generatePath(ROUTE_PATH.BILI_VIDEO_CONTENT, { contentKey: encodeURIComponent(video.id) }), {
      state: {
        video: {
          ...video,
          author: profile?.name,
          authorId: profile?.userId,
          authorAvatar: profile?.avatar,
          authorFans: stats.followers,
          pubDate: HGBiliAuthorSpacePageVM.formatDate(video.publishTime),
          danmaku: 0,
        },
      },
    });
  };

  renderHero() {
    const { profile, stats, followed, followSubmitting } = this.state;
    if (!profile) return null;
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.heroPattern} />
          <div className={styles.identity}>
            {profile.avatar ? (
              <img className={styles.avatar} src={profile.avatar} alt={profile.name} />
            ) : (
              <span className={styles.avatarFallback}>{profile.name.slice(0, 1)}</span>
            )}
            <div className={styles.identityText}>
              <div className={styles.nameLine}>
                <h1>{profile.name}</h1>
                <span className={styles.level}>LV 0</span>
              </div>
              <p>{profile.signature}</p>
            </div>
            <button
              type="button"
              className={`${styles.followButton} ${followed ? styles.followed : ""}`}
              disabled={followSubmitting}
              onClick={this.handleFollow}
            >
              {followSubmitting ? "处理中..." : followed ? "已关注" : "+ 关注"}
            </button>
          </div>
        </section>
        <section className={styles.navBar}>
          <div className={styles.tabs}>
            <button type="button" className={styles.activeTab}>主页</button>
            <button type="button">动态</button>
            <button type="button">投稿 <span>{stats.videos}</span></button>
            <button type="button">合集和列表</button>
            <button type="button">收藏</button>
          </div>
          <div className={styles.stats}>
            <span><strong>{HGBiliAuthorSpacePageVM.formatCount(stats.following)}</strong>关注数</span>
            <span><strong>{HGBiliAuthorSpacePageVM.formatCount(stats.followers)}</strong>粉丝数</span>
          </div>
        </section>
      </>
    );
  }

  renderVideos() {
    const { videos, stats, hasMore, loadingMore } = this.state;
    return (
      <section className={styles.contentCard}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.accent} /> <h2>TA的视频</h2></div>
          <span>共 {HGBiliAuthorSpacePageVM.formatCount(stats.videos)} 个投稿</span>
        </div>
        {videos.length ? (
          <div className={styles.videoGrid}>
            {videos.map((video) => (
              <button key={video.submissionId} type="button" className={styles.videoCard} onClick={() => this.handleVideoClick(video)}>
                <span className={styles.coverWrap}>
                  {video.cover ? <img src={video.cover} alt="" /> : <span className={styles.coverFallback}>bilibili</span>}
                  <span className={styles.duration}>{Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}</span>
                </span>
                <strong>{video.title}</strong>
                <span className={styles.videoMeta}>点赞 {HGBiliAuthorSpacePageVM.formatCount(video.likeCount)} · {HGBiliAuthorSpacePageVM.formatDate(video.publishTime)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>暂无公开投稿</div>
        )}
        {hasMore && (
          <button type="button" className={styles.loadMore} disabled={loadingMore} onClick={this.loadMore}>
            {loadingMore ? "正在加载..." : "加载更多投稿"}
          </button>
        )}
      </section>
    );
  }

  render() {
    const { loading, error, profile } = this.state;
    if (loading) return <div className={styles.statePage}>正在进入个人空间...</div>;
    if (!profile) return <div className={styles.statePage}>{error || "用户不存在"}</div>;
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          {this.renderHero()}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.bodyGrid}>
            {this.renderVideos()}
            <aside className={styles.sideCard}>
              <h2>个人资料</h2>
              <p><span>UID</span>{profile.userId}</p>
              <p><span>加入时间</span>{HGBiliAuthorSpacePageVM.formatDate(profile.createdAt) || "未知"}</p>
              <p><span>性别</span>{profile.gender === 1 ? "男" : profile.gender === 2 ? "女" : "保密"}</p>
            </aside>
          </div>
        </div>
      </main>
    );
  }
}

export default HGBiliAuthorSpacePage;
