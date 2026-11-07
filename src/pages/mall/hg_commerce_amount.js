/** 人民币元文本精确转分；仅供草稿录入，服务端仍须验证价格。 */
export function hgYuanToCent(hgText) {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(hgText)) throw new Error("价格须为不超过两位小数的人民币元");
  const [hgYuan, hgFraction = ""] = hgText.split("."); // 整数元和最多两位小数，禁止浮点输入。
  const hgCent = Number(hgYuan) * 100 + Number(hgFraction.padEnd(2, "0")); // 精确整数分，后端再次检查上限。
  if (hgCent < 1 || hgCent > 1000000000) throw new Error("价格须在 ¥0.01 至 ¥10000000.00 之间");
  return hgCent;
}

/** 已验证的后端整数分仅用于显示，不参与浏览器侧支付计算。 */
export const hgCentToYuan = (hgCent) => `¥${(Number(hgCent || 0) / 100).toFixed(2)}`;
