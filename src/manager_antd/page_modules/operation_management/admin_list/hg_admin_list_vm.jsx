/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_list/hg_admin_list_vm.jsx
 * @Description: 管理员列表 ViewModel，封装列表分页、搜索接口和表格数据转换
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

export const ADMIN_LIST_PAGE_SIZE = 20;
const HG_ROLE_PAGE_SIZE = 100; // 单页角色上限；最多读取五页，避免弹窗无界扫描角色目录。

/**
 * 管理员列表 ViewModel。
 * 职责：封装管理员列表/搜索接口、分页 total 合成和状态文本转换。
 */
export default class HGAdminListVM {
  /**
   * 获取管理员列表。
   * @param {Object} params 请求参数。
   * @param {number} params.cursor 管理员列表 cursor，0 表示首页。
   * @param {number} params.pageSize 每页条数。
   * @returns {Promise<Object>} 管理员列表响应。
   */
  static fetchAdminList = ({ cursor = 0, pageSize = ADMIN_LIST_PAGE_SIZE } = {}) => {
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_LIST, { cursor, pageSize });
  };

  /**
   * 搜索管理员。
   * @param {string} keyword 管理员 ID、姓名、昵称、邮箱或手机号前缀。
   * @returns {Promise<Object>} 管理员搜索响应。
   */
  static searchAdmins = (keyword) => {
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_SEARCH, { keyword, limit: ADMIN_LIST_PAGE_SIZE });
  };

  /** 按精确管理员业务 ID 读取一页有效绑定；续页游标保持服务端字符串精度。 */
  static fetchBindings = (userId, cursor = "0") =>
    HGNet.get(HGMANAGER_API.IAM_BINDING_LIST, { userId, cursor, pageSize: ADMIN_LIST_PAGE_SIZE });

  /** 按精确业务用户 ID 读取一页未过期的待审批授权；申请未批准前不是活动绑定。 */
  static fetchPendingGrants = (userId, cursor = "0") =>
    HGNet.get(HGMANAGER_API.IAM_BINDING_PENDING, { userId, cursor, pageSize: ADMIN_LIST_PAGE_SIZE });

  /** 原目标用户授权办理：一次 MFA 裁决待审批申请，编号不是活动绑定 ID。 */
  static decideApproval = (approvalId, mfaCode, approve) =>
    HGNet.post(approve ? HGMANAGER_API.IAM_APPROVAL_APPROVE : HGMANAGER_API.IAM_APPROVAL_REJECT, {
      id: String(approvalId), mfaCode,
    });

  /** 精确撤销当前管理员的一条活动绑定，不能用待审批申请编号调用。 */
  static revokeBinding = (userId, bindingId) =>
    HGNet.post(HGMANAGER_API.IAM_BINDING_REVOKE, { userId, bindingId: String(bindingId) });

  /** 仅为当前页绑定查找角色名称；未读到的角色由页面明确展示编码，不冒充名称。 */
  static fetchRoleNames = async (roleIds) => {
    const missing = new Set(roleIds.map(String)); // 当前页尚未匹配的角色 ID，空集合不访问目录。
    const names = {}; // 已匹配角色 ID -> 名称；缺失表示当前目录页未查到该角色。
    let cursor = "0"; // 首次从角色列表首页读取，续页始终沿用服务端字符串。
    for (let page = 0; page < 5 && missing.size; page += 1) {
      const result = await HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: HG_ROLE_PAGE_SIZE });
      if (!Array.isArray(result?.list)) throw new Error("角色目录响应无效");
      result.list.forEach((role) => {
        if (missing.has(String(role.id))) {
          names[String(role.id)] = role.name || "";
          missing.delete(String(role.id));
        }
      });
      if (!result.hasMore) break;
      if (!result.nextCursor || String(result.nextCursor) === cursor || result.list.length === 0) {
        throw new Error("角色目录游标无效");
      }
      cursor = String(result.nextCursor);
    }
    return names;
  };

  /** 最多四个并行请求读取角色权限目录；不能将角色结果当作受限绑定的实际权限子集。 */
  static fetchRolePermissions = async (roleIds) => {
    const ids = [...new Set(roleIds.map(String))]; // 去重角色 ID，防止多个作用域重复请求。
    const permissions = {}; // 角色 ID -> { list, selected, error }；目录与已选编码分开保留。
    let next = 0; // worker 下一项索引；每页至多 20 个不同角色。
    const worker = async () => {
      while (next < ids.length) {
        const roleId = ids[next++];
        try {
          const result = await HGNet.get(HGMANAGER_API.IAM_PERMISSION_LIST, { roleId });
          if (!Array.isArray(result?.list) || !Array.isArray(result?.selected)) throw new Error("角色权限响应无效");
          permissions[roleId] = { list: result.list, selected: result.selected, error: "" };
        } catch {
          permissions[roleId] = { list: [], selected: [], error: "业务权限加载失败，请重试" };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, () => worker()));
    return permissions;
  };

  /**
   * 标准化管理员列表行，避免页面直接依赖后端空值细节。
   * @param {Array} admins 后端管理员数组。
   * @returns {Array} 表格行数据。
   */
  static toAdminRows = (admins = []) => {
    return admins.map((admin) => ({
      id: String(admin.id || ""),
      name: admin.name || "",
      nickName: admin.nickName || "",
      email: admin.email || "",
      mobile: admin.mobile || "",
      status: admin.status,
      raw: admin,
    }));
  };

  /**
   * 将后端大表 cursor 分页响应转换为表格需要的最小 total。
   * @param {Object} params 分页上下文。
   * @returns {number} 前端分页组件使用的 total。
   */
  static buildCursorPaginationTotal = ({ pageNum, pageSize, rowCount, hasMore }) => {
    return (pageNum - 1) * pageSize + rowCount + (hasMore ? 1 : 0);
  };

  /**
   * 渲染管理员状态文案。
   * @param {number} status 管理员状态值。
   * @returns {string} 状态展示文本。
   */
  static getStatusText = (status) => {
    if (Number(status) === 1) return "启用";
    if (Number(status) === 0 || Number(status) === -1) return "禁用";
    return "-";
  };

  /**
   * 将管理员状态映射为状态标签色调。
   * @param {number} status 管理员状态值。
   * @returns {string} HGStatusTag 支持的 tone 值。
   */
  static getStatusTone = (status) => {
    if (Number(status) === 1) return "success";
    if (Number(status) === 0 || Number(status) === -1) return "error";
    return "neutral";
  };

  /**
   * 统计当前页指定状态的管理员数量，用于顶部指标卡。
   * 说明：仅统计已加载的当前页数据，不代表全量规模，避免额外 COUNT(*) 查询。
   * @param {Array} rows 当前页管理员行数据。
   * @param {number} status 目标状态值。
   * @returns {number} 匹配条数。
   */
  static countByStatus = (rows = [], status) => {
    return rows.filter((row) => Number(row.status) === Number(status)).length;
  };
}
