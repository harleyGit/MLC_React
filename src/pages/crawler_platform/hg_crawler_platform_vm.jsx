/**
 * 采集平台侧边菜单定义。
 * 叶子 key 同时是页面映射键，新增页面时必须同步维护 PAGE_MAP。
 */
export const CRAWLER_MENU_ITEMS = [
  {
    key: "crawler_control",
    label: "采集控制",
    children: [
      { key: "crawler_dashboard", label: "Dashboard" },
      { key: "crawler_spiders", label: "Spider 管理" },
      { key: "crawler_tasks", label: "任务管理" },
    ],
  },
];

/** HGCrawlerPlatformVM 管理采集平台菜单默认值。 */
export default class HGCrawlerPlatformVM {
  /**
   * 获取平台首次进入时展示的页面。
   * @returns {string} Dashboard 菜单 key。
   */
  static getDefaultSelectedKey = () => "crawler_dashboard";
}
