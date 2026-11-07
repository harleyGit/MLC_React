import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { hgFormatConversationTime, hgFormatMessageTime, hgMessageDividerAt, hgShouldShowTimeDivider } from "./hg_im_message_time.js";

test("会话与消息按今天、昨天、跨周、本周、今年及往年展示", () => {
  const hgOldTZ = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  try {
    const hgNow = new Date("2026-11-11T04:00:00Z"); // 周三当地 12:00。
    const hgCases = [
      ["2026-11-11T02:10:00Z", "10:10", "10:10"],
      ["2026-11-10T12:30:00Z", "昨天", "昨天 20:30"],
      ["2026-11-09T06:20:00Z", "星期一", "星期一 14:20"],
      ["2026-11-08T15:59:00Z", "11/08", "11月8日 23:59"],
      ["2026-10-28T01:30:00Z", "10/28", "10月28日 09:30"],
      ["2025-12-30T12:10:00Z", "2025/12/30", "2025年12月30日 20:10"],
      ["2026-11-12T02:10:00Z", "10:10", "10:10"],
    ];
    for (const [hgStamp, hgConversation, hgMessage] of hgCases) {
      assert.equal(hgFormatConversationTime(hgStamp, hgNow), hgConversation);
      assert.equal(hgFormatMessageTime(hgStamp, hgNow), hgMessage);
    }
    assert.equal(hgFormatConversationTime("2026-11-08T04:00:00Z", new Date("2026-11-09T04:00:00Z")), "昨天"); // 周日跨到下周一。
    assert.equal(hgFormatMessageTime("2025-12-31T12:00:00Z", new Date("2026-01-01T12:00:00Z")), "昨天 20:00");
    assert.equal(hgFormatMessageTime("invalid", hgNow), "");
    assert.equal(hgFormatConversationTime("invalid", hgNow), "");
  } finally {
    if (hgOldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = hgOldTZ;
  }
});

test("本地跨日强制分隔，夏令时按实际分钟数比较，分页重算前驱", () => {
  const hgOldTZ = process.env.TZ;
  try {
    process.env.TZ = "Asia/Shanghai";
    assert.equal(hgShouldShowTimeDivider("2026-11-06T16:01:00Z", "2026-11-06T15:59:00Z"), true);
    assert.equal(hgShouldShowTimeDivider("2026-11-06T16:04:00Z", "2026-11-06T16:00:00Z"), false);
    assert.equal(hgShouldShowTimeDivider("2026-11-06T16:05:00Z", "2026-11-06T16:00:00Z"), true);
    assert.equal(hgShouldShowTimeDivider("invalid"), false);
    const hgPage = [{ sentAt: "2026-11-06T16:05:00Z" }, { createdAt: "2026-11-06T16:06:00Z" }];
    assert.equal(hgMessageDividerAt(hgPage, 0), true);
    assert.equal(hgMessageDividerAt(hgPage, 1), false); // 虚拟窗口首条不能冒充全列表首条。
    hgPage.unshift({ sentAt: "2026-11-06T16:04:00Z" });
    assert.equal(hgMessageDividerAt(hgPage, 1), false); // 历史页插入后重算原首条。
    process.env.TZ = "America/New_York";
    assert.equal(hgShouldShowTimeDivider("2026-11-01T06:03:00Z", "2026-11-01T05:59:00Z"), false);
    assert.equal(hgShouldShowTimeDivider("2026-11-01T06:05:00Z", "2026-11-01T05:59:00Z"), true);
    assert.equal(hgFormatMessageTime("2026-11-11T02:10:00Z", new Date("2026-11-11T16:00:00Z")), "昨天 21:10");
  } finally {
    if (hgOldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = hgOldTZ;
  }
});
