/* eslint-disable react-refresh/only-export-components -- 注册表导出页面标识和查询函数，不是组件入口。 */
import { lazy } from "react";
import { matchPath } from "react-router-dom";
import { ROUTE_PATH } from "./hg_route_path";

// 页面标识与路径常量保持同键，包括既有 UPDATE_USER_PROIFE 拼写。
export const PAGE = Object.freeze(
  Object.fromEntries(Object.keys(ROUTE_PATH).map((page) => [page, page]))
);

// 注册表不静态导入业务页，避免页面引用 PAGE 时形成 eager 循环。
// router 仍直接 eager 导入首页和布局；这里的首页描述不改变首屏加载方式。
const HGHomePage = lazy(() => import("../../manager_antd/page_modules/home/hg_home_page"));
const HGBiliContentPage = lazy(() => import("../../pages/bilibili/video_detail/hg_bili_content_page"));
const components = {
  ABOUT: lazy(() => import("../../manager_antd/page_modules/about/hg_about_page")),
  PRODUCTS: lazy(() => import("../../manager_antd/page_modules/product/hg_ products_page")),
  MALL: lazy(() => import("../../pages/mall/hg_mall_page.jsx")),
  MALL_ORDER_DETAIL: lazy(() => import("../../pages/mall/hg_mall_order_page.jsx")), // 商品订单详情独立路由。
  DEFAULT: HGHomePage,
  HOME: HGHomePage,
  USER_PROFILE: lazy(() => import("../../manager_antd/page_modules/user/hg_user_profile_page")),
  UPDATE_USER_PROIFE: lazy(() => import("../../manager_antd/page_modules/user/hg_update_user_profile_page")),
  EDIT_USER_INFO: lazy(() => import("../../manager_antd/page_modules/user/edit_user_info/hg_edit_user_page")),
  USER_CENTER: lazy(() => import("../../manager_antd/page_modules/user/user_center/hg_user_center_page")), // 个人中心，侧边栏 + 我的订单。
  WALLET: lazy(() => import("../../manager_antd/page_modules/user/wallet/hg_wallet_page")),
  WALLET_RECHARGE: lazy(() => import("../../manager_antd/page_modules/user/wallet/hg_wallet_recharge_page")),
  WALLET_RECORDS: lazy(() => import("../../manager_antd/page_modules/user/wallet/hg_wallet_records_page")), // 全部充值记录的独立页面。
  WALLET_SPENDING: lazy(() => import("../../manager_antd/page_modules/user/wallet/hg_wallet_spending_page.jsx")), // 本人商品消费记录。
  VIDEO_UPLOAD_EDIT: lazy(() => import("../../manager_antd/page_modules/hg_video_upload/hg_video_upload_edit_page")),
  OPERATION_MANAGEMENT: lazy(() => import("../../manager_antd/page_modules/operation_management/hg_operation_management_page")),
  TEST_MODULE: lazy(() => import("../../manager_antd/page_modules/test_module/hg_test_module_page")),
  LOGIN: lazy(() => import("../../manager_antd/page_modules/login_module/hg_login_page")),
  REGISTER: lazy(() => import("../../manager_antd/page_modules/login_module/hg_ register_page")),
  FORGET_PASSWORD: lazy(() => import("../../manager_antd/page_modules/login_module/hg_forget_password_page")),
  TABLE_DEMO: lazy(() => import("../hg_table/hg_table_demo_page")),
  BILI_DOUGA: lazy(() => import("../../pages/bilibili/hg_bili_douga_page")),
  BILI_CONTENT: HGBiliContentPage,
  BILI_VIDEO_CONTENT: HGBiliContentPage,
  BILI_CHANNEL_CONTENT: HGBiliContentPage,
  BILI_AUTHOR_SPACE: lazy(() => import("../../pages/bilibili/author_info/hg_bili_author_space_page")),
  PERSONAL_CENTER: lazy(() => import("../../manager_antd/page_modules/personal_center/hg_content_center_page")),
  USER_SPACE: lazy(() => import("../../manager_antd/page_modules/user_space/hg_user_space_page")),
  CRAWLER_PLATFORM: lazy(() => import("../../pages/crawler_platform/hg_crawler_platform_page")),
};

const registry = Object.freeze(Object.fromEntries(
  Object.entries(ROUTE_PATH).map(([page, route]) => [
    page, Object.freeze({ route, component: components[page] }),
  ])
));

/** 返回稳定的页面配置；未知标识返回 null，不接受对象原型上的名称。 */
export function getHGPageConfig(page) {
  return typeof page === "string" && Object.hasOwn(registry, page)
    ? registry[page]
    : null;
}

// 具体内容类型必须先于通用 :contentType 模板匹配。
const targetPages = [
  PAGE.BILI_VIDEO_CONTENT,
  PAGE.BILI_CHANNEL_CONTENT,
  ...Object.keys(PAGE).filter((page) =>
    page !== PAGE.BILI_VIDEO_CONTENT && page !== PAGE.BILI_CHANNEL_CONTENT
  ),
];

/**
 * 解析站内根路径；外部、协议相对、非法编码及未知路由返回 null。
 * pathParams 为解码一次的原始值；params 保留重复查询参数，hash 保留 # 前缀。
 */
export function getHGPageTarget(url) {
  if (typeof url !== "string" || !url.startsWith("/") ||
      url.startsWith("//") || url.includes("\\") ||
      Array.from(url).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
    return null;
  }

  try {
    // 固定基准仅用于拆分，不访问网络，也不依赖浏览器当前位置。
    const parsed = new URL(url, "https://hg.invalid");
    if (parsed.origin !== "https://hg.invalid") return null;
    decodeURIComponent(parsed.pathname);
    for (const page of targetPages) {
      const match = matchPath(registry[page].route, parsed.pathname);
      if (!match) continue;
      const pathParams = Object.fromEntries(
        Object.entries(match.params).map(([key, value]) => [key, decodeURIComponent(value)])
      );
      return { page, pathParams, params: parsed.searchParams, hash: parsed.hash };
    }
  } catch {
    return null;
  }
  return null;
}
