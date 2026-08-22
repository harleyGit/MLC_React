import React, { Component, lazy, Suspense } from "react";
import HGLoading from "../../components/hg_loading";
import HGSideMenuPage from "../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../components/menu_component/hg_side_menu_vm";
import HGCrawlerPlatformVM, { CRAWLER_MENU_ITEMS } from "./hg_crawler_platform_vm";
import styles from "./hg_crawler_platform.module.css";

const HGDashboardPage = lazy(() => import("./dashboard/hg_dashboard_page"));
const HGSpiderPage = lazy(() => import("./spider/hg_spider_page"));
const HGTaskPage = lazy(() => import("./task/hg_task_page"));
const HGTaskCreatePage = lazy(() => import("./task/hg_task_create_page"));
const HGRecommendationPage = lazy(() => import("./recommendation/hg_recommendation_page"));

// PAGE_MAP 只保存叶子菜单到页面组件的映射；菜单 key 必须与 CRAWLER_MENU_ITEMS 保持一致。
// 这里使用 lazy 组件，使 Dashboard、Spider、Task、采集结果的表格和样式不会全部进入主页面初始包。
const PAGE_MAP = {
  crawler_dashboard: HGDashboardPage,
  crawler_spiders: HGSpiderPage,
  crawler_tasks: HGTaskPage,
  crawler_task_create: HGTaskCreatePage,
  crawler_recommendations: HGRecommendationPage,
};

/**
 * HGCrawlerPlatformPage 提供采集平台侧边导航和业务内容区域。
 * 页面切换保存在局部 selectedKey，不修改浏览器 URL，保持与现有运维管理页面一致的交互方式。
 */
class HGCrawlerPlatformPage extends Component {
  constructor(props) {
    super(props);
    this.state = { selectedKey: HGCrawlerPlatformVM.getDefaultSelectedKey() };
  }

  /**
   * 处理侧边栏叶子菜单选择。
   * @param {string} selectedKey 与 PAGE_MAP 对应的页面 key。
   */
  handleMenuSelect = (selectedKey) => this.setState({ selectedKey });

  /**
   * 根据当前菜单 key 计算完整层级并渲染面包屑。
   * @returns {React.ReactNode} 当前菜单路径。
   */
  renderBreadcrumb = () => {
    const path = HGSideMenuVM.findPathToKey(CRAWLER_MENU_ITEMS, this.state.selectedKey);
    return (
      <div className={styles.breadcrumb}>
        {path.map((node, index) => (
          <React.Fragment key={node.key}>
            <span className={index === path.length - 1 ? styles.breadcrumbCurrent : styles.breadcrumbParent}>
              {node.label}
            </span>
            {index < path.length - 1 ? <span className={styles.separator}>/</span> : null}
          </React.Fragment>
        ))}
      </div>
    );
  };

  /**
   * 渲染采集平台外壳。
   * 未识别的菜单 key 安全回退到 Dashboard，避免右侧内容区出现空白。
   * @returns {React.ReactNode} 平台布局。
   */
  render() {
    const { selectedKey } = this.state;
    const PageComponent = PAGE_MAP[selectedKey] || HGDashboardPage;
    return (
      <div className={styles.platform}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>DC</span>
            <div><strong>Data Crawler</strong><small>采集控制台</small></div>
          </div>
          <HGSideMenuPage menuItems={CRAWLER_MENU_ITEMS} selectedKey={selectedKey} onSelect={this.handleMenuSelect} />
        </aside>
        <main className={styles.content}>
          {this.renderBreadcrumb()}
          <Suspense fallback={<HGLoading text="正在加载采集平台..." />}>
            <PageComponent onNavigate={this.handleMenuSelect} />
          </Suspense>
        </main>
      </div>
    );
  }
}

export default HGCrawlerPlatformPage;
