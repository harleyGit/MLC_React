import HGNet from "../../manager_antd/net_handle/hg_net_manager_vm";

// 复用已有 Bearer Token、刷新、请求签名与错误处理链；后端结果字段为 result。
export const hgFetchAccess = () => HGNet.get("/api/v1/iam/me/access", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 仅在实时频道重连、明确授权变更或有限期绑定到期时同步本人权威快照。 */
export const hgSyncAccess = () => HGNet.get("/api/v1/iam/me/sync", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 当前 JWT 本人专属的短期自动订阅凭据；不向客户端开放频道选择。 */
export const hgIAMRealtimeGrant = () => HGNet.get("/api/v1/iam/me/realtime", {}, {
  headers: { "Cache-Control": "no-store" },
});

/** 无资源时预判全局授权；具体资源目前仅支持已上架商品编辑，业务 API 仍须二次鉴权。 */
export const hgAuthorize = (permission, resource) =>
  HGNet.post("/api/v1/iam/authorize", { permission, ...(resource ? { resource } : {}) });
