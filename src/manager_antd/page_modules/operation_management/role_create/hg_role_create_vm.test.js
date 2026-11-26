import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// 只替换角色表单 VM 的网络边界，验证创建/编辑共用页不会发起错误的写请求。
const result = await build({
  entryPoints: [
    fileURLToPath(new URL("./hg_role_create_vm.jsx", import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  plugins: [
    {
      name: "mock-role-form-network",
      setup(plugin) {
        plugin.onResolve(
          { filter: /hg_api_constants|hg_net_manager_vm/ },
          (args) => ({ path: args.path, namespace: "mock-role-form-network" })
        );
        plugin.onLoad(
          { filter: /.*/, namespace: "mock-role-form-network" },
          (args) => ({
            contents: args.path.includes("hg_api_constants")
              ? `export const HGMANAGER_API = {
                  IAM_PERMISSION_LIST: "/permissions/list",
                  IAM_ROLE_CREATE: "/roles/create",
                  IAM_ROLE_UPDATE: "/roles/update",
                  IAM_ROLE_PERMISSIONS: "/roles/permissions"
                };`
              : `export default {
                  get: (...args) => globalThis.__hgRoleFormGet(...args),
                  post: (...args) => globalThis.__hgRoleFormPost(...args)
                };`,
            loader: "js",
          })
        );
      },
    },
  ],
});

const { default: HGRoleCreateVM } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString(
    "base64"
  )}`
);

test("编辑页按角色 ID 读取权限，创建页只读取权限目录", async () => {
  const calls = [];
  globalThis.__hgRoleFormGet = async (...args) => {
    calls.push(args);
    return { list: [], selected: [] };
  };
  await HGRoleCreateVM.fetchPermissions();
  await HGRoleCreateVM.fetchPermissions("9007199254740993");
  assert.deepEqual(calls, [
    ["/permissions/list", undefined],
    ["/permissions/list", { roleId: "9007199254740993" }],
  ]);
  delete globalThis.__hgRoleFormGet;
});

test("权限快照比较忽略顺序和重复项", () => {
  assert.equal(
    HGRoleCreateVM.permissionsChanged(["video:read", "role:list"], [
      "role:list",
      "video:read",
      "video:read",
    ]),
    false
  );
  assert.equal(
    HGRoleCreateVM.permissionsChanged(["video:read"], ["video:write"]),
    true
  );
});

test("编辑未改权限时只更新基础信息，不要求 MFA", async () => {
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return { id: "101" };
  };
  await HGRoleCreateVM.submitRoleEdit(
    {
      id: "101",
      name: "运营主管",
      description: "负责运营",
      permissions: ["role:list", "video:read"],
      mfaCode: "",
    },
    ["video:read", "role:list"]
  );
  assert.deepEqual(calls, [
    [
      "/roles/update",
      { id: "101", name: "运营主管", description: "负责运营" },
    ],
  ]);
  delete globalThis.__hgRoleFormPost;
});

test("编辑修改权限时先校验 MFA，再更新基础信息并提交权限审批", async () => {
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return args[0] === "/roles/permissions"
      ? { approvalId: "approval-1" }
      : { id: "101" };
  };
  await assert.rejects(
    HGRoleCreateVM.submitRoleEdit(
      {
        id: "101",
        name: "运营主管",
        description: "",
        permissions: ["video:write"],
        mfaCode: "",
      },
      ["video:read"]
    ),
    /6 位 MFA/
  );
  assert.equal(calls.length, 0);

  const resultWithApproval = await HGRoleCreateVM.submitRoleEdit(
    {
      id: "101",
      name: "运营主管",
      description: "",
      permissions: ["video:write"],
      mfaCode: "123456",
    },
    ["video:read"]
  );
  assert.deepEqual(calls, [
    ["/roles/update", { id: "101", name: "运营主管", description: "" }],
    [
      "/roles/permissions",
      {
        roleId: "101",
        permissions: ["video:write"],
        mfaCode: "123456",
      },
    ],
  ]);
  assert.equal(resultWithApproval.approvalId, "approval-1");
  delete globalThis.__hgRoleFormPost;
});

test("运维内置角色保存权限时不调用基础信息更新接口", async () => {
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return { approvalId: "approval-ops", status: "pending" };
  };
  try {
    const role = { id: "6", code: "ops_engineer", name: "运维人员", description: "系统观测与受控操作", builtIn: true };
    const data = { ...role, permissions: ["ops:metrics:read"], mfaCode: "123456" };
    const result = await HGRoleCreateVM.submitRoleEdit(data, [], role);
    assert.deepEqual(calls, [
      ["/roles/permissions", { roleId: "6", permissions: ["ops:metrics:read"], mfaCode: "123456" }],
    ]);
    assert.equal(result.approvalId, "approval-ops");
    await assert.rejects(
      HGRoleCreateVM.submitRoleEdit({ ...data, name: "新名称" }, [], role),
      /内置角色/
    );
    assert.equal(calls.length, 1);
  } finally {
    delete globalThis.__hgRoleFormPost;
  }
});

test("角色基础信息未变更时仅申请发生变化的权限", async () => {
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return { approvalId: "approval-custom" };
  };
  try {
    const role = { id: "101", code: "custom_ops", name: "运营主管", description: "", builtIn: false };
    const data = { ...role, permissions: ["ops:metrics:read"], mfaCode: "123456" };
    const result = await HGRoleCreateVM.submitRoleEdit(data, [], role);
    assert.deepEqual(calls, [
      ["/roles/permissions", { roleId: "101", permissions: ["ops:metrics:read"], mfaCode: "123456" }],
    ]);
    assert.equal(result.approvalId, "approval-custom");
  } finally {
    delete globalThis.__hgRoleFormPost;
  }
});

test("其他内置角色不可通过编辑入口提交权限，自定义角色无变更不发请求", async () => {
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return { id: "101" };
  };
  try {
    const protectedRole = { id: "1", code: "super_admin", name: "超级管理员", description: "", builtIn: true };
    await assert.rejects(
      HGRoleCreateVM.submitRoleEdit({ ...protectedRole, permissions: ["iam:role:read"], mfaCode: "123456" }, [], protectedRole),
      /该内置角色权限/
    );
    const role = { id: "101", code: "custom_ops", name: "运营主管", description: "", builtIn: false };
    const result = await HGRoleCreateVM.submitRoleEdit({ ...role, permissions: [], mfaCode: "" }, [], role);
    assert.equal(result.unchanged, true);
    assert.deepEqual(calls, []);
  } finally {
    delete globalThis.__hgRoleFormPost;
  }
});

test("通知模板预选仅使用后端目录四项权限，保留原有选择且不接受缺项或超限", () => {
  const codes = [
    "notification:template:read", "notification:template:create",
    "notification:template:update", "notification:template:delete",
  ];
  const directory = codes.map((code) => ({ code, description: code }));
  const selected = HGRoleCreateVM.selectNotificationTemplatePermissions(directory, ["iam:role:read", codes[0]]);
  assert.deepEqual(selected, ["iam:role:read", ...codes]);
  assert.deepEqual(
    HGRoleCreateVM.selectNotificationTemplatePermissions(directory, selected),
    selected
  );
  assert.throws(() => HGRoleCreateVM.selectNotificationTemplatePermissions(directory.slice(0, 3), []), /权限目录/);
  assert.throws(() => HGRoleCreateVM.selectNotificationTemplatePermissions(directory, Array.from({ length: 47 }, (_, index) => `fixture:${index}`)), /最多 50/);
});

test("新建角色选择通知模板预选项后仍调用后端创建及 MFA 权限审批接口", async () => {
  const codes = [
    "notification:template:read", "notification:template:create",
    "notification:template:update", "notification:template:delete",
  ];
  const calls = [];
  globalThis.__hgRoleFormPost = async (...args) => {
    calls.push(args);
    return args[0] === "/roles/create"
      ? { id: "101", code: "notify_operator" }
      : { approvalId: "approval-101", status: "pending" };
  };
  try {
    const permissions = HGRoleCreateVM.selectNotificationTemplatePermissions(
      codes.map((code) => ({ code, description: "" })), []
    );
    await assert.rejects(() => HGRoleCreateVM.submitRole({
      code: "notify_operator", name: "通知模板管理员", description: "",
      permissions, mfaCode: "",
    }), /MFA/);
    assert.equal(calls.length, 0);
    const result = await HGRoleCreateVM.submitRole({
      code: "notify_operator", name: "通知模板管理员", description: "",
      permissions, mfaCode: "123456",
    });
    assert.deepEqual(calls, [
      ["/roles/create", { code: "notify_operator", name: "通知模板管理员", description: "", permissions: [] }],
      ["/roles/permissions", { roleId: "101", permissions: codes, mfaCode: "123456" }],
    ]);
    assert.equal(result.approvalId, "approval-101");
  } finally {
    delete globalThis.__hgRoleFormPost;
  }
});
