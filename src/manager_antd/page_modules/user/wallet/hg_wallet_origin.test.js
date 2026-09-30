import assert from "node:assert/strict";
import test from "node:test";
import { getHGWalletLinkOrigin, isHGLocalOnlyOrigin, validateHGWalletOrigin } from "./hg_wallet_origin.js";

test("wallet origin only replaces a local dev origin", () => {
  assert.equal(getHGWalletLinkOrigin("https://mlc.example", null), "https://mlc.example");
  assert.equal(getHGWalletLinkOrigin("http://localhost:5174", null), "http://localhost:5174");
  assert.equal(getHGWalletLinkOrigin("http://localhost:5174", { address: "192.168.1.8" }), "http://192.168.1.8:5174");
  assert.equal(getHGWalletLinkOrigin("https://mlc.example", { address: "192.168.1.8" }), "https://mlc.example");
  assert.equal(isHGLocalOnlyOrigin("http://192.168.1.8:5174"), false);
});

test("ambiguous LAN selection stays an explicit error", () => {
  assert.throws(() => getHGWalletLinkOrigin("http://localhost:5174", { error: "请选择网卡" }), /请选择网卡/);
});

test("wallet origin override rejects credentials and paths", () => {
  assert.equal(validateHGWalletOrigin("https://mlc.example:5174"), "https://mlc.example:5174");
  for (const hgInvalid of ["http://user:pass@192.168.1.8:5174", "http://192.168.1.8:5174/path", "http://localhost:5174"]) {
    assert.throws(() => validateHGWalletOrigin(hgInvalid), /VITE_WALLET_DEV_ORIGIN/);
  }
});
