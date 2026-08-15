import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSignPath } from "./hg_sign_path.js";

test("normalizeSignPath strips the video interaction module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/video_interactions/favorite"),
    "/favorite",
  );
});

test("normalizeSignPath strips the video comment module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/video_comments/create"),
    "/create",
  );
});

test("normalizeSignPath strips the video danmaku module prefix", () => {
  assert.equal(normalizeSignPath("/api/v1/video_danmaku/ticket"), "/ticket");
});

test("normalizeSignPath strips the bilibili module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/bilibili/author/homepage"),
    "/author/homepage",
  );
});

test("normalizeSignPath preserves paths outside registered module prefixes", () => {
  assert.equal(normalizeSignPath("/health"), "/health");
});
