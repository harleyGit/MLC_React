import React from "react";
import { hgApplyPushedIAM, hgClearIAM, hgCurrentIAMExpiry, hgCurrentIAMUser, hgGetIAMSnapshot, hgLoadLocalIAM, hgRefreshIAM, hgSubscribeIAM } from "./hg_iam_session";
import HGBusinessRealtime, { hgValidBusinessEventType } from "./hg_business_realtime";

export const HGIAMContext = React.createContext(null);

/** 统一维护授权视图：本地快照仅供页面展示，实际业务请求仍由服务端鉴权。 */
export class HGIAMAccessProvider extends React.Component {
  static defaultProps = {
    children: null, // 可选页面树；无子节点时只维护当前会话的权限状态。
  };
  state = {
    snapshot: null, // 当前账号快照；null 为无有效数据，绝不跨账号复用。
    status: "loading", // loading/ready/error/unauthenticated；ready 也可能来自未过期的本地展示缓存。
  };
  hgMounted = false; // 异步请求生命周期标记；卸载后不可更新 UI。
  hgSequence = 0; // 刷新序号，防止较旧响应覆盖新账号状态。
  hgExpiryTimer = null; // 有限期快照到期时重新核验；新快照仍有期限时继续按期限安排核验。
  hgInFlight = null; // 当前账号进行中的刷新；同账号的普通重复触发共用该请求。
  hgQueuedRefresh = false; // 请求期间收到明确变更信号时，完成后再核验一次。
  hgRealtime = null; // 当前账号的唯一用户业务 Socket；Chat 设备 Socket 独立。
  hgRealtimeOwner = ""; // 实时频道绑定的 JWT uid，空串表示没有连接。
  hgRealtimeConnectedOwner = ""; // 已完成订阅的账号；空串表示频道不可用，不触发断线补拉。
  hgBusinessListeners = new Set(); // 页面级业务提示监听；按注册时账号隔离，注销/卸载时清空。
  hgRealtimeDisabledOwner = ""; // 当前账号票据不可用时不重复申请；账号切换时重置。
  hgAuthTimer = null; // JWT 自身到期时清理授权视图；无登录状态时不设定时器。

  componentDidMount() {
    this.hgMounted = true;
    this.hgUnsubscribe = hgSubscribeIAM(() => {
      if (this.hgMounted) this.setState({ snapshot: hgGetIAMSnapshot() });
    });
    window.addEventListener("hg:auth-changed", this.hgQueueRefresh);
    window.addEventListener("hg:token-refreshed", this.hgOnTokenRefreshed);
    window.addEventListener("storage", this.hgOnStorage);
    this.hgRefresh({ sync: false, preferLocal: true });
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSequence += 1;
    this.hgQueuedRefresh = false;
    clearTimeout(this.hgExpiryTimer);
    clearTimeout(this.hgAuthTimer);
    this.hgCloseRealtime();
    this.hgBusinessListeners.clear();
    this.hgUnsubscribe?.();
    window.removeEventListener("hg:auth-changed", this.hgQueueRefresh);
    window.removeEventListener("hg:token-refreshed", this.hgOnTokenRefreshed);
    window.removeEventListener("storage", this.hgOnStorage);
  }

  /** token 被其他标签页修改时同步清理旧账号快照。 */
  hgOnStorage = (event) => {
    if (event.key === "manager_token" || event.key === null) {
      hgClearIAM();
      this.hgCloseRealtime();
      this.hgQueueRefresh();
    }
  };

  /** 明确授权变更不能被进行中的旧响应吞掉；同账号只排队一次后续核验。 */
  hgQueueRefresh = () => {
    if (this.hgInFlight?.owner === hgCurrentIAMUser()) {
      this.hgQueuedRefresh = true;
      return this.hgInFlight.promise;
    }
    return this.hgRefresh();
  };

  /** 过期 access 冷启动后首次续签必须重新读取本人权限；同账号续签只重排到期计时器。 */
  hgOnTokenRefreshed = () => {
    const owner = hgCurrentIAMUser();
    if (owner && (this.state.status !== "ready" || this.state.snapshot?.user_id !== owner)) {
      void this.hgQueueRefresh();
      return;
    }
    this.hgScheduleAuthExpiry();
  };

