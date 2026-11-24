import HGNet from "../../manager_antd/net_handle/hg_net_manager_vm";

// 复用已有 Bearer Token、刷新、请求签名与错误处理链；后端结果字段为 result。
export const hgFetchAccess = () => HGNet.get("/api/v1/iam/me/access", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 显式请求本人权威快照；实时频道断线及重连不主动调用。 */
export const hgSyncAccess = () => HGNet.get("/api/v1/iam/me/sync", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 首次连接获取当前登录会话票据；网关每次重连都向后端验证 sid，不在浏览器定期续签。 */
export const hgIAMRealtimeGrant = () => HGNet.get("/api/v1/iam/me/realtime", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 用户主动退出时先撤销服务端会话并断开本人 Socket；失败由页面决定是否仅本地退出。 */
export const hgRevokeIAMLogin = () => HGNet.post("/api/v1/iam/me/logout", {}, { skipAuthRefresh: true });

/** 无资源时预判全局授权；具体资源目前仅支持已上架商品编辑，业务 API 仍须二次鉴权。 */
export const hgAuthorize = (permission, resource) =>
  HGNet.post("/api/v1/iam/authorize", { permission, ...(resource ? { resource } : {}) });
