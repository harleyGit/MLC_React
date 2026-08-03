const HG_VIDEO_COMMENT_BASE_PATH = "/api/v1/video_comments";
const HG_VIDEO_COMMENT_SORTS = new Set(["latest", "hot"]);
const HG_VIDEO_COMMENT_REACTIONS = new Set(["like", "dislike", "none"]);
const HG_VIDEO_COMMENT_IMAGE_EXTENSIONS = new Map([
  ["jpg", "jpeg"],
  ["jpeg", "jpeg"],
  ["png", "png"],
  ["webp", "webp"],
]);

/** 与 Go 服务端一致的评论最大字符数。 */
export const HG_VIDEO_COMMENT_MAX_LENGTH = 1000;

/** 按 Unicode code point 截断，和 Go 服务端的 rune 数限制保持一致。 */
export function truncateVideoCommentContent(content) {
  return Array.from(String(content || "")).slice(0, HG_VIDEO_COMMENT_MAX_LENGTH).join("");
}

/** 视频评论列表接口路径。 */
export const HG_VIDEO_COMMENT_LIST_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/list`;
/** 视频评论创建接口路径。 */
export const HG_VIDEO_COMMENT_CREATE_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/create`;
/** 视频评论删除接口路径。 */
export const HG_VIDEO_COMMENT_DELETE_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/delete`;
/** 视频评论回复列表接口路径。 */
export const HG_VIDEO_COMMENT_REPLIES_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/replies`;
/** 视频评论最终态反应接口路径。 */
export const HG_VIDEO_COMMENT_REACTION_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/reaction`;
/** 视频评论图片上传接口路径。 */
export const HG_VIDEO_COMMENT_IMAGE_PATH = `${HG_VIDEO_COMMENT_BASE_PATH}/image`;

/**
 * 构造评论游标分页参数；cursor 是不透明值，不做转换或清洗。
 * @param {string|number} submissionId 视频投稿标识。
 * @param {string} sort 排序方式。
 * @param {string} cursor 后端不透明游标。
 * @param {number} pageSize 单页数量，后端上限为 50。
 * @returns {Object} 评论列表查询参数。
 */
export function buildVideoCommentListQuery(submissionId, sort = "latest", cursor = "", pageSize = 20) {
  const parsedPageSize = Number(pageSize);
  const normalizedPageSize = Number.isFinite(parsedPageSize)
    ? Math.min(50, Math.max(1, Math.trunc(parsedPageSize)))
    : 20;
  const query = {
    submissionId: String(submissionId || "").trim(),
    sort: HG_VIDEO_COMMENT_SORTS.has(sort) ? sort : "latest",
    pageSize: normalizedPageSize,
  };

  if (cursor !== "") query.cursor = cursor;
  return query;
}

/**
 * 构造评论创建请求体，去除用户输入首尾空白。
 * @param {string|number} submissionId 视频投稿标识。
 * @param {string} content 评论内容。
 * @param {string} requestId 幂等请求标识。
 * @returns {Object} 评论创建请求体。
 */
export function buildVideoCommentCreateBody(
  submissionId,
  content,
  requestId,
  parentCommentId = "",
  imageURLs = [],
) {
  const body = {
    submissionId: String(submissionId || "").trim(),
    content: String(content || "").trim(),
    requestId: String(requestId || "").trim(),
  };
  const normalizedParentCommentId = String(parentCommentId || "").trim();
  const normalizedImageURLs = (Array.isArray(imageURLs) ? imageURLs : [])
    .map((imageURL) => String(imageURL || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (normalizedParentCommentId) body.parentCommentId = normalizedParentCommentId;
  if (normalizedImageURLs.length > 0) body.imageURLs = normalizedImageURLs;
  return body;
}

/** 构造回复列表游标参数，回复顺序由后端按时间正序返回。 */
export function buildVideoCommentRepliesQuery(rootCommentId, cursor = "", pageSize = 20) {
  const parsedPageSize = Number(pageSize);
  const query = {
    rootCommentId: String(rootCommentId || "").trim(),
    pageSize: Number.isFinite(parsedPageSize)
      ? Math.min(50, Math.max(1, Math.trunc(parsedPageSize)))
      : 20,
  };
  if (cursor !== "") query.cursor = cursor;
  return query;
}

/** 构造评论最终态反应请求体。 */
export function buildVideoCommentReactionBody(commentId, reaction) {
  return {
    commentId: String(commentId || "").trim(),
    reaction: HG_VIDEO_COMMENT_REACTIONS.has(reaction) ? reaction : "none",
  };
}

/** 构造原始二进制图片上传路径，仅允许后端支持的扩展名。 */
export function buildVideoCommentImagePath(extension) {
  const normalizedExtension = String(extension || "").trim().toLowerCase().replace(/^\./, "");
  const imageExtension = HG_VIDEO_COMMENT_IMAGE_EXTENSIONS.get(normalizedExtension) || "png";
  return `${HG_VIDEO_COMMENT_IMAGE_PATH}?ext=${imageExtension}`;
}

/**
 * 构造评论删除请求体。
 * @param {string|number} commentId 评论标识。
 * @returns {{commentId: string}} 评论删除请求体。
 */
export function buildVideoCommentDeleteBody(commentId) {
  return { commentId: String(commentId || "").trim() };
}
