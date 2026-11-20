import React from "react";
import { hgClearIAM, hgGetIAMSnapshot, hgLoadLocalIAM, hgRefreshIAM, hgSubscribeIAM } from "./hg_iam_session";

export const HGIAMContext = React.createContext(null);

/** 统一维护授权视图：IndexedDB 可填充展示变量，但只有服务端刷新成功才进入 ready。 */
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
  hgExpiryTimer = null; // 快照到期时主动核验；无快照时为 null。

  componentDidMount() {
    this.hgMounted = true;
    this.hgUnsubscribe = hgSubscribeIAM(() => {
      if (this.hgMounted) this.setState({ snapshot: hgGetIAMSnapshot() });
    });
    window.addEventListener("hg:auth-changed", this.hgRefresh);
    window.addEventListener("storage", this.hgOnStorage);
    window.addEventListener("focus", this.hgOnFocus);
    window.addEventListener("hg:iam-access-changed", this.hgOnChange);
    this.hgRefresh();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSequence += 1;
    clearTimeout(this.hgExpiryTimer);
    this.hgUnsubscribe?.();
    window.removeEventListener("hg:auth-changed", this.hgRefresh);
    window.removeEventListener("storage", this.hgOnStorage);
    window.removeEventListener("focus", this.hgOnFocus);
    window.removeEventListener("hg:iam-access-changed", this.hgOnChange);
  }

  /** token 被其他标签页修改时同步清理旧账号快照。 */
  hgOnStorage = (event) => {
    if (event.key === "manager_token" || event.key === null) {
      hgClearIAM();
      this.hgRefresh();
    }
  };

  /** 页面恢复焦点时重新向权威服务核对，补偿权限变更事件丢失。 */
  hgOnFocus = () => { if (document.visibilityState === "visible") this.hgRefresh(); };

  /** 实时模块可只发送策略修订号事件；HTTP 仍是唯一授权快照来源。 */
  hgOnChange = (event) => {
    const current = hgGetIAMSnapshot();
    if (event.detail?.user_id && current?.user_id === event.detail.user_id &&
        Number(event.detail.policy_version) > Number(current.policy_version)) this.hgRefresh();
  };

  hgRefresh = async () => {
    const sequence = ++this.hgSequence;
    clearTimeout(this.hgExpiryTimer);
    this.setState({ status: "loading", snapshot: null });
    await hgLoadLocalIAM().catch(() => null);
    if (!this.hgMounted || sequence !== this.hgSequence) return;
    try {
      const snapshot = await hgRefreshIAM();
      if (this.hgMounted && sequence === this.hgSequence) {
        this.setState({ snapshot, status: snapshot ? "ready" : "unauthenticated" });
        if (snapshot) {
          this.hgExpiryTimer = setTimeout(this.hgRefresh,
            Math.max(0, Date.parse(snapshot.expires_at) - Date.now()));
        }
      }
    } catch {
      if (this.hgMounted && sequence === this.hgSequence) this.setState({ snapshot: null, status: "error" });
    }
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
