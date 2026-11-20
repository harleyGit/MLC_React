/**
 * 本地数据库连接管理
 * 职责：打开并缓存 IndexedDB 连接（单例 Promise），触发版本迁移，处理升级阻塞。
 * 边界：不执行任何具体表读写，业务操作一律通过 HGBaseRepository 完成。
 */

import { HG_DB_NAME, HG_DB_VERSION } from "./HGDatabaseSchema";
import { hgRunMigrations } from "./HGDatabaseMigration";
import { HGDatabaseError, HG_DB_ERROR_CODES } from "./HGDatabaseError";

// 数据库连接单例：并发调用时复用同一个打开过程，避免重复 open
let dbPromise = null;

// 检查当前环境是否支持 IndexedDB（如 SSR 或隐私模式下可能不可用）
export function hgIsDatabaseSupported() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

// 打开（或复用）本地数据库连接；失败时清空单例以便下次重试
export function hgOpenDatabase() {
  if (dbPromise) return dbPromise;

  if (!hgIsDatabaseSupported()) {
    return Promise.reject(
      new HGDatabaseError(
        HG_DB_ERROR_CODES.OPEN_FAILED,
        "当前环境不支持 IndexedDB，本地持久化不可用"
      )
    );
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(HG_DB_NAME, HG_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;

      try {
        hgRunMigrations(db, tx, request.oldVersion, HG_DB_VERSION);
      } catch (error) {
        // 升级失败必须中止事务，否则数据库会停留在半初始化状态
        try {
          tx.abort();
        } catch {
          // 事务可能已结束
        }
        reject(error);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        // 其他标签页请求升级版本时主动让出连接，等待其完成升级
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      reject(
        new HGDatabaseError(
          HG_DB_ERROR_CODES.OPEN_FAILED,
          "本地数据库打开失败",
          request.error
        )
      );
    };

    request.onblocked = () => {
      // 升级被其他持有旧连接的页面阻塞，需用户关闭旧标签页
      console.warn("[HGDatabase] 数据库升级被其他页面阻塞");
    };
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

// 主动关闭数据库连接（登出清理或测试场景使用）；关闭后下次操作会重新打开
export async function hgCloseDatabase() {
  if (!dbPromise) return;

  try {
    const db = await dbPromise;
    db.onversionchange = null;
    db.close();
  } finally {
    dbPromise = null;
  }
}
