import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 用内存索引模拟 IndexedDB，网络响应可按测试次序完成，不依赖真实用户或外部服务。 */
function hgFixture() {
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL("./hg_iam_session.js", import.meta.url), "utf8"), {
    filename: "hg_iam_session.js", jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const records = new Map(); // 用户 ID -> 最后写入的权限快照，模拟单一 SETTINGS 表。
  const requests = []; // 未完成的首次授权/重连请求；测试逐个控制响应。
  let owner = "operator-a"; // 模拟 JWT uid，切换账号时必须隔离旧数据。
  const token = () => `x.${Buffer.from(JSON.stringify({
    uid: owner, exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url")}.x`;
  runInNewContext(code, {
    module, exports: module.exports, Date, Promise, atob,
    localStorage: { getItem: () => owner ? token() : null },
    require: (id) => {
      if (id.endsWith("hg_access_repository")) return {
        hgReadAccess: async (user) => records.get(user) || null,
        hgSaveAccess: async (user, snapshot) => { records.set(user, snapshot); },
        hgRemoveAccess: async (user) => { records.delete(user); },
      };
      if (id.endsWith("hg_iam_api")) return {
        hgFetchAccess: () => new Promise((resolve) => requests.push(resolve)),
        hgSyncAccess: () => new Promise((resolve) => requests.push(resolve)),
      };
      throw new Error(`未预期的依赖: ${id}`);
    },
  });
  return {
    session: module.exports, records, requests,
    switchOwner: (value) => { owner = value; },
  };
}

const hgSnapshot = (user, version) => ({
  user_id: user, roles: ["operator"], grants: [], policy_version: version,
  expires_at: "2099-01-01T00:00:00Z",
});

test("按本人身份和修订号接收完整推送，持久化后拒绝乱序及其他账号快照", async () => {
  const hg = hgFixture();
  const request = hg.session.hgRefreshIAM();
  await Promise.resolve();
  hg.requests.shift()(hgSnapshot("operator-a", 10));
  await request;
  assert.equal(hg.records.get("operator-a").policy_version, 10);
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-a", 11)), true);
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-a", 10)), false);
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-b", 12)), false);
  assert.equal(hg.records.get("operator-a").policy_version, 11);
  hg.switchOwner("operator-b");
  assert.equal(hg.session.hgGetIAMSnapshot(), null);
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-b", 13)), true);
  assert.equal(hg.records.get("operator-b").user_id, "operator-b");
});

test("仅从本地恢复当前账号未过期且结构完整的展示快照", async () => {
  const hg = hgFixture();
  hg.records.set("operator-a", { ...hgSnapshot("operator-a", 1), roles: null });
  assert.equal(await hg.session.hgLoadLocalIAM(), null);
  hg.records.set("operator-a", hgSnapshot("operator-b", 2));
  assert.equal(await hg.session.hgLoadLocalIAM(), null);
  hg.records.set("operator-a", { ...hgSnapshot("operator-a", 3), expires_at: "2020-01-01T00:00:00Z" });
  assert.equal(await hg.session.hgLoadLocalIAM(), null);
  hg.records.set("operator-a", hgSnapshot("operator-a", 4));
  assert.equal((await hg.session.hgLoadLocalIAM()).policy_version, 4);
});

test("显式同步和实时推送交错时，旧 HTTP 响应不能覆盖新权限", async () => {
  const hg = hgFixture();
  const login = hg.session.hgRefreshIAM();
  await Promise.resolve();
  hg.requests.shift()(hgSnapshot("operator-a", 20));
  await login;
  const request = hg.session.hgRefreshIAM({ sync: true });
  await Promise.resolve();
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-a", 19)), false);
  assert.equal(await hg.session.hgApplyPushedIAM(hgSnapshot("operator-a", 22)), true);
  hg.requests.shift()(hgSnapshot("operator-a", 21));
  await request;
  assert.equal(hg.session.hgGetIAMSnapshot().policy_version, 22);
  assert.equal(hg.records.get("operator-a").policy_version, 22);
  hg.session.hgClearIAM();
  await hg.session.hgLoadLocalIAM();
  assert.equal(hg.session.hgGetIAMSnapshot(), null);
});
