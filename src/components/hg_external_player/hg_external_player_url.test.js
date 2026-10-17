import test from "node:test";
import assert from "node:assert/strict";
import { hgExternalPlayerURL } from "./hg_external_player_url.js";

test("外部播放器使用官方CID/p协议且关闭原站弹幕和自动播放", () => {
  const hgURL = new URL(hgExternalPlayerURL("BV1zVJY63EcT", "12345678901234567", 2));
  assert.equal(hgURL.origin, "https://player.bilibili.com");
  assert.equal(hgURL.searchParams.get("cid"), "12345678901234567");
  assert.equal(hgURL.searchParams.get("p"), "2");
  assert.equal(hgURL.searchParams.get("danmaku"), "0");
  assert.equal(hgURL.searchParams.get("autoplay"), "0");
  assert.equal(hgURL.searchParams.has("page"), false);
});

test("拒绝网页/脚本地址；无CID时回退第一P", () => {
  assert.equal(hgExternalPlayerURL("https://example.com"), "");
  assert.equal(hgExternalPlayerURL("javascript:alert(1)"), "");
  const hgURL = new URL(hgExternalPlayerURL("BV1zVJY63EcT", "0", -1));
  assert.equal(hgURL.searchParams.has("cid"), false);
  assert.equal(hgURL.searchParams.get("p"), "1");
});
