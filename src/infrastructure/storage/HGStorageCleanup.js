/**
 * 本地存储清理
 * 职责：
 * 1. 存储用量查询（navigator.storage.estimate）；
 * 2. 过期验证码通知清理；
 * 3. 登出或切换账号时按 user_id 清空该用户的全部本地数据。
 * 关键约束：清理操作在一个跨表事务中执行，保证用户数据要么全清、要么全留。
 */

import { hgOpenDatabase } from "../database/HGDatabase";
import { HG_STORES } from "../database/HGDatabaseSchema";
import { hgLocalDataService } from "./HGLocalDataService";

// 需要按 user_id 清理的表：
// single   —— 主键就是 user_id；
// compound —— 复合主键以 user_id 开头（如 [user_id, message_id]）。
const HG_USER_SCOPED_STORES = [
  { name: HG_STORES.USERS, type: "single" },
  { name: HG_STORES.SESSIONS, type: "single" },
  { name: HG_STORES.PREFERENCES, type: "compound" },
  { name: HG_STORES.VERIFICATIONS, type: "compound" },
  { name: HG_STORES.CONVERSATIONS, type: "compound" },
  { name: HG_STORES.MESSAGES, type: "compound" },
  { name: HG_STORES.NOTIFICATIONS, type: "compound" },
  { name: HG_STORES.CART, type: "compound" },
  { name: HG_STORES.ORDERS, type: "compound" },
  { name: HG_STORES.OPS, type: "compound" },
  { name: HG_STORES.CURSORS, type: "compound" }
];

// 查询浏览器存储用量；环境不支持时返回 null
export async function hgEstimateStorageUsage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch (error) {
    console.warn("[HGStorageCleanup] 存储用量查询失败", error);
    return null;
  }
}

// 删除已过期的验证码通知记录，按 expires_at 索引扫描，避免全表遍历
export async function hgClearExpiredVerifications(now = Date.now()) {
  const db = await hgOpenDatabase();

  if (!db.objectStoreNames.contains(HG_STORES.VERIFICATIONS)) {
    return 0;
  }

  let deletedCount = 0;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HG_STORES.VERIFICATIONS, "readwrite");
    const store = tx.objectStore(HG_STORES.VERIFICATIONS);
    const request = store.index("expires_at").openCursor(IDBKeyRange.upperBound(now));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        deletedCount += 1;
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("清理过期验证码事务中止"));
  });

  if (deletedCount > 0) {
    hgLocalDataService.notifyChange(HG_STORES.VERIFICATIONS, { broadcast: false });
  }

  return deletedCount;
}

// 清空指定用户的全部本地数据（登出 / 切换账号调用）
// 注意：第二主键分量可能为字符串或数字，这里用 "\\uffff" 作为字符串上界，
// 覆盖常规字符串与数字分量；极端场景（如以 emoji 开头的 ID）需另行评估。
export async function hgClearUserData(userId) {
  if (!userId) {
    throw new Error("hgClearUserData 需要明确的 userId，禁止无差别清库");
  }

  const db = await hgOpenDatabase();

  // 只清理当前数据库中实际存在的表，避免版本差异导致事务失败
  const storeNames = HG_USER_SCOPED_STORES
    .filter((item) => db.objectStoreNames.contains(item.name))
    .map((item) => item.name);

  if (storeNames.length === 0) {
    return;
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");

    for (const item of HG_USER_SCOPED_STORES) {
      if (!storeNames.includes(item.name)) {
        continue;
      }

      const store = tx.objectStore(item.name);

      if (item.type === "single") {
        store.delete(userId);
      } else {
        // 复合主键范围删除：[userId, 最低值] 到 [userId, 字符串上界]
        store.delete(
          IDBKeyRange.bound([userId], [userId, "\uffff"])
        );
      }
    }

    tx.oncomplete = () => {
      // 清理后失效内存缓存并通知本页，其他标签页无需广播（其会话独立）
      hgLocalDataService.clearMemoryCache();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("用户数据清理事务中止"));
  });
}
