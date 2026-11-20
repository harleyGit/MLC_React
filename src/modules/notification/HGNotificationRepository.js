/**
 * 消息中心仓库
 * 职责：notification_messages（系统通知）与 verification_messages（验证码通知）两张表的读写。
 * 关键约束：
 * 1. 验证码只保存脱敏通知元数据，明文验证码仅在内存短暂展示，禁止持久化；
 * 2. 过期验证码通过 expires_at 索引清理，避免全表扫描。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";

class HGNotificationRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.NOTIFICATIONS);
    // 验证码通知使用独立表，通过内部仓库实例访问
    this.verificationStore = new HGBaseRepository(HG_STORES.VERIFICATIONS);
  }

  // ---- 系统通知 ----

  // 写入系统通知（幂等覆盖），写入后广播变更
  async saveNotification(payload, userId) {
    if (!userId || !payload?.notification_id) {
      throw new Error("保存系统通知需要 userId 与 notification_id");
    }

    const record = await this.put({
      title: "",
      content: "",
      created_at: Date.now(),
      read_at: null,
      status: "unread",
      ...payload,
      user_id: userId
    });

    hgLocalDataService.notifyChange(HG_STORES.NOTIFICATIONS);
    return record;
  }

  // 按创建时间正序读取用户全部系统通知
  async getNotifications(userId) {
    return this.getAllByIndex(
      "user_created",
      IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER])
    );
  }

  // 标记系统通知已读
  async markNotificationRead(userId, notificationId) {
    const record = await this.get([userId, notificationId]);
    if (!record) return null;

    const updated = await this.put({
      ...record,
      read_at: Date.now(),
      status: "read"
    });

    hgLocalDataService.notifyChange(HG_STORES.NOTIFICATIONS, { broadcast: false });
    return updated;
  }

  // ---- 验证码通知 ----

  // 写入验证码通知（仅脱敏元数据，不含明文验证码）
  async saveVerification(payload, userId) {
    if (!userId || !payload?.message_id) {
      throw new Error("验证码通知缺少必要标识");
    }

    const record = await this.verificationStore.put({
      user_id: userId,
      message_id: payload.message_id,
      channel: "websocket",
      purpose: payload.purpose,
      display_text: payload.display_text,
      received_at: Date.now(),
      expires_at: payload.expires_at,
      read_at: null,
      status: "received"
    });

    hgLocalDataService.notifyChange(HG_STORES.VERIFICATIONS);
    return record;
  }

  // 读取用户全部验证码通知记录（按接收时间正序）
  async getVerifications(userId) {
    return this.verificationStore.getAllByIndex(
      "user_received",
      IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER])
    );
  }

  // 标记验证码通知已读
  async markVerificationRead(userId, messageId) {
    const record = await this.verificationStore.get([userId, messageId]);
    if (!record) return null;

    return this.verificationStore.put({
      ...record,
      read_at: Date.now(),
      status: "read"
    });
  }

  // 清理已过期验证码通知，按 expires_at 索引扫描删除
  async deleteExpiredVerifications(now = Date.now()) {
    let deletedCount = 0;

    await this.verificationStore.execute("readwrite", (store) => {
      const request = store.index("expires_at").openCursor(IDBKeyRange.upperBound(now));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          deletedCount += 1;
          cursor.delete();
          cursor.continue();
        }
      };

      return request;
    });

    if (deletedCount > 0) {
      hgLocalDataService.notifyChange(HG_STORES.VERIFICATIONS, { broadcast: false });
    }

    return deletedCount;
  }
}

export const hgNotificationRepository = new HGNotificationRepository();
