/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-14 22:50:44
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx
 * @Description: 运维管理主页面，左侧多级菜单 + 右侧内容区
 */
import React, { Component, lazy, Suspense } from "react";
import HGLoading from "../../../components/hg_loading/hg_loading";
import { ROUTE_PATH } from "../../../components/hg_navigation/hg_route_path";
import {
  hgBuildSubMenuUrl,
  hgReadSubMenuKey,
  hgResolveHighlightKey,
} from "../../../components/hg_navigation/hg_sub_nav";
import HGSideMenuPage from "../../../components/menu_component/hg_side_menu_page";
import HGMenuBreadcrumb from "../../../components/hg_breadcrumb/hg_menu_breadcrumb";
import styles from "./hg_operation_management.module.css";
import HGOperationManagementVM, {
  OPERATION_MENU_ITEMS,
} from "./hg_operation_management_vm";
import { HGIAMContext } from "../../../modules/iam/hg_iam_provider";
import { hgCanOpenOperation, hgFilterOperationMenu } from "../../../modules/iam/hg_menu_access";

// 真实业务页按菜单项独立拆包；占位页保留同步渲染，避免无意义的小 chunk。
const HGAdminAddPage = lazy(() => import("./admin_add/hg_admin_add_page"));
const HGAdminListPage = lazy(() => import("./admin_list/hg_admin_list_page"));
const HGAdminRoleAssignPage = lazy(() =>
  import("./admin_role_assign/hg_admin_role_assign_page")
);
const HGEmployeeRolePage = lazy(() =>
  import("./employee_role/hg_employee_role_page")
);
const HGFileListPage = lazy(() =>
  import("./file_management/file_list/hg_file_list_page")
);
const HGFileManagementPage = lazy(() =>
  import("./file_management/hg_file_management_page")
);
const HGPermissionMenuPage = lazy(() => import("./hg_permission_menu_page"));
const HGPermissionConfigPage = lazy(() =>
  import("./permission_config/hg_permission_config_page")
);
const HGRoleCreatePage = lazy(() =>
  import("./role_create/hg_role_create_page")
);
const HGRoleListPage = lazy(() => import("./role_list/hg_role_list_page"));
const HGScopeTypePage = lazy(() => import("./scope_type/hg_scope_type_page"));
const HGSmsTemplatePage = lazy(() =>
  import("./sms_template/hg_sms_template_page")
);
const HGNotifyChannelPage = lazy(() =>
  import("./notify_channel/hg_notify_channel_page")
);
const HGNotifySendPage = lazy(() =>
  import("./notify_channel/hg_notify_send_page")
);
const HGNotifySendRecordsPage = lazy(() =>
  import("./notify_channel/hg_notify_send_records_page")
);
const HGSystemNotifyTemplatePage = lazy(() =>
  import("./system_notification/hg_system_notify_template_page")
);
const HGBilibiliTagPage = lazy(() =>
  import("./bilibili_tag/hg_bilibili_tag_page")
);
const HGCoinOperationsPage = lazy(() =>
  import("./coin_operations/hg_coin_operations_page")
);
const HGRechargeSkuPage = lazy(() =>
  import("./hg_recharge_sku/hg_recharge_sku_page")
);
// 平台商品类目管理复用商城业务页，运维菜单仅提供独立入口。
const HGCommerceCategoryPage = lazy(() =>
  import("../../../pages/mall/hg_commerce_category_page.jsx")
);
const HGPendingMerchantReviewPage = lazy(() =>
  import("./mall_review/hg_mall_review_page").then((module) => ({
    default: module.HGPendingMerchantReviewPage,
  }))
);
const HGPendingProductReviewPage = lazy(() =>
  import("./mall_review/hg_mall_review_page").then((module) => ({
    default: module.HGPendingProductReviewPage,
  }))
);
const HGPendingMediaReviewPage = lazy(() =>
  import("./mall_review/hg_mall_review_page").then((module) => ({
    default: module.HGPendingMediaReviewPage,
  }))
);
const HGPendingEditReviewPage = lazy(() =>
  import("./mall_review/hg_mall_review_page").then((module) => ({
    default: module.HGPendingEditReviewPage,
  }))
);
const HGUserProfilePage = lazy(() => import("../user/hg_user_profile_page"));
// 检测工具按需加载，不增加默认运维页面的初始化请求。
const DomainDetectPage = lazy(() =>
  import("../domain_module/DomainDetectPage.jsx")
);

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
  domain_detect: DomainDetectPage,
  admin_add: HGAdminAddPage,
  admin_list: HGAdminListPage,
  admin_role_assign: HGAdminRoleAssignPage,
  //HGEmployeeRolePage,
  // 用户管理：user_list 菜单必须展示真实用户资料/用户列表页。
  // user_list 对应“用户列表”菜单，需要渲染真实用户资料列表页，而不是上方的占位组件。
  user_list: HGUserProfilePage, //用户列表
  // 用户权限管理Page：已拆分为独立业务页面。
  user_permission: HGEmployeeRolePage,
  // 角色与权限管理：部分页面已经拆分为独立业务页面，部分仍是占位页面。
  role_list: HGRoleListPage, //角色列表
  role_scope_type: HGScopeTypePage,
  role_scope_type_create: HGScopeTypePage,
  role_scope_type_edit: HGScopeTypePage,
  role_employee: HGEmployeeRolePage,
  // 创建角色页已从左侧菜单收敛为角色列表页头按钮入口；此处保留映射供 onMenuSelect("role_create") 渲染。
  role_create: HGRoleCreatePage,
  role_edit: HGRoleCreatePage,
  permission_list: PermissionListPage,
  permission_menu: HGPermissionMenuPage,
  permission_role: HGRoleListPage,
  permission_config: HGPermissionConfigPage,
  // 系统配置：基础配置、安全配置、通知配置对应的占位/业务页面。
  system_basic_site: SystemBasicSitePage,
  system_basic_email: SystemBasicEmailPage,
  system_basic_storage: SystemBasicStoragePage,
  system_security_login: SystemSecurityLoginPage,
  system_security_password: SystemSecurityPasswordPage,
  system_notify_template: HGSystemNotifyTemplatePage,
  // 发送通知与渠道总览分别进入独立菜单页，共用现有任务校验和渠道组件能力。
  system_notify_send: HGNotifySendPage,
  system_notify_send_records: HGNotifySendRecordsPage,
  system_notify_channel: HGNotifyChannelPage,
  system_notify_sms: HGSmsTemplatePage,
  // 资源管理：文件管理入口和文件列表页面。
  resource_file: HGFileManagementPage,
  resource_file_list: HGFileListPage,
  bilibili_douga_tags: HGBilibiliTagPage,
  coin_operations: HGCoinOperationsPage,
  hg_recharge_sku: HGRechargeSkuPage,
  // 商城管理：商品类目独立维护；四类待审资源分别维护列表状态，避免菜单切换时混用游标。
  mall_commerce_categories: HGCommerceCategoryPage,
  mall_pending_merchants: HGPendingMerchantReviewPage,
  mall_pending_products: HGPendingProductReviewPage,
  mall_pending_media: HGPendingMediaReviewPage,
  mall_pending_edits: HGPendingEditReviewPage,
};

