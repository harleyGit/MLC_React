/** 商城调用既有签名、JWT 和响应解包链，绝不生成本地商品、支付或会员权益。 */
export default class HGMallVM {
  static async request(method, key, params) {
    const [{ default: HGNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    return HGNet[method](HGMANAGER_API[key], params);
  }

  static products(category = "", cursor = "") { return this.request("get", "MALL_PRODUCTS", { category, cursor }); }
  static detail(productId) { return this.request("get", "MALL_DETAIL", { productId }); }
  static merchant() { return this.request("get", "MALL_MERCHANT"); }
  static apply(shopName) { return this.request("post", "MALL_APPLY", { shopName }); }
  static publish(draft) { return this.request("post", "MALL_PUBLISH", draft); }
  /** 图片直接上传原始二进制，复用签名与 JWT；服务端检查 MIME 魔数、尺寸及店铺归属。 */
  static async uploadImage(file) {
    const [{ default: HGNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    const hgExt = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"; // 仅在页面校验通过后调用。
    return HGNet.post(`${HGMANAGER_API.MALL_PRODUCT_IMAGE}?ext=${hgExt}`, file, {
      headers: { "Content-Type": file.type }, timeout: 60000,
    });
  }
  static deleteImage(imageURL) { return this.request("post", "MALL_PRODUCT_IMAGE_DELETE", { imageURL }); }
  static unusedImages() { return this.request("get", "MALL_UNUSED_IMAGES"); }
  static mine(cursor = "") { return this.request("get", "MALL_MINE", { cursor }); }
  static pendingMerchants(cursor = "") { return this.request("get", "MALL_PENDING_MERCHANTS", { cursor }); }
  static pendingProducts(cursor = "") { return this.request("get", "MALL_PENDING_PRODUCTS", { cursor }); }
  static reviewMerchant(merchantId, approve) { return this.request("post", "MALL_REVIEW_MERCHANT", { merchantId, approve }); }
  static reviewProduct(productId, approve) { return this.request("post", "MALL_REVIEW_PRODUCT", { productId, approve }); }
  static buy(hgBody) { return this.request("post", "MALL_BUY", hgBody); }
  static pay(orderId) { return this.request("post", "MALL_PAY", { orderId }); }
  static pendingOrders(cursor = "") { return this.request("get", "MALL_PENDING_ORDERS", { cursor }); }
  static orders(cursor = "") { return this.request("get", "MALL_ORDERS", { cursor }); }
  static orderDetail(orderId) { return this.request("get", "MALL_ORDER_DETAIL", { orderId }); }
  static receive(orderId) { return this.request("post", "MALL_RECEIVE", { orderId }); }
  static refund(orderId, requestId) { return this.request("post", "MALL_REFUND", { orderId, requestId }); }
  static merchantOrders(cursor = "") { return this.request("get", "MALL_MERCHANT_ORDERS", { cursor }); }
  static merchantOrderDetail(orderId) { return this.request("get", "MALL_MERCHANT_ORDER_DETAIL", { orderId }); }
  static ship(orderId, carrier, trackingNumber) { return this.request("post", "MALL_SHIP", { orderId, carrier, trackingNumber }); }
}
