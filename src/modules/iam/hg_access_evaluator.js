// 只用于界面预判；真实权限、资源归属及撤权由 Go 服务端逐请求检查。
const HG_SCOPES = new Set(["global", "shop", "org"]);

/** 同一条授权同时匹配权限及作用域，绝不合并不同绑定的权限范围。 */
export function hgEvaluateAccess(snapshot, { permission, scopeType, scopeId } = {}) {
  if (!permission || !snapshot || !Array.isArray(snapshot.grants)) {
    return { allowed: false, reason: "权限尚未就绪" };
  }
  if (!snapshot.expires_at || !Number.isFinite(Date.parse(snapshot.expires_at)) ||
      Date.parse(snapshot.expires_at) <= Date.now()) {
    return { allowed: false, reason: "权限已过期" };
  }
  const grants = snapshot.grants.filter((grant) =>
    grant.permission === permission && HG_SCOPES.has(grant.scope_type));
  if (!grants.length) return { allowed: false, reason: "没有该操作权限" };
  const matched = grants.some((grant) => grant.scope_type === "global" && !grant.scope_id ||
    grant.scope_type === scopeType && Boolean(scopeId) && grant.scope_id === scopeId);
  return matched
    ? { allowed: true, reason: "" }
    : { allowed: false, reason: "不在授权作用域内" };
}
