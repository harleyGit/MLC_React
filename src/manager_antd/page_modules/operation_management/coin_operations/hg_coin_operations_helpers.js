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

/** 从已缓存的安全资料字段中读取当前操作人 ID；缺失时交由后端最终鉴权。 */
export function getCurrentOperatorId(profile) {
  return String(profile?.id ?? profile?.user_id ?? "").trim();
}
