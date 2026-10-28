import assert from "node:assert/strict";
import test from "node:test";
import { hgCollectionOffsets, hgCollectionStart } from "./hg_collection_layout.js";

test("变高 cell 测量值覆盖估算值，双向定位和空列表不会越界", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const getKey = (item) => item.id;
  const heights = new Map([["a", 110], ["b", 350], ["c", 90]]);
  const offsets = hgCollectionOffsets(items, getKey, heights);
  assert.deepEqual(offsets, [0, 110, 460, 550]);
  assert.equal(hgCollectionStart(offsets, 400), 1);
  assert.equal(hgCollectionStart(offsets, 30), 0);
  assert.equal(hgCollectionStart(offsets, 510), 2);
  assert.equal(hgCollectionStart(offsets, 900), 2);
  assert.equal(hgCollectionStart([0], 0), 0);
});
