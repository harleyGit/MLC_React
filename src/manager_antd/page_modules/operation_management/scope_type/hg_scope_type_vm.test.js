import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** VM 与请求层隔离，不请求真实 IAM、不读取任何账号或 MFA。 */
test("作用域字典列表、编辑回填、创建与停用各调用对应接口", async () => {
  const calls = []; // 仅记录 API 路径和非敏感参数。
  const module = { exports: {} }; // 转换后的业务 VM 模块容器。
  const source = readFileSync(new URL("./hg_scope_type_vm.jsx", import.meta.url), "utf8"); // 待测真实文件。
  const code = transformSync(source, { filename: "hg_scope_type_vm.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" } }).code; // 仅在内存中运行。
  runInNewContext(code, {
    module, exports: module.exports,
    require: (dependency) => dependency.endsWith("hg_api_constants") ? { HGMANAGER_API: {
      IAM_SCOPE_TYPE_LIST: "/list", IAM_SCOPE_TYPE_DETAIL: "/detail", IAM_SCOPE_TYPE_CREATE: "/create", IAM_SCOPE_TYPE_UPDATE: "/update", IAM_SCOPE_TYPE_DISABLE: "/disable", IAM_BUSINESS_SCOPE_CREATE: "/business-scopes",
    } } : { default: {
      get: async (path, params) => { calls.push(["GET", path, JSON.stringify(params)]); return {}; },
      post: async (path, payload) => { calls.push(["POST", path, JSON.stringify(payload)]); return {}; },
    }, __esModule: true },
  });
  const vm = module.exports.default; // 实际静态方法集合。
  await vm.list("21");
  await vm.detail("shop");
  await vm.create({ code: "new_scope", name: "测试类型", description: "类型登记", status: 1 });
  await vm.update({ code: "region", name: "区域", description: "现有类型", status: 0 });
  await vm.disable("shop");
  await vm.registerResource({ scopeType: "region", name: "华北", code: "north" });
  assert.deepEqual(calls.map((item) => item.slice(0, 2)), [["GET", "/list"], ["GET", "/detail"], ["POST", "/create"], ["POST", "/update"], ["POST", "/disable"], ["POST", "/business-scopes"]]);
  assert.equal(calls[0][2], JSON.stringify({ cursor: "21", pageSize: 50 }));
  assert.equal(calls[1][2], JSON.stringify({ code: "shop" }));
  assert.deepEqual(JSON.parse(calls[2][2]), { code: "new_scope", name: "测试类型", description: "类型登记", status: 1 });
  assert.deepEqual(JSON.parse(calls[3][2]), { code: "region", name: "区域", description: "现有类型", status: 0 });
  assert.deepEqual(JSON.parse(calls[5][2]), { scopeType: "region", name: "华北", code: "north" });
});
