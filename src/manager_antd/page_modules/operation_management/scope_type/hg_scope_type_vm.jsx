import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/** 作用域类型管理请求；创建/编辑透传整数 status（0 停用、1 启用），资源规则及停用限制由后端校验。 */
export default class HGScopeTypeVM {
  static list = (cursor = 0) => HGNet.get(HGMANAGER_API.IAM_SCOPE_TYPE_LIST, { cursor, pageSize: 50 });
  static detail = (code) => HGNet.get(HGMANAGER_API.IAM_SCOPE_TYPE_DETAIL, { code });
  static create = (form) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_CREATE, form);
  static update = (form) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_UPDATE, form);
  static disable = (code) => HGNet.post(HGMANAGER_API.IAM_SCOPE_TYPE_DISABLE, { code });
}
