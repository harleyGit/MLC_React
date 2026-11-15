import React, { Component, lazy, Suspense } from "react";
import HGLoading from "../../components/hg_loading/hg_loading";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path";
import {
  hgBuildSubMenuUrl,
  hgReadSubMenuKey,
  hgResolveHighlightKey,
} from "../../components/hg_navigation/hg_sub_nav";
import HGSideMenuPage from "../../components/menu_component/hg_side_menu_page";
import HGSideMenuVM from "../../components/menu_component/hg_side_menu_vm";
import HGCrawlerPlatformVM, { CRAWLER_MENU_ITEMS } from "./hg_crawler_platform_vm";
import styles from "./hg_crawler_platform.module.css";

const HGDashboardPage = lazy(() => import("./dashboard/hg_dashboard_page"));
const HGSpiderPage = lazy(() => import("./spider/hg_spider_page"));
const HGTaskPage = lazy(() => import("./task/hg_task_page"));
const HGTaskCreatePage = lazy(() => import("./task/hg_task_create_page"));
const HGTaskDetailPage = lazy(() => import("./task/hg_task_detail_page"));
const HGRecommendationPage = lazy(() => import("./recommendation/hg_recommendation_page"));
const HGRecommendationDetailPage = lazy(() => import("./recommendation/hg_recommendation_detail_page"));

// PAGE_MAP 同时保存菜单页和隐藏导航页；菜单页 key 必须与 CRAWLER_MENU_ITEMS 保持一致。
// 这里使用 lazy 组件，使各业务页面的表格和样式不会全部进入主页面初始包。
const PAGE_MAP = {
  crawler_dashboard: HGDashboardPage,
  crawler_spiders: HGSpiderPage,
  crawler_tasks: HGTaskPage,
  crawler_task_create: HGTaskCreatePage,
  crawler_task_detail: HGTaskDetailPage,
  crawler_recommendations: HGRecommendationPage,
  crawler_recommendation_detail: HGRecommendationDetailPage,
};

const BREADCRUMB_PARENT_KEY = {
  crawler_task_create: "crawler_tasks",
  crawler_task_detail: "crawler_tasks",
  crawler_recommendation_detail: "crawler_recommendations",
};

/**
 * HGCrawlerPlatformPage 提供采集平台侧边导航和业务内容区域。
 * 子页 key 编码进 URL query 复用 react-router 历史栈，实现 push/pop 后退语义；
 * 页面上下文（如任务对象）无法序列化进 URL，用内存缓存按 key 保存，返回时恢复。
 */
class HGCrawlerPlatformPage extends Component {
  constructor(props) {
    super(props);
    // 页面上下文缓存：key -> 业务对象（如 task），URL 只保存 key。
    this.contextCache = {};
  }

  /** 当前子页 key：以 URL query 为唯一事实来源。 */
  getSelectedKey = () =>
    hgReadSubMenuKey(
      this.props.location?.search,
      HGCrawlerPlatformVM.getDefaultSelectedKey()
    );

  /**
   * 侧边栏叶子菜单选择（tab 切换）：替换当前历史项。
   * @param {string} key 页面 key。
   */
  handleMenuSelect = (key) => {
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.CRAWLER_PLATFORM, key), {
      replace: true,
    });
  };

  /**
   * 子页跳转（push）：进入详情/创建等隐藏页，压栈并缓存上下文。
   * @param {string} key 目标子页 key。
   * @param {*} pageContext 业务上下文（如 task 对象）。
   */
  pushPage = (key, pageContext = null) => {
    if (pageContext != null) this.contextCache[key] = pageContext;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.CRAWLER_PLATFORM, key));
  };

  /** 返回上一子页：后退一步历史栈，与浏览器返回一致。 */
  back = () => {
    this.props.navigate(-1);
  };

  /**
   * 根据当前菜单 key 计算完整层级并渲染面包屑。
   * @param {string} selectedKey 当前子页 key。
   * @returns {React.ReactNode} 当前菜单路径。
   */
  renderBreadcrumb = (selectedKey) => {
    const breadcrumbKey = BREADCRUMB_PARENT_KEY[selectedKey] || selectedKey;
    const path = HGSideMenuVM.findPathToKey(CRAWLER_MENU_ITEMS, breadcrumbKey);
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
    const selectedKey = this.getSelectedKey();
    const pageContext = this.contextCache[selectedKey] || null;
    const PageComponent = PAGE_MAP[selectedKey] || HGDashboardPage;
    // 隐藏子页（详情/创建）高亮其父菜单，使列表菜单保持选中态。
    const highlightKey = hgResolveHighlightKey(selectedKey, BREADCRUMB_PARENT_KEY);
    return (
      <div className={styles.platform}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>DC</span>
            <div><strong>Data Crawler</strong><small>采集控制台</small></div>
          </div>
          <HGSideMenuPage menuItems={CRAWLER_MENU_ITEMS} selectedKey={highlightKey} onSelect={this.handleMenuSelect} />
        </aside>
        <main className={styles.content}>
          {this.renderBreadcrumb(selectedKey)}
          <Suspense fallback={<HGLoading text="正在加载采集平台..." />}>
            <PageComponent onNavigate={this.pushPage} onBack={this.back} pageContext={pageContext} />
          </Suspense>
        </main>
      </div>
    );
  }
}

export default HGCrawlerPlatformPage;
