const HG_VIDEO_INTERACTION_BASE_PATH = "/api/v1/video_interactions";
const HG_VIDEO_INTERACTION_ACTIONS = new Set(["like", "coin", "favorite", "share"]);

/**
 * 返回后端视频互动操作路径，仅接受路由已注册的操作。
 * @param {string} action 互动操作。
 * @returns {string} 接口路径。
 */
export function getVideoInteractionPath(action) {
  if (!HG_VIDEO_INTERACTION_ACTIONS.has(action)) {
    throw new Error(`不支持的视频互动操作: ${action}`);
  }
  return `${HG_VIDEO_INTERACTION_BASE_PATH}/${action}`;
}

/**
 * 按 Go ActionRequest 契约构造互动请求体。
 * @param {string|number} submissionId 视频投稿标识。
 * @param {string} action 互动操作。
 * @param {boolean} active 点赞或收藏目标状态。
 * @param {string} requestId 投币幂等请求标识。
 * @returns {Object} 后端 ActionRequest 请求体。
 */
export function buildVideoInteractionBody(submissionId, action, active = true, requestId = "") {
  const body = {
    submissionId: String(submissionId || "").trim(),
    active: action === "share" ? true : Boolean(active),
  };

  if (action === "coin") {
    body.quantity = 1;
    body.requestId = requestId;
  }

  return body;
}

/**
 * 按 Go FollowRequest 契约构造作者关注请求体。
 * @param {string|number} followeeId 被关注作者用户标识。
 * @param {boolean} active true 表示关注，false 表示取消关注。
 * @returns {{followeeId: string, active: boolean}} 后端 FollowRequest 请求体。
 */
export function buildVideoFollowBody(followeeId, active) {
  const normalizedFolloweeId = String(followeeId || "").trim();
  if (!normalizedFolloweeId) {
    throw new Error("无法确定视频作者");
  }

  return {
    followeeId: normalizedFolloweeId,
    active: Boolean(active),
  };
}

/** 视频互动状态查询接口路径。 */
export const HG_VIDEO_INTERACTION_STATE_PATH = `${HG_VIDEO_INTERACTION_BASE_PATH}/state`;

/** 作者关注或取消关注接口路径。 */
export const HG_VIDEO_INTERACTION_FOLLOW_PATH = `${HG_VIDEO_INTERACTION_BASE_PATH}/follow`;
