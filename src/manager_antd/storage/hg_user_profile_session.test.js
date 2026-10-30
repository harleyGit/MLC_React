import test from "node:test";
import assert from "node:assert/strict";

function hgStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function hgTokenFor(uid, expiresAt = Date.now() + 600000) {
  return `header.${btoa(JSON.stringify({ uid, exp: Math.ceil(expiresAt / 1000) }))}.signature`;
}

// 各用例独立加载纯 JS 模块，模拟刷新页面后的内存重置；不调用真实网络或浏览器存储。
async function hgSetupProfile(t, uid = "user-a") {
  const localStorage = hgStorageStub();
  const sessionStorage = hgStorageStub();
  globalThis.window = { localStorage, sessionStorage };
  localStorage.setItem("manager_token", hgTokenFor(uid));
  t.after(() => { delete globalThis.window; });
  const { default: HGUserProfileSession } = await import(`./hg_user_profile_session.js?case=${Date.now()}-${Math.random()}`);
  return { HGUserProfileSession, localStorage, sessionStorage };
}

test("仅内存保存联系方式，标签页存储只留展示字段", async (t) => {
  const { HGUserProfileSession: store, sessionStorage } = await hgSetupProfile(t);
  const profile = { user_id: "user-a", nickname: "初始", phone: "13800138000", email: "private@example.test", password: "must-not-store" };
  const saved = store.save(profile);
  assert.equal(saved.phone, profile.phone);
  assert.equal(saved.password, undefined);
  assert.equal(store.get().phone, profile.phone);
  const serialized = sessionStorage.getItem("manager_user_profile_session_v2");
  assert.ok(serialized);
  assert.ok(!serialized.includes(profile.phone));
  assert.ok(!serialized.includes(profile.email));
  assert.ok(!serialized.includes(profile.password));
  assert.equal(JSON.parse(serialized).value.nickname, "初始");

  const updated = store.patch({ nickname: "新昵称", phone: "13900139000", user_id: "user-b" });
  assert.equal(updated.nickname, "新昵称");
  assert.equal(updated.phone, profile.phone);
  assert.equal(updated.user_id, "user-a");
  updated.nickname = "被外部修改";
  assert.equal(store.get().nickname, "新昵称");
  const { default: reloadedStore } = await import(`./hg_user_profile_session.js?reload=${Date.now()}`);
  assert.equal(reloadedStore.get().nickname, "新昵称");
  assert.equal(reloadedStore.get().phone, undefined);
});

test("切换账号、过期和清理不会返回旧用户资料", async (t) => {
  const { HGUserProfileSession: store, localStorage, sessionStorage } = await hgSetupProfile(t);
  assert.equal(store.save({ user_id: "user-a", nickname: "旧账号" })?.nickname, "旧账号");
  localStorage.setItem("manager_token", hgTokenFor("user-b"));
  assert.equal(store.get(), null);
  assert.equal(store.save({ user_id: "user-a", nickname: "旧账号" }), null);
  assert.equal(sessionStorage.getItem("manager_user_profile_session_v2"), null);
  store.save({ user_id: "user-b", nickname: "新账号" });
  const originalNow = Date.now;
  t.after(() => { Date.now = originalNow; });
  const savedAt = Date.now();
  Date.now = () => savedAt + 16 * 60 * 1000;
  localStorage.setItem("manager_token", hgTokenFor("user-b", savedAt + 30 * 60 * 1000));
  assert.equal(store.get(), null);
  assert.equal(sessionStorage.getItem("manager_user_profile_session_v2"), null);
});

test("本地会话存储不可用时仅保留内存资料", async (t) => {
  const { HGUserProfileSession: store } = await hgSetupProfile(t);
  window.sessionStorage.setItem = () => { throw new Error("存储已禁用"); };
  store.save({ user_id: "user-a", nickname: "临时资料", phone: "13800138000" });
  assert.equal(store.get().nickname, "临时资料");
  store.clear();
  assert.equal(store.get(), null);
});
