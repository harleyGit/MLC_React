/** 只格式化无损的整数币数；超过 JS 安全整数的 JSON number 必须拒绝展示。 */
export function HGFormatCoin(hgValue) {
  if (typeof hgValue === "number" && (!Number.isSafeInteger(hgValue) || hgValue < 0)) return "--";
  const hgText = String(hgValue ?? ""); // 账户余额可为超出 JS 安全整数的十进制字符串，缺失时展示占位。
  return /^\d+$/.test(hgText) ? hgText.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "--";
}
