/** IM 标签页数据与账号绑定；JWT uid 只用于缓存隔离，权限由 Go 校验。 */
export const HG_IM_SESSION_KEY = "hg.im.session.v1";

export function hgIMOwner() {
  try {
    // 不以 exp 阻断既有刷新链路；只提取缓存所属账号。
    const hgPart = localStorage.getItem("manager_token")?.split(".")[1];
    const hgClaims = JSON.parse(atob(hgPart.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof hgClaims.uid === "string" ? hgClaims.uid : "";
  } catch { return ""; }
}

/** 仅保存设备凭据和当前 callId；消息正文、媒体和连接 token 不落盘。 */
export function hgIMSession(hgOwner, hgUpdate) {
  let hgValue = {}; // 无缓存/跨账号时为空；不能沿用未知归属的旧设备。
  try {
    const hgStored = JSON.parse(sessionStorage.getItem(HG_IM_SESSION_KEY) || "null");
    if (hgStored?.owner === hgOwner && hgOwner) hgValue = hgStored;
    if (hgUpdate) {
      hgValue = { ...hgValue, ...hgUpdate, owner: hgOwner };
      sessionStorage.setItem(HG_IM_SESSION_KEY, JSON.stringify(hgValue));
    }
  } catch { /* 禁用存储时本次运行仍可用内存凭据；不降级为持久存储。 */ }
  return hgValue;
}

/** 登出时立即清除当前标签页的 IM 秘密与旧演示设备。 */
export function hgClearIMSession() {
  try {
    sessionStorage.removeItem(HG_IM_SESSION_KEY);
    sessionStorage.removeItem("hg.im.device.debug");
  } catch { /* 浏览器禁止存储时没有可恢复缓存。 */ }
}
