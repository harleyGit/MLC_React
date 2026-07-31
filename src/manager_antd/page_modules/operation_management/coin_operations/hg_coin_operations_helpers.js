export const HG_ASSET_PERMISSIONS = Object.freeze({
  BALANCE_READ: "asset.coin.balance.read",
  TRANSACTION_READ: "asset.coin.transaction.read",
  GRANT: "asset.coin.grant",
  REFUND: "asset.coin.refund",
  CORRECTION_REQUEST: "asset.coin.correction.request",
  CORRECTION_APPROVE: "asset.coin.correction.approve",
  CORRECTION_APPLY: "asset.coin.correction.apply",
  PIPELINE_READ: "asset.pipeline.read",
});

/** 将权限接口响应收敛为可安全判断的字符串数组。 */
export function normalizeAssetPermissions(response) {
  if (!Array.isArray(response?.permissions)) return [];
  return response.permissions
    .filter((permission) => typeof permission === "string")
    .map((permission) => permission.trim())
    .filter(Boolean);
}

/** 构造修正申请请求，始终携带工单字段且保持资产数值为十进制字符串。 */
export function buildCorrectionRequest(form) {
  return {
    userId: String(form.userId || "").trim(),
    requestId: String(form.requestId || "").trim(),
    ticketId: String(form.ticketId || "").trim(),
    workOrderId: String(form.workOrderId || "").trim(),
    delta: String(form.delta),
    reason: String(form.reason || "").trim(),
  };
}

/** 构造有界修正列表参数；cursor 作为不透明字符串原样传递。 */
export function buildCorrectionListParams({ cursor = "", pageSize = 20 } = {}) {
  const boundedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { cursor: String(cursor), pageSize: boundedPageSize };
}

/** 只有同时具备审批和应用权限的非申请人才能在前端触发待审批修正。 */
export function canApproveCorrection(permissions, correction, operatorId = "") {
  const permissionSet = new Set(permissions || []);
  if (!permissionSet.has(HG_ASSET_PERMISSIONS.CORRECTION_APPROVE)
    || !permissionSet.has(HG_ASSET_PERMISSIONS.CORRECTION_APPLY)
    || correction?.status !== "pending") return false;
  const applicantId = String(correction?.applicantId || "").trim();
  const currentOperatorId = String(operatorId || "").trim();
  return !applicantId || !currentOperatorId || applicantId !== currentOperatorId;
}

/** 优先读取与 JWT/admin_user.user_id 一致的业务 ID，内部自增 id 仅作为旧缓存兜底。 */
export function getCurrentOperatorId(profile) {
  return String(profile?.user_id ?? profile?.userId ?? profile?.id ?? "").trim();
}

/** 构造单一唯一索引精确查询参数，禁止把任意字段名传给后端。 */
export function buildCoinUserSearchParams(field, keyword) {
  const normalizedField = ["userId", "phone", "email"].includes(field) ? field : "";
  return { field: normalizedField, keyword: String(keyword || "").trim() };
}

/** 收敛硬币目标用户响应；内部自增 id 不得替代业务 userId。 */
export function normalizeCoinUserSearchResponse(response) {
  const user = response?.user;
  const userId = String(user?.userId ?? user?.user_id ?? "").trim();
  if (!userId) return null;
  return {
    userId,
    userName: String(user?.userName ?? user?.user_name ?? "").trim(),
    nickName: String(user?.nickName ?? user?.nickname ?? "").trim(),
    maskedEmail: String(user?.maskedEmail ?? "").trim(),
    maskedPhone: String(user?.maskedPhone ?? "").trim(),
    matchedBy: String(user?.matchedBy ?? "").trim(),
  };
}

/** 对手机号做保守脱敏；异常短值也不会原样返回。 */
export function maskCoinUserPhone(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length >= 7) return `${text.slice(0, 3)}****${text.slice(-4)}`;
  if (text.length <= 2) return `${text.slice(0, 1)}***`;
  return `${text.slice(0, text.length < 4 ? 1 : 2)}***${text.slice(text.length < 4 ? -1 : -2)}`;
}

/** 对邮箱做保守脱敏；格式异常时退化为首尾隐藏而不是回显原值。 */
export function maskCoinUserEmail(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const at = text.lastIndexOf("@");
  if (at > 0 && at < text.length - 1) return `${text.slice(0, Math.min(2, at))}***${text.slice(at)}`;
  if (text.length <= 2) return `${text.slice(0, 1)}***`;
  return `${text.slice(0, text.length < 4 ? 1 : 2)}***${text.slice(text.length < 4 ? -1 : -2)}`;
}
