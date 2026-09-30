import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash, createHmac, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { normalizeSignPath } from "./hg_sign_path.js";

// 执行原文件中的类，不复制算法、不加载浏览器依赖或真实环境配置。
const hgSource = readFileSync(new URL("./HttpManagerV1.js", import.meta.url), "utf8");
const hgClass = hgSource.slice(hgSource.indexOf("class NetAPI {"), hgSource.indexOf("const NetManager = new NetAPI();"));

/** 每条用例独立模拟 Web Crypto 有/无；意外访问存储或网络必须失败。 */
function hgCreateSigner(hgSubtle) {
  const hgForbidden = () => { throw new Error("测试禁止访问凭据或网络"); };
  const hgSigner = runInNewContext(`${hgClass}\nnew NetAPI()`, {
    window: { crypto: hgSubtle ? { subtle: hgSubtle } : {}, location: { origin: "http://192.168.1.8:5174" } },
    TextEncoder, Uint8Array, Uint32Array, ArrayBuffer, DataView, Blob, FormData, URL,
    normalizeHGSignPath: normalizeSignPath,
    localStorage: { getItem: hgForbidden, setItem: hgForbidden }, fetch: hgForbidden,
  });
  hgSigner.getSignSecret = () => "fixture-only-not-a-real-secret";
  return hgSigner;
}

test("existing SHA-256 fallback and Web Crypto match Node at padding boundaries and UTF-8", async () => {
  for (const hgSigner of [hgCreateSigner(null), hgCreateSigner(webcrypto.subtle)]) {
    for (const hgMessage of ["", "abc", "中文M币😀", ...[55, 56, 63, 64, 65, 119, 120, 128, 1024].map((hgLength) => "a".repeat(hgLength))]) {
      assert.equal(await hgSigner.sha256Hex(hgMessage), createHash("sha256").update(hgMessage).digest("hex"));
    }
  }
});

test("existing HMAC fallback and Web Crypto match Node for short, block and long keys", async () => {
  for (const hgSigner of [hgCreateSigner(null), hgCreateSigner(webcrypto.subtle)]) {
    for (const hgKey of ["fixture", "中文密钥", "k".repeat(63), "k".repeat(64), "k".repeat(65), "k".repeat(131)]) {
      for (const hgMessage of ["", "中文请求", "a".repeat(120)]) {
        assert.equal(await hgSigner.hmacSHA256Hex(hgKey, hgMessage), createHmac("sha256", hgKey).update(hgMessage).digest("hex"));
      }
    }
  }
});

test("existing byte HMAC fallback matches RFC 4231 cases 1 and 6", () => {
  const hgSigner = hgCreateSigner(null);
  assert.equal(hgSigner.hmacSHA256HexFallback(new Uint8Array(20).fill(0x0b), new TextEncoder().encode("Hi There")),
    "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  assert.equal(hgSigner.hmacSHA256HexFallback(new Uint8Array(131).fill(0xaa), new TextEncoder().encode("Test Using Larger Than Block-Size Key - Hash Key First")),
    "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
});

test("wallet GET and POST build identical valid signatures with and without subtle", async () => {
  for (const [hgMethod, hgPath, hgBody] of [["GET", "/recharge/orders/detail", undefined], ["POST", "/recharge/orders", { skuId: "fixture-sku", requestId: "fixture-request" }]]) {
    const hgHeaders = { "X-Timestamp": "1700000000", "X-Request-ID": "fixture-id" };
    const hgHash = createHash("sha256").update(hgBody ? JSON.stringify(hgBody) : "").digest("hex");
    const hgPayload = [hgMethod, hgPath, "1700000000", "fixture-id", "", "", "", "", "", hgHash, ""].join("\n");
    const hgExpected = `sha256=${createHmac("sha256", "fixture-only-not-a-real-secret").update(hgPayload).digest("hex")}`;
    for (const hgSigner of [hgCreateSigner(null), hgCreateSigner(webcrypto.subtle)]) {
      assert.equal(await hgSigner.buildSignature({ url: `/api/v1/wallet${hgPath}?orderId=fixture`, method: hgMethod, headers: hgHeaders, body: hgBody }), hgExpected);
    }
  }
});
