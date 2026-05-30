/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx
 * @Description: 运维管理主页面，左侧多级菜单 + 右侧内容区
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../../components/menu_component/hg_side_menu_vm";
import HGOperationManagementVM, { OPERATION_MENU_ITEMS } from "./hg_operation_management_vm";
import HGPermissionMenuPage from "./hg_permission_menu_page";
import HGEmployeeRolePage from "./employee_role/hg_employee_role_page";
import HGRolePermissionPage from "./role_permission/hg_role_permission_page";
import HGAdminRoleAssignPage from "./admin_role_assign/hg_admin_role_assign_page";
import HGSmsTemplatePage from "./sms_template/hg_sms_template_page";
import HGFileManagementPage from "./file_management/hg_file_management_page";
import HGFileListPage from "./file_management/file_list/hg_file_list_page";
import styles from "./hg_operation_management.module.css";

/**
 * 管理员列表占位页面
 * 职责：展示管理员列表内容（占位）
 */
class AdminListPage extends Component {
  render() {
    return (
      <div>
        <h2>管理员列表</h2>
        <p className={styles.placeholderText}>管理员列表页面内容</p>
      </div>
    );
  }
}

/**
 * 添加管理员占位页面
 * 职责：展示添加管理员表单（占位）
 */
class AdminAddPage extends Component {
  render() {
    return (
      <div>
        <h2>添加管理员</h2>
        <p className={styles.placeholderText}>添加管理员页面内容</p>
      </div>
    );
  }
}

/**
 * 用户列表占位页面
 * 职责：展示用户列表内容（占位）
 */
class UserListPage extends Component {
  render() {
    return (
      <div>
        <h2>用户列表</h2>
        <p className={styles.placeholderText}>用户列表页面内容</p>
      </div>
    );
  }
}

/**
 * 用户权限管理占位页面
 * 职责：展示用户权限管理内容（占位）
 */
class UserPermissionPage extends Component {
  render() {
    return (
      <div>
        <h2>用户权限管理</h2>
        <p className={styles.placeholderText}>用户权限管理页面内容</p>
      </div>
    );
  }
}

/**
 * 角色列表占位页面
 * 职责：展示角色列表内容（占位）
 */
class RoleListPage extends Component {
  render() {
    return (
      <div>
        <h2>角色列表</h2>
        <p className={styles.placeholderText}>角色列表页面内容</p>
      </div>
    );
  }
}

/**
 * 创建角色占位页面
 * 职责：展示创建角色表单（占位）
 */
class RoleCreatePage extends Component {
  render() {
    return (
      <div>
        <h2>创建角色</h2>
        <p className={styles.placeholderText}>创建角色页面内容</p>
      </div>
    );
  }
}

/**
 * 权限列表占位页面
 * 职责：展示权限列表内容（占位）
 */
class PermissionListPage extends Component {
  render() {
    return (
      <div>
        <h2>权限列表</h2>
        <p className={styles.placeholderText}>权限列表页面内容</p>
      </div>
    );
  }
}

/**
 * 权限配置占位页面
 * 职责：展示权限配置内容（占位）
 */
class PermissionConfigPage extends Component {
  render() {
    return (
      <div>
        <h2>权限配置</h2>
        <p className={styles.placeholderText}>权限配置页面内容</p>
      </div>
    );
  }
}

/**
 * 站点信息占位页面
 */
class SystemBasicSitePage extends Component {
  render() {
    return (
      <div>
        <h2>站点信息</h2>
        <p className={styles.placeholderText}>站点信息配置页面内容</p>
      </div>
    );
  }
}

/**
 * 邮件配置占位页面
 */
class SystemBasicEmailPage extends Component {
  render() {
    return (
      <div>
        <h2>邮件配置</h2>
        <p className={styles.placeholderText}>邮件配置页面内容</p>
      </div>
    );
  }
}

/**
 * 存储配置占位页面
 */
class SystemBasicStoragePage extends Component {
  render() {
    return (
      <div>
        <h2>存储配置</h2>
        <p className={styles.placeholderText}>存储配置页面内容</p>
      </div>
    );
  }
}

/**
 * 登录策略占位页面
 */
class SystemSecurityLoginPage extends Component {
  render() {
    return (
      <div>
        <h2>登录策略</h2>
        <p className={styles.placeholderText}>登录策略配置页面内容</p>
      </div>
    );
  }
}

