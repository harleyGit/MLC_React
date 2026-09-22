/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2026-09-02 12:23:18
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2026-09-02 15:16:59
 * @FilePath: /MLC_React/src/domain_module/mtr_tool/mtrServerHandler.cjs
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

/*
 * Node 原生 MTR API handler。
 *
 * 这个文件运行在 Node.js 服务端，不会被浏览器打包。它负责调用系统 mtr，拿到 JSON 结果，
 * 再渲染成与命令行 mtr report 类似的文本。
 *
 * 依赖：部署机器必须安装 mtr。本文件会先检测可用 mtr；如果没有，会尝试自动安装：
 * macOS:  brew install mtr
 * Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y mtr
 * Alpine: apk add --no-cache mtr traceroute（需要安装权限）；其他 Linux 仍按 apt 系处理。
 * 自动安装需要软件源网络与包管理器权限；实际探测还需系统允许原始套接字/mtr-packet，
 * 容器需按系统配置相应网络能力。Windows 没有自动安装分支，也不保证命令参数兼容。
 *
 * 如果 mtr 不在 PATH，可通过环境变量 MTR_BIN 指定，例如：
 * MTR_BIN=/opt/homebrew/sbin/mtr node src/manager_antd/page_modules/domain_module/mtr_tool/mtrApiServer.cjs
 */

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const dns = require("node:dns");

// 探测轮数在服务端统一兜底和限幅，限制单次请求的执行成本，而非限制并发数量。
const DEFAULT_COUNT = 36;
const MAX_COUNT = 100;
// 按显式配置、PATH、常见 macOS/Linux 路径顺序探测；环境变量在模块加载时读取。
const MTR_BIN_CANDIDATES = [
  process.env.MTR_BIN,
  "mtr",
  "/opt/homebrew/sbin/mtr",
  "/usr/local/sbin/mtr",
  "/usr/sbin/mtr",
  "/usr/bin/mtr",
].filter(Boolean);
// 进程内缓存已发现的命令，不缓存探测报告；不是安装锁，并发首次调用可能重复安装。
let resolvedMTRBin = null;

/** 清理空白、HTTP(S) 前缀和路径，空值转空串；不移除端口，不执行 DNS 或合法性校验。 */
const normalizeTarget = (target) => {
  return String(target || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
};

/**
 * 返回清理后的非空、最长 253 字符目标，否则同步抛错。
 * 仅做域名/IPv4 字符白名单，不验证标签、IPv4 数值或可达性；端口、IPv6 和 IDN 原文不支持。
 * 首字符必须为字母或数字以阻止命令选项注入；此校验不限制目标网段。
 */
const validateTarget = (target) => {
  const normalizedTarget = normalizeTarget(target);

  if (!normalizedTarget) {
    throw new Error("target 不能为空");
  }

  // execFile 不经过 shell，这里仍限制字符，避免把 URL、参数或奇怪字符传给系统 mtr。
  // 首字符不能为 '-'，即使不经过 shell 也必须防止目标被识别为命令选项。
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(normalizedTarget)) {
    throw new Error("target 只支持域名或 IPv4 地址");
  }

  if (normalizedTarget.length > 253) {
    throw new Error("target 太长");
  }

  return normalizedTarget;
};

/** 按十进制整数前缀解析轮数（如 "2x" 得到 2），无法解析用 36，其余夹在 1~100。 */
const normalizeCount = (count) => {
  const parsedCount = Number.parseInt(count, 10);
  if (!Number.isFinite(parsedCount)) {
    return DEFAULT_COUNT;
  }
  return Math.min(Math.max(parsedCount, 1), MAX_COUNT);
};

/**
 * 为版本检查和安装命令封装 execFile；file/args/options 来自内部配置，不经过 shell。
 * 成功返回 stdout/stderr，失败拒绝原错误并附两路输出；超时和缓冲限制由调用方指定。
 */
const execFilePromise = (file, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        error.stdout = stdout;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
};

// 执行 mtr 时保留 stdout/stderr 和退出信息。部分 mtr 版本会在已经输出完整 JSON 后
// 仍返回非零退出码，因此不能像普通命令一样只要 error 存在就直接丢弃 stdout。
// 参数沿用 execFile 契约；回调错误也 resolve，空输出转空串，由上层决定报告是否可用。
const execFileResult = (file, args, options) => {
  return new Promise((resolve) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout || "", stderr: stderr || "" });
    });
  });
};

