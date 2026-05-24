/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx
 * @Description: 运维管理主页面，左侧多级菜单 + 右侧内容区
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../components/menu_component/hg_side_menu_page";
import HGOperationManagementVM, { OPERATION_MENU_ITEMS } from "./hg_operation_management_vm";
import HGPermissionMenuPage from "./hg_permission_menu_page";
import HGEmployeeRolePage from "./employee_role/hg_employee_role_page";
import HGRolePermissionPage from "./role_permission/hg_role_permission_page";
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
 * 菜单 key 到页面组件的映射表
 * 约束：key 需与 OPERATION_MENU_ITEMS 中的叶子节点 key 一致
 */
const PAGE_MAP = {
  admin_list: AdminListPage,
  admin_add: AdminAddPage,
  user_list: UserListPage,
  user_permission: UserPermissionPage,
  role_list: RoleListPage,
  role_employee: HGEmployeeRolePage,
  role_create: RoleCreatePage,
  permission_list: PermissionListPage,
  permission_menu: HGPermissionMenuPage,
  permission_role: HGRolePermissionPage,
  permission_config: PermissionConfigPage,
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
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

export default HGOperationManagementPage;
