import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 隔离网络和计时器，验证网关重试上限、恢复清零及停止后的回调隔离。 */
test("Chat Socket 连续失败三次才提示并停止重试", async () => {
  const hgListeners = new Map(); // 模拟 SDK 事件订阅，不建立真实连接。
  let hgDisconnected = 0; // 第三次失败后 SDK 的停止次数。
  let hgFailures = 0; // 传给页面的最终失败通知次数。
  class HGCentrifuge {
    static UnauthorizedError = class extends Error {};
    constructor() { this.state = "connecting"; }
    on(hgName, hgCallback) { hgListeners.set(hgName, hgCallback); }
    connect() {}
    removeAllListeners() { hgListeners.clear(); }
    disconnect() { hgDisconnected++; this.state = "disconnected"; }
  }
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_im_realtime.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_im_realtime.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports, Promise,
    require: (hgName) => {
      if (hgName === "centrifuge") return { Centrifuge: HGCentrifuge };
      if (hgName.endsWith("hg_im_endpoint")) return { hgIMEndpoint: (hgURL) => hgURL };
      throw new Error(`未预期依赖: ${hgName}`);
    },
  });
  const hgDevice = "a".repeat(32);
  const hgRealtime = new hgModule.exports.default(
    { hgRealtimeToken: async () => ({ channel: `im:${hgDevice}`, token: "fixture", url: "ws://localhost/connection/websocket" }) },
    { deviceId: hgDevice, secret: "b".repeat(64) },
    () => {}, () => {}, () => {}, () => { hgFailures++; }
  );
  await hgRealtime.hgStart();
  const hgError = hgListeners.get("error");
  const hgSubscribed = hgListeners.get("subscribed");
  hgError({ type: "transport" });
  hgError({ type: "connect" });
  assert.equal(hgFailures, 0);
  hgSubscribed({ channel: `im:${hgDevice}` });
  assert.equal(hgRealtime.hgFailures, 0);
  hgError({ type: "transport" });
  hgError({ type: "connect" });
  assert.equal(hgFailures, 0);
  hgError({ type: "transport" });
  assert.equal(hgFailures, 1);
  assert.equal(hgDisconnected, 1);
  assert.equal(hgRealtime.hgClient, null);
  hgError({ type: "transport" }); // 关闭后的旧代际事件不能再次提示。
  assert.equal(hgFailures, 1);
});
