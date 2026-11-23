import { hgIMEndpoint } from "../../net_handle/hg_im_endpoint";

/** Centrifugo 负责订阅与有界 RPC；publication 只调度权威补拉，不能直接渲染或 ACK。 */
export default class HGIMRealtime {
  hgClient = null; // 唯一 SDK 连接；关闭后为 null。
  hgClosed = false; // 防止异步 import/token 在卸载后建连。
  hgFailures = 0; // 本轮连续失败的连接次数；成功订阅后归零，三次失败即停止 SDK 重试。

  constructor(hgAPI, hgCredential, hgOnHint, hgOnState, hgOnRecover, hgOnFailure) {
    this.hgAPI = hgAPI; // Go 请求适配器，继承页面取消信号。
    this.hgCredential = hgCredential; // 当前用户的设备凭据，仅在内存使用。
    this.hgOnHint = hgOnHint; // 已校验频道的事件指针回调。
    this.hgOnState = hgOnState; // 展示连接状态，不作为送达回执。
    this.hgOnRecover = hgOnRecover; // 所有重连均核对 MySQL，不依赖网关短期历史。
    this.hgOnFailure = hgOnFailure; // 连续三次连接失败或鉴权终止后，通知页面给出一次安全提示。
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
      minReconnectDelay: 1000, maxReconnectDelay: 2000, timeout: 5000,
    });
    this.hgClient.on("publication", (hgContext) => {
      if (!this.hgClosed && hgContext.channel === hgChannel) this.hgOnHint(hgContext.data);
    });
    this.hgClient.on("subscribed", (hgContext) => {
      if (this.hgClosed || hgContext.channel !== hgChannel) return;
      this.hgFailures = 0;
      this.hgOnState("实时已连接");
      this.hgOnRecover();
    });
    this.hgClient.on("connecting", () => !this.hgClosed && this.hgOnState("实时重连中 · 等待 WebSocket 补拉"));
    this.hgClient.on("disconnected", () => {
      if (!this.hgClosed) this.hgFail("实时连接已终止，请重新登录或点击 Chat 重试");
    });
    this.hgClient.on("error", (hgContext) => {
      if (this.hgClosed) return;
      if (!["transport", "connect", "connectToken", "connectData"].includes(hgContext.type)) return;
      // SDK 的 transport/connect 错误对应一次失败尝试；成功订阅前不将短暂断线告知用户。
      if (++this.hgFailures >= 3) {
        this.hgFail("实时网关连接失败（已尝试 3 次），请检查网络或稍后点击 Chat 重试");
      } else {
        this.hgOnState("实时重连中 · 等待 WebSocket 补拉");
      }
    });
    this.hgClient.connect();
  }

  /** 中止本轮 SDK 重试和旧频道回调，避免第三次失败后继续建连。 */
  hgFail(hgReason) {
    if (this.hgClosed) return;
    this.hgClose();
    this.hgOnFailure(hgReason);
  }

  /** 消息仅通过当前已认证设备的 WS RPC 发送，断线时失败关闭；重试必须复用 clientMsgId。 */
  async hgRPC(hgMethod, hgData = {}) {
    if (this.hgClosed || !this.hgClient || this.hgClient.state !== "connected") throw new Error("实时连接未建立，请稍后重试");
    let hgResult; // Centrifugo 的结果只在当前连接成功完成 RPC 后可用。
    try {
      hgResult = await this.hgClient.rpc(`im:${hgMethod}`, { ...hgData, ...this.hgCredential });
    } catch (hgError) {
      if ([400, 403, 409, 503].includes(hgError?.code)) hgError.status = hgError.code; // 对齐既有页面错误分支。
      throw hgError;
    }
    if (this.hgClosed) throw new Error("聊天页面已关闭");
    return hgResult.data;
  }

  /** 移除监听并断开，禁止库继续刷新 token 或重连。 */
  hgClose() {
    this.hgClosed = true;
    this.hgClient?.removeAllListeners();
    this.hgClient?.disconnect();
    this.hgClient = null;
  }
}