/**
 * 将 stdout 解析成 JSON 值；允许外层混杂提示文本，尝试截取首个 { 到最后一个 }。
 * 空输出或两次解析都失败返回 null，不抛解析异常；这里只解析，不校验 report 结构。
 */
const parseMTRJSON = (stdout) => {
  const output = String(stdout || "").trim();
  if (!output) {
    return null;
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    // 兼容某些系统在 JSON 前后打印提示信息的情况，只截取最外层 JSON 对象。
    const jsonStart = output.indexOf("{");
    const jsonEnd = output.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      } catch (parseError) {
        return null;
      }
    }
    return null;
  }
};
/**
 * 汇总最终一次执行的诊断信息并返回 Error，由调用方决定抛出。
 * timeout 单位毫秒；消息仅截断 stdout 至 1000 字符，错误属性仍保留完整输出供上层使用。
 */
const createMTRExecutionError = ({ error, stdout, stderr, timeout }) => {
  // mtr --version 成功不代表 mtr-packet 能打开原始套接字；该类环境错误重试无效。
  // 保持 stderr 优先的既有 API 契约，让 Vite、独立服务和 Express 均返回操作指引。
  if (/Failure to open IPv[46] sockets|(?:operation not permitted|permission denied)|(?:must|need to) be (?:run as )?root/i.test(stderr || "")) {
    const guidance = process.platform === "darwin"
      ? "macOS/Homebrew 的 mtr 需要原始套接字权限。请由管理员在终端使用 sudo mtr 验证，并为独立诊断服务或 mtr-packet 配置必要权限；不要以 root 启动 Vite。"
      : "请由管理员检查 mtr-packet 的执行权限及 CAP_NET_RAW（容器也需要相应网络能力）。";
    const message = `MTR 系统权限不足，无法启动原生探测；这不是目标域名不可达。\n${guidance}\n原始错误：\n${stderr.trim()}`;
    const permissionError = new Error(message);
    permissionError.code = "MTR_PERMISSION_DENIED";
    permissionError.stderr = message;
    permissionError.stdout = stdout;
    return permissionError;
  }
  const details = [
    stderr?.trim(),
    error?.message,
    error?.code ? `code=${error.code}` : "",
    error?.signal ? `signal=${error.signal}` : "",
    error?.killed ? "killed=true" : "",
    `timeout=${timeout}ms`,
    stdout?.trim() ? `stdout=${stdout.trim().slice(0, 1000)}` : "",
  ].filter(Boolean);
  const executionError = new Error(details.join("\n") || "mtr 执行失败");
  executionError.code = error?.code;
  executionError.signal = error?.signal;
  executionError.killed = error?.killed;
  executionError.stdout = stdout;
  executionError.stderr = stderr;
  return executionError;
};

/**
 * 用最多 10 秒的 --version 试探命令，返回布尔值；只有 ENOENT 被判定为不存在。
 * 权限拒绝、超时或非零退出同样算存在，因此 true 不保证能执行探测，错误留到执行阶段暴露。
 */
const commandExists = async (file) => {
  try {
    await execFilePromise(file, ["--version"], {
      timeout: 10000,
      windowsHide: true,
    });
    return true;
  } catch (error) {
    // 保留对非零版本输出的宽松兼容；非 ENOENT 错误并不代表命令实际可执行。
    return error.code !== "ENOENT";
  }
};

/**
 * 返回缓存或首个可发现的 mtr 路径；全部候选缺失时调用系统安装器，再次检查候选。
 * 安装失败或安装后仍找不到命令时拒绝；会修改宿主机软件环境，不能用于无副作用检查。
 */
const installMTRIfNeeded = async () => {
  if (resolvedMTRBin) {
    return resolvedMTRBin;
  }

  for (const mtrBin of MTR_BIN_CANDIDATES) {
    if (await commandExists(mtrBin)) {
      resolvedMTRBin = mtrBin;
      return resolvedMTRBin;
    }
  }

  await autoInstallMTR();

  for (const mtrBin of MTR_BIN_CANDIDATES) {
    if (await commandExists(mtrBin)) {
      resolvedMTRBin = mtrBin;
      return resolvedMTRBin;
    }
  }

  throw new Error("mtr 自动安装后仍不可用，请检查系统 PATH 或 MTR_BIN 配置");
};

