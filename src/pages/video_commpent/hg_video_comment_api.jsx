import HGNetManager from "../../api/hg_net_manager";
import {
  buildVideoCommentCreateBody,
  buildVideoCommentDeleteBody,
  buildVideoCommentImagePath,
  buildVideoCommentListQuery,
  buildVideoCommentReactionBody,
  buildVideoCommentRepliesQuery,
  HG_VIDEO_COMMENT_CREATE_PATH,
  HG_VIDEO_COMMENT_DELETE_PATH,
  HG_VIDEO_COMMENT_LIST_PATH,
  HG_VIDEO_COMMENT_REACTION_PATH,
  HG_VIDEO_COMMENT_REPLIES_PATH,
} from "./hg_video_comment_request";

const HGNet = new HGNetManager();

/** 读取视频评论游标分页数据。 */
export const getVideoComments = (submissionId, sort, cursor, pageSize) => HGNet.get(
  HG_VIDEO_COMMENT_LIST_PATH,
  buildVideoCommentListQuery(submissionId, sort, cursor, pageSize),
);

/** 创建视频评论，鉴权和 token 刷新统一由 HGNetManager 处理。 */
export const createVideoComment = (submissionId, content, requestId, parentCommentId, imageURLs) => HGNet.post(
  HG_VIDEO_COMMENT_CREATE_PATH,
  buildVideoCommentCreateBody(submissionId, content, requestId, parentCommentId, imageURLs),
);

/** 删除当前用户有权限删除的视频评论。 */
export const deleteVideoComment = (commentId) => HGNet.post(
  HG_VIDEO_COMMENT_DELETE_PATH,
  buildVideoCommentDeleteBody(commentId),
);

/** 按时间正序读取一个根评论的回复。 */
export const getVideoCommentReplies = (rootCommentId, cursor, pageSize) => HGNet.get(
  HG_VIDEO_COMMENT_REPLIES_PATH,
  buildVideoCommentRepliesQuery(rootCommentId, cursor, pageSize),
);

/** 设置评论反应最终态，none 表示取消当前反应。 */
export const setVideoCommentReaction = (commentId, reaction) => HGNet.post(
  HG_VIDEO_COMMENT_REACTION_PATH,
  buildVideoCommentReactionBody(commentId, reaction),
);

/** 直接上传图片二进制，查询参数必须进入 path 才会参与真实 URL。 */
export const uploadVideoCommentImage = (file) => {
  const extension = file?.type?.split("/")[1] || file?.name?.split(".").pop() || "png";
  return HGNet.post(buildVideoCommentImagePath(extension), file, {
    headers: { "Content-Type": file?.type || "application/octet-stream" },
    timeout: 60000,
  });
};
