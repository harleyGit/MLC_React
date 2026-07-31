import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoInteractionBody,
  getVideoInteractionPath,
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
