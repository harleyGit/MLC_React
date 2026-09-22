/**
 * 仅在 Node 服务端加载，依赖 nodejs-traceroute 及宿主机 traceroute（Windows 为 tracert）。
 * 本模块不自动安装命令；部署需预装系统工具，验证命令选项兼容性及 ICMP/UDP 探测权限。
 * 跳点反映服务端路由，VPN、防火墙和容器网络均会影响结果，不代表浏览器本机网络。
 */
const dns = require("node:dns");
const Traceroute = require("nodejs-traceroute");

// 总执行计时单位毫秒，单跳等待单位秒；连续无响应阈值用于提前结束，不代表目标必定不可达。
const DEFAULT_TIMEOUT = 45000;
const DEFAULT_MAX_HOPS = 30;
const DEFAULT_WAIT_TIME = 1;
const MAX_CONSECUTIVE_TIMEOUTS = 6;

/** 清理空白、HTTP(S) 前缀、路径和数字端口，空值返回空串；不是完整 URL 或 IPv6 解析器。 */
const normalizeTarget = (target) => {
  return String(target || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
};

/**
 * 返回清理后目标；空值、非白名单字符或超过 253 字符时同步抛错。
 * 仅允许域名/IPv4 字符，不校验 DNS 标签、IPv4 数值、前导连字符或目标网络范围；不支持 IPv6。
 */
const validateTarget = (target) => {
  const normalizedTarget = normalizeTarget(target);

  if (!normalizedTarget) {
    throw new Error("target 不能为空");
  }

  // 拒绝以 '-' 开头的目标，避免命令选项注入。
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(normalizedTarget)) {
    throw new Error("target 只支持域名或 IPv4 地址");
  }

  if (normalizedTarget.length > 253) {
    throw new Error("target 太长");
  }

  return normalizedTarget;
};

/** 将缺失值（undefined/null/空串）转为无响应标记 *，其余直接转字符串，保留数字 0。 */
const formatValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "*";
  }
  return String(value);
};

/**
 * 接收目标和跳点对象数组，返回等宽文本；空数组显示一行 *，warning 非空时附在末尾。
 * 跳号缺失使用数组序号，RTT 最多展示三个字段且不补单位；只展示，不判断是否真正到达。
 */
const renderTraceroute = ({ target, targetIp, hops = [], warning = null }) => {
  const lines = [`traceroute to ${target}`, `系统 DNS / 实际探测 IPv4：${targetIp || "未知"}`, "", "Hop  IP / Host                                  RTT"];

  if (!hops.length) {
    lines.push("  1  *                                          *");
  } else {
    // 过滤缺失 RTT 而保留命令返回的 *；主机列只设最小宽度，长名称不截断。
    hops.forEach((hop, index) => {
      const hopNumber = formatValue(hop.hop ?? index + 1).padStart(3, " ");
      const host = formatValue(hop.ip || hop.host).padEnd(42, " ");
      const rtts = [hop.rtt1, hop.rtt2, hop.rtt3]
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map(formatValue)
        .join("  ");
      lines.push(`${hopNumber}  ${host}${rtts || "*"}`);
    });
  }

  if (warning) {
    lines.push("", warning);
  }

  return lines.join("\n");
};

/**
 * 使用系统解析器固定一个 IPv4 地址，供命令执行和目的地匹配共用；解析失败直接拒绝。
 * 不绕过系统 DNS/VPN，不使用公共 DNS 替换目标；此耗时不计入探测定时器。
 */
const resolveTargetIp = async (target) => {
  const res = await dns.promises.lookup(target, { family: 4 });
  return res.address;
};

/**
 * 为已归一化的跳数/等待秒数生成参数数组，不执行命令或再次校验数值。
 * Windows 使用 tracert 参数且等待换算为毫秒；Unix 每跳一次探测、禁反查，等待单位为秒。
 * 仅 macOS 或 Linux root 在 useIcmp=true 时加 -I；Linux 非 root 即使要求 ICMP 也不加。
 * 不检测 capabilities 或命令版本，部署环境必须支持这些选项；Windows 忽略 useIcmp。
 */