/**
 * 密码策略占位页面
 */
class SystemSecurityPasswordPage extends Component {
  render() {
    return (
      <div>
        <h2>密码策略</h2>
        <p className={styles.placeholderText}>密码策略配置页面内容</p>
      </div>
    );
  }
}

/**
 * 通知模板占位页面
 */
class SystemNotifyTemplatePage extends Component {
  render() {
    return (
      <div>
        <h2>通知模板</h2>
        <p className={styles.placeholderText}>通知模板配置页面内容</p>
      </div>
    );
  }
}

/**
 * 通知渠道占位页面
 */
class SystemNotifyChannelPage extends Component {
  render() {
    return (
      <div>
        <h2>通知渠道</h2>
        <p className={styles.placeholderText}>通知渠道配置页面内容</p>
      </div>
    );
  }
}

/**
 * 菜单 key 到页面组件的映射表
 * 约束：key 需与 OPERATION_MENU_ITEMS 中的叶子节点 key 一致
 */
const PAGE_MAP = {
  admin_list: AdminListPage,
  admin_add: AdminAddPage,
  admin_role_assign: HGAdminRoleAssignPage,
  user_list: UserListPage,
  user_permission: UserPermissionPage,
  role_list: RoleListPage,
  role_employee: HGEmployeeRolePage,
  role_create: RoleCreatePage,
  permission_list: PermissionListPage,
  permission_menu: HGPermissionMenuPage,
  permission_role: HGRolePermissionPage,
  permission_config: PermissionConfigPage,
  system_basic_site: SystemBasicSitePage,
  system_basic_email: SystemBasicEmailPage,
  system_basic_storage: SystemBasicStoragePage,
  system_security_login: SystemSecurityLoginPage,
  system_security_password: SystemSecurityPasswordPage,
  system_notify_template: SystemNotifyTemplatePage,
  system_notify_channel: SystemNotifyChannelPage,
  system_notify_sms: HGSmsTemplatePage,
  resource_file: HGFileManagementPage,
  resource_file_list: HGFileListPage,
};

/**
 * 运维管理主页面组件
 * 职责：左侧多级菜单 + 右侧内容区，根据选中菜单项渲染对应页面
 * 约束：使用 HGSideMenuPage 组件渲染菜单，PAGE_MAP 映射右侧内容
 */
class HGOperationManagementPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedKey: HGOperationManagementVM.getDefaultSelectedKey(),
    };
  }

  /**
   * 菜单选中回调：更新右侧内容区显示的页面
   * @param {string} key 选中的叶子节点菜单 key
   */
  handleMenuSelect = (key) => {
    this.setState({ selectedKey: key });
  };

  /**
   * 渲染面包屑导航：根据 selectedKey 显示完整路径（A > B > C）
   * @returns {React.ReactNode} 面包屑节点
   */
  renderBreadcrumb = () => {
    const { selectedKey } = this.state;
    const path = HGSideMenuVM.findPathToKey(OPERATION_MENU_ITEMS, selectedKey);
    if (!path || path.length === 0) return null;

    return (
      <div className={styles.breadcrumb}>
        {path.map((node, index) => {
          const isLast = index === path.length - 1;
          return (
            <span key={node.key} className={styles.breadcrumbItem}>
              {!isLast ? (
                <span className={styles.breadcrumbLink}>{node.label}</span>
              ) : (
                <span className={styles.breadcrumbCurrent}>{node.label}</span>
              )}
              {!isLast && <span className={styles.breadcrumbSeparator}>{'>'}</span>}
            </span>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染右侧内容区：根据 selectedKey 从 PAGE_MAP 获取对应页面组件
   * @returns {React.ReactNode} 右侧内容区节点
   */
  renderContent = () => {
    const { selectedKey } = this.state;
    const PageComponent = PAGE_MAP[selectedKey];
    if (PageComponent) {
      return <PageComponent />;
    }
    return <p className={styles.placeholderText}>请选择菜单项</p>;
  };

  render() {
    const { selectedKey } = this.state;

    return (
      <div className={styles.operationContainer}>
        <HGSideMenuPage
          menuItems={OPERATION_MENU_ITEMS}
          selectedKey={selectedKey}
          onSelect={this.handleMenuSelect}
        />
        <div className={styles.operationContent}>
          {this.renderBreadcrumb()}
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

export default HGOperationManagementPage;
