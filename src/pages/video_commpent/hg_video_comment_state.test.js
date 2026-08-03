import assert from "node:assert/strict";
import test from "node:test";
import {
  decrementVideoCommentReplyCount,
  getPendingVideoCommentImageDrafts,
  getUploadedVideoCommentImageURLs,
  mergeVideoComments,
} from "./hg_video_comment_state.js";

test("mergeVideoComments preserves local order and deduplicates server items", () => {
  const local = [
    { commentId: "local-1", content: "local" },
    { commentId: "shared", content: "local version" },
  ];
  const server = [
    { commentId: "shared", content: "server version" },
    { commentId: "server-1", content: "server" },
  ];

  assert.deepEqual(mergeVideoComments(local, server, 10), [
    local[0],
    local[1],
    server[1],
  ]);
});

test("decrementVideoCommentReplyCount updates only the captured root", () => {
  const comments = [
    { commentId: "root-1", replyCount: 2 },
    { commentId: "root-2", replyCount: 5 },
  ];

  assert.deepEqual(decrementVideoCommentReplyCount(comments, "root-1"), [
    { commentId: "root-1", replyCount: 1 },
    { commentId: "root-2", replyCount: 5 },
  ]);
});

test("getUploadedVideoCommentImageURLs preserves cached draft order exactly", () => {
  const drafts = [
    { imageURL: "https://img.test/first.png" },
    { imageURL: "https://img.test/second.webp" },
    { imageURL: "https://img.test/third.jpg" },
  ];

  assert.deepEqual(getUploadedVideoCommentImageURLs(drafts), [
    "https://img.test/first.png",
    "https://img.test/second.webp",
    "https://img.test/third.jpg",
  ]);
  assert.equal(getUploadedVideoCommentImageURLs([{ imageURL: "" }]), null);
});

test("getPendingVideoCommentImageDrafts retries only drafts without cached URLs", () => {
  const uploaded = { imageURL: "https://img.test/uploaded.png" };
  const pending = { imageURL: "" };
  const missing = {};

  assert.deepEqual(getPendingVideoCommentImageDrafts([uploaded, pending, missing]), [pending, missing]);
});
