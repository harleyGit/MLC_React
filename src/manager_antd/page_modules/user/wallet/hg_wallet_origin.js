/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-09-30 21:28:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-08 16:32:10
 * @FilePath: /MLC_React/src/manager_antd/page_modules/user/wallet/hg_wallet_origin.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * 
 * 该文件代码作用： 判断当前地址是不是只能本机访问的地址；如果是，就把它替换成手机可以访问的局域网地址，同时防止使用危险或错误的 URL。 
 * 整个流程：                 
                  当前网页地址
                       │
                       ▼
             是不是 localhost？
                  │          │
                 否          是
                  │          │
                  ▼          ▼
              原样返回     有没有开发环境 LAN 地址？
                              │
                         ┌────┴────┐
                         │         │
                        没有       有
                         │         │
                         ▼         ▼
                       报错      替换 IP
                                   │
                                   ▼
                         192.168.1.100:5173
                                   │
                                   ▼
                              安全校验
                                   │
                                   ▼
                              最终地址

这套代码为了实现：电脑本地开发时，如果网页地址是 localhost，手机扫码不能直接访问，所以自动把 localhost 转换成电脑的局域网 IP；同时严格限制只能使用合法的 HTTP(S) Origin，避免把 localhost、账号密码、路径、查询参数等错误内容生成到手机订单二维码里。                              
 */
/* global __HG_WALLET_DEV_ORIGIN__ */

/** 判断是不是本机地址，从URL中取出主机名 */
export function isHGLocalOnlyOrigin(origin) {
  try {
    const hgHost = new URL(origin).hostname;
    return (
      hgHost === "localhost" ||
      hgHost.endsWith(".localhost") ||
      hgHost === "[::1]" ||
      hgHost === "[::]" ||
      hgHost === "0.0.0.0" ||
      /^127\./.test(hgHost)
    );
  } catch {
    return false;
  }
}

/** 确保 VITE_WALLET_DEV_ORIGIN 是一个合法、安全的 HTTP/HTTPS 地址
 * 显式覆盖只接受无凭据、路径、查询或片段的 HTTP(S) origin。
 */
export function validateHGWalletOrigin(hgValue) {
  let hgURL;
  try {
    hgURL = new URL(hgValue);
  } catch {
    throw new Error("VITE_WALLET_DEV_ORIGIN 必须是合法 HTTP(S) origin");
  }
  if (
    // .test 表示只允许 http 和 https
    !/^https?:$/.test(hgURL.protocol) ||
    hgURL.username ||
    hgURL.password ||
    hgValue !== hgValue.trim() ||
    ![hgURL.origin, `${hgURL.origin}/`].includes(hgValue) ||
    isHGLocalOnlyOrigin(hgValue)
  ) {
    throw new Error(
      "VITE_WALLET_DEV_ORIGIN 不允许本机地址、凭据、路径、查询或片段"
    );
  }
  return hgURL.origin;
}

/** 决定最终给手机使用什么地址
 * Vite 仅在 serve 注入 LAN 信息；生产保持当前 origin，不读取开发覆盖。
 */
export function getHGWalletLinkOrigin(
  hgOrigin,
  hgDev = typeof __HG_WALLET_DEV_ORIGIN__ === "undefined"
    ? null
    : __HG_WALLET_DEV_ORIGIN__
) {
  if (!hgDev || !isHGLocalOnlyOrigin(hgOrigin)) return hgOrigin;
  if (hgDev.error) throw new Error(hgDev.error);
  if (hgDev.origin) return validateHGWalletOrigin(hgDev.origin);
  const hgURL = new URL(hgOrigin);
  hgURL.hostname = hgDev.address;
  return validateHGWalletOrigin(hgURL.origin);
}
