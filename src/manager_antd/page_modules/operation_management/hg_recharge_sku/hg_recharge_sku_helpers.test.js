import assert from "node:assert/strict";
import test from "node:test";
import { HG_EMPTY_SKU_FORM, hgBuildSkuRequest, hgFenToYuan, hgYuanToFen, hgSkuIdentity, hgValidateSkuList } from "./hg_recharge_sku_helpers.js";

test("金额按字符串精确转分，不使用浮点乘算", () => {
  assert.equal(hgYuanToFen("6"), 600);
  assert.equal(hgYuanToFen("18.09"), 1809);
  assert.equal(hgFenToYuan(23300), "233.00");
});

test("金额上下界及危险格式", () => {
  assert.equal(hgYuanToFen("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(hgFenToYuan(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  for (const hgValue of ["", "0", "0.00", "-6", "+6", "Infinity", "NaN", "6.001", ".6", "1,000", "90071992547409.92"]) {
    assert.throws(() => hgYuanToFen(hgValue));
  }
  for (const hgValue of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => hgFenToYuan(hgValue));
  for (const hgValue of ["6", "18", "68", "233", "0.29"]) assert.equal(hgYuanToFen(hgFenToYuan(hgYuanToFen(hgValue))), hgYuanToFen(hgValue));
});

test("表单独立币数、Unicode 标题及完整数值边界", () => {
  const hgForm = { ...HG_EMPTY_SKU_FORM, skuCode: "sku_6", title: "6元档", amountYuan: "6", coinAmount: "7" };
  const hgBody = hgBuildSkuRequest(hgForm);
  assert.equal(hgBody.coinAmount, 7);
  assert.equal("currency" in hgBody, false);
  assert.equal(hgBody.endTime, "");
  assert.equal("startTime" in hgBody, false);
  assert.equal("totalCoin" in hgBody, false);
  assert.equal(hgBuildSkuRequest({ ...hgForm, title: "😀".repeat(128), status: "0" }).status, 0);
  const hgCases = [
    { skuCode: "" }, { skuCode: "中" }, { skuCode: "a".repeat(65) }, { title: "😀".repeat(129) },
    { coinAmount: "" }, { coinAmount: "1e2" }, { coinAmount: "9007199254740992" },
    { bonusCoin: "-1" }, { bonusCoin: "1.5" }, { status: "2" }, { sortOrder: "-1" },
    { sortOrder: "9007199254740992" }, { coinAmount: "9007199254740991", bonusCoin: "1" },
    { startTime: "2026-02-29T00:00:00Z" }, { startTime: "2026-01-01" },
    { startTime: "2026-01-01T00:00:00Z", endTime: "2025-12-31T00:00:00Z" },
  ];
  for (const hgCase of hgCases) assert.throws(() => hgBuildSkuRequest({ ...hgForm, ...hgCase }));
  const hgIdentity = { skuId: "sku-id", version: 2 };
  assert.deepEqual(hgSkuIdentity(hgIdentity), hgIdentity);
  assert.equal(hgBuildSkuRequest(hgForm, hgIdentity).version, 2);
  assert.throws(() => hgSkuIdentity({ skuId: "sku-id", version: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => hgValidateSkuList(undefined));
  assert.throws(() => hgValidateSkuList({ list: [], nextCursor: "", hasMore: true }));
  assert.deepEqual(hgValidateSkuList({ list: [], nextCursor: "", hasMore: false }).list, []);
});

test("金额和表单边界校验", () => {
  assert.throws(() => hgYuanToFen("0.001"), /金额/);
  assert.throws(() => hgYuanToFen("1e2"), /金额/);
  assert.throws(() => hgBuildSkuRequest({ skuCode: "bad code", title: "", amountYuan: "1", coinAmount: "100", bonusCoin: "0", status: "1", sortOrder: "0" }), /SKU code/);
  assert.throws(() => hgBuildSkuRequest({ skuCode: "valid_code", title: "1元档", amountYuan: "1", coinAmount: "0", bonusCoin: "0", status: "1", sortOrder: "0" }), /基础币/);
  assert.throws(() => hgBuildSkuRequest({ skuCode: "valid_code", title: "1元档", amountYuan: "1", coinAmount: "100", bonusCoin: "0", status: "1", sortOrder: "0", startTime: "2026-02-30T00:00:00+08:00" }), /有效日期/);
  assert.equal(hgBuildSkuRequest({ skuCode: "valid_code", title: "6元", amountYuan: "6.00", coinAmount: "100", bonusCoin: "20", status: "1", sortOrder: "0" }).payAmount, 600);
});

test("创建和更新不提交服务端固定币种，标题必填且排序限 int32", () => {
  const hgForm = { ...HG_EMPTY_SKU_FORM, skuCode: "sku_6", title: " 6元档 ", amountYuan: "6", coinAmount: "7", currency: "CNY" };
  for (const hgRecord of [null, { skuId: "sku-id", version: 1 }]) {
    const hgBody = hgBuildSkuRequest(hgForm, hgRecord);
    assert.equal(Object.hasOwn(hgBody, "currency"), false);
    assert.equal(hgBody.title, "6元档");
    for (const hgTitle of [undefined, null, "", " \t\n", "　"]) {
      assert.throws(() => hgBuildSkuRequest({ ...hgForm, title: hgTitle }, hgRecord), /标题不能为空/);
    }
    for (const hgSort of ["0", "2147483647"]) {
      assert.equal(hgBuildSkuRequest({ ...hgForm, sortOrder: hgSort }, hgRecord).sortOrder, Number(hgSort));
    }
    for (const hgSort of ["2147483648", "9007199254740991"]) {
      assert.throws(() => hgBuildSkuRequest({ ...hgForm, sortOrder: hgSort }, hgRecord), /排序值不能超过 2147483647/);
    }
  }
});

test("版本从 1 开始，更新、删除身份和列表均拒绝版本 0", () => {
  for (const hgVersion of [0, -1, 1.5, "1", undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => hgSkuIdentity({ skuId: "sku-id", version: hgVersion }), /版本无效/);
  }
  assert.deepEqual(hgSkuIdentity({ skuId: "sku-id", version: 1 }), { skuId: "sku-id", version: 1 });
  const hgForm = { ...HG_EMPTY_SKU_FORM, skuCode: "sku_6", title: "6元档", amountYuan: "6", coinAmount: "7" };
  assert.throws(() => hgBuildSkuRequest(hgForm, { skuId: "sku-id", version: 0 }), /版本无效/);
  assert.throws(() => hgValidateSkuList({ list: [{ skuId: "sku-id", version: 0, payAmount: 600, currency: "CNY" }], nextCursor: "", hasMore: false }), /版本无效/);
});
