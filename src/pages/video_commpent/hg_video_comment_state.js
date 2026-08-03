/** 按 commentId 合并评论，本地项优先并保持原有顺序。 */
export function mergeVideoComments(currentComments, incomingComments, maximum = 500) {
  const merged = [];
  const commentIds = new Set();
  [...currentComments, ...incomingComments].forEach((comment) => {
    const commentId = String(comment?.commentId || "").trim();
    if (!commentId || commentIds.has(commentId) || merged.length >= maximum) return;
    commentIds.add(commentId);
    merged.push(comment);
  });
  return merged;
}

/** 仅递减明确捕获的根评论回复数，避免受当前面板切换影响。 */
export function decrementVideoCommentReplyCount(comments, rootCommentId) {
  const normalizedRootCommentId = String(rootCommentId || "").trim();
  return comments.map((comment) => (
    String(comment?.commentId || "") === normalizedRootCommentId
      ? { ...comment, replyCount: Math.max(0, (Number(comment.replyCount) || 0) - 1) }
      : comment
  ));
}

/** 按草稿顺序读取完整上传 URL；缓存成功结果可让创建请求失败后重试时不重复上传。 */
export function getUploadedVideoCommentImageURLs(drafts) {
  const imageURLs = drafts.map((draft) => String(draft?.imageURL || "").trim());
  return imageURLs.every(Boolean) ? imageURLs : null;
}

/** 返回尚未取得服务端 URL 的图片草稿，供失败重试跳过成功项。 */
export function getPendingVideoCommentImageDrafts(drafts) {
  return drafts.filter((draft) => !String(draft?.imageURL || "").trim());
}
