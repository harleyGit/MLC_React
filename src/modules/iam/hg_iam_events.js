// 仅传刷新信号；不跨标签页传播角色、权限、用户 ID、Token 或 MFA。
const HG_IAM_CHANNEL = "mlc_iam_refresh_v1";
let hgChannel = null; // 单标签一个可选频道；不支持时同标签刷新仍正常。

function hgDispatchRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new window.CustomEvent("hg:iam-access-changed", { detail: { force: true } }));
  }
}

/** 广播授权变更提示；IAM 页面仅接收本人频道推送，不因此自动发 HTTP 请求。 */
export function hgNotifyIAMChanged({ broadcast = true } = {}) {
  hgDispatchRefresh();
  if (!broadcast || !hgChannel) return;
  try { hgChannel.postMessage("refresh"); } catch { /* 广播失败不影响服务端逐请求鉴权。 */ }
}

if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    hgChannel = new BroadcastChannel(HG_IAM_CHANNEL);
    hgChannel.onmessage = (event) => {
      if (event.data === "refresh") hgDispatchRefresh();
    };
  } catch {
    hgChannel = null;
  }
}
