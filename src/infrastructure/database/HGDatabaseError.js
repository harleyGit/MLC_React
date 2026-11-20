/**
 * 本地数据库统一错误类型
 * 职责：为 IndexedDB 操作提供带错误码的统一异常，便于上层区分失败原因并做降级处理。
 * 边界：仅覆盖本地数据库层错误，不含网络与业务错误。
 */

// 错误码定义：上层依据 code 决定重试、降级或提示用户
export const HG_DB_ERROR_CODES = {
  OPEN_FAILED: "OPEN_FAILED",                            // 数据库打开失败（含环境不支持 IndexedDB）
  VERSION_MIGRATION_FAILED: "VERSION_MIGRATION_FAILED",  // 版本升级迁移失败
  TRANSACTION_ABORTED: "TRANSACTION_ABORTED",            // 事务中止或提交失败
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",                      // 存储配额不足
  STORE_NOT_FOUND: "STORE_NOT_FOUND",                    // 访问了不存在的 Object Store
  INVALID_ARGUMENT: "INVALID_ARGUMENT"                   // 参数不合法
};

// 统一数据库异常：保留原始错误引用 cause，方便排查
export class HGDatabaseError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "HGDatabaseError";
    this.code = code;
    this.cause = cause;
  }
}

// 判断是否为存储配额类错误；浏览器实现差异较大，这里按 DOMException name 宽松匹配
export function hgIsQuotaError(error) {
  if (!error) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.code === HG_DB_ERROR_CODES.QUOTA_EXCEEDED
  );
}

// 将原始异常包装为 HGDatabaseError；已是 HGDatabaseError 时原样返回，避免嵌套包装
export function hgWrapDatabaseError(error, code, message) {
  if (error instanceof HGDatabaseError) {
    return error;
  }
  return new HGDatabaseError(code, message, error);
}
