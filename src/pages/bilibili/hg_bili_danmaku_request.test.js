import assert from "node:assert/strict";
import test from "node:test";
import { buildVideoDanmakuCreateBody, buildVideoDanmakuListQuery } from "./hg_bili_danmaku_request.js";

test("danmaku list uses a bounded 60 second window", () => {
  assert.deepEqual(buildVideoDanmakuListQuery("VID_1", 1200), { videoId: "VID_1", fromMs: 1200, toMs: 61200, pageSize: 500 });
});

test("danmaku create normalizes time and unicode content", () => {
  const body = buildVideoDanmakuCreateBody({ videoId: " VID_1 ", content: ` ${"弹".repeat(101)} `, requestId: "REQ", progressMs: -1 });
  assert.equal(body.videoId, "VID_1");
  assert.equal(Array.from(body.content).length, 100);
  assert.equal(body.progressMs, 0);
});
