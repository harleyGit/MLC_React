/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 16:12:43
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-06 01:05:44
 * @FilePath: /app-web/imi-diagnosis/src/http_module/HttpRequest.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

// TODO: 拦截器：https://www.qianwen.com/chat/8be707867a6a45e28a20910026bb9354

import { LogError } from "../logger/hg_logger";
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from "../manager_antd/auth/hg_auth";
import { redirectToLogin, showError, showWarning } from "./hg_ui_feedback";

const env = import.meta.env;
const getApiBase = () => {
  return env.DEV ? "" : env.VITE_API_BASE || env.VITE_API_URL || "";
};

// 后端统一的 token 无效业务码集合，需要与 HTTP 401 一样触发刷新链路。
const TOKEN_INVALID_CODES = new Set([401, 101001]);

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
      "X-Role": "user",  // 用户角色，可选值: admin / user
      ...extraHeaders,
    };
  }

  // request 统一合并 token、公共 header 和业务 header，并根据请求体生成签名后发起请求。
  // 这里会避免给 GET / HEAD 塞 body，防止浏览器或服务端对请求语义判断出错。
  async request({ url, method = "GET", headers = {}, body, timeout = 5000, _hasRetried = false }) {
    // 浏览器原生 API，专门用来手动中断异步请求（fetch、DOM 事件监听、流式读取等），搭配 fetch 的 signal 属性使用。
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const upperMethod = method.toUpperCase();
    const authHeaders = this.getAuthHeaders();
    const commonHeaders = this.getCommonHeaders(headers);
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    const isBinaryData =
      body instanceof Uint8Array ||
      body instanceof ArrayBuffer ||
      body instanceof Blob;

    // 根据请求体类型设置默认 Content-Type
    let defaultContentType = "application/json";
    if (isFormData) {
      defaultContentType = undefined; // FormData 由浏览器自动设置
    } else if (isBinaryData) {
      defaultContentType = "application/octet-stream";
    }

    const defaultHeaders = defaultContentType
      ? { "Content-Type": defaultContentType }
      : {};

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
          return this.handle401({
            url,
            method: upperMethod,
            headers,
            body,
            timeout,
            _hasRetried,
          });
        }

        throw {
          type: "HTTP_ERROR",
          status: response.status,
          message: response.statusText || "HTTP 请求失败",
        };
      }

      const data = await response.json();
      const { code, message, result, tid, timestamp } = data;

      if (this.isTokenInvalidCode(code)) {
        return this.handle401({
          url,
          method: upperMethod,
          headers,
          body,
          timeout,
          _hasRetried,
        });
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

  // buildRequestBody 统一处理 JSON、FormData 和二进制请求体，保证签名内容与真实请求体一致。
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

    // 二进制数据（Uint8Array、ArrayBuffer、Blob）直接返回，不做 JSON 转换
    if (body instanceof Uint8Array || body instanceof ArrayBuffer || body instanceof Blob) {
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

    // FormData 文件上传时，前后端统一使用空字符串计算签名
    // 因为 multipart 二进制内容无法在前端精确计算
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return "";
    }

    // 二进制数据上传时，前后端统一使用空字符串计算签名
    // 因为二进制内容无法在前端精确计算
    if (body instanceof Uint8Array || body instanceof ArrayBuffer || body instanceof Blob) {
      return "";
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
    } catch {
      return this.normalizeSignPath(url);
    }
  }

  // normalizeSignPath 对齐 Go 服务在 root handler 中的 StripPrefix 行为，保证前后端签名使用同一条 path。
  normalizeSignPath(path = "") {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const stripPrefixes = ["/api/v1/auth", "/api/v1/user", "/api/v1/profile", "/api/v1/video_upload", "/api/v1/ops", "/api/v1/test", "/auth", "/user", "/profile", "/video_upload", "/ops", "/test"];

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

  // hmacSHA256Hex 生成 HMAC-SHA256 十六进制签名；非安全上下文无 Web Crypto 时走 JS 降级实现。
  async hmacSHA256Hex(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const subtle = this.getCryptoSubtle();

    if (!subtle) {
      return this.hmacSHA256HexFallback(keyData, encoder.encode(message));
    }

    const cryptoKey = await subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(message)
    );

    return this.arrayBufferToHex(signature);
  }

  // sha256Hex 计算请求体摘要；局域网 HTTP 访问无 crypto.subtle 时仍保持相同 SHA-256 口径。
  async sha256Hex(content = "") {
    const encoder = new TextEncoder();
    const subtle = this.getCryptoSubtle();

    if (!subtle) {
      return this.bytesToHex(this.sha256Bytes(encoder.encode(content)));
    }

    const digest = await subtle.digest("SHA-256", encoder.encode(content));
    return this.arrayBufferToHex(digest);
  }

  // getCryptoSubtle 安全读取 Web Crypto；HTTP 局域网地址通常不是 secure context，subtle 会缺失。
  getCryptoSubtle() {
    return window.crypto?.subtle || null;
  }

  // hmacSHA256HexFallback 在无 Web Crypto 环境中按 RFC 2104 生成 HMAC，输出需与后端签名保持一致。
  hmacSHA256HexFallback(keyBytes, messageBytes) {
    const blockSize = 64;
    let normalizedKey = keyBytes;

    if (normalizedKey.length > blockSize) {
      normalizedKey = this.sha256Bytes(normalizedKey);
    }

    const paddedKey = new Uint8Array(blockSize);
    paddedKey.set(normalizedKey);

    const outerPad = new Uint8Array(blockSize);
    const innerPad = new Uint8Array(blockSize);

    for (let index = 0; index < blockSize; index += 1) {
      outerPad[index] = paddedKey[index] ^ 0x5c;
      innerPad[index] = paddedKey[index] ^ 0x36;
    }

    const innerHash = this.sha256Bytes(this.concatBytes(innerPad, messageBytes));
    return this.bytesToHex(this.sha256Bytes(this.concatBytes(outerPad, innerHash)));
  }

  // sha256Bytes 是 Web Crypto 不可用时的 SHA-256 实现，仅用于请求签名降级。
  // 这个是为了解决在局域网也可以ke 访问的http服务，不能使用webcrypto情况下兼容。
  sha256Bytes(bytes) {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const bitLength = bytes.length * 8;
    const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
    const padded = new Uint8Array(paddedLength);
    const words = new Uint32Array(64);

    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) {
        words[index] = view.getUint32(offset + index * 4);
      }

      for (let index = 16; index < 64; index += 1) {
        const s0 = this.rightRotate(words[index - 15], 7) ^ this.rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const s1 = this.rightRotate(words[index - 2], 17) ^ this.rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = hash;

      for (let index = 0; index < 64; index += 1) {
        const sum1 = this.rightRotate(e, 6) ^ this.rightRotate(e, 11) ^ this.rightRotate(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = this.rightRotate(a, 2) ^ this.rightRotate(a, 13) ^ this.rightRotate(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }

    const digest = new Uint8Array(32);
    const digestView = new DataView(digest.buffer);
    hash.forEach((item, index) => digestView.setUint32(index * 4, item));
    return digest;
  }

  // rightRotate 执行 SHA-256 需要的 32 位循环右移，输入按无符号整数处理。
  rightRotate(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  // concatBytes 合并两段字节数组，避免降级签名过程中引入字符串编码差异。
  concatBytes(first, second) {
    const result = new Uint8Array(first.length + second.length);
    result.set(first);
    result.set(second, first.length);
    return result;
  }

  // bytesToHex 把字节数组转成十六进制字符串，作为降级摘要与 HMAC 的统一输出格式。
  bytesToHex(bytes) {
    return Array.from(bytes)
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
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

  // isTokenInvalidCode 集中维护后端 token 失效码，避免鉴权判断散落在请求流程中。
  isTokenInvalidCode(code) {
    return TOKEN_INVALID_CODES.has(code);
  }

  generateRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  // handle401 只做一次 refresh 重试；失败后抛错给页面处理，避免请求层强制退出登录。
  async handle401(originalRequest) {
    if (originalRequest?._hasRetried) {
      throw {
        type: "AUTH_ERROR",
        status: 401,
        message: "登录状态失效，请重新登录",
      };
    }

    if (!this.refreshTokenPromise) {// token刷想
      this.refreshTokenPromise = this.refreshToken();
    }

    try {
      await this.refreshTokenPromise;
      return this.request({
        ...originalRequest,
        _hasRetried: true,
      });
    } catch (err) {
      throw {
        type: "AUTH_ERROR",
        status: 401,
        message: err?.message || "登录状态失效，请重新登录",
      };
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  async refreshToken() {
    const refreshToken =
      localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem("refreshToken");
    if (!refreshToken) {
      throw { type: "AUTH_ERROR", message: "没有 refresh token" };
    }

    const apiBase = getApiBase();
    const url = `${apiBase}/api/v1/auth/refresh`;
    const body = { refreshToken };
    const commonHeaders = this.getCommonHeaders();
    const requestHeaders = {
      "Content-Type": "application/json",
      ...commonHeaders,
    };
    requestHeaders["X-Signature"] = await this.buildSignature({
      url,
      method: "POST",
      headers: requestHeaders,
      body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw { type: "AUTH_ERROR", message: "刷新 token 失败" };
    }

    const data = await res.json();

    if (data.code !== 200) {
      throw { type: "AUTH_ERROR", message: data.message || "刷新 token 失败" };
    }

    localStorage.setItem(TOKEN_KEY, data?.result?.token);
    if (data?.result?.refreshToken || data?.result?.refresh_token) {
      localStorage.setItem(
        REFRESH_TOKEN_KEY,
        data?.result?.refreshToken ?? data?.result?.refresh_token
      );
    }
  }
}

const NetManager = new NetAPI();
export default NetManager;
