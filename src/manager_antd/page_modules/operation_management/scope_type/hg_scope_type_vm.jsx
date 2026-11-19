import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/** 作用域类型字典的管理请求；状态与 ID 规则由后端决定，页面不提交启用请求。 */
export default class HGScopeTypeVM {
  static list = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_SCOPE_TYPE_LIST, { cursor, pageSize: 50 });
  static detail = (code) => HGNet.get(HGMANAGER_API.IAM_SCOPE_TYPE_DETAIL, { code });
  static create = (form) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_CREATE, form);
  static update = (form) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_UPDATE, form);
  static disable = (code) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_DISABLE, { code });
}
