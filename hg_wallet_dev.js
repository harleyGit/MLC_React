/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-09-30 21:28:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-08 16:11:56
 * @FilePath: /MLC_React/hg_wallet_dev.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 *
 * hgWalletDevPlugin 方法，它整体是在解决一个开发环境问题：自动找到手机能够访问电脑的局域网 IP，并把这个地址提供给前端；如果配置了 HTTPS 证书，还让 Vite 开发服务器使用 HTTPS
 * 份代码的目的就是：
Vite 启动
  ↓
获取电脑所有网卡
  ↓
找到手机可以访问的局域网 IPv4
  ↓
例如 192.168.1.100
  ↓
把地址注入前端
  ↓
手机扫码时使用这个地址
  ↓
如果配置 TLS 证书，则开发服务器使用 HTTPS
 */
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import process from "node:process";
import { loadEnv } from "vite";
import { validateHGWalletOrigin } from "./src/manager_antd/page_modules/user/wallet/hg_wallet_origin.js";

/** 从电脑的网卡中找到一个合适的局域网 IPv4 地址。
 * 仅自动选择常规物理网卡的 RFC1918 IPv4；不猜测 VPN、容器或多个网卡的路由。 
 * 
 * hgOverride 是手动指定地址
*/
export function selectHGWalletLAN(
  hgInterfaces,
  hgOverride = "",
  hgInterface = ""
) {
  if (hgOverride) return { origin: validateHGWalletOrigin(hgOverride) };
  const hgCandidates = [];
  // 一个一个检查电脑的网卡;
  for (const [hgName, hgEntries] of Object.entries(hgInterfaces)) {
    // 只关注常见的真实网络接口，比如 en0、eth0、wlan0 等；
    if (!/^(en\d+|eth\d+|wlan\d+|en[opsx][\w]+|wl[opsx][\w]+)$/.test(hgName))
      continue;
    if (hgInterface && hgName !== hgInterface) continue;
    for (const hgEntry of hgEntries || []) {
      // 筛选 IPv4 + 局域网 IP
      if (hgEntry.family !== "IPv4" || hgEntry.internal) continue;
      // 要求 IP 是常见的私有局域网地址
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hgEntry.address))
        continue;
      hgCandidates.push({ name: hgName, address: hgEntry.address });
    }
  }
  if (hgCandidates.length === 1) return { address: hgCandidates[0].address };
  const hgChoices = hgCandidates
    .map((hgItem) => `${hgItem.name}=${hgItem.address}`)
    .join("、");
  return {
    error: `无法唯一确定手机可达网卡${
      hgChoices ? `（${hgChoices}）` : ""
    }。请设置 VITE_WALLET_DEV_INTERFACE 或 VITE_WALLET_DEV_ORIGIN 后重启开发服务；不会生成 localhost 二维码。`,
  };
}

/** 给 Vite 开发服务器增加一些自定义配置
 * 开发专用注入，不访问外网；TLS 文件仅在 Node 读取，绝不注入浏览器。 
 * 
 * apply: "serve"，表示：只在开发服务器模式使用，不影响正式 build。
 * */
export default function hgWalletDevPlugin() {
  return {
    name: "hg-wallet-dev-origin",
    apply: "serve",
    config(hgConfig, hgContext) {
      // 读取环境变量，也就是读取 .env 配置
      const hgEnv = loadEnv(
        hgContext.mode,
        hgConfig.envDir || process.cwd(),
        "VITE_WALLET_DEV_"
      );
      const hgLAN = selectHGWalletLAN(
        networkInterfaces(), // 这是 Node.js 提供的 API。它可以获取：当前电脑所有网络接口和 IP 地址。
        hgEnv.VITE_WALLET_DEV_ORIGIN,
        hgEnv.VITE_WALLET_DEV_INTERFACE
      );
      const hgCert = process.env.MLC_DEV_TLS_CERT;
      const hgKey = process.env.MLC_DEV_TLS_KEY;
      // 证书和私钥必须同时存在，不能只配置一个
      if (!!hgCert !== !!hgKey)
        throw new Error("MLC_DEV_TLS_CERT 与 MLC_DEV_TLS_KEY 必须同时配置");
      return {
        // 它相当于给前端代码注入一个编译时常量
        define: { __HG_WALLET_DEV_ORIGIN__: JSON.stringify(hgLAN) },
        server: hgCert
          ? { https: { cert: readFileSync(hgCert), key: readFileSync(hgKey) } }
          : {},
      };
    },
  };
}
