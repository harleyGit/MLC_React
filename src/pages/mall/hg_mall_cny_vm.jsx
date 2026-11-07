import HGMallVM from "./hg_mall_vm.js";

/** CNY 与 M币交易分别请求不同路由；统一走已有签名、JWT 和响应解包链。 */
export default class HGMallCNYVM {
  static products(cursor = "") { return HGMallVM.request("get", "MALL_CNY_PRODUCTS", { cursor }); }
  static detail(productId) { return HGMallVM.request("get", "MALL_CNY_DETAIL", { productId }); }
  static publish(body) { return HGMallVM.request("post", "MALL_CNY_PUBLISH", body); }
  static createCoupon(body) { return HGMallVM.request("post", "MALL_CNY_COUPON_CREATE", body); }
  static coupons(productId) { return HGMallVM.request("get", "MALL_CNY_COUPONS", { productId }); }
  static claim(productId, couponId) { return HGMallVM.request("post", "MALL_CNY_CLAIM", { productId, couponId }); }
  static preview(body) { return HGMallVM.request("post", "MALL_CNY_PREVIEW", body); }
  static buy(body) { return HGMallVM.request("post", "MALL_CNY_BUY", body); }
  static groups(productId) { return HGMallVM.request("get", "MALL_CNY_GROUPS", { productId }); }
  static group(groupId) { return HGMallVM.request("get", "MALL_CNY_GROUP", { groupId }); }
  static orders(cursor = "") { return HGMallVM.request("get", "MALL_CNY_ORDERS", { cursor }); }
  static order(orderId) { return HGMallVM.request("get", "MALL_CNY_ORDER", { orderId }); }
  static pay(orderId) { return HGMallVM.request("post", "MALL_CNY_PAY", { orderId }); }
  static cancel(orderId) { return HGMallVM.request("post", "MALL_CNY_CANCEL", { orderId }); }
  static refund(orderId) { return HGMallVM.request("post", "MALL_CNY_REFUND", { orderId }); }
  static capabilities() { return HGMallVM.request("get", "MALL_CNY_CAPABILITIES"); }
}
