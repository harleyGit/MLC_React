/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 16:12:43
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-17 10:10:00
 * @FilePath: /app-web/imi-diagnosis/src/http_module/HttpRequest.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

// TODO: 拦截器：https://www.qianwen.com/chat/8be707867a6a45e28a20910026bb9354

import { LogError } from "../logger/hg_logger";
import { TOKEN_KEY } from "../manager_antd/auth/hg_auth";
import { redirectToLogin, showError, showWarning } from "./hg_ui_feedback";

const env = import.meta.env;
const getApiBase = () => {
  return env.DEV ? "" : env.VITE_API_BASE || env.VITE_API_URL || "";
};

export const ResultCodeMap = {
  200: { type: "success" },

  400: { type: "warn", message: "参数错误" },
  401: { type: "auth", message: "登录已过期，请重新登录" },
  403: { type: "auth", message: "无权限访问" },

  429: { type: "warn", message: "请求过于频繁" },

  500: { type: "error", message: "服务器内部错误" },
  10001: { type: "warn", message: "验证码错误" },
  10002: { type: "warn", message: "验证码已过期" },
};

export function handleError(err) {
  LogError("Request Error:", err);

  // HTTP / 网络 / 超时
  if (err.type !== "BIZ_ERROR") {
    showError(err.message || "网络异常");
    return;
  }

  const map = ResultCodeMap[err.code];

  if (!map) {
    showError(err.message || "未知业务错误");
    return;
  }

  switch (map.type) {
    case "auth":
      showError(map.message);
      redirectToLogin();
      break;

    case "warn":
      showWarning(map.message || err.message);
      break;

    case "error":
      showError(map.message || err.message);
      break;

    default:
      showError(err.message);
  }

  if (err.tid) {
    console.warn("TID:", err.tid);
  }
}

class NetAPI {
  constructor() {
    this.refreshTokenPromise = null;
  }

