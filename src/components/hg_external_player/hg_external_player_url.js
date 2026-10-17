/** 按官方嵌入协议定位分P；网页地址不能作为HTML video媒体源。 */
export function hgExternalPlayerURL(hgBvid, hgCid, hgPage = 1) {
  if (!/^BV[0-9A-Za-z]{10}$/.test(String(hgBvid || ""))) return "";
  const hgParams = new URLSearchParams({ bvid: hgBvid, p: String(Number.isInteger(hgPage) && hgPage > 0 ? hgPage : 1), autoplay: "0", danmaku: "0" });
  if (/^[1-9]\d*$/.test(String(hgCid || ""))) hgParams.set("cid", String(hgCid));
  return `https://player.bilibili.com/player.html?${hgParams}`;
}
