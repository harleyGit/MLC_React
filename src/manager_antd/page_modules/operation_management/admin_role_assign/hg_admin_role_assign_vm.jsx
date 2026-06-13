/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13 20:07:14
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_role_assign/hg_admin_role_assign_vm.jsx
 * @Description: 管理员角色分配 ViewModel，管理管理员列表、角色列表、表单校验与提交逻辑
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 模拟管理员列表数据
 * 职责：为管理员下拉框提供可选项
 * 约束：实际项目应从接口获取，此处为本地 mock
 */
export const MOCK_ADMIN_LIST = [
  { label: "张三 (admin001)", value: "admin_001" },
  { label: "李四 (admin002)", value: "admin_002" },
  { label: "王五 (admin003)", value: "admin_003" },
  { label: "赵六 (admin004)", value: "admin_004" },
  { label: "孙七 (admin005)", value: "admin_005" },
];

/**
 * 模拟角色列表数据
 * 职责：为角色复选框组提供可选项
 * 约束：实际项目应从接口获取，此处为本地 mock
 */
export const MOCK_ROLE_OPTIONS = [
  { label: "超级管理员", value: "role_super_admin" },
  { label: "系统管理员", value: "role_system_admin" },
  { label: "系统运维", value: "role_system_ops" },
  { label: "内容编辑", value: "role_content_editor" },
  { label: "内容审核", value: "role_content_reviewer" },
  { label: "运营主管", value: "role_operation_manager" },
  { label: "运营专员", value: "role_operation_staff" },
];

/**
 * 表单初始值
 * 职责：新增时的默认字段值
 */
export const INITIAL_FORM_VALUES = {
  admin_user_id: undefined,
  role_ids: [],
};

/**
 * 管理员角色分配 ViewModel 类
 * 职责：封装表单校验规则、提交处理、数据转换
 * 约束：不直接操作 UI，仅提供数据与逻辑
 */
export default class HGAdminRoleAssignVM {
  /**
   * 获取表单校验规则
   * @returns {Object} 表单 rules 配置
   */
  static getFormRules = () => {
    return {
      admin_user_id: [{ required: true, message: "请选择管理员" }],
      role_ids: [
        { required: true, message: "请至少选择一个角色" },
        { type: "array", min: 1, message: "请至少选择一个角色" },
      ],
    };
  };

  /**
   * 处理表单提交：校验通过后转换数据
   * @param {Object} values 表单原始值
   * @returns {Object} 提交到后端的数据结构
   */
  static transformSubmitData = (values) => {
    return {
      admin_user_id: values.admin_user_id,
      role_ids: values.role_ids || [],
    };
  };

  static toRoleOptions = (roles = []) => {
    return roles.map((role) => ({
      label: role.name || `角色 ${role.id}`,
      value: String(role.id),
    }));
  };

  static toAdminOptions = (admins = []) => {
    return admins.map((admin) => ({
      label: `${admin.name || admin.nickName || "未命名"} (ID:${admin.id}${
        admin.mobile ? ` / ${admin.mobile}` : ""
      })`,
      value: String(admin.id),
      raw: admin,
    }));
  };

  static fetchRoleList = ({ cursor = 0, pageSize = 100 } = {}) => {
    // 后端 /roles/list 已改为 cursor 分页：cursor=0 表示首页，后续页使用响应里的 nextCursor。
    // 不再传 page，避免前端继续表达 OFFSET 分页语义，和 Go 侧大表优化策略保持一致。
    return HGNet.get(HGMANAGER_API.OPS_ROLE_LIST, { cursor, pageSize });
  };

  static fetchAllRoleList = async () => {
    // 角色分配页需要一次性渲染复选框，因此这里按 cursor 分页聚合一批可分配角色。
    // 为避免角色表很大时前端无界拉取和渲染，最多加载 maxRoleCount 个角色；超出时由页面给出提示。
    const pageSize = 100;
    const maxRoleCount = 500;
    let cursor = 0;
    let hasMore = true;
    const roles = [];

    while (hasMore && roles.length < maxRoleCount) {
      const res = await HGAdminRoleAssignVM.fetchRoleList({ cursor, pageSize });
      const list = res?.list || [];
      roles.push(...list);
      // hasMore 和 nextCursor 都存在时才继续翻页，防止后端异常返回导致死循环。
      hasMore = Boolean(res?.hasMore) && Boolean(res?.nextCursor);
      cursor = res?.nextCursor || 0;
      if (list.length === 0) break;
    }

    return {
      list: roles.slice(0, maxRoleCount),
      truncated: hasMore,
    };
  };

  static searchAdminUsers = (keyword) => {
    return HGNet.get(HGMANAGER_API.OPS_ADMIN_SEARCH, { keyword, limit: 10 });
  };

  static fetchUserRoles = (userId) => {
    return HGNet.get(HGMANAGER_API.OPS_USER_ROLE_LIST, { userId });
  };

  static submitAdminRole = (data) => {
    return HGNet.post(HGMANAGER_API.OPS_USER_ROLES, {
      userId: data.admin_user_id,
      roleIds: data.role_ids || [],
    });
  };
}
