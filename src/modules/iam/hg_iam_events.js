// 仅传刷新信号；不跨标签页传播角色、权限、用户 ID、Token 或 MFA。
const HG_IAM_CHANNEL = "mlc_iam_refresh_v1";
let hgChannel = null; // 单标签一个可选频道；不支持时同标签刷新仍正常。

function hgDispatchRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new window.CustomEvent("hg:iam-access-changed", { detail: { force: true } }));
  }
}

/** 授权变更成功或收到服务端 403 后，清空旧展示并从 HTTP 权威接口刷新。 */
export function hgNotifyIAMChanged({ broadcast = true } = {}) {
  hgDispatchRefresh();
  if (!broadcast || !hgChannel) return;
  try { hgChannel.postMessage("refresh"); } catch { /* 其他标签页会在焦点/快照到期时核对。 */ }
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
