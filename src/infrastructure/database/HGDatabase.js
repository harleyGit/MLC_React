/**
 * 本地数据库连接管理
 * 职责：打开并缓存 IndexedDB 连接（单例 Promise），触发版本迁移，处理升级阻塞。
 * 边界：不执行任何具体表读写，业务操作一律通过 HGBaseRepository 完成。
 */

import { HG_DB_NAME, HG_DB_VERSION } from "./HGDatabaseSchema";
import { hgRunMigrations } from "./HGDatabaseMigration";
import { HGDatabaseError, HG_DB_ERROR_CODES } from "./HGDatabaseError";

// 数据库连接单例：并发打开复用 Promise；代际标记阻止关闭后旧请求重新缓存连接
let dbPromise = null;
let dbConnection = null;
let connectionGeneration = 0;

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

  const generation = connectionGeneration;
  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(HG_DB_NAME, HG_DB_VERSION);
    } catch (error) {
      reject(new HGDatabaseError(HG_DB_ERROR_CODES.OPEN_FAILED, "本地数据库打开失败", error));
      return;
    }
    let blocked = false;

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;

      // 已返回阻塞错误或已关闭的打开请求，不应在后台悄悄提交版本迁移
      if (blocked || generation !== connectionGeneration) {
        tx.abort();
        reject(new HGDatabaseError(HG_DB_ERROR_CODES.OPEN_FAILED, "数据库连接已关闭"));
        return;
      }

      try {
        // oldVersion 属于升级事件，不在 IDBOpenDBRequest 上；新库必须从版本 0 执行迁移
        hgRunMigrations(db, tx, event.oldVersion, HG_DB_VERSION);
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

      // 被阻塞的请求可能在调用方收到失败后才成功；关闭请求并避免污染新一代连接
      if (blocked || generation !== connectionGeneration) {
        db.close();
        reject(new HGDatabaseError(HG_DB_ERROR_CODES.OPEN_FAILED, "数据库连接已关闭"));
        return;
      }

      db.onversionchange = () => {
        // 其他标签页请求升级版本时主动让出连接，等待其完成升级
        db.close();
        if (dbConnection === db) {
          dbConnection = null;
          dbPromise = null;
        }
      };

      dbConnection = db;
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
      // 让调用方明确展示升级阻塞并重试；请求无法取消，迟来的连接须在 onsuccess 关闭
      blocked = true;
      reject(new HGDatabaseError(HG_DB_ERROR_CODES.OPEN_BLOCKED, "数据库升级被其他页面阻塞"));
    };
  }).catch((error) => {
    if (dbPromise === openingPromise) {
      dbPromise = null;
    }
    throw error;
  });

  const openingPromise = dbPromise;
  return dbPromise;
}

// 主动关闭数据库连接；不等待可能一直被其他标签页阻塞的 open 请求
export async function hgCloseDatabase() {
  connectionGeneration += 1;
  const db = dbConnection;
  dbConnection = null;
  dbPromise = null;
  if (db) {
    db.onversionchange = null;
    db.close();
  }
}
