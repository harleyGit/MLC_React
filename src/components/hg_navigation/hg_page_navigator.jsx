import { getHGPageConfig, getHGPageTarget } from "./hg_page_registry";

const HG_PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;

/** 只接收可枚举业务字段，拒绝类实例和数组充当参数字典。 */
function hgIsPlainObject(hgValue) {
  if (hgValue === null || typeof hgValue !== "object") return false;
  const hgPrototype = Object.getPrototypeOf(hgValue);
  return hgPrototype === Object.prototype || hgPrototype === null;
}

/** 将业务查询参数编码为 URLSearchParams，并拒绝无法稳定序列化的值。 */
function hgToSearchParams(hgParams) {
  if (hgParams === undefined || hgParams === null) return new URLSearchParams();
  if (hgParams instanceof URLSearchParams) return new URLSearchParams(hgParams);
  if (!hgIsPlainObject(hgParams)) throw new TypeError("params 必须是普通对象或 URLSearchParams");

  const hgSearchParams = new URLSearchParams();
  Object.entries(hgParams).forEach(([hgKey, hgValue]) => {
    if (typeof hgKey !== "string" || !hgKey) throw new TypeError("params 的键必须是非空字符串");
    if (hgValue === null || hgValue === undefined) return;
    const hgValues = Array.isArray(hgValue) ? hgValue : [hgValue];
    hgValues.forEach((hgItem) => {
      if (hgItem === null || hgItem === undefined) return;
      if (!["string", "number", "boolean", "bigint"].includes(typeof hgItem) ||
          (typeof hgItem === "number" && !Number.isFinite(hgItem)))
        throw new TypeError(`params.${hgKey} 必须是字符串、数字、布尔值或 bigint`);
      hgSearchParams.append(hgKey, String(hgItem));
    });
  });
  return hgSearchParams;
}

/** hash 保留锚点语义，拒绝会被 URL 静默丢弃的控制字符。 */
function hgNormalizeHash(hgHash) {
  if (hgHash === undefined || hgHash === null || hgHash === "") return "";
  if (typeof hgHash !== "string") throw new TypeError("hash 必须是字符串");
  if ([...hgHash].some((hgChar) => {
    const hgCode = hgChar.charCodeAt(0);
    return hgCode <= 32 || hgCode === 127;
  })) throw new TypeError("hash 不能包含空白或控制字符");
  return hgHash.startsWith("#") ? hgHash : `#${hgHash}`;
}

/** 来源仅保存站内地址，不保存回调或页面实例。 */
function hgLocationHref(hgLocation) {
  return `${hgLocation.pathname}${hgLocation.search || ""}${hgLocation.hash || ""}`;
}

/**
 * 纯内存会话，刷新或重新 attach 后失效，普通 Link 离页取消；显式 open 的子会话暂停父会话。
 * 普通路由会卸载来源页：钱包回调只做全局消息，不修改已卸载实例，钱包 mount 自行刷新。
 * success/cancel 返回 false 或 Promise<boolean>，业务应 await 后判断是否返回成功，再执行 fallback。
 * 无会话、重复完成或同步导航抛错返回 false；导航拒绝 resolve false。失败也已消费会话，不可重试旧句柄。
 * error 仅回调并清理，不返回页面；导航成功才通知 success/cancel，失败只通知 onError。
 * 回调应为同步通知；异常被隔离，不能阻止会话清理或路由返回。
 */
export class HGPageNavigator {
  sessions = new Map();
  router = null;
  unsubscribe = null;
  nextSessionId = 0;
  // 只记录 attach 后亲眼观察到的 history，绝不推测刷新前或外站的历史位置。
  entries = [];
  index = 0;

  /** 更换路由实例时先断开旧订阅并丢弃旧页面的回调，避免跨路由实例误消费。 */
  attach = (hgRouter) => {
    if (!hgRouter?.state?.location || typeof hgRouter.navigate !== "function" || typeof hgRouter.subscribe !== "function")
      throw new TypeError("router 必须是 React Router data router 实例");
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.sessions.clear();
    this.router = hgRouter;
    this.entries = [hgRouter.state.location.key];
    this.index = 0;
    this.unsubscribe = hgRouter.subscribe((hgState) => {
      // loading/submitting 阶段的 location 仍可能是旧值，必须等 idle 再清理会话。
      if (hgState?.navigation?.state !== "idle") return;
      const hgKey = hgState.location.key;
      if (this.entries[this.index] === hgKey) {
        this.cleanupAwaySessions(hgState.location);
        return;
      }
      if (hgState.historyAction === "PUSH") {
        this.entries.splice(this.index + 1, Infinity, hgKey);
        this.index += 1;
      } else if (hgState.historyAction === "REPLACE") {
        this.entries[this.index] = hgKey;
      } else {
        this.index = this.entries.indexOf(hgKey);
        if (this.index < 0) {
          this.entries = [hgKey];
          this.index = 0;
        }
      }
      this.cleanupAwaySessions(hgState.location, hgState.historyAction === "POP");
    });
  };

