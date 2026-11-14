/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_add/hg_admin_add_vm.jsx
 * @Description: 添加管理员 ViewModel，封装候选用户搜索、选择和添加管理员接口调用
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 添加管理员 ViewModel。
 * 职责：封装搜索候选用户、格式化列表数据和确认添加接口。
 */
export default class HGAdminAddVM {
  /**
   * 搜索可添加为管理员的注册用户候选。
   * @param {string} keyword 搜索关键词；空字符串表示按游标浏览可添加用户。
   * @param {string} cursor 空关键词的续页 users.id；空字符串表示第一页。
   * @returns {Promise<Object>} 候选用户列表响应
   */
  static searchAdminCandidates = (keyword, cursor = "") => {
    const params = { limit: 10 }; // 每页最多 10 条；后端另行限制最大页大小。
    if (keyword) params.keyword = keyword;
    if (!keyword && cursor) params.cursor = cursor;
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_CANDIDATES, params);
  };

  /**
   * 将后端候选用户转换为页面列表行。
   * @param {Array} candidates 后端候选用户数组
   * @returns {Array} 页面候选列表
   */
  static toCandidateRows = (candidates = []) => {
    return candidates.map((item) => ({
      id: String(item.id || ""),
      userId: item.userId || "-",
      userName: item.userName || "-",
      nickName: item.nickName || "-",
      email: item.email || "-",
      phone: item.phone || "-",
      raw: item,
    }));
  };

  /**
   * 确认添加管理员。
   * @param {string} userId 候选用户 users.id
   * @returns {Promise<Object>} 添加结果
   */
  static addAdmin = (userId) => {
    return HGNet.post(HGMANAGER_API.OPS_ADMIN_ADD, { userId });
  };
}
