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
          ? 'export const HGMANAGER_API = { IAM_BINDING_LIST: "/bindings/list", IAM_BINDING_PENDING: "/bindings/pending", IAM_ROLE_LIST: "/roles/list", IAM_PERMISSION_LIST: "/permissions/list", IAM_BINDING_REVOKE: "/bindings/revoke", IAM_APPROVAL_APPROVE: "/approvals/approve", IAM_APPROVAL_REJECT: "/approvals/reject" };'
          : 'export default { get: (...args) => globalThis.__hgAdminGet(...args), post: (...args) => globalThis.__hgAdminPost(...args) };',
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

test("授权查询待审批使用独立只读接口及审批游标，保留大整数精度", async () => {
  const requests = []; // 独立审批游标；不复用生效绑定的绑定 ID。
  globalThis.__hgAdminGet = (...args) => { requests.push(args); return Promise.resolve({ list: [] }); };
  try {
    await HGAdminListVM.fetchPendingGrants("hgid_123", "9007199254740993");
    assert.deepEqual(requests, [["/bindings/pending", { userId: "hgid_123", cursor: "9007199254740993", pageSize: 20 }]]);
  } finally {
    delete globalThis.__hgAdminGet;
  }
});

test("迁移的目标授权操作仍按申请编号审批、按绑定 ID 撤销，维持原有 POST 协议", async () => {
  const calls = []; // 不保存任何真实验证码；仅验证本地测试的固定占位值。
  globalThis.__hgAdminPost = (...args) => { calls.push(args); return Promise.resolve({}); };
  try {
    await HGAdminListVM.decideApproval("9007199254740993", "123456", true);
    await HGAdminListVM.decideApproval("8", "123456", false);
    await HGAdminListVM.revokeBinding("hgid_A", "9007199254740994");
    assert.deepEqual(calls, [
      ["/approvals/approve", { id: "9007199254740993", mfaCode: "123456" }],
      ["/approvals/reject", { id: "8", mfaCode: "123456" }],
      ["/bindings/revoke", { userId: "hgid_A", bindingId: "9007199254740994" }],
    ]);
  } finally {
    delete globalThis.__hgAdminPost;
  }
});

test("角色名称按游标查找，权限目录与已选编码分开保留且同角色去重", async () => {
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
      "2": {
        list: [{ code: "a:read", description: "读取" }, { code: "b:write", description: "修改" }],
        selected: ["a:read"],
        error: "",
      },
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
      "1": { list: [], selected: [], error: "业务权限加载失败，请重试" },
    });
  } finally {
    delete globalThis.__hgAdminGet;
  }
});
