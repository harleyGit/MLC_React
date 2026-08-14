import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildVideoFollowBody,
  buildVideoInteractionBody,
  getVideoInteractionPath,
  HG_VIDEO_INTERACTION_FOLLOW_PATH,
} from "./hg_video_interaction_request.js";

test("buildVideoInteractionBody builds toggle action payloads", () => {
  assert.deepEqual(buildVideoInteractionBody("video-1", "like", true), {
    submissionId: "video-1",
    active: true,
  });
  assert.deepEqual(buildVideoInteractionBody("video-1", "favorite", false), {
    submissionId: "video-1",
    active: false,
  });
});

test("buildVideoInteractionBody builds coin and share payloads", () => {
  assert.deepEqual(buildVideoInteractionBody("video-1", "coin", true, "request-1"), {
    submissionId: "video-1",
    active: true,
    quantity: 1,
    requestId: "request-1",
  });
  assert.deepEqual(buildVideoInteractionBody("video-1", "share"), {
    submissionId: "video-1",
    active: true,
  });
});

test("getVideoInteractionPath maps supported actions to backend routes", () => {
  assert.equal(getVideoInteractionPath("like"), "/api/v1/video_interactions/like");
  assert.equal(getVideoInteractionPath("coin"), "/api/v1/video_interactions/coin");
  assert.equal(getVideoInteractionPath("favorite"), "/api/v1/video_interactions/favorite");
  assert.equal(getVideoInteractionPath("share"), "/api/v1/video_interactions/share");
});

test("buildVideoFollowBody matches backend follow contract", () => {
  assert.equal(HG_VIDEO_INTERACTION_FOLLOW_PATH, "/api/v1/video_interactions/follow");
  assert.deepEqual(buildVideoFollowBody(" author-1 ", true), {
    followeeId: "author-1",
    active: true,
  });
  assert.deepEqual(buildVideoFollowBody("author-1", false), {
    followeeId: "author-1",
    active: false,
  });
  assert.throws(() => buildVideoFollowBody("", true), /无法确定视频作者/);
});

test("video author button invokes the follow API wrapper", async () => {
  const pageSource = await readFile(
    new URL("./hg_bili_content_page.jsx", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /onClick=\{\(\) => this\.handleAuthorFollow\(video\)\}/);
  assert.match(pageSource, /await setAuthorFollow\(followeeId, active\)/);
});
