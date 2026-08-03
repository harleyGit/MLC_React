import HGNetManager from "../../api/hg_net_manager";
import {
  buildVideoCommentCreateBody,
  buildVideoCommentDeleteBody,
  buildVideoCommentListQuery,
  HG_VIDEO_COMMENT_CREATE_PATH,
  HG_VIDEO_COMMENT_DELETE_PATH,
  HG_VIDEO_COMMENT_LIST_PATH,
} from "./hg_video_comment_request";

const HGNet = new HGNetManager();

/** 读取视频评论游标分页数据。 */
export const getVideoComments = (submissionId, sort, cursor, pageSize) => HGNet.get(
  HG_VIDEO_COMMENT_LIST_PATH,
  buildVideoCommentListQuery(submissionId, sort, cursor, pageSize),
);

/** 创建视频评论，鉴权和 token 刷新统一由 HGNetManager 处理。 */
export const createVideoComment = (submissionId, content, requestId) => HGNet.post(
  HG_VIDEO_COMMENT_CREATE_PATH,
  buildVideoCommentCreateBody(submissionId, content, requestId),
);

/** 删除当前用户有权限删除的视频评论。 */
export const deleteVideoComment = (commentId) => HGNet.post(
  HG_VIDEO_COMMENT_DELETE_PATH,
  buildVideoCommentDeleteBody(commentId),
);