  /** 只合并同账号的重复请求；跨账号切换仍立即开始新请求。 */
  hgRefresh = (options = {}) => {
    const owner = hgCurrentIAMUser();
    if (this.hgRealtimeDisabledOwner && this.hgRealtimeDisabledOwner !== owner) this.hgRealtimeDisabledOwner = "";
    if (this.hgRealtimeOwner && this.hgRealtimeOwner !== owner) this.hgCloseRealtime();
    for (const entry of this.hgBusinessListeners) {
      if (entry.owner !== owner) {
        entry.unsubscribe?.();
        this.hgBusinessListeners.delete(entry);
      }
    }
    if (this.hgInFlight?.owner === owner) return this.hgInFlight.promise;
    if (this.hgInFlight && this.hgInFlight.owner !== owner) this.hgQueuedRefresh = false;
    const sequence = ++this.hgSequence;
    clearTimeout(this.hgExpiryTimer);
    this.setState({ status: "loading", snapshot: null });
    const promise = (async () => {
      const cached = await hgLoadLocalIAM().catch(() => null);
      if (!this.hgMounted || sequence !== this.hgSequence) return;
      if (options.preferLocal && cached && owner === hgCurrentIAMUser()) {
        this.setState({ snapshot: cached, status: "ready" });
        this.hgScheduleExpiry(cached);
        this.hgScheduleAuthExpiry();
        this.hgEnsureRealtime(owner);
        return;
      }
      try {
        // 登录、手动重试和一次到期补拉走 /me/access；断线、重连均不自动请求。
        const snapshot = await hgRefreshIAM({ sync: options.sync !== false && this.hgRealtimeConnectedOwner === owner });
        if (this.hgMounted && sequence === this.hgSequence) {
          this.setState({ snapshot, status: snapshot ? "ready" : "unauthenticated" });
          if (snapshot) {
            this.hgScheduleExpiry(snapshot);
            this.hgScheduleAuthExpiry();
            if (owner === hgCurrentIAMUser()) this.hgEnsureRealtime(owner);
          }
        }
      } catch {
        if (this.hgMounted && sequence === this.hgSequence) this.setState({ snapshot: null, status: "error" });
      }
    })();
    this.hgInFlight = { owner, promise };
    void promise.then(() => {
      if (this.hgInFlight?.promise !== promise) return;
      this.hgInFlight = null;
      if (this.hgMounted && this.hgQueuedRefresh) {
        this.hgQueuedRefresh = false;
        this.hgRefresh();
      }
    });
    return promise;
  };

  /** JWT 到期即使没有网络请求也要清空展示；令牌提前刷新时只更新定时器，不额外拉权限。 */
  hgScheduleAuthExpiry = () => {
    clearTimeout(this.hgAuthTimer);
    const expiry = hgCurrentIAMExpiry(); // 毫秒；0 表示会话已失效。
    if (!expiry) {
      hgClearIAM();
      this.hgCloseRealtime();
      this.setState({ status: "unauthenticated", snapshot: null });
      return;
    }
    this.hgAuthTimer = setTimeout(() => {
      if (!this.hgMounted) return;
      if (!hgCurrentIAMUser()) {
        hgClearIAM();
        this.hgCloseRealtime();
        this.setState({ status: "unauthenticated", snapshot: null });
      } else if (this.hgRealtimeOwner && this.hgRealtimeOwner !== hgCurrentIAMUser()) {
        this.hgRefresh({ sync: false });
      } else {
        this.hgScheduleAuthExpiry();
      }
    }, Math.min(Math.max(1, expiry - Date.now()), 2_147_483_647));
  };

  /** 只在权威快照真正到期时复核；每次成功都按新期限安排，失败时停止并提示重试。 */
  hgScheduleExpiry = (snapshot) => {
    clearTimeout(this.hgExpiryTimer);
    const expires = Date.parse(snapshot.expires_at); // 毫秒时间戳；2099 表示无限期投影上限。
    if (!Number.isFinite(expires) || expires >= Date.UTC(2099, 0, 1)) return;
    const delay = expires - Date.now();
    if (delay <= 0) {
      const owner = hgCurrentIAMUser(); // 到期的快照所属账号，切换账号后不可补拉旧授权。
      if (!this.hgMounted || !owner || snapshot.user_id !== owner) return;
      const current = hgGetIAMSnapshot(); // 新推送可能已替换旧定时器，不允许用旧快照触发补拉。
      if (current && (current.policy_version !== snapshot.policy_version ||
          current.expires_at !== snapshot.expires_at)) return;
      void this.hgRefresh({ sync: false });
      return;
    }
    this.hgExpiryTimer = setTimeout(() => {
      if (delay > 2_147_483_647) this.hgScheduleExpiry(snapshot);
      else this.hgScheduleExpiry(snapshot);
    }, Math.min(delay, 2_147_483_647));
  };

  /** 后续业务只登记版本化提示，不开新 Socket；回调必须补拉本人权威数据。 */
  hgSubscribeBusinessEvent = (eventType, handler) => {
    const owner = hgCurrentIAMUser(); // 注册时绑定账号；旧页面回调不能收到新账号的事件。
    if (!this.hgMounted || !owner || !hgValidBusinessEventType(eventType) ||
      typeof handler !== "function" || this.hgBusinessListeners.size >= 32)
      throw new Error("业务事件订阅不可用");
    const entries = [...this.hgBusinessListeners].filter((item) => item.owner === owner); // 仅当前账号计入限额。
    if (entries.filter((item) => item.eventType === eventType).length >=
        (["iam.access.updated.v1", "notification.inbox.updated.v1"].includes(eventType) ? 7 : 8) ||
      !entries.some((item) => item.eventType === eventType) &&
      new Set(entries.map((item) => item.eventType)).size >= 14) throw new Error("业务事件订阅已达上限");
    const entry = {
      owner, eventType, unsubscribe: null, // Socket 重建后重新绑定；注销时移除。
      dispatch: (data) => {
        if (this.hgMounted && owner === hgCurrentIAMUser() && this.hgRealtimeOwner === owner) return handler(data);
      },
    };
    if (this.hgRealtime && this.hgRealtimeOwner === owner)
      entry.unsubscribe = this.hgRealtime.hgListen(eventType, entry.dispatch);
    this.hgBusinessListeners.add(entry);
    return () => {
      entry.unsubscribe?.();
      this.hgBusinessListeners.delete(entry);
    };
  };

