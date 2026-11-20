/**
 * 缓存策略定义
 * 职责：声明各业务表的读取策略与 TTL 有效期，并提供记录新鲜度判断。
 * 关键约束：策略与《本地数据库存储技术》第八章对齐；
 *          订单等资金相关数据为 server_first，本地数据只作展示参考，不作为业务依据。
 */

import { HG_STORES } from "../database/HGDatabaseSchema";

// strategy 含义：
// cache_first    —— 先读本地缓存，过期后后台刷新
// local_first    —— 以本地写入为准，按设置决定是否同步服务端
// local_page_sync —— 本地分页 + 增量同步
// short-lived    —— 短期存储，过期即清理
// ttl_cache      —— 固定 TTL 缓存
// server_first   —— 服务端优先，本地仅作展示缓存
export const HG_CACHE_POLICIES = {
  [HG_STORES.USERS]: { strategy: "cache_first", ttlMs: 10 * 60 * 1000 },
  [HG_STORES.PREFERENCES]: { strategy: "local_first", ttlMs: 0 },
  [HG_STORES.MESSAGES]: { strategy: "local_page_sync", ttlMs: 0 },
  [HG_STORES.VERIFICATIONS]: { strategy: "short-lived", ttlMs: 10 * 60 * 1000 },
  [HG_STORES.NOTIFICATIONS]: { strategy: "cache_first", ttlMs: 30 * 60 * 1000 },
  [HG_STORES.PRODUCTS]: { strategy: "ttl_cache", ttlMs: 5 * 60 * 1000 },
  [HG_STORES.ORDERS]: { strategy: "server_first", ttlMs: 0 },
  [HG_STORES.OPS]: { strategy: "short-lived", ttlMs: 60 * 1000 }
};

// 读取指定表的缓存策略，未配置的表默认 cache_first 且不过期
export function hgGetCachePolicy(storeName) {
  return HG_CACHE_POLICIES[storeName] || { strategy: "cache_first", ttlMs: 0 };
}

// 判断带 cached_at / updated_at 字段的记录是否仍在 TTL 有效期内
// ttlMs 为 0 表示该表不按 TTL 过期，始终视为有效
export function hgIsRecordFresh(record, storeName) {
  if (!record) return false;

  const { ttlMs } = hgGetCachePolicy(storeName);
  if (!ttlMs) return true;

  const cachedAt = record.cached_at || record.updated_at || 0;
  return Date.now() - cachedAt < ttlMs;
}
