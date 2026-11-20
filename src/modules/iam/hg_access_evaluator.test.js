import test from "node:test";
import assert from "node:assert/strict";
import { hgEvaluateAccess } from "./hg_access_evaluator.js";

const snapshot = {
  expires_at: "2099-01-01T00:00:00Z",
  grants: [
    { permission: "mall:product:update", scope_type: "shop", scope_id: "A" },
    { permission: "mall:product:publish", scope_type: "shop", scope_id: "B" },
    { permission: "iam:role:read", scope_type: "global", scope_id: "" },
  ],
};

test("绑定内作用域可通过，不能合并其他绑定的权限范围", () => {
  assert.equal(hgEvaluateAccess(snapshot, { permission: "mall:product:update", scopeType: "shop", scopeId: "A" }).allowed, true);
  assert.equal(hgEvaluateAccess(snapshot, { permission: "mall:product:update", scopeType: "shop", scopeId: "B" }).allowed, false);
  assert.equal(hgEvaluateAccess(snapshot, { permission: "mall:product:publish", scopeType: "shop", scopeId: "A" }).allowed, false);
});

test("未声明作用域只允许全局授权，过期或缺失默认拒绝", () => {
  assert.equal(hgEvaluateAccess(snapshot, { permission: "mall:product:update" }).allowed, false);
  assert.equal(hgEvaluateAccess(snapshot, { permission: "iam:role:read" }).allowed, true);
  assert.equal(hgEvaluateAccess({ ...snapshot, expires_at: "2000-01-01T00:00:00Z" }, { permission: "iam:role:read" }).allowed, false);
  assert.equal(hgEvaluateAccess(null, { permission: "iam:role:read" }).allowed, false);
});
