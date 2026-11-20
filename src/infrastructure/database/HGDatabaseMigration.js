/**
 * 数据库版本迁移
 * 职责：在 onupgradeneeded 中按版本顺序执行建表、建索引与数据转换。
 * 关键约束：
 * 1. 已存在 Object Store 的主键不允许修改，只能通过新建表迁移数据；
 * 2. 迁移步骤必须幂等（重复执行不产生副作用），复杂迁移须回测旧版本数据可正常读取；
 * 3. 新版本迁移步骤注册到 HG_MIGRATION_STEPS 后，同时递增 HGDatabaseSchema 中的 HG_DB_VERSION。
 */

import { HG_SCHEMA } from "./HGDatabaseSchema";
import { HG_DB_ERROR_CODES, hgWrapDatabaseError } from "./HGDatabaseError";

// 补齐缺失的表和索引；仅用于当前 v1/v2 的相同表结构，未来结构变更须按版本拆分迁移
export function hgEnsureSchema(db, tx) {
  for (const schema of HG_SCHEMA) {
    let store;

    if (!db.objectStoreNames.contains(schema.name)) {
      store = db.createObjectStore(schema.name, {
        keyPath: schema.keyPath
      });
    } else {
      store = tx.objectStore(schema.name);
    }

    for (const [name, keyPath] of schema.indexes) {
      if (!store.indexNames.contains(name)) {
        store.createIndex(name, keyPath);
      }
    }
  }
}

// 版本迁移步骤注册表：key 为目标版本号，value 为迁移函数（入参 { db, tx }）
// v1 为初始结构；v2 修复旧版打开数据库时未建表却提交为 v1 的存量数据库
const HG_MIGRATION_STEPS = {
  1: ({ db, tx }) => {
    hgEnsureSchema(db, tx);
  },
  2: ({ db, tx }) => {
    hgEnsureSchema(db, tx);
  }
};

// 执行从 oldVersion 到 newVersion 的全部迁移步骤，任一步失败即抛出统一异常
export function hgRunMigrations(db, tx, oldVersion, newVersion) {
  try {
    if (!Number.isInteger(oldVersion) || oldVersion < 0 ||
        !Number.isInteger(newVersion) || newVersion <= oldVersion) {
      throw new Error("数据库升级版本号无效");
    }

    // 全新环境 oldVersion 为 0，从版本 1 开始依次执行
    for (let version = Math.max(oldVersion, 0) + 1; version <= newVersion; version += 1) {
      const step = HG_MIGRATION_STEPS[version];

      if (!step) {
        throw new Error(`缺少版本 ${version} 的迁移步骤`);
      }

      step({ db, tx });
    }
  } catch (error) {
    throw hgWrapDatabaseError(
      error,
      HG_DB_ERROR_CODES.VERSION_MIGRATION_FAILED,
      `本地数据库从版本 ${oldVersion} 升级到 ${newVersion} 失败`
    );
  }
}
