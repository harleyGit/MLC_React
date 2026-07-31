import assert from "node:assert/strict";
import test from "node:test";
import {
  HG_ASSET_PERMISSIONS,
  buildCorrectionListParams,
  buildCorrectionRequest,
  canApproveCorrection,
  getCurrentOperatorId,
  normalizeAssetPermissions,
} from "./hg_coin_operations_helpers.js";

test("normalizeAssetPermissions keeps only trimmed permission strings", () => {
  assert.deepEqual(normalizeAssetPermissions({ permissions: [" asset.coin.grant ", "", null, "asset.pipeline.read"] }), [
    "asset.coin.grant",
    "asset.pipeline.read",
  ]);
});

test("buildCorrectionRequest includes immutable workflow references", () => {
  assert.deepEqual(buildCorrectionRequest({
    userId: " user-1 ",
    requestId: "request-1",
    ticketId: " ticket-9 ",
    workOrderId: " work-3 ",
    delta: -5,
    reason: " reconcile drift ",
  }), {
    userId: "user-1",
    requestId: "request-1",
    ticketId: "ticket-9",
    workOrderId: "work-3",
    delta: "-5",
    reason: "reconcile drift",
  });
});

test("buildCorrectionListParams preserves an opaque cursor string and bounds page size", () => {
  assert.deepEqual(buildCorrectionListParams({ cursor: "00018446744073709551615", pageSize: 500 }), {
    cursor: "00018446744073709551615",
    pageSize: 100,
  });
});

test("canApproveCorrection requires approve and apply permissions", () => {
  assert.equal(canApproveCorrection(
    [HG_ASSET_PERMISSIONS.CORRECTION_APPROVE],
    { status: "pending", applicantId: "admin-1" },
    "admin-2"
  ), false);
  assert.equal(canApproveCorrection(
    [HG_ASSET_PERMISSIONS.CORRECTION_APPROVE, HG_ASSET_PERMISSIONS.CORRECTION_APPLY],
    { status: "pending", applicantId: "admin-1" },
    "admin-2"
  ), true);
});

test("canApproveCorrection rejects own pending request when operator identity is available", () => {
  assert.equal(canApproveCorrection(
    [HG_ASSET_PERMISSIONS.CORRECTION_APPROVE, HG_ASSET_PERMISSIONS.CORRECTION_APPLY],
    { status: "pending", applicantId: "admin-1" },
    "admin-1"
  ), false);
});

test("getCurrentOperatorId reads supported cached profile identity fields as strings", () => {
  assert.equal(getCurrentOperatorId({ id: 42 }), "42");
  assert.equal(getCurrentOperatorId({ user_id: " admin-7 " }), "admin-7");
  assert.equal(getCurrentOperatorId(null), "");
});
