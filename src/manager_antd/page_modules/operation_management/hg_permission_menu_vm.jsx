/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_permission_menu_vm.jsx
 * @Description: 菜单权限页面 ViewModel，管理表单数据、校验与提交逻辑
 */

/**
 * 权限类型常量
 * 约束：type=1 菜单权限，type=2 操作权限
 */
export const PERMISSION_TYPE = {
  MENU: 1,
  OPERATION: 2,
};

/**
 * 权限类型选项列表，用于 Radio/Select 渲染
 */
export const PERMISSION_TYPE_OPTIONS = [
  { label: "菜单", value: PERMISSION_TYPE.MENU },
  { label: "操作", value: PERMISSION_TYPE.OPERATION },
];

/**
 * 状态常量
 * 约束：status=1 启用，status=0 禁用
 */
export const STATUS_VALUE = {
  ENABLED: 1,
  DISABLED: 0,
};

/**
 * 模拟上级菜单树形数据
 * 职责：为 TreeSelect 提供可选父级节点
 * 约束：实际项目应从接口获取，此处为本地 mock
 */
export const MOCK_PARENT_TREE = [
  {
    title: "系统管理",
    value: "system",
    children: [
      { title: "用户管理", value: "system_user" },
      { title: "角色管理", value: "system_role" },
      { title: "权限管理", value: "system_permission" },
    ],
  },
  {
    title: "内容管理",
    value: "content",
    children: [
      { title: "文章管理", value: "content_article" },
      { title: "视频管理", value: "content_video" },
    ],
  },
  {
    title: "运营管理",
    value: "operation",
    children: [
      { title: "活动管理", value: "operation_activity" },
    ],
  },
];

/**
 * 表单初始值
 * 职责：新增时的默认字段值
 */
export const INITIAL_FORM_VALUES = {
  code: "",
  type: PERMISSION_TYPE.MENU,
  name: "",
  page_path: "",
  parent_id: undefined,
  status: STATUS_VALUE.ENABLED,
  sort: 0,
  desc: "",
};

/**
 * 菜单权限 ViewModel 类
 * 职责：封装表单校验规则、提交处理、数据转换
 * 约束：不直接操作 UI，仅提供数据与逻辑
 */
export default class HGPermissionMenuVM {
  /**
   * 获取表单校验规则
   * @returns {Object} antd Form rules 配置
   */
  static getFormRules = () => {
    return {
      code: [
        { required: true, message: "请输入权限编码" },
        { max: 64, message: "权限编码不超过64个字符" },
      ],
      type: [{ required: true, message: "请选择权限类型" }],
      name: [
        { required: true, message: "请输入权限名称" },
        { max: 50, message: "权限名称不超过50个字符" },
      ],
      page_path: [{ max: 200, message: "页面路径不超过200个字符" }],
      sort: [{ type: "number", min: 0, message: "排序值不能小于0" }],
      desc: [{ max: 500, message: "描述备注不超过500个字符" }],
    };
  };

  /**
   * 处理表单提交：校验通过后转换数据
   * @param {Object} values 表单原始值
   * @returns {Object} 提交到后端的数据结构
   * 约束：status 转为布尔值提交时需根据后端协议调整
   */
  static transformSubmitData = (values) => {
    return {
      ...values,
      status: values.status ? STATUS_VALUE.ENABLED : STATUS_VALUE.DISABLED,
      sort: Number(values.sort) || 0,
    };
  };

  /**
   * 模拟提交接口
   * @param {Object} data 提交数据
   * @returns {Promise} 模拟接口返回
   * 约束：实际项目替换为真实接口调用
   */
  static submitPermission = (data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, message: "提交成功", data });
      }, 500);
    });
  };
}
