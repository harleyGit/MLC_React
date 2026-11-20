/**
 * 统一本地数据服务
 * 职责：
 * 1. 数据变更通知：页内订阅 + 跨标签页 BroadcastChannel 广播；
 * 2. 当前登录账号绑定：为多账号数据隔离提供全局用户上下文；
 * 3. 内存缓存：高频读取数据的短期缓存，避免重复读 IndexedDB。
 * 关键约束：广播只携带表名等元信息，不携带 Token、消息正文等敏感数据。
 */

import { HG_STORES } from "../database/HGDatabaseSchema";

// 跨标签页通知使用的频道名，仅传表名，不传数据内容
const HG_BROADCAST_CHANNEL_NAME = "mlc_local_data_notify";

class HGLocalDataService {
  constructor() {
    this.listeners = new Map();     // storeName -> Set<listener>
    this.memoryCache = new Map();   // cacheKey -> { value, expiresAt }
    this.currentUserId = null;
    this.channel = null;

    // BroadcastChannel 不可用时（旧浏览器）静默降级为仅页内通知
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(HG_BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          const { storeName } = event.data || {};
          if (storeName) {
            this.emitToListeners(storeName);
          }
        };
      } catch (error) {
        console.warn("[HGLocalDataService] BroadcastChannel 初始化失败", error);
        this.channel = null;
      }
    }
  }

  // 绑定当前登录用户；切换账号时清空内存缓存，防止读到上一个账号的数据
  setCurrentUserId(userId) {
    this.currentUserId = userId;
    this.clearMemoryCache();
  }

  getCurrentUserId() {
    return this.currentUserId;
  }

  // 订阅某张表的数据变更，返回取消订阅函数
  subscribe(storeName, listener) {
    if (!this.listeners.has(storeName)) {
      this.listeners.set(storeName, new Set());
    }
    this.listeners.get(storeName).add(listener);

    return () => {
      this.listeners.get(storeName)?.delete(listener);
    };
  }

  // 通知某张表发生变更；broadcast 为 true 时同时通知其他标签页
  notifyChange(storeName, { broadcast = true } = {}) {
    this.emitToListeners(storeName);

    if (broadcast && this.channel) {
      try {
        this.channel.postMessage({ storeName });
      } catch (error) {
        // 广播失败不影响本页流程
        console.warn("[HGLocalDataService] 广播数据变更失败", error);
      }
    }
  }

  // 触发页内监听器；单个监听器异常不影响其他监听器
  emitToListeners(storeName) {
    const set = this.listeners.get(storeName);
    if (!set) return;

    for (const listener of set) {
      try {
        Promise.resolve(listener(storeName)).catch(console.error);
      } catch (error) {
        console.error("[HGLocalDataService] 数据变更监听器执行失败", error);
      }
    }
  }

  // 写入内存缓存；ttlMs 为 0 表示不过期（由账号切换或手动清理回收）
  setMemoryCache(key, value, ttlMs = 0) {
    this.memoryCache.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0
    });
  }

  // 读取内存缓存，过期条目惰性清除
  getMemoryCache(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  // 清空全部内存缓存
  clearMemoryCache() {
    this.memoryCache.clear();
  }
}

// 全局单例：React Hook、Repository 与同步引擎共用同一份变更通知与内存缓存
export const hgLocalDataService = new HGLocalDataService();

export { HG_STORES };
