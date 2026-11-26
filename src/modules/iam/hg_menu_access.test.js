import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { transformSync } from "@swc/core";
import { hgEvaluateAccess } from "./hg_access_evaluator.js";
import { HG_PERMISSIONS } from "./hg_permission_codes.js";

/** 加载真实菜单权限逻辑；仅补齐项目省略扩展名的浏览器导入。 */
function hgLoadMenuAccess() {
  const source = readFileSync(new URL("./hg_menu_access.js", import.meta.url), "utf8");
  const code = transformSync(source, { jsc: { target: "es2022" }, module: { type: "commonjs" } }).code;
  const module = { exports: {} };
  runInNewContext(code, {
    module, exports: module.exports,
    require(path) {
      if (path === "./hg_permission_codes") return { HG_PERMISSIONS };
      if (path === "./hg_access_evaluator") return { hgEvaluateAccess };
      throw new Error(`未知依赖：${path}`);
    },
  });
  return module.exports;
}

test("通知菜单递归过滤无权子项，发送页允许创建者或审批人进入", () => {
  const { hgCanOpenOperation, hgFilterOperationMenu } = hgLoadMenuAccess();
  const items = [{ key: "system", children: [{ key: "system_notify", children: [
    { key: "system_notify_send" }, { key: "system_notify_channel" },
  ] }] }];
  const snapshot = (permission) => ({
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    grants: [{ permission, scope_type: "global", scope_id: "" }],
  });
  for (const permission of [HG_PERMISSIONS.NOTIFICATION_SEND_CREATE, HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE]) {
    const allowed = snapshot(permission);
    assert.equal(hgCanOpenOperation(allowed, "system_notify_send"), true);
    assert.deepEqual(JSON.parse(JSON.stringify(hgFilterOperationMenu(items, allowed))), [{
      key: "system", children: [{ key: "system_notify", children: [{ key: "system_notify_send" }] }],
    }]);
  }
  assert.equal(hgCanOpenOperation(snapshot(HG_PERMISSIONS.NOTIFICATION_CHANNEL_READ), "system_notify_send"), false);
  assert.equal(hgCanOpenOperation(snapshot(HG_PERMISSIONS.NOTIFICATION_SEND_READ), "system_notify_send_records"), true);
  assert.equal(hgCanOpenOperation(snapshot(HG_PERMISSIONS.NOTIFICATION_SEND_CREATE), "system_notify_send_records"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(hgFilterOperationMenu(items, snapshot(HG_PERMISSIONS.NOTIFICATION_CHANNEL_READ)))), [{
    key: "system", children: [{ key: "system_notify", children: [{ key: "system_notify_channel" }] }],
  }]);
  assert.equal(hgFilterOperationMenu(items, snapshot(HG_PERMISSIONS.USER_READ)).length, 0);
});

test("全站媒体盘点要求全局独立授权，本人资源入口不依赖盘点权限", () => {
  const { hgCanOpenOperation } = hgLoadMenuAccess();
  const snapshot = (permission, scope_type = "global", scope_id = "") => ({
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    grants: [{ permission, scope_type, scope_id }],
  });
  const fileRead = snapshot(HG_PERMISSIONS.OPS_FILE_READ);
  const inventoryRead = snapshot(HG_PERMISSIONS.MEDIA_INVENTORY_READ);
  assert.equal(hgCanOpenOperation(fileRead, "resource_file_list"), true);
  assert.equal(hgCanOpenOperation(fileRead, "resource_media_inventory"), false);
  assert.equal(hgCanOpenOperation(inventoryRead, "resource_media_inventory"), true);
  assert.equal(hgCanOpenOperation(inventoryRead, "resource_file_list"), false);
  assert.equal(hgCanOpenOperation(snapshot(HG_PERMISSIONS.MEDIA_INVENTORY_READ, "shop", "42"), "resource_media_inventory"), false);
});
