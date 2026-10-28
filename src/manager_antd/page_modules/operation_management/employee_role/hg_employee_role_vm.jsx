import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

export const INITIAL_BINDING_FORM = { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "", mfaCode: "" };

export default class HGEmployeeRoleVM {
  /** 有界游标加载角色选择项。 */
  static fetchRoles = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: 100 });
  /** 按精确业务用户 ID 查询活动绑定。 */
  static fetchBindings = (userId, cursor = 0) => HGNet.get(HGMANAGER_API.IAM_BINDING_LIST, { userId: String(userId || "").trim(), cursor, pageSize: 20 });
  /** 提交单个作用域授权审批申请；浏览器本地时间转换为 RFC3339。 */
  static grant = ({ userId, roleId, scopeType, scopeId, expiresAt, mfaCode }) => HGNet.post(HGMANAGER_API.IAM_BINDING_GRANT, {
    userId: String(userId || "").trim(), roleId: String(roleId || ""), scopeType,
    scopeId: scopeType === "global" ? "" : String(scopeId || "").trim(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    mfaCode: String(mfaCode || "").trim(),
  });

  /** 首次绑定需要当前密码；密钥只在该响应中返回一次。 */
  static enrollMFA = (password) => HGNet.post(HGMANAGER_API.IAM_MFA_ENROLL, { password });
  /** 激活 TOTP 因子，并消费首次验证码。 */
  static confirmMFA = (code) => HGNet.post(HGMANAGER_API.IAM_MFA_CONFIRM, { code });
  /** 按 id 游标读取待审批队列。 */
  static fetchApprovals = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_APPROVAL_LIST, { cursor, pageSize: 20 });
  /** 审批人输入一次性验证码后裁决申请。 */
  static decideApproval = (id, mfaCode, approve) => HGNet.post(approve ? HGMANAGER_API.IAM_APPROVAL_APPROVE : HGMANAGER_API.IAM_APPROVAL_REJECT, { id: String(id), mfaCode });
  /** 按绑定主键撤销，避免影响用户在其他作用域的同名角色。 */
  static revoke = (userId, bindingId) => HGNet.post(HGMANAGER_API.IAM_BINDING_REVOKE, {
    userId: String(userId || "").trim(), bindingId: String(bindingId),
  });
}
