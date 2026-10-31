import { hgIMEndpoint } from "../../net_handle/hg_im_endpoint";

/** Centrifugo 服务端订阅；publication 只调度权威补拉，不能直接渲染或 ACK。 */
export default class HGIMRealtime {
  hgClient = null; // 唯一 SDK 连接；关闭后为 null。
  hgClosed = false; // 防止异步 import/token 在卸载后建连。

  constructor(hgAPI, hgCredential, hgOnHint, hgOnState, hgOnRecover) {
    this.hgAPI = hgAPI; // Go 请求适配器，继承页面取消信号。
    this.hgCredential = hgCredential; // 当前用户的设备凭据，仅在内存使用。
    this.hgOnHint = hgOnHint; // 已校验频道的事件指针回调。
    this.hgOnState = hgOnState; // 展示连接状态，不作为送达回执。
    this.hgOnRecover = hgOnRecover; // 所有重连均核对 MySQL，不依赖网关短期历史。
  }

  async hgStart() {
    const [{ Centrifuge }, hgGrant] = await Promise.all([import("centrifuge"), this.hgAPI.hgRealtimeToken(this.hgCredential)]);
    if (this.hgClosed) return;
    const hgChannel = `im:${this.hgCredential.deviceId}`; // JWT 自动订阅设备频道。
    if (hgGrant.channel !== hgChannel || !hgGrant.token) throw new Error("实时订阅凭据不匹配");
    const hgURL = hgIMEndpoint(hgGrant.url); // 本轮连接固定地址，刷新不得迁移到其他端点。
    this.hgClient = new Centrifuge(hgURL, {
      token: hgGrant.token,
      getToken: async () => {
        try {
          const hgNext = await this.hgAPI.hgRealtimeToken(this.hgCredential); // 由 Go 重新校验撤销状态。
          if (this.hgClosed || hgNext.channel !== hgChannel || hgIMEndpoint(hgNext.url) !== hgURL || !hgNext.token) throw new Centrifuge.UnauthorizedError();
          return hgNext.token;
        } catch (hgError) {
          if (this.hgClosed || [401, 403].includes(hgError?.status) || hgError instanceof Centrifuge.UnauthorizedError) throw new Centrifuge.UnauthorizedError();
          throw hgError; // 网络瞬态仅由 SDK 有界重试，不注册新设备。
        }
      },
      minReconnectDelay: 1000, maxReconnectDelay: 15000,
    });
    this.hgClient.on("publication", (hgContext) => {
      if (!this.hgClosed && hgContext.channel === hgChannel) this.hgOnHint(hgContext.data);
    });
    this.hgClient.on("subscribed", (hgContext) => {
      if (this.hgClosed || hgContext.channel !== hgChannel) return;
      this.hgOnState("实时已连接");
      this.hgOnRecover();
    });
    this.hgClient.on("connecting", () => !this.hgClosed && this.hgOnState("实时重连中 · HTTP 补拉可用"));
    this.hgClient.on("disconnected", () => !this.hgClosed && this.hgOnState("实时已断开 · 可手动重连"));
    this.hgClient.on("error", () => !this.hgClosed && this.hgOnState("实时连接异常 · HTTP 补拉中"));
    this.hgClient.connect();
  }

  /** 移除监听并断开，禁止库继续刷新 token 或重连。 */
  hgClose() {
    this.hgClosed = true;
    this.hgClient?.removeAllListeners();
    this.hgClient?.disconnect();
    this.hgClient = null;
  }
}
