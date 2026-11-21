import React from "react";
import { hgApplyPushedIAM, hgClearIAM, hgCurrentIAMExpiry, hgCurrentIAMUser, hgGetIAMSnapshot, hgLoadLocalIAM, hgRefreshIAM, hgSubscribeIAM } from "./hg_iam_session";
import HGIAMRealtime from "./hg_iam_realtime";

export const HGIAMContext = React.createContext(null);

/** 统一维护授权视图：IndexedDB 供展示缓存，HTTP 或本人可信 IM 更新后才进入 ready。 */
export class HGIAMAccessProvider extends React.Component {
  static defaultProps = {
    children: null, // 可选页面树；无子节点时只维护当前会话的权限状态。
  };
  state = {
    snapshot: null, // 当前账号快照；null 为无有效数据，绝不跨账号复用。
    status: "loading", // loading/ready/error/unauthenticated；失败默认拒绝访问。
  };
  hgMounted = false; // 异步请求生命周期标记；卸载后不可更新 UI。
  hgSequence = 0; // 刷新序号，防止较旧响应覆盖新账号状态。
  hgExpiryTimer = null; // 有限期绑定到期时主动同步，2099 无期限快照不设定时器。
  hgInFlight = null; // 当前账号进行中的刷新；同账号的普通重复触发共用该请求。
  hgQueuedRefresh = false; // 请求期间收到明确变更信号时，完成后再核验一次。
  hgRealtime = null; // 当前账号的唯一 IAM 实时连接；账号切换或卸载立即关闭。
  hgRealtimeOwner = ""; // 实时频道绑定的 JWT uid，空串表示没有连接。
  hgAuthTimer = null; // JWT 自身到期时清理授权视图；无登录状态时不设定时器。

  componentDidMount() {
    this.hgMounted = true;
    this.hgUnsubscribe = hgSubscribeIAM(() => {
      if (this.hgMounted) this.setState({ snapshot: hgGetIAMSnapshot() });
    });
    window.addEventListener("hg:auth-changed", this.hgQueueRefresh);
    window.addEventListener("storage", this.hgOnStorage);
    window.addEventListener("hg:iam-access-changed", this.hgOnChange);
    this.hgRefresh({ sync: false });
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSequence += 1;
    this.hgQueuedRefresh = false;
    clearTimeout(this.hgExpiryTimer);
    clearTimeout(this.hgAuthTimer);
    this.hgCloseRealtime();
    this.hgUnsubscribe?.();
    window.removeEventListener("hg:auth-changed", this.hgQueueRefresh);
    window.removeEventListener("storage", this.hgOnStorage);
    window.removeEventListener("hg:iam-access-changed", this.hgOnChange);
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

  /** 旧版页面广播仅触发按需同步；不得把任意 window 事件内的快照作为权限。 */
  hgOnChange = (event) => {
    if (event.detail?.force) { this.hgQueueRefresh(); return; }
    const current = hgGetIAMSnapshot();
    if (event.detail?.user_id && current?.user_id === event.detail.user_id &&
        Number(event.detail.policy_version) > Number(current.policy_version)) this.hgQueueRefresh();
  };

  /** 只合并同账号的重复请求；跨账号切换仍立即开始新请求。 */
  hgRefresh = (options = {}) => {
    const owner = hgCurrentIAMUser();
    if (this.hgRealtimeOwner && this.hgRealtimeOwner !== owner) this.hgCloseRealtime();
    if (this.hgInFlight?.owner === owner) return this.hgInFlight.promise;
    if (this.hgInFlight && this.hgInFlight.owner !== owner) this.hgQueuedRefresh = false;
    const sequence = ++this.hgSequence;
    clearTimeout(this.hgExpiryTimer);
    this.setState({ status: "loading", snapshot: null });
    const promise = (async () => {
      await hgLoadLocalIAM().catch(() => null);
      if (!this.hgMounted || sequence !== this.hgSequence) return;
      try {
        const snapshot = await hgRefreshIAM({ sync: options.sync !== false });
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

  /** 只为真正会过期的绑定定时同步；超出浏览器定时器范围时仅重排，不提前请求。 */
  hgScheduleExpiry = (snapshot) => {
    clearTimeout(this.hgExpiryTimer);
    const expires = Date.parse(snapshot.expires_at); // 毫秒时间戳；2099 表示无限期投影上限。
    if (!Number.isFinite(expires) || expires >= Date.UTC(2099, 0, 1)) return;
    const delay = expires - Date.now();
    if (delay <= 0) { this.hgQueueRefresh(); return; }
    this.hgExpiryTimer = setTimeout(() => {
      if (delay > 2_147_483_647) this.hgScheduleExpiry(snapshot);
      else this.hgQueueRefresh();
    }, Math.min(delay, 2_147_483_647));
  };

  /** 页面级私有 IM 连接不依赖聊天页面；订阅成功与每次重连都同步一次弥补漏消息。 */
  hgEnsureRealtime = (owner) => {
    if (!owner || this.hgRealtimeOwner === owner) return;
    this.hgCloseRealtime();
    this.hgRealtimeOwner = owner;
    const realtime = new HGIAMRealtime(owner, async (snapshot, eventId) => {
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
        window.dispatchEvent(new CustomEvent("hg:iam-notification"));
      }
    }, () => {
      if (this.hgMounted && this.hgRealtime === realtime) this.hgQueueRefresh();
    }, () => {
      if (this.hgMounted && this.hgRealtime === realtime) this.setState({ status: "error", snapshot: null });
    });
    this.hgRealtime = realtime;
    void realtime.hgStart().catch((error) => {
      if (this.hgMounted && this.hgRealtime === realtime) {
        if (error?.status === 503) {
          // IM 尚未启用的旧环境继续使用服务端一分钟快照复核，绝不将它误判为长期授权。
          this.hgCloseRealtime();
        } else {
          this.setState({ status: "error", snapshot: null });
        }
      }
    });
  };

  /** 更换用户时关闭旧频道；旧连接里的消息与同步回调一律不能写新账号。 */
  hgCloseRealtime = () => {
    this.hgRealtime?.hgClose();
    this.hgRealtime = null;
    this.hgRealtimeOwner = "";
  };

  render() {
    return (
      <HGIAMContext.Provider value={{ ...this.state, refresh: this.hgRefresh }}>
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
