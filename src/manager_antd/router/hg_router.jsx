/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:58:51
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-03 10:45:13
 * @FilePath: /MLC_React/src/manager_antd/router/hg_index.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createBrowserRouter } from "react-router-dom";
import HGAuthGuard from "../auth/hg_auth_guard";
import HGHomePage from "../page_modules/home/hg_home_page";
import HGTopNavLayout from "../page_modules/home/hg_top_nav_layout";
import HGRegisterPage from "../page_modules/login_module/hg_ register_page";
import HGLoginPage from "../page_modules/login_module/hg_login_page";
import HGUpdateUserProfilePage from "../page_modules/user/hg_update_user_profile_page";
import HGUserProfilePage from "../page_modules/user/hg_user_profile_page";
import { WithNavigation } from "./hg_naviagion_hook";
import { ROUTE_PATH } from "./hg_router_path";

// 包装布局组件以支持类组件访问路由方法
const WrappedHGTopNavLayout = WithNavigation(HGTopNavLayout);

const HGRouter = createBrowserRouter([
  //受保护的主布局路由
  {
    element: (
      <HGAuthGuard>
        <WrappedHGTopNavLayout />
      </HGAuthGuard>
    ),
    children: [
      {
        path: ROUTE_PATH.DEFAULT,
        element: <HGHomePage />,
      },
      {
        path: ROUTE_PATH.HOME,
        element: <HGHomePage />,
      },
      {
        path: ROUTE_PATH.UPDATE_USER_PROIFE,
        element: <HGUpdateUserProfilePage />,
      },
      {
        path: ROUTE_PATH.USER_PROFILE,
        element: <HGUserProfilePage />,
      },
    ],
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
