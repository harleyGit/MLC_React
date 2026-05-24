/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/employee_role/hg_employee_role_vm.jsx
 * @Description: 员工角色管理 ViewModel，封装表单校验、mock 角色树、提交逻辑
 */

/**
 * 性别常量
 */
export const GENDER = {
  MALE: 1,
  FEMALE: 2,
  SECRET: 0,
};

/**
 * 性别选项列表，用于 Radio 渲染
 */
export const GENDER_OPTIONS = [
  { label: "男", value: GENDER.MALE },
  { label: "女", value: GENDER.FEMALE },
  { label: "保密", value: GENDER.SECRET },
];

/**
 * 账号状态常量
 * 约束：status=true 启用，status=false 禁用
 */
export const ACCOUNT_STATUS = {
  ENABLED: true,
  DISABLED: false,
};

/**
 * 模拟角色树形数据
 * 职责：为 TreeSelect 提供可选角色节点（支持多选）
 * 约束：实际项目应从接口获取，此处为本地 mock
 */
export const MOCK_ROLE_TREE = [
  {
    title: "超级管理员",
    value: "role_super_admin",
  },
  {
    title: "系统管理",
    value: "role_system",
    children: [
      { title: "系统管理员", value: "role_system_admin" },
      { title: "系统运维", value: "role_system_ops" },
    ],
  },
  {
    title: "内容管理",
    value: "role_content",
    children: [
      { title: "内容编辑", value: "role_content_editor" },
      { title: "内容审核", value: "role_content_reviewer" },
    ],
  },
  {
    title: "运营管理",
    value: "role_operation",
    children: [
      { title: "运营主管", value: "role_operation_manager" },
      { title: "运营专员", value: "role_operation_staff" },
    ],
  },
];

/**
 * 表单初始值
 * 职责：新增时的默认字段值
 */
export const INITIAL_FORM_VALUES = {
  name: "",
  nickname: "",
  phone: "",
  password: "",
  gender: GENDER.SECRET,
  status: ACCOUNT_STATUS.ENABLED,
  roles: [],
};

/**
 * 手机号正则校验
 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 员工角色 ViewModel 类
 * 职责：封装表单校验规则、提交处理、数据转换
 * 约束：不直接操作 UI，仅提供数据与逻辑
 */
export default class HGEmployeeRoleVM {
  /**
   * 获取表单校验规则
   * @param {boolean} isEdit 是否为编辑模式（编辑模式下密码非必填）
   * @returns {Object} antd Form rules 配置
   */
  static getFormRules = (isEdit = false) => {
    return {
      name: [
        { required: true, message: "请输入姓名" },
        { max: 30, message: "姓名不超过30个字符" },
      ],
      nickname: [{ max: 30, message: "昵称不超过30个字符" }],
      phone: [
        { required: true, message: "请输入手机号" },
        { pattern: PHONE_REGEX, message: "请输入正确的手机号格式" },
      ],
      password: isEdit
        ? [{ max: 64, message: "密码不超过64个字符" }]
        : [
            { required: true, message: "请输入密码" },
            { min: 6, message: "密码至少6个字符" },
            { max: 64, message: "密码不超过64个字符" },
          ],
      gender: [{ required: true, message: "请选择性别" }],
      roles: [
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
      name: values.name,
      nickname: values.nickname || "",
      phone: values.phone,
      password: values.password || "",
      gender: values.gender,
      status: values.status,
      roles: values.roles || [],
    };
  };

  /**
   * 模拟提交接口
   * @param {Object} data 提交数据
   * @returns {Promise} 模拟接口返回
   * 约束：实际项目替换为真实接口调用
   */
  static submitEmployeeRole = (data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, message: "提交成功", data });
      }, 500);
    });
  };

  /**
   * 模拟手机号唯一性校验
   * @param {string} phone 手机号
   * @returns {Promise<boolean>} 是否唯一
   * 约束：实际项目替换为真实接口校验
   */
  static checkPhoneUnique = (phone) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockExistPhones = ["13800000001", "13800000002"];
        resolve(!mockExistPhones.includes(phone));
      }, 300);
    });
  };
}
