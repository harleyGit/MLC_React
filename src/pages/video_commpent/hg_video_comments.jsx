import React from "react";
import { getRequestErrorMessage } from "../../api/hg_request_error";
import HGCommentVirtualList from "./hg_comment_virtual_list";
import {
  createVideoComment,
  deleteVideoComment,
  getVideoCommentReplies,
  getVideoComments,
  setVideoCommentReaction,
  uploadVideoCommentImage,
} from "./hg_video_comment_api";
import {
  HG_VIDEO_COMMENT_MAX_LENGTH,
  truncateVideoCommentContent,
} from "./hg_video_comment_request";
import {
  decrementVideoCommentReplyCount,
  getPendingVideoCommentImageDrafts,
  getUploadedVideoCommentImageURLs,
  mergeVideoComments,
} from "./hg_video_comment_state";
import styles from "./hg_video_comments.module.css";

const HG_COMMENT_PAGE_SIZE = 30;
const HG_COMMENT_MAX_RETAINED = 500;
const HG_COMMENT_REPLY_MAX_RETAINED = 100;
const HG_COMMENT_ROW_HEIGHT = 224;
const HG_COMMENT_MAX_IMAGES = 3;
const HG_COMMENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const HG_COMMENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HG_COMMENT_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** commentId 是服务端稳定身份，虚拟行和回复面板都只按该字段更新。 */
function updateCommentById(comments, commentId, updater) {
  return comments.map((comment) => (
    String(comment?.commentId || "") === commentId ? updater(comment) : comment
  ));
}

