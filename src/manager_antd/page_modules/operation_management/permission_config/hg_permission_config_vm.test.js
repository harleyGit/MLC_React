import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

// 仅替换网络边界，确保身份核验不会因前缀匹配到别的管理员而误判。
const result = await build({
  entryPoints: [fileURLToPath(new URL("./hg_permission_config_vm.jsx", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  plugins: [{
    name: "mock-network",
    setup(plugin) {
      plugin.onResolve({ filter: /hg_api_constants|hg_net_manager_vm/ }, (args) => ({ path: args.path, namespace: "mock-network" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock-network" }, (args) => ({
        contents: args.path.includes("hg_api_constants")
          ? 'export const HGMANAGER_API = { OPS_ADMIN_SEARCH: "/users/search", IAM_BINDING_LIST: "/bindings/list", IAM_PERMISSION_LIST: "/permissions/list" };'
          : 'export default { get: (...args) => globalThis.__hgConfigGet(...args) };',
        loader: "js",
      }));
    },
  }],
});

const { default: HGPermissionConfigVM, HG_INVENTORY_PERMISSION, HG_GRANT_PERMISSION } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("核对精确 user_id，不把同前缀、手机号或未返回账号当成管理员", async () => {
  globalThis.__hgConfigGet = async () => ({ list: [{ id: "hgid_1234", status: 1 }, { id: "hgid_123", status: 0 }] });
  assert.deepEqual(await HGPermissionConfigVM.findAdmin("hgid_123"), { id: "hgid_123", status: 0 });
  assert.equal(await HGPermissionConfigVM.findAdmin("hgid_12"), null);
  delete globalThis.__hgConfigGet;
});

test("IAM 查询仅使用绑定及角色权限协议，不执行写请求", async () => {
  const requests = [];
  globalThis.__hgConfigGet = (...args) => { requests.push(args); return Promise.resolve({ selected: [HG_INVENTORY_PERMISSION] }); };
  await HGPermissionConfigVM.fetchBindings("hgid_test", "123");
  await HGPermissionConfigVM.fetchRolePermissions("456");
  assert.deepEqual(requests, [
    ["/bindings/list", { userId: "hgid_test", cursor: "123", pageSize: 20 }],
    ["/permissions/list", { roleId: "456" }],
  ]);
  assert.equal(HGPermissionConfigVM.hasPermission([HG_INVENTORY_PERMISSION], HG_INVENTORY_PERMISSION), true);
  assert.equal(HGPermissionConfigVM.hasPermission([], HG_GRANT_PERMISSION), false);
  assert.equal(HGPermissionConfigVM.hasPermission(null, HG_GRANT_PERMISSION), false);
  delete globalThis.__hgConfigGet;
});
