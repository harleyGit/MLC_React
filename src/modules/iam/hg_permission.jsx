import React from "react";
import { Navigate } from "react-router-dom";
import { hgMessage } from "../../components/hg_message/hg_message_page";
import { useHGPermission } from "./hg_use_permission";
import styles from "./hg_permission.module.css";

/** 无授权的模块不挂载，避免子组件自动发起敏感请求。 */
export function HGPermissionGate({
  permission, // 必填权限码；未指定时默认拒绝。
  scopeType, // 可选作用域类型；不传时仅全局授权可通过。
  scopeId, // 可选业务作用域 ID；空值不可匹配非全局授权。
  fallback = null, // 无权限时默认不渲染模块。
  children = null, // 待保护模块；默认无子节点。
}) {
  const access = useHGPermission({ permission, scopeType, scopeId });
  return access.allowed ? children : fallback;
}

/** 只处理有权限才执行的单击；aria-disabled 仍保留键盘触发与 Toast。 */
export function HGAuthButton({
  permission = undefined, // 单项操作权限码；缺省且没有 allOf 时默认拒绝。
  allOf = undefined, // 可选同时具备的权限码集合；缺省只校验 permission，各码分别在请求作用域内匹配。
  scopeType = undefined, // 缺省只允许全局授权；非全局须配合 scopeId。
  scopeId = undefined, // 缺省无资源 ID；不能替代服务端可信资源归属校验。
  disabled = false, // 业务禁用时同样阻止执行，默认 false。
  onClick = undefined, // 缺省无业务操作；无权限时绝不调用。
  children = null, // 按钮内容；默认空。
  type = "button", // 默认普通按钮，避免意外触发表单提交。
  appearance = "button", // 默认主按钮；link 用于行操作且保持 button 原生交互语义。
  danger = false, // 默认普通操作；true 用现有危险色语义强调撤销/拒绝。
  className = "", // 可选业务样式名，默认空。
  ...props
}) {
  const access = useHGPermission({ permission, allOf, scopeType, scopeId });
  const blocked = disabled || !access.allowed;
  return <button {...props} type={type} aria-disabled={blocked}
    className={`${styles.button} ${appearance === "link" ? styles.link : ""} ${danger ? styles.danger : ""} ${blocked ? styles.blocked : ""} ${className}`}
    onClick={(event) => {
      if (!blocked) { onClick?.(event); return; }
      event.preventDefault();
      event.stopPropagation();
      hgMessage.warning(disabled && access.allowed ? "当前操作暂不可用" : access.reason);
    }}>{children}</button>;
}

/** 无权限显示 403；请求失败单独提供重试，不泄露受保护页面内容。 */
export function HGRouteGuard({
  permission, // 单权限码；默认未指定时拒绝。
  anyOf, // 可选任一权限码列表；与单权限二选一。
  allOf, // 可选全部权限码列表；与单权限二选一。
  children = null, // 被保护路由；默认无内容。
}) {
  const access = useHGPermission({ permission, anyOf, allOf });
  if (access.loading) return <p role="status">正在核验权限...</p>;
  if (access.status === "unauthenticated") return <Navigate to="/login" replace />;
  if (access.status === "error") return <div role="alert">权限加载失败。<button type="button" onClick={access.refresh}>重试</button></div>;
  if (!access.allowed) return <div role="alert"><h1>403</h1><p>没有该页面的访问权限</p></div>;
  return children;
}
