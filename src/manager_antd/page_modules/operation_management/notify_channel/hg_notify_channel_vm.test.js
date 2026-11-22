import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { transformSync } from "@swc/core";

/** 用替身请求加载真实 VM；不访问用户目录、真实账号或敏感字段。 */
function hgVM(response, calls) {
  const source = readFileSync(new URL("./hg_notify_channel_vm.jsx", import.meta.url), "utf8");
  const code = transformSync(source, {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code;
  const module = { exports: {} };
  runInNewContext(code, {
    module, exports: module.exports,
    require(path) {
      if (path.endsWith("hg_api_constants")) return { HGMANAGER_API: { UserList: "/api/v1/profile/list" } };
      if (path.endsWith("hg_net_manager_vm")) return { __esModule: true, default: {
        get: async (url, query) => { calls.push({ url, query }); return response; },
      } };
      return { __esModule: true, default: {}, HG_DEMO_CHANNELS: [] };
    },
  });
  return module.exports.default;
}

test("用户目录只保存业务 ID 与展示名，分页保持游标且不保留联系方式", async () => {
  const calls = [];
  const VM = hgVM({ result: [
    { user_id: "U1", user_name: "小明", nickname: "昵称", email: "不应回填", phone: "不应回填" },
    { user_id: "bad id", user_name: "无效用户" },
  ], hasMore: true, nextCursor: 123 }, calls);
  const page = await VM.fetchRecipientUsers("100");
  assert.deepEqual(JSON.parse(JSON.stringify(page)), {
    list: [{ id: "U1", name: "小明" }], nextCursor: "123",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { url: "/api/v1/profile/list", query: { pageSize: 20, cursor: "100" } },
  ]);
});

test("无效游标阻止用户目录重复翻页", async () => {
  const VM = hgVM({ result: [], hasMore: true, nextCursor: 0 }, []);
  await assert.rejects(() => VM.fetchRecipientUsers(), /下一页游标无效/);
});
