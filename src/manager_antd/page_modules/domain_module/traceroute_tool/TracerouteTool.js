/** 浏览器端只发 HTTP 请求；逐跳探测依赖 Node 服务及宿主机命令，不能测量浏览器自身的路由。 */
export class TracerouteTool {
  /**
   * 清理目标的空白、HTTP(S) 前缀、路径和末尾数字端口；空值返回空串。
   * 不是完整 URL/IP 解析器，不支持 IPv6；字符和长度检查留给服务端。
   */
  static normalizeTarget = (target) => {
    return String(target || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  };

  /**
   * 请求逐跳结果，成功返回包含 hops、text、targetIp、warning 的完整业务响应。
   * target 清理后必须非空；maxHops/timeout 仅在真值时传递，timeout 单位为毫秒。
   * 服务端默认 30 跳/45000ms，跳数限制 1~64、时间至少 5000ms；前端不另设超时。
   * HTTP/业务错误、空目标和网络故障使 Promise 拒绝；无法解析 JSON 时使用 HTTP 状态报错。
   * warning 可伴随成功结果（包括无跳点的超时），不能只凭 ok 判断已到达目标。
   */
  static requestTraceroute = async ({ target, maxHops, timeout } = {}) => {
    const normalizedTarget = TracerouteTool.normalizeTarget(target);
    if (!normalizedTarget) {
      throw new Error("请输入正确域名或 IP，比如：google.com");
    }

    // 优先专用 API 地址，其次复用 MTR 地址，否则保持同源；Vite 在启动/构建时注入配置。
    // 配置需为绝对 URL，路径前缀会被 /api/traceroute 替换，且不能包含秘密。
    // 分离部署需代理或允许跨域，HTTPS 页面需匹配安全协议；本方法仅用于浏览器环境。
    const apiBase =
      import.meta.env.VITE_TRACEROUTE_API_BASE ||
      import.meta.env.VITE_MTR_API_BASE ||
      window.location.origin;
    const url = new URL("/api/traceroute", apiBase);
    url.searchParams.set("target", normalizedTarget);
    // 加时间戳参数，避免运营商/CDN 把 /api/traceroute 的历史响应缓存后永远返回旧数据
    url.searchParams.set("_t", String(Date.now()));
    if (maxHops) {
      url.searchParams.set("maxHops", String(maxHops));
    }
    if (timeout) {
      url.searchParams.set("timeout", String(timeout));
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `Traceroute HTTP ${response.status}`);
    }

    return data;
  };
}
