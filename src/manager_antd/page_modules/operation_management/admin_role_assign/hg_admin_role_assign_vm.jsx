/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_role_assign/hg_admin_role_assign_vm.jsx
 * @Description: 管理员角色分配 ViewModel，管理管理员列表、角色列表、表单校验与提交逻辑
 */

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
      admin_user_id: [
        { required: true, message: "请选择管理员" },
      ],
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

  /**
   * 模拟提交接口
   * @param {Object} data 提交数据
   * @returns {Promise} 模拟接口返回
   * 约束：实际项目替换为真实接口调用
   */
  static submitAdminRole = (data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, message: "角色分配成功", data });
      }, 500);
    });
  };
}
