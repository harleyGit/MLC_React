/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 16:12:43
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-26 00:24:32
 * @FilePath: /app-web/imi-diagnosis/src/http_module/HttpRequest.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
class NetAPI {
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

      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
      }

      // 根据响应类型处理
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.error(`请求超时 (${timeout}ms):`, url);
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      console.error(`${method} 请求出错:`, error);
      throw error;
    }
  }

  /**
   * GET 请求
   * @param {string} url - 请求地址
   * @param {Object} [options] - 额外配置
   */
  getWithURL = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      this.request({ url, method: "GET", ...options })
        .then((data) => {
          // 你可以在这里加额外处理
          resolve(data);
        })
        .catch((error) => {
          // 统一错误处理
          reject(error);
        });
    });
  };

  /**
   * POST 请求
   * @param {string} url - 请求地址
   * @param {Object} body - 请求体
   * @param {Object} [options] - 额外配置
   */
  postWithURL = (url, body, options = {}) => {
    return new Promise((resolve, reject) => {
      this.request({ url, method: "POST", body, ...options })
        .then((data) => {
          // 你可以在这里加额外处理
          resolve(data);
        })
        .catch((error) => {
          // 统一错误处理
          reject(error);
        });
    });
  };

  /**
   * PUT 请求
   * @param {string} url - 请求地址
   * @param {Object} body - 请求体
   * @param {Object} [options] - 额外配置
   */
  putWithURL = (url, body, options = {}) => {
    return new Promise((resolve, reject) => {
      this.request({ url, method: "PUT", body, ...options })
        .then((data) => {
          // 你可以在这里加额外处理
          resolve(data);
        })
        .catch((error) => {
          // 统一错误处理
          reject(error);
        });
    });
  };

  /**
   * DELETE 请求
   * @param {string} url - 请求地址
   * @param {Object} [options] - 额外配置
   */
  deleteWithURL = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      this.request({ url, method: "DELETE", ...options })
        .then((data) => {
          // 你可以在这里加额外处理
          resolve(data);
        })
        .catch((error) => {
          // 统一错误处理
          reject(error);
        });
    });
  };
}

const NetManager = new NetAPI();
export default NetManager;
