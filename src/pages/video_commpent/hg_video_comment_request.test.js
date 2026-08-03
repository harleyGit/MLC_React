import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoCommentCreateBody,
  buildVideoCommentDeleteBody,
  buildVideoCommentListQuery,
  HG_VIDEO_COMMENT_CREATE_PATH,
  HG_VIDEO_COMMENT_DELETE_PATH,
  HG_VIDEO_COMMENT_LIST_PATH,
  HG_VIDEO_COMMENT_MAX_LENGTH,
  truncateVideoCommentContent,
} from "./hg_video_comment_request.js";

test("buildVideoCommentListQuery normalizes sort and page size", () => {
  assert.deepEqual(buildVideoCommentListQuery(" video-1 ", "hot", "", 80), {
    submissionId: "video-1",
    sort: "hot",
    pageSize: 50,
  });
  assert.deepEqual(buildVideoCommentListQuery("video-1", "unknown", "", 0), {
    submissionId: "video-1",
    sort: "latest",
    pageSize: 1,
  });
});

test("buildVideoCommentListQuery preserves opaque cursors", () => {
  const cursor = "eyJpZCI6IjAwMSIsInNvcnQiOiJob3QifQ==";
  assert.deepEqual(buildVideoCommentListQuery("video-1", "latest", cursor, 20), {
    submissionId: "video-1",
    sort: "latest",
    cursor,
    pageSize: 20,
  });
});

test("comment request body builders match backend contracts", () => {
  assert.deepEqual(
    buildVideoCommentCreateBody(" video-1 ", "  useful comment  ", " request-1 "),
    {
      submissionId: "video-1",
      content: "useful comment",
      requestId: "request-1",
    },
  );
  assert.deepEqual(buildVideoCommentDeleteBody(" comment-1 "), {
    commentId: "comment-1",
  });
});

test("comment paths match registered backend routes", () => {
  assert.equal(HG_VIDEO_COMMENT_LIST_PATH, "/api/v1/video_comments/list");
  assert.equal(HG_VIDEO_COMMENT_CREATE_PATH, "/api/v1/video_comments/create");
  assert.equal(HG_VIDEO_COMMENT_DELETE_PATH, "/api/v1/video_comments/delete");
});

test("comment input limit matches the backend rune limit", () => {
  assert.equal(HG_VIDEO_COMMENT_MAX_LENGTH, 1000);
  const content = `${"😀".repeat(1000)}extra`;
  assert.equal(Array.from(truncateVideoCommentContent(content)).length, 1000);
});
