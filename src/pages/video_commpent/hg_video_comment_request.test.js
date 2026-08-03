import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoCommentCreateBody,
  buildVideoCommentDeleteBody,
  buildVideoCommentImagePath,
  buildVideoCommentListQuery,
  buildVideoCommentReactionBody,
  buildVideoCommentRepliesQuery,
  HG_VIDEO_COMMENT_CREATE_PATH,
  HG_VIDEO_COMMENT_DELETE_PATH,
  HG_VIDEO_COMMENT_IMAGE_PATH,
  HG_VIDEO_COMMENT_LIST_PATH,
  HG_VIDEO_COMMENT_MAX_LENGTH,
  HG_VIDEO_COMMENT_REACTION_PATH,
  HG_VIDEO_COMMENT_REPLIES_PATH,
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

test("buildVideoCommentCreateBody adds reply and normalized image fields", () => {
  assert.deepEqual(
    buildVideoCommentCreateBody(
      " video-1 ",
      "   ",
      " request-1 ",
      " parent-1 ",
      [" https://img.test/1.png ", "", null, "https://img.test/2.webp", "https://img.test/3.jpg", "https://img.test/4.png"],
    ),
    {
      submissionId: "video-1",
      content: "",
      requestId: "request-1",
      parentCommentId: "parent-1",
      imageURLs: [
        "https://img.test/1.png",
        "https://img.test/2.webp",
        "https://img.test/3.jpg",
      ],
    },
  );
  assert.deepEqual(buildVideoCommentCreateBody("video-1", "text", "request-2", "", []), {
    submissionId: "video-1",
    content: "text",
    requestId: "request-2",
  });
});

test("reply and reaction builders match backend contracts", () => {
  const cursor = "opaque+/cursor==";
  assert.deepEqual(buildVideoCommentRepliesQuery(" root-1 ", cursor, 80), {
    rootCommentId: "root-1",
    cursor,
    pageSize: 50,
  });
  assert.deepEqual(buildVideoCommentRepliesQuery("root-1", "", 0), {
    rootCommentId: "root-1",
    pageSize: 1,
  });
  assert.deepEqual(buildVideoCommentReactionBody(" comment-1 ", "like"), {
    commentId: "comment-1",
    reaction: "like",
  });
  assert.deepEqual(buildVideoCommentReactionBody("comment-1", "unsupported"), {
    commentId: "comment-1",
    reaction: "none",
  });
});

test("buildVideoCommentImagePath normalizes supported extensions", () => {
  assert.equal(buildVideoCommentImagePath(".PNG"), "/api/v1/video_comments/image?ext=png");
  assert.equal(buildVideoCommentImagePath("jpg"), "/api/v1/video_comments/image?ext=jpeg");
  assert.equal(buildVideoCommentImagePath("unsupported"), "/api/v1/video_comments/image?ext=png");
});

test("comment paths match registered backend routes", () => {
  assert.equal(HG_VIDEO_COMMENT_LIST_PATH, "/api/v1/video_comments/list");
  assert.equal(HG_VIDEO_COMMENT_CREATE_PATH, "/api/v1/video_comments/create");
  assert.equal(HG_VIDEO_COMMENT_DELETE_PATH, "/api/v1/video_comments/delete");
  assert.equal(HG_VIDEO_COMMENT_REPLIES_PATH, "/api/v1/video_comments/replies");
  assert.equal(HG_VIDEO_COMMENT_REACTION_PATH, "/api/v1/video_comments/reaction");
  assert.equal(HG_VIDEO_COMMENT_IMAGE_PATH, "/api/v1/video_comments/image");
});

test("comment input limit matches the backend rune limit", () => {
  assert.equal(HG_VIDEO_COMMENT_MAX_LENGTH, 1000);
  const content = `${"😀".repeat(1000)}extra`;
  assert.equal(Array.from(truncateVideoCommentContent(content)).length, 1000);
});
