import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// 仅隔离请求层，确保旧页面不会再调用已返回 410 的 ops 角色接口。
async function hgLoadVM(path) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    write: false,
    platform: "neutral",
    format: "esm",
    plugins: [{
      name: "mock-iam-network",
      setup(plugin) {
        plugin.onResolve({ filter: /hg_api_constants|hg_net_manager_vm/ }, (args) => ({ path: args.path, namespace: "mock-iam-network" }));
        plugin.onLoad({ filter: /.*/, namespace: "mock-iam-network" }, (args) => ({
          contents: args.path.includes("hg_api_constants")
            ? 'export const HGMANAGER_API = { IAM_ROLE_LIST: "/api/v1/iam/roles/list", OPS_ROLE_LIST: "/api/v1/ops/roles/list", OPS_USER_ROLES: "/api/v1/ops/users/roles", OPS_USER_ROLE_LIST: "/api/v1/ops/users/roles/list" };'
            : 'export default { get: (...args) => { globalThis.__hgRoleCalls.push(args); return Promise.resolve({ list: [{ id: "101", name: "角色" }], hasMore: false, nextCursor: "" }); }, post: (...args) => { globalThis.__hgRoleCalls.push(args); return Promise.resolve({}); } };',
          loader: "js",
        }));
      },
    }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`)).default;
}

test("旧授权页面只从 IAM 读取角色，不向 410 接口写入 IAM ID", async () => {
  globalThis.__hgRoleCalls = [];
  const HGAdminRoleAssignVM = await hgLoadVM("./admin_role_assign/hg_admin_role_assign_vm.jsx");
  const HGUserPermissionVM = await hgLoadVM("./user_permission/hg_user_permission_vm.jsx");
  const adminRoles = await HGAdminRoleAssignVM.fetchAllRoleList();
  const userRoles = await HGUserPermissionVM.fetchAllRoleOptions();
  assert.equal(adminRoles.list[0].id, "101");
  assert.equal(userRoles.list[0].id, "101");
  assert.deepEqual(globalThis.__hgRoleCalls, [
    ["/api/v1/iam/roles/list", { cursor: 0, pageSize: 100 }],
    ["/api/v1/iam/roles/list", { cursor: 0, pageSize: 100 }],
  ]);
  await assert.rejects(HGAdminRoleAssignVM.fetchUserRoles("user-id"));
  await assert.rejects(HGUserPermissionVM.fetchUserRoles("user-id"));
  await assert.rejects(HGAdminRoleAssignVM.submitAdminRole({ admin_user_id: "user-id", role_ids: ["101"] }));
  await assert.rejects(HGUserPermissionVM.assignUserRoles("user-id", ["101"]));
  assert.equal(globalThis.__hgRoleCalls.length, 2);
  delete globalThis.__hgRoleCalls;
});
