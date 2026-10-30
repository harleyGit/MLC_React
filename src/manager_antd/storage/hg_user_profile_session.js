// 仅在同一浏览器标签页保留最小展示资料；联系方式等敏感资料只存运行时内存。
const HG_PROFILE_SESSION_KEY = "manager_user_profile_session_v2";
const HG_PROFILE_MAX_AGE = 15 * 60 * 1000;
const HG_PROFILE_FIELDS = ["id", "user_id", "user_name", "username", "userName", "nickname", "signature", "gender", "birth_month", "birth_date", "avatar_url", "avatarUrl", "phone", "email"];
const HG_SESSION_FIELDS = ["id", "user_id", "user_name", "username", "userName", "nickname", "avatar_url", "avatarUrl"];
const HG_EDITABLE_FIELDS = ["nickname", "signature", "gender", "birth_month", "birth_date", "avatar_url", "avatarUrl"];

let hgMemoryProfile = null; // 当前标签页内存快照；null 表示尚未获取或已清理，不写入持久介质。

/** JWT uid 仅用作本地缓存隔离标识；不参与鉴权，真正权限由服务端校验。 */
function hgCurrentUserID() {
  try {
    const token = window.localStorage.getItem("manager_token");
    const payload = token?.split(".")[1];
    if (!payload) return "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) return "";
    return typeof claims.uid === "string" ? claims.uid : "";
  } catch {
    return "";
  }
}

/** 只拷贝明确允许的资料字段，避免服务端新增敏感字段后被意外缓存。 */
function hgPickProfileFields(profile, keys) {
  return Object.fromEntries(keys.filter((key) => profile[key] !== undefined && profile[key] !== null).map((key) => [key, profile[key]]));
}

/** 浏览器本地资料快照：跨页面可读；持久层只保存同标签页的最小展示字段。 */
export default class HGUserProfileSession {
  /** 服务端资料成功返回后写入；账号标识不匹配则拒绝，防止跨账号覆盖。 */
  static save(profile) {
    const owner = hgCurrentUserID();
    if (!owner || !profile || typeof profile !== "object" || profile.user_id !== owner) return null;
    const safe = hgPickProfileFields(profile, HG_PROFILE_FIELDS);
    const savedAt = Date.now();
    hgMemoryProfile = { owner, savedAt, value: safe };
    try {
      window.sessionStorage.setItem(HG_PROFILE_SESSION_KEY, JSON.stringify({ owner, savedAt, value: hgPickProfileFields(safe, HG_SESSION_FIELDS) }));
    } catch {
      // 禁用浏览器存储时仅保留内存副本，不降级到 localStorage。
    }
    return { ...safe };
  }

  /** 返回当前登录用户资料副本；token 失效、过期或切换账号时清理旧缓存。 */
  static get() {
    const owner = hgCurrentUserID();
    if (!owner) { this.clear(); return null; }
    if (hgMemoryProfile) {
      if (hgMemoryProfile.owner === owner && Date.now() - hgMemoryProfile.savedAt < HG_PROFILE_MAX_AGE) return { ...hgMemoryProfile.value };
      hgMemoryProfile = null;
    }
    try {
      const raw = window.sessionStorage.getItem(HG_PROFILE_SESSION_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (entry?.owner !== owner || entry?.value?.user_id !== owner || !Number.isFinite(entry.savedAt) || Date.now() - entry.savedAt >= HG_PROFILE_MAX_AGE || entry.savedAt > Date.now()) {
        this.clear(); return null;
      }
      // 即使 sessionStorage 被手动修改，也只能读出展示字段。
      const value = hgPickProfileFields(entry.value, HG_SESSION_FIELDS);
      hgMemoryProfile = { owner, savedAt: entry.savedAt, value };
      return { ...value };
    } catch {
      this.clear(); return null;
    }
  }

  /** 仅修改已缓存的可编辑字段；必须由调用方在服务端更新成功后调用。 */
  static patch(fields) {
    const current = this.get();
    if (!current || !fields || typeof fields !== "object") return null;
    return this.save({ ...current, ...hgPickProfileFields(fields, HG_EDITABLE_FIELDS) });
  }

  /** 退出登录或身份失效时清理内存与标签页存储。 */
  static clear() {
    hgMemoryProfile = null;
    try { window.sessionStorage.removeItem(HG_PROFILE_SESSION_KEY); } catch { /* 存储不可访问时内存已清空。 */ }
  }
}
