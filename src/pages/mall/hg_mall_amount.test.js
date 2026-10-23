import assert from "node:assert/strict";
import test from "node:test";
import { HGFormatCoin } from "./hg_mall_amount.js";

test("商城余额大整数保留字符串精度，拒绝不安全的 JSON 数字", () => {
  assert.equal(HGFormatCoin("900719925474099312345"), "900,719,925,474,099,312,345");
  assert.equal(HGFormatCoin(12580), "12,580");
  assert.equal(HGFormatCoin(0), "0");
  assert.equal(HGFormatCoin(Number.MAX_SAFE_INTEGER + 1), "--");
  assert.equal(HGFormatCoin(-1), "--");
  assert.equal(HGFormatCoin("unknown"), "--");
});
