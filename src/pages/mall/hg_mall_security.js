/**
 * 用安全随机字节生成可重试的交易请求标识（购买、退款等幂等键）。
 * 约束：商城下单与订单面板共用，无随机源时拒绝交易而非退化为 Math.random。
 * @returns {string} 32 位十六进制请求标识。
 * @throws {Error} 浏览器缺少安全随机源时抛出错误。
 */
export function hgSecureRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("浏览器不支持安全随机数，无法发起交易");
  return Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(16)),
    (hgValue) => hgValue.toString(16).padStart(2, "0")
  ).join("");
}
