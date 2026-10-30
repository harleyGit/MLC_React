import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

// 执行实际请求 VM 方法，以可控 put 替身检查后端 DTO 契约，不访问网络。
function hgProfileNet() {
  const source = readFileSync(new URL("../../../net_handle/hg_net_manager_vm.jsx", import.meta.url), "utf8");
  const code = transformSync(source, { filename: "hg_net_manager_vm.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" } }).code;
  const module = { exports: {} };
  class HGNetStub { put(path, body) { return { path, body }; } }
  runInNewContext(code, {
    module, exports: module.exports,
    require: (dependency) => dependency.includes("hg_api_constants")
      ? { HGMANAGER_API: { PROFILE_UPDATE: "/api/v1/profile/update" } }
      : { default: HGNetStub, __esModule: true },
  });
  return module.exports.default;
}

test("局部更新仅传目标字段，性别零值与清空签名不丢失", () => {
  const net = hgProfileNet();
  const gender = net.updateUserProfile({ gender: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(gender.body)), { gender: 0 });
  assert.equal(gender.path, "/api/v1/profile/update");
  assert.deepEqual(JSON.parse(JSON.stringify(net.updateUserProfile({ signature: "" }).body)), { signature: "" });
});

test("出生日期按 Go birth_date 格式传递，不再发送无效的 birth_month 字段", () => {
  const net = hgProfileNet();
  assert.deepEqual(JSON.parse(JSON.stringify(net.updateUserProfile({ birth_month: "2026-10" }).body)), {
    birth_date: { value: "2026-10", format: "year-month" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(net.updateUserProfile({ birth_month: "2026-10-30" }).body)), {
    birth_date: { value: "2026-10-30", format: "date" },
  });
});
