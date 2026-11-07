import assert from "node:assert/strict";
import test from "node:test";
import { hgIMPageAfter } from "./hg_im_history_floor.js";

test("仅允许已删除的历史前缀导致首条序号跳跃", () => {
  assert.equal(hgIMPageAfter([{ seq: 51 }, { seq: 52 }], 2, 51), 52);
  assert.equal(hgIMPageAfter([{ seq: 7 }, { seq: 8 }], 6, 1), 8);
  assert.equal(hgIMPageAfter([], 2, 51), 2);
});

test("拒绝中间缺页和伪造历史起点", () => {
  assert.throws(() => hgIMPageAfter([{ seq: 51 }, { seq: 53 }], 2, 51), /不连续/);
  assert.throws(() => hgIMPageAfter([{ seq: 51 }], 2, 50), /不连续/);
  assert.throws(() => hgIMPageAfter([{ seq: 51 }], 2, undefined), /协议不合法/);
});
