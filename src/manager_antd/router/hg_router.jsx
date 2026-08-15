/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:58:51
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-04-23 00:10:19
 * @FilePath: /MLC_React/src/manager_antd/router/hg_index.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createBrowserRouter } from "react-router-dom";
import HGAuthGuard from "../auth/hg_auth_guard";
import HGHomePage from "../page_modules/home/hg_home_page";
import HGTopNavLayout from "../page_modules/home/hg_top_nav_layout";
import { WithNavigation } from "./hg_naviagion_hook";
import { ROUTE_PATH } from "./hg_router_path";
import React, { lazy, Suspense } from "react";
import HGLoading from "../../components/hg_loading";

// Keep the authenticated shell and home page eager; defer non-home route trees so their forms, tables, and media code stay out of the initial bundle.
const HGAboutPage = lazy(() => import("../page_modules/about/hg_about_page"));
const HGRegisterPage = lazy(() => import("../page_modules/login_module/hg_ register_page"));
const HGLoginPage = lazy(() => import("../page_modules/login_module/hg_login_page"));
const HGForgetPasswordPage = lazy(() => import("../page_modules/login_module/hg_forget_password_page"));
const HGProducts = lazy(() => import("../page_modules/product/hg_ products_page"));
const HGEditUserPage = lazy(() => import("../page_modules/user/edit_user_info/hg_edit_user_page"));
const HGVideoUploadEditPage = lazy(() => import("../page_modules/hg_video_upload/hg_video_upload_edit_page"));
const HGUpdateUserProfilePage = lazy(() => import("../page_modules/user/hg_update_user_profile_page"));
const HGUserProfilePage = lazy(() => import("../page_modules/user/hg_user_profile_page"));
const HGTestModulePage = lazy(() => import("../page_modules/test_module/hg_test_module_page"));
const HGTableDemoPage = lazy(() => import("../../components/hg_table/hg_table_demo_page"));
const BiliDougaPage = lazy(() => import("../../pages/bilibili/hg_bili_douga_page"));
const HGBiliContentPage = lazy(() => import("../../pages/bilibili/hg_bili_content_page"));
const HGBiliAuthorSpacePage = lazy(() => import("../../pages/bilibili/hg_bili_author_space_page"));
const HGContentCenterPage = lazy(() => import("../page_modules/personal_center/hg_content_center_page"));
const HGUserSpacePage = lazy(() => import("../page_modules/user_space/hg_user_space_page"));
const HGOperationManagementPage = lazy(() =>
  import("../page_modules/operation_management/hg_operation_management_page")
);

// Route definitions are static, so creating the Suspense element here does not trigger a dynamic import until the route renders.
const hgLazyElement = (element, text = "正在加载页面...") => (
  <Suspense fallback={<HGLoading text={text} />}>{element}</Suspense>
);

// 包装布局组件以支持类组件访问路由方法
const WrappedHGTopNavLayout = WithNavigation(HGTopNavLayout);
const WrappedHGEditUserPage = WithNavigation(HGEditUserPage);
const WrappedHGVideoUploadEditPage = WithNavigation(HGVideoUploadEditPage);
const WrappedHGUserSpacePage = WithNavigation(HGUserSpacePage);
const WrappedHGBiliAuthorSpacePage = WithNavigation(HGBiliAuthorSpacePage);

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
        path: ROUTE_PATH.PRODUCTS,
        element: hgLazyElement(<HGProducts />),
      },
      {
        path: ROUTE_PATH.ABOUT,
        element: hgLazyElement(<HGAboutPage />),
      },
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
        element: hgLazyElement(<HGUpdateUserProfilePage />),
      },
      {
        path: ROUTE_PATH.USER_PROFILE,
        element: hgLazyElement(<HGUserProfilePage />),
      },
      {
        path: ROUTE_PATH.EDIT_USER_INFO,
        element: hgLazyElement(<WrappedHGEditUserPage />),
      },
      {
        path: ROUTE_PATH.VIDEO_UPLOAD_EDIT,
        element: hgLazyElement(<WrappedHGVideoUploadEditPage />),
      },
      {
        path: ROUTE_PATH.OPERATION_MANAGEMENT,
        element: hgLazyElement(<HGOperationManagementPage />, "正在加载运维管理..."),
      },
      {
        path: ROUTE_PATH.TEST_MODULE,
        element: hgLazyElement(<HGTestModulePage />),
      },
      {
        path: ROUTE_PATH.TABLE_DEMO,
        element: hgLazyElement(<HGTableDemoPage />),
      },
      {
        path: ROUTE_PATH.BILI_DOUGA,
        element: hgLazyElement(<BiliDougaPage />),
      },
      {
        path: ROUTE_PATH.BILI_CONTENT,
        element: hgLazyElement(<HGBiliContentPage />),
      },
      {
        path: ROUTE_PATH.BILI_AUTHOR_SPACE,
        element: hgLazyElement(<WrappedHGBiliAuthorSpacePage />),
      },
      {
        path: ROUTE_PATH.PERSONAL_CENTER,
        element: hgLazyElement(<HGContentCenterPage />),
      },
      {
        path: ROUTE_PATH.USER_SPACE,
        element: hgLazyElement(<WrappedHGUserSpacePage />),
      },
    ],
  },

  {
    path: ROUTE_PATH.USER_PROFILE,
    element: (
      <HGAuthGuard>
        {hgLazyElement(<HGUserProfilePage />)}
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.UPDATE_USER_PROIFE,
    element: (
      <HGAuthGuard>
        {hgLazyElement(<HGUpdateUserProfilePage />)}
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.EDIT_USER_INFO,
    element: (
      <HGAuthGuard>
        {hgLazyElement(<WrappedHGEditUserPage />)}
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.VIDEO_UPLOAD_EDIT,
    element: (
      <HGAuthGuard>
        {hgLazyElement(<WrappedHGVideoUploadEditPage />)}
      </HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.LOGIN,
    element: hgLazyElement(<HGLoginPage />),
  },
  {
    path: ROUTE_PATH.REGISTER,
    element: hgLazyElement(<HGRegisterPage />),
  },
  {
    path: ROUTE_PATH.FORGET_PASSWORD,
    element: hgLazyElement(<HGForgetPasswordPage />),
  },
]);

export default HGRouter;
