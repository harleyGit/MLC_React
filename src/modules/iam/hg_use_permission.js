import { useHGIAM } from "./hg_iam_provider";
import { hgEvaluateAccess } from "./hg_access_evaluator";

/** 同一资源上下文判断权限，网络失败不伪装成无权限。 */
export function useHGPermission({ permission, anyOf, allOf, scopeType, scopeId } = {}) {
  const { snapshot, status, refresh } = useHGIAM();
  const check = (code) => hgEvaluateAccess(snapshot, { permission: code, scopeType, scopeId });
  const result = status === "ready"
    ? anyOf?.length ? { allowed: anyOf.some((code) => check(code).allowed), reason: "没有该页面权限" }
      : allOf?.length ? { allowed: allOf.every((code) => check(code).allowed), reason: "缺少所需权限" }
        : check(permission)
    : { allowed: false, reason: "权限尚未就绪" };
  return { ...result, loading: status === "loading", status, refresh };
}
