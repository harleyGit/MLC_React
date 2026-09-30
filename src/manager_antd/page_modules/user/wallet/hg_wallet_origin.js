/* global __HG_WALLET_DEV_ORIGIN__ */

/** 仅识别本机地址；不能将其编码为手机订单入口。 */
export function isHGLocalOnlyOrigin(origin) {
  try {
    const hgHost = new URL(origin).hostname;
    return hgHost === "localhost" || hgHost.endsWith(".localhost") || hgHost === "[::1]" || hgHost === "[::]" || hgHost === "0.0.0.0" || /^127\./.test(hgHost);
  } catch {
    return false;
  }
}

/** 显式覆盖只接受无凭据、路径、查询或片段的 HTTP(S) origin。 */
export function validateHGWalletOrigin(hgValue) {
  let hgURL;
  try { hgURL = new URL(hgValue); } catch { throw new Error("VITE_WALLET_DEV_ORIGIN 必须是合法 HTTP(S) origin"); }
  if (!/^https?:$/.test(hgURL.protocol) || hgURL.username || hgURL.password ||
      hgValue !== hgValue.trim() || ![hgURL.origin, `${hgURL.origin}/`].includes(hgValue) || isHGLocalOnlyOrigin(hgValue)) {
    throw new Error("VITE_WALLET_DEV_ORIGIN 不允许本机地址、凭据、路径、查询或片段");
  }
  return hgURL.origin;
}

/** Vite 仅在 serve 注入 LAN 信息；生产保持当前 origin，不读取开发覆盖。 */
export function getHGWalletLinkOrigin(hgOrigin, hgDev = typeof __HG_WALLET_DEV_ORIGIN__ === "undefined" ? null : __HG_WALLET_DEV_ORIGIN__) {
  if (!hgDev || !isHGLocalOnlyOrigin(hgOrigin)) return hgOrigin;
  if (hgDev.error) throw new Error(hgDev.error);
  if (hgDev.origin) return validateHGWalletOrigin(hgDev.origin);
  const hgURL = new URL(hgOrigin);
  hgURL.hostname = hgDev.address;
  return validateHGWalletOrigin(hgURL.origin);
}
