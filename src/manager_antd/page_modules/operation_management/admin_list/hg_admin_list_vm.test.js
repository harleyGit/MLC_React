import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

/** 构建真实 VM，仅替换网络边界，避免访问开发代理及真实管理员数据。 */
const hgBundle = await build({
  entryPoints: [fileURLToPath(new URL("./hg_admin_list_vm.jsx", import.meta.url))],
  bundle: true, write: false, format: "esm", platform: "neutral",
  plugins: [{
    name: "mock-network",
    setup(plugin) {
      plugin.onResolve({ filter: /hg_api_constants|hg_net_manager_vm/ }, (args) => ({ path: args.path, namespace: "mock-network" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock-network" }, (args) => ({
        contents: args.path.includes("hg_api_constants")
          ? 'export const HGMANAGER_API = { IAM_BINDING_LIST: "/bindings/list", IAM_ROLE_LIST: "/roles/list", IAM_PERMISSION_LIST: "/permissions/list" };'
          : 'export default { get: (...args) => globalThis.__hgAdminGet(...args) };',
        loader: "js",
      }));
    },
  }],
});

const { default: HGAdminListVM } = await import(`data:text/javascript;base64,${Buffer.from(hgBundle.outputFiles[0].text).toString("base64")}`);

test("绑定查询使用精确管理员 ID 和字符串游标，不读取待审批授权", async () => {
  const requests = []; // 记录只读网络请求；测试结束移除全局替身。
  globalThis.__hgAdminGet = (...args) => { requests.push(args); return Promise.resolve({ list: [] }); };
  try {
    await HGAdminListVM.fetchBindings("hgid_123", "9007199254740993");
    assert.deepEqual(requests, [["/bindings/list", { userId: "hgid_123", cursor: "9007199254740993", pageSize: 20 }]]);
  } finally {
    delete globalThis.__hgAdminGet;
  }
});

test("角色名称按游标查找，权限只展示服务端选中编码且同角色去重", async () => {
  const requests = []; // 两页角色目录及单个角色权限请求。
  globalThis.__hgAdminGet = async (url, params) => {
    requests.push([url, params]);
    if (url === "/roles/list") return params.cursor === "0"
      ? { list: [{ id: "1", name: "运营" }], hasMore: true, nextCursor: "9007199254740993" }
      : { list: [{ id: "2", name: "审核" }], hasMore: false };
    return { list: [{ code: "a:read", description: "读取" }, { code: "b:write", description: "修改" }], selected: ["a:read"] };
  };
  try {
    assert.deepEqual(await HGAdminListVM.fetchRoleNames(["2"]), { "2": "审核" });
    assert.deepEqual(await HGAdminListVM.fetchRolePermissions(["2", "2"]), {
      "2": { list: [{ code: "a:read", description: "读取" }], error: "" },
    });
    assert.equal(requests.filter(([url]) => url === "/permissions/list").length, 1);
    assert.equal(requests[1][1].cursor, "9007199254740993");
  } finally {
    delete globalThis.__hgAdminGet;
  }
});

test("角色权限失败保留错误，不误报暂无权限", async () => {
  globalThis.__hgAdminGet = async () => { throw new Error("权限服务不可用"); };
  try {
    assert.deepEqual(await HGAdminListVM.fetchRolePermissions(["1"]), {
      "1": { list: [], error: "业务权限加载失败，请重试" },
    });
  } finally {
    delete globalThis.__hgAdminGet;
  }
});
