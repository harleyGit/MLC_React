import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// 仅隔离 HTTP 边界，确认真实 VM 的 CRUD URL、方法与入参契约，不读取会话或触及真实服务。
const result = await build({
  entryPoints: [fileURLToPath(new URL("./hg_system_notify_template_vm.jsx", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  plugins: [{
    name: "mock-template-http",
    setup(plugin) {
      plugin.onResolve({ filter: /hg_api_constants|hg_net_manager_vm|hg_request_error/ },
        (args) => ({ path: args.path, namespace: "mock-template-http" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock-template-http" }, (args) => ({
        contents: args.path.includes("hg_api_constants")
          ? 'export const HGMANAGER_API = { NOTIFICATION_TEMPLATES: "/api/v1/admin/notification/templates" };'
          : args.path.includes("hg_request_error")
            ? 'export const getRequestErrorMessage = (error) => error.message;'
            : `export default {
              get: (...args) => globalThis.__hgTemplateCalls.push(["get", ...args]),
              post: (...args) => globalThis.__hgTemplateCalls.push(["post", ...args]),
              put: (...args) => globalThis.__hgTemplateCalls.push(["put", ...args]),
            };`,
        loader: "js",
      }));
    },
  }],
});
const HGVM = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`)).default;

test("角色更新模板通过既有带鉴权请求层使用创建、列表、详情和更新接口", () => {
  const calls = [];
  globalThis.__hgTemplateCalls = calls;
  try {
    const base = "/api/v1/admin/notification/templates";
    const body = { name: "角色更新通知", version: 1 };
    HGVM.create({ ...body, template_code: "iam.role.updated" });
    HGVM.list();
    HGVM.detail("9007199254740993");
    HGVM.update("9007199254740993", body);
    HGVM.publish("9007199254740993", 2);
    HGVM.publishSend("9007199254740993", 2);
    HGVM.publishGeneral("9007199254740993", 2);
    assert.deepEqual(calls, [
      ["post", base, { ...body, template_code: "iam.role.updated" }, { _hasRetried: true }],
      ["get", base, {}],
      ["get", `${base}/detail`, { id: "9007199254740993" }],
      ["put", `${base}/update?id=9007199254740993`, body, { _hasRetried: true }],
      ["post", `${base}/publish?id=9007199254740993`, { version: 2 }, { _hasRetried: true }],
      ["post", `${base}/publish-send?id=9007199254740993`, { version: 2 }, { _hasRetried: true }],
      ["post", `${base}/publish-general?id=9007199254740993`, { version: 2 }, { _hasRetried: true }],
    ]);
  } finally {
    delete globalThis.__hgTemplateCalls;
  }
});
