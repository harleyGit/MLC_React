/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_create/hg_role_create_vm.jsx
 * @Description: 角色表单 ViewModel，封装创建/编辑校验、数据转换与接口提交
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
import { hgSelectNotificationTemplatePermissions } from "./hg_role_permission_presets.js";

/**
 * 创建角色表单初始值。
 * 职责：保持新增表单字段默认值一致，避免页面内散落字段名。
 */
export const INITIAL_ROLE_CREATE_FORM_VALUES = {
  code: "",
  name: "",
  description: "",
  permissions: [],
};

/**
 * 创建角色 ViewModel。
 * 职责：封装角色创建页的校验规则、提交数据清洗和 API 调用。
 */
export default class HGRoleCreateVM {
  /** 使用服务端权限目录预选通知模板能力，缺项时拒绝而不提交不完整的授权草稿。 */
  static selectNotificationTemplatePermissions = hgSelectNotificationTemplatePermissions;
  /**
   * 获取创建角色表单校验规则。
   * @returns {Object} 表单字段 rules 配置
   */
  static getFormRules = () => ({
    code: [
      { required: true, message: "请输入角色编码" },
      { pattern: /^[a-z][a-z0-9_]{1,63}$/, message: "角色编码需为 2-64 位小写字母、数字或下划线，且以字母开头" },
    ],
    name: [
      { required: true, message: "请输入角色名称" },
      { min: 2, message: "角色名称至少 2 个字符" },
      { max: 64, message: "角色名称最多 64 个字符" },
    ],
    description: [{ max: 255, message: "角色描述最多 255 个字符" }],
    permissions: [{ type: "array", max: 50, message: "权限最多 50 项" }],
    mfaCode: [{ pattern: /^\d{6}$/, message: "请输入 6 位 MFA 验证码" }],
  });

  /** 从 IAM 权限目录加载角色可选权限；编辑时同时返回指定角色的已选权限。 */
  static fetchPermissions = (roleId) =>
    HGNet.get(
      HGMANAGER_API.IAM_PERMISSION_LIST,
      roleId ? { roleId } : undefined
    );

  /**
   * 转换创建角色提交数据。
   * @param {Object} values 表单原始字段值
   * @returns {{code: string, name: string, description: string, permissions: string[]}} 后端 CreateRole 请求体
   */
  static transformSubmitData = (values) => ({
    code: String(values.code || "").trim(),
    name: String(values.name || "").trim(),
    description: String(values.description || "").trim(),
    permissions: Array.isArray(values.permissions) ? values.permissions : [],
    mfaCode: String(values.mfaCode || "").trim(),
  });

  /**
   * 提交创建角色请求。
   * @param {{name: string, description: string}} data 后端 CreateRole 请求体
   * @returns {Promise<Object>} 后端响应 result
   */
  static submitRole = async (data) => {
    if (data.permissions.length > 0 && !/^\d{6}$/.test(data.mfaCode)) throw new Error("选择权限时请输入 6 位 MFA 验证码");
    const role = await HGNet.post(HGMANAGER_API.IAM_ROLE_CREATE, { code: data.code, name: data.name, description: data.description, permissions: [] });
    if (!data.permissions.length) return role;
    try {
      const approval = await HGNet.post(HGMANAGER_API.IAM_ROLE_PERMISSIONS, { roleId: role.id, permissions: data.permissions, mfaCode: data.mfaCode });
      return { ...role, approvalId: approval?.approvalId };
    } catch (error) {
      throw new Error(`角色 ${role.code} 已创建，但权限审批申请失败：${error?.message || "请在角色列表重试"}`);
    }
  };

  /** 比较权限快照时忽略顺序和重复项，避免仅树控件排序变化就发起审批。 */
  static permissionsChanged = (before = [], after = []) => {
    const normalize = (values) =>
      [...new Set(values.map((value) => String(value)))].sort();
    return JSON.stringify(normalize(before)) !== JSON.stringify(normalize(after));
  };

  /**
   * 提交角色编辑：仅在基础信息变更时更新；权限变化另行申请 MFA 双人审批。
   * 内置运维角色只能变更权限，其他内置角色不可通过此入口变更。
   * @param {{id: string, name: string, description: string, permissions: string[], mfaCode: string}} data 编辑表单数据。
   * @param {string[]} initialPermissions 页面加载时的权限快照。
   * @param {{id: string, code: string, name: string, description: string, builtIn: boolean}} originalRole 列表页的角色快照；缺省时保持旧调用者更新行为。
   * @returns {Promise<Object>} 更新结果，权限有变化时包含 approvalId。
   */
  static submitRoleEdit = async (data, initialPermissions = [], originalRole) => {
    const permissionChanged = HGRoleCreateVM.permissionsChanged(
      initialPermissions,
      data.permissions
    );
    const metadataChanged = !originalRole || // 缺少原始快照的旧调用者保留原有更新路径。
      data.name !== originalRole.name || data.description !== originalRole.description;
    if (originalRole && String(data.id) !== String(originalRole.id)) {
      throw new Error("角色 ID 与编辑记录不一致，请重新打开编辑页");
    }
    if (originalRole?.builtIn && metadataChanged) {
      throw new Error("内置角色名称与描述由系统维护，不支持修改");
    }
    if (originalRole?.builtIn && originalRole.code !== "ops_engineer" && permissionChanged) {
      throw new Error("该内置角色权限由系统维护，不支持修改");
    }
    if (permissionChanged && !/^\d{6}$/.test(data.mfaCode)) {
      throw new Error("修改权限时请输入 6 位 MFA 验证码");
    }
    const role = metadataChanged // 无信息变更时直接进入权限申请，避免内置角色的更新冲突。
      ? await HGNet.post(HGMANAGER_API.IAM_ROLE_UPDATE, {
          id: data.id,
          name: data.name,
          description: data.description,
        })
      : { id: data.id };
    if (!permissionChanged) return metadataChanged ? role : { ...role, unchanged: true };
    try {
      const approval = await HGNet.post(HGMANAGER_API.IAM_ROLE_PERMISSIONS, {
        roleId: data.id,
        permissions: data.permissions,
        mfaCode: data.mfaCode,
      });
      return { ...role, approvalId: approval?.approvalId, metadataUpdated: metadataChanged };
    } catch (error) {
      throw new Error(
        `${metadataChanged ? "角色基础信息已更新，但" : ""}权限审批申请失败：${error?.message || "请返回角色列表重试"}`
      );
    }
  };
}
