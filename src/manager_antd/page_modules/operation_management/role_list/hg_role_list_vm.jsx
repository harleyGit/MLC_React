/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-07-05
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_list/hg_role_list_vm.jsx
 * @Description: 角色列表 ViewModel，封装列表分页接口和表格数据转换
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 角色列表每页条数。
 * 与后端 maxOpsPageSize=100 对齐，前端默认 20 条/页。
 */
export const ROLE_LIST_PAGE_SIZE = 20;

/**
 * 角色列表 ViewModel。
 * 职责：封装角色列表接口、分页 total 合成和数据转换。
 *
 * 千万级表约束：
 * - 使用 cursor 分页，避免 OFFSET 深分页扫描。
 * - 后端不返回实时 total，前端仅根据 hasMore 计算"至少 N 条"。
 * - 每次最多加载 pageSize 条数据，减少单次网络传输量。
 */
export default class HGRoleListVM {
  /**
   * 获取角色列表。
   * 接口：GET /api/v1/ops/roles/list?cursor=xxx&pageSize=xxx
   *
   * @param {Object} params 请求参数。
   * @param {number} params.cursor 角色列表 cursor，0 表示首页。
   * @param {number} params.pageSize 每页条数。
   * @returns {Promise<Object>} 角色列表响应，包含 list、nextCursor、hasMore。
   */
  static fetchRoleList = ({ cursor = 0, pageSize = ROLE_LIST_PAGE_SIZE } = {}) => {
    return HGNet.get(HGMANAGER_API.OPS_ROLE_LIST, { cursor, pageSize });
  };

  /**
   * 更新角色。
   * 接口：POST /api/v1/ops/roles/update
   *
   * @param {Object} params 请求参数。
   * @param {string} params.id 角色ID。
   * @param {string} params.name 角色名称。
   * @param {string} params.description 角色描述。
   * @returns {Promise<Object>} 更新后的角色信息。
   */
  static updateRole = ({ id, name, description } = {}) => {
    return HGNet.post(HGMANAGER_API.OPS_ROLE_UPDATE, { id, name, description });
  };

  /**
   * 删除角色。
   * 接口：POST /api/v1/ops/roles/delete
   *
   * @param {Object} params 请求参数。
   * @param {string} params.id 角色ID。
   * @returns {Promise<Object>} 删除结果。
   */
  static deleteRole = ({ id } = {}) => {
    return HGNet.post(HGMANAGER_API.OPS_ROLE_DELETE, { id });
  };

  /**
   * 标准化角色列表行，避免页面直接依赖后端空值细节。
   * @param {Array} roles 后端角色数组。
   * @returns {Array} 表格行数据。
   */
  static toRoleRows = (roles = []) => {
    return roles.map((role) => ({
      id: String(role.id || ""),
      name: role.name || "",
      description: role.description || "",
      createdAt: role.createdAt || "",
    }));
  };

  /**
   * 将后端大表 cursor 分页响应转换为表格需要的最小 total。
   * 大表约束：不执行 COUNT(*)，通过 hasMore 和当前页行数推算"至少 N 条"。
   *
   * @param {Object} params 分页上下文。
   * @param {number} params pageNum 当前页码。
   * @param {number} params.pageSize 每页条数。
   * @param {number} params.rowCount 当前页实际行数。
   * @param {boolean} params.hasMore 是否有下一页。
   * @returns {number} 前端分页组件使用的 total。
   */
  static buildCursorPaginationTotal = ({ pageNum, pageSize, rowCount, hasMore }) => {
    // 计算公式：(当前页码 - 1) * 每页条数 + 当前页行数 + (有下一页 ? 1 : 0)
    // 示例：第 1 页 20 条 hasMore=true，total = 0 + 20 + 1 = 21（表示至少有 21 条）
    return (pageNum - 1) * pageSize + rowCount + (hasMore ? 1 : 0);
  };
}
