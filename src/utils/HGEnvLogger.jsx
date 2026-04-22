/** 使用案例
 * HGEnvLogger.info("列表加载完成", { count: 10 });
 * HGEnvLogger.warm("接口耗时偏高");
 * HGEnvLogger.error("提交失败", err);
*/

/**
 * 环境日志工具：
 * - debug: 🐛
 * - pre: 🐳
 * - product/release: 🍎
 * 日志等级：
 * - info
 * - warn/warm
 * - error
 */
export default class HGEnvLogger {
  static ENV_ICON_MAP = {
    debug: "🐛",
    pre: "🐳",
    product: "🍎",
  };

  static LEVEL_ICON_MAP = {
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
  };

  /**
   * 标准化运行环境名称。
   * @param {string} envValue 原始环境值（如 debug/pre/release/production）。
   * @returns {"debug"|"pre"|"product"} 标准环境。
   */
  static normalizeEnv(envValue) {
    const env = String(envValue ?? "").toLowerCase();
    if (env === "debug" || env === "dev" || env === "development") {
      return "debug";
    }
    if (env === "pre") {
      return "pre";
    }
    if (
      env === "release" ||
      env === "production" ||
      env === "prod" ||
      env === "product"
    ) {
      return "product";
    }
    return "product";
  }

  /**
   * 标准化日志等级，兼容 warm/warning。
   * @param {string} level 原始日志等级。
   * @returns {"info"|"warn"|"error"} 标准等级。
   */
  static normalizeLevel(level) {
    const lowerLevel = String(level ?? "info").toLowerCase();
    if (
      lowerLevel === "warn" ||
      lowerLevel === "warm" ||
      lowerLevel === "warning"
    ) {
      return "warn";
    }
    if (lowerLevel === "error") {
      return "error";
    }
    return "info";
  }

  /**
   * 组装日志前缀。
   * @param {"debug"|"pre"|"product"} env 标准环境。
   * @param {"info"|"warn"|"error"} level 标准等级。
   * @returns {string} 统一前缀，包含环境和等级图标。
   */
  static buildPrefix(env, level) {
    const envIcon =
      HGEnvLogger.ENV_ICON_MAP[env] ?? HGEnvLogger.ENV_ICON_MAP.product;
    const levelIcon =
      HGEnvLogger.LEVEL_ICON_MAP[level] ?? HGEnvLogger.LEVEL_ICON_MAP.info;
    return `${envIcon}${levelIcon}[${env.toUpperCase()}][${level.toUpperCase()}]`;
  }

  /**
   * 获取当前标准环境。
   * @returns {"debug"|"pre"|"product"} 当前环境。
   */
  static getCurrentEnv() {
    return HGEnvLogger.normalizeEnv(import.meta.env?.VITE_APP_ENV);
  }

  /**
   * 输出统一日志。
   * @param {"info"|"warn"|"warm"|"warning"|"error"} level 日志等级。
   * @param {...any} args 日志参数。
   * @returns {void}
   */
  static log(level, ...args) {
    const env = HGEnvLogger.getCurrentEnv();
    const normalizedLevel = HGEnvLogger.normalizeLevel(level);
    const prefix = HGEnvLogger.buildPrefix(env, normalizedLevel);

    if (normalizedLevel === "error") {
      console.error(prefix, ...args);
      return;
    }
    if (normalizedLevel === "warn") {
      console.warn(prefix, ...args);
      return;
    }
    console.info(prefix, ...args);
  }

  /**
   * 输出信息日志。
   * @param {...any} args 日志参数。
   */
  static info(...args) {
    HGEnvLogger.log("info", ...args);
  }

  /**
   * 输出警告日志。
   * @param {...any} args 日志参数。
   */
  static warn(...args) {
    HGEnvLogger.log("warn", ...args);
  }

  /**
   * 兼容 warm 拼写，行为同 warn。
   * @param {...any} args 日志参数。
   */
  static warm(...args) {
    HGEnvLogger.warn(...args);
  }

  /**
   * 输出错误日志。
   * @param {...any} args 日志参数。
   */
  static error(...args) {
    HGEnvLogger.log("error", ...args);
  }
}
