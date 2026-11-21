import { hgIMEndpoint } from "../../manager_antd/net_handle/hg_im_endpoint";
import { hgIAMRealtimeGrant } from "./hg_iam_api";

/** 当前登录用户的 IAM 私有实时通道；推送内容只用于前端展示，服务端仍逐请求鉴权。 */
export default class HGIAMRealtime {
  hgClient = null; // 单个 Centrifugo 连接，关闭后为 null。
  hgClosed = false; // 账号切换及卸载后禁止应用旧消息或续签凭据。

  constructor(owner, onSnapshot, onRecover, onOffline) {
    this.hgOwner = owner; // JWT 用户 ID，只用于验证私有频道与快照归属。
    this.hgOnSnapshot = onSnapshot; // 已认证用户频道投影接收器，不经通用 window 事件注入。
    this.hgOnRecover = onRecover; // 每次订阅（含重连）补齐断线期间遗漏的快照。
    this.hgOnOffline = onOffline; // 失去实时能力时隐藏依赖授权展示的页面。
  }

  /** 网关 JWT 仅由 Go 签发；频道和地址必须与同一请求返回值一致。 */
  async hgStart() {
    const [{ Centrifuge }, grant] = await Promise.all([import("centrifuge"), hgIAMRealtimeGrant()]);
    if (this.hgClosed) return;
    const channel = `im:iam:${this.hgOwner}`; // 复用已有 im 命名空间；与设备十六进制频道互斥。
    if (!grant?.token || grant.channel !== channel) throw new Error("IAM 实时频道不匹配");
    const url = hgIMEndpoint(grant.url);
    this.hgClient = new Centrifuge(url, {
      token: grant.token,
      getToken: async () => {
        try {
          const next = await hgIAMRealtimeGrant();
          if (this.hgClosed || next?.channel !== channel || hgIMEndpoint(next.url) !== url || !next.token) {
            throw new Centrifuge.UnauthorizedError();
          }
          return next.token;
        } catch (error) {
          if (this.hgClosed || [401, 403].includes(error?.status)) throw new Centrifuge.UnauthorizedError();
          throw error;
        }
      },
      minReconnectDelay: 1000, maxReconnectDelay: 15000,
    });
    this.hgClient.on("publication", (context) => {
      if (this.hgClosed || context.channel !== channel ||
          context.data?.event_type !== "iam.access.updated.v1") return;
      void Promise.resolve(this.hgOnSnapshot(context.data.snapshot, context.data.event_id))
        .catch(() => !this.hgClosed && this.hgOnOffline());
    });
    this.hgClient.on("subscribed", (context) => {
      if (!this.hgClosed && context.channel === channel) this.hgOnRecover();
    });
    this.hgClient.on("connecting", () => !this.hgClosed && this.hgOnOffline());
    this.hgClient.on("disconnected", () => !this.hgClosed && this.hgOnOffline());
    this.hgClient.connect();
  }

  /** 注销所有事件并断开；SDK 不得再用旧账号凭据重连。 */
  hgClose() {
    this.hgClosed = true;
    this.hgClient?.removeAllListeners();
    this.hgClient?.disconnect();
    this.hgClient = null;
  }
}
