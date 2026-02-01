/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 16:12:43
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:18:42
 * @FilePath: /app-web/imi-diagnosis/src/http_module/HttpRequest.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

// TODO: 拦截器：https://www.qianwen.com/chat/8be707867a6a45e28a20910026bb9354

import { LogError } from "../logger/hg_logger";
import { TOKEN_KEY } from "../manager_antd/auth/hg_auth";
import { redirectToLogin, showError, showWarning } from "./hg_ui_feedback";

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

  // 可选：把 tid 打出来
  if (err.tid) {
    console.warn("TID:", err.tid);
  }
}

class NetAPI {
  constructor() {
    this.refreshTokenPromise = null; // 用于缓存刷新 token 的 Promise
  }
  async get(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json(); // 如果返回的是 JSON
      return data;
    } catch (error) {
      console.error("GET 请求出错:", error);
      throw error;
    }
  }

  getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** request()里，传入的参数做解构，然后一一对应使用。
   * 发起 HTTP 请求
   * @param {Object} config - 请求配置
   * @param {string} config.url - 请求地址
   * @param {string} [config.method="GET"] - 请求方法 (GET/POST/PUT/DELETE)
   * @param {Object} [config.headers] - 请求头
   * @param {Object|string} [config.body] - 请求体 (仅 POST/PUT 用)
   * @param {number} [config.timeout=5000] - 超时时间（毫秒）
   * @returns {Promise<any>} - 返回解析后的响应数据
   */
  async request({ url, method = "GET", headers = {}, body, timeout = 5000 }) {
    // 超时控制
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    // 注入 token
    headers = { ...headers, ...this.getAuthHeaders() };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers, //合并外部传入的headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal, // 关联 abort 控制器
      });

      clearTimeout(id);
      // ① HTTP 层错误
      if (!response.ok) {
        // 401 单独处理
        if (response.status === 401) {
          return this.handle401({ url, method, headers, body, timeout });
        }
        throw {
          type: "HTTP_ERROR",
          status: response.status,
          message: response.statusText,
        };
      }

      const data = await response.json();

      // ② 业务层错误
      const { code, message, result, tid, timestamp } = data;
      if (code === 401) {
        return this.handle401({ url, method, headers, body, timeout });
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
      // ③ 成功：只返回 result
      return result;
    } catch (error) {
      // ④ 超时
      if (error.name === "AbortError") {
        throw {
          type: "TIMEOUT",
          message: `请求超时 (${timeout}ms)`,
        };
      }

      // ⑤ 已结构化错误，直接抛
      if (error.type) {
        throw error;
      }

      // ⑥ 兜底未知错误
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

  async handle401(originalRequest) {
    // 只发一次刷新请求
    if (!this.refreshTokenPromise) {
      this.refreshTokenPromise = this.refreshToken();
    }

    try {
      await this.refreshTokenPromise;
      // 刷新成功，重试原请求
      return this.request(originalRequest);
    } catch (err) {
      // 刷新失败，清理 token 并跳登录
      localStorage.removeItem("manager_token");
      window.location.href = "/login";
      throw err;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken)
      throw { type: "AUTH_ERROR", message: "没有 refresh token" };

    const url = `${process.env.VITE_API_BASE}/auth/refresh`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw { type: "AUTH_ERROR", message: "刷新 token 失败" };
    const data = await res.json();

    if (data.code !== 200)
      throw { type: "AUTH_ERROR", message: data.message || "刷新 token 失败" };

    // 保存新 token
    localStorage.setItem("manager_token", data.result.token);
  }
}

const NetManager = new NetAPI();
export default NetManager;

/** 拦截器增加【还没有加入】
 // src/utils/request.js
import axios from 'axios';

// 创建实例
const request = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080', // 可配置
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器（可选：加 token）
request.interceptors.request.use(
  (config) => {
    // 例如从 localStorage 读 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器（统一处理错误）
request.interceptors.response.use(
  (response) => response.data, // 直接返回 data
  (error) => {
    console.error('API 请求失败:', error);
    return Promise.reject(error);
  }
);

export default request;
 * **/
