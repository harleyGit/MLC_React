import QRCode from "qrcode";
import { getHGWalletLinkOrigin, isHGLocalOnlyOrigin } from "./hg_wallet_origin.js";
export { isHGLocalOnlyOrigin } from "./hg_wallet_origin.js";

export const HG_RECHARGE_EXPIRY_MINUTES = 10;

/** 仅信任订单能力，不从前端模式、域名或金额猜测后端环境。 */
export function canHGDebugPay(hgOrder) {
  return hgOrder?.paymentAvailable === true && hgOrder.paymentMode === "platform_debug" &&
    Array.isArray(hgOrder.availableMethods) && hgOrder.availableMethods.includes("platform_debug");
}

/** 按人民币分字符串格式化金额，避免先转 Number 造成精度丢失。 */
export function formatHGYuanFromFen(value) {
  // 不安全的 JSON 数字已丢失精度，不能通过 String 恢复或伪装成准确金额。
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return "--";
  const hgFen = String(value ?? "").trim();
  if (!/^\d+$/.test(hgFen)) return "--";
  const hgNormalized = hgFen.replace(/^0+(?=\d)/, "");
  const hgYuan = hgNormalized.length > 2 ? hgNormalized.slice(0, -2) : "0";
  const hgCent = hgNormalized.slice(-2).padStart(2, "0");
  return `${hgYuan}.${hgCent}`;
}

/** 将后端订单过期时间转换为不小于零的剩余秒数。 */
export function getHGRemainingSeconds(expiresAt, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - now) / 1000));
}

/** 读取钱包分页协议；不从金额推算币数，也不虚构默认档位。 */
export function normalizeHGRechargeSKUs(result) {
  return (Array.isArray(result?.list) ? result.list : []).filter((hgSKU) =>
    hgSKU && typeof hgSKU.skuId === "string" &&
    Number.isSafeInteger(hgSKU.payAmount) && hgSKU.payAmount > 0 &&
    Number.isSafeInteger(hgSKU.totalCoin) && hgSKU.totalCoin > 0
  );
}

/** 开发本机入口改用 LAN；无可用地址则拒绝生成，详情仍需手机登录同一用户。 */
export function buildHGRechargeDetailURL(orderId, origin = window.location.origin, hgDev) {
  const hgOrigin = getHGWalletLinkOrigin(origin, hgDev);
  if (isHGLocalOnlyOrigin(hgOrigin)) throw new Error("当前地址仅本机可达，不能生成手机二维码；请配置手机可达的站点 origin");
  const url = new URL("/account/wallet/recharge", hgOrigin);
  url.searchParams.set("orderId", String(orderId || ""));
  return url.toString();
}

/** 本地编码订单确认页，不请求第三方二维码服务；保留四模块白色静区。 */
export function encodeHGRechargeQR(hgURL) {
  return QRCode.toDataURL(hgURL, {
    type: "image/png", errorCorrectionLevel: "M", margin: 4, scale: 6,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

/** 同一创建尝试使用同一个幂等键，失败重试不得重新生成。 */
export function createHGRequestID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

/** 钱包充值业务 VM：集中管理接口路径、参数和 result 解包后的业务对象。 */
export default class HGWalletVM {
  /** 延迟加载浏览器请求链，使纯逻辑可由现有 Node test 直接验证。
   * HttpManagerV1 已解包 result，此处禁止再次解包或绕开 JWT/签名。
   */
  static async hgRequest(method, key, params) {
    const [{ default: HGNet }, { HGMANAGER_API }] = await Promise.all([
      import("../../../net_handle/hg_net_manager_vm.jsx"),
      import("../../../api/hg_api_constants.jsx"),
    ]);
    return HGNet[method](HGMANAGER_API[key], params);
  }

  /** 只读权威币余额，不做人民币换算。 */
  static getBalance() {
    return this.hgRequest("get", "WALLET_BALANCE");
  }

  /** 每次有界读取，空页仍按 hasMore 提供下一页入口。 */
  static getRechargeSKUs(cursor = "0") {
    return this.hgRequest("get", "WALLET_RECHARGE_SKUS", { pageSize: 20, cursor });
  }

  /** 仅传后端允许的 SKU 与幂等键，金额和展示名由服务端快照决定。 */
  static createRechargeOrder(skuId, requestId) {
    return this.hgRequest("post", "WALLET_RECHARGE_ORDERS", { skuId, requestId });
  }

  /** JWT 必须属于该订单用户，不能通过链接代替鉴权。 */
  static getRechargeOrderDetail(orderId) {
    return this.hgRequest("get", "WALLET_RECHARGE_ORDER_DETAIL", { orderId });
  }

  /** 未选第三方时才默认 debug；显式第三方选择绝不降级为模拟充值。 */
  static payOrderIfAvailable(order, paymentMethod = "platform_debug") {
    if (paymentMethod !== "platform_debug") {
      return Promise.reject(new Error("微信、支付宝尚未接入，不会转为模拟充值"));
    }
    if (!canHGDebugPay(order)) {
      return Promise.reject(new Error("支付渠道暂未配置"));
    }
    return this.payRechargeOrder(order.orderId, paymentMethod);
  }

  /** 必传支付方法；同订单重试由后端幂等处理，返回完整订单而非成功布尔值。 */
  static payRechargeOrder(orderId, paymentMethod) {
    return this.hgRequest("post", "WALLET_RECHARGE_PAY", { orderId, paymentMethod });
  }

  /** paid 的 balanceAfter 是历史快照，实时展示必须重新查询权威余额。 */
  static refreshBalanceAfterConfirmedPayment() {
    return this.getBalance();
  }

  /** 将钱包 HTTP 错误转为用户提示，保留其他服务端错误消息。 */
  static errorMessage(error) {
    if (error?.status === 503 && error?.message === "payment channel is not configured") return "支付渠道暂未配置";
    if (error?.status === 404) return "订单或档位不可用，请确认手机已登录创建订单的同一用户";
    if (error?.status === 401) return "登录已过期，请重新登录同一用户";
    return error?.message || "钱包请求失败，请重试";
  }
}
