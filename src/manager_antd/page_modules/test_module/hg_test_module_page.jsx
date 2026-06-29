/*
 * @Description: 测试模块主页面，左侧菜单 + 右侧内容区。
 */
import React, { Component } from "react";
import HGSideMenuPage from "../../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../../components/menu_component/hg_side_menu_vm";
import GuideVideoListView from "../../../pages/app/guide_video/GuideVideoListView";
import GuideVideoView from "../../../pages/app/guide_video/GuideVideoView";
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
};

/**
 * 测试模块页面。
 * 职责：管理左侧菜单选中态，并根据菜单 key 渲染右侧测试页面。
 */
class HGTestModulePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedKey: HGTestModuleVM.getDefaultSelectedKey(),
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
    const path = HGSideMenuVM.findPathToKey(TEST_MODULE_MENU_ITEMS, selectedKey);
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
   * 根据当前菜单 key 渲染右侧内容页。
   * @returns {React.ReactNode} 右侧内容节点。
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
