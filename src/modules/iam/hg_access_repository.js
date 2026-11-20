import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";

// 沿用现有 IndexedDB client_settings 表，不存令牌；仅缓存供界面显示的短期授权投影。
const hgRepository = new HGBaseRepository(HG_STORES.SETTINGS);
const hgKey = (userId) => `iam:access:${userId}`;

/** 严格按当前 JWT 账号键读取；过期快照不可作为权限使用。 */
export async function hgReadAccess(userId) {
  if (!userId) return null;
  const record = await hgRepository.get(hgKey(userId));
  const snapshot = record?.snapshot;
  return snapshot?.user_id === userId && Array.isArray(snapshot.grants) &&
    Date.parse(snapshot.expires_at) > Date.now() ? snapshot : null;
}

/** 只保存服务端确认的本人快照，不允许客户端推断角色或权限。 */
export async function hgSaveAccess(userId, snapshot) {
  if (!userId || snapshot?.user_id !== userId || !Array.isArray(snapshot.grants) ||
      !Array.isArray(snapshot.roles) || !Number.isFinite(Date.parse(snapshot.expires_at)) ||
      Date.parse(snapshot.expires_at) <= Date.now()) {
    throw new Error("权限快照无效");
  }
  await hgRepository.put({ key: hgKey(userId), snapshot });
}

/** 登出后只清理当前账号权限，不删除其他账号偏好。 */
export async function hgRemoveAccess(userId) {
  if (userId) await hgRepository.delete(hgKey(userId));
}
