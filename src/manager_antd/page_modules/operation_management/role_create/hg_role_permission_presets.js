import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes.js";

/** 系统通知模板草稿的四种独立能力；权限目录仍以服务端返回值为准。 */
export const HG_NOTIFICATION_TEMPLATE_PERMISSIONS = Object.freeze([
  HG_PERMISSIONS.NOTIFICATION_TEMPLATE_READ,
  HG_PERMISSIONS.NOTIFICATION_TEMPLATE_CREATE,
  HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE,
  HG_PERMISSIONS.NOTIFICATION_TEMPLATE_DELETE,
]);

/**
 * 将已登记的通知模板权限追加至当前角色草稿，不清除已有选择、不执行授权。
 * @param {Array<{code: string, description: string}>} available 服务端 IAM 权限目录；缺项时拒绝整个预选。
 * @param {string[]} selected 当前表单已选权限；创建默认 []，编辑为服务端回填后用户当前选择。
 * @returns {string[]} 不重复、最多 50 项的下一份表单草稿。
 */
export function hgSelectNotificationTemplatePermissions(available, selected) {
  const codes = new Set(Array.isArray(available) ? available.map((item) => item.code) : []);
  if (!HG_NOTIFICATION_TEMPLATE_PERMISSIONS.every((code) => codes.has(code))) {
    throw new Error("后端权限目录尚未包含全部通知模板管理权限，请检查迁移及 IAM 授权");
  }
  if (!Array.isArray(selected)) throw new Error("角色权限尚未加载完成，请稍后再试");
  const result = [...new Set([...selected, ...HG_NOTIFICATION_TEMPLATE_PERMISSIONS])];
  if (result.length > 50) throw new Error("角色权限最多 50 项，请先移除不需要的权限");
  return result;
}
