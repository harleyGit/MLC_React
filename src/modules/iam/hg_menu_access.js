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
  system_notify_template: HG_PERMISSIONS.NOTIFICATION_TEMPLATE_READ,
  system_notify_send: [
    HG_PERMISSIONS.NOTIFICATION_SEND_CREATE,
    HG_PERMISSIONS.NOTIFICATION_SEND_READ,
    HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE,
    HG_PERMISSIONS.NOTIFICATION_TEMPLATE_PUBLISH,
  ],
});

/** 发送页允许创建、查询、审批或发布角色分别进入；各按钮仍受服务端独立权限保护。 */
export function hgCanOpenOperation(snapshot, key) {
  const permission = HG_OPERATION_PERMISSIONS[key];
  return !permission || (Array.isArray(permission) ? permission : [permission])
    .some((code) => hgEvaluateAccess(snapshot, { permission: code }).allowed);
}

/** 逐层过滤叶子和空分类，避免嵌套通知菜单泄露无权访问的入口。 */
export function hgFilterOperationMenu(items, snapshot) {
  return items.map((item) => item.children
    ? { ...item, children: hgFilterOperationMenu(item.children, snapshot) }
    : item).filter((item) => item.children ? item.children.length > 0 : hgCanOpenOperation(snapshot, item.key));
}
