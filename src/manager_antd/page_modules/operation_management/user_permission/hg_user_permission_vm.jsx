/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-07-05
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/user_permission/hg_user_permission_vm.jsx
 * @Description: 用户权限管理 ViewModel，封装管理员列表、角色分配接口和数据转换
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 用户权限管理每页条数。
 * 千万级表约束：与后端 maxOpsPageSize=100 对齐，前端默认 20 条/页。
 */
export const USER_PERMISSION_PAGE_SIZE = 20;

/**
 * 角色选项最大加载数量。
 * 千万级表约束：避免一次加载过多角色导致前端卡顿。
 */
export const MAX_ROLE_OPTIONS = 500;

/**
 * 用户权限管理 ViewModel。
 * 职责：封装管理员列表接口、角色分配接口、数据转换。
 *
 * 千万级表约束：
 * - 管理员列表使用 cursor 分页，避免 OFFSET 深分页扫描。
 * - 后端不返回实时 total，前端仅根据 hasMore 计算"至少 N 条"。
 * - 旧 ops 批量授权已停用，角色选项必须来自 IAM，不得混用旧角色 ID。
 */
export default class HGUserPermissionVM {
  /**
   * 获取管理员列表。
   * 接口：GET /api/v1/ops/admins/list?cursor=xxx&pageSize=xxx
   *
   * @param {Object} params 请求参数。
   * @param {number} params.cursor 管理员列表 cursor，0 表示首页。
   * @param {number} params.pageSize 每页条数。
   * @returns {Promise<Object>} 管理员列表响应，包含 list、nextCursor、hasMore。
   */
  static fetchAdminList = ({ cursor = 0, pageSize = USER_PERMISSION_PAGE_SIZE } = {}) => {
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_LIST, { cursor, pageSize });
  };

  /**
   * 搜索管理员。
   * 接口：GET /api/v1/ops/users/search?keyword=xxx&limit=xxx
   *
   * @param {string} keyword 管理员 ID、姓名、昵称、邮箱或手机号前缀。
   * @param {number} limit 返回条数上限。
   * @returns {Promise<Object>} 管理员搜索响应。
   */
  static searchAdmins = (keyword, limit = USER_PERMISSION_PAGE_SIZE) => {
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_SEARCH, { keyword, limit });
  };

  /**
   * 拒绝从已停用的旧视图回填角色。
   * 旧 ops 用户角色视图已返回 410，不能用它回填 IAM 角色 ID。
   *
   * @param {string} userId 管理员 ID。
   * @returns {Promise<never>} 始终拒绝，直到页面改用 IAM 绑定查询。
   */
  static fetchUserRoles = (userId) => {
    void userId;
    return Promise.reject(new Error("旧角色视图已停用，请使用 IAM 精确绑定查询"));
  };

  /**
   * 获取所有角色列表（用于复选框选项）。
   * 千万级表约束：最多加载 MAX_ROLE_OPTIONS 个角色，避免前端渲染过多复选框。
   *
   * @returns {Promise<Object>} 角色列表响应，包含 list 和 truncated 标记。
   */
  static fetchAllRoleOptions = async () => {
    const pageSize = 100;
    let cursor = 0;
    let hasMore = true;
    const roles = [];

    while (hasMore && roles.length < MAX_ROLE_OPTIONS) {
      const res = await HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize });
      if (!Array.isArray(res?.list) || typeof res?.hasMore !== "boolean" || (res.hasMore && !res.nextCursor)) {
        throw new Error("IAM 角色列表格式无效");
      }
      const list = res.list;
      roles.push(...list);
      hasMore = Boolean(res?.hasMore) && Boolean(res?.nextCursor);
      cursor = res?.nextCursor || 0;
      if (list.length === 0) break;
    }

    return {
      list: roles.slice(0, MAX_ROLE_OPTIONS),
      truncated: hasMore,
    };
  };

  /**
   * 拒绝调用已停用的旧批量授权接口。
   * 旧 ops 批量写接口返回 410；不能将 IAM 角色 ID 发给旧授权表。
   *
   * @param {string} userId 管理员 ID。
   * @param {Array<string>} roleIds 角色 ID 数组。
   * @returns {Promise<never>} 始终拒绝，防止将 IAM 角色 ID 写入旧权限表。
   */
  static assignUserRoles = (userId, roleIds) => {
    void userId;
    void roleIds;
    return Promise.reject(new Error("旧批量授权已停用，请使用 IAM 员工角色授权流程"));
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
    }));
  };

  /**
   * 将后端角色数组转换为复选框选项。
   * @param {Array} roles 后端角色数组。
   * @returns {Array} 复选框选项数组。
   */
  static toRoleCheckboxOptions = (roles = []) => {
    return roles.map((role) => ({
      label: role.name || `角色 ${role.id}`,
      value: String(role.id),
    }));
  };

  /**
   * 将后端大表 cursor 分页响应转换为表格需要的最小 total。
   * 大表约束：不执行 COUNT(*)，通过 hasMore 和当前页行数推算"至少 N 条"。
   *
   * @param {Object} params 分页上下文。
   * @param {number} params.pageNum 当前页码。
   * @param {number} params.pageSize 每页条数。
   * @param {number} params.rowCount 当前页实际行数。
   * @param {boolean} params.hasMore 是否有下一页。
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
   * 将用户状态映射为状态标签色调。
   * @param {number} status 用户状态值。
   * @returns {string} HGStatusTag 支持的 tone 值。
   */
  static getStatusTone = (status) => {
    if (Number(status) === 1) return "success";
    if (Number(status) === 0 || Number(status) === -1) return "error";
    return "neutral";
  };

  /**
   * 统计当前页指定状态的用户数量，用于顶部指标卡。
   * 说明：仅统计已加载的当前页数据，避免额外 COUNT(*) 查询。
   * @param {Array} rows 当前页用户行数据。
   * @param {number} status 目标状态值。
   * @returns {number} 匹配条数。
   */
  static countByStatus = (rows = [], status) => {
    return rows.filter((row) => Number(row.status) === Number(status)).length;
  };
}
