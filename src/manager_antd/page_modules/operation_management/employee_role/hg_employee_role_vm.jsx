import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

export const INITIAL_BINDING_FORM = { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "" };

export default class HGEmployeeRoleVM {
  /** 有界游标加载角色选择项。 */
  static fetchRoles = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: 100 });
  /** 按精确业务用户 ID 查询活动绑定。 */
  static fetchBindings = (userId, cursor = 0) => HGNet.get(HGMANAGER_API.IAM_BINDING_LIST, { userId: String(userId || "").trim(), cursor, pageSize: 20 });
  /** 授予单个作用域角色；浏览器本地时间转换为 RFC3339。 */
  static grant = ({ userId, roleId, scopeType, scopeId, expiresAt }) => HGNet.post(HGMANAGER_API.IAM_BINDING_GRANT, {
    userId: String(userId || "").trim(), roleId: String(roleId || ""), scopeType,
    scopeId: scopeType === "global" ? "" : String(scopeId || "").trim(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  });
  /** 按绑定主键撤销，避免影响用户在其他作用域的同名角色。 */
  static revoke = (userId, bindingId) => HGNet.post(HGMANAGER_API.IAM_BINDING_REVOKE, {
    userId: String(userId || "").trim(), bindingId: String(bindingId),
  });
}
