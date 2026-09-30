import assert from "node:assert/strict";
import test from "node:test";
import { selectHGWalletLAN } from "./hg_wallet_dev.js";

const hgEntry = (address, family = "IPv4", internal = false) => ({ address, family, internal });

test("selects one physical private IPv4 and ignores loopback, link-local and VPN", () => {
  assert.deepEqual(selectHGWalletLAN({
    lo0: [hgEntry("127.0.0.1", "IPv4", true)],
    en0: [hgEntry("192.168.1.8")],
    utun4: [hgEntry("10.8.0.2")],
    en1: [hgEntry("169.254.1.2")],
  }), { address: "192.168.1.8" });
});

test("requires explicit configuration for multiple private IPv4 addresses", () => {
  assert.match(selectHGWalletLAN({ en0: [hgEntry("192.168.1.8")], en1: [hgEntry("10.0.0.8")] }).error, /VITE_WALLET_DEV_INTERFACE/);
  assert.deepEqual(selectHGWalletLAN({ en0: [hgEntry("192.168.1.8")], en1: [hgEntry("10.0.0.8")] }, "https://mlc.example:5174"), { origin: "https://mlc.example:5174" });
});
