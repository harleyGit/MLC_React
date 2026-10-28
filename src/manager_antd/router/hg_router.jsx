/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:58:51
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-08-15 16:09:22
 * @FilePath: /MLC_React/src/manager_antd/router/hg_index.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import HGLoading from "../../components/hg_loading";
import HGAuthGuard from "../auth/hg_auth_guard";
import HGAdminGuard from "../auth/hg_admin_guard";
import HGHomePage from "../page_modules/home/hg_home_page";
import HGTopNavLayout from "../page_modules/home/hg_top_nav_layout";
import { WithNavigation } from "./hg_naviagion_hook";
import { ROUTE_PATH } from "./hg_router_path";
import { PAGE, getHGPageConfig } from "../../components/hg_navigation/hg_page_registry";
import { hgPageNavigator } from "../../components/hg_navigation/hg_page_navigator";

// 首页和布局保持 eager，其余页面复用注册表中的稳定 lazy 组件。
const HGAboutPage = getHGPageConfig(PAGE.ABOUT).component;
const HGRegisterPage = getHGPageConfig(PAGE.REGISTER).component;
const HGLoginPage = getHGPageConfig(PAGE.LOGIN).component;
const HGForgetPasswordPage = getHGPageConfig(PAGE.FORGET_PASSWORD).component;
const HGProducts = getHGPageConfig(PAGE.PRODUCTS).component;
const HGMallOrderPage = getHGPageConfig(PAGE.MALL_ORDER_DETAIL).component;
const HGEditUserPage = getHGPageConfig(PAGE.EDIT_USER_INFO).component;
const HGUserCenterPage = getHGPageConfig(PAGE.USER_CENTER).component;
const HGWalletPage = getHGPageConfig(PAGE.WALLET).component;
const HGWalletRechargePage = getHGPageConfig(PAGE.WALLET_RECHARGE).component;
// 全部充值记录的稳定 lazy 页面，使用独立 URL 并沿用主布局鉴权。
const HGWalletRecordsPage = getHGPageConfig(PAGE.WALLET_RECORDS).component;
const HGWalletSpendingPage = getHGPageConfig(PAGE.WALLET_SPENDING).component;
const HGVideoUploadEditPage = getHGPageConfig(PAGE.VIDEO_UPLOAD_EDIT).component;
const HGUpdateUserProfilePage = getHGPageConfig(PAGE.UPDATE_USER_PROIFE).component;
const HGUserProfilePage = getHGPageConfig(PAGE.USER_PROFILE).component;
const HGTestModulePage = getHGPageConfig(PAGE.TEST_MODULE).component;
const HGTableDemoPage = getHGPageConfig(PAGE.TABLE_DEMO).component;
const BiliDougaPage = getHGPageConfig(PAGE.BILI_DOUGA).component;
const HGBiliContentPage = getHGPageConfig(PAGE.BILI_CONTENT).component;
const HGBiliAuthorSpacePage = getHGPageConfig(PAGE.BILI_AUTHOR_SPACE).component;
const HGContentCenterPage = getHGPageConfig(PAGE.PERSONAL_CENTER).component;
const HGUserSpacePage = getHGPageConfig(PAGE.USER_SPACE).component;
const HGOperationManagementPage = getHGPageConfig(PAGE.OPERATION_MANAGEMENT).component;
const HGCrawlerPlatformPage = getHGPageConfig(PAGE.CRAWLER_PLATFORM).component;

// 静态路由创建 Suspense 元素时不会加载模块，仅实际渲染对应页面时加载。
const hgLazyElement = (element, text = "正在加载页面...") => (
  <Suspense fallback={<HGLoading text={text} />}>{element}</Suspense>
);

// 包装布局组件以支持类组件访问路由方法
const WrappedHGTopNavLayout = WithNavigation(HGTopNavLayout);
const WrappedHGHomePage = WithNavigation(HGHomePage);
const WrappedHGEditUserPage = WithNavigation(HGEditUserPage);
const WrappedHGWalletPage = WithNavigation(HGWalletPage);
const WrappedHGWalletRechargePage = WithNavigation(HGWalletRechargePage);
// 为记录页注入 location，浏览器后退或路由重新进入时刷新记录。
const WrappedHGWalletRecordsPage = WithNavigation(HGWalletRecordsPage);
const WrappedHGMallOrderPage = WithNavigation(HGMallOrderPage);
const WrappedHGWalletSpendingPage = WithNavigation(HGWalletSpendingPage);
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
        path: ROUTE_PATH.MALL_ORDER_DETAIL,
        element: hgLazyElement(<WrappedHGMallOrderPage />),
      },
      {
        path: ROUTE_PATH.ABOUT,
        element: hgLazyElement(<HGAboutPage />),
      },
      {
        path: ROUTE_PATH.DEFAULT,
        element: <WrappedHGHomePage />,
      },
      {
        path: ROUTE_PATH.HOME,
        element: <WrappedHGHomePage />,
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
        path: ROUTE_PATH.USER_CENTER,
        element: hgLazyElement(<HGUserCenterPage />),
      },
      {
        path: ROUTE_PATH.WALLET,
        element: hgLazyElement(<WrappedHGWalletPage />),
      },
      {
        path: ROUTE_PATH.WALLET_RECHARGE,
        element: hgLazyElement(<WrappedHGWalletRechargePage />),
      },
      {
        path: ROUTE_PATH.WALLET_RECORDS,
        element: hgLazyElement(<WrappedHGWalletRecordsPage />),
      },
      {
        path: ROUTE_PATH.WALLET_SPENDING,
        element: hgLazyElement(<WrappedHGWalletSpendingPage />),
      },
      {
        path: ROUTE_PATH.VIDEO_UPLOAD_EDIT,
        element: hgLazyElement(<WrappedHGVideoUploadEditPage />),
      },
      {
        path: ROUTE_PATH.OPERATION_MANAGEMENT,
        element: hgLazyElement(
          <HGAdminGuard><HGOperationManagementPage /></HGAdminGuard>,
          "正在加载运维管理..."
        ),
      },
      {
        path: ROUTE_PATH.CRAWLER_PLATFORM,
        element: hgLazyElement(<HGAdminGuard><HGCrawlerPlatformPage /></HGAdminGuard>, "正在加载采集平台..."),
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
    element: <HGAuthGuard>{hgLazyElement(<HGUserProfilePage />)}</HGAuthGuard>,
  },
  {
    path: ROUTE_PATH.UPDATE_USER_PROIFE,
    element: (
      <HGAuthGuard>{hgLazyElement(<HGUpdateUserProfilePage />)}</HGAuthGuard>
    ),
  },
  {
    path: ROUTE_PATH.EDIT_USER_INFO,
    element: (
      <HGAuthGuard>{hgLazyElement(<WrappedHGEditUserPage />)}</HGAuthGuard>
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

// 导航器由调用方实现；路由实例创建完成后再注入，避免反向导入 router。
hgPageNavigator.attach(HGRouter);

export default HGRouter;
