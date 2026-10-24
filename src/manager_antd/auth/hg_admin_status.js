import HGNet from "../net_handle/hg_net_manager_vm";
import { HGMANAGER_API } from "../api/hg_api_constants";

/** 始终向服务端核对当前 JWT 的管理员状态；失败时不开放管理入口。 */
export async function hgGetAdminStatus() {
  const hgResult = await HGNet.get(HGMANAGER_API.MALL_ADMIN_STATUS);
  return hgResult?.isAdmin === true;
}
