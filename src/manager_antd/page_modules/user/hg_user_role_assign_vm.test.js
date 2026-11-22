import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 隔离网络层，以真实 VM 方法验证游标上限与即时授权请求边界。 */
function hgRoleVM(hgGet, hgPost = async () => ({ granted: true })) {
  const hgModule = { exports: {} }; // 内存中的 CommonJS 转换目标。
  const hgSource = readFileSync(new URL("./hg_user_role_assign_vm.jsx", import.meta.url), "utf8"); // 当前 VM 源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_user_role_assign_vm.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code; // 仅用于 Node 单测，不写入构建产物。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (hgDependency) => hgDependency.endsWith("hg_api_constants")
       ? { HGMANAGER_API: { IAM_ROLE_LIST: "/roles/list", IAM_BINDING_LIST: "/bindings/list", IAM_PERMISSION_LIST: "/permissions/list", IAM_SCOPE_TYPE_LIST: "/scope-types/list", IAM_SCOPE_RESOURCE_LIST: "/scope-resources/list", IAM_BINDING_GRANT_DIRECT: "/bindings/grant-direct", IAM_BINDING_GRANT_DIRECT_BATCH: "/bindings/grant-direct-batch" } }
      : { default: { get: hgGet, post: hgPost }, __esModule: true },
  });
  return hgModule.exports.default;
}

test("角色目录最多聚合五页，异常游标不循环请求", async () => {
  const hgCursors = []; // 仅验证分页标识，不连接 IAM 服务。
  const hgVM = hgRoleVM(async (_hgURL, hgParams) => {
    hgCursors.push(hgParams.cursor);
    return { list: Array.from({ length: 100 }, (_, i) => ({ id: String(hgParams.cursor * 100 + i + 1) })), hasMore: true, nextCursor: hgParams.cursor + 1 };
  });
  const hgResult = await hgVM.fetchAllRoles();
  assert.equal(hgResult.list.length, 500);
  assert.equal(hgResult.truncated, true);
  assert.deepEqual(hgCursors, [0, 1, 2, 3, 4]);
  const hgInvalid = hgRoleVM(async () => ({ list: [{ id: "1" }], hasMore: true, nextCursor: 0 }));
  await assert.rejects(hgInvalid.fetchAllRoles(), /游标无效/);
});

test("作用域目录来自服务端且批量授权透传每个绑定的显式权限子集与一次 MFA", async () => {
  const hgCalls = []; // 不记录验证码内容，只断言其长度。
  const hgVM = hgRoleVM(async (url, params) => { hgCalls.push([url, params.pageSize]); return { list: [{ code: "shop", status: 1 }] }; }, async (url, payload) => {
    hgCalls.push([url, payload.userId, payload.bindings.map((binding) => binding.permissions), payload.mfaCode.length]);
    return { granted: true };
  });
  assert.equal((await hgVM.fetchScopeTypes()).list[0].code, "shop");
  await hgVM.grantDirectBatch({ userId: "target-1", bindings: [{ roleId: "7", scopeType: "shop", scopeId: "shop-1", permissions: ["mall:product:create"] }, { roleId: "8", scopeType: "shop", scopeId: "shop-1", permissions: [] }], mfaCode: "123456" });
  assert.deepEqual(hgCalls, [["/scope-types/list", 50], ["/bindings/grant-direct-batch", "target-1", [["mall:product:create"], []], 6]]);
});

test("作用域资源候选按类型和游标查询，不在前端构造资源 ID", async () => {
  const hgCalls = []; // 只记录查询参数，不访问真实组织或商家目录。
  const hgVM = hgRoleVM(async (url, params) => {
    hgCalls.push([url, params.scopeType, params.cursor, params.pageSize]);
    return { list: [{ id: "shop-1", name: "店铺" }], hasMore: false };
  });
  assert.equal((await hgVM.fetchScopeResources("shop", "42")).list[0].id, "shop-1");
  assert.deepEqual(hgCalls, [["/scope-resources/list", "shop", "42", 50]]);
});

test("即时授权仅提交既有角色及绑定作用域；不提交客户端查看的权限编码", async () => {
  const hgCalls = []; // 仅保存非敏感业务参数，MFA 值仅断言长度。
  const hgVM = hgRoleVM(async () => ({ list: [] }), async (hgURL, hgPayload) => {
    hgCalls.push([hgURL, hgPayload.userId, hgPayload.roleId, hgPayload.scopeType, hgPayload.scopeId, hgPayload.expiresAt, hgPayload.mfaCode.length, Object.hasOwn(hgPayload, "permissions")]);
    return { granted: true };
  });
  await hgVM.grantDirect({ userId: "target-1", roleId: "7", scopeType: "global", scopeId: "unused", mfaCode: "123456" });
  assert.deepEqual(hgCalls, [["/bindings/grant-direct", "target-1", "7", "global", "", null, 6, false]]);
});