  /** 用户业务频道不依赖聊天页；断线保留未过期快照，重连只补齐收件箱提示。 */
  hgEnsureRealtime = (owner) => {
    if (!owner || this.hgRealtimeOwner === owner || this.hgRealtimeDisabledOwner === owner) return;
    this.hgCloseRealtime();
    this.hgRealtimeOwner = owner;
    const hgOnOffline = () => {
      if (this.hgMounted && this.hgRealtime === realtime && owner === hgCurrentIAMUser()) {
        this.hgRealtimeConnectedOwner = "";
      }
    };
    const realtime = new HGBusinessRealtime(owner, () => {
      if (this.hgMounted && this.hgRealtime === realtime && owner === hgCurrentIAMUser()) {
        this.hgRealtimeConnectedOwner = owner;
        // 订阅首次成功或重连后仅补齐收件箱提示；IAM 等待本人频道的新快照。
        window.dispatchEvent(new CustomEvent("hg:notification-changed"));
      }
    }, hgOnOffline, (eventType) => {
      if (eventType === "iam.access.updated.v1") hgOnOffline();
    });
    this.hgRealtime = realtime;
    realtime.hgListen("iam.access.updated.v1", async ({ snapshot, event_id: eventId }) => {
      if (!this.hgMounted || this.hgRealtime !== realtime || owner !== hgCurrentIAMUser()) return;
      if (await hgApplyPushedIAM(snapshot) && this.hgMounted && owner === hgCurrentIAMUser()) {
        const current = hgGetIAMSnapshot();
        this.setState({ snapshot: current, status: "ready" });
        this.hgScheduleExpiry(current);
        this.hgScheduleAuthExpiry();
      }
      if (this.hgMounted && owner === hgCurrentIAMUser() &&
          typeof eventId === "string" && /^iam-\d+-[0-9a-f]{16}$/.test(eventId)) {
        // 消息中心按已认证用户身份补拉权威通知，推送不伪造 notificationId。
        window.dispatchEvent(new CustomEvent("hg:notification-changed", { detail: { category: "system" } }));
      }
    });
    realtime.hgListen("notification.inbox.updated.v1", ({ category }) => {
      if (!this.hgMounted || this.hgRealtime !== realtime || owner !== hgCurrentIAMUser()) return;
      // 推送分类只用于跳过无关列表；非法内容退化为完整补拉，不信任推送正文。
      const allowed = ["system", "comment", "like", "mention", "follow", "trade", "wallet", "marketing"];
      window.dispatchEvent(new CustomEvent("hg:notification-changed", {
        detail: { category: allowed.includes(category) ? category : "" },
      }));
    });
    for (const entry of this.hgBusinessListeners) {
      if (entry.owner === owner) entry.unsubscribe = realtime.hgListen(entry.eventType, entry.dispatch);
    }
    void realtime.hgStart().catch((error) => {
      if (this.hgMounted && this.hgRealtime === realtime) {
        if (error?.status === 503) {
          // IM 尚未启用时仍保留已验证且未到期的展示快照，不启动断线轮询。
          this.hgRealtimeDisabledOwner = owner;
          this.hgCloseRealtime();
        } else {
          if (![401, 403].includes(error?.status)) this.hgRealtimeDisabledOwner = owner;
          this.hgCloseRealtime();
          if ([401, 403].includes(error?.status)) this.setState({ status: "error", snapshot: null });
        }
      }
    });
  };

  /** 更换用户时关闭旧频道；旧连接里的消息与同步回调一律不能写新账号。 */
  hgCloseRealtime = () => {
    this.hgRealtimeConnectedOwner = "";
    this.hgRealtime?.hgClose();
    this.hgRealtime = null;
    this.hgRealtimeOwner = "";
    for (const entry of this.hgBusinessListeners) entry.unsubscribe = null;
  };

  render() {
    return (
      <HGIAMContext.Provider value={{ ...this.state, refresh: this.hgRefresh, subscribeBusinessEvent: this.hgSubscribeBusinessEvent }}>
        {this.props.children}
      </HGIAMContext.Provider>
    );
  }
}

/** Provider 之外不允许静默放行；组件统一读取当前账号的状态。 */
export function useHGIAM() {
  const context = React.useContext(HGIAMContext);
  if (!context) throw new Error("缺少 HGIAMAccessProvider");
  return context;
}
