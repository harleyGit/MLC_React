import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";

/** HGRecommendationVM 封装最近一次成功采集快照的请求和展示格式转换。 */
export default class HGRecommendationVM {
  /**
   * 获取 manager 保存的最近一次成功快照。
   * 当前后端为有界内存存储，失败任务不会清空旧快照，因此页面可在上游短暂失败时继续降级展示可用数据。
   * @returns {Promise<Object>} 包含 list 的采集结果。
   */
  static fetchRecommendations = () => HGNet.get(HGMANAGER_API.CRAWLER_RECOMMENDATIONS);

  /**
   * 将不可信接口结果收敛为表格可消费数组。
   * @param {Object} result 请求层解包后的 result。
   * @returns {Array<Object>} 推荐快照列表。
   */
  static rows = (result) => (Array.isArray(result?.list) ? result.list : []);

  /** @param {number} seconds 视频时长秒数。 @returns {string} mm:ss 或 h:mm:ss。 */
  static durationText = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remain = Math.floor(total % 60);
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
      : `${minutes}:${String(remain).padStart(2, "0")}`;
  };

  /** @param {number} value 指标数值。 @returns {string} 本地化整数。 */
  static countText = (value) => Math.max(0, Number(value) || 0).toLocaleString();
}
