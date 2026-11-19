/** 顶部导航仅根据可确定归属的站内路径切换；未知页面保留来源 Tab，直达时不伪造 Chat。 */
export function hgTopNavKeyForPath(path, routes) {
  // 路由常量由调用方注入，避免导航规则和页面路由各维护一份路径。
  const within = (root) => path === root || path.startsWith(`${root}/`);

  if (path === routes.DEFAULT || path === routes.HOME || within(routes.ADD_CONTACT)) return "home";
  // 订单详情与类目编辑可从商品、个人中心或运维进入，不能按 /mall 一概高亮商品。
  if (within(routes.PRODUCTS) || within("/mall/cny") ||
      (within("/mall/commerce") && !within("/mall/commerce/category"))) return "products";
  if (path === routes.MESSAGE_CENTER) return "message";
  if (within(routes.CRAWLER_PLATFORM)) return "crawler";
  if (within(routes.OPERATION_MANAGEMENT) || within("/profile/user")) return "operation";
  if (path === routes.TEST_MODULE || within("/demo/table")) return "test_module";
  if (within("/bilibili")) return "bili_douga";
  if (within(routes.PERSONAL_CENTER) || within("/platform/upload/video")) return "personal_center";
  if (path === routes.USER_PROFILE || path === routes.UPDATE_USER_PROIFE || path === routes.USER_CENTER) return "profile";
  if (within("/account/setting") || within("/account/address") || within("/account/wallet")) return "avatar";
  return null;
}
