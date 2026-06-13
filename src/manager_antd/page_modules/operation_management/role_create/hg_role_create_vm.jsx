/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_create/hg_role_create_vm.jsx
 * @Description: 创建角色 ViewModel，封装表单校验、数据转换与接口提交
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 创建角色表单初始值。
 * 职责：保持新增表单字段默认值一致，避免页面内散落字段名。
 */
export const INITIAL_ROLE_CREATE_FORM_VALUES = {
  name: "",
  description: "",
};

/**
 * 创建角色 ViewModel。
 * 职责：封装角色创建页的校验规则、提交数据清洗和 API 调用。
 */
export default class HGRoleCreateVM {
  /**
   * 获取创建角色表单校验规则。
   * @returns {Object} 表单字段 rules 配置
   */
  static getFormRules = () => ({
    name: [
      { required: true, message: "请输入角色名称" },
      { min: 2, message: "角色名称至少 2 个字符" },
      { max: 64, message: "角色名称最多 64 个字符" },
    ],
    description: [{ max: 255, message: "角色描述最多 255 个字符" }],
  });

  /**
   * 转换创建角色提交数据。
   * @param {Object} values 表单原始字段值
   * @returns {{name: string, description: string}} 后端 CreateRole 请求体
   */
  static transformSubmitData = (values) => ({
    name: String(values.name || "").trim(),
    description: String(values.description || "").trim(),
  });

  /**
   * 提交创建角色请求。
   * @param {{name: string, description: string}} data 后端 CreateRole 请求体
   * @returns {Promise<Object>} 后端响应 result
   */
  static submitRole = (data) => {
    return HGNet.post(HGMANAGER_API.OPS_ROLE_CREATE, data);
  };
}
