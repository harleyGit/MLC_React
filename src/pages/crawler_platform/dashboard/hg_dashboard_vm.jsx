import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";

/** HGDashboardVM 封装采集平台首页接口及展示数据标准化。 */
export default class HGDashboardVM {
  /**
   * 获取 Dashboard 快照。
   * HGNet 已统一处理认证头、业务码和 result 解包，因此页面收到的就是 result。
   * @returns {Promise<Object>} Dashboard 数据。
   */
  static fetchDashboard = () => HGNet.get(HGMANAGER_API.CRAWLER_DASHBOARD);

  /**
   * 构建页面稳定的空数据结构，避免初次渲染访问 undefined。
   * @returns {Object} 空 Dashboard 数据。
   */
  static emptyData = () => ({ stats: { total: 0, success: 0, failed: 0, workers: 0, recommendations: 0 }, tasks: [], trend: [] });

  /**
   * 标准化后端返回值，对缺失数组和新增统计字段保持兼容。
   * @param {Object} result 后端 Dashboard result。
   * @returns {Object} 页面可直接写入 state 的数据。
   */
  static normalize = (result) => ({
    stats: { ...HGDashboardVM.emptyData().stats, ...(result?.stats || {}) },
    tasks: Array.isArray(result?.tasks) ? result.tasks : [],
    trend: Array.isArray(result?.trend) ? result.trend : [],
  });

  /**
   * 将任务状态枚举转换为中文展示文案；未知值保留原值便于排障。
   * @param {string} status 后端状态枚举。
   * @returns {string} 状态文案。
   */
  static statusText = (status) => ({ SUCCESS: "成功", FAILED: "失败", RUNNING: "运行中", WAIT: "等待" }[status] || status || "-");
}
