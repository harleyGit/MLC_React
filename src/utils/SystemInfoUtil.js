/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 20:31:43
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2025-05-12 15:49:12
 * @FilePath: /app-web/imi-diagnosis/src/utils/SystemInfoUtil.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

let cachedInfo = null;
export async function getSystemInfo() {
  // 如果已经缓存了，就直接返回
  if (cachedInfo) return cachedInfo;

  const ua = navigator.userAgent;
  const osMatch = ua.match(/\(([^)]+)\)/);
  const osInfo = osMatch ? osMatch[1] : "未知";

  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/);
  const browser = browserMatch
    ? `${browserMatch[1]}: ${browserMatch[2]}`
    : "未知";

  let flashVersion = "未安装";
  if (navigator.plugins && navigator.plugins.length) {
    const flash = [...navigator.plugins].find((p) => p.name.includes("Flash"));
    if (flash) flashVersion = flash.description;
  }

  const localStorageEnabled = (() => {
    try {
      const testKey = "__test";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const connection =
    navigator.connection ||
    navigator.webkitConnection ||
    navigator.mozConnection ||
    {};

  cachedInfo = {
    os: osInfo,
    browser,
    userAgent: ua,
    flash: flashVersion,
    cookieEnabled: navigator.cookieEnabled ? "开启" : "关闭",
    jsEnabled: "开启",
    localStorage: localStorageEnabled ? "开启" : "关闭",
    online: navigator.onLine ? "是" : "否",
    networkType: connection.type || "unknown",
    downlink: connection.downlink ? `${connection.downlink} Mbps` : "未知",
    rtt: connection.rtt ? `${connection.rtt} ms` : "未知",
  };

  return cachedInfo;
}

/**
 * 判断是否为移动端设备
 * @returns {boolean} - 如果是移动端设备返回 true，PC 端返回 false
 */
// isMobile.js
export function isMobile({ includeScreenWidth = true } = {}) {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileDevice =
    /iphone|ipod|android|blackberry|windows phone|mobile/i.test(userAgent);

  if (includeScreenWidth) {
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileDevice || isSmallScreen;
  }

  return isMobileDevice;
}
