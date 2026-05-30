/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_operation_management_vm.jsx
 * @Description: 运维管理页面 ViewModel，管理菜单配置与页面切换逻辑
 */
import React from "react";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";

/**
 * 运维管理菜单数据配置
 * 格式：[{key, label, icon?, children?}]
 * 约束：key 需全局唯一，叶子节点 key 用于路由映射
 * icon：传入 HGIconPage 组件作为菜单项左侧图标
 */
export const OPERATION_MENU_ITEMS = [
  {
    key: "admin",
    label: "管理员管理",
    icon: <HGIconPage type="admin" />,
    children: [
      { key: "admin_list", label: "管理员列表", icon: <HGIconPage type="table" /> },
      { key: "admin_add", label: "添加管理员", icon: <HGIconPage type="add-user" /> },
      { key: "admin_role_assign", label: "管理员角色分配", icon: <HGIconPage type="role" /> },
    ],
  },
  {
    key: "user",
    label: "用户管理",
    icon: <HGIconPage type="user-management" />,
    children: [
      { key: "user_list", label: "用户列表", icon: <HGIconPage type="table" /> },
      { key: "user_permission", label: "用户权限管理", icon: <HGIconPage type="permission" /> },
    ],
  },
  {
    key: "role",
    label: "角色管理",
    icon: <HGIconPage type="role" />,
    children: [
      { key: "role_list", label: "角色列表", icon: <HGIconPage type="table" /> },
      { key: "role_employee", label: "管理员工角色", icon: <HGIconPage type="user" /> },
      { key: "role_create", label: "创建角色", icon: <HGIconPage type="plus" /> },
    ],
  },
  {
    key: "permission",
    label: "权限管理",
    icon: <HGIconPage type="permission" />,
    children: [
      { key: "permission_list", label: "权限列表", icon: <HGIconPage type="table" /> },
      { key: "permission_menu", label: "菜单权限", icon: <HGIconPage type="menu" /> },
      { key: "permission_role", label: "角色权限分配", icon: <HGIconPage type="shield" /> },
      { key: "permission_config", label: "权限配置", icon: <HGIconPage type="config" /> },
    ],
  },
  {
    key: "resource",
    label: "资源管理",
    icon: <HGIconPage type="file" />,
    children: [
      { key: "resource_file", label: "文件管理", icon: <HGIconPage type="file" /> },
      { key: "resource_file_list", label: "文件列表", icon: <HGIconPage type="table" /> },
    ],
  },
  {
    key: "system",
    label: "系统设置",
    icon: <HGIconPage type="config" />,
    children: [
      {
        key: "system_basic",
        label: "基础配置",
        icon: <HGIconPage type="config" />,
        children: [
          { key: "system_basic_site", label: "站点信息", icon: <HGIconPage type="config" /> },
          { key: "system_basic_email", label: "邮件配置", icon: <HGIconPage type="config" /> },
          { key: "system_basic_storage", label: "存储配置", icon: <HGIconPage type="config" /> },
        ],
      },
      {
        key: "system_security",
        label: "安全设置",
        icon: <HGIconPage type="shield" />,
        children: [
          { key: "system_security_login", label: "登录策略", icon: <HGIconPage type="shield" /> },
          { key: "system_security_password", label: "密码策略", icon: <HGIconPage type="shield" /> },
        ],
      },
      {
        key: "system_notify",
        label: "通知管理",
        icon: <HGIconPage type="config" />,
        children: [
          { key: "system_notify_template", label: "通知模板", icon: <HGIconPage type="config" /> },
          { key: "system_notify_channel", label: "通知渠道", icon: <HGIconPage type="config" /> },
          { key: "system_notify_sms", label: "短信模板", icon: <HGIconPage type="config" /> },
        ],
      },
    ],
  },
];

/**
 * 运维管理 ViewModel 类
 * 职责：管理菜单选中状态与右侧内容区映射
 * 约束：默认选中第一个叶子节点
 */
export default class HGOperationManagementVM {
  /**
   * 获取默认选中的菜单 key（第一个叶子节点）
   * @returns {string} 默认选中 key
   */
  static getDefaultSelectedKey = () => {
    const firstGroup = OPERATION_MENU_ITEMS[0];
    if (firstGroup && firstGroup.children && firstGroup.children.length > 0) {
      return firstGroup.children[0].key;
    }
    return firstGroup ? firstGroup.key : "";
  };
}