  /** 创建可预测且仅存在于当前 JS 进程的会话标识。 */
  createSession = (hgSession) => {
    this.nextSessionId += 1;
    const hgSessionId = `${Date.now().toString(36)}-${this.nextSessionId.toString(36)}`;
    this.sessions.set(hgSessionId, hgSession);
    return hgSessionId;
  };

  /** POP 到来源或更早 entry 时取消子会话及后代；普通 query POP 仍保留当前会话。 */
  cleanupAwaySessions = (hgLocation, hgIsPop = false) => {
    if (!hgLocation) return;
    const hgExpired = new Set();
    if (hgIsPop) {
      for (const hgSession of this.sessions.values()) {
        const hgSourceIndex = this.entries.indexOf(hgSession.sourceKey);
        if (hgExpired.has(hgSession.parent) || (hgSourceIndex >= 0 && this.index <= hgSourceIndex))
          hgExpired.add(hgSession);
      }
    }
    const hgKeep = new Set();
    let hgCurrent = [...this.sessions.values()].reverse().find((hgSession) =>
      !hgExpired.has(hgSession) && hgSession.pathname === hgLocation.pathname);
    while (hgCurrent) {
      hgKeep.add(hgCurrent);
      hgCurrent = hgCurrent.parent;
    }
    const hgCancelled = [];
    for (const [hgSessionId, hgSession] of this.sessions) {
      if (hgKeep.has(hgSession)) continue;
      this.sessions.delete(hgSessionId);
      hgCancelled.push(hgSession);
    }
    hgCancelled.reverse().forEach((hgSession) => this.invokeCallback(hgSession.onCancel, undefined));
  };

  /** 隔离业务通知异常；回调 Promise 的拒绝也不能变成未处理拒绝。 */
  invokeCallback = (hgCallback, hgValue) => {
    if (typeof hgCallback !== "function") return;
    try {
      const hgResult = hgCallback(hgValue);
      if (hgResult?.then) Promise.resolve(hgResult).catch(() => {});
    } catch {
      // 回调属于业务边界；异常不能让导航器重新消费同一会话或阻断路由。
    }
  };

  /** 打开已注册页面；路径参数只接受原始业务值，由此处统一 encodeURIComponent。 */
  open = ({ page, params, pathParams = {}, state, replace = false, hash, onSuccess, onCancel, onError } = {}) => {
    const hgConfig = getHGPageConfig(page);
    if (!hgConfig) throw new Error(`未知页面: ${String(page)}`);
    if (!hgIsPlainObject(pathParams)) throw new TypeError("pathParams 必须是普通对象");
    for (const hgKey of (hgConfig.route.match(HG_PATH_PARAMETER_PATTERN) || []).map((hgItem) => hgItem.slice(1))) {
      if (!Object.hasOwn(pathParams, hgKey) || pathParams[hgKey] === null || pathParams[hgKey] === undefined)
        throw new Error(`缺少路由参数: ${hgKey}`);
      if (!["string", "number", "boolean", "bigint"].includes(typeof pathParams[hgKey]) ||
          (typeof pathParams[hgKey] === "number" && !Number.isFinite(pathParams[hgKey])) ||
          ["", ".", ".."].includes(String(pathParams[hgKey])))
        throw new TypeError(`pathParams.${hgKey} 必须是字符串、数字、布尔值或 bigint`);
    }
    for (const hgKey of Object.keys(pathParams)) {
      if (!(hgConfig.route.match(HG_PATH_PARAMETER_PATTERN) || []).includes(`:${hgKey}`))
        throw new Error(`多余路由参数: ${hgKey}`);
    }
    if (typeof replace !== "boolean") throw new TypeError("replace 必须是布尔值");
    for (const [hgName, hgCallback] of Object.entries({ onSuccess, onCancel, onError })) {
      if (hgCallback !== undefined && typeof hgCallback !== "function")
        throw new TypeError(`${hgName} 必须是函数`);
    }
    if (!this.router) throw new Error("页面导航器尚未 attach router");

    const hgRoute = hgConfig.route.replace(HG_PATH_PARAMETER_PATTERN, (_, hgKey) =>
      encodeURIComponent(String(pathParams[hgKey]))
    );
    const hgSearchParams = hgToSearchParams(params);
    const hgHash = hgNormalizeHash(hash);
    // 提前检查 state 的结构化克隆能力，函数（包括嵌套回调）不能进入 history.state。
    if (state !== undefined) {
      try { structuredClone(state); } catch { throw new TypeError("state 必须可结构化克隆，不能包含回调函数"); }
    }
    const hgHasCallback = [onSuccess, onCancel, onError].some((hgCallback) => hgCallback !== undefined);
    const hgSource = this.router.state?.location;
    let hgSession;
    if (hgHasCallback) {
      hgSession = {
        pathname: new URL(hgRoute, "https://hg.invalid").pathname,
        source: hgSource ? hgLocationHref(hgSource) : null,
        sourceKey: hgSource.key,
        parent: [...this.sessions.values()].reverse().find((hgCurrent) => hgCurrent.pathname === hgSource.pathname),
        onSuccess,
        onCancel,
        onError,
      };
      this.createSession(hgSession);
    }
    const hgDestination = `${hgRoute}${hgSearchParams.toString() ? `?${hgSearchParams}` : ""}${hgHash}`;
    let hgNavigation;
    try {
      hgNavigation = this.router.navigate(hgDestination, { state, replace });
    } catch (hgError) {
      if (hgSession) this.failSession(hgSession, hgError);
      throw hgError;
    }
    if (hgSession && hgNavigation?.catch) {
      hgNavigation.catch((hgError) => this.failSession(hgSession, hgError));
    }
    return hgNavigation;
  };

