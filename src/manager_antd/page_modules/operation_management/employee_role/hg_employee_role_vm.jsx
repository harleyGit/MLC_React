import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

export const INITIAL_BINDING_FORM = { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "", mfaCode: "" };
export const HG_APPROVAL_PAGE_SIZE = 20; // 审批接口单页上限；页码映射和表格分页必须与请求保持一致。

export default class HGEmployeeRoleVM {
  /** 有界游标加载角色选择项。 */
  static fetchRoles = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: 100 });
  /** 读取指定角色的权限目录与已生效权限；仅供授权表单查看，不修改角色权限。 */
  static fetchRolePermissions = (roleId) => HGNet.get(HGMANAGER_API.IAM_PERMISSION_LIST, { roleId });
  /** 提交单个作用域授权审批申请；浏览器本地时间转换为 RFC3339。 */
  static grant = ({ userId, roleId, scopeType, scopeId, expiresAt, mfaCode }) => HGNet.post(HGMANAGER_API.IAM_BINDING_GRANT, {
    userId: String(userId || "").trim(), roleId: String(roleId || ""), scopeType,
    scopeId: scopeType === "global" ? "" : String(scopeId || "").trim(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    mfaCode: String(mfaCode || "").trim(),
  });

  /** 按 id 游标读取待审批队列。 */
  static fetchApprovals = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_APPROVAL_LIST, { cursor, pageSize: HG_APPROVAL_PAGE_SIZE });
  /** 审批人输入一次性验证码后裁决申请。 */
  static decideApproval = (id, mfaCode, approve) => HGNet.post(approve ? HGMANAGER_API.IAM_APPROVAL_APPROVE : HGMANAGER_API.IAM_APPROVAL_REJECT, { id: String(id), mfaCode });
}
