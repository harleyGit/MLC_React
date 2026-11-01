import assert from "node:assert/strict";
import { test } from "node:test";
import { HGIMMediaCache } from "./hg_im_media_cache.js";

test("403 只阻止本会话短时间重复读取，过期及离开会话后允许重新鉴权", () => {
  const hgCache = new HGIMMediaCache();
  const hgNow = Date.now; // 只替换本测试的时钟，结束后恢复全局实现。
  try {
    Date.now = () => 1000;
    hgCache.hgDeny("media-1");
    assert.equal(hgCache.hgIsDenied("media-1"), true);
    assert.equal(hgCache.hgIsDenied("media-2"), false);
    Date.now = () => 61000;
    assert.equal(hgCache.hgIsDenied("media-1"), false);
    hgCache.hgDeny("media-1");
    hgCache.hgClear();
    assert.equal(hgCache.hgIsDenied("media-1"), false);
  } finally { Date.now = hgNow; }
});

test("403 缓存有界，成功读取不再保留拒绝标记", () => {
  const hgCache = new HGIMMediaCache();
  for (let hgIndex = 0; hgIndex < 13; hgIndex++) hgCache.hgDeny(`media-${hgIndex}`);
  assert.equal(hgCache.hgDenied.size, 12);
  assert.equal(hgCache.hgIsDenied("media-0"), false);
  hgCache.hgSet("media-12", new Blob(["ok"]));
  assert.equal(hgCache.hgIsDenied("media-12"), false);
  assert.equal(hgCache.hgGet("media-12")?.size, 2);
});
