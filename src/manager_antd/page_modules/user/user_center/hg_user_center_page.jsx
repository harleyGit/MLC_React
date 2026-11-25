/*
 * @Description: 个人中心主页面，左侧菜单 + 右侧内容区，布局与测试模块保持一致。
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../../components/menu_component/hg_side_menu_page";
import HGMenuBreadcrumb from "../../../../components/hg_breadcrumb/hg_menu_breadcrumb";
import { hgBuildSubMenuUrl, hgReadSubMenuKey } from "../../../../components/hg_navigation/hg_sub_nav";
import { ROUTE_PATH } from "../../../../components/hg_navigation/hg_route_path";
import HGMallPaidOrdersPage from "../../../../pages/mall/hg_mall_paid_orders_page";
import HGMallPendingOrdersPage from "../../../../pages/mall/hg_mall_pending_orders_page";
import HGMerchantApplyPage from "./hg_merchant_apply/hg_merchant_apply_page";
import HGMerchantProductsPage from "../../../../pages/mall/hg_merchant_products_page";
import HGMerchantPublishPage from "../../../../pages/mall/hg_merchant_publish_page";
import HGMerchantOrdersPage from "../../../../pages/mall/hg_merchant_orders_page";
import HGMerchantCommercePage from "../../../../pages/mall/hg_merchant_commerce_page";
import HGCommerceCategoryPage from "../../../../pages/mall/hg_commerce_category_page";
import HGImContactsPage from "../../../../pages/im_contacts/hg_im_contacts_page";
import HGSecurityCenterPage from "./hg_security_center/hg_security_center_page";
import HGMFARecoveryPage from "./hg_security_center/hg_mfa_recovery_page";
import HGUserCenterVM, {
  USER_CENTER_MENU_ITEMS,
  USER_CENTER_MENU_KEYS,
} from "./hg_user_center_vm";
import styles from "./hg_user_center.module.css";

/**
 * 个人中心页面。
 * 职责：管理左侧菜单选中态，并根据菜单 key 渲染右侧内容区。
 * 约束：订单数据由各自订单页面独立请求，页面本身不缓存收件隐私信息。
 */
class HGUserCenterPage extends Component {
  /** 子菜单由 URL 恢复，离开订单列表后返回时不再重置为默认菜单。 */
  getSelectedKey = () => hgReadSubMenuKey(this.props.location?.search, HGUserCenterVM.getDefaultSelectedKey());

  /**
   * 菜单选中回调：更新右侧内容区页面。
   * @param {string} key 选中的叶子节点菜单 key。
   */
  handleMenuSelect = (key) => {
    if (key === this.getSelectedKey()) return;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.USER_CENTER, key));
  };

  /** 点击祖先节点复用历史中的父页，直达时使用明确的站内目标。 */
  navigateBreadcrumb = (href) => this.props.pageNavigator.returnTo(href);

  /**
   * 渲染面包屑，帮助确认当前菜单路径。
   * @returns {React.ReactNode} 面包屑节点。
   */
  renderBreadcrumb = () => {
    return (
      <HGMenuBreadcrumb menuItems={USER_CENTER_MENU_ITEMS} selectedKey={this.getSelectedKey()}
        basePath={ROUTE_PATH.USER_CENTER} rootLabel="个人中心"
        onNavigate={this.navigateBreadcrumb} className={styles.breadcrumb} />
    );
  };

  /**
   * 根据当前菜单 key 渲染右侧内容区。
   * @returns {React.ReactNode} 右侧内容节点。
   */
  renderContent = () => {
    const selectedKey = this.getSelectedKey(); // URL 对应的业务菜单，浏览器前进/后退自动恢复。
    if (selectedKey === USER_CENTER_MENU_KEYS.UNPAID) {
      return <HGMallPendingOrdersPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.REVIEW) {
      return <HGMallPaidOrdersPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT) {
      // 商家入驻申请只展示申请卡片；商品、发布与订单由下面的子菜单各自渲染。
      return <HGMerchantApplyPage hgApplyOnly />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT_PRODUCTS) {
      return <HGMerchantProductsPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT_PUBLISH) {
      return <HGMerchantPublishPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT_ORDERS) {
      return <HGMerchantOrdersPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT_COMMERCE) {
      return <HGMerchantCommercePage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.MERCHANT_COMMERCE_CATEGORY) {
      // 类目管理列表；新建/编辑/删除由列表页内的路由链接进入独立页面。
      return <HGCommerceCategoryPage />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.CONTACTS) {
      return <HGImContactsPage hgInitialFilter="contacts" pageNavigator={this.props.pageNavigator} />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.FRIEND_REQUESTS) {
      return <HGImContactsPage hgInitialFilter="requests" pageNavigator={this.props.pageNavigator} />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.IM_GROUPS) {
      return <HGImContactsPage hgInitialFilter="groups" pageNavigator={this.props.pageNavigator} />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.SECURITY_MFA) {
      return <HGSecurityCenterPage hgRecoveryUrl={hgBuildSubMenuUrl(ROUTE_PATH.USER_CENTER, USER_CENTER_MENU_KEYS.SECURITY_MFA_RECOVERY)} />;
    }
    if (selectedKey === USER_CENTER_MENU_KEYS.SECURITY_MFA_RECOVERY) {
      return <HGMFARecoveryPage hgMfaUrl={hgBuildSubMenuUrl(ROUTE_PATH.USER_CENTER, USER_CENTER_MENU_KEYS.SECURITY_MFA)} />;
    }
    return <p className={styles.placeholderText}>请选择菜单项</p>;
  };

  render() {
    const selectedKey = this.getSelectedKey(); // 与内容区使用同一导航来源。

    return (
      <div className={styles.userCenterContainer}>
        <HGSideMenuPage
          menuItems={USER_CENTER_MENU_ITEMS}
          selectedKey={selectedKey}
          onSelect={this.handleMenuSelect}
        />
        <div className={styles.userCenterContent}>
          {this.renderBreadcrumb()}
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

export default HGUserCenterPage;
