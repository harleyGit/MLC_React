import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 模拟网关连接与多次重连，验证不通过 HTTP 周期性续签。 */
test("本人频道只在启动时取一次票据，重连使用服务端会话代理", async () => {
  const module = { exports: {} };
  const clients = []; // 本测试创建的 Centrifugo 连接，长度最多为一。
  let calls = 0; // HTTP 票据调用次数；重连不能增加。
  class Centrifuge {
    static UnauthorizedError = class extends Error {};
    constructor(url, options) {
      this.url = url;
      this.options = options;
      clients.push(this);
    }
    on() {}
    connect() {}
    removeAllListeners() {}
    disconnect() {}
  }
  const source = readFileSync(new URL("./hg_iam_realtime.js", import.meta.url), "utf8");
  const code = transformSync(source, {
    filename: "hg_iam_realtime.js", jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(code, {
    module, exports: module.exports, Promise,
    require: (name) => {
      if (name === "centrifuge") return { Centrifuge };
      if (name.endsWith("hg_im_endpoint")) return { hgIMEndpoint: (url) => url };
      if (name.endsWith("hg_iam_api")) return {
        hgIAMRealtimeGrant: async () => {
          calls += 1;
          return { channel: "im:iam:U1", token: "fixture", url: "ws://localhost:18000/connection/websocket" };
        },
      };
      throw new Error(`未预期依赖: ${name}`);
    },
  });
  const realtime = new module.exports.default("U1", () => {}, () => {}, () => {});
  await realtime.hgStart();
  assert.equal(calls, 1);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].options.getToken, undefined);
  assert.deepEqual({ ...await clients[0].options.getData() }, { token: "fixture" });
  assert.deepEqual({ ...await clients[0].options.getData() }, { token: "fixture" });
  assert.equal(calls, 1);
  realtime.hgClose();
  await assert.rejects(clients[0].options.getData());
});