  /** 仅执行路由器的后退操作；业务完成操作使用 getPageNavigation 返回的布尔结果。 */
  back = () => {
    if (!this.router) return false;
    return this.router.navigate(-1);
  };

  /** 错误只消费仍存活的会话，不返回、不重复通知已完成会话。 */
  failSession = (hgSession, hgError) => {
    let hgFound = false;
    for (const [hgSessionId, hgCurrent] of this.sessions) {
      if (hgCurrent === hgSession) {
        this.sessions.delete(hgSessionId);
        hgFound = true;
      }
    }
    if (!hgFound) return false;
    this.invokeCallback(hgSession.onError, hgError);
    return true;
  };

  /** 先消费以防重入，等待返回导航 Promise 成功才通知结果；失败只通知错误且不恢复会话。 */
  finish = (hgSession, hgMethod, hgValue) => {
    if (!hgSession || this.router?.state.location.pathname !== hgSession.pathname ||
        this.router.state.navigation.state !== "idle") return false;
    let hgFound = false;
    for (const [hgSessionId, hgCurrent] of this.sessions) {
      if (hgCurrent !== hgSession) continue;
      this.sessions.delete(hgSessionId);
      hgFound = true;
      break;
    }
    if (!hgFound) return false;
    try {
      const hgSourceIndex = this.entries.indexOf(hgSession.sourceKey);
      // 已知来源用真实 delta 跳过中间详情；replace 打开或历史失效时只替换站内来源。
      const hgNavigation = hgSourceIndex >= 0 && hgSourceIndex < this.index
        ? this.router.navigate(hgSourceIndex - this.index)
        : this.router.navigate(hgSession.source, { replace: true });
      return Promise.resolve(hgNavigation).then(() => {
        this.invokeCallback(hgSession[hgMethod], hgValue);
        return true;
      }, (hgError) => {
        this.invokeCallback(hgSession.onError, hgError);
        return false;
      });
    } catch (hgError) {
      this.invokeCallback(hgSession.onError, hgError);
      return false;
    }
  };

  /** 返回给组件的 params 是普通对象：重复键为数组，单值为字符串，空值保留为空字符串。 */
  getPageNavigation = (hgLocation) => {
    const hgTarget = getHGPageTarget(hgLocationHref(hgLocation));
    const hgParams = Object.fromEntries([...new Set(hgTarget?.params.keys())].map((hgKey) => {
      const hgValues = hgTarget.params.getAll(hgKey);
      return [hgKey, hgValues.length === 1 ? hgValues[0] : hgValues];
    }));
    const hgSession = hgTarget && hgLocation.pathname === this.router?.state.location.pathname &&
      (hgLocation.key === undefined || hgLocation.key === this.router.state.location.key) && [...this.sessions.values()].reverse()
      .find((hgCurrent) => hgCurrent.pathname === hgLocation.pathname);
    return {
      page: hgTarget?.page,
      params: hgParams,
      pathParams: hgTarget?.pathParams || {},
      success: (hgValue) => this.finish(hgSession, "onSuccess", hgValue),
      cancel: (hgValue) => this.finish(hgSession, "onCancel", hgValue),
      error: (hgValue) => {
        if (!hgSession || this.router?.state.location.pathname !== hgSession.pathname) return false;
        return this.failSession(hgSession, hgValue);
      },
    };
  };
}

export const hgPageNavigator = new HGPageNavigator();
