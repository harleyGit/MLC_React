/**
 * 增量同步引擎
 * 职责：基于游标的 HTTP 增量拉取 + IndexedDB 幂等写入 + 游标原子推进。
 * 关键约束（对应技术方案第十章）：
 * 1. 幂等写入：相同消息重复接收不产生重复记录（依赖 put 覆盖语义 + message_id 主键）；
 * 2. 原子推进：数据写入与游标更新在同一个 IndexedDB 事务中完成；
 * 3. 分页同步：通过 has_more 连续拉取，不假设一次返回全部数据；
 * 4. 账号隔离：同一用户同一域禁止并发同步，切换用户后旧任务作废。
 */

import { hgOpenDatabase } from "../database/HGDatabase";
import { HG_STORES } from "../database/HGDatabaseSchema";
import { hgSyncCursorRepository } from "./HGSyncCursorRepository";
import { hgLocalDataService } from "../storage/HGLocalDataService";

// 业务域处理器注册表：domain -> { storeName, fetchPage }
// fetchPage(cursor, limit) 返回 { items, next_cursor, has_more }，由调用方注入远端接口
const domainHandlers = new Map();

// 注册业务域同步处理器；fetchPage 内部调用 Go 后端 /api/v1/sync 接口
export function hgRegisterSyncDomain(domain, { storeName, fetchPage }) {
  if (!domain || !storeName || typeof fetchPage !== "function") {
    throw new Error("注册同步域需要 domain、storeName 与 fetchPage");
  }

  domainHandlers.set(domain, { storeName, fetchPage });
}

class HGSyncEngine {
  constructor() {
    this.activeKeys = new Set();       // 正在同步的 "userId:domain"
    this.cancelledUsers = new Set();   // 已请求取消的用户，用于打断进行中的分页循环
  }

  // 同步单个业务域：从本地游标开始，分页拉取直到 has_more 为 false
  async syncDomain(userId, domain, { limit = 100 } = {}) {
    const handler = domainHandlers.get(domain);

    if (!handler) {
      throw new Error(`未注册的同步域: ${domain}`);
    }

    const activeKey = `${userId}:${domain}`;

    if (this.activeKeys.has(activeKey)) {
      // 同一用户同一域不并发同步
      return;
    }

    this.activeKeys.add(activeKey);

    try {
      let cursor = await hgSyncCursorRepository.getCursor(userId, domain);
      let pageVersion = 0;

      // 每页写入后检查取消标记，切换账号时立即停止旧任务
      while (!this.cancelledUsers.has(userId)) {
        const pageToken = cursor;
        const pageVersionAtStart = pageVersion;

        const page = await handler.fetchPage(cursor, limit);

        // 拉取期间被取消：丢弃本页结果
        if (this.cancelledUsers.has(userId) || pageVersionAtStart !== pageVersion) {
          return;
        }

        // 数据写入与游标推进在同一事务中，防止消息未写入却提前推进游标
        await this.writePageAtomically(
          userId,
          domain,
          handler.storeName,
          page.items || [],
          page.next_cursor ?? pageToken
        );

        cursor = page.next_cursor;
        pageVersion += 1;

        if (!page.has_more) {
          break;
        }
      }
    } finally {
      this.activeKeys.delete(activeKey);
    }
  }

  // 同步全部已注册业务域（应用启动或网络恢复时调用）
  async syncAllDomains(userId) {
    const domains = [...domainHandlers.keys()];

    for (const domain of domains) {
      await this.syncDomain(userId, domain);
    }
  }

  // 原子写入一页数据并推进游标：事务覆盖数据表 + sync_cursors 两张表
  async writePageAtomically(userId, domain, storeName, items, nextCursor) {
    const db = await hgOpenDatabase();

    await new Promise((resolve, reject) => {
      const tx = db.transaction([storeName, HG_STORES.CURSORS], "readwrite");
      const dataStore = tx.objectStore(storeName);
      const cursorStore = tx.objectStore(HG_STORES.CURSORS);

      // put 为覆盖式写入，主键（如 [user_id, message_id]）重复即更新，天然幂等
      for (const item of items) {
        dataStore.put(item);
      }

      cursorStore.put({
        user_id: userId,
        domain,
        cursor: nextCursor,
        updated_at: Date.now()
      });

      tx.oncomplete = () => {
        hgLocalDataService.notifyChange(storeName);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("同步写入事务中止"));
    });
  }

  // 取消指定用户的进行中同步（切换账号 / 登出时调用）
  cancelUser(userId) {
    this.cancelledUsers.add(userId);
  }

  // 恢复指定用户的同步资格（登录成功后调用）
  resumeUser(userId) {
    this.cancelledUsers.delete(userId);
  }
}

export const hgSyncEngine = new HGSyncEngine();
