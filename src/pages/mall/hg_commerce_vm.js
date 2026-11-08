import HGMallVM from "./hg_mall_vm.js";

/** 生产 CNY 商品独立协议；不复用 M币价格或 debug 沙箱请求。 */
export default class HGCommerceVM {
  static hgRequest(method, key, params) { return HGMallVM.request(method, key, params); }
  static categories() { return this.hgRequest("get", "COMMERCE_CATEGORIES"); }
  static adminCategories() { return this.hgRequest("get", "COMMERCE_ADMIN_CATEGORIES"); }
  static createCategory(body) { return this.hgRequest("post", "COMMERCE_CATEGORY_CREATE", body); }
  static unusedCategoryImages() { return this.hgRequest("get", "COMMERCE_CATEGORY_IMAGES_UNUSED"); }
  static deleteCategoryImage(imageURL) { return this.hgRequest("post", "COMMERCE_CATEGORY_IMAGE_DELETE", { imageURL }); }
  /** 管理员类目图片直接传二进制；仍由现有请求层处理 JWT、签名和响应。 */
  static async uploadCategoryImage(file) {
    const [{ default: hgNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    const hgExt = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type]; // 仅允许后端支持的图片类型。
    if (!hgExt) throw new Error("类目图片只支持 JPG、PNG、WebP");
    return hgNet.post(`${HGMANAGER_API.COMMERCE_CATEGORY_IMAGE}?ext=${hgExt}`, file, {
      headers: { "Content-Type": file.type }, timeout: 60000,
    });
  }
  // 编辑/删除为前端预留契约：后端实现前调用会失败，页面须如实展示服务端错误。
  static editCategory(categoryId, body) { return this.hgPostWithQuery("COMMERCE_CATEGORY_EDIT", categoryId, body); }
  static deleteCategory(categoryId) { return this.hgRequest("post", "COMMERCE_CATEGORY_DELETE", { categoryId }); }
  static mine(cursor = "") { return this.hgRequest("get", "COMMERCE_MINE", { cursor }); }
  static mineDetail(productId) { return this.hgRequest("get", "COMMERCE_MINE_DETAIL", { productId }); }
  static products(cursor = "") { return this.hgRequest("get", "COMMERCE_PRODUCTS", { cursor }); }
  static detail(productId) { return this.hgRequest("get", "COMMERCE_DETAIL", { productId }); }
  static pending(cursor = "") { return this.hgRequest("get", "COMMERCE_PENDING", { cursor }); }
  static pendingDetail(productId) { return this.hgRequest("get", "COMMERCE_PENDING_DETAIL", { productId }); }
  static edit(productId, body) { return this.hgPostWithQuery("COMMERCE_EDIT", productId, body); }
  static submit(productId, expectedVersion) { return this.hgRequest("post", "COMMERCE_SUBMIT", { productId, expectedVersion }); }
  static publish(productId, expectedVersion) { return this.hgRequest("post", "COMMERCE_PUBLISH", { productId, expectedVersion }); }
  static unpublish(productId, expectedVersion) { return this.hgRequest("post", "COMMERCE_UNPUBLISH", { productId, expectedVersion }); }
  static archive(productId, expectedVersion) { return this.hgRequest("post", "COMMERCE_ARCHIVE", { productId, expectedVersion }); }
  static review(productId, approve, reason = "") { return this.hgRequest("post", "COMMERCE_REVIEW", { productId, approve, reason }); }
  static unusedImages() { return this.hgRequest("get", "COMMERCE_IMAGES_UNUSED"); }
  static deleteImage(imageURL) { return this.hgRequest("post", "COMMERCE_IMAGE_DELETE", { imageURL }); }
  /** debug 交易使用同一 JWT/签名网络层；pre/prod 的真实支付不复用这些模拟接口。 */
  static addresses() { return this.hgRequest("get", "PROFILE_ADDRESSES"); }
  static stock(productId, skuCode) { return this.hgRequest("get", "COMMERCE_STOCK", { productId, skuCode }); }
  static adjustStock(body) { return this.hgRequest("post", "COMMERCE_STOCK_ADJUST", body); }
  static quote(body) { return this.hgRequest("post", "COMMERCE_QUOTE", body); }
  static order(body) { return this.hgRequest("post", "COMMERCE_ORDER_CREATE", body); }
  static orders(cursor = "") { return this.hgRequest("get", "COMMERCE_ORDERS", { cursor }); }
  static orderDetail(orderId) { return this.hgRequest("get", "COMMERCE_ORDER_DETAIL", { orderId }); }
  static pay(orderId) { return this.hgRequest("post", "COMMERCE_ORDER_PAY", { orderId }); }
  static cancel(orderId) { return this.hgRequest("post", "COMMERCE_ORDER_CANCEL", { orderId }); }
  static refund(orderId) { return this.hgRequest("post", "COMMERCE_ORDER_REFUND", { orderId }); }
  static sellerOrders(cursor = "") { return this.hgRequest("get", "COMMERCE_SELLER_ORDERS", { cursor }); }
  static sellerDetail(orderId) { return this.hgRequest("get", "COMMERCE_SELLER_DETAIL", { orderId }); }
  static ship(body) { return this.hgRequest("post", "COMMERCE_ORDER_SHIP", body); }
  static settle(orderId) { return this.hgRequest("post", "COMMERCE_SIM_SETTLE", { orderId }); }
  static reconcile(orderId) { return this.hgRequest("get", "COMMERCE_SIM_RECONCILE", { orderId }); }

  /** 创建草稿以独立请求头承载幂等键，失败后调用方必须重放同一正文和 key。 */
  static async create(body, requestId) {
    const [{ default: hgNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    return hgNet.post(HGMANAGER_API.COMMERCE_CREATE, body, { headers: { "Idempotency-Key": requestId } });
  }

  static async hgPostWithQuery(key, productId, body) {
    const [{ default: hgNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    return hgNet.post(`${HGMANAGER_API[key]}?productId=${encodeURIComponent(productId)}`, body);
  }

  /** 原始二进制复用 JWT 与签名上传链；后端验证扩展名和图片内容。 */
  static async uploadImage(file) {
    const [{ default: hgNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../manager_antd/net_handle/hg_net_manager_vm.jsx"),
      import("../../manager_antd/api/hg_api_constants.jsx"),
    ]);
    // 仅限表单验证通过后的扩展名；AVIF 与 JPG/PNG/WebP 同链上传与展示。
    const hgExt = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[file.type];
    if (!hgExt) throw new Error("只支持 JPG、PNG、WebP 和 AVIF 图片");
    return hgNet.post(`${HGMANAGER_API.COMMERCE_IMAGE}?ext=${hgExt}`, file, { headers: { "Content-Type": file.type }, timeout: 60000 });
  }
}
