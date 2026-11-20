import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 使用真实请求包装代码和模拟 HTTP 返回，验证成功才刷新，绝不向测试环境发网络请求。 */
test("IAM 写入成功才广播刷新；失败、只读预判和 MFA 不刷新", async () => {
  const source = readFileSync(new URL("../../manager_antd/net_handle/hg_net_manager_vm.jsx", import.meta.url), "utf8");
  const code = transformSync(source, {
    filename: "hg_net_manager_vm.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const module = { exports: {} };
  const notifications = [];
  let failure = false;
  const paths = {
    IAM_ROLE_CREATE: "/api/v1/iam/roles",
    IAM_BINDING_GRANT_DIRECT_BATCH: "/api/v1/iam/bindings/grant-direct-batch",
    IAM_MFA_CONFIRM: "/api/v1/iam/mfa/confirm",
    IAM_AUTHORIZE: "/api/v1/iam/authorize",
  }; // 其余未模拟路径为 undefined，不能影响此用例的白名单判断。
  class HGTestManager {
    post(path, body) {
      return failure ? Promise.reject(new Error("权限不足")) : Promise.resolve({ path, body });
    }
  }
  runInNewContext(code, {
    module, exports: module.exports, Set,
    require: (id) => {
      if (id.endsWith("hg_net_manager") && !id.endsWith("hg_net_manager_vm")) return { default: HGTestManager, __esModule: true };
      if (id.endsWith("hg_api_constants")) return { HGMANAGER_API: paths };
      if (id.endsWith("hg_iam_events")) return { hgNotifyIAMChanged: () => notifications.push("refresh") };
      throw new Error(`未预期依赖: ${id}`);
    },
  });
  const manager = module.exports.default; // 页面网络层导出的是 HGNetManagerVM 单例。
  await manager.post(paths.IAM_BINDING_GRANT_DIRECT_BATCH, { bindings: [] });
  assert.deepEqual(notifications, ["refresh"]);
  failure = true;
  await assert.rejects(manager.post(paths.IAM_ROLE_CREATE, {}), /权限不足/);
  failure = false;
  await manager.post(paths.IAM_MFA_CONFIRM, {});
  await manager.post(paths.IAM_AUTHORIZE, {});
  assert.deepEqual(notifications, ["refresh"]);
});
