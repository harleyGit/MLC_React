/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_permission/hg_role_permission_vm.jsx
 * @Description: 角色权限分配 ViewModel，管理角色列表、权限树数据与提交逻辑
 */

/**
 * 模拟角色列表数据
 * 职责：为 Select 提供可选角色
 * 约束：实际项目应从接口获取
 */
export const MOCK_ROLE_LIST = [
  { label: "超级管理员", value: "role_super_admin" },
  { label: "系统管理员", value: "role_system_admin" },
  { label: "系统运维", value: "role_system_ops" },
  { label: "内容编辑", value: "role_content_editor" },
  { label: "内容审核", value: "role_content_reviewer" },
  { label: "运营主管", value: "role_operation_manager" },
  { label: "运营专员", value: "role_operation_staff" },
];

/**
 * 模拟权限树形数据
 * 职责：为 TreeSelect 提供可勾选的权限节点
 * 约束：实际项目应从接口获取，此处为本地 mock
 */
export const MOCK_PERMISSION_TREE = [
  {
    title: "系统管理",
    value: "perm_system",
    children: [
      {
        title: "用户管理",
        value: "perm_system_user",
        children: [
          { title: "用户列表", value: "perm_system_user_list" },
          { title: "用户新增", value: "perm_system_user_add" },
          { title: "用户编辑", value: "perm_system_user_edit" },
          { title: "用户删除", value: "perm_system_user_delete" },
        ],
      },
      {
        title: "角色管理",
        value: "perm_system_role",
        children: [
          { title: "角色列表", value: "perm_system_role_list" },
          { title: "角色新增", value: "perm_system_role_add" },
          { title: "角色编辑", value: "perm_system_role_edit" },
          { title: "角色删除", value: "perm_system_role_delete" },
        ],
      },
      {
        title: "权限管理",
        value: "perm_system_permission",
        children: [
          { title: "权限列表", value: "perm_system_permission_list" },
          { title: "菜单权限", value: "perm_system_permission_menu" },
          { title: "权限分配", value: "perm_system_permission_assign" },
        ],
      },
    ],
  },
  {
    title: "内容管理",
    value: "perm_content",
    children: [
      {
        title: "课程管理",
        value: "perm_content_course",
        children: [
          { title: "课程列表", value: "perm_content_course_list" },
          { title: "课程新增", value: "perm_content_course_add" },
          { title: "课时管理", value: "perm_content_course_lesson" },
        ],
      },
      {
        title: "文章管理",
        value: "perm_content_article",
        children: [
          { title: "文章列表", value: "perm_content_article_list" },
          { title: "文章发布", value: "perm_content_article_publish" },
        ],
      },
    ],
  },
  {
    title: "运营管理",
    value: "perm_operation",
    children: [
      {
        title: "订单管理",
        value: "perm_operation_order",
        children: [
          { title: "订单列表", value: "perm_operation_order_list" },
          { title: "订单详情", value: "perm_operation_order_detail" },
          { title: "订单退款", value: "perm_operation_order_refund" },
        ],
      },
      {
        title: "短信管理",
        value: "perm_operation_sms",
        children: [
          { title: "模板管理", value: "perm_operation_sms_template" },
          { title: "发送记录", value: "perm_operation_sms_log" },
        ],
      },
    ],
  },
];

/**
 * 表单初始值
 */
export const INITIAL_FORM_VALUES = {
  role_id: undefined,
  permission_ids: [],
};

/**
 * 角色权限 ViewModel 类
 * 职责：封装表单校验规则、提交处理、数据转换
 */
export default class HGRolePermissionVM {
  /**
   * 获取表单校验规则
   * @returns {Object} antd Form rules 配置
   */
  static getFormRules = () => {
    return {
      role_id: [{ required: true, message: "请选择角色" }],
      permission_ids: [
        { type: "array", min: 1, required: true, message: "请至少勾选一项权限" },
      ],
    };
  };

  /**
   * 处理表单提交：转换数据格式
   * @param {Object} values 表单原始值
   * @returns {Object} 提交到后端的数据结构
   */
  static transformSubmitData = (values) => {
    return {
      role_id: values.role_id,
      permission_id: values.permission_ids || [],
    };
  };

  /**
   * 模拟提交接口
   * @param {Object} data 提交数据
   * @returns {Promise} 模拟接口返回
   */
  static submitRolePermission = (data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, message: "权限分配成功", data });
      }, 500);
    });
  };

  /**
   * 模拟根据角色获取已分配权限（用于编辑回填）
   * @param {string} roleId 角色 ID
   * @returns {Promise<Array>} 已分配权限 ID 列表
   */
  static fetchRolePermissions = (roleId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockMap = {
          role_super_admin: ["perm_system", "perm_content", "perm_operation"],
          role_system_admin: ["perm_system_user_list", "perm_system_role_list", "perm_system_permission_list"],
          role_content_editor: ["perm_content_course_list", "perm_content_article_list", "perm_content_article_publish"],
        };
        resolve(mockMap[roleId] || []);
      }, 300);
    });
  };
}
