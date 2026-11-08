import HGMallVM from "./hg_mall_vm.js";

/** 生产 CNY 商品独立协议；不复用 M币价格或 debug 沙箱请求。 */
export default class HGCommerceVM {
  static hgRequest(method, key, params) { return HGMallVM.request(method, key, params); }
  static categories() { return this.hgRequest("get", "COMMERCE_CATEGORIES"); }
  static createCategory(body) { return this.hgRequest("post", "COMMERCE_CATEGORY_CREATE", body); }
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
