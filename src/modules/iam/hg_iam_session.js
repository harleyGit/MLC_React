import { hgReadAccess, hgRemoveAccess, hgSaveAccess } from "./hg_access_repository";
import { hgFetchAccess, hgSyncAccess } from "./hg_iam_api";

let hgSnapshot = null; // 本标签页的当前账号快照；null 表示未读取或已失效。
let hgOwner = ""; // JWT uid 仅作为缓存隔离键，不是服务端授权证明。
let hgGeneration = 0; // 账号切换/登出时递增，丢弃旧请求结果。
const hgListeners = new Set(); // 当前页面订阅者，不向其他标签页发送授权内容。
let hgPersistence = Promise.resolve(); // 将本页写入/删除串行化，避免旧响应在新快照后覆盖 IndexedDB。

/** 按操作顺序写本地投影；存储故障不影响当前已确认的服务端授权。 */
function hgPersist(operation) {
  hgPersistence = hgPersistence.catch(() => {}).then(operation);
  return hgPersistence.catch(() => {});
}

/** 所有来源都须遵守本人身份、递增修订号和失效时间；本地副本不是服务端鉴权凭证。 */
function hgValidSnapshot(owner, snapshot) {
  return snapshot?.user_id === owner && Array.isArray(snapshot.grants) &&
    Array.isArray(snapshot.roles) && Number.isSafeInteger(snapshot.policy_version) &&
    snapshot.policy_version >= 0 && Date.parse(snapshot.expires_at) > Date.now();
}

/** JWT 仅作为当前账号隔离键和会话时钟；不在浏览器中推断签名可信度。 */
function hgCurrentIAMClaims() {
  try {
    const token = localStorage.getItem("manager_token");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isFinite(payload.exp) && typeof payload.uid === "string" ? payload : null;
  } catch {
    return null;
  }
}

/** 只读取当前有效 JWT 的 uid 作为本地缓存键，不把它当服务端授权凭证。 */
export function hgCurrentIAMUser() {
  const payload = hgCurrentIAMClaims();
  return payload && payload.exp * 1000 > Date.now() ? payload.uid : "";
}

/** 返回当前账号 JWT 的到期毫秒时间；无有效会话时返回 0，供类组件清理旧展示。 */
export function hgCurrentIAMExpiry() {
  const payload = hgCurrentIAMClaims();
  return payload && payload.exp * 1000 > Date.now() ? payload.exp * 1000 : 0;
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
  await hgPersistence.catch(() => {}); // 登出删除排队中时，不得读回旧账号的待删除记录。
  const cached = await hgReadAccess(owner);
  if (generation === hgGeneration && owner === hgCurrentIAMUser() && cached) {
    hgSnapshot = cached;
    hgNotify();
  }
  return hgGetIAMSnapshot();
}

/** 登录/恢复会话首次取授权，或按明确的事件/重连走同步入口；旧账号请求不得覆盖。 */
export async function hgRefreshIAM({ sync = false } = {}) {
  const owner = hgCurrentIAMUser();
  hgGetIAMSnapshot();
  if (!owner) return null;
  const generation = ++hgGeneration;
  if (!sync) {
    hgSnapshot = null;
    hgNotify();
  }
  try {
    const snapshot = await (sync ? hgSyncAccess() : hgFetchAccess());
    if (generation !== hgGeneration || owner !== hgCurrentIAMUser()) return hgGetIAMSnapshot();
    if (!hgValidSnapshot(owner, snapshot)) throw new Error("权限快照无效");
    if (hgSnapshot?.policy_version > snapshot.policy_version) return hgSnapshot;
    hgSnapshot = snapshot;
    hgNotify();
    // IndexedDB 不可用不影响已通过服务端验证的本次页面展示。
    await hgPersist(() => owner === hgCurrentIAMUser() && generation === hgGeneration
      ? hgSaveAccess(owner, snapshot) : null);
    return snapshot;
  } catch (error) {
    if (generation === hgGeneration) { hgSnapshot = null; hgNotify(); }
    throw error;
  }
}

/** 仅供认证后的 Centrifugo 客户端调用；乱序、重放、跨账号及无效快照一律不入库。 */
export async function hgApplyPushedIAM(snapshot) {
  const owner = hgCurrentIAMUser();
  const current = hgGetIAMSnapshot();
  if (!owner || !hgValidSnapshot(owner, snapshot) ||
      current && snapshot.policy_version <= current.policy_version) return false;
  const generation = ++hgGeneration;
  hgOwner = owner;
  hgSnapshot = snapshot;
  hgNotify();
  await hgPersist(() => generation === hgGeneration && owner === hgCurrentIAMUser()
    ? hgSaveAccess(owner, snapshot) : null);
  return generation === hgGeneration && owner === hgCurrentIAMUser();
}

/** 清理当前会话并广播本页状态变更；不能让登出的账号继续展示旧授权。 */
export function hgClearIAM() {
  const owner = hgCurrentIAMUser() || hgOwner;
  hgGeneration += 1;
  hgOwner = "";
  hgSnapshot = null;
  hgNotify();
  void hgPersist(() => hgRemoveAccess(owner));
}
