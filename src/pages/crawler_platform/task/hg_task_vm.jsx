import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";

// 默认页大小与后端 manager 默认值一致；页面允许切换，但后端仍会把最大值限制为 100。
export const CRAWLER_TASK_PAGE_SIZE = 20;

/** HGTaskVM 封装持久化任务定义的游标分页和响应兼容。 */
export default class HGTaskVM {
  /**
   * 获取任务列表。
   * @param {Object} params 查询参数。
   * @returns {Promise<Object>} 包含 list、nextCursor、hasMore 的标准化 result。
   */
  static fetchTasks = ({ cursor = 0, pageSize = CRAWLER_TASK_PAGE_SIZE } = {}) => HGNet.get(
    HGMANAGER_API.OPS_CRAWLER_TASK_LIST,
    { cursor, pageSize }
  ).then(HGTaskVM.normalizeList);

  /** Normalizes current Go response field casing into the table model. */
  static normalizeList = (result = {}) => {
    const items = result.items || result.Items || result.list || result.List || [];
    return {
      list: items.map((item) => ({
        id: item.id ?? item.ID,
        name: item.name ?? item.Name,
        platform: item.platform ?? item.Platform,
        enabled: item.enabled ?? item.Enabled,
        cron: item.cron ?? item.Cron,
        parserType: item.parserType ?? item.ParserType,
        itemPath: item.itemPath ?? item.ItemPath,
        maxItems: item.maxItems ?? item.MaxItems,
        configuration: item.configuration ?? item.Configuration ?? {},
        lastRunId: item.lastRunId ?? item.LastRunID ?? 0,
        lastRunStatus: item.lastRunStatus ?? item.LastRunStatus,
        lastRunStartedAt: item.lastRunStartedAt ?? item.LastRunStartedAt,
        lastRunFinishedAt: item.lastRunFinishedAt ?? item.LastRunFinishedAt,
        lastRunItemCount: item.lastRunItemCount ?? item.LastRunItemCount,
        lastRunError: item.lastRunError ?? item.LastRunError,
        createdBy: item.createdBy ?? item.CreatedBy,
        updatedBy: item.updatedBy ?? item.UpdatedBy,
        createdAt: item.createdAt ?? item.CreatedAt,
        updatedAt: item.updatedAt ?? item.UpdatedAt,
        version: item.version ?? item.Version,
      })),
      nextCursor: result.nextCursor ?? result.NextCursor ?? 0,
      hasMore: Boolean(result.hasMore ?? result.HasMore),
    };
  };

  /**
   * 将 cursor 分页信息合成为 HGTablePage 可使用的最小 total。
   * hasMore=true 时只额外暴露一条记录，从而允许进入下一页但不伪造完整总量。
   * @param {Object} params 当前分页上下文。
   * @returns {number} 前端分页 total。
   */
  static total = ({ page, pageSize, count, hasMore }) => (page - 1) * pageSize + count + (hasMore ? 1 : 0);

  /** @param {string} status 状态枚举。 @returns {string} 中文状态文案。 */
  static statusText = (status) => ({ succeeded: "成功", failed: "失败", running: "运行中", SUCCESS: "成功", FAILED: "失败", RUNNING: "运行中" }[status] || status || "未运行");
}
