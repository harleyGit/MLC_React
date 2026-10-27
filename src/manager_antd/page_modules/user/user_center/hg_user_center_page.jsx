/*
 * @Description: 个人中心主页面，左侧菜单 + 右侧内容区，布局与测试模块保持一致。
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../../../components/menu_component/hg_side_menu_vm";
import HGMallOrdersPanel from "../../../../pages/mall/hg_mall_orders_panel";
import HGUserCenterVM, { USER_CENTER_MENU_ITEMS } from "./hg_user_center_vm";
import styles from "./hg_user_center.module.css";

/**
 * 个人中心页面。
 * 职责：管理左侧菜单选中态，并根据菜单 key 渲染右侧内容区。
 * 约束：订单数据由商城订单面板独立请求，页面本身不缓存收件隐私信息。
 */
class HGUserCenterPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedKey: HGUserCenterVM.getDefaultSelectedKey(),
    };
  }

  /**
   * 菜单选中回调：更新右侧内容区页面。
   * @param {string} key 选中的叶子节点菜单 key。
   */
  handleMenuSelect = (key) => {
    this.setState({ selectedKey: key });
  };

  /**
   * 渲染面包屑，帮助确认当前菜单路径。
   * @returns {React.ReactNode} 面包屑节点。
   */
  renderBreadcrumb = () => {
    const { selectedKey } = this.state;
    const path = HGSideMenuVM.findPathToKey(USER_CENTER_MENU_ITEMS, selectedKey);
    if (!path || path.length === 0) return null;

    return (
      <div className={styles.breadcrumb}>
        {path.map((node, index) => {
          const isLast = index === path.length - 1;
          return (
            <span key={node.key} className={styles.breadcrumbItem}>
              <span className={isLast ? styles.breadcrumbCurrent : styles.breadcrumbLink}>
                {node.label}
              </span>
              {!isLast && <span className={styles.breadcrumbSeparator}>{">"}</span>}
            </span>
          );
        })}
      </div>
    );
  };

  /**
   * 根据当前菜单 key 渲染右侧内容区。
   * @returns {React.ReactNode} 右侧内容节点。
   */
  renderContent = () => {
    const { selectedKey } = this.state;
    if (selectedKey === "orders") {
      return <HGMallOrdersPanel />;
    }
    return <p className={styles.placeholderText}>请选择菜单项</p>;
  };

  render() {
    const { selectedKey } = this.state;

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