/** 生成评论创建幂等标识，失败重试前由当前提交过程保持同一个值。 */
function createCommentRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `comment_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** 固定使用 zh-CN 和东八区，避免时间展示受浏览器默认地区影响。 */
function formatCommentTime(comment) {
  const value = comment?.createdAt || "";
  if (!value) return "刚刚";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : HG_COMMENT_TIME_FORMATTER.format(date);
}

/** 返回 time 元素使用的原始 ISO 时间，非法值不输出 dateTime。 */
function getCommentDateTime(comment) {
  const value = String(comment?.createdAt || "").trim();
  return value && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

/** 将选择的文件转换为可回收的本地预览记录。 */
function createImageDrafts(files) {
  return files.map((file) => ({ file, previewURL: URL.createObjectURL(file), imageURL: "" }));
}

/** 可复用的视频评论区，负责游标列表、图片、反应、回复和删除。 */
class HGVideoComments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      comments: [],
      totalCount: 0,
      sort: "latest",
      nextCursor: "",
      hasMore: true,
      loading: false,
      submitting: false,
      uploading: false,
      deletingCommentId: "",
      pendingReactionIds: {},
      content: "",
      images: [],
      pendingCreatedComment: null,
      selectedRootCommentId: "",
      replies: [],
      replyNextCursor: "",
      replyHasMore: false,
      replyLoading: false,
      replySubmitting: false,
      replyUploading: false,
      replyContent: "",
      replyImages: [],
      error: "",
      feedback: "",
      replyError: "",
      reachedClientLimit: false,
    };
    this.hgRequestSequence = 0;
    this.hgReplyRequestSequence = 0;
    this.hgMounted = false;
    this.hgPendingCreateContent = "";
    this.hgPendingCreateRequestId = "";
    this.hgPendingReplyContent = "";
    this.hgPendingReplyRequestId = "";
  }

  componentDidMount() {
    this.hgMounted = true;
    this.resetAndLoad(this.props.submissionId, "latest");
  }

  componentDidUpdate(prevProps) {
    if (String(prevProps.submissionId) !== String(this.props.submissionId)) {
      this.revokeImageDrafts(this.state.images);
      this.revokeImageDrafts(this.state.replyImages);
      this.resetAndLoad(this.props.submissionId, "latest");
    }
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequestSequence += 1;
    this.hgReplyRequestSequence += 1;
    this.revokeImageDrafts(this.state.images);
    this.revokeImageDrafts(this.state.replyImages);
  }

  /** 释放浏览器为图片草稿创建的本地 URL。 */
  revokeImageDrafts = (drafts) => {
    drafts.forEach((draft) => URL.revokeObjectURL(draft.previewURL));
  };

  /** 切换视频或排序时清空旧游标，并以序列号丢弃过期响应。 */
  resetAndLoad = (submissionId, sort) => {
    const requestSequence = ++this.hgRequestSequence;
    this.hgReplyRequestSequence += 1;
    this.hgPendingCreateContent = "";
    this.hgPendingCreateRequestId = "";
    this.hgPendingReplyContent = "";
    this.hgPendingReplyRequestId = "";
    this.setState({
      comments: [],
      totalCount: 0,
      sort,
      nextCursor: "",
      hasMore: true,
      loading: true,
      submitting: false,
      uploading: false,
      deletingCommentId: "",
      pendingReactionIds: {},
      content: "",
      images: [],
      pendingCreatedComment: null,
      selectedRootCommentId: "",
      replies: [],
      replyNextCursor: "",
      replyHasMore: false,
      replyLoading: false,
      replySubmitting: false,
      replyUploading: false,
      replyContent: "",
      replyImages: [],
      error: "",
      feedback: "",
      replyError: "",
      reachedClientLimit: false,
    }, () => this.fetchComments(submissionId, sort, "", false, requestSequence));
  };

  /** 请求一页顶层评论；cursor 原样透传，响应按 commentId 去重。 */
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
        const comments = mergeVideoComments(
          state.comments,
          response?.comments || [],
        );
        const reachedClientLimit = comments.length >= HG_COMMENT_MAX_RETAINED;
        return {
          comments,
          totalCount: Math.max(state.totalCount, Math.max(0, Number(response?.totalCount) || 0)),
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
      this.setState({ loading: false, error: getRequestErrorMessage(error, "评论加载失败，请稍后重试") });
    }
  };

  /** 接近顶层列表底部时读取下一页，空游标不会重复请求。 */
  handleLoadMore = () => {
    const { loading, hasMore, nextCursor, sort } = this.state;
    if (loading || !hasMore || !nextCursor) return;
    this.setState({ loading: true, error: "" }, () => {
      this.fetchComments(this.props.submissionId, sort, nextCursor, true);
    });
  };

  /** 切换 latest/hot 后重新从首个游标加载。 */
  handleSortChange = (sort) => {
    if (sort === this.state.sort || this.state.loading || this.state.replySubmitting || this.state.replyUploading) return;
    this.revokeImageDrafts(this.state.images);
    this.revokeImageDrafts(this.state.replyImages);
    this.resetAndLoad(this.props.submissionId, sort);
  };

  /** 限制输入长度，并在草稿变化后生成新的幂等请求标识。 */
  handleContentChange = (event, isReply = false) => {
    const content = truncateVideoCommentContent(event.target.value);
    if (isReply) {
      if (content.trim() !== this.hgPendingReplyContent) {
        this.hgPendingReplyContent = "";
        this.hgPendingReplyRequestId = "";
      }
      this.setState({ replyContent: content, replyError: "" });
      return;
    }
    if (content.trim() !== this.hgPendingCreateContent) {
      this.hgPendingCreateContent = "";
      this.hgPendingCreateRequestId = "";
    }
    this.setState({ content, error: "", feedback: "" });
  };

  /** 校验图片类型、大小和总数后建立固定尺寸预览。 */
  handleImageSelect = (event, isReply = false) => {
    const locked = isReply
      ? this.state.replySubmitting || this.state.replyUploading
      : this.state.submitting || this.state.uploading;
    if (locked) return;
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    const currentImages = isReply ? this.state.replyImages : this.state.images;
    const remainingSlots = HG_COMMENT_MAX_IMAGES - currentImages.length;
    if (selectedFiles.length > remainingSlots) {
      this.setState(isReply ? { replyError: "每条评论最多选择 3 张图片" } : { error: "每条评论最多选择 3 张图片" });
      return;
    }
    const invalidFile = selectedFiles.find((file) => (
      !HG_COMMENT_IMAGE_TYPES.has(file.type) || file.size > HG_COMMENT_MAX_IMAGE_BYTES
    ));
    if (invalidFile) {
      const message = HG_COMMENT_IMAGE_TYPES.has(invalidFile.type)
        ? "每张图片不能超过 5 MiB"
        : "仅支持 JPEG、PNG、WebP 图片";
      this.setState(isReply ? { replyError: message } : { error: message });
      return;
    }
    const imageDrafts = createImageDrafts(selectedFiles);
    if (isReply) {
      this.hgPendingReplyRequestId = "";
      this.setState((state) => ({ replyImages: [...state.replyImages, ...imageDrafts], replyError: "" }));
      return;
    }
    this.hgPendingCreateRequestId = "";
    this.setState((state) => ({ images: [...state.images, ...imageDrafts], error: "", feedback: "" }));
  };

  /** 移除单张草稿图片并立即回收本地预览 URL。 */
  handleImageRemove = (index, isReply = false) => {
    const locked = isReply
      ? this.state.replySubmitting || this.state.replyUploading
      : this.state.submitting || this.state.uploading;
    if (locked) return;
    const images = isReply ? this.state.replyImages : this.state.images;
    const removedImage = images[index];
    if (removedImage) URL.revokeObjectURL(removedImage.previewURL);
    const nextImages = images.filter((_, imageIndex) => imageIndex !== index);
    if (isReply) {
      this.hgPendingReplyRequestId = "";
      this.setState({ replyImages: nextImages, replyError: "" });
      return;
    }
    this.hgPendingCreateRequestId = "";
    this.setState({ images: nextImages, error: "", feedback: "" });
  };

  /** 仅上传尚无缓存 URL 的草稿；部分成功时保留 URL，创建失败重试也沿用同一组资源。 */
  uploadImages = async (drafts, isReply) => {
    const pendingDrafts = getPendingVideoCommentImageDrafts(drafts);
    const uploadResults = await Promise.allSettled(pendingDrafts.map(async (draft) => {
      const response = await uploadVideoCommentImage(draft.file);
      const imageURL = String(response?.imageURL || "").trim();
      if (!imageURL) throw new Error("图片上传响应无效");
      draft.imageURL = imageURL;
    }));
    if (!this.hgMounted) return [];
    this.setState(isReply ? { replyImages: [...drafts] } : { images: [...drafts] });
    const failedUpload = uploadResults.find((result) => result.status === "rejected");
    if (failedUpload) throw failedUpload.reason;
    const imageURLs = getUploadedVideoCommentImageURLs(drafts);
    if (!imageURLs) throw new Error("图片上传响应无效");
    return imageURLs;
  };

  /** 提交顶层评论；文本为空时只要有图片也允许发布。 */
  handleSubmit = async (event) => {
    event.preventDefault();
    const { images } = this.state;
    const content = this.state.content.trim();
    if ((!content && images.length === 0) || this.state.submitting || this.state.uploading) return;
    const requestSequence = this.hgRequestSequence;
    const draftKey = `${content}|${images.map((draft) => draft.file.name).join("|")}`;
    const requestId = this.hgPendingCreateContent === draftKey && this.hgPendingCreateRequestId
      ? this.hgPendingCreateRequestId
      : createCommentRequestId();
    this.hgPendingCreateContent = draftKey;
    this.hgPendingCreateRequestId = requestId;
    this.setState({ submitting: true, uploading: images.length > 0, error: "", feedback: "" });

    try {
      const imageURLs = await this.uploadImages(images, false);
      const comment = await createVideoComment(this.props.submissionId, content, requestId, "", imageURLs);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.revokeImageDrafts(images);
      this.hgPendingCreateContent = "";
      this.hgPendingCreateRequestId = "";
      if (this.state.sort !== "latest") {
        const nextRequestSequence = ++this.hgRequestSequence;
        this.setState((state) => ({
          comments: [comment],
          totalCount: state.totalCount + 1,
          sort: "latest",
          nextCursor: "",
          hasMore: true,
          content: "",
          images: [],
          pendingCreatedComment: comment,
          submitting: false,
          uploading: false,
          loading: true,
          error: "",
          feedback: "评论发布成功",
          reachedClientLimit: false,
        }), () => this.fetchComments(this.props.submissionId, "latest", "", false, nextRequestSequence));
        return;
      }
      this.setState((state) => ({
        comments: mergeVideoComments([comment], state.comments),
        totalCount: state.totalCount + 1,
        content: "",
        images: [],
        submitting: false,
        uploading: false,
        feedback: "评论发布成功",
      }));
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        submitting: false,
        uploading: false,
        error: getRequestErrorMessage(error, "评论发布失败，请稍后重试"),
      });
    }
  };

  /** 打开独立回复面板，避免破坏顶层固定行高；回复提交期间禁止切换面板以隔离竞态。 */
  handleOpenReplies = (comment) => {
    const rootCommentId = String(comment?.commentId || "").trim();
    if (!rootCommentId || this.state.replySubmitting || this.state.replyUploading) return;
    this.revokeImageDrafts(this.state.replyImages);
    const requestSequence = ++this.hgReplyRequestSequence;
    this.hgPendingReplyContent = "";
    this.hgPendingReplyRequestId = "";
    this.setState({
      selectedRootCommentId: rootCommentId,
      replies: [],
      replyNextCursor: "",
      replyHasMore: false,
      replyLoading: true,
      replySubmitting: false,
      replyUploading: false,
      replyContent: "",
      replyImages: [],
      replyError: "",
    }, () => this.fetchReplies(rootCommentId, "", false, requestSequence));
  };

  /** 读取回复游标页，最多在面板中保留 100 条。 */
  fetchReplies = async (rootCommentId, cursor, append, requestSequence = this.hgReplyRequestSequence) => {
    try {
      const response = await getVideoCommentReplies(rootCommentId, cursor, HG_COMMENT_PAGE_SIZE);
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence) return;
      this.setState((state) => {
        const replies = mergeVideoComments(
          state.replies,
          response?.comments || [],
          HG_COMMENT_REPLY_MAX_RETAINED,
        );
        const reachedReplyLimit = replies.length >= HG_COMMENT_REPLY_MAX_RETAINED;
        return {
          replies,
          replyNextCursor: response?.nextCursor || "",
          replyHasMore: !reachedReplyLimit && Boolean(response?.hasMore),
          replyLoading: false,
          replyError: "",
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence) return;
      this.setState({ replyLoading: false, replyError: getRequestErrorMessage(error, "回复加载失败，请稍后重试") });
    }
  };

  /** 加载回复面板下一页。 */
  handleLoadMoreReplies = () => {
    const { selectedRootCommentId, replyLoading, replyHasMore, replyNextCursor } = this.state;
    if (!selectedRootCommentId || replyLoading || !replyHasMore || !replyNextCursor) return;
    this.setState({ replyLoading: true, replyError: "" }, () => {
      this.fetchReplies(selectedRootCommentId, replyNextCursor, true);
    });
  };

  /** 关闭回复面板并回收未发布图片。 */
  handleCloseReplies = () => {
    if (this.state.replySubmitting || this.state.replyUploading) return;
    this.hgReplyRequestSequence += 1;
    this.revokeImageDrafts(this.state.replyImages);
    this.setState({
      selectedRootCommentId: "",
      replies: [],
      replyContent: "",
      replyImages: [],
      replyLoading: false,
      replySubmitting: false,
      replyUploading: false,
      replyError: "",
    });
  };

  /** 发布回复并同步根评论 replyCount 与全局评论总数。 */
  handleReplySubmit = async (event) => {
    event.preventDefault();
    const { selectedRootCommentId, replyImages } = this.state;
    const content = this.state.replyContent.trim();
    if (!selectedRootCommentId || (!content && replyImages.length === 0) || this.state.replySubmitting || this.state.replyUploading) return;
    const requestSequence = this.hgReplyRequestSequence;
    const draftKey = `${content}|${replyImages.map((draft) => draft.file.name).join("|")}`;
    const requestId = this.hgPendingReplyContent === draftKey && this.hgPendingReplyRequestId
      ? this.hgPendingReplyRequestId
      : createCommentRequestId();
    this.hgPendingReplyContent = draftKey;
    this.hgPendingReplyRequestId = requestId;
    this.setState({ replySubmitting: true, replyUploading: replyImages.length > 0, replyError: "" });

    try {
      const imageURLs = await this.uploadImages(replyImages, true);
      const reply = await createVideoComment(
        this.props.submissionId,
        content,
        requestId,
        selectedRootCommentId,
        imageURLs,
      );
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence) return;
      this.revokeImageDrafts(replyImages);
      this.hgPendingReplyContent = "";
      this.hgPendingReplyRequestId = "";
      this.setState((state) => ({
        replies: mergeVideoComments(state.replies, [reply], HG_COMMENT_REPLY_MAX_RETAINED),
        comments: updateCommentById(state.comments, selectedRootCommentId, (comment) => ({
          ...comment,
          replyCount: Math.max(0, Number(comment.replyCount) || 0) + 1,
        })),
        totalCount: state.totalCount + 1,
        replyContent: "",
        replyImages: [],
        replySubmitting: false,
        replyUploading: false,
        feedback: "回复发布成功",
      }));
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence) return;
      this.setState({
        replySubmitting: false,
        replyUploading: false,
        replyError: getRequestErrorMessage(error, "回复发布失败，请稍后重试"),
      });
    }
  };

  /** 发送反应最终态，并使用服务端返回的计数覆盖本地行。 */
  handleReaction = async (comment, requestedReaction) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!commentId || this.state.pendingReactionIds[commentId]) return;
    const isReply = this.state.replies.some((item) => String(item?.commentId || "") === commentId);
    const reaction = comment?.reaction === requestedReaction ? "none" : requestedReaction;
    const requestSequence = this.hgRequestSequence;
    this.setState((state) => ({
      pendingReactionIds: { ...state.pendingReactionIds, [commentId]: true },
      error: "",
      replyError: "",
    }));

    try {
      const response = await setVideoCommentReaction(commentId, reaction);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      if (String(response?.commentId || "").trim() !== commentId) throw new Error("评论反应响应无效");
      const applyResponse = (item) => ({
        ...item,
        reaction: response?.reaction || "none",
        likeCount: Math.max(0, Number(response?.likeCount) || 0),
        dislikeCount: Math.max(0, Number(response?.dislikeCount) || 0),
      });
      this.setState((state) => {
        const pendingReactionIds = { ...state.pendingReactionIds };
        delete pendingReactionIds[commentId];
        return {
          comments: updateCommentById(state.comments, commentId, applyResponse),
          replies: updateCommentById(state.replies, commentId, applyResponse),
          pendingReactionIds,
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState((state) => {
        const pendingReactionIds = { ...state.pendingReactionIds };
        delete pendingReactionIds[commentId];
        return {
          pendingReactionIds,
          ...(isReply
            ? { replyError: getRequestErrorMessage(error, "回复操作失败，请稍后重试") }
            : { error: getRequestErrorMessage(error, "评论操作失败，请稍后重试") }),
        };
      });
    }
  };

  /** 删除顶层或已加载回复，并同步总数及根评论回复数。 */
  handleDelete = async (comment) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!comment?.canDelete || !commentId || this.state.deletingCommentId) return;
    const requestSequence = this.hgRequestSequence;
    const isReply = this.state.replies.some((item) => String(item?.commentId || "") === commentId);
    const rootCommentId = isReply ? String(comment?.rootCommentId || "").trim() : "";
    const isSelectedRoot = this.state.selectedRootCommentId === commentId;
    this.setState({ deletingCommentId: commentId, error: "", replyError: "", feedback: "" });

    try {
      const response = await deleteVideoComment(commentId);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      if (!response?.deleted || String(response?.commentId) !== commentId) throw new Error("评论删除响应无效");
      if (isSelectedRoot) this.revokeImageDrafts(this.state.replyImages);
      this.setState((state) => {
        return {
          comments: decrementVideoCommentReplyCount(
            state.comments.filter((item) => String(item?.commentId) !== commentId),
            rootCommentId,
          ),
          replies: isSelectedRoot ? [] : state.replies.filter((item) => String(item?.commentId) !== commentId),
          totalCount: Math.max(0, state.totalCount - 1),
          selectedRootCommentId: isSelectedRoot ? "" : state.selectedRootCommentId,
          replyContent: isSelectedRoot ? "" : state.replyContent,
          replyImages: isSelectedRoot ? [] : state.replyImages,
          deletingCommentId: "",
          feedback: "评论已删除",
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({ deletingCommentId: "", error: getRequestErrorMessage(error, "评论删除失败，请稍后重试") });
    }
  };

  /** 渲染最多三张服务端评论图片。 */
  renderCommentImages(comment) {
    const imageURLs = (Array.isArray(comment?.imageURLs) ? comment.imageURLs : []).slice(0, 3);
    if (imageURLs.length === 0) return null;
    return (
      <div className={styles.commentImages}>
        {imageURLs.map((imageURL, index) => (
          <a key={`${imageURL}-${index}`} href={imageURL} target="_blank" rel="noreferrer">
            <img src={imageURL} alt={`评论图片 ${index + 1}`} loading="lazy" />
          </a>
        ))}
      </div>
    );
  }

  /** 渲染点赞、点踩和回复操作，反应请求按 commentId 独立禁用。 */
  renderCommentActions(comment, showReplyButton) {
    const commentId = String(comment?.commentId || "");
    const pending = Boolean(this.state.pendingReactionIds[commentId]);
    return (
      <div className={styles.commentActions}>
        <button
          type="button"
          className={comment?.reaction === "like" ? styles.activeAction : ""}
          aria-pressed={comment?.reaction === "like"}
          disabled={pending}
          onClick={() => this.handleReaction(comment, "like")}
        >
          赞 {Math.max(0, Number(comment?.likeCount) || 0)}
        </button>
        <button
          type="button"
          className={comment?.reaction === "dislike" ? styles.activeAction : ""}
          aria-pressed={comment?.reaction === "dislike"}
          disabled={pending}
          onClick={() => this.handleReaction(comment, "dislike")}
        >
          踩 {Math.max(0, Number(comment?.dislikeCount) || 0)}
        </button>
        {showReplyButton && (
          <button
            type="button"
            aria-expanded={this.state.selectedRootCommentId === commentId}
            disabled={this.state.replySubmitting || this.state.replyUploading}
            onClick={() => this.handleOpenReplies(comment)}
          >
            回复 {Math.max(0, Number(comment?.replyCount) || 0)}
          </button>
        )}
      </div>
    );
  }

  /** 顶层虚拟行固定高度，图片、正文和操作栏都限制在行内。 */
  renderCommentRow = (comment) => {
    const commentId = String(comment?.commentId || "");
    const authorName = comment?.userName || "匿名用户";
    const avatar = comment?.avatarURL || "";
    return (
      <article className={styles.commentRow} aria-label={`${authorName}的评论`}>
        <div className={styles.commentAvatar} aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : authorName.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.commentBody}>
          <div className={styles.commentHeading}>
            <strong>{authorName}</strong>
            <time dateTime={getCommentDateTime(comment)}>{formatCommentTime(comment)}</time>
          </div>
          {comment?.content && <p className={styles.commentContent}>{comment.content}</p>}
          {this.renderCommentImages(comment)}
          {this.renderCommentActions(comment, true)}
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

  /** 渲染图片选择入口与固定预览。 */
  renderImagePicker(images, isReply, disabled) {
    const inputId = isReply ? "video-comment-reply-images" : "video-comment-images";
    return (
      <div className={`${styles.imagePicker} ${disabled ? styles.imagePickerDisabled : ""}`}>
        <div className={styles.imageDrafts}>
          {images.map((draft, index) => (
            <div key={draft.previewURL} className={styles.imageDraft}>
              <img src={draft.previewURL} alt={`待上传图片 ${index + 1}`} />
              <button
                type="button"
                aria-label={`移除图片 ${index + 1}`}
                disabled={disabled}
                onClick={() => this.handleImageRemove(index, isReply)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {images.length < HG_COMMENT_MAX_IMAGES && (
          <>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              disabled={disabled}
              onChange={(event) => this.handleImageSelect(event, isReply)}
            />
            <label htmlFor={inputId} aria-disabled={disabled}>添加图片 {images.length}/3</label>
          </>
        )}
      </div>
    );
  }

  /** 渲染顶层或回复编辑器。 */
  renderComposer(isReply = false) {
    const content = isReply ? this.state.replyContent : this.state.content;
    const images = isReply ? this.state.replyImages : this.state.images;
    const submitting = isReply ? this.state.replySubmitting : this.state.submitting;
    const uploading = isReply ? this.state.replyUploading : this.state.uploading;
    return (
      <form className={`${styles.composer} ${isReply ? styles.replyComposer : ""}`} onSubmit={isReply ? this.handleReplySubmit : this.handleSubmit}>
        <textarea
          value={content}
          rows={isReply ? 2 : 3}
          placeholder={isReply ? "回复这条评论" : "友善发言，分享你的看法"}
          aria-label={isReply ? "回复内容" : "评论内容"}
          disabled={submitting || uploading}
          onChange={(event) => this.handleContentChange(event, isReply)}
        />
        {this.renderImagePicker(images, isReply, submitting || uploading)}
        <div className={styles.composerFooter}>
          <span>{Array.from(content).length}/{HG_VIDEO_COMMENT_MAX_LENGTH}</span>
          <button type="submit" disabled={submitting || uploading || (!content.trim() && images.length === 0)}>
            {uploading ? "图片上传中..." : submitting ? "发布中..." : isReply ? "发布回复" : "发布评论"}
          </button>
        </div>
      </form>
    );
  }

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
          rowHeight={HG_COMMENT_ROW_HEIGHT}
          overscan={3}
          height={560}
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

  /** 回复面板位于虚拟列表之外，可按普通文档流渲染有界数据。 */
  renderReplyPanel() {
    const { selectedRootCommentId, replies, replyLoading, replyHasMore, replyError } = this.state;
    if (!selectedRootCommentId) return null;
    const rootComment = this.state.comments.find((comment) => String(comment?.commentId || "") === selectedRootCommentId);
    return (
      <aside className={styles.replyPanel} aria-labelledby="video-comment-replies-title">
        <div className={styles.replyPanelHeading}>
          <div>
            <span>回复列表</span>
            <h3 id="video-comment-replies-title">{rootComment?.userName || "评论"} 的讨论</h3>
          </div>
          <button
            type="button"
            disabled={this.state.replySubmitting || this.state.replyUploading}
            onClick={this.handleCloseReplies}
          >
            关闭
          </button>
        </div>
        {this.renderComposer(true)}
        {replyError && <p className={styles.inlineError} role="alert">{replyError}</p>}
        {replies.map((reply) => {
          const commentId = String(reply?.commentId || "");
          const authorName = reply?.userName || "匿名用户";
          return (
            <article key={commentId} className={styles.replyRow}>
              <div className={styles.commentAvatar} aria-hidden="true">
                {reply?.avatarURL ? <img src={reply.avatarURL} alt="" /> : authorName.slice(0, 1).toUpperCase()}
              </div>
              <div className={styles.commentBody}>
                <div className={styles.commentHeading}>
                  <strong>{authorName}</strong>
                  <time dateTime={getCommentDateTime(reply)}>{formatCommentTime(reply)}</time>
                </div>
                {reply?.content && <p className={styles.replyContent}>{reply.content}</p>}
                {this.renderCommentImages(reply)}
                {this.renderCommentActions(reply, false)}
              </div>
              {reply?.canDelete && (
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={this.state.deletingCommentId === commentId}
                  onClick={() => this.handleDelete(reply)}
                >
                  {this.state.deletingCommentId === commentId ? "删除中" : "删除"}
                </button>
              )}
            </article>
          );
        })}
        {replyLoading && <div className={styles.replyState}>回复加载中...</div>}
        {!replyLoading && replies.length === 0 && !replyError && <div className={styles.replyState}>还没有回复</div>}
        {!replyLoading && replyHasMore && (
          <button type="button" className={styles.loadRepliesButton} onClick={this.handleLoadMoreReplies}>加载更多回复</button>
        )}
        {!replyLoading && replies.length >= HG_COMMENT_REPLY_MAX_RETAINED && (
          <div className={styles.replyState}>回复面板最多展示 {HG_COMMENT_REPLY_MAX_RETAINED} 条</div>
        )}
      </aside>
    );
  }

  render() {
    const { sort, totalCount, error, feedback } = this.state;
    return (
      <section className={styles.commentSection} aria-labelledby="video-comments-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>DISCUSSION</span>
            <h2 id="video-comments-title">评论 <span>{totalCount}</span></h2>
          </div>
          <div className={styles.sortTabs} aria-label="评论排序">
            {[{ value: "latest", label: "最新" }, { value: "hot", label: "热门" }].map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={sort === item.value}
                disabled={this.state.replySubmitting || this.state.replyUploading}
                className={sort === item.value ? styles.activeTab : ""}
                onClick={() => this.handleSortChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {this.renderComposer(false)}
        {(error || feedback) && this.state.comments.length > 0 && (
          <p className={error ? styles.inlineError : styles.inlineFeedback} role={error ? "alert" : "status"}>{error || feedback}</p>
        )}
        {this.renderListState()}
        {this.renderReplyPanel()}
      </section>
    );
  }
}

export default HGVideoComments;
