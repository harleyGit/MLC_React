import React from "react";
import { getRequestErrorMessage } from "../../api/hg_request_error";
import HGCommentVirtualList from "./hg_comment_virtual_list";
import {
  createVideoComment,
  deleteVideoComment,
  getVideoComments,
} from "./hg_video_comment_api";
import {
  HG_VIDEO_COMMENT_MAX_LENGTH,
  truncateVideoCommentContent,
} from "./hg_video_comment_request";
import styles from "./hg_video_comments.module.css";

const HG_COMMENT_PAGE_SIZE = 30;
const HG_COMMENT_MAX_RETAINED = 500;

/** 使用后端 commentId 去重，并限制客户端累计持有数量。 */
function mergeComments(currentComments, incomingComments) {
  const merged = [];
  const commentIds = new Set();
  [...currentComments, ...incomingComments].forEach((comment) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!commentId || commentIds.has(commentId) || merged.length >= HG_COMMENT_MAX_RETAINED) return;
    commentIds.add(commentId);
    merged.push(comment);
  });
  return merged;
}

/** 生成评论创建幂等标识，失败重试前由当前提交过程保持同一个值。 */
function createCommentRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `comment_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** 格式化后端时间字段，无法解析时保留原值。 */
function formatCommentTime(comment) {
  const value = comment?.createdAt || comment?.createTime || comment?.createdTime || "";
  if (!value) return "刚刚";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

/**
 * 可复用的视频评论区，负责排序、游标分页、创建、删除和视频切换隔离。
 */
class HGVideoComments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      comments: [],
      sort: "latest",
      nextCursor: "",
      hasMore: true,
      loading: false,
      submitting: false,
      deletingCommentId: "",
      content: "",
      pendingCreatedComment: null,
      error: "",
      feedback: "",
      reachedClientLimit: false,
    };
    this.hgRequestSequence = 0;
    this.hgMounted = false;
    this.hgPendingCreateContent = "";
    this.hgPendingCreateRequestId = "";
  }

  componentDidMount() {
    this.hgMounted = true;
    this.resetAndLoad(this.props.submissionId, "latest");
  }

  componentDidUpdate(prevProps) {
    if (String(prevProps.submissionId) !== String(this.props.submissionId)) {
      this.resetAndLoad(this.props.submissionId, "latest");
    }
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequestSequence += 1;
  }

  /** 切换视频或排序时清空旧游标，并以序列号丢弃过期响应。 */
  resetAndLoad = (submissionId, sort) => {
    const requestSequence = ++this.hgRequestSequence;
    this.hgPendingCreateContent = "";
    this.hgPendingCreateRequestId = "";
    this.setState({
      comments: [],
      sort,
      nextCursor: "",
      hasMore: true,
      loading: true,
      submitting: false,
      deletingCommentId: "",
      content: "",
      pendingCreatedComment: null,
      error: "",
      feedback: "",
      reachedClientLimit: false,
    }, () => this.fetchComments(submissionId, sort, "", false, requestSequence));
  };

  /** 请求一页评论；cursor 原样透传，响应按 commentId 去重。 */
  fetchComments = async (submissionId, sort, cursor, append, requestSequence = this.hgRequestSequence) => {
    if (!String(submissionId || "").trim()) {
      if (this.hgMounted && requestSequence === this.hgRequestSequence) {
        this.setState({ loading: false, hasMore: false, error: "缺少视频标识，无法加载评论" });
      }
      return;
    }

    try {
      const response = await getVideoComments(submissionId, sort, cursor, HG_COMMENT_PAGE_SIZE);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState((state) => {
        const comments = mergeComments(
          append ? state.comments : (state.pendingCreatedComment ? [state.pendingCreatedComment] : []),
          response?.comments || [],
        );
        const reachedClientLimit = comments.length >= HG_COMMENT_MAX_RETAINED;
        return {
          comments,
          pendingCreatedComment: null,
          nextCursor: response?.nextCursor || "",
          hasMore: !reachedClientLimit && Boolean(response?.hasMore),
          loading: false,
          error: "",
          reachedClientLimit,
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        loading: false,
        error: getRequestErrorMessage(error, "评论加载失败，请稍后重试"),
      });
    }
  };

  /** 接近列表底部时读取下一页，空游标不会重复请求。 */
  handleLoadMore = () => {
    const { loading, hasMore, nextCursor, sort } = this.state;
    if (loading || !hasMore || !nextCursor) return;
    this.setState({ loading: true, error: "" }, () => {
      this.fetchComments(this.props.submissionId, sort, nextCursor, true);
    });
  };

  /** 切换 latest/hot 后重新从首个游标加载。 */
  handleSortChange = (sort) => {
    if (sort === this.state.sort || this.state.loading) return;
    this.resetAndLoad(this.props.submissionId, sort);
  };

  /** 限制输入长度，避免超长草稿在页面生命周期内持续占用内存。 */
  handleContentChange = (event) => {
    const content = truncateVideoCommentContent(event.target.value);
    if (content.trim() !== this.hgPendingCreateContent) {
      this.hgPendingCreateContent = "";
      this.hgPendingCreateRequestId = "";
    }
    this.setState({ content, error: "", feedback: "" });
  };

  /** 提交评论并切回最新排序，将响应对象直接放入首行。 */
  handleSubmit = async (event) => {
    event.preventDefault();
    const content = this.state.content.trim();
    if (!content || this.state.submitting) return;
    const requestSequence = this.hgRequestSequence;
    const requestId = this.hgPendingCreateContent === content && this.hgPendingCreateRequestId
      ? this.hgPendingCreateRequestId
      : createCommentRequestId();
    this.hgPendingCreateContent = content;
    this.hgPendingCreateRequestId = requestId;
    this.setState({ submitting: true, error: "", feedback: "" });

    try {
      const comment = await createVideoComment(this.props.submissionId, content, requestId);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.hgPendingCreateContent = "";
      this.hgPendingCreateRequestId = "";
      if (this.state.sort !== "latest") {
        const nextRequestSequence = ++this.hgRequestSequence;
        this.setState({
          comments: [comment],
          sort: "latest",
          nextCursor: "",
          hasMore: true,
          content: "",
          pendingCreatedComment: comment,
          submitting: false,
          loading: true,
          error: "",
          feedback: "评论发布成功",
          reachedClientLimit: false,
        }, () => this.fetchComments(
          this.props.submissionId,
          "latest",
          "",
          false,
          nextRequestSequence,
        ));
        return;
      }
      this.setState((state) => ({
        comments: mergeComments([comment], state.comments),
        content: "",
        submitting: false,
        feedback: "评论发布成功",
      }));
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        submitting: false,
        error: getRequestErrorMessage(error, "评论发布失败，请稍后重试"),
      });
    }
  };

  /** 仅对后端明确标记 canDelete 的评论展示并执行删除。 */
  handleDelete = async (comment) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!comment?.canDelete || !commentId || this.state.deletingCommentId) return;
    const requestSequence = this.hgRequestSequence;
    this.setState({ deletingCommentId: commentId, error: "", feedback: "" });

    try {
      const response = await deleteVideoComment(commentId);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      if (!response?.deleted || String(response?.commentId) !== commentId) {
        throw new Error("评论删除响应无效");
      }
      this.setState((state) => ({
        comments: state.comments.filter((item) => String(item?.commentId) !== commentId),
        deletingCommentId: "",
        feedback: "评论已删除",
      }));
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        deletingCommentId: "",
        error: getRequestErrorMessage(error, "评论删除失败，请稍后重试"),
      });
    }
  };

  /** 渲染固定高度评论行，正文最多三行，保证虚拟列表测量稳定。 */
  renderCommentRow = (comment) => {
    const commentId = String(comment?.commentId || "");
    const authorName = comment?.authorName || comment?.nickname || comment?.userName || "匿名用户";
    const avatar = comment?.avatarURL || comment?.authorAvatar || comment?.avatar || "";
    return (
      <article className={styles.commentRow} aria-label={`${authorName}的评论`}>
        <div className={styles.commentAvatar} aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : authorName.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.commentBody}>
          <div className={styles.commentHeading}>
            <strong>{authorName}</strong>
            <time>{formatCommentTime(comment)}</time>
          </div>
          <p className={styles.commentContent}>{comment?.content || ""}</p>
        </div>
        {comment?.canDelete && (
          <button
            type="button"
            className={styles.deleteButton}
            disabled={this.state.deletingCommentId === commentId}
            onClick={() => this.handleDelete(comment)}
          >
            {this.state.deletingCommentId === commentId ? "删除中" : "删除"}
          </button>
        )}
      </article>
    );
  };

  renderListState() {
    const { comments, loading, error, hasMore, reachedClientLimit } = this.state;
    if (loading && comments.length === 0) return <div className={styles.statePanel}>评论加载中...</div>;
    if (error && comments.length === 0) {
      return (
        <div className={`${styles.statePanel} ${styles.errorState}`} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => this.resetAndLoad(this.props.submissionId, this.state.sort)}>重试</button>
        </div>
      );
    }
    if (comments.length === 0) return <div className={styles.statePanel}>还没有评论，来抢沙发吧</div>;

    return (
      <>
        <HGCommentVirtualList
          items={comments}
          rowHeight={112}
          overscan={3}
          height={480}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={this.handleLoadMore}
          renderRow={this.renderCommentRow}
        />
        <div className={styles.listFooter} role="status">
          {loading && "正在加载更多评论..."}
          {!loading && reachedClientLimit && `为控制内存占用，仅保留前 ${HG_COMMENT_MAX_RETAINED} 条评论`}
          {!loading && !hasMore && !reachedClientLimit && "没有更多评论了"}
        </div>
      </>
    );
  }

  render() {
    const { sort, content, submitting, error, feedback } = this.state;
    return (
      <section className={styles.commentSection} aria-labelledby="video-comments-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>DISCUSSION</span>
            <h2 id="video-comments-title">评论</h2>
          </div>
          <div className={styles.sortTabs} role="tablist" aria-label="评论排序">
            {[
              { value: "latest", label: "最新" },
              { value: "hot", label: "热门" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={sort === item.value}
                className={sort === item.value ? styles.activeTab : ""}
                onClick={() => this.handleSortChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <form className={styles.composer} onSubmit={this.handleSubmit}>
          <textarea
            value={content}
            rows={3}
            placeholder="友善发言，分享你的看法"
            aria-label="评论内容"
            onChange={this.handleContentChange}
          />
          <div className={styles.composerFooter}>
            <span>{Array.from(content).length}/{HG_VIDEO_COMMENT_MAX_LENGTH}</span>
            <button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? "发布中..." : "发布评论"}
            </button>
          </div>
        </form>

        {(error || feedback) && this.state.comments.length > 0 && (
          <p className={error ? styles.inlineError : styles.inlineFeedback} role={error ? "alert" : "status"}>
            {error || feedback}
          </p>
        )}
        {this.renderListState()}
      </section>
    );
  }
}

export default HGVideoComments;
