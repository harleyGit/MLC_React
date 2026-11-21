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

  /** 仅首次获取本人会话票据；重连由网关 connect proxy 校验服务端会话，不进行分钟级 HTTP 续签。 */
  async hgStart() {
    const [{ Centrifuge }, grant] = await Promise.all([import("centrifuge"), hgIAMRealtimeGrant()]);
    if (this.hgClosed) return;
    const channel = `im:iam:${this.hgOwner}`; // 复用已有 im 命名空间；与设备十六进制频道互斥。
    if (!grant?.token || grant.channel !== channel) throw new Error("IAM 实时频道不匹配");
    const url = hgIMEndpoint(grant.url);
    this.hgClient = new Centrifuge(url, {
      data: { token: grant.token }, // 仅发到受控网关；服务端不依赖浏览器声明的 user/channel。
      getData: async () => {
        if (this.hgClosed) throw new Centrifuge.UnauthorizedError();
        return { token: grant.token }; // 每次重连只重验既有会话，不调用 /me/realtime。
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
