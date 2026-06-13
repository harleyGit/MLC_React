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
}
