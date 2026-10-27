import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_HISTORY_MAX_COUNT,
  normalizeLoginHistory,
  updateLoginHistory,
} from "./hg_login_history.js";

test("登录历史按最近登录时间倒序排列并限制为六条", () => {
  const history = Array.from({ length: 8 }, (_, index) => ({
    userName: `user-${index}`,
    lastLoginAt: index + 1,
  }));

  const result = normalizeLoginHistory(history);

  assert.equal(result.length, LOGIN_HISTORY_MAX_COUNT);
  assert.deepEqual(
    result.map((item) => item.userName),
    ["user-7", "user-6", "user-5", "user-4", "user-3", "user-2"]
  );
});

test("同一账号只保留最近一次成功登录记录", () => {
  const result = normalizeLoginHistory([
    { userName: "admin", lastLoginAt: 10 },
    { userName: "guest", lastLoginAt: 20 },
    { userName: "admin", lastLoginAt: 30 },
  ]);

  assert.deepEqual(result, [
    { userName: "admin", lastLoginAt: 30 },
    { userName: "guest", lastLoginAt: 20 },
  ]);
});

test("成功登录账号会被提升到列表首位且非法记录会被忽略", () => {
  const result = updateLoginHistory(
    [
      { userName: "first", lastLoginAt: 20 },
      { userName: "current", lastLoginAt: 10 },
      { userName: "", lastLoginAt: 40 },
      { userName: "invalid-time", lastLoginAt: "unknown" },
    ],
    " current ",
    30
  );

  assert.deepEqual(result, [
    { userName: "current", lastLoginAt: 30 },
    { userName: "first", lastLoginAt: 20 },
  ]);
});
