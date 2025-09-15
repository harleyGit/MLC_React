/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 18:48:02
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-12 09:44:50
 * @FilePath: /app-web/imi-diagnosis/src/http_module/HttpIPManager.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import Ping from "ping.js";
import ping from "web-pingjs"; // 注意导入方式
import axios from "axios";

class HttpIPManager {
  // 封装获取公网 IP 地址的方法
  static getPublicIP() {
    return new Promise((resolve, reject) => {
      axios
        .get("/ipapi")
        .then((response) => {
          // console.log("🍎 🍊 response：", response)
          // 返回公网 IP 地址
          resolve(response.data);
        })
        .catch((error) => {
          // 返回错误信息
          reject("无法获取公网 IP 地址");
        });
    });
  }

  static getNetworkInfo() {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({
        iceServers: [],
      });
      pc.createDataChannel("");
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (ice.candidate) {
          const ips = [];
          const candidate = ice.candidate.candidate;
          const regex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
          const matches = candidate.match(regex);
          if (matches) ips.push(...matches);
          resolve({ localIPs: ips });
          pc.close();
        }
      };
    });
  }

  // 延迟测速(极度不准确，小了5倍)
  static latencySpeed(url) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      fetch(url, { method: "HEAD", mode: "no-cors" })
        .then(() => {
          const endTime = performance.now();
          resolve(Math.round(endTime - startTime)); // 毫秒
        })
        .catch(() => {
          reject("网络请求失败，可能目标不支持 CORS");
        });
    });
  }

  // 注意：部分url无法使用
  static latecyPingInfo(domainUrl) {
    const ping = new Ping();
    return ping
      .ping(domainUrl)
      .then((data) => {
        console.log("🍎 ping延迟:", domainUrl, ": ", data);
        return data; // 成功，返回延迟（单位：ms）
      })
      .catch((err) => {
        console.error("Ping failed:", err);
        throw err;
      });
  }

  static async latecyPingInfoV1(domainURL) {
    const domain = domainURL.replace(/^https?:\/\//, "");
    try {
      const time = await ping(domain);
      return { domain, time };
    } catch (error) {
      return { domain, error: error.message || "Ping failed" };
    }
  }
}

export default HttpIPManager;
