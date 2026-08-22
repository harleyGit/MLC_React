import HGNetManager from "../../api/hg_net_manager";
import {
  buildVideoFollowBody,
  buildVideoInteractionBody,
  getVideoInteractionPath,
  HG_VIDEO_INTERACTION_FOLLOW_PATH,
  HG_VIDEO_INTERACTION_STATE_PATH,
} from "./hg_video_interaction_request";
import { normalizeVideoCoverUrl } from "./hg_bili_media_url";

const HGNet = new HGNetManager();

/** 把后端统一视频列表项转换为页面和播放器使用的稳定结构。 */
export function normalizeVideoListItem(item) {
  return {
    id: item.videoId || item.submissionId,
    submissionId: item.submissionId,
    title: item.title || item.fileName || "未命名视频",
    cover: normalizeVideoCoverUrl(item.coverUrl),
    url: item.filePath || "",
    author: item.authorName || item.userId || "未知作者",
    authorId: item.userId || "",
    play: Number(item.viewCount) || 0,
    danmaku: Number(item.commentCount) || 0,
    likeCount: Number(item.likeCount) || 0,
    duration: Number(item.duration) || 0,
    category: item.category || "",
    description: item.description || "",
    filePath: item.filePath || "",
    playbackType: item.playbackType || "native_file",
    sourcePlatform: item.sourcePlatform || "",
    externalContentId: item.externalContentId || "",
    targetUrl: item.targetUrl || "",
    pubDate: item.submitTime || item.createdAt || "",
  };
}

/**
 * 获取视频列表（游标分页）
 * @param {string} cursor - 翻页游标，首次调用传空，后续使用响应中的 nextCursor
 * @param {number} pageSize - 每页数量，默认 20
 * @param {string} tagName - 视频标签名称；空字符串表示“推荐”无过滤列表
 * @returns {Promise} 视频列表响应
 */
export const getVideoList = async (cursor = "", pageSize = 20, tagName = "") => {
  try {
    const response = await HGNet.get("/api/v1/video_upload/list", {
      cursor,
      pageSize,
      tagName,
    });
    return response;
  } catch (error) {
    console.error("获取视频列表失败:", error);
    throw error;
  }
};

/** 根据列表内容 ID 获取视频详情，供刷新或直达播放页恢复路由数据。 */
export const getVideoDetail = (contentId) => HGNet.get(
  "/api/v1/video_upload/detail",
  { contentId: String(contentId || "").trim() },
);

/**
 * 获取动画页启用标签。
 * activeOnly=true 只返回可展示标签；pageSize=100 与后端标签配置上限保持一致。
 * @returns {Promise<Object>} 已解包的标签列表响应。
 */
export const getDougaTags = async () => {
  try {
    return await HGNet.get("/api/v1/ops/bilibili/tags/list", {
      activeOnly: true,
      pageSize: 100,
    });
  } catch (error) {
    console.error("获取动画标签失败:", error);
    throw error;
  }
};

/**
 * 获取当前用户对指定视频的互动状态和实时计数。
 * @param {string|number} submissionId 视频投稿标识。
 * @param {string|number} authorId 作者用户标识，可为空。
 * @returns {Promise<Object>} 后端 StateResponse。
 */
export const getVideoInteractionState = (submissionId, authorId = "") => HGNet.get(
  HG_VIDEO_INTERACTION_STATE_PATH,
  {
    submissionId: String(submissionId || "").trim(),
    ...(authorId ? { authorId: String(authorId).trim() } : {}),
  },
);

/**
 * 提交点赞、投币、收藏或分享操作。
 * @param {string|number} submissionId 视频投稿标识。
 * @param {"like"|"coin"|"favorite"|"share"} action 互动操作。
 * @param {boolean} active 点赞或收藏目标状态。
 * @param {string} requestId 投币幂等请求标识。
 * @returns {Promise<Object>} 后端 AcceptedResponse。
 */
export const setVideoInteraction = (submissionId, action, active = true, requestId = "") => (
  HGNet.post(
    getVideoInteractionPath(action),
    buildVideoInteractionBody(submissionId, action, active, requestId),
  )
);

/**
 * 关注或取消关注当前视频作者。
 * @param {string|number} followeeId 被关注作者用户标识。
 * @param {boolean} active true 表示关注，false 表示取消关注。
 * @returns {Promise<Object>} 后端 AcceptedResponse。
 */
export const setAuthorFollow = (followeeId, active) => HGNet.post(
  HG_VIDEO_INTERACTION_FOLLOW_PATH,
  buildVideoFollowBody(followeeId, active),
);

/** 获取作者公开资料。 */
export const getBiliAuthorProfile = (userId) => HGNet.get(
  "/api/v1/bilibili/author/profile",
  { userId: String(userId || "").trim() },
);

/** 获取作者空间首屏聚合数据。 */
export const getBiliAuthorHomepage = (userId, pageSize = 20) => HGNet.get(
  "/api/v1/bilibili/author/homepage",
  { userId: String(userId || "").trim(), pageSize },
);

/** 获取作者公开视频下一页。 */
export const getBiliAuthorVideos = (userId, cursor = "", pageSize = 20) => HGNet.get(
  "/api/v1/bilibili/author/videos",
  { userId: String(userId || "").trim(), cursor, pageSize },
);
