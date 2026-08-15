import React from "react";
import { getRequestErrorMessage } from "../../api/hg_request_error";
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
const HG_COMMENT_MAX_IMAGES = 3;
const HG_COMMENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const HG_COMMENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
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
  return comments.map((comment) =>
    String(comment?.commentId || "") === commentId ? updater(comment) : comment
  );
}

/** 在所有根评论分组中按 commentId 更新一条二级评论。 */
function updateReplyGroupByCommentId(replyGroups, commentId, updater) {
  let changed = false;
  const nextGroups = Object.fromEntries(
    Object.entries(replyGroups).map(([rootCommentId, group]) => {
      let groupChanged = false;
      const replies = updateCommentById(group.replies || [], commentId, (reply) => {
        changed = true;
        groupChanged = true;
        return updater(reply);
      });
      return [rootCommentId, groupChanged ? { ...group, replies } : group];
    })
  );
  return changed ? nextGroups : replyGroups;
}

/** 生成评论创建幂等标识，失败重试前由当前提交过程保持同一个值。 */
function createCommentRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `comment_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

/** 固定使用 zh-CN 和东八区，避免时间展示受浏览器默认地区影响。 */
function formatCommentTime(comment) {
  const value = comment?.createdAt || "";
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const elapsedSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (elapsedSeconds >= 0 && elapsedSeconds < 60) return "刚刚";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}分钟前`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}小时前`;
  return HG_COMMENT_TIME_FORMATTER.format(date);
}

/** 返回 time 元素使用的原始 ISO 时间，非法值不输出 dateTime。 */
function getCommentDateTime(comment) {
  const value = String(comment?.createdAt || "").trim();
  return value && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

/** 将选择的文件转换为可回收的本地预览记录。 */
function createImageDrafts(files) {
  return files.map((file) => ({
    file,
    previewURL: URL.createObjectURL(file),
    imageURL: "",
  }));
}

/** 可复用的视频评论区，负责游标列表、图片、反应、回复和删除。 */
class HGVideoComments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      comments: [],
      commentPage: 0,
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
      replyParentCommentId: "",
      replyToUserName: "",
      replyGroups: {},
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
    this.hgReplyComposerRef = React.createRef();
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
    this.setState(
      {
        comments: [],
        commentPage: 0,
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
        replyParentCommentId: "",
        replyToUserName: "",
        replyGroups: {},
        replySubmitting: false,
        replyUploading: false,
        replyContent: "",
        replyImages: [],
        error: "",
        feedback: "",
        replyError: "",
        reachedClientLimit: false,
      },
      () => this.fetchComments(submissionId, sort, "", false, requestSequence)
    );
  };

  /** 请求一页顶层评论；cursor 原样透传，响应按 commentId 去重。 */
  fetchComments = async (
    submissionId,
    sort,
    cursor,
    append,
    requestSequence = this.hgRequestSequence,
    targetPage = 0
  ) => {
    if (!String(submissionId || "").trim()) {
      if (this.hgMounted && requestSequence === this.hgRequestSequence) {
        this.setState({
          loading: false,
          hasMore: false,
          error: "缺少视频标识，无法加载评论",
        });
      }
      return;
    }

    try {
      const response = await getVideoComments(
        submissionId,
        sort,
        cursor,
        HG_COMMENT_PAGE_SIZE
      );
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState((state) => {
        const currentComments = append
          ? state.comments
          : state.pendingCreatedComment
          ? [state.pendingCreatedComment]
          : [];
        const comments = mergeVideoComments(
          currentComments,
          response?.comments || []
        );
        const reachedClientLimit = comments.length >= HG_COMMENT_MAX_RETAINED;
        return {
          comments,
          commentPage: targetPage,
          totalCount: Math.max(
            state.totalCount,
            Math.max(0, Number(response?.totalCount) || 0)
          ),
          pendingCreatedComment: null,
          nextCursor: response?.nextCursor || "",
          hasMore: !reachedClientLimit && Boolean(response?.hasMore),
          loading: false,
          error: "",
          reachedClientLimit,
        };
      }, () => this.loadCurrentPageReplies());
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        loading: false,
        error: getRequestErrorMessage(error, "评论加载失败，请稍后重试"),
      });
    }
  };

  /** 切换一级评论上一页，回复输入框随页面切换关闭。 */
  handlePreviousCommentPage = () => {
    if (this.state.loading || this.state.commentPage <= 0) return;
    this.handleCloseReplies();
    this.setState(
      (state) => ({ commentPage: state.commentPage - 1 }),
      this.loadCurrentPageReplies
    );
  };

  /** 优先使用已缓存一级评论页，未缓存时按服务端游标读取下一页。 */
  handleNextCommentPage = () => {
    const { comments, commentPage, loading, hasMore, nextCursor, sort } =
      this.state;
    if (loading) return;
    const nextPage = commentPage + 1;
    if (nextPage * HG_COMMENT_PAGE_SIZE < comments.length) {
      this.handleCloseReplies();
      this.setState({ commentPage: nextPage }, this.loadCurrentPageReplies);
      return;
    }
    if (!hasMore || !nextCursor) return;
    this.handleCloseReplies();
    this.setState({ loading: true, error: "" }, () => {
      this.fetchComments(
        this.props.submissionId,
        sort,
        nextCursor,
        true,
        this.hgRequestSequence,
        nextPage
      );
    });
  };

  /** 切换 latest/hot 后重新从首个游标加载。 */
  handleSortChange = (sort) => {
    if (
      sort === this.state.sort ||
      this.state.loading ||
      this.state.replySubmitting ||
      this.state.replyUploading
    )
      return;
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
      this.setState(
        isReply
          ? { replyError: "每条评论最多选择 3 张图片" }
          : { error: "每条评论最多选择 3 张图片" }
      );
      return;
    }
    const invalidFile = selectedFiles.find(
      (file) =>
        !HG_COMMENT_IMAGE_TYPES.has(file.type) ||
        file.size > HG_COMMENT_MAX_IMAGE_BYTES
    );
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
      this.setState((state) => ({
        replyImages: [...state.replyImages, ...imageDrafts],
        replyError: "",
      }));
      return;
    }
    this.hgPendingCreateRequestId = "";
    this.setState((state) => ({
      images: [...state.images, ...imageDrafts],
      error: "",
      feedback: "",
    }));
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
    const uploadResults = await Promise.allSettled(
      pendingDrafts.map(async (draft) => {
        const response = await uploadVideoCommentImage(draft.file);
        const imageURL = String(response?.imageURL || "").trim();
        if (!imageURL) throw new Error("图片上传响应无效");
        draft.imageURL = imageURL;
      })
    );
    if (!this.hgMounted) return [];
    this.setState(
      isReply ? { replyImages: [...drafts] } : { images: [...drafts] }
    );
    const failedUpload = uploadResults.find(
      (result) => result.status === "rejected"
    );
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
    if (
      (!content && images.length === 0) ||
      this.state.submitting ||
      this.state.uploading
    )
      return;
    const requestSequence = this.hgRequestSequence;
    const draftKey = `${content}|${images
      .map((draft) => draft.file.name)
      .join("|")}`;
    const requestId =
      this.hgPendingCreateContent === draftKey && this.hgPendingCreateRequestId
        ? this.hgPendingCreateRequestId
        : createCommentRequestId();
    this.hgPendingCreateContent = draftKey;
    this.hgPendingCreateRequestId = requestId;
    this.setState({
      submitting: true,
      uploading: images.length > 0,
      error: "",
      feedback: "",
    });

    try {
      const imageURLs = await this.uploadImages(images, false);
      const comment = await createVideoComment(
        this.props.submissionId,
        content,
        requestId,
        "",
        imageURLs
      );
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.revokeImageDrafts(images);
      this.hgPendingCreateContent = "";
      this.hgPendingCreateRequestId = "";
      const nextRequestSequence = ++this.hgRequestSequence;
      this.setState(
        (state) => ({
          comments: [comment],
          commentPage: 0,
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
        }),
        () =>
          this.fetchComments(
            this.props.submissionId,
            "latest",
            "",
            false,
            nextRequestSequence
          )
      );
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        submitting: false,
        uploading: false,
        error: getRequestErrorMessage(error, "评论发布失败，请稍后重试"),
      });
    }
  };

  /** 在对应一级评论下打开回复输入框，并确保该评论的二级评论已加载。 */
  handleOpenReplies = (comment) => {
    const rootCommentId = String(comment?.commentId || "").trim();
    if (
      !rootCommentId ||
      this.state.replySubmitting ||
      this.state.replyUploading
    )
      return;
    if (this.state.selectedRootCommentId === rootCommentId) {
      this.handleCloseReplies();
      return;
    }
    this.revokeImageDrafts(this.state.replyImages);
    this.hgPendingReplyContent = "";
    this.hgPendingReplyRequestId = "";
    this.setState(
      {
        selectedRootCommentId: rootCommentId,
        replyParentCommentId: rootCommentId,
        replyToUserName: comment?.userName || "匿名用户",
        replySubmitting: false,
        replyUploading: false,
        replyContent: "",
        replyImages: [],
        replyError: "",
      },
      () => {
        this.hgReplyComposerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        this.hgReplyComposerRef.current?.focus({ preventScroll: true });
        this.ensureRepliesLoaded(rootCommentId);
      }
    );
  };

  /** 将回复目标切换到楼中楼评论，提交时以该评论作为直接父评论。 */
  handleSelectReplyTarget = (comment) => {
    const parentCommentId = String(comment?.commentId || "").trim();
    const rootCommentId = String(comment?.rootCommentId || "").trim();
    if (
      !parentCommentId ||
      !rootCommentId ||
      this.state.replySubmitting ||
      this.state.replyUploading
    )
      return;
    this.hgPendingReplyContent = "";
    this.hgPendingReplyRequestId = "";
    this.setState(
      {
        selectedRootCommentId: rootCommentId,
        replyParentCommentId: parentCommentId,
        replyToUserName: comment?.userName || "匿名用户",
        replyError: "",
      },
      () => {
        this.hgReplyComposerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        this.hgReplyComposerRef.current?.focus({ preventScroll: true });
      }
    );
  };

  /** 仅为当前一级评论分页自动读取二级评论，避免一次请求全部回复。 */
  loadCurrentPageReplies = () => {
    const start = this.state.commentPage * HG_COMMENT_PAGE_SIZE;
    this.state.comments
      .slice(start, start + HG_COMMENT_PAGE_SIZE)
      .forEach((comment) => {
        if (Math.max(0, Number(comment?.replyCount) || 0) > 0) {
          this.ensureRepliesLoaded(String(comment?.commentId || ""));
        }
      });
  };

  /** 首次读取指定一级评论的回复，已加载或加载中的分组不会重复请求。 */
  ensureRepliesLoaded = (rootCommentId) => {
    const normalizedRootCommentId = String(rootCommentId || "").trim();
    const group = this.state.replyGroups[normalizedRootCommentId];
    if (!normalizedRootCommentId || group?.loading || group?.loaded) return;
    this.setState(
      (state) => ({
        replyGroups: {
          ...state.replyGroups,
          [normalizedRootCommentId]: {
            replies: [],
            page: 0,
            nextCursor: "",
            hasMore: false,
            loading: true,
            loaded: false,
            error: "",
          },
        },
      }),
      () => this.fetchReplies(normalizedRootCommentId, "", false, 0)
    );
  };

  /** 读取指定一级评论的回复游标页，每组最多保留 100 条。 */
  fetchReplies = async (
    rootCommentId,
    cursor,
    append,
    targetPage
  ) => {
    const requestSequence = this.hgRequestSequence;
    try {
      const response = await getVideoCommentReplies(
        rootCommentId,
        cursor,
        HG_COMMENT_PAGE_SIZE
      );
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState((state) => {
        const currentGroup = state.replyGroups[rootCommentId] || {};
        const replies = mergeVideoComments(
          append ? currentGroup.replies || [] : [],
          response?.comments || [],
          HG_COMMENT_REPLY_MAX_RETAINED
        );
        const reachedReplyLimit =
          replies.length >= HG_COMMENT_REPLY_MAX_RETAINED;
        return {
          replyGroups: {
            ...state.replyGroups,
            [rootCommentId]: {
              replies,
              page: targetPage,
              nextCursor: response?.nextCursor || "",
              hasMore: !reachedReplyLimit && Boolean(response?.hasMore),
              loading: false,
              loaded: true,
              error: "",
            },
          },
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState((state) => ({
        replyGroups: {
          ...state.replyGroups,
          [rootCommentId]: {
            ...(state.replyGroups[rootCommentId] || { replies: [] }),
            loading: false,
            loaded: Boolean(append),
            error: getRequestErrorMessage(error, "回复加载失败，请稍后重试"),
          },
        },
      }));
    }
  };

  /** 切换指定一级评论的上一页回复。 */
  handlePreviousReplyPage = (rootCommentId) => {
    const group = this.state.replyGroups[rootCommentId];
    if (!rootCommentId || !group || group.loading || group.page <= 0) return;
    this.setState(
      (state) => ({
        replyGroups: {
          ...state.replyGroups,
          [rootCommentId]: { ...group, page: group.page - 1 },
        },
      })
    );
  };

  /** 优先切换缓存页，未缓存时按该一级评论的回复游标读取下一页。 */
  handleNextReplyPage = (rootCommentId) => {
    const group = this.state.replyGroups[rootCommentId];
    if (!rootCommentId || !group || group.loading) return;
    const nextPage = group.page + 1;
    if (nextPage * HG_COMMENT_PAGE_SIZE < group.replies.length) {
      this.setState((state) => ({
        replyGroups: {
          ...state.replyGroups,
          [rootCommentId]: { ...group, page: nextPage },
        },
      }));
      return;
    }
    if (!group.hasMore || !group.nextCursor) return;
    this.setState(
      (state) => ({
        replyGroups: {
          ...state.replyGroups,
          [rootCommentId]: { ...group, loading: true, error: "" },
        },
      }),
      () => this.fetchReplies(rootCommentId, group.nextCursor, true, nextPage)
    );
  };

  /** 关闭当前一级评论下的回复输入框并回收未发布图片。 */
  handleCloseReplies = () => {
    if (this.state.replySubmitting || this.state.replyUploading) return;
    this.hgReplyRequestSequence += 1;
    this.revokeImageDrafts(this.state.replyImages);
    this.setState({
      selectedRootCommentId: "",
      replyParentCommentId: "",
      replyToUserName: "",
      replyContent: "",
      replyImages: [],
      replySubmitting: false,
      replyUploading: false,
      replyError: "",
    });
  };

  /** 发布回复并同步根评论 replyCount 与全局评论总数。 */
  handleReplySubmit = async (event) => {
    event.preventDefault();
    const { selectedRootCommentId, replyParentCommentId, replyImages } =
      this.state;
    const content = this.state.replyContent.trim();
    if (
      !selectedRootCommentId ||
      !replyParentCommentId ||
      (!content && replyImages.length === 0) ||
      this.state.replySubmitting ||
      this.state.replyUploading
    )
      return;
    const requestSequence = this.hgReplyRequestSequence;
    const draftKey = `${replyParentCommentId}|${content}|${replyImages
      .map((draft) => draft.file.name)
      .join("|")}`;
    const requestId =
      this.hgPendingReplyContent === draftKey && this.hgPendingReplyRequestId
        ? this.hgPendingReplyRequestId
        : createCommentRequestId();
    this.hgPendingReplyContent = draftKey;
    this.hgPendingReplyRequestId = requestId;
    this.setState({
      replySubmitting: true,
      replyUploading: replyImages.length > 0,
      replyError: "",
    });

    try {
      const imageURLs = await this.uploadImages(replyImages, true);
      const reply = await createVideoComment(
        this.props.submissionId,
        content,
        requestId,
        replyParentCommentId,
        imageURLs
      );
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence)
        return;
      this.revokeImageDrafts(replyImages);
      this.hgPendingReplyContent = "";
      this.hgPendingReplyRequestId = "";
      this.setState((state) => {
        const replies = mergeVideoComments(
          state.replyGroups[selectedRootCommentId]?.replies || [],
          [reply],
          HG_COMMENT_REPLY_MAX_RETAINED
        );
        return {
          replyParentCommentId: selectedRootCommentId,
          replyToUserName:
            state.comments.find(
              (comment) =>
                String(comment?.commentId || "") === selectedRootCommentId
            )?.userName || "匿名用户",
          replyGroups: {
            ...state.replyGroups,
            [selectedRootCommentId]: {
              ...(state.replyGroups[selectedRootCommentId] || {}),
              replies,
              page: Math.max(
                0,
                Math.ceil(replies.length / HG_COMMENT_PAGE_SIZE) - 1
              ),
              loaded: true,
              loading: false,
              error: "",
            },
          },
          comments: updateCommentById(
            state.comments,
            selectedRootCommentId,
            (comment) => ({
              ...comment,
              replyCount: Math.max(0, Number(comment.replyCount) || 0) + 1,
            })
          ),
          totalCount: state.totalCount + 1,
          replyContent: "",
          replyImages: [],
          replySubmitting: false,
          replyUploading: false,
          feedback: "回复发布成功",
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgReplyRequestSequence)
        return;
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
    const isReply = Object.values(this.state.replyGroups).some((group) =>
      (group.replies || []).some(
        (item) => String(item?.commentId || "") === commentId
      )
    );
    const reaction =
      comment?.reaction === requestedReaction ? "none" : requestedReaction;
    const requestSequence = this.hgRequestSequence;
    this.setState((state) => ({
      pendingReactionIds: { ...state.pendingReactionIds, [commentId]: true },
      error: "",
      replyError: "",
    }));

    try {
      const response = await setVideoCommentReaction(commentId, reaction);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      if (String(response?.commentId || "").trim() !== commentId)
        throw new Error("评论反应响应无效");
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
          replyGroups: updateReplyGroupByCommentId(
            state.replyGroups,
            commentId,
            applyResponse
          ),
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
            ? {
                replyError: getRequestErrorMessage(
                  error,
                  "回复操作失败，请稍后重试"
                ),
              }
            : {
                error: getRequestErrorMessage(
                  error,
                  "评论操作失败，请稍后重试"
                ),
              }),
        };
      });
    }
  };

  /** 删除顶层或已加载回复，并同步总数及根评论回复数。 */
  handleDelete = async (comment) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!comment?.canDelete || !commentId || this.state.deletingCommentId)
      return;
    const requestSequence = this.hgRequestSequence;
    const isReply = Object.values(this.state.replyGroups).some((group) =>
      (group.replies || []).some(
        (item) => String(item?.commentId || "") === commentId
      )
    );
    const rootCommentId = isReply
      ? String(comment?.rootCommentId || "").trim()
      : "";
    const isSelectedRoot = this.state.selectedRootCommentId === commentId;
    this.setState({
      deletingCommentId: commentId,
      error: "",
      replyError: "",
      feedback: "",
    });

    try {
      const response = await deleteVideoComment(commentId);
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      if (!response?.deleted || String(response?.commentId) !== commentId)
        throw new Error("评论删除响应无效");
      if (isSelectedRoot) this.revokeImageDrafts(this.state.replyImages);
      this.setState((state) => {
        const comments = decrementVideoCommentReplyCount(
          state.comments.filter(
            (item) => String(item?.commentId) !== commentId
          ),
          rootCommentId
        );
        const replyGroups = !isReply
          ? Object.fromEntries(
              Object.entries(state.replyGroups).filter(
                ([groupRootCommentId]) => groupRootCommentId !== commentId
              )
            )
          : Object.fromEntries(
              Object.entries(state.replyGroups).map(
                ([groupRootCommentId, group]) => {
                  const replies = (group.replies || []).filter(
                    (item) => String(item?.commentId) !== commentId
                  );
                  return [
                    groupRootCommentId,
                    {
                      ...group,
                      replies,
                      page: Math.min(
                        group.page || 0,
                        Math.max(
                          0,
                          Math.ceil(replies.length / HG_COMMENT_PAGE_SIZE) - 1
                        )
                      ),
                    },
                  ];
                }
              )
            );
        return {
          comments,
          commentPage: Math.min(
            state.commentPage,
            Math.max(
              0,
              Math.ceil(comments.length / HG_COMMENT_PAGE_SIZE) - 1
            )
          ),
          replyGroups,
          totalCount: Math.max(0, state.totalCount - 1),
          selectedRootCommentId: isSelectedRoot
            ? ""
            : state.selectedRootCommentId,
          replyParentCommentId: isSelectedRoot
            ? ""
            : state.replyParentCommentId === commentId
            ? state.selectedRootCommentId
            : state.replyParentCommentId,
          replyToUserName: isSelectedRoot
            ? ""
            : state.replyParentCommentId === commentId
            ? state.comments.find(
                (item) =>
                  String(item?.commentId || "") === state.selectedRootCommentId
              )?.userName || "匿名用户"
            : state.replyToUserName,
          replyContent: isSelectedRoot ? "" : state.replyContent,
          replyImages: isSelectedRoot ? [] : state.replyImages,
          deletingCommentId: "",
          feedback: "评论已删除",
        };
      });
    } catch (error) {
      if (!this.hgMounted || requestSequence !== this.hgRequestSequence) return;
      this.setState({
        deletingCommentId: "",
        error: getRequestErrorMessage(error, "评论删除失败，请稍后重试"),
      });
    }
  };

  /** 渲染最多三张服务端评论图片。 */
  renderCommentImages(comment) {
    const imageURLs = (
      Array.isArray(comment?.imageURLs) ? comment.imageURLs : []
    ).slice(0, 3);
    if (imageURLs.length === 0) return null;
    return (
      <div className={styles.commentImages}>
        {imageURLs.map((imageURL, index) => (
          <a
            key={`${imageURL}-${index}`}
            href={imageURL}
            target="_blank"
            rel="noreferrer"
          >
            <img src={imageURL} alt={`评论图片 ${index + 1}`} loading="lazy" />
          </a>
        ))}
      </div>
    );
  }

  /** 渲染点赞、点踩和回复操作，反应请求按 commentId 独立禁用。 */
  renderCommentActions(comment, replyAction) {
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
        {replyAction && (
          <button
            type="button"
            aria-expanded={
              replyAction === "root"
                ? this.state.selectedRootCommentId === commentId
                : undefined
            }
            disabled={this.state.replySubmitting || this.state.replyUploading}
            onClick={() =>
              replyAction === "root"
                ? this.handleOpenReplies(comment)
                : this.handleSelectReplyTarget(comment)
            }
          >
            {replyAction === "root" &&
            this.state.selectedRootCommentId === commentId
              ? "取消回复"
              : "回复"}
            {replyAction === "root" &&
              ` ${Math.max(0, Number(comment?.replyCount) || 0)}`}
          </button>
        )}
      </div>
    );
  }

  /** 渲染一条二级评论，回复操作会继续使用所属一级评论下的输入框。 */
  renderReplyRow(reply) {
    const commentId = String(reply?.commentId || "");
    const authorName = reply?.userName || "匿名用户";
    return (
      <article key={commentId} className={styles.replyRow}>
        <div className={styles.commentAvatar} aria-hidden="true">
          {reply?.avatarURL ? (
            <img src={reply.avatarURL} alt="" />
          ) : (
            authorName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className={styles.commentBody}>
          <div className={styles.commentHeading}>
            <strong>{authorName}</strong>
            <time dateTime={getCommentDateTime(reply)}>
              {formatCommentTime(reply)}
            </time>
          </div>
          {reply?.content && (
            <p className={styles.replyContent}>
              {reply?.replyToUserName && (
                <>
                  回复 {" "}
                  <span className={styles.replyMention}>
                    @{reply.replyToUserName}
                  </span>{" "}
                  : {" "}
                </>
              )}
              {reply.content}
            </p>
          )}
          {this.renderCommentImages(reply)}
          {this.renderCommentActions(reply, "reply")}
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
  }

  /** 二级评论默认显示；回复编辑器只在用户选择该一级评论时显示。 */
  renderReplies(comment) {
    const rootCommentId = String(comment?.commentId || "");
    const group = this.state.replyGroups[rootCommentId];
    const replies = group?.replies || [];
    const replyPage = Math.max(0, Number(group?.page) || 0);
    const replyPageStart = replyPage * HG_COMMENT_PAGE_SIZE;
    const visibleReplies = replies.slice(
      replyPageStart,
      replyPageStart + HG_COMMENT_PAGE_SIZE
    );
    const composerOpen = this.state.selectedRootCommentId === rootCommentId;
    if (!group && !composerOpen) return null;
    return (
      <div className={styles.inlineReplies}>
        {group?.error && (
          <p className={styles.inlineError} role="alert">
            {group.error}
          </p>
        )}
        {visibleReplies.map((reply) => this.renderReplyRow(reply))}
        {group?.loading && (
          <div className={styles.replyState}>回复加载中...</div>
        )}
        {!group?.loading && group?.loaded && replies.length === 0 && composerOpen && (
          <div className={styles.replyState}>还没有回复</div>
        )}
        {!group?.loading &&
          replies.length >= HG_COMMENT_REPLY_MAX_RETAINED && (
            <div className={styles.replyState}>
              最多展示 {HG_COMMENT_REPLY_MAX_RETAINED} 条回复
            </div>
          )}
        {group?.loaded && replies.length > 0 && (
          <div className={styles.pagination} aria-label="二级评论分页">
            <button
              type="button"
              disabled={
                group.loading ||
                replyPage <= 0 ||
                this.state.replySubmitting ||
                this.state.replyUploading
              }
              onClick={() => this.handlePreviousReplyPage(rootCommentId)}
            >
              上一页
            </button>
            <span>第 {replyPage + 1} 页</span>
            <button
              type="button"
              disabled={
                group.loading ||
                ((replyPage + 1) * HG_COMMENT_PAGE_SIZE >= replies.length &&
                  (!group.hasMore || !group.nextCursor)) ||
                this.state.replySubmitting ||
                this.state.replyUploading
              }
              onClick={() => this.handleNextReplyPage(rootCommentId)}
            >
              下一页
            </button>
          </div>
        )}
        {composerOpen && (
          <div className={styles.inlineReplyComposer}>
            {this.renderComposer(true)}
            {this.state.replyError && (
              <p className={styles.inlineError} role="alert">
                {this.state.replyError}
              </p>
            )}
            <button
              type="button"
              className={styles.cancelReplyButton}
              disabled={
                this.state.replySubmitting || this.state.replyUploading
              }
              onClick={this.handleCloseReplies}
            >
              取消回复
            </button>
          </div>
        )}
      </div>
    );
  }

  /** 渲染一级评论及其默认展示的二级评论。 */
  renderCommentRow = (comment) => {
    const commentId = String(comment?.commentId || "");
    const authorName = comment?.userName || "匿名用户";
    const avatar = comment?.avatarURL || "";
    return (
      <div className={styles.commentThread}>
        <article className={styles.commentRow} aria-label={`${authorName}的评论`}>
          <div className={styles.commentAvatar} aria-hidden="true">
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              authorName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className={styles.commentBody}>
            <div className={styles.commentHeading}>
              <strong>{authorName}</strong>
              <time dateTime={getCommentDateTime(comment)}>
                {formatCommentTime(comment)}
              </time>
            </div>
            {comment?.content && (
              <p className={styles.commentContent}>{comment.content}</p>
            )}
            {this.renderCommentImages(comment)}
            {this.renderCommentActions(comment, "root")}
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
        {this.renderReplies(comment)}
      </div>
    );
  };

  /** 渲染图片选择入口与固定预览。 */
  renderImagePicker(images, isReply, disabled) {
    const inputId = isReply
      ? "video-comment-reply-images"
      : "video-comment-images";
    return (
      <div
        className={`${styles.imagePicker} ${
          disabled ? styles.imagePickerDisabled : ""
        }`}
      >
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
            <label htmlFor={inputId} aria-disabled={disabled}>
              添加图片 {images.length}/3
            </label>
          </>
        )}
      </div>
    );
  }

  /** 渲染顶层或回复编辑器。 */
  renderComposer(isReply = false) {
    const content = isReply ? this.state.replyContent : this.state.content;
    const images = isReply ? this.state.replyImages : this.state.images;
    const submitting = isReply
      ? this.state.replySubmitting
      : this.state.submitting;
    const uploading = isReply
      ? this.state.replyUploading
      : this.state.uploading;
    return (
      <form
        className={`${styles.composer} ${isReply ? styles.replyComposer : ""}`}
        onSubmit={isReply ? this.handleReplySubmit : this.handleSubmit}
      >
        {isReply && this.state.replyToUserName && (
          <div className={styles.replyTarget}>
            回复 <strong>@{this.state.replyToUserName}</strong>
          </div>
        )}
        <textarea
          ref={isReply ? this.hgReplyComposerRef : undefined}
          value={content}
          rows={isReply ? 2 : 3}
          placeholder={
            isReply
              ? `回复 @${this.state.replyToUserName || "这条评论"}`
              : "友善发言，分享你的看法"
          }
          aria-label={isReply ? "回复内容" : "评论内容"}
          disabled={submitting || uploading}
          onChange={(event) => this.handleContentChange(event, isReply)}
        />
        {this.renderImagePicker(images, isReply, submitting || uploading)}
        <div className={styles.composerFooter}>
          <span>
            {Array.from(content).length}/{HG_VIDEO_COMMENT_MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={
              submitting ||
              uploading ||
              (!content.trim() && images.length === 0)
            }
          >
            {uploading
              ? "图片上传中..."
              : submitting
              ? "发布中..."
              : isReply
              ? "发布回复"
              : "发布评论"}
          </button>
        </div>
      </form>
    );
  }

  renderListState() {
    const {
      comments,
      commentPage,
      loading,
      error,
      hasMore,
      nextCursor,
      reachedClientLimit,
    } = this.state;
    if (loading && comments.length === 0)
      return <div className={styles.statePanel}>评论加载中...</div>;
    if (error && comments.length === 0) {
      return (
        <div
          className={`${styles.statePanel} ${styles.errorState}`}
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() =>
              this.resetAndLoad(this.props.submissionId, this.state.sort)
            }
          >
            重试
          </button>
        </div>
      );
    }
    if (comments.length === 0)
      return <div className={styles.statePanel}>还没有评论，来抢沙发吧</div>;

    const pageStart = commentPage * HG_COMMENT_PAGE_SIZE;
    const visibleComments = comments.slice(
      pageStart,
      pageStart + HG_COMMENT_PAGE_SIZE
    );
    const hasCachedNextPage =
      (commentPage + 1) * HG_COMMENT_PAGE_SIZE < comments.length;

    return (
      <>
        <div className={styles.commentList}>
          {visibleComments.map((comment) => (
            <React.Fragment key={String(comment?.commentId || "")}>
              {this.renderCommentRow(comment)}
            </React.Fragment>
          ))}
        </div>
        <div className={styles.listFooter} role="status">
          {loading && "正在加载更多评论..."}
          {!loading &&
            reachedClientLimit &&
            `为控制内存占用，仅保留前 ${HG_COMMENT_MAX_RETAINED} 条评论`}
          {!loading && !hasMore && !reachedClientLimit && "没有更多评论了"}
        </div>
        <div className={styles.pagination} aria-label="一级评论分页">
          <button
            type="button"
            disabled={
              loading ||
              commentPage <= 0 ||
              this.state.replySubmitting ||
              this.state.replyUploading
            }
            onClick={this.handlePreviousCommentPage}
          >
            上一页
          </button>
          <span>第 {commentPage + 1} 页</span>
          <button
            type="button"
            disabled={
              loading ||
              (!hasCachedNextPage && (!hasMore || !nextCursor)) ||
              this.state.replySubmitting ||
              this.state.replyUploading
            }
            onClick={this.handleNextCommentPage}
          >
            下一页
          </button>
        </div>
      </>
    );
  }

  render() {
    const { sort, totalCount, error, feedback } = this.state;
    return (
      <section
        className={styles.commentSection}
        aria-labelledby="video-comments-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>DISCUSSION</span>
            <h2 id="video-comments-title">
              评论 <span>{totalCount}</span>
            </h2>
          </div>
          <div className={styles.sortTabs} aria-label="评论排序">
            {[
              { value: "latest", label: "最新" },
              { value: "hot", label: "热门" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={sort === item.value}
                disabled={
                  this.state.replySubmitting || this.state.replyUploading
                }
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
          <p
            className={error ? styles.inlineError : styles.inlineFeedback}
            role={error ? "alert" : "status"}
          >
            {error || feedback}
          </p>
        )}
        {this.renderListState()}
      </section>
    );
  }
}

export default HGVideoComments;
