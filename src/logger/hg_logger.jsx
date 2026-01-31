/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 17:24:29
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 17:30:13
 * @FilePath: /MLC_React/src/logger/hg_logger.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// utils/logger.js

// 日志级别
const LOG_LEVEL = {
  OFF: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// 根据环境设置日志级别
let currentLevel = LOG_LEVEL.OFF;

if (process.env.NODE_ENV === "development") {
  currentLevel = LOG_LEVEL.DEBUG; // 开发：全开
} else if (
  process.env.REACT_APP_ENV === "pre" ||
  process.env.VITE_APP_ENV === "pre"
) {
  currentLevel = LOG_LEVEL.INFO; // 预发布：INFO 及以上
} else if (process.env.NODE_ENV === "production") {
  currentLevel = LOG_LEVEL.ERROR; // 生产：只报错
}

/**
 * 上报日志到后端（用于 pre / release 环境）
 */
function sendLogToServer(level, args) {
  // 将参数序列化为字符串（简单处理）
  const message = args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return "[Circular or Unserializable Object]";
        }
      }
      return String(arg);
    })
    .join(" ");

  // 构造日志对象
  const logData = {
    level,
    message,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // 使用 navigator.sendBeacon 保证页面卸载时也能发送
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(logData)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/logs", blob);
  } else {
    // 兼容 fallback（可能丢失）
    fetch("/api/logs", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData),
    }).catch(() => {});
  }
}

/**
 * 主日志输出函数
 * 用法：LogOut("🍎 问题一 参数：", value, "参数2:", value2)
 * 范例：LogOut("🍎 问题一 参数：", { phone: '13800138000' }, "参数2:", "test");
 */
export function LogOut(...args) {
  const level = "DEBUG";

  // 1. 控制台输出（仅在允许的级别）
  if (LOG_LEVEL[level] <= currentLevel) {
    console.log(`🍎[LOG]`, ...args);
  }

  // 2. 上报到服务器（pre / production 环境）
  if (process.env.NODE_ENV !== "development") {
    sendLogToServer(level, args);
  }
}

// 可选：提供 error / warn 等专用方法
// 错误日志（生产环境也会强制上报）
// 范例：LogError("登录失败", error);
export function LogError(...args) {
  console.error("[ERROR]", ...args);
  if (process.env.NODE_ENV !== "development") {
    sendLogToServer("ERROR", args);
  }
}

// TODO：接入
/* 后端接受日志：
// backend/routes/logs.js
const fs = require('fs');
const path = require('path');

app.post('/api/logs', express.json({ limit: '100kb' }), (req, res) => {
  const logFile = path.join(__dirname, '../logs', 'frontend.log');
  const line = JSON.stringify(req.body) + '\n';
  
  fs.appendFile(logFile, line, (err) => {
    if (err) console.error('Failed to write log:', err);
  });

  res.status(204).end(); // 不返回内容
});
*/
