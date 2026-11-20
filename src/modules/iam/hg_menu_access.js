import { HG_PERMISSIONS } from "./hg_permission_codes";
import { hgEvaluateAccess } from "./hg_access_evaluator";

// 仅为服务端已有 IAM 权限声明的真实业务页配置门槛；占位页及独立服务仍由原管理员守卫保护。
export const HG_OPERATION_PERMISSIONS = Object.freeze({
  user_list: HG_PERMISSIONS.USER_READ,
  admin_list: HG_PERMISSIONS.IAM_READ,
  admin_add: HG_PERMISSIONS.IAM_GRANT,
  admin_role_assign: HG_PERMISSIONS.IAM_GRANT,
  user_permission: HG_PERMISSIONS.IAM_READ,
  role_list: HG_PERMISSIONS.IAM_READ,
  role_scope_type: HG_PERMISSIONS.IAM_READ,
  role_scope_type_create: HG_PERMISSIONS.IAM_GRANT,
  role_scope_type_edit: HG_PERMISSIONS.IAM_GRANT,
  role_employee: HG_PERMISSIONS.IAM_READ,
  role_create: HG_PERMISSIONS.IAM_GRANT,
  role_edit: HG_PERMISSIONS.IAM_GRANT,
  permission_config: HG_PERMISSIONS.IAM_READ,
  permission_menu: HG_PERMISSIONS.OPS_MENU_READ,
  resource_file: HG_PERMISSIONS.OPS_FILE_READ,
  resource_file_list: HG_PERMISSIONS.OPS_FILE_READ,
  bilibili_douga_tags: HG_PERMISSIONS.OPS_TAG_READ,
  coin_operations: HG_PERMISSIONS.ASSET_BALANCE_READ,
  hg_recharge_sku: HG_PERMISSIONS.RECHARGE_READ,
  mall_commerce_categories: HG_PERMISSIONS.MALL_REVIEW,
  mall_pending_merchants: HG_PERMISSIONS.MALL_REVIEW,
  mall_pending_products: HG_PERMISSIONS.MALL_REVIEW,
  mall_pending_media: HG_PERMISSIONS.MALL_REVIEW,
  mall_pending_edits: HG_PERMISSIONS.MALL_REVIEW,
  system_notify_channel: HG_PERMISSIONS.NOTIFICATION_CHANNEL_READ,
});

/** 对菜单及内容复用同一份门槛；无映射的原有管理员页面沿用已有服务端限制。 */
export function hgCanOpenOperation(snapshot, key) {
  const permission = HG_OPERATION_PERMISSIONS[key];
  return !permission || hgEvaluateAccess(snapshot, { permission }).allowed;
}

/** 先过滤子项再过滤空分类，避免透过菜单暴露不可访问的入口。 */
export function hgFilterOperationMenu(items, snapshot) {
  return items.map((item) => item.children
    ? { ...item, children: item.children.filter((child) => hgCanOpenOperation(snapshot, child.key)) }
    : item).filter((item) => item.children ? item.children.length > 0 : hgCanOpenOperation(snapshot, item.key));
}
