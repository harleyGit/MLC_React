import assert from "node:assert/strict";
import test from "node:test";
import { HGAdvanceMallPage, HGMaxMallBackPages } from "./hg_mall_cursor.js";

test("超长商城目录只保留最近页的可返回游标，页码仍准确", () => {
  let hgHistory = []; // 当前页面之前可返回的位置，从第一页空游标开始。
  let hgBase = 0; // 被丢弃的最早返回位置数量，初始为零。
  for (let hgPage = 0; hgPage < 100000; hgPage += 1) {
    const hgPosition = HGAdvanceMallPage(hgHistory, hgBase, String(hgPage));
    hgHistory = hgPosition.history;
    hgBase = hgPosition.base;
  }
  assert.equal(hgHistory.length, HGMaxMallBackPages);
  assert.equal(hgBase + hgHistory.length + 1, 100001);
  assert.deepEqual(hgHistory.slice(-2), ["99998", "99999"]);
  assert.deepEqual(HGAdvanceMallPage([], 0, ""), { history: [""], base: 0 });
});
