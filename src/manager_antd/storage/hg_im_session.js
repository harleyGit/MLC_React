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

/** 设备凭据与登录会话一一绑定；旧 JWT 没有 sid 时返回空字符串，禁止复用未知会话凭据。 */
export function hgIMSessionID() {
  try {
    const hgPart = localStorage.getItem("manager_token")?.split(".")[1]; // 当前标签页使用的 JWT payload。
    const hgClaims = JSON.parse(atob(hgPart.replace(/-/g, "+").replace(/_/g, "/"))); // 只用于本地缓存隔离，不作为鉴权依据。
    return /^[a-f0-9]{32}$/.test(hgClaims.sid) ? hgClaims.sid : "";
  } catch { return ""; }
}

/** 仅保存设备凭据和当前 callId；消息正文、媒体和连接 token 不落盘。 */
export function hgIMSession(hgOwner, hgUpdate, hgIncludePrevious = false) {
  let hgValue = {}; // 无缓存/跨账号时为空；不能沿用未知归属的旧设备。
  try {
    const hgStored = JSON.parse(sessionStorage.getItem(HG_IM_SESSION_KEY) || "null");
    if (hgStored?.owner === hgOwner && hgOwner) hgValue = hgStored;
    if (hgUpdate) {
      hgValue = { ...hgValue, ...hgUpdate, owner: hgOwner };
      sessionStorage.setItem(HG_IM_SESSION_KEY, JSON.stringify(hgValue));
    }
  } catch { /* 禁用存储时本次运行仍可用内存凭据；不降级为持久存储。 */ }
  // 默认只暴露当前登录会话的设备凭据；注册流程才能读取旧会话凭据用于主动撤销。
  if (!hgIncludePrevious && hgValue.credential && hgValue.sessionID !== hgIMSessionID()) {
    return { ...hgValue, credential: null };
  }
  return hgValue;
}

/** 登出时立即清除当前标签页的 IM 秘密与旧演示设备。 */
export function hgClearIMSession() {
  try {
    sessionStorage.removeItem(HG_IM_SESSION_KEY);
    sessionStorage.removeItem("hg.im.device.debug");
  } catch { /* 浏览器禁止存储时没有可恢复缓存。 */ }
}
