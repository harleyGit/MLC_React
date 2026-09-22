/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2026-09-02 15:16:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-09-22 18:41:35
 * @FilePath: /MLC_React/src/domain_module/mtr_tool/mtrApiServer.cjs
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

/*
 * 独立 MTR API server，用于生产环境部署。
 *
 * 在仓库根目录构建并启动（依赖由部署流程预先准备）：
 * npm run build:pre
 * MTR_BIN=/opt/homebrew/sbin/mtr MTR_API_PORT=3001 node src/manager_antd/page_modules/domain_module/mtr_tool/mtrApiServer.cjs
 *
 * 默认同时提供：
 * 1. GET /api/mtr 原生 mtr 查询接口。
 * 2. GET /api/traceroute 逐跳查询和 GET /api/health 进程存活检查。
 * 3. 仓库 dist/ 静态页面托管（Vite 构建产物）。
 *
 * 如果前端由 Nginx 单独托管，也可以只把 /api/mtr 代理到这个服务。确保该服务运行在未开启
 * VPN/代理的机器上，这样结果才会与这台机器直接执行 `mtr domain` 一致。
 * 访问内网目标则需按目标网络配置服务端路由/VPN，而非只调整浏览器代理。
 * 这是有启动副作用的入口：加载即监听端口，并检查/尝试安装 mtr，不应导入前端或测试。
 * 服务不含鉴权、限流和目标网段限制，且允许任意来源跨域；对外部署需在网关保护探测能力。
 */

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { installMTRIfNeeded, runMTR } = require("./mtrServerHandler.cjs");
const {
  runTraceroute,
} = require("../traceroute_tool/tracerouteServerHandler.cjs");

// 端口来自 Node 运行时环境；未单独验证范围，非法配置交由 Node 监听阶段处理。
// 未指定监听 host，实际可能对外网卡开放，不代表下方 localhost 日志所示的仅本机访问。
const port = Number.parseInt(process.env.MTR_API_PORT || "3001", 10);
// 从迁移后的 mtr_tool 向上五级定位仓库，不依赖启动命令的当前工作目录。
const projectRoot = path.resolve(__dirname, "../../../../..");
const buildRoot = path.join(projectRoot, "dist");

// 仅映射现有静态资源类型；未列出的扩展名按二进制返回，不参与内容嗅探。
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

/** 写入状态码和跨域头并结束响应；data 必须可 JSON 序列化，不返回业务值。 */
const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  });
  res.end(JSON.stringify(data));
};

/**
 * 异步读取内部解析出的文件路径；所有读取错误统一返回 JSON 404。
 * HEAD 仍读取文件但不发送文件内容；本方法不校验路径，调用方负责限定静态根目录。
 */
const sendFile = (req, res, filePath) => {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJSON(res, 404, { ok: false, error: "Not Found" });
      return;
    }

    const extname = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname] || "application/octet-stream",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(content);
  });
};

/**
 * 为 GET/HEAD 解析静态资源，无扩展名先补 index.html，不存在时回退 SPA 首页。
 * dist 缺失直接返回 404；沿用路径规范化和字符串前缀检查，不处理符号链接的真实路径。
 * URI 解码或同步文件状态查询异常未在此捕获；本方法只结束/委托响应，不返回文件内容。
 */
const handleStaticFile = (req, res, requestURL) => {
  if (!fs.existsSync(buildRoot)) {
    sendJSON(res, 404, {
      ok: false,
      error: "dist 目录不存在，请先执行 npm run build:pre",
    });
    return;
  }

  const decodedPath = decodeURIComponent(requestURL.pathname);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(buildRoot, safePath);

  // 对规范化后的路径做 dist 前缀检查；这不是针对符号链接的隔离机制。
  if (!filePath.startsWith(buildRoot)) {
    sendJSON(res, 403, { ok: false, error: "Forbidden" });
    return;
  }

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(buildRoot, "index.html");
  }

  sendFile(req, res, filePath);
};

// 路由顺序：预检 -> 健康检查 -> 两类探测 -> 静态页面 -> 405。
// API 参数以查询字符串交给 handler 归一化，校验/执行异常均沿用 500；不改变现有错误契约。
// 健康检查只证明进程可响应，不保证原生命令就绪；未知 GET 路径会进入 SPA 回退。
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJSON(res, 204, {});
    return;
  }

  const requestURL = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && requestURL.pathname === "/api/health") {
    sendJSON(res, 200, { ok: true, service: "mtr-api", pid: process.pid });
    return;
  }

  if (req.method === "GET" && requestURL.pathname === "/api/mtr") {
    try {
      const result = await runMTR({
        target: requestURL.searchParams.get("target"),
        count: requestURL.searchParams.get("count"),
      });
      sendJSON(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJSON(res, 500, {
        ok: false,
        error: error?.stderr || error?.message || "MTR 查询失败",
      });
    }
    return;
  }

  if (req.method === "GET" && requestURL.pathname === "/api/traceroute") {
    try {
      const result = await runTraceroute({
        target: requestURL.searchParams.get("target"),
        maxHops: requestURL.searchParams.get("maxHops"),
        timeout: requestURL.searchParams.get("timeout"),
      });
      sendJSON(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJSON(res, 500, {
        ok: false,
        error: error?.message || "Traceroute 查询失败",
      });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    handleStaticFile(req, res, requestURL);
    return;
  }

  sendJSON(res, 405, { ok: false, error: "Method Not Allowed" });
});

// 先接受连接再异步准备 mtr，准备失败仅记日志；请求仍可再次触发安装检查。
// 此流程可能执行 brew/apt/apk，部署应预装命令、配置权限，验证代码时不要运行本入口。
server.listen(port, () => {
  console.log(`MTR API server is listening on http://localhost:${port}`);
  console.log(`Static build root: ${buildRoot}`);

  installMTRIfNeeded()
    .then((mtrBin) => {
      // 就绪日志只报告命令位置，不验证实际探测所需的网络及原始套接字权限。
      console.log(`MTR binary is ready: ${mtrBin}`);
    })
    .catch((error) => {
      // 保留静态资源与其他 API 的服务能力，不因安装失败关闭整个 HTTP 服务。
      console.error(`MTR binary check failed: ${error?.message || error}`);
    });
});

// 监听失败属于进程级错误；端口冲突给出可操作提示，统一以非零状态退出供部署系统识别。
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `MTR API port ${port} is already in use. Stop the old process or set MTR_API_PORT to another port.`
    );
  } else {
    console.error("MTR API server error:", error);
  }
  process.exit(1);
});

/**
 * 收到退出信号后停止接收新连接，连接关闭则退出 0，最多等待 5 秒后退出 1。
 * 不主动取消 handler 内部探测子进程；unref 保证兜底定时器不单独延长进程存活。
 */
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