/**
 * 隐藏子页（不在左侧菜单、由列表页跳入）的映射表。
 * - parentKey：该子页应高亮的父菜单 key，使进入子页时父菜单保持高亮。
 * - breadcrumb：面包屑兜底路径，结构与 HGSideMenuVM.findPathToKey 返回一致。
 */
const HIDDEN_BREADCRUMB_PATHS = {
  system_notify_send_records: {
    parentKey: "system_notify_send",
    breadcrumb: [
      { key: "system", label: "系统设置" },
      { key: "system_notify", label: "通知管理" },
      { key: "system_notify_send", label: "发送通知" },
      { key: "system_notify_send_records", label: "本人发送记录" },
    ],
  },
  role_scope_type_create: {
    parentKey: "role_scope_type",
    breadcrumb: [
      { key: "role", label: "角色管理" },
      { key: "role_scope_type", label: "作用域类型" },
      { key: "role_scope_type_create", label: "创建作用域类型" },
    ],
  },
  role_scope_type_edit: {
    parentKey: "role_scope_type",
    breadcrumb: [
      { key: "role", label: "角色管理" },
      { key: "role_scope_type", label: "作用域类型" },
      { key: "role_scope_type_edit", label: "编辑作用域类型" },
    ],
  },
  role_create: {
    parentKey: "role_list",
    breadcrumb: [
      { key: "role", label: "角色管理" },
      { key: "role_list", label: "角色列表" },
      { key: "role_create", label: "创建角色" },
    ],
  },
  role_edit: {
    parentKey: "role_list",
    breadcrumb: [
      { key: "role", label: "角色管理" },
      { key: "role_list", label: "角色列表" },
      { key: "role_edit", label: "编辑角色" },
    ],
  },
};

/**
 * 运维管理主页面组件
 * 职责：左侧多级菜单 + 右侧内容区，根据选中菜单项渲染对应页面
 * 约束：使用 HGSideMenuPage 组件渲染菜单，PAGE_MAP 映射右侧内容
 */
class HGOperationManagementPage extends Component {
  static contextType = HGIAMContext;
  /** 隐藏子页 -> 父菜单 key 的映射，用于菜单高亮。 */
  static HIDDEN_PARENT_KEY = Object.fromEntries(
    Object.entries(HIDDEN_BREADCRUMB_PATHS).map(([key, cfg]) => [key, cfg.parentKey])
  );

  /**
   * 当前子页 key：以 URL query 为唯一事实来源，复用 react-router 历史栈实现 push/pop。
   * 无参数时回落到默认菜单项。
   */
  getSelectedKey = () =>
    hgReadSubMenuKey(
      this.props.location?.search,
      HGOperationManagementVM.getDefaultSelectedKey()
    );

