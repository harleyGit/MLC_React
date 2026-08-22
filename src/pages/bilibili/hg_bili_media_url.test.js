import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVideoCoverUrl } from "./hg_bili_media_url.js";

test("normalizeVideoCoverUrl normalizes browser-safe cover paths", () => {
  assert.equal(normalizeVideoCoverUrl(" //i0.hdslb.com/a.jpg "), "https://i0.hdslb.com/a.jpg");
  assert.equal(normalizeVideoCoverUrl("uploads/cover/a.jpg"), "/uploads/cover/a.jpg");
  assert.equal(normalizeVideoCoverUrl("http://localhost:8080/uploads/cover/a.jpg"), "/uploads/cover/a.jpg");
  assert.equal(normalizeVideoCoverUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(normalizeVideoCoverUrl(""), "");
});
