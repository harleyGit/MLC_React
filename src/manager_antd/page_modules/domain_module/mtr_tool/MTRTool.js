/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2026-09-02 11:23:18
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-09-22 18:41:26
 * @FilePath: /MLC_React/src/domain_module/mtr_tool/MTRTool.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/*
 * MTRTool 是前端页面使用的 MTR 调用工具。
 *
 * 真正的 mtr 需要系统原生 mtr 程序发 ICMP/TCP 探测包，并通过 TTL 获取每一跳路由。
 * 浏览器 JavaScript 不能调用 child_process，不能发 ICMP，也不能设置 TTL，所以不能在前端
 * 直接实现与命令行 `mtr fusion-gateway-cn.imilab.com` 一样的逐跳结果。
 *
 * 正确实现边界：
 * 1. 前端只负责输入目标域名、调用后端 `/api/mtr`、展示结果。
 * 2. 后端运行在“关闭 VPN/代理”的网络环境中，调用系统原生 mtr --report --json。
 * 3. 后端返回格式化后的 report 文本，前端展示，因此结果与后端机器直接执行 mtr 一致。
 */

export class MTRTool {
  /**
   * 将页面输入转为目标字符串：空值返回空串，去首尾空白、HTTP(S) 前缀及路径。
   * 这里只做输入清理，不验证 DNS/IPv4 合法性，也不移除端口；最终边界由服务端校验。
   */
  static normalizeTarget = (target) => {
    return String(target || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
  };

  /**
   * 请求服务端原生探测，返回包含 ok、target、count、raw、text 和 warning 的响应对象。
   * target 清理后不能为空；count 默认 36，前端原样传递，服务端解析并限制为 1~100。
   * 空目标、网络异常、HTTP/业务失败均使 Promise 拒绝；非 JSON 响应退化为 HTTP 状态错误。
   * 不设置浏览器请求超时或取消机制，探测时长由服务端控制；结果反映服务端而非浏览器网络。
   */
  static requestNativeMTR = async ({ target, count = 36 } = {}) => {
    const normalizedTarget = MTRTool.normalizeTarget(target);
    if (!normalizedTarget) {
      throw new Error("请输入正确域名，比如：fusion-gateway-cn.imilab.com");
    }

    // 默认同源调用 /api/mtr；Vite 开发服务需代理此路径，或使用以下绝对地址跨域调用。
    // VITE_MTR_API_BASE=http://localhost:3001 在启动/构建时注入，不能存放秘密；
    // 修改部署环境变量不会改写已构建的页面。独立 API 需允许跨域，HTTPS 页面应使用 HTTPS API。
    // URL 的绝对路径会忽略 apiBase 自带的路径前缀；本方法依赖浏览器 window/fetch。
    const apiBase =
      import.meta.env.VITE_MTR_API_BASE || window.location.origin;
    const url = new URL("/api/mtr", apiBase);
    url.searchParams.set("target", normalizedTarget);
    url.searchParams.set("count", count);
    // 加时间戳参数，避免运营商/CDN 把 /api/mtr 的历史响应缓存后永远返回旧数据
    url.searchParams.set("_t", String(Date.now()));

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    // console.log(" MTRTool.requestNativeMTR", url.toString(), response);
    const data = await response.json().catch(() => null);
    // console.log(
    //   "🍎 MTRTool.requestNativeMTR url：",
    //   url.toString(),
    //   "json Data: ",
    //   data
    // );

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `MTR HTTP ${response.status}`);
    }

    return data;
  };
}
