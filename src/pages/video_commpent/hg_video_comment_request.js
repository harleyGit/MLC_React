const HG_VIDEO_COMMENT_BASE_PATH = "/api/v1/video_comments";
const HG_VIDEO_COMMENT_SORTS = new Set(["latest", "hot"]);

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
export function buildVideoCommentCreateBody(submissionId, content, requestId) {
  return {
    submissionId: String(submissionId || "").trim(),
    content: String(content || "").trim(),
    requestId: String(requestId || "").trim(),
  };
}

/**
 * 构造评论删除请求体。
 * @param {string|number} commentId 评论标识。
 * @returns {{commentId: string}} 评论删除请求体。
 */
export function buildVideoCommentDeleteBody(commentId) {
  return { commentId: String(commentId || "").trim() };
}
