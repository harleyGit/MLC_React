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
    on(name, callback) { (this.listeners ||= new Map()).set(name, callback); }
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

/** 权限更新与通知提示使用不同事件类型；只处理本人频道且通知不携带正文。 */
test("本人频道分类提示与权限快照互不混用", async () => {
  const module = { exports: {} };
  const listeners = new Map(); // 模拟当前唯一 Centrifugo 连接的服务端事件。
  let notices = []; // 只记录分类提示，不接受正文或推断通知已读。
  let snapshots = 0; // 权限快照回调次数；普通通知不应触发权限更新。
  class Centrifuge {
    static UnauthorizedError = class extends Error {};
    on(name, callback) { listeners.set(name, callback); }
    connect() {}
    removeAllListeners() { listeners.clear(); }
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
        hgIAMRealtimeGrant: async () => ({ channel: "im:iam:U1", token: "fixture", url: "ws://localhost/connection/websocket" }),
      };
      throw new Error(`未预期依赖: ${name}`);
    },
  });
  const realtime = new module.exports.default("U1", () => { snapshots++; }, () => {}, () => {}, (category) => { notices.push(category); });
  await realtime.hgStart();
  listeners.get("publication")({ channel: "im:iam:U2", data: { event_type: "notification.inbox.updated.v1", category: "system" } });
  listeners.get("publication")({ channel: "im:iam:U1", data: { event_type: "notification.inbox.updated.v1", category: "system", content: "忽略正文" } });
  assert.deepEqual(notices, ["system"]);
  assert.equal(snapshots, 0);
  listeners.get("publication")({ channel: "im:iam:U1", data: { event_type: "iam.access.updated.v1", snapshot: {}, event_id: "iam-1-deadbeefdeadbeef" } });
  await Promise.resolve();
  assert.equal(snapshots, 1);
  realtime.hgClose();
  assert.deepEqual(notices, ["system"]);
});
