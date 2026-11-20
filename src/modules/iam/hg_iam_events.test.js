import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import { JSDOM } from "jsdom";

/** 跨标签页只传刷新信号，实际快照仍须通过服务端 HTTP 核验。 */
test("IAM 事件不传播权限、身份或 MFA 内容", () => {
  const dom = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  const source = readFileSync(new URL("./hg_iam_events.js", import.meta.url), "utf8");
  const code = transformSync(source, { filename: "hg_iam_events.js", jsc: { target: "es2022" }, module: { type: "commonjs" } }).code;
  const module = { exports: {} };
  const messages = [];
  const details = [];
  class HGTestChannel {
    postMessage(payload) { messages.push(payload); }
  }
  dom.window.addEventListener("hg:iam-access-changed", (event) => details.push(event.detail));
  runInNewContext(code, {
    module, exports: module.exports, window: dom.window, BroadcastChannel: HGTestChannel,
  });
  try {
    module.exports.hgNotifyIAMChanged();
    assert.deepEqual(messages, ["refresh"]);
    assert.equal(details.length, 1);
    assert.equal(details[0].force, true);
    assert.deepEqual(Object.keys(details[0]), ["force"]);
    module.exports.hgNotifyIAMChanged({ broadcast: false });
    assert.deepEqual(messages, ["refresh"]);
    assert.equal(details.length, 2);
  } finally {
    dom.window.close();
  }
});
