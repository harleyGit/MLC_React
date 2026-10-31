/** 只接受服务端配置的 HTTPS/WSS 地址；仅 localhost 允许明文，不接受 userinfo。 */
export function hgIMEndpoint(hgRaw, hgWebSocket = true) {
  const hgURL = new URL(hgRaw); // 后端配置的绝对地址，不拼接客户端任意路径。
  const hgLocal = ["localhost", "127.0.0.1", "[::1]"].includes(hgURL.hostname); // debug 本机兼容。
  if (hgURL.username || hgURL.password || hgURL.hash || (hgWebSocket && hgURL.search) || !(hgWebSocket
    ? hgURL.protocol === "wss:" || (hgLocal && hgURL.protocol === "ws:")
    : hgURL.protocol === "https:" || (hgLocal && hgURL.protocol === "http:"))) {
    throw new Error("IM 服务地址不符合 HTTPS/WSS 要求");
  }
  return hgURL.href;
}
