import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

// 盘点权限只允许由服务端 IAM 目录与角色绑定确认；前端常量不是授权依据。
export const HG_INVENTORY_PERMISSION = "media:inventory:read";
export const HG_GRANT_PERMISSION = "iam:role:grant";

export default class HGPermissionConfigVM {
  /** 精确核对业务 user_id，拒绝把手机号或另一个同前缀账号当成目标。 */
  static findAdmin = async (userId) => {
    const result = await HGNet.get(HGMANAGER_API.OPS_ADMIN_SEARCH, { keyword: userId, limit: 20 });
    return (result?.list || []).find((item) => item.id === userId) || null;
  };

  /** 仅查询当前目标的一页有效 IAM 绑定，不将旧 ops 角色视为授权。 */
  static fetchBindings = (userId, cursor = "0") =>
    HGNet.get(HGMANAGER_API.IAM_BINDING_LIST, { userId, cursor, pageSize: 20 });

  /** 读取选中角色的权威权限集合；不能用角色名称推断新权限。 */
  static fetchRolePermissions = (roleId) =>
    HGNet.get(HGMANAGER_API.IAM_PERMISSION_LIST, { roleId });

  /** 有效性判断只使用服务端已返回的数据；未加载的绑定不当作无权限。 */
  static hasPermission = (selected, permission) =>
    Array.isArray(selected) && selected.includes(permission);
}
