/**
 * Repository 基类：封装通用 IndexedDB 读写操作
 * 职责：提供类似 SQL 的 put/get/delete/getAll/getAllByIndex 及游标分页能力，
 *       统一事务生命周期管理与错误包装。
 * 关键约束：put 为覆盖式 upsert，add 才是仅插入；复合主键以数组形式传参（如 [userId, messageId]）。
 */

import { hgOpenDatabase } from "./HGDatabase";
import { HGDatabaseError, HG_DB_ERROR_CODES, hgIsQuotaError, hgWrapDatabaseError } from "./HGDatabaseError";

export class HGBaseRepository {
  constructor(storeName) {
    this.storeName = storeName;
  }

  // 在单个 Object Store 上执行事务操作
  // operation(store, setResult) 返回 IDBRequest，也可在内部自行绑定 onsuccess
  // 并通过 setResult 主动回传结果（游标分页场景使用）
  async execute(mode, operation) {
    const db = await hgOpenDatabase();

    if (!db.objectStoreNames.contains(this.storeName)) {
      throw new HGDatabaseError(
        HG_DB_ERROR_CODES.STORE_NOT_FOUND,
        `Object Store 不存在: ${this.storeName}`
      );
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);

      let result;
      let settled = false;

      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      tx.onerror = () => {
        if (!settled) {
          settled = true;
          reject(this.wrapTxError(tx.error));
        }
      };

      tx.onabort = () => {
        if (!settled) {
          settled = true;
          reject(this.wrapTxError(tx.error || new Error("事务中止")));
        }
      };

      try {
        const request = operation(store, (value) => {
          result = value;
        });

        // operation 未自行绑定 onsuccess 时，使用默认规则：成功后记录 request.result
        if (request && !request.onsuccess) {
          request.onsuccess = () => {
            result = request.result;
          };
        }
      } catch (error) {
        settled = true;
        try {
          tx.abort();
        } catch {
          // 事务可能已结束
        }
        reject(this.wrapTxError(error));
      }
    });
  }

  // 统一包装事务异常：配额类错误单独标识，便于上层触发缓存清理
  wrapTxError(error) {
    if (hgIsQuotaError(error)) {
      return new HGDatabaseError(
        HG_DB_ERROR_CODES.QUOTA_EXCEEDED,
        "本地存储空间不足",
        error
      );
    }

    return hgWrapDatabaseError(error, HG_DB_ERROR_CODES.TRANSACTION_ABORTED, "本地数据库操作失败");
  }

  // 覆盖式插入或更新（类似 INSERT ... ON DUPLICATE KEY UPDATE）
  put(data) {
    return this.execute("readwrite", (store) => store.put(data));
  }

  // 仅插入，主键重复会报错（类似 INSERT，不含 ON DUPLICATE KEY）
  add(data) {
    return this.execute("readwrite", (store) => store.add(data));
  }

  // 按主键读取（类似 SELECT WHERE primary_key = ?）
  get(key) {
    return this.execute("readonly", (store) => store.get(key));
  }

  // 按主键删除（类似 DELETE WHERE primary_key = ?）
  delete(key) {
    return this.execute("readwrite", (store) => store.delete(key));
  }

  // 读取全部记录（类似 SELECT *）；大表慎用，应优先使用索引范围或分页
  getAll() {
    return this.execute("readonly", (store) => store.getAll());
  }

  // 清空整表（类似 TRUNCATE TABLE）
  clear() {
    return this.execute("readwrite", (store) => store.clear());
  }

  // 按索引读取（类似 SELECT WHERE indexed_column = ?）
  getAllByIndex(indexName, value) {
    return this.execute("readonly", (store) => {
      return store.index(indexName).getAll(value);
    });
  }

  // 基于索引游标的分页读取，避免一次性把大量记录加载进内存
  // range 可传 IDBKeyRange；direction 支持 next/prev/nextunique/prevunique
  getPageByIndex(indexName, range, { direction = "next", limit = 50 } = {}) {
    return this.execute("readonly", (store, setResult) => {
      const index = store.index(indexName);
      const items = [];
      const request = index.openCursor(range, direction);

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor && items.length < limit) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          // 游标耗尽或达到单页上限，通过 setResult 回传本页数据
          setResult(items);
        }
      };

      return request;
    });
  }
}