const getTracerouteArgs = ({
  maxHops = DEFAULT_MAX_HOPS,
  waitTimeSec = DEFAULT_WAIT_TIME,
  useIcmp = true,
}) => {
  if (process.platform === "win32") {
    return ["-d", "-h", String(maxHops), "-w", String(waitTimeSec * 1000)];
  }

  const args = ["-q", "1", "-z", "0", "-n"];
  const isDarwin = process.platform === "darwin";
  const isLinuxRoot =
    process.platform === "linux" &&
    typeof process.getuid === "function" &&
    process.getuid() === 0;

  if (useIcmp && (isDarwin || isLinuxRoot)) {
    args.push("-I");
  }

  args.push("-m", String(maxHops), "-w", String(waitTimeSec));
  return args;
};

/**
 * 执行一次事件驱动探测：target 必须合法，targetIp 仅作目的地辅助比较。
 * timeout 按整数前缀解析，0/无效值用 45000，最小 5000ms、无上限；maxHops 同理默认 30，限 1~64。
 * maxConsecutiveTimeouts 默认 6，不做校验/限幅，内部调用者需提供正整数。
 * 校验可能同步抛错；随后返回 Promise，错误且无跳点时拒绝，有部分结果则成功并携带 warning。
 * 纯超时即使无跳点也成功返回 warning；不保证成功结果已到达目标，不流式返回跳点。
 */
const runTracerouteInternal = ({
  target,
  targetIp,
  timeout = DEFAULT_TIMEOUT,
  maxHops = DEFAULT_MAX_HOPS,
  maxConsecutiveTimeouts = MAX_CONSECUTIVE_TIMEOUTS,
  useIcmp = true,
}) => {
  const normalizedTarget = validateTarget(target);
  const parsedTimeout = Math.max(
    Number.parseInt(timeout, 10) || DEFAULT_TIMEOUT,
    5000
  );
  const parsedMaxHops = Math.min(
    Math.max(Number.parseInt(maxHops, 10) || DEFAULT_MAX_HOPS, 1),
    64
  );

  return new Promise((resolve, reject) => {
    const tracer = new Traceroute();
    tracer.args = getTracerouteArgs({
      maxHops: parsedMaxHops,
      waitTimeSec: DEFAULT_WAIT_TIME,
      useIcmp,
    });

    // hops 按事件顺序累积；settled 避免超时/close/到达目标重复结算，PID 用于终止宿主子进程。
    // 连续超时计数遇有效响应清零，与总跳数不同；每次执行拥有独立状态。
    const hops = [];
    let settled = false;
    let tracerPid = null;
    let consecutiveTimeouts = 0;

    /** 尝试向已知 PID 发送 SIGTERM；已退出进程忽略，其他错误只记录，不等待退出或强杀。 */
    const stopProcess = () => {
      if (tracerPid) {
        try {
          process.kill(tracerPid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") {
            console.error("停止 traceroute 进程失败:", error);
          }
        }
      }
    };

    /**
     * 单次结算出口：清理计时器、尝试停止进程并移除监听，再拒绝或返回当前跳点快照数据。
     * 显式 warning 优先于错误消息；只在 error 存在且 hops 为空时拒绝，保留部分结果的展示能力。
     */
    const finish = ({ error = null, warning = null } = {}) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutTimer);
      stopProcess();
      tracer.removeAllListeners();

      if (error && !hops.length) {
        reject(error);
        return;
      }

      // 命令退出成功仅表示执行结束；未到目标和单跳代答风险都必须在报告中明确提示。
      const reached = hops.some((hop) => hop.ip === targetIp);
      const finalWarning = [
        warning || (error ? error.message : null),
        !reached ? "未确认到达目标，以上仅为部分链路，不代表目标不可访问。" : null,
        reached && hops.length === 1
          ? "仅收到一跳目标响应：可能是本地直连，也可能是 VPN/TUN/Fake-IP 代理代答，不能据此确认目标网站的公网链路。请检查服务端代理及系统 DNS。"
          : null,
      ].filter(Boolean).join("\n") || null;

      resolve({
        target: normalizedTarget,
        targetIp: targetIp || null,
        hops,
        warning: finalWarning,
        text: renderTraceroute({
          target: normalizedTarget,
          targetIp,
          hops,
          warning: finalWarning,
        }),
      });
    };

    // 执行超时走 warning 而非 error，因此不会触发外层 UDP 重试；DNS 查询发生在此计时之前。
    const timeoutTimer = setTimeout(() => {
      const warningMessage = hops.length
        ? `Traceroute 执行超时（${parsedTimeout}ms），已显示当前已探测到的跳点。`
        : `Traceroute 执行超时（${parsedTimeout}ms），未获取到跳点响应。请检查目标地址或 VPN 连接。`;

      finish({ warning: warningMessage });
    }, parsedTimeout);

    // 库异步通知子进程 PID 后才具备停止能力；尚未收到 PID 时 stopProcess 不做操作。
    tracer.on("pid", (pid) => {
      tracerPid = pid;
    });

    // 先保存跳点，再按 IP/首个 RTT 统计无响应；目的地命中优先于连续超时终止判断。
    tracer.on("hop", (hop) => {
      hops.push(hop);

      const isTimeout =
        hop.ip === "*" ||
        hop.ip === undefined ||
        hop.ip === null ||
        hop.rtt1 === "*";

      if (isTimeout) {
        consecutiveTimeouts += 1;
      } else {
        consecutiveTimeouts = 0;
      }

      const isDestinationReached =
        hop.ip &&
        hop.ip !== "*" &&
        (hop.ip === normalizedTarget || (targetIp && hop.ip === targetIp));

      if (isDestinationReached) {
        finish();
        return;
      }

      if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
        const allTimeouts = hops.length === consecutiveTimeouts;
        const warning = allTimeouts
          ? `目标主机未响应（已连续 ${consecutiveTimeouts} 跳超时），可能由于目标不可达、防火墙拦截或未连接 VPN。`
          : `后续跳点无响应（已连续 ${consecutiveTimeouts} 跳超时），探测已提前结束。`;
        finish({ warning });
      }
    });

    // 非零退出保留已有跳点，但必须携带错误警告，不能冒充完整链路。
    tracer.on("close", (code) => {
      if (code !== 0) {
        finish({ error: new Error(`Traceroute 执行失败，退出码：${code}`) });
        return;
      }
      finish();
    });

    // 异步错误与 trace 同步抛错都统一收口，避免丢弃已经收到的跳点。
    tracer.on("error", (error) => finish({ error }));

    try {
      // 与报告和到达判定使用同一 IPv4，避免库再次解析域名导致地址不一致。
      tracer.trace(targetIp);
    } catch (error) {
      finish({ error });
    }
  });
};