  async get(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("GET 请求出错:", error);
      throw error;
    }
  }

  // getAuthHeaders 统一读取本地 token，并按 Bearer 形式注入 Authorization。
  getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // getCommonHeaders 生成后端中间件要求的公共请求头，调用方可继续透传自定义 header 覆盖默认值。
  getCommonHeaders(extraHeaders = {}) {
    const requestId = this.generateRequestId();
    const timestamp = this.getUnixTimestamp();

    return {
      "X-API-Version": "v1",
      "X-Device-ID": this.getDeviceId(),
      "X-Client-Type": "web",
      "X-Client-Version": this.getClientVersion(),
      "X-Language": navigator.language || "zh-CN",
      "X-Request-ID": requestId,
      "X-Timestamp": timestamp,
      ...extraHeaders,
    };
  }

  // request 统一合并 token、公共 header 和业务 header，并根据请求体生成签名后发起请求。
  // 这里会避免给 GET / HEAD 塞 body，防止浏览器或服务端对请求语义判断出错。
  async request({ url, method = "GET", headers = {}, body, timeout = 5000 }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const upperMethod = method.toUpperCase();
    const authHeaders = this.getAuthHeaders();
    const commonHeaders = this.getCommonHeaders(headers);
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    const defaultHeaders = isFormData
      ? {}
      : {
          "Content-Type": "application/json",
        };

    let mergedHeaders = {
      ...defaultHeaders,
      ...authHeaders,
      ...commonHeaders,
    };

    const requestBody = this.buildRequestBody(body, upperMethod, isFormData);

    mergedHeaders = {
      ...mergedHeaders,
      "X-Signature": await this.buildSignature({
        url,
        method: upperMethod,
        headers: mergedHeaders,
        body,
      }),
    };

    const fetchOptions = {
      method: upperMethod,
      headers: mergedHeaders,
      signal: controller.signal,
    };

    if (requestBody !== undefined) {
      fetchOptions.body = requestBody;
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 401) {
          return this.handle401({ url, method: upperMethod, headers, body, timeout });
        }

        throw {
          type: "HTTP_ERROR",
          status: response.status,
          message: response.statusText || "HTTP 请求失败",
        };
      }

      const data = await response.json();
      const { code, message, result, tid, timestamp } = data;

      if (code === 401) {
        return this.handle401({ url, method: upperMethod, headers, body, timeout });
      }

      if (code !== 200) {
        throw {
          type: "BIZ_ERROR",
          code,
          message,
          tid,
          timestamp,
        };
      }

      return result;
    } catch (error) {
      clearTimeout(timer);

      if (error.name === "AbortError") {
        throw {
          type: "TIMEOUT",
          message: `请求超时 (${timeout}ms)`,
        };
      }

      if (error.type) {
        throw error;
      }

      throw {
        type: "UNKNOWN",
        message: error.message || "未知错误",
      };
    }
  }

  /**
   * GET 请求
   * @param {string} url - 请求地址
   * @param {Object} [options] - 额外配置
   */
  getWithURL = (url, options = {}) => {
    return this.request({ url, method: "GET", ...options });
  };

  /**
   * POST 请求
   * @param {string} url - 请求地址
   * @param {Object} body - 请求体
   * @param {Object} [options] - 额外配置
   */
  postWithURL = (url, body, options = {}) => {
    return this.request({ url, method: "POST", body, ...options });
  };

  /**
   * PUT 请求
   * @param {string} url - 请求地址
   * @param {Object} body - 请求体
   * @param {Object} [options] - 额外配置
   */
  putWithURL = (url, body, options = {}) => {
    return this.request({ url, method: "PUT", body, ...options });
  };

  /**
   * DELETE 请求
   * @param {string} url - 请求地址
   * @param {Object} [options] - 额外配置
   */
  deleteWithURL = (url, options = {}) => {
    return this.request({ url, method: "DELETE", ...options });
  };

  // buildRequestBody 统一处理 JSON 和 FormData 请求体，保证签名内容与真实请求体一致。
  buildRequestBody(body, method, isFormData) {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (method === "GET" || method === "HEAD") {
      return undefined;
    }

    if (isFormData) {
      return body;
    }

    return JSON.stringify(body);
  }

  // buildSignature 按后端约定拼接 method、path、时间戳、设备信息和 body 摘要，生成 X-Signature。
  async buildSignature({ url, method, headers, body }) {
    const rawBody = this.stringifyBody(body);
    const bodyHash = await this.sha256Hex(rawBody);
    const requestPath = this.getRequestPath(url);
    const payload = [
      method,
      requestPath,
      headers["X-Timestamp"] || "",
      headers["X-Request-ID"] || "",
      headers["X-Device-ID"] || "",
      headers["X-Client-Type"] || "",
      headers["X-Client-Version"] || "",
      headers["X-API-Version"] || "",
      headers["X-Language"] || "",
      bodyHash,
      headers.Authorization || "",
    ].join("\n");

    const signHex = await this.hmacSHA256Hex(this.getSignSecret(), payload);
    return `sha256=${signHex}`;
  }

  // stringifyBody 把对象请求体稳定转成字符串，避免前端签名内容与发送内容不一致。
  stringifyBody(body) {
    if (body === undefined || body === null) {
      return "";
    }

    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const data = {};
      body.forEach((value, key) => {
        data[key] = value;
      });
      return JSON.stringify(data);
    }

    if (typeof body === "string") {
      return body;
    }

    return JSON.stringify(body);
  }

  // getRequestPath 统一从完整 URL 中提取 path，确保与 Go 后端签名时使用的 r.URL.Path 对齐。
  getRequestPath(url) {
    try {
      const fullUrl = new URL(url, window.location.origin);
      return this.normalizeSignPath(fullUrl.pathname);
    } catch (error) {
      return this.normalizeSignPath(url);
    }
  }

  // normalizeSignPath 对齐 Go 服务在 root handler 中的 StripPrefix 行为，保证前后端签名使用同一条 path。
  normalizeSignPath(path = "") {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const stripPrefixes = ["/api/v1/auth", "/api/v1/profile", "/api/v1/test", "/auth", "/user", "/profile", "/test"];

    for (const prefix of stripPrefixes) {
      if (cleanPath === prefix) {
        return "/";
      }

      if (cleanPath.startsWith(`${prefix}/`)) {
        return cleanPath.slice(prefix.length);
      }
    }

    return cleanPath;
  }

  // hmacSHA256Hex 使用浏览器 Web Crypto API 生成 HMAC-SHA256 十六进制签名。
  async hmacSHA256Hex(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(message)
    );

    return this.arrayBufferToHex(signature);
  }

  // sha256Hex 计算请求体摘要，保证前后端对 body 的完整性校验口径一致。
  async sha256Hex(content = "") {
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(content));
    return this.arrayBufferToHex(digest);
  }

  // arrayBufferToHex 把浏览器加密 API 返回的二进制结果转成十六进制字符串。
  arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }

  // getSignSecret 返回请求签名密钥，默认先读环境变量，便于不同环境分别配置。
  getSignSecret() {
    return env.VITE_SIGN_SECRET || "change-me";
  }

  // getDeviceId 返回稳定设备标识，前端首次生成后持久化，避免每次请求设备头变化。
  getDeviceId() {
    const storageKey = "web_device_id";
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      deviceId = this.generateRequestId();
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }

  getClientVersion() {
    return env.VITE_APP_VERSION || "1.0.0";
  }

  getUnixTimestamp() {
    return String(Math.floor(Date.now() / 1000));
  }

  generateRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async handle401(originalRequest) {
    if (!this.refreshTokenPromise) {
      this.refreshTokenPromise = this.refreshToken();
    }

    try {
      await this.refreshTokenPromise;
      return this.request(originalRequest);
    } catch (err) {
      localStorage.removeItem("manager_token");
      window.location.href = "/login";
      throw err;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw { type: "AUTH_ERROR", message: "没有 refresh token" };
    }

    const apiBase = getApiBase();
    const url = `${apiBase}/auth/refresh`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw { type: "AUTH_ERROR", message: "刷新 token 失败" };
    }

    const data = await res.json();

    if (data.code !== 200) {
      throw { type: "AUTH_ERROR", message: data.message || "刷新 token 失败" };
    }

    localStorage.setItem("manager_token", data.result.token);
  }
}

const NetManager = new NetAPI();
export default NetManager;
