import HGNetManager from "../../api/hg_net_manager";
import {
  buildVideoDanmakuCreateBody,
  buildVideoDanmakuListQuery,
  HG_VIDEO_DANMAKU_CREATE_PATH,
  HG_VIDEO_DANMAKU_LIST_PATH,
  HG_VIDEO_DANMAKU_TICKET_PATH,
} from "./hg_bili_danmaku_request";

const HGNet = new HGNetManager();

/** 读取当前或下一 60 秒播放时间窗内的弹幕。 */
export const getVideoDanmaku = (videoId, fromMs, cursor = "") => HGNet.get(
  HG_VIDEO_DANMAKU_LIST_PATH,
  buildVideoDanmakuListQuery(videoId, fromMs, cursor),
);

/** 创建弹幕并返回服务端生成的权威弹幕 ID。 */
export const createVideoDanmaku = (input) => HGNet.post(
  HG_VIDEO_DANMAKU_CREATE_PATH,
  buildVideoDanmakuCreateBody(input),
);

/** 通过正常签名和 JWT HTTP 链路获取短期、单次 WebSocket ticket。 */
export const getVideoDanmakuTicket = (videoId) => HGNet.post(
  HG_VIDEO_DANMAKU_TICKET_PATH,
  { videoId: String(videoId || "").trim() },
);

/**
 * 将后端返回的路径转换为浏览器 WebSocket URL。开发环境由 Vite 代理到 gnet 8081，
 * 生产环境由同域 Ingress 按 /api/v1/video_danmaku/ws 路由到实时端口。
 */
export function buildVideoDanmakuWebSocketURL(path, ticket) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(path, `${protocol}//${window.location.host}`);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}
