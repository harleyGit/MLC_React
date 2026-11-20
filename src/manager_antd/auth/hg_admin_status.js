/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-24 14:54:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-20 15:32:33
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_admin_status.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { HGMANAGER_API } from "../api/hg_api_constants";
import HGNet from "../net_handle/hg_net_manager_vm";

/** 始终向服务端核对当前 JWT 的管理员状态；失败时不开放管理入口。 */
export async function hgGetAdminStatus() {
  const hgResult = await HGNet.get(HGMANAGER_API.MALL_ADMIN_STATUS);
  return hgResult?.isAdmin === true;
}
