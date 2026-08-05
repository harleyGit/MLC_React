const HG_VIDEO_DANMAKU_BASE_PATH = "/api/v1/video_danmaku";

export const HG_VIDEO_DANMAKU_LIST_PATH = `${HG_VIDEO_DANMAKU_BASE_PATH}/list`;
export const HG_VIDEO_DANMAKU_CREATE_PATH = `${HG_VIDEO_DANMAKU_BASE_PATH}/create`;
export const HG_VIDEO_DANMAKU_TICKET_PATH = `${HG_VIDEO_DANMAKU_BASE_PATH}/ticket`;
export const HG_VIDEO_DANMAKU_MAX_LENGTH = 100;
export const HG_VIDEO_DANMAKU_WINDOW_MS = 60_000;

/**
 * 构造后端时间窗查询。窗口固定有上限，避免长视频一次加载全部弹幕造成数据库和 DOM 放大。
 * @param {string|number} videoId 具体分 P 视频标识。
 * @param {number} fromMs 时间窗起点，单位毫秒。
 * @returns {Object} HGNetManager GET 参数。
 */
export function buildVideoDanmakuListQuery(videoId, fromMs = 0, cursor = "") {
  const start = Math.max(0, Math.floor(Number(fromMs) || 0));
  return {
    videoId: String(videoId || "").trim(),
    fromMs: start,
    toMs: start + HG_VIDEO_DANMAKU_WINDOW_MS,
    pageSize: 500,
    ...(cursor ? { cursor } : {}),
  };
}

/**
 * 构造幂等创建请求；用户 ID 不从前端传入，由后端认证上下文决定。
 * @param {Object} input 弹幕内容、视频、播放位置和请求 ID。
 * @returns {Object} 后端 CreateRequest。
 */
export function buildVideoDanmakuCreateBody(input) {
  return {
    videoId: String(input?.videoId || "").trim(),
    content: Array.from(String(input?.content || "").trim()).slice(0, HG_VIDEO_DANMAKU_MAX_LENGTH).join(""),
    requestId: String(input?.requestId || "").trim(),
    progressMs: Math.max(0, Math.floor(Number(input?.progressMs) || 0)),
    mode: "scroll",
    color: "#FFFFFF",
    fontSize: 25,
  };
}

/** WebSocket 消息与 HTTP 创建共享同一 data 契约。 */
export function buildVideoDanmakuSocketCommand(body) {
  return { type: "danmaku.create", data: body };
}
