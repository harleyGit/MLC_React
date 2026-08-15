import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";

/** HGSpiderVM 封装 Spider 列表和启停操作。 */
export default class HGSpiderVM {
  /** @returns {Promise<Object>} Spider 列表 result。 */
  static fetchSpiders = () => HGNet.get(HGMANAGER_API.CRAWLER_SPIDERS);

  /** @param {string} id Spider 标识。 @returns {Promise<Object>} 启动后的状态快照。 */
  static start = (id) => HGNet.post(HGMANAGER_API.CRAWLER_SPIDER_START(id), {});

  /** @param {string} id Spider 标识。 @returns {Promise<Object>} 停止后的状态快照。 */
  static stop = (id) => HGNet.post(HGMANAGER_API.CRAWLER_SPIDER_STOP(id), {});

  /**
   * 将异常或缺失 list 归一为空数组，保持 HGTablePage dataSource 契约稳定。
   * @param {Object} result 后端 result。
   * @returns {Array<Object>} Spider 行。
   */
  static rows = (result) => Array.isArray(result?.list) ? result.list : [];
}
