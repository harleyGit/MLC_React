import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
import { getRequestErrorMessage } from "../../../../api/hg_request_error";
import { hgSkuIdentity, hgValidateSkuList } from "./hg_recharge_sku_helpers.js";

/** 充值档位 VM：沿用签名/鉴权封装，只调用目录管理接口，不涉及资金变更。 */
export default class HGRechargeSkuVM {
  /** 权限与 SKU 接口均经 Go SuccessResult 返回 result，沿用公共请求层默认解包。 */
  static fetchPermissions = () => HGNet.get(HGMANAGER_API.OPS_ASSET_PERMISSIONS_CURRENT);

  /** 固定 20 条，不透明 cursor 原样传入；Go SKU handler 使用 SuccessResult，响应数据在 result。 */
  static fetchList = (cursor = "") => HGNet.get(
    HGMANAGER_API.OPS_RECHARGE_SKU_LIST, { cursor, pageSize: 20 },
  ).then(hgValidateSkuList);

  /** 禁止包括 401 在内的自动重放，失败后由用户核对列表，避免重复创建。 */
  static save = (body, editing) => HGNet.post(
    editing ? HGMANAGER_API.OPS_RECHARGE_SKU_UPDATE : HGMANAGER_API.OPS_RECHARGE_SKU_CREATE,
    body, { _hasRetried: true },
  );

  /** 删除为携带原始版本的软删除，历史记录由服务端保留。 */
  static delete = (record) => HGNet.post(
    HGMANAGER_API.OPS_RECHARGE_SKU_DELETE, hgSkuIdentity(record),
    { _hasRetried: true },
  );

  /** HTTP 和统一业务码均识别冲突，不自动刷新版本再提交。 */
  static isConflict = (error) => Number(error?.status) === 409 || Number(error?.code) === 409;

  /** 统一错误文案；权限仍以服务端验证为准。 */
  static errorMessage = (error) => HGRechargeSkuVM.isConflict(error)
    ? "SKU code 可能已存在，或档位版本已变更（含已删除）。请关闭弹窗并刷新列表，核对 code 与最新记录后重新操作，不会自动覆盖或重试。"
    : getRequestErrorMessage(error, "请求失败，请稍后重试");
}