/**
 * 对外探测入口：校验后先解析地址，再尝试平台允许的 ICMP 参数，返回跳点/文本/警告对象。
 * 参数边界由内部执行器统一处理；DNS、目标校验和最终执行失败使 Promise 拒绝。
 * 非 Windows 首次拒绝时再用非 ICMP 参数执行一次（通常为 UDP），每次有独立超时预算；
 * 部分结果或超时 warning 不重试，Linux 非 root 两次可能使用相同参数。
 */
const runTraceroute = async ({
  target,
  timeout = DEFAULT_TIMEOUT,
  maxHops = DEFAULT_MAX_HOPS,
  maxConsecutiveTimeouts = MAX_CONSECUTIVE_TIMEOUTS,
} = {}) => {
  const normalizedTarget = validateTarget(target);
  const targetIp = await resolveTargetIp(normalizedTarget);

  try {
    return await runTracerouteInternal({
      target: normalizedTarget,
      targetIp,
      timeout,
      maxHops,
      maxConsecutiveTimeouts,
      useIcmp: true,
    });
  } catch (error) {
    // 非 Windows 的首次执行拒绝后尝试非 ICMP 参数；不限定错误原因一定是 ICMP 权限。
    if (process.platform !== "win32") {
      return await runTracerouteInternal({
        target: normalizedTarget,
        targetIp,
        timeout,
        maxHops,
        maxConsecutiveTimeouts,
        useIcmp: false,
      });
    }
    throw error;
  }
};

/**
 * Express 风格 HTTP 适配：读取 req.query 的目标/跳数/毫秒超时，用 status().json() 结束响应。
 * 返回成功 HTTP 200（可能带 warning），校验或探测拒绝统一 HTTP 500，不把业务值另作返回。
 * 原生 HTTP 服务需自行适配；目标访问控制、并发限流和请求断开后的取消不在此实现。
 */
const handleTracerouteRequest = async (req, res) => {
  try {
    const result = await runTraceroute({
      target: req.query?.target,
      maxHops: req.query?.maxHops,
      timeout: req.query?.timeout,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || "Traceroute 查询失败",
    });
  }
};

module.exports = {
  handleTracerouteRequest,
  normalizeTarget,
  renderTraceroute,
  runTraceroute,
  validateTarget,
};
