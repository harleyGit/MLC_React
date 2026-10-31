import { hgIMEndpoint } from "./hg_im_endpoint";

/** MIME 严格对齐 Go 白名单；扩展名与浏览器声明都不能替代后端审核。 */
export const HG_IM_MIME = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime"],
  audio: ["audio/mpeg", "audio/ogg", "audio/mp4", "audio/aac"],
  file: ["application/pdf", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

/** 计算有界文件摘要后申请隔离区，不把 S3 密钥或业务 JWT 交给对象存储。 */
export async function hgIMPrepareUpload(hgAPI, hgFile, hgKind, hgConversationID) {
  const hgMIME = hgFile.type.split(";")[0].toLowerCase(); // 录音 Blob 可能附带 codecs，签名绑定基础 MIME。
  const hgMax = hgKind === "image" ? 10 * 1024 * 1024 : 128 * 1024 * 1024; // 与 Go 大小限制一致。
  if (!HG_IM_MIME[hgKind]?.includes(hgMIME) || hgFile.size < 1 || hgFile.size > hgMax) throw new Error("文件格式或大小不符合限制");
  if (!crypto.subtle) throw new Error("上传需要 HTTPS 或 localhost 安全上下文");
  const hgDigest = await crypto.subtle.digest("SHA-256", await hgFile.arrayBuffer()); // 单文件内存预算最多128MiB，页面禁止并行上传。
  const hgHash = Array.from(new Uint8Array(hgDigest), (hgByte) => hgByte.toString(16).padStart(2, "0")).join("");
  const hgGrant = await hgAPI.hgUploadInit({ conversationId: hgConversationID, messageType: hgKind, mime: hgMIME, size: hgFile.size, sha256: hgHash });
  if (!/^[a-f0-9]{32}$/.test(hgGrant?.mediaId) || hgGrant.method !== "PUT" || hgGrant.size !== hgFile.size || hgGrant.headers?.["Content-Type"] !== hgMIME || hgGrant.headers?.["x-amz-acl"] !== "private") throw new Error("上传凭据协议不合法");
  hgIMEndpoint(hgGrant.uploadUrl, false);
  return hgGrant;
}

/** 浏览器生成 Content-Length，原样 PUT Blob；拒绝重定向且绝不携带 Go 的 JWT/公共头。 */
export async function hgIMPut(hgGrant, hgFile, hgSignal) {
  const hgResponse = await fetch(hgIMEndpoint(hgGrant.uploadUrl, false), {
    method: "PUT", body: hgFile, credentials: "omit", redirect: "error",
    headers: { "Content-Type": hgGrant.headers["Content-Type"], "x-amz-acl": "private" },
    signal: AbortSignal.any([hgSignal, AbortSignal.timeout(120000)]),
  });
  if (!hgResponse.ok) throw new Error("隔离区上传失败，可在凭据有效期内重试");
  await hgResponse.body?.cancel();
}

/** 每段重新经 Go 授权；完成后在本地生成 Blob，不把带鉴权 URL 直接赋给媒体标签。 */
export async function hgIMReadMedia(hgAPI, hgMediaID, hgKind, hgSignal, hgProgress) {
  const hgStep = 4 * 1024 * 1024; // 单段最大4MiB，每次重新签名/鉴权。
  const hgMax = hgKind === "image" ? 10 * 1024 * 1024 : 128 * 1024 * 1024;
  const hgParts = []; // 单个查看器最多缓存128MiB，关闭后由组件释放 Blob URL。
  let hgOffset = 0; // 已确认连续字节数。
  let hgTotal = null; // 第一段确定总长，后续不可改变。
  let hgMIME = ""; // 审核后的实际类型，后续响应必须一致。
  while (hgTotal === null || hgOffset < hgTotal) {
    hgSignal.throwIfAborted();
    const hgEnd = hgOffset + hgStep - 1; // 请求闭区间。
    const hgResult = await hgAPI.hgMediaRange(hgMediaID, hgOffset, hgEnd, hgSignal);
    const hgType = hgResult.headers.get("Content-Type")?.split(";")[0]; // 不允许把 HTML/SVG 等当预览内容。
    if (!HG_IM_MIME[hgKind]?.includes(hgType) || (hgMIME && hgMIME !== hgType)) throw new Error("媒体类型不符合审核协议");
    hgMIME = hgType;
    if (hgResult.status === 200) {
      if (hgOffset !== 0 || hgResult.blob.size < 1 || hgResult.blob.size > Math.min(hgStep, hgMax)) throw new Error("完整媒体响应超限");
      return hgResult.blob;
    }
    const hgMatch = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(hgResult.headers.get("Content-Range") || "");
    if (hgResult.status !== 206 || !hgMatch) throw new Error("媒体范围响应不合法或跨域头未暴露");
    const [hgStart, hgStop, hgSize] = hgMatch.slice(1).map(Number); // 验证全部字节边界，不接受未知总长。
    if (![hgStart, hgStop, hgSize].every(Number.isSafeInteger) || hgStart !== hgOffset || hgSize < 1 || hgSize > hgMax || (hgTotal !== null && hgTotal !== hgSize) || hgStop !== Math.min(hgEnd, hgSize - 1) || hgResult.blob.size !== hgStop - hgStart + 1) throw new Error("媒体范围与审核大小不一致");
    hgTotal = hgSize;
    hgParts.push(hgResult.blob);
    hgOffset = hgStop + 1;
    hgProgress(Math.round(hgOffset * 100 / hgTotal));
  }
  return new Blob(hgParts, { type: hgMIME });
}
