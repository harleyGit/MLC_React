import { hgReadAccess, hgRemoveAccess, hgSaveAccess } from "./hg_access_repository";
import { hgFetchAccess } from "./hg_iam_api";

let hgSnapshot = null; // 本标签页的当前账号快照；null 表示未读取或已失效。
let hgOwner = ""; // JWT uid 仅作为缓存隔离键，不是服务端授权证明。
let hgGeneration = 0; // 账号切换/登出时递增，丢弃旧请求结果。
const hgListeners = new Set(); // 当前页面订阅者，不向其他标签页发送授权内容。

/** 只读取当前有效 JWT 的 uid 作为本地缓存键。 */
export function hgCurrentIAMUser() {
  try {
    const token = localStorage.getItem("manager_token");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now() &&
      typeof payload.uid === "string" ? payload.uid : "";
  } catch {
    return "";
  }
}

function hgNotify() { for (const listener of hgListeners) listener(); }

/** 同步读取组件变量；变量为空时由调用方异步读取 IndexedDB。 */
export function hgGetIAMSnapshot() {
  const owner = hgCurrentIAMUser();
  if (owner !== hgOwner || hgSnapshot && Date.parse(hgSnapshot.expires_at) <= Date.now()) {
    hgOwner = owner;
    hgSnapshot = null;
    hgGeneration += 1;
  }
  return hgSnapshot;
}

export function hgSubscribeIAM(listener) {
  hgListeners.add(listener);
  return () => hgListeners.delete(listener);
}

/** 本地副本仅用于显示；进入受保护视图前仍须从服务端核对。 */
export async function hgLoadLocalIAM() {
  const owner = hgCurrentIAMUser();
  if (!owner) return null;
  if (hgGetIAMSnapshot()) return hgSnapshot;
  const generation = hgGeneration;
  const cached = await hgReadAccess(owner);
  if (generation === hgGeneration && owner === hgCurrentIAMUser() && cached) {
    hgSnapshot = cached;
    hgNotify();
  }
  return hgGetIAMSnapshot();
}

/** 登录、注册后取得 Token、页面恢复焦点时刷新；旧账号请求不可覆盖新账号。 */
export async function hgRefreshIAM() {
  const owner = hgCurrentIAMUser();
  hgGetIAMSnapshot();
  if (!owner) return null;
  const generation = ++hgGeneration;
  hgSnapshot = null;
  hgNotify();
  try {
    const snapshot = await hgFetchAccess();
    if (generation !== hgGeneration || owner !== hgCurrentIAMUser()) return null;
    if (snapshot?.user_id !== owner || !Array.isArray(snapshot.grants) ||
        !Number.isFinite(Date.parse(snapshot.expires_at)) ||
        Date.parse(snapshot.expires_at) <= Date.now()) throw new Error("权限快照无效");
    hgSnapshot = snapshot;
    hgNotify();
    // IndexedDB 不可用不影响已通过服务端验证的本次页面展示。
    await hgSaveAccess(owner, snapshot).catch(() => {});
    return snapshot;
  } catch (error) {
    if (generation === hgGeneration) { hgSnapshot = null; hgNotify(); }
    throw error;
  }
}

/** 清理当前会话并广播本页状态变更；不能让登出的账号继续展示旧授权。 */
export function hgClearIAM() {
  const owner = hgCurrentIAMUser() || hgOwner;
  hgGeneration += 1;
  hgOwner = "";
  hgSnapshot = null;
  hgNotify();
  hgRemoveAccess(owner).catch(() => {});
}
