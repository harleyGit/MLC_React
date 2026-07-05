/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-07-05 11:28:17
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx
 * @Description: 运维管理主页面，左侧多级菜单 + 右侧内容区
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../../components/menu_component/hg_side_menu_vm";
import HGAdminAddPage from "./admin_add/hg_admin_add_page";
import HGAdminListPage from "./admin_list/hg_admin_list_page";
import HGAdminRoleAssignPage from "./admin_role_assign/hg_admin_role_assign_page";
import HGEmployeeRolePage from "./employee_role/hg_employee_role_page";
import HGFileListPage from "./file_management/file_list/hg_file_list_page";
import HGFileManagementPage from "./file_management/hg_file_management_page";
import HGOperationManagementVM, {
  OPERATION_MENU_ITEMS,
} from "./hg_operation_management_vm";
import HGPermissionMenuPage from "./hg_permission_menu_page";
import HGRoleCreatePage from "./role_create/hg_role_create_page";
import HGRoleListPage from "./role_list/hg_role_list_page";
import HGRolePermissionPage from "./role_permission/hg_role_permission_page";
import HGSmsTemplatePage from "./sms_template/hg_sms_template_page";
// 用户资料/用户列表真实页面：运维管理菜单中的 user_list 会复用该页面展示用户数据。
import HGUserProfilePage from "../user/hg_user_profile_page";
import styles from "./hg_operation_management.module.css";

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
 *
 * 工作机制：
 * 1. 左侧菜单点击后，HGSideMenuPage 通过 onSelect 回调把菜单 key 传给 handleMenuSelect。
 * 2. handleMenuSelect 将 key 写入 selectedKey。
 * 3. renderContent 读取 PAGE_MAP[selectedKey]，拿到对应页面组件。
 * 4. 如果找到组件，就渲染 <PageComponent />；如果没找到，则显示“请选择菜单项”。
 *
 * 维护注意：
 * - PAGE_MAP 的 key 必须和 hg_operation_management_vm.jsx 中 OPERATION_MENU_ITEMS 的叶子节点 key 完全一致。
 * - 这里保存的是组件类型本身，不是 JSX 实例；因此写 HGUserProfilePage，而不是 <HGUserProfilePage />。
 * - 新增菜单页面时，只需要新增页面组件 import，并在这里增加 key -> Component 的映射。
 * - user_list 当前对应真实的 HGUserProfilePage，用于替代原先的 UserListPage 占位页面。
 */
const PAGE_MAP = {
  // 管理员管理：admin_list 对应独立管理员列表业务页面。
  admin_list: HGAdminListPage,
  admin_add: HGAdminAddPage,
  admin_role_assign: HGAdminRoleAssignPage,
  // 用户管理：user_list 菜单必须展示真实用户资料/用户列表页。
  // user_list 对应“用户列表”菜单，需要渲染真实用户资料列表页，而不是上方的占位组件。
  user_list: HGUserProfilePage,//用户列表
  // 用户权限管理：当前仍使用本文件内定义的占位页面。
  user_permission: UserPermissionPage,
  // 角色与权限管理：部分页面已经拆分为独立业务页面，部分仍是占位页面。
  role_list: HGRoleListPage,//角色列表
  role_employee: HGEmployeeRolePage,
  role_create: HGRoleCreatePage,
  permission_list: PermissionListPage,
  permission_menu: HGPermissionMenuPage,
  permission_role: HGRolePermissionPage,
  permission_config: PermissionConfigPage,
  // 系统配置：基础配置、安全配置、通知配置对应的占位/业务页面。
  system_basic_site: SystemBasicSitePage,
  system_basic_email: SystemBasicEmailPage,
  system_basic_storage: SystemBasicStoragePage,
  system_security_login: SystemSecurityLoginPage,
  system_security_password: SystemSecurityPasswordPage,
  system_notify_template: SystemNotifyTemplatePage,
  system_notify_channel: SystemNotifyChannelPage,
  system_notify_sms: HGSmsTemplatePage,
  // 资源管理：文件管理入口和文件列表页面。
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
              {!isLast && (
                <span className={styles.breadcrumbSeparator}>{">"}</span>
              )}
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