/**
 * 按宿主平台安装原生命令，成功返回 undefined，包管理器失败/不支持的平台则拒绝。
 * macOS 要求已装 Homebrew；Alpine 直接运行 apk；其他 Linux 要求 apt/root 或免密 sudo。
 * 每条命令最多 5 分钟（并非整个安装最多 5 分钟）；不会向用户交互申请提权。
 */
const autoInstallMTR = async () => {
  if (process.platform === "darwin") {
    await execFilePromise("brew", ["install", "mtr"], {
      timeout: 300000,
      windowsHide: true,
    });
    return;
  }

  if (process.platform === "linux") {
    // Alpine（如 nginx docker 镜像）使用 apk 安装。
    if (fs.existsSync("/etc/alpine-release")) {
      await execFilePromise("apk", ["add", "--no-cache", "mtr", "traceroute"], {
        timeout: 300000,
        windowsHide: true,
      });
      return;
    }

    // 服务器通常需要 root 权限；非 root 时使用 sudo，要求机器已配置免密 sudo。
    const isRoot =
      typeof process.getuid === "function" && process.getuid() === 0;
    const command = isRoot ? "apt-get" : "sudo";
    const updateArgs = isRoot ? ["update"] : ["apt-get", "update"];
    const installArgs = isRoot
      ? ["install", "-y", "mtr"]
      : ["apt-get", "install", "-y", "mtr"];
    const installFallbackArgs = isRoot
      ? ["install", "-y", "mtr-tiny"]
      : ["apt-get", "install", "-y", "mtr-tiny"];

    await execFilePromise(command, updateArgs, {
      timeout: 300000,
      windowsHide: true,
    });

    try {
      await execFilePromise(command, installArgs, {
        timeout: 300000,
        windowsHide: true,
      });
    } catch (error) {
      // 完整 mtr 包安装失败才尝试 mtr-tiny，最终能力仍取决于发行版提供的版本。
      await execFilePromise(command, installFallbackArgs, {
        timeout: 300000,
        windowsHide: true,
      });
    }
    return;
  }

  throw new Error(`当前系统 ${process.platform} 不支持自动安装 mtr`);
};

/**
 * 必须传入参数对象；校验 target、归一化 count 后确保命令存在并执行 JSON 报告模式。
 * 返回目标、实际轮数、命令位置、原始 JSON、文本及可选 warning；无可用报告则拒绝。
 * 只要求 JSON 中 report 为真值，不做完整 schema 校验；有报告的非零退出降为 warning。
 * 超时针对每次探测，不含安装耗时；最多两次执行，可能产生接近两倍的等待和探测流量。
 */
