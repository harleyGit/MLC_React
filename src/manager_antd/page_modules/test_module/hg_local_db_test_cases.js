/**
 * 本地数据库存储系统浏览器端测试用例集。
 * 职责：针对 src/infrastructure 与 src/modules 的本地存储能力编写可执行的测试用例，
 *       在真实浏览器 IndexedDB 环境中逐项运行并回传结果。
 * 边界：
 * 1. 用例按数组顺序执行，第 2 项会删除并重建 MLC_CLIENT_DB，必须全量运行保证前置干净；
 * 2. 全部数据使用专属测试账号，运行结束由「清空用户数据」用例统一回收；
 * 3. WebSocket 用例使用 Mock 替身，不建立真实网络连接。
 */

import {
  hgOpenDatabase,
  hgCloseDatabase,
  hgIsDatabaseSupported
} from "../../../infrastructure/database/HGDatabase";
import {
  HG_DB_NAME,
  HG_DB_VERSION,
  HG_STORES,
  HG_SCHEMA
} from "../../../infrastructure/database/HGDatabaseSchema";
import { HGBaseRepository } from "../../../infrastructure/database/HGBaseRepository";
import { HG_DB_ERROR_CODES } from "../../../infrastructure/database/HGDatabaseError";
import { hgLocalDataService } from "../../../infrastructure/storage/HGLocalDataService";
import { HG_CACHE_POLICIES, hgIsRecordFresh } from "../../../infrastructure/storage/HGCachePolicy";
import {
  hgClearExpiredVerifications,
  hgClearUserData,
  hgEstimateStorageUsage
} from "../../../infrastructure/storage/HGStorageCleanup";
import { hgUserRepository } from "../../../modules/user/HGUserRepository";
import { hgPreferencesRepository } from "../../../modules/preferences/HGPreferencesRepository";
import { hgMessageRepository } from "../../../modules/chat/HGMessageRepository";
import { hgNotificationRepository } from "../../../modules/notification/HGNotificationRepository";
import { hgProductRepository } from "../../../modules/mall/HGProductRepository";
import { hgOpsRepository } from "../../../modules/ops/HGOpsRepository";
import { hgSyncCursorRepository } from "../../../infrastructure/sync/HGSyncCursorRepository";
import { hgSyncEngine, hgRegisterSyncDomain } from "../../../infrastructure/sync/HGSyncEngine";
import { HGWebSocketClient } from "../../../infrastructure/realtime/HGWebSocketClient";
import { hgDispatchRealtimeEvent } from "../../../infrastructure/realtime/HGRealtimeDispatcher";

// 专属测试账号：与其他账号数据隔离，便于统一清理
const HG_TEST_USER = "hgid_db_test_user";
const HG_TEST_OTHER_USER = "hgid_db_test_other";

// ---- 断言工具 ----

function hgAssert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hgAssertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

// 断言 Promise 拒绝；expectedCode 传 null 时只要求拒绝、不校验错误码
async function hgAssertRejects(promise, expectedCode, message) {
  let rejected = false;
  try {
    await promise;
  } catch (error) {
    rejected = true;
    if (expectedCode && error?.code !== expectedCode) {
      throw new Error(`${message}：期望错误码 ${expectedCode}，实际 ${error?.code || error?.message || error}`);
    }
  }
  if (!rejected) {
    throw new Error(`${message}：期望抛出异常，但操作实际成功`);
  }
}

const hgSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 删除整个测试数据库（用例 2 与页面「清空本地数据库」按钮共用）
function hgDeleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(HG_DB_NAME);
    const timer = setTimeout(() => reject(new Error("删除数据库超时，可能被其他标签页占用")), 5000);

    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error || new Error("删除数据库失败"));
    };
    // onblocked：等待其他连接释放，由超时兜底
  });
}

// ---- 用例集合 ----

