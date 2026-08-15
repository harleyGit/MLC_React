import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";

// 默认页大小与后端 manager 默认值一致；页面允许切换，但后端仍会把最大值限制为 100。
export const CRAWLER_TASK_PAGE_SIZE = 20;

/** HGTaskVM 封装任务创建、筛选和游标分页。 */
export default class HGTaskVM {
  /**
   * 获取任务列表。
   * @param {Object} params 查询参数。
   * @returns {Promise<Object>} 包含 list、nextCursor、hasMore 的 result。
   */
  static fetchTasks = ({ cursor = 0, pageSize = CRAWLER_TASK_PAGE_SIZE, status = "" } = {}) => HGNet.get(HGMANAGER_API.CRAWLER_TASKS, { cursor, pageSize, status });

  /**
   * 创建当前版本唯一支持的 Bilibili 推荐任务。
   * @returns {Promise<Object>} 完成后的任务快照。
   */
  static createTask = () => HGNet.post(HGMANAGER_API.CRAWLER_TASKS, { platform: "bilibili", type: "recommendation", priority: 5 });

  /**
   * 将 cursor 分页信息合成为 HGTablePage 可使用的最小 total。
   * hasMore=true 时只额外暴露一条记录，从而允许进入下一页但不伪造完整总量。
   * @param {Object} params 当前分页上下文。
   * @returns {number} 前端分页 total。
   */
  static total = ({ page, pageSize, count, hasMore }) => (page - 1) * pageSize + count + (hasMore ? 1 : 0);

  /** @param {string} status 状态枚举。 @returns {string} 中文状态文案。 */
  static statusText = (status) => ({ SUCCESS: "成功", FAILED: "失败", RUNNING: "运行中", WAIT: "等待" }[status] || status || "-");
}
