import hgNet from "../../../net_handle/hg_net_manager_vm"; // 请求层默认导出单例，不可再次 new。
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import { hgIMEndpoint } from "../../../net_handle/hg_im_endpoint";

// 仅展示审核器当前支持、且与媒体模块用途/MIME/大小白名单一致的业务用途。
export const SCENE_OPTIONS = [
  { value: "user_avatar", label: "本人头像（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "user_cover", label: "本人封面（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "product_main", label: "商品主图（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "product_detail", label: "商品详情图（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "product_sku", label: "商品 SKU 图（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "shop_logo", label: "店铺标识（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "video_cover", label: "视频封面（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
  { value: "video_source", label: "视频源文件（≤50MB）", mimes: ["video/mp4", "video/quicktime"], max: 50 << 20 },
  { value: "support_evidence", label: "客服凭证（图片/视频/PDF，≤20MB）", mimes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"], max: 20 << 20 },
  { value: "marketing_poster", label: "营销海报（图片）", mimes: ["image/jpeg", "image/png", "image/webp"], max: 10 << 20 },
];

const hgUUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

/** 本人媒体操作：页面不能指定 owner、对象键或审核状态。 */
export default class HGFileManagementVM {
  static formatFileSize(bytes) {
    return Number.isFinite(bytes) && bytes >= 0 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "--";
  }

  static validateFile(file, purpose) {
    const policy = SCENE_OPTIONS.find((item) => item.value === purpose);
    if (!policy || !file || !policy.mimes.includes(file.type) || file.size < 1 || file.size > policy.max) {
      throw new Error("业务用途、文件类型或大小不符合上传策略");
    }
  }

  /** 顺序执行：摘要最多处理 50MB；完成仅表示进入待审核，不代表可以引用。 */
  static async uploadFile(file, purpose, hgOnInit, hgSignal) {
    HGFileManagementVM.validateFile(file, purpose);
    if (!globalThis.crypto?.subtle || !globalThis.crypto.randomUUID) {
      throw new Error("上传需要 HTTPS 或 localhost 安全上下文");
    }
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    hgSignal?.throwIfAborted();
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const session = await hgNet.post(HGMANAGER_API.MEDIA_UPLOAD_INIT, {
      purpose, mime_type: file.type, file_size: file.size, sha256, idempotency_key: crypto.randomUUID(),
    }, { signal: hgSignal, timeout: 15000 });
    if (!hgUUID.test(session?.asset_id) || !hgUUID.test(session?.upload_id) || session.status !== "pending" ||
        session.method !== "PUT" || session.required_headers?.["Content-Type"] !== file.type || !session.upload_url) {
      throw new Error("媒体上传凭据不符合协议");
    }
    hgOnInit?.(session.asset_id); // PUT 或完成确认失败时仍可按 ID 点查真实状态。
    hgSignal?.throwIfAborted();
    const target = hgIMEndpoint(session.upload_url, false); // 仅信任服务端预签名 URL；不向其传 JWT。
    const response = await fetch(target, {
      method: "PUT", body: file, headers: { "Content-Type": file.type }, credentials: "omit", redirect: "error", signal: hgSignal,
    });
    if (!response.ok) throw new Error("隔离区上传失败；对象未进入审核，稍后可重新申请");
    hgSignal?.throwIfAborted();
    const complete = await hgNet.post(HGMANAGER_API.MEDIA_UPLOAD_COMPLETE, { upload_id: session.upload_id }, { signal: hgSignal, timeout: 15000 });
    if (complete?.asset_id !== session.asset_id || complete?.status !== "processing") {
      throw new Error("完成确认未进入审核；请通过资源 ID 查询真实状态");
    }
    return session.asset_id;
  }

  /** 点查本人资源；列表接口尚不存在，禁止用全站数据或本地模拟列表冒充。 */
  static async getAsset(assetID) {
    if (!hgUUID.test(assetID)) throw new Error("请输入有效的资源 ID");
    const asset = await hgNet.get(HGMANAGER_API.MEDIA_ASSET_STATUS, { asset_id: assetID });
    if (asset?.asset_id !== assetID || typeof asset.status !== "string") throw new Error("资源状态响应不合法");
    return asset;
  }

  /** 全平台新旧元数据只读盘点：类别在服务端分页前过滤，不能由当前页数据伪造全部结果。 */
  static async getInventory(kind = "", cursor = "", signal) {
    if (!["", "image", "video", "audio", "file"].includes(kind) || typeof cursor !== "string" || cursor.length > 90) {
      throw new Error("媒体类别或分页游标不合法");
    }
    const result = await hgNet.get(HGMANAGER_API.MEDIA_ADMIN_INVENTORY,
      { kind, cursor, limit: 20 }, { signal, timeout: 12000 });
    if (!Array.isArray(result?.items) || result.items.length > 20 || typeof result.next_cursor !== "string" || result.next_cursor.length > 90 ||
        result.items.some((item) => !["new", "legacy_mall", "legacy_video", "legacy_avatar", "legacy_im"].includes(item?.source) ||
          !["image", "video", "audio", "file"].includes(item?.kind) || (kind && kind !== item.kind) || typeof item.id !== "string")) {
      throw new Error("媒体盘点响应不符合协议");
    }
    return result;
  }

  /** 下载授权仅供本人且已审核的低敏图片，后台不拥有跨用户预览权限。 */
  static async previewImage(asset) {
    if (asset?.status !== "ready" || !asset.mime_type?.startsWith("image/") ||
        !["user_avatar", "user_cover", "product_main", "product_detail", "product_sku", "shop_logo", "video_cover", "marketing_poster"].includes(asset.purpose)) {
      throw new Error("仅可打开本人已审核的低敏图片");
    }
    const result = await hgNet.get(HGMANAGER_API.MEDIA_ASSET_DOWNLOAD, { asset_id: asset.asset_id });
    if (!result?.download_url || result.expires_in !== 30) throw new Error("私有读取授权不可用");
    const target = hgIMEndpoint(result.download_url, false);
    window.open(target, "_blank", "noopener,noreferrer");
  }
}