export const HG_LOCAL_DB_TEST_CASES = [
  // ===== 数据库核心 =====
  {
    key: "env_support",
    group: "数据库核心",
    name: "环境检查：IndexedDB 可用且可查询存储用量",
    async run() {
      hgAssert(hgIsDatabaseSupported(), "当前环境不支持 IndexedDB");
      const usage = await hgEstimateStorageUsage();
      // 部分浏览器不支持 estimate，允许为 null；支持时必须返回数值
      if (usage) {
        hgAssert(usage.quota >= 0, "存储配额应不小于 0");
        hgAssert(usage.usage >= 0, "已用空间应不小于 0");
      }
    }
  },
  {
    key: "fresh_create",
    group: "数据库核心",
    name: "全新建库：删除旧库后按 Schema 创建全部表与索引",
    async run() {
      // 关闭旧连接后整库删除，保证本次运行从干净状态开始（等效全新升级 v0 → 当前版本）
      await hgCloseDatabase();
      await hgDeleteTestDatabase();

      const db = await hgOpenDatabase();
      hgAssertEqual(db.version, HG_DB_VERSION, "数据库版本号不符");

      // Schema 声明的每张表都必须存在
      for (const schema of HG_SCHEMA) {
        hgAssert(
          db.objectStoreNames.contains(schema.name),
          `缺少 Object Store: ${schema.name}`
        );
      }
      hgAssertEqual(db.objectStoreNames.length, HG_SCHEMA.length, "表数量与 Schema 不符");

      // 抽查关键索引
      const tx = db.transaction([HG_STORES.MESSAGES, HG_STORES.VERIFICATIONS, HG_STORES.CURSORS], "readonly");
      hgAssert(tx.objectStore(HG_STORES.MESSAGES).indexNames.contains("conversation_time"), "im_messages 缺少 conversation_time 索引");
      hgAssert(tx.objectStore(HG_STORES.MESSAGES).indexNames.contains("conversation_seq"), "im_messages 缺少 conversation_seq 索引");
      hgAssert(tx.objectStore(HG_STORES.VERIFICATIONS).indexNames.contains("expires_at"), "verification_messages 缺少 expires_at 索引");
    }
  },
  {
    key: "crud_compound_key",
    group: "数据库核心",
    name: "基础读写：复合主键的 put / get / delete",
    async run() {
      const repo = new HGBaseRepository(HG_STORES.PREFERENCES);
      const key = [HG_TEST_USER, "probe"];

      const putResult = await repo.put({ user_id: HG_TEST_USER, key: "probe", value: 1 });
      hgAssertEqual(JSON.stringify(putResult), JSON.stringify([HG_TEST_USER, "probe"]), "put 应返回复合主键");

      const record = await repo.get(key);
      hgAssertEqual(record?.value, 1, "get 应读到刚写入的值");

      await repo.delete(key);
      const removed = await repo.get(key);
      hgAssertEqual(removed, undefined, "delete 后记录应不存在");
    }
  },
  {
    key: "upsert_override",
    group: "数据库核心",
    name: "幂等写入：put 覆盖式更新（upsert）不产生重复记录",
    async run() {
      const repo = new HGBaseRepository(HG_STORES.PREFERENCES);

      await repo.put({ user_id: HG_TEST_USER, key: "upsert_probe", value: "v1", updated_at: 1 });
      await repo.put({ user_id: HG_TEST_USER, key: "upsert_probe", value: "v2", updated_at: 2 });

      const records = await repo.getAllByIndex("user_id", HG_TEST_USER);
      const matched = records.filter((item) => item.key === "upsert_probe");
      hgAssertEqual(matched.length, 1, "相同复合主键的两次 put 应只保留一条记录");
      hgAssertEqual(matched[0]?.value, "v2", "第二次 put 应覆盖第一次的值");
    }
  },
  {
    key: "add_conflict",
    group: "数据库核心",
    name: "仅插入：add 遇到重复主键必须报错",
    async run() {
      const repo = new HGBaseRepository(HG_STORES.SETTINGS);

      await repo.put({ key: "hg_test_add", value: 1 });
      // add 是纯插入语义，主键已存在时事务必须失败
      await hgAssertRejects(
        repo.add({ key: "hg_test_add", value: 2 }),
        null,
        "重复主键的 add 应被拒绝"
      );
    }
  },
  {
    key: "index_query",
    group: "数据库核心",
    name: "索引查询：getAllByIndex 按用户隔离取数",
    async run() {
      const repo = new HGBaseRepository(HG_STORES.PREFERENCES);
      await repo.put({ user_id: HG_TEST_USER, key: "idx_a", value: 1 });
      await repo.put({ user_id: HG_TEST_USER, key: "idx_b", value: 2 });
      await repo.put({ user_id: HG_TEST_OTHER_USER, key: "idx_a", value: 99 });

      const mine = await repo.getAllByIndex("user_id", HG_TEST_USER);
      hgAssert(mine.every((item) => item.user_id === HG_TEST_USER), "按 user_id 索引查询不应混入其他账号数据");
      hgAssert(mine.some((item) => item.key === "idx_a"), "索引查询应包含 idx_a");
      hgAssert(mine.some((item) => item.key === "idx_b"), "索引查询应包含 idx_b");

      const other = await repo.getAllByIndex("user_id", HG_TEST_OTHER_USER);
      hgAssertEqual(other.length, 1, "其他账号应只有一条记录");
    }
  },
  {
    key: "cursor_pagination",
    group: "数据库核心",
    name: "游标分页：getPageByIndex 正序/倒序取页与参数校验",
    async run() {
      const repo = new HGBaseRepository(HG_STORES.MESSAGES);

      // 预置 45 条消息，created_at 从 1001 递增
      for (let i = 1; i <= 45; i += 1) {
        await repo.put({
          user_id: HG_TEST_USER,
          message_id: `pg_${i}`,
          conversation_id: "conv_page",
          message_type: "text",
          content: { text: `消息 ${i}` },
          server_seq: i,
          created_at: 1000 + i,
          status: "sent"
        });
      }

      const range = IDBKeyRange.bound(
        [HG_TEST_USER, "conv_page", 0],
        [HG_TEST_USER, "conv_page", Number.MAX_SAFE_INTEGER]
      );

      const page = await repo.getPageByIndex("conversation_time", range, { direction: "next", limit: 10 });
      hgAssertEqual(page.length, 10, "正序第一页应返回 10 条");
      hgAssertEqual(page[0]?.created_at, 1001, "正序分页应从最早的消息开始");

      const lastPage = await repo.getPageByIndex("conversation_time", range, { direction: "prev", limit: 10 });
      hgAssertEqual(lastPage[0]?.created_at, 1045, "倒序分页应从最新的消息开始");

      // 非法参数必须直接拒绝，不允许零限制游标全表扫描
      await hgAssertRejects(
        repo.getPageByIndex("conversation_time", range, { limit: 0 }),
        HG_DB_ERROR_CODES.INVALID_ARGUMENT,
        "limit=0 应被拒绝"
      );
      await hgAssertRejects(
        repo.getPageByIndex("conversation_time", range, { limit: 501 }),
        HG_DB_ERROR_CODES.INVALID_ARGUMENT,
        "limit=501 应被拒绝"
      );
      await hgAssertRejects(
        repo.getPageByIndex("conversation_time", range, { direction: "bogus" }),
        HG_DB_ERROR_CODES.INVALID_ARGUMENT,
        "非法 direction 应被拒绝"
      );
    }
  },
  {
    key: "store_not_found",
    group: "数据库核心",
    name: "错误包装：访问不存在的表返回 STORE_NOT_FOUND",
    async run() {
      const repo = new HGBaseRepository("hg_no_such_store");
      await hgAssertRejects(
        repo.get("anything"),
        HG_DB_ERROR_CODES.STORE_NOT_FOUND,
        "不存在的表应返回 STORE_NOT_FOUND"
      );
    }
  },
  {
    key: "close_reopen",
    group: "数据库核心",
    name: "连接管理：hgCloseDatabase 后可重新打开并正常读写",
    async run() {
      await hgCloseDatabase();
      const db = await hgOpenDatabase();
      hgAssertEqual(db.version, HG_DB_VERSION, "重新打开后版本应保持一致");

      const repo = new HGBaseRepository(HG_STORES.PREFERENCES);
      const record = await repo.get([HG_TEST_USER, "idx_a"]);
      hgAssertEqual(record?.value, 1, "重开后应能读到关闭前的数据");
    }
  },

  // ===== 数据服务与策略 =====
  {
    key: "data_service",
    group: "数据服务",
    name: "变更通知：订阅/退订 + 内存缓存 TTL 过期与账号切换清空",
    async run() {
      // 订阅与退订
      let notified = 0;
      const listener = () => {
        notified += 1;
      };
      const unsubscribe = hgLocalDataService.subscribe(HG_STORES.MESSAGES, listener);

      hgLocalDataService.notifyChange(HG_STORES.MESSAGES, { broadcast: false });
      hgAssertEqual(notified, 1, "订阅后通知应到达监听器");

      unsubscribe();
      hgLocalDataService.notifyChange(HG_STORES.MESSAGES, { broadcast: false });
      hgAssertEqual(notified, 1, "退订后不应再收到通知");

      // 内存缓存 TTL 过期
      hgLocalDataService.setMemoryCache("hg_test_cache", { value: 1 }, 50);
      hgAssertEqual(hgLocalDataService.getMemoryCache("hg_test_cache")?.value, 1, "未过期缓存应可读取");
      await hgSleep(80);
      hgAssertEqual(hgLocalDataService.getMemoryCache("hg_test_cache"), undefined, "过期缓存应返回空");

      // 账号切换清空缓存
      hgLocalDataService.setMemoryCache("hg_test_cache", { value: 2 }, 0);
      hgAssert(hgLocalDataService.getMemoryCache("hg_test_cache") !== undefined, "无 TTL 缓存应一直有效");
      hgLocalDataService.setCurrentUserId(HG_TEST_USER);
      hgAssertEqual(hgLocalDataService.getMemoryCache("hg_test_cache"), undefined, "切换账号后内存缓存应清空");
    }
  },
  {
    key: "cache_policy",
    group: "数据服务",
    name: "缓存策略：TTL 新鲜度判断与各表策略配置",
    async run() {
      hgAssertEqual(HG_CACHE_POLICIES[HG_STORES.PRODUCTS].ttlMs, 5 * 60 * 1000, "商品表 TTL 应为 5 分钟");
      hgAssertEqual(HG_CACHE_POLICIES[HG_STORES.ORDERS].strategy, "server_first", "订单表应为服务端优先策略");

      hgAssert(hgIsRecordFresh({ cached_at: Date.now() }, HG_STORES.PRODUCTS), "刚缓存的商品记录应判定新鲜");
      hgAssert(
        !hgIsRecordFresh({ cached_at: Date.now() - 6 * 60 * 1000 }, HG_STORES.PRODUCTS),
        "超过 5 分钟的商品缓存应判定过期"
      );
      // TTL 为 0 的表不按时间过期
      hgAssert(hgIsRecordFresh({ updated_at: 1 }, HG_STORES.PREFERENCES), "local_first 表不受 TTL 限制");
      hgAssert(!hgIsRecordFresh(null, HG_STORES.PRODUCTS), "空记录应判定不新鲜");
    }
  },

  // ===== 同步引擎 =====
  {
    key: "sync_cursor",
    group: "同步引擎",
    name: "同步游标：setCursor / getCursor / 重复覆盖",
    async run() {
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "im"), null, "未同步过的域游标应为 null");

      await hgSyncCursorRepository.setCursor(HG_TEST_USER, "im", "100");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "im"), "100", "游标写入后应可读取");

      await hgSyncCursorRepository.setCursor(HG_TEST_USER, "im", "200");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "im"), "200", "重复写入应覆盖旧游标");

      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "mall"), null, "不同业务域游标应相互独立");
    }
  },
  {
    key: "sync_engine",
    group: "同步引擎",
    name: "同步引擎：分页拉取、幂等写入与游标原子推进",
    async run() {
      const calls = [];
      hgRegisterSyncDomain("engine_test", {
        storeName: HG_STORES.SETTINGS,
        fetchPage: async (cursor, limit) => {
          calls.push({ cursor, limit });
          if (cursor === null) {
            return { items: [{ key: "eng_1", value: 1 }, { key: "eng_2", value: 2 }], next_cursor: "c1", has_more: true };
          }
          return { items: [{ key: "eng_3", value: 3 }], next_cursor: "c2", has_more: false };
        }
      });

      await hgSyncEngine.syncDomain(HG_TEST_USER, "engine_test");

      // 分页行为：从 null 游标开始，第二页使用第一页返回的 next_cursor
      hgAssertEqual(calls.length, 2, "两页数据应产生两次拉取");
      hgAssertEqual(calls[0].cursor, null, "首次拉取应使用 null 游标");
      hgAssertEqual(calls[1].cursor, "c1", "第二页应使用第一页的 next_cursor");

      // 数据与游标原子落库
      const settings = new HGBaseRepository(HG_STORES.SETTINGS);
      hgAssertEqual((await settings.get("eng_1"))?.value, 1, "第一页数据应写入本地库");
      hgAssertEqual((await settings.get("eng_3"))?.value, 3, "第二页数据应写入本地库");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "engine_test"), "c2", "游标应推进到最后一页的 next_cursor");

      // 幂等：重复同步不产生副作用，游标稳定
      await hgSyncEngine.syncDomain(HG_TEST_USER, "engine_test");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "engine_test"), "c2", "重复同步后游标不应回退");
      hgAssertEqual((await settings.get("eng_3"))?.value, 3, "重复同步后数据应保持正确");
    }
  },

  // ===== 业务仓库 =====
  {
    key: "user_repo",
    group: "业务仓库",
    name: "用户仓库：saveProfile 自动补 cached_at，读写删完整链路",
    async run() {
      await hgUserRepository.saveProfile({
        user_id: HG_TEST_USER,
        nickname: "测试用户",
        avatar_url: "",
        updated_at: Date.now()
      });

      const profile = await hgUserRepository.getProfile(HG_TEST_USER);
      hgAssertEqual(profile?.nickname, "测试用户", "资料应写入并读回");
      hgAssert(profile.cached_at > 0, "saveProfile 应自动补 cached_at");

      await hgAssertRejects(
        hgUserRepository.saveProfile({ nickname: "缺少ID" }),
        null,
        "缺少 user_id 的保存应被拒绝"
      );

      await hgUserRepository.removeProfile(HG_TEST_USER);
      hgAssertEqual(await hgUserRepository.getProfile(HG_TEST_USER), undefined, "删除后资料应不存在");
    }
  },
  {
    key: "preferences_repo",
    group: "业务仓库",
    name: "偏好仓库：KV 读写、批量读取与同步状态标记",
    async run() {
      await hgPreferencesRepository.setPreference(HG_TEST_USER, "theme", "dark");
      await hgPreferencesRepository.setPreference(HG_TEST_USER, "chat", { fontSize: 16, enterToSend: true });

      hgAssertEqual(await hgPreferencesRepository.getPreference(HG_TEST_USER, "theme"), "dark", "单个偏好应可读回");

      const all = await hgPreferencesRepository.getPreferences(HG_TEST_USER);
      hgAssertEqual(all.theme, "dark", "批量读取应包含 theme");
      hgAssertEqual(all.chat?.fontSize, 16, "对象型偏好应结构完整");

      // 同步状态：新写入为 local，标记后转为 synced
      const pending = await hgPreferencesRepository.getPendingSync(HG_TEST_USER);
      hgAssert(pending.some((item) => item.key === "theme"), "未同步的偏好应出现在待同步列表");

      await hgPreferencesRepository.markSynced(HG_TEST_USER, "theme");
      const after = await hgPreferencesRepository.getPendingSync(HG_TEST_USER);
      hgAssert(!after.some((item) => item.key === "theme"), "已同步的偏好不应再出现在待同步列表");
    }
  },
  {
    key: "message_repo",
    group: "业务仓库",
    name: "消息仓库：幂等去重、状态更新与按会话倒序分页",
    async run() {
      // 同一 message_id 重复推送只保留一条，内容以最后一次为准
      await hgMessageRepository.save({ message_id: "m1", conversation_id: "dedupe_conv", content: { text: "text1" }, created_at: 100 }, HG_TEST_USER);
      await hgMessageRepository.save({ message_id: "m1", conversation_id: "dedupe_conv", content: { text: "text2" }, created_at: 100 }, HG_TEST_USER);
      const deduped = await hgMessageRepository.pageByConversation(HG_TEST_USER, "dedupe_conv");
      hgAssertEqual(deduped.items.length, 1, "相同 message_id 重复推送应去重");
      hgAssertEqual(deduped.items[0]?.content?.text, "text2", "重复推送应以最新内容覆盖");

      // 状态更新
      const updated = await hgMessageRepository.updateStatus(HG_TEST_USER, "m1", "read");
      hgAssertEqual(updated?.status, "read", "消息状态应可更新");

      // 倒序分页与 hasMore
      await hgMessageRepository.save({ message_id: "m2", conversation_id: "dedupe_conv", content: { text: "第二条" }, created_at: 200 }, HG_TEST_USER);
      await hgMessageRepository.save({ message_id: "m3", conversation_id: "dedupe_conv", content: { text: "第三条" }, created_at: 300 }, HG_TEST_USER);

      const page = await hgMessageRepository.pageByConversation(HG_TEST_USER, "dedupe_conv", { limit: 2 });
      hgAssertEqual(page.items.length, 2, "分页应受 limit 限制");
      hgAssertEqual(page.items[0]?.message_id, "m3", "分页应从最新消息开始（倒序）");
      hgAssertEqual(page.hasMore, true, "还有剩余数据时 hasMore 应为 true");

      // 游标翻页：以本页最早一条的 created_at 继续向前取
      const nextPage = await hgMessageRepository.pageByConversation(HG_TEST_USER, "dedupe_conv", {
        beforeCreatedAt: page.items[page.items.length - 1].created_at,
        limit: 2
      });
      hgAssertEqual(nextPage.items[0]?.message_id, "m1", "翻页应接续上一页更早的消息");
      hgAssertEqual(nextPage.hasMore, false, "数据取尽后 hasMore 应为 false");
    }
  },
  {
    key: "notification_repo",
    group: "业务仓库",
    name: "消息中心：系统通知读写已读 + 验证码通知脱敏存储",
    async run() {
      // 系统通知
      await hgNotificationRepository.saveNotification(
        { notification_id: "n1", title: "系统通知", content: "内容" },
        HG_TEST_USER
      );
      const list = await hgNotificationRepository.getNotifications(HG_TEST_USER);
      const saved = list.find((item) => item.notification_id === "n1");
      hgAssert(saved, "系统通知应写入并读回");
      hgAssertEqual(saved?.status, "unread", "新通知应为未读状态");

      const marked = await hgNotificationRepository.markNotificationRead(HG_TEST_USER, "n1");
      hgAssertEqual(marked?.status, "read", "标记已读后状态应更新");
      hgAssert(marked?.read_at > 0, "标记已读应记录 read_at");

      // 验证码通知（仅脱敏元数据）
      await hgNotificationRepository.saveVerification(
        { message_id: "v1", purpose: "login", display_text: "您收到一条登录验证码通知", expires_at: Date.now() + 60000 },
        HG_TEST_USER
      );
      const verifications = await hgNotificationRepository.getVerifications(HG_TEST_USER);
      const verification = verifications.find((item) => item.message_id === "v1");
      hgAssert(verification, "验证码通知应写入并读回");
      hgAssertEqual(verification?.channel, "websocket", "验证码通知应记录来源通道");
      hgAssertEqual(verification?.status, "received", "验证码通知初始应为 received");

      const markedVerification = await hgNotificationRepository.markVerificationRead(HG_TEST_USER, "v1");
      hgAssertEqual(markedVerification?.status, "read", "验证码通知应可标记已读");
    }
  },
  {
    key: "product_repo",
    group: "业务仓库",
    name: "商品仓库：批量缓存、TTL 新鲜度与清空",
    async run() {
      await hgProductRepository.saveProducts([
        { product_id: "p1", title: "商品A", price: 100 },
        { product_id: "p2", title: "商品B", price: 200 }
      ]);

      const product = await hgProductRepository.getProduct("p1");
      hgAssertEqual(product?.price, 100, "商品缓存应可读回");
      hgAssert(product.cached_at > 0, "批量保存应自动补 cached_at");

      hgAssert(await hgProductRepository.isCacheFresh("p1"), "刚缓存的商品应判定新鲜");

      await hgProductRepository.clearAll();
      hgAssertEqual((await hgProductRepository.getAllProducts()).length, 0, "清空后商品表应为空");
    }
  },
  {
    key: "ops_repo",
    group: "业务仓库",
    name: "运维仓库：任务摘要缓存与按用户列表读取",
    async run() {
      await hgOpsRepository.saveTasks(HG_TEST_USER, [
        { task_id: "op1", summary: "重启服务" },
        { task_id: "op2", summary: "清理日志" }
      ]);

      const tasks = await hgOpsRepository.listTasks(HG_TEST_USER);
      hgAssert(tasks.some((item) => item.task_id === "op1"), "任务列表应包含 op1");
      hgAssert(tasks.every((item) => item.user_id === HG_TEST_USER), "运维缓存不应混入其他账号数据");

      const task = await hgOpsRepository.getTask(HG_TEST_USER, "op2");
      hgAssertEqual(task?.summary, "清理日志", "单任务应可读取");
      hgAssert(hgOpsRepository.isTaskFresh(task), "刚缓存的任务应判定新鲜");

      await hgOpsRepository.clearAll();
    }
  },

  // ===== 实时链路 =====
  {
    key: "websocket_client",
    group: "实时链路",
    name: "WebSocket 客户端：消息解析、指数退避重连与代际隔离（Mock）",
    async run() {
      // Mock WebSocket：手动触发 open / message / close，不建立真实连接
      class HGMockWebSocket {
        constructor(url) {
          this.url = url;
          HGMockWebSocket.instances.push(this);
        }
        simulateOpen() {
          this.onopen?.({});
        }
        simulateMessage(payload) {
          this.onmessage?.({ data: JSON.stringify(payload) });
        }
        simulateClose() {
          this.onclose?.({});
        }
        close() {
          this.onclose?.({});
        }
      }
      HGMockWebSocket.instances = [];

      const received = [];
      let reconnectCount = 0;
      const client = new HGWebSocketClient({
        url: "ws://hg-test-mock",
        onMessage: (data) => received.push(data),
        onReconnect: () => {
          reconnectCount += 1;
        }
      });

      // 替换 WebSocket 与 setTimeout，捕获重连定时器而不真实等待
      const originalWebSocket = globalThis.WebSocket;
      const originalSetTimeout = globalThis.setTimeout;
      const scheduled = [];
      globalThis.WebSocket = HGMockWebSocket;
      globalThis.setTimeout = (fn, delay) => {
        // 返回负数假句柄，避免 clearTimeout 误清页面真实定时器
        scheduled.push({ fn, delay });
        return -(scheduled.length + Date.now());
      };

      try {
        client.connect();
        hgAssertEqual(HGMockWebSocket.instances.length, 1, "connect 应建立第一个连接");
        const firstSocket = HGMockWebSocket.instances[0];

        firstSocket.simulateOpen();
        hgAssertEqual(reconnectCount, 0, "首次连接成功不应触发 onReconnect");

        firstSocket.simulateMessage({ event_id: "e1" });
        hgAssertEqual(received.length, 1, "消息应解析后回传 onMessage");
        hgAssertEqual(received[0]?.event_id, "e1", "onMessage 应收到解析后的对象");

        // 断开后按指数退避安排重连（首次重试 1000ms）
        firstSocket.simulateClose();
        hgAssertEqual(scheduled.length, 1, "断开后应安排一次重连");
        hgAssertEqual(scheduled[0].delay, 1000, "首次重连退避应为 1000ms");

        // 触发重连：代际不变，建立第二个连接；重连成功后触发 onReconnect
        scheduled[0].fn();
        hgAssertEqual(HGMockWebSocket.instances.length, 2, "重连应建立第二个连接");
        HGMockWebSocket.instances[1].simulateOpen();
        hgAssertEqual(reconnectCount, 1, "重连成功应触发一次 onReconnect");

        // disconnect 后：代际递增，旧连接回调全部失效
        client.disconnect();
        const beforeClose = scheduled.length;
        HGMockWebSocket.instances[1].simulateClose();
        hgAssertEqual(scheduled.length, beforeClose, "disconnect 后不应再安排重连");
        HGMockWebSocket.instances[1].simulateMessage({ event_id: "e2" });
        hgAssertEqual(received.length, 1, "disconnect 后旧连接消息应被丢弃");
      } finally {
        globalThis.WebSocket = originalWebSocket;
        globalThis.setTimeout = originalSetTimeout;
        client.disconnect();
      }
    }
  },
  {
    key: "realtime_dispatcher",
    group: "实时链路",
    name: "实时分发：验证码/聊天/通知事件入库，无关用户事件被丢弃",
    async run() {
      const future = Date.now() + 60000;

      await hgDispatchRealtimeEvent(
        { event_type: "verification.received", user_id: HG_TEST_USER, payload: { message_id: "rt_v1", purpose: "bind", display_text: "绑定验证码通知", expires_at: future } },
        HG_TEST_USER
      );
      const verifications = await hgNotificationRepository.getVerifications(HG_TEST_USER);
      hgAssert(verifications.some((item) => item.message_id === "rt_v1"), "verification.received 事件应写入验证码表");

      await hgDispatchRealtimeEvent(
        { event_type: "chat.message", user_id: HG_TEST_USER, payload: { message_id: "rt_m1", conversation_id: "rt_conv", content: { text: "实时消息" }, created_at: 100 } },
        HG_TEST_USER
      );
      const messages = await hgMessageRepository.pageByConversation(HG_TEST_USER, "rt_conv");
      hgAssert(messages.items.some((item) => item.message_id === "rt_m1"), "chat.message 事件应写入消息表");

      await hgDispatchRealtimeEvent(
        { event_type: "notification.created", user_id: HG_TEST_USER, payload: { notification_id: "rt_n1", title: "实时通知", content: "" } },
        HG_TEST_USER
      );
      const notifications = await hgNotificationRepository.getNotifications(HG_TEST_USER);
      hgAssert(notifications.some((item) => item.notification_id === "rt_n1"), "notification.created 事件应写入通知表");

      // 事件体声明的用户与当前登录用户不一致时必须丢弃（防止跨账号注入）
      await hgDispatchRealtimeEvent(
        { event_type: "verification.received", user_id: HG_TEST_OTHER_USER, payload: { message_id: "rt_v2", purpose: "login", display_text: "", expires_at: future } },
        HG_TEST_USER
      );
      const otherVerifications = await hgNotificationRepository.getVerifications(HG_TEST_OTHER_USER);
      hgAssertEqual(otherVerifications.length, 0, "非当前用户的事件不应入库");
    }
  },

  // ===== 清理与隔离 =====
  {
    key: "expired_cleanup",
    group: "清理与隔离",
    name: "过期清理：按 expires_at 索引删除过期验证码，保留未过期",
    async run() {
      await hgNotificationRepository.saveVerification(
        { message_id: "v_expired", purpose: "login", display_text: "已过期", expires_at: Date.now() - 1000 },
        HG_TEST_USER
      );
      await hgNotificationRepository.saveVerification(
        { message_id: "v_alive", purpose: "login", display_text: "未过期", expires_at: Date.now() + 60000 },
        HG_TEST_USER
      );

      const deleted = await hgClearExpiredVerifications();
      hgAssert(deleted >= 1, "应至少删除一条过期验证码");

      const verifications = await hgNotificationRepository.getVerifications(HG_TEST_USER);
      hgAssert(!verifications.some((item) => item.message_id === "v_expired"), "过期验证码应被删除");
      hgAssert(verifications.some((item) => item.message_id === "v_alive"), "未过期验证码应保留");
    }
  },
  {
    key: "clear_user_data",
    group: "清理与隔离",
    name: "账号隔离：hgClearUserData 只清目标用户，其他账号数据完好",
    async run() {
      // 为两个账号各写入一批数据
      await hgUserRepository.saveProfile({ user_id: HG_TEST_USER, nickname: "待清理用户", updated_at: Date.now() });
      await hgUserRepository.saveProfile({ user_id: HG_TEST_OTHER_USER, nickname: "保留用户", updated_at: Date.now() });
      await hgPreferencesRepository.setPreference(HG_TEST_USER, "iso", 1);
      await hgPreferencesRepository.setPreference(HG_TEST_OTHER_USER, "iso", 2);
      await hgMessageRepository.save({ message_id: "iso_m1", conversation_id: "iso_conv", content: { text: "待清理" }, created_at: 100 }, HG_TEST_USER);
      await hgMessageRepository.save({ message_id: "iso_m2", conversation_id: "iso_conv", content: { text: "保留" }, created_at: 100 }, HG_TEST_OTHER_USER);
      await hgSyncCursorRepository.setCursor(HG_TEST_USER, "im", "1");
      await hgSyncCursorRepository.setCursor(HG_TEST_OTHER_USER, "im", "2");

      await hgClearUserData(HG_TEST_USER);

      // 目标用户数据全部清空
      hgAssertEqual(await hgUserRepository.getProfile(HG_TEST_USER), undefined, "目标用户资料应被清除");
      hgAssertEqual(await hgPreferencesRepository.getPreference(HG_TEST_USER, "iso"), undefined, "目标用户偏好应被清除");
      const clearedMessages = await hgMessageRepository.pageByConversation(HG_TEST_USER, "iso_conv");
      hgAssertEqual(clearedMessages.items.length, 0, "目标用户消息应被清除");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_USER, "im"), null, "目标用户同步游标应被清除");

      // 其他账号数据完好（账号隔离）
      const keptProfile = await hgUserRepository.getProfile(HG_TEST_OTHER_USER);
      hgAssertEqual(keptProfile?.nickname, "保留用户", "其他账号资料不应被误删");
      hgAssertEqual(await hgPreferencesRepository.getPreference(HG_TEST_OTHER_USER, "iso"), 2, "其他账号偏好不应被误删");
      const keptMessages = await hgMessageRepository.pageByConversation(HG_TEST_OTHER_USER, "iso_conv");
      hgAssertEqual(keptMessages.items.length, 1, "其他账号消息不应被误删");
      hgAssertEqual(await hgSyncCursorRepository.getCursor(HG_TEST_OTHER_USER, "im"), "2", "其他账号游标不应被误删");
    }
  }
];

// 按分组归并用例，保持原始顺序
export function hgGroupTestCases(cases) {
  const groups = [];
  const index = new Map();

  for (const testCase of cases) {
    if (!index.has(testCase.group)) {
      const group = { name: testCase.group, cases: [] };
      index.set(testCase.group, group);
      groups.push(group);
    }
    index.get(testCase.group).cases.push(testCase);
  }

  return groups;
}

export { HG_TEST_USER, HG_TEST_OTHER_USER, hgDeleteTestDatabase };
