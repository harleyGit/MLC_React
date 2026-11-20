/*
 * @Description: 测试模块主页面，左侧菜单 + 右侧内容区。
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../components/menu_component/hg_side_menu_page";
import HGMenuBreadcrumb from "../../../components/hg_breadcrumb/hg_menu_breadcrumb";
import { hgBuildSubMenuUrl, hgReadSubMenuKey } from "../../../components/hg_navigation/hg_sub_nav";
import { ROUTE_PATH } from "../../../components/hg_navigation/hg_route_path";
import GuideVideoListView from "../../../pages/app/guide_video/GuideVideoListView";
import GuideVideoView from "../../../pages/app/guide_video/GuideVideoView";
import HGLoadingShowcasePage from "./hg_loading_showcase_page.jsx";
import HGThemePalettePage from "../../../components/hg_theme/hg_theme_palette_page.jsx";
import HGTestModuleVM, { TEST_MODULE_MENU_ITEMS } from "./hg_test_module_vm";
import styles from "./hg_test_module.module.css";

/**
 * 视频列表页包装组件。
 * 职责：把移动端引导视频列表安全放入后台测试模块内容区。
 */
class HGGuideVideoListPane extends Component {
  render() {
    return (
      <div className={styles.videoPageWrap}>
        <GuideVideoListView />
      </div>
    );
  }
}

/**
 * 视频播放页包装组件。
 * 职责：为 GuideVideoView 提供固定黑底容器，避免播放器在后台内容区高度塌陷。
 */
class HGGuideVideoPlayerPane extends Component {
  render() {
    return (
      <div className={styles.videoPlayerWrap}>
        <GuideVideoView />
      </div>
    );
  }
}

/**
 * 菜单 key 到右侧页面组件的映射表。
 * 约束：key 必须与 TEST_MODULE_MENU_ITEMS 的叶子节点一致。
 */
const PAGE_MAP = {
  guide_video_list: HGGuideVideoListPane,
  guide_video_player: HGGuideVideoPlayerPane,
  css_loading: HGLoadingShowcasePage,
  theme_palette: HGThemePalettePage,
};

/**
 * 测试模块页面。
 * 职责：管理左侧菜单选中态，并根据菜单 key 渲染右侧测试页面。
 */
class HGTestModulePage extends Component {
  /** URL 驱动菜单，避免刷新和浏览器返回时重置测试页。 */
  getSelectedKey = () => hgReadSubMenuKey(this.props.location?.search, HGTestModuleVM.getDefaultSelectedKey());

  /**
   * 菜单选中回调：更新右侧内容区页面。
   * @param {string} key 选中的叶子节点菜单 key。
   */
  handleMenuSelect = (key) => {
    if (key === this.getSelectedKey()) return;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.TEST_MODULE, key));
  };

  /** 面包屑跳转通过导航器复用父页历史。 */
  navigateBreadcrumb = (href) => this.props.pageNavigator.returnTo(href);

  /**
   * 渲染面包屑，帮助确认当前菜单路径。
   * @returns {React.ReactNode} 面包屑节点。
   */
  renderBreadcrumb = () => {
    return (
      <HGMenuBreadcrumb menuItems={TEST_MODULE_MENU_ITEMS} selectedKey={this.getSelectedKey()}
        basePath={ROUTE_PATH.TEST_MODULE} rootLabel="测试模块"
        onNavigate={this.navigateBreadcrumb} className={styles.breadcrumb} />
    );
  };

  /**
   * 根据当前菜单 key 渲染右侧内容页。
   * @returns {React.ReactNode} 右侧内容节点。
   */
  renderContent = () => {
    const selectedKey = this.getSelectedKey(); // 与侧边菜单一致的 URL 子页 key。
    const PageComponent = PAGE_MAP[selectedKey];
    if (PageComponent) {
      return <PageComponent />;
    }
    return <p className={styles.placeholderText}>请选择菜单项</p>;
  };

  render() {
    const selectedKey = this.getSelectedKey(); // 由当前历史项恢复，不维护第二份菜单状态。

    return (
      <div className={styles.testModuleContainer}>
        <HGSideMenuPage
          menuItems={TEST_MODULE_MENU_ITEMS}
          selectedKey={selectedKey}
          onSelect={this.handleMenuSelect}
        />
        <div className={styles.testModuleContent}>
          {this.renderBreadcrumb()}
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

export default HGTestModulePage;
