import { networkInterfaces } from "node:os";
import { readFileSync } from "node:fs";
import process from "node:process";
import { loadEnv } from "vite";
import { validateHGWalletOrigin } from "./src/manager_antd/page_modules/user/wallet/hg_wallet_origin.js";

/** 仅自动选择常规物理网卡的 RFC1918 IPv4；不猜测 VPN、容器或多个网卡的路由。 */
export function selectHGWalletLAN(hgInterfaces, hgOverride = "", hgInterface = "") {
  if (hgOverride) return { origin: validateHGWalletOrigin(hgOverride) };
  const hgCandidates = [];
  for (const [hgName, hgEntries] of Object.entries(hgInterfaces)) {
    if (!/^(en\d+|eth\d+|wlan\d+|en[opsx][\w]+|wl[opsx][\w]+)$/.test(hgName)) continue;
    if (hgInterface && hgName !== hgInterface) continue;
    for (const hgEntry of hgEntries || []) {
      if (hgEntry.family !== "IPv4" || hgEntry.internal) continue;
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hgEntry.address)) continue;
      hgCandidates.push({ name: hgName, address: hgEntry.address });
    }
  }
  if (hgCandidates.length === 1) return { address: hgCandidates[0].address };
  const hgChoices = hgCandidates.map((hgItem) => `${hgItem.name}=${hgItem.address}`).join("、");
  return { error: `无法唯一确定手机可达网卡${hgChoices ? `（${hgChoices}）` : ""}。请设置 VITE_WALLET_DEV_INTERFACE 或 VITE_WALLET_DEV_ORIGIN 后重启开发服务；不会生成 localhost 二维码。` };
}

/** 开发专用注入，不访问外网；TLS 文件仅在 Node 读取，绝不注入浏览器。 */
export default function hgWalletDevPlugin() {
  return {
    name: "hg-wallet-dev-origin",
    apply: "serve",
    config(hgConfig, hgContext) {
      const hgEnv = loadEnv(hgContext.mode, hgConfig.envDir || process.cwd(), "VITE_WALLET_DEV_");
      const hgLAN = selectHGWalletLAN(networkInterfaces(), hgEnv.VITE_WALLET_DEV_ORIGIN, hgEnv.VITE_WALLET_DEV_INTERFACE);
      const hgCert = process.env.MLC_DEV_TLS_CERT;
      const hgKey = process.env.MLC_DEV_TLS_KEY;
      if (!!hgCert !== !!hgKey) throw new Error("MLC_DEV_TLS_CERT 与 MLC_DEV_TLS_KEY 必须同时配置");
      return {
        define: { __HG_WALLET_DEV_ORIGIN__: JSON.stringify(hgLAN) },
        server: hgCert ? { https: { cert: readFileSync(hgCert), key: readFileSync(hgKey) } } : {},
      };
    },
  };
}
