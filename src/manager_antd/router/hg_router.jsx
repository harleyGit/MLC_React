/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:58:51
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 10:58:37
 * @FilePath: /MLC_React/src/manager_antd/router/hg_index.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createBrowserRouter } from "react-router-dom";
import HGAuthGuard from "../auth/hg_auth_guard";
import HGHomePage from "../home/hg_home_page";
import HGRegisterPage from "../login_module/hg_ register_page";
import HGLoginPage from "../login_module/hg_login_page";
import HGUpdateUserProfilePage from "../user/hg_update_user_profile_page";
import HGUserProfilePage from "../user/hg_user_profile_page";
import { ROUTE_PATH } from "./hg_router_path";

const HGRouter = createBrowserRouter([
  {
    path: ROUTE_PATH.UPDATE_USER_PROIFE,
    element: (
      <HGAuthGuard>
        <HGUpdateUserProfilePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.USER_PROFILE,
    element: (
      <HGAuthGuard>
        <HGUserProfilePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.DEFAULT,
    element: (
      <HGAuthGuard>
        <HGHomePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.HOME,
    element: (
      <HGAuthGuard>
        <HGHomePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.USER_PROFILE,
    element: (
      <HGAuthGuard>
        <HGUserProfilePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.UPDATE_USER_PROIFE,
    element: (
      <HGAuthGuard>
        <HGUpdateUserProfilePage />
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.LOGIN,
    element: <HGLoginPage />,
  },
  {
    path: ROUTE_PATH.REGISTER,
    element: <HGRegisterPage />,
  },
]);

export default HGRouter;