const runMTR = async ({ target, count }) => {
  const normalizedTarget = validateTarget(target);
  const reportCount = normalizeCount(count);
  // 固定系统 DNS 的 IPv4 结果，确保展示地址与命令实际目标一致，避免二次解析选择不同地址。
  const { address: targetIp } = await dns.promises.lookup(normalizedTarget, { family: 4 });
  const args = [
    "--report",
    "--json",
    "--no-dns",
    "--report-cycles",
    String(reportCount),
    targetIp,
  ];
  const mtrBin = await installMTRIfNeeded();
  // mtr 每轮通常约 1 秒，但链路丢包、无响应跳点和系统调度都会拉长运行时间。
  // 给 30/36 次探测留足余量，避免 Node 在 mtr 正常完成前发送 SIGTERM。
  const timeout = Math.min(300000, reportCount * 3000 + 30000);
  let lastResult = null;
  let json = null;

  // 最多重试一次，只有解析出 report 才提前结束；保留最后一次执行结果用于错误或 warning。
  for (let attempt = 0; attempt < 2; attempt++) {
    lastResult = await execFileResult(mtrBin, args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    json = parseMTRJSON(lastResult.stdout);

    // stdout 中存在有效 JSON 时，即使 mtr 返回非零退出码也使用该报告。
    if (json?.report) {
      break;
    }

    // 权限问题与目标无关，立即返回可操作提示，避免重复启动同一个失败进程。
    const executionError = createMTRExecutionError({ ...lastResult, timeout });
    if (executionError.code === "MTR_PERMISSION_DENIED") {
      throw executionError;
    }
  }

  if (!json?.report) {
    throw createMTRExecutionError({ ...lastResult, timeout });
  }

  // 单跳不等于公网路径已验证：本机/局域网也可能单跳，因此只提示可能存在隧道，不武断判错。
  const hubs = json.report.hubs;
  const warning = [
    lastResult.error ? lastResult.stderr?.trim() || lastResult.error.message : null,
    Array.isArray(hubs) && hubs.length === 1 && hubs[0].host === targetIp
      ? "仅收到一跳目标响应：可能是本地直连，也可能是 VPN/TUN/Fake-IP 代理代答，不能据此确认目标网站的公网链路。请检查服务端代理及系统 DNS。"
      : null,
  ].filter(Boolean).join("\n") || null;
  return {
    target: normalizedTarget,
    targetIp,
    count: reportCount,
    mtrBin,
    warning,
    raw: json,
    text: `目标：${normalizedTarget}\n系统 DNS / 实际探测 IPv4：${targetIp}\n${renderMTRReport(json)}`,
  };
};

/**
 * 将 Number 可转换的值格式化为定点字符串，非有限数显示 -.-；null/空串会按 0 展示。
 * digits 默认 1，内部调用需满足 toFixed 的位数范围，否则沿用其 RangeError。
 */
const formatNumber = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-.-";
  }
  return number.toFixed(digits);
};

/**
 * 将 mtr JSON 转为等宽文本；缺少报告元信息使用占位，hubs 缺失/非数组时显示等待回复。
 * 假定数组元素为 mtr 的跳点对象；只排版不修改数据，不推断丢包原因或补做网络查询。
 */
const renderMTRReport = (data) => {
  const report = data?.report || {};
  const mtrInfo = report.mtr || {};
  const hubs = Array.isArray(report.hubs) ? report.hubs : [];
  const lines = [
    `${mtrInfo.src || "local"} -> ${mtrInfo.dst || "unknown"}`,
    `Tests: ${mtrInfo.tests || "-.-"}, Packet size: ${mtrInfo.psize || "-.-"}`,
    "",
    " Host                                                                        Loss%   Snt   Last   Avg  Best  Wrst StDev",
  ];

  if (!hubs.length) {
    lines.push(" 1. (waiting for reply)");
    return lines.join("\n");
  }

  // 使用数组顺序编号、最小列宽对齐，超长主机名不截断；字段名与原生命令 JSON 保持一致。
  hubs.forEach((hub, index) => {
    const host = hub.host || "(waiting for reply)";
    const hostText = `${index + 1}. ${host}`.padEnd(76, " ");
    const loss = `${formatNumber(hub["Loss%"])}%`.padStart(6, " ");
    const sent = String(hub.Snt ?? "-.-").padStart(5, " ");
    const last = formatNumber(hub.Last).padStart(6, " ");
    const avg = formatNumber(hub.Avg).padStart(6, " ");
    const best = formatNumber(hub.Best).padStart(6, " ");
    const worst = formatNumber(hub.Wrst).padStart(6, " ");
    const stDev = formatNumber(hub.StDev).padStart(6, " ");

    lines.push(`${hostText}${loss}${sent}${last}${avg}${best}${worst}${stDev}`);
  });

  return lines.join("\n");
};

/**
 * Express 风格适配器：从 req.query 取 target/count，通过 res.status().json() 完成响应。
 * 成功返回 HTTP 200/ok=true；校验、安装、执行错误均保持 HTTP 500，优先展示 stderr。
 * 不适用于原生 ServerResponse；独立 API server 自行适配，也需自行提供鉴权/限流。
 */
const handleMTRRequest = async (req, res) => {
  try {
    const target = req.query?.target;
    const count = req.query?.count;
    const result = await runMTR({ target, count });

    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.stderr || error?.message || "MTR 查询失败",
    });
  }
};

module.exports = {
  handleMTRRequest,
  installMTRIfNeeded,
  normalizeTarget,
  renderMTRReport,
  runMTR,
  validateTarget,
};
