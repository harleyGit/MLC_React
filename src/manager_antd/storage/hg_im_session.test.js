import assert from "node:assert/strict";
import { test } from "node:test";
import { hgIMSession, hgIMSessionID, hgClearIMSession } from "./hg_im_session.js";

// 纯函数夹具模拟本地存储；无网络、无真实 token/设备凭据。
function hgStorage() {
  const hgItems = new Map(); // 本用例的模拟存储；空 Map 表示当前没有登录态。
  return {
    getItem: (hgKey) => hgItems.get(hgKey) ?? null,
    setItem: (hgKey, hgValue) => hgItems.set(hgKey, hgValue),
    removeItem: (hgKey) => hgItems.delete(hgKey),
  };
}

test("旧登录会话的聊天设备不能被新会话恢复，但允许注册流程撤销", () => {
  globalThis.localStorage = hgStorage();
  globalThis.sessionStorage = hgStorage();
  try {
    const hgFirst = "a".repeat(32); // 首次登录的模拟 sid；不用于真实鉴权。
    const hgSecond = "b".repeat(32); // 同账号再次登录生成的新 sid。
    const hgToken = (hgSid) => `header.${btoa(JSON.stringify({ uid: "user-1", sid: hgSid }))}.signature`;
    localStorage.setItem("manager_token", hgToken(hgFirst));
    hgIMSession("user-1", { sessionID: hgFirst, credential: { deviceId: "old-device" } });
    assert.equal(hgIMSession("user-1").credential.deviceId, "old-device");
    localStorage.setItem("manager_token", hgToken(hgSecond));
    assert.equal(hgIMSessionID(), hgSecond);
    assert.equal(hgIMSession("user-1").credential, null);
    assert.equal(hgIMSession("user-1", undefined, true).credential.deviceId, "old-device");
    hgClearIMSession();
    assert.equal(hgIMSession("user-1").credential, undefined);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});
