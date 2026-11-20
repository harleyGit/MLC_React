/**
 * 本地数据库结构定义
 * 职责：声明数据库名称、版本号、全部 Object Store（表）及其主键与索引。
 * 关键约束：keyPath 相当于主键，indexes 相当于索引；
 *          已发布版本的 keyPath 不允许修改，索引变更需配合 HGDatabaseMigration 迁移步骤。
 */

// 版本 2 修复旧版首次打开时跳过建表留下的空库；已发布版本的结构不可直接改写
export const HG_DB_NAME = "MLC_CLIENT_DB";
export const HG_DB_VERSION = 2;

// Object Store 名称常量，业务模块统一从这里引用，避免散落魔法字符串
export const HG_STORES = {
  USERS: "user_profiles",
  PREFERENCES: "user_preferences",
  SESSIONS: "auth_sessions",
  VERIFICATIONS: "verification_messages",
  CONVERSATIONS: "im_conversations",
  MESSAGES: "im_messages",
  NOTIFICATIONS: "notification_messages",
  PRODUCTS: "mall_products",
  CART: "mall_cart",
  ORDERS: "mall_orders",
  OPS: "ops_task_cache",
  CURSORS: "sync_cursors",
  SETTINGS: "client_settings"
};

// 全部表结构：keyPath 为复合数组时类似 SQL 的联合主键（如 PRIMARY KEY (user_id, message_id)）
export const HG_SCHEMA = [
  {
    name: HG_STORES.USERS,
    keyPath: "user_id",
    indexes: [
      ["updated_at", "updated_at"]
    ]
  },
  {
    name: HG_STORES.PREFERENCES,
    keyPath: ["user_id", "key"],
    indexes: [
      ["user_id", "user_id"]
    ]
  },
  {
    name: HG_STORES.SESSIONS,
    keyPath: "user_id",
    indexes: []
  },
  {
    name: HG_STORES.VERIFICATIONS,
    keyPath: ["user_id", "message_id"],
    indexes: [
      ["user_received", ["user_id", "received_at"]],
      ["expires_at", "expires_at"]
    ]
  },
  {
    name: HG_STORES.CONVERSATIONS,
    keyPath: ["user_id", "conversation_id"],
    indexes: [
      ["user_updated", ["user_id", "updated_at"]]
    ]
  },
  {
    name: HG_STORES.MESSAGES,
    keyPath: ["user_id", "message_id"],
    indexes: [
      ["conversation_time",
        ["user_id", "conversation_id", "created_at"]],
      ["conversation_seq",
        ["user_id", "conversation_id", "server_seq"]]
    ]
  },
  {
    name: HG_STORES.NOTIFICATIONS,
    keyPath: ["user_id", "notification_id"],
    indexes: [
      ["user_created", ["user_id", "created_at"]]
    ]
  },
  {
    name: HG_STORES.PRODUCTS,
    keyPath: "product_id",
    indexes: [
      ["cached_at", "cached_at"]
    ]
  },
  {
    name: HG_STORES.CART,
    keyPath: ["user_id", "sku_id"],
    indexes: [
      ["user_id", "user_id"]
    ]
  },
  {
    name: HG_STORES.ORDERS,
    keyPath: ["user_id", "order_id"],
    indexes: [
      ["user_created", ["user_id", "created_at"]]
    ]
  },
  {
    name: HG_STORES.OPS,
    keyPath: ["user_id", "task_id"],
    indexes: [
      ["user_updated", ["user_id", "updated_at"]]
    ]
  },
  {
    name: HG_STORES.CURSORS,
    keyPath: ["user_id", "domain"],
    indexes: []
  },
  {
    name: HG_STORES.SETTINGS,
    keyPath: "key",
    indexes: []
  }
];
