import { hgIMEndpoint } from "../../manager_antd/net_handle/hg_im_endpoint";
import { hgIAMRealtimeGrant } from "./hg_iam_api";

/** 业务提示必须使用可识别的版本化 event_type，未知类型由接收端安全忽略。 */
export function hgValidBusinessEventType(eventType) {
  return typeof eventType === "string" && eventType.length <= 96 &&
    /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}\.v[1-9]\d*$/.test(eventType);
}

/** 当前登录会话的业务事件连接；IAM、收件箱及后续无正文提示复用同一用户频道。 */
export default class HGBusinessRealtime {
  hgClient = null; // 当前标签页的唯一业务 Centrifugo 连接；关闭后为 null。
  hgClosed = false; // 账号切换及卸载后禁止应用旧消息或续签凭据。
  hgHandlers = new Map(); // event_type 到业务处理器集合；仅已注册的事件分发，关闭时清空。

  constructor(owner, onRecover, onOffline, onHandlerFailure = () => {}) {
    this.hgOwner = owner; // JWT 用户 ID，只用于验证私有频道与快照归属。
    this.hgOnRecover = onRecover; // 每次订阅（含重连）补齐断线期间遗漏的快照。
    this.hgOnOffline = onOffline; // 失去实时能力时隐藏依赖授权展示的页面。
    this.hgOnHandlerFailure = onHandlerFailure; // 业务处理异常由注册方自行隔离；仅 IAM 异常触发授权复核。
  }

  /** 显式登记版本化事件；返回注销函数，业务不能自行订阅频道或从推送正文确认状态。 */
  hgListen(eventType, handler) {
    if (this.hgClosed || typeof handler !== "function" ||
      !hgValidBusinessEventType(eventType)) throw new Error("业务事件订阅不合法");
    if (!this.hgHandlers.has(eventType)) {
      if (this.hgHandlers.size >= 16) throw new Error("业务事件类型已达上限");
      this.hgHandlers.set(eventType, new Set());
    }
    const handlers = this.hgHandlers.get(eventType); // 同一事件最多 8 个页面处理器，避免多次挂载无限增长。
    if (!handlers.has(handler) && handlers.size >= 8) throw new Error("业务事件处理器已达上限");
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (!handlers.size && this.hgHandlers.get(eventType) === handlers) this.hgHandlers.delete(eventType);
    };
  }

  /** 仅首次获取本人会话票据；重连由网关 connect proxy 校验服务端会话，不进行分钟级 HTTP 续签。 */
  async hgStart() {
    const [{ Centrifuge }, grant] = await Promise.all([import("centrifuge"), hgIAMRealtimeGrant()]);
    if (this.hgClosed) return;
    const channel = `im:iam:${this.hgOwner}`; // 保留已部署频道协议；与 Chat 的设备频道互斥。
    if (!grant?.token || grant.channel !== channel) throw new Error("业务实时频道不匹配");
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
      if (this.hgClosed || context.channel !== channel || !context.data ||
        typeof context.data !== "object" || Array.isArray(context.data)) return;
      const handlers = this.hgHandlers.get(context.data.event_type);
      if (!handlers) return; // 未注册或未知版本不影响 IAM，旧客户端可忽略未来事件。
      for (const handler of [...handlers]) {
        // 回调只接收本人已认证频道的提示；仍须按业务向服务端补拉权威状态。
        if (this.hgClosed || !this.hgHandlers.get(context.data.event_type)?.has(handler)) continue;
        try {
          void Promise.resolve(handler(context.data)).catch(() => {
            if (!this.hgClosed) this.hgOnHandlerFailure(context.data.event_type);
          });
        } catch {
          if (!this.hgClosed) this.hgOnHandlerFailure(context.data.event_type);
        }
      }
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
    this.hgHandlers.clear();
    this.hgClient?.removeAllListeners();
    this.hgClient?.disconnect();
    this.hgClient = null;
  }
}
