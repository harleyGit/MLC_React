import { HGMANAGER_API } from "../../api/hg_api_constants";
import HGNet from "../../net_handle/hg_net_manager_vm";

/** 编辑用户页的 IAM 即时授权请求；批量绑定只提交目标 user_id、角色/作用域与角色现有权限的显式子集。 */
export default class HGUserRoleAssignVM {
  /** 角色目录使用服务端游标，最多读取 500 个；超限明确告知而非无限循环请求。 */
  static fetchAllRoles = async () => {
    const roles = []; // 当前已加载的活动角色；空数组表示服务端没有可选角色。
    let cursor = 0; // 首次请求游标；后续使用服务端 nextCursor。
    let hasMore = true; // 服务端是否还有下一页；最多聚合 500 个角色。
    while (hasMore && roles.length < 500) {
      const result = await HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: 100 });
      if (!Array.isArray(result?.list)) throw new Error("角色列表响应格式无效");
      roles.push(...result.list);
      hasMore = Boolean(result.hasMore);
      if (hasMore && (!result.nextCursor || result.nextCursor === cursor || result.list.length === 0)) throw new Error("角色列表游标无效");
      cursor = result.nextCursor || 0;
    }
    return { list: roles.slice(0, 500), truncated: hasMore };
  };

  /** 按精确用户 ID 获取一页已生效绑定；无角色时返回空列表，绝不把待审批申请当生效角色。 */
  static fetchBindings = (userId, cursor = 0) => HGNet.get(HGMANAGER_API.IAM_BINDING_LIST, { userId, cursor, pageSize: 20 });

  /** 返回服务端角色权限目录和 selected；用于本绑定的权限子集，不能越过服务端委派校验。 */
  static fetchRolePermissions = (roleId) => HGNet.get(HGMANAGER_API.IAM_PERMISSION_LIST, { roleId });

  /** 字典包含停用及未接入资源校验的类型；授权页仅显示已启用且已接入服务端校验的类型。 */
  static fetchScopeTypes = () => HGNet.get(HGMANAGER_API.IAM_SCOPE_TYPE_LIST, { pageSize: 50, cursor: 0 });

  /** 查询已审核商家、已登记组织或新作用域 IAM 登记资源的有界候选页；ID 不按类型推断。 */
  static fetchScopeResources = (scopeType, cursor = "") =>
    HGNet.get(HGMANAGER_API.IAM_SCOPE_RESOURCE_LIST, { scopeType, cursor, pageSize: 50 });

  /** 所有绑定在同一事务和一次 MFA 中提交；每条绑定的 permissions 是角色当前权限的显式子集。 */
  static grantDirectBatch = ({ userId, bindings, mfaCode }) => HGNet.post(HGMANAGER_API.IAM_BINDING_GRANT_DIRECT_BATCH, {
    userId, bindings, mfaCode: mfaCode.trim(),
  });

  /** 即时授予需服务端专门权限、本人 MFA、禁止自授及权限委派校验，成功后立即生效。 */
  static grantDirect = ({ userId, roleId, scopeType, scopeId, mfaCode }) =>
    HGNet.post(HGMANAGER_API.IAM_BINDING_GRANT_DIRECT, {
      userId, roleId, scopeType, scopeId: scopeType === "global" ? "" : scopeId.trim(), mfaCode: mfaCode.trim(), expiresAt: null,
    });

  /** 按绑定主键精确撤销一条已生效绑定；操作者权限与目标归属由服务端复核。 */
  static revokeBinding = (userId, bindingId) => HGNet.post(HGMANAGER_API.IAM_BINDING_REVOKE, {
    userId: String(userId || "").trim(), bindingId: String(bindingId),
  });
}
