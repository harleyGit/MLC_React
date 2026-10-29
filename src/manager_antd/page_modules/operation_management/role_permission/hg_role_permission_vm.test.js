import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

// 仅替换网络边界；VM 的目录转换和提交字段仍使用真实实现，不访问后端。
const result = await build({
  entryPoints: [fileURLToPath(new URL("./hg_role_permission_vm.jsx", import.meta.url))],
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
          ? 'export const HGMANAGER_API = { IAM_ROLE_LIST: "/roles/list", IAM_PERMISSION_LIST: "/permissions/list", IAM_ROLE_PERMISSIONS: "/roles/permissions" };'
          : 'export default { get: (...args) => globalThis.__hgPermissionRequests.push(["get", ...args]), post: (...args) => globalThis.__hgPermissionRequests.push(["post", ...args]) };',
        loader: "js",
      }));
    },
  }],
});

const { default: HGRolePermissionVM } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("只展示服务端登记的权限，系统管理按用户、角色、权限归组", () => {
  const tree = HGRolePermissionVM.buildCatalogTree([
    { code: "user:profile:read", description: "查看用户资料" },
    { code: "iam:role:read", description: "读取角色和授权" },
    { code: "iam:approval:approve", description: "审批 IAM 扩权" },
    { code: "ops:metrics:read", description: "读取运维指标" },
    { code: "new:thing:read", description: "新权限" },
  ]);
  const groups = HGRolePermissionVM.buildPermissionGroups(tree);
  const system = groups.find((group) => group.title === "系统管理");
  assert.deepEqual(system.children.map((resource) => resource.title), ["用户管理", "角色管理", "权限管理"]);
  assert.deepEqual(HGRolePermissionVM.collectLeafValues(tree).sort(), [
    "user:profile:read", "iam:role:read", "iam:approval:approve", "ops:metrics:read", "new:thing:read",
  ].sort());
  assert.deepEqual(HGRolePermissionVM.normalizeSelectedValues(tree, ["iam:role:read"]), ["iam:role:read"]);
  assert.ok(!HGRolePermissionVM.collectLeafValues(tree).includes("system:user:delete"));
});

test("无效或重复目录拒绝渲染，不使用本地 mock 补齐", () => {
  assert.throws(() => HGRolePermissionVM.buildCatalogTree(null));
  assert.throws(() => HGRolePermissionVM.buildCatalogTree([{ code: "iam:role:read" }, { code: "iam:role:read" }]));
  assert.throws(() => HGRolePermissionVM.buildCatalogTree([{ code: "system:user:list:extra" }]));
  assert.deepEqual(HGRolePermissionVM.buildCatalogTree([]), []);
});

test("角色游标、权限回填及 MFA 申请使用已存在的后端协议", () => {
  const requests = [];
  globalThis.__hgPermissionRequests = requests;
  HGRolePermissionVM.fetchRoles("123");
  HGRolePermissionVM.fetchRolePermissions("456");
  HGRolePermissionVM.submitRolePermission(HGRolePermissionVM.transformSubmitData({
    roleId: "456", permissionValues: ["iam:role:read"], mfaCode: "123456",
  }));
  assert.deepEqual(requests, [
    ["get", "/roles/list", { cursor: "123", pageSize: 100 }],
    ["get", "/permissions/list", { roleId: "456" }],
    ["post", "/roles/permissions", { roleId: "456", permissions: ["iam:role:read"], mfaCode: "123456" }],
  ]);
  delete globalThis.__hgPermissionRequests;
});
