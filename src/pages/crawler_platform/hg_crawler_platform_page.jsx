import React, { Component, lazy, Suspense } from "react";
import HGLoading from "../../components/hg_loading/hg_loading";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path";
import {
  hgBuildSubMenuUrl,
  hgReadSubMenuKey,
  hgResolveHighlightKey,
} from "../../components/hg_navigation/hg_sub_nav";
import HGSideMenuPage from "../../components/menu_component/hg_side_menu_page";
import HGMenuBreadcrumb from "../../components/hg_breadcrumb/hg_menu_breadcrumb";
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

// 隐藏详情页补齐自身节点，父列表才会成为可点击的面包屑链接。
const HIDDEN_LABELS = {
  crawler_task_create: ["任务管理", "创建任务"],
  crawler_task_detail: ["任务管理", "任务详情"],
  crawler_recommendation_detail: ["采集结果", "采集详情"],
};

/**
 * HGCrawlerPlatformPage 提供采集平台侧边导航和业务内容区域。
 * 子页 key 编码进 URL query 复用 react-router 历史栈，实现 push/pop 后退语义；
 * URL 同时记录任务 ID；配置快照只在本实例内缓存，不把任务配置持久化到地址或历史记录。
 */
class HGCrawlerPlatformPage extends Component {
  constructor(props) {
    super(props);
    // 页面上下文缓存：页面 key + 任务 ID，防止后退/前进混用不同任务的快照。
    this.contextCache = {};
  }

  /** 当前子页 key：以 URL query 为唯一事实来源。 */
  getSelectedKey = () =>
    hgReadSubMenuKey(
      this.props.location?.search,
      HGCrawlerPlatformVM.getDefaultSelectedKey()
    );

  /**
   * 菜单选择写入浏览器历史，重复点击当前菜单不堆叠历史。
   * @param {string} key 页面 key。
   */
  handleMenuSelect = (key) => {
    if (key === this.getSelectedKey()) return;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.CRAWLER_PLATFORM, key));
  };

  /**
   * 子页跳转（push）：进入详情/创建等隐藏页，压栈并缓存上下文。
   * @param {string} key 目标子页 key。
   * @param {*} pageContext 业务上下文（如 task 对象）。
   */
  pushPage = (key, pageContext = null) => {
    const taskId = pageContext?.task?.id; // 稳定任务标识；新建页不携带 ID。
    if (taskId != null) this.contextCache[`${key}:${taskId}`] = pageContext;
    this.props.navigate(hgBuildSubMenuUrl(ROUTE_PATH.CRAWLER_PLATFORM, key, { taskId }));
  };

  /** 返回上一子页：后退一步历史栈，与浏览器返回一致。 */
  back = () => {
    const parent = BREADCRUMB_PARENT_KEY[this.getSelectedKey()]; // 无上下文直达详情时也能回到父列表。
    if (parent) return this.props.pageNavigator.back(hgBuildSubMenuUrl(ROUTE_PATH.CRAWLER_PLATFORM, parent));
    return this.props.navigate(-1);
  };

  /** 祖先节点复用已有历史；直接访问时以站内父页替换当前项。 */
  navigateBreadcrumb = (href) => this.props.pageNavigator.returnTo(href);

  /**
   * 根据当前菜单 key 计算完整层级并渲染面包屑。
   * @param {string} selectedKey 当前子页 key。
   * @returns {React.ReactNode} 当前菜单路径。
   */
  renderBreadcrumb = (selectedKey) => {
    const labels = HIDDEN_LABELS[selectedKey]; // 只有隐藏详情/新建页需要补齐层级。
    const hiddenPath = labels ? [
      { key: "crawler_control", label: "采集控制" },
      { key: BREADCRUMB_PARENT_KEY[selectedKey], label: labels[0] },
      { key: selectedKey, label: labels[1] },
    ] : [];
    return (
      <HGMenuBreadcrumb menuItems={CRAWLER_MENU_ITEMS} selectedKey={selectedKey}
        basePath={ROUTE_PATH.CRAWLER_PLATFORM} rootLabel="采集平台" hiddenPath={hiddenPath}
        onNavigate={this.navigateBreadcrumb} className={styles.breadcrumb} />
    );
  };

  /**
   * 渲染采集平台外壳。
   * 未识别的菜单 key 安全回退到 Dashboard，避免右侧内容区出现空白。
   * @returns {React.ReactNode} 平台布局。
   */
  render() {
    const selectedKey = this.getSelectedKey();
    const taskId = new URLSearchParams(this.props.location?.search).get("taskId"); // 当前历史项对应的任务。
    const pageContext = this.contextCache[`${selectedKey}:${taskId}`] || null;
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
            <PageComponent key={`${selectedKey}:${taskId}`} onNavigate={this.pushPage} onBack={this.back} pageContext={pageContext} />
          </Suspense>
        </main>
      </div>
    );
  }
}

export default HGCrawlerPlatformPage;