  /**
   * 菜单切换写入历史；后退、前进按相同 URL 恢复子页，重复点击不新增历史。
   * @param {string} key 叶子菜单 key
   */
  handleMenuSelect = (key) => {
    if (key === this.getSelectedKey()) return;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.OPERATION_MANAGEMENT, key));
  };

  /**
   * 子页跳转（push）：进入隐藏子页（如创建角色），压入历史栈。
   * 返回时后退一步即可回到来源列表页。
   * @param {string} key 目标子页 key
   * @param {Object} params 编辑对象标识，默认无额外参数。
   * @param {Object|undefined} state 当前历史项的非敏感页面数据；刷新和前进/后退时由浏览器 history 保留。
   */
  pushPage = (key, params = {}, state = undefined) => {
    const { navigate } = this.props;
    navigate(
      hgBuildSubMenuUrl(ROUTE_PATH.OPERATION_MANAGEMENT, key, params),
      state === undefined ? undefined : { state }
    );
  };

  /** 有来源时与浏览器后退一致；直达编辑网址时回到明确父列表。 */
  back = () => {
    const parent = HIDDEN_BREADCRUMB_PATHS[this.getSelectedKey()]?.parentKey; // 隐藏子页对应的列表。
    if (parent) return this.props.pageNavigator.back(hgBuildSubMenuUrl(ROUTE_PATH.OPERATION_MANAGEMENT, parent));
    return this.props.navigate(-1);
  };

  /** 面包屑进入祖先页面；复用历史中的父项，使前进仍能恢复编辑页。 */
  navigateBreadcrumb = (href) => this.props.pageNavigator.returnTo(href);

  /**
   * 渲染面包屑导航：根据 selectedKey 显示完整路径（A > B > C）
   * 说明：菜单中不存在的隐藏页面（如创建角色）回落到 HIDDEN_BREADCRUMB_PATHS.breadcrumb。
   * @param {string} selectedKey 当前子页 key。
   * @returns {React.ReactNode} 面包屑节点
   */
  renderBreadcrumb = (selectedKey) => {
    return (
      <HGMenuBreadcrumb menuItems={OPERATION_MENU_ITEMS} selectedKey={selectedKey}
        basePath={ROUTE_PATH.OPERATION_MANAGEMENT} rootLabel="运维管理"
        hiddenPath={HIDDEN_BREADCRUMB_PATHS[selectedKey]?.breadcrumb}
        onNavigate={this.navigateBreadcrumb} className={styles.breadcrumb} />
    );
  };

  /**
   * 渲染右侧内容区：根据 selectedKey 从 PAGE_MAP 获取对应页面组件
   * 约束：向子页面注入 onMenuSelect（tab 切换）与 pushPage/back（栈式导航），未使用的页面忽略这些 prop。
   * 高度约定：内容包裹在 .contentBody 弹性容器中，列表仍由内容自然撑高。
   * @param {string} selectedKey 当前子页 key。
   * @returns {React.ReactNode} 右侧内容区节点
   */
  renderContent = (selectedKey) => {
    if (this.context?.status !== "ready" || !hgCanOpenOperation(this.context.snapshot, selectedKey)) {
      return <div className={styles.contentBody} role="alert">没有该模块的访问权限</div>;
    }
    const PageComponent = PAGE_MAP[selectedKey];
    if (PageComponent) {
      return (
        <div className={styles.contentBody}>
          <Suspense fallback={<HGLoading text="正在加载页面..." />}>
            <PageComponent
              key={selectedKey}
              selectedKey={selectedKey}
              location={this.props.location}
              onMenuSelect={this.handleMenuSelect}
              pushPage={this.pushPage}
              onBack={this.back}
            />
          </Suspense>
        </div>
      );
    }
    return (
      <div className={styles.contentBody}>
        <p className={styles.placeholderText}>请选择菜单项</p>
      </div>
    );
  };

  render() {
    const selectedKey = this.getSelectedKey();
    const menuItems = this.context?.status === "ready"
      ? hgFilterOperationMenu(OPERATION_MENU_ITEMS, this.context.snapshot) : [];
    // 隐藏子页（如创建角色）高亮其父菜单，使「角色列表」保持选中态。
    const highlightKey = hgResolveHighlightKey(
      selectedKey,
      HGOperationManagementPage.HIDDEN_PARENT_KEY
    );

    return (
      <div className={styles.operationContainer}>
        <HGSideMenuPage
          menuItems={menuItems}
          selectedKey={highlightKey}
          onSelect={this.handleMenuSelect}
        />
        <div className={styles.operationContent}>
          {this.renderBreadcrumb(selectedKey)}
          {this.renderContent(selectedKey)}
        </div>
      </div>
    );
  }
}

export default HGOperationManagementPage;
