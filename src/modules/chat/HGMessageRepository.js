/**
 * 聊天消息仓库
 * 职责：im_messages 表的读写，提供按会话的游标分页与消息状态管理。
 * 关键约束：
 * 1. 主键为 [user_id, message_id]，保证多账号数据隔离且 put 天然幂等去重；
 * 2. 大会话禁止 getAll，必须走 conversation_time 索引分页；
 * 3. 发送中的消息依赖 client_message_id 关联服务端确认。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";

class HGMessageRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.MESSAGES);
  }

  // 写入或更新消息（幂等：相同 message_id 覆盖），写入后广播变更
  async save(message, userId) {
    if (!userId || !message?.message_id) {
      throw new Error("保存聊天消息需要 userId 与 message_id");
    }

    const record = await this.put({
      message_type: "text",
      status: "sent",
      created_at: Date.now(),
      ...message,
      user_id: userId
    });

    hgLocalDataService.notifyChange(HG_STORES.MESSAGES);
    return record;
  }

  // 更新消息状态（sending / sent / failed / recalled）
  async updateStatus(userId, messageId, status) {
    const record = await this.get([userId, messageId]);
    if (!record) return null;

    const updated = await this.put({ ...record, status });
    hgLocalDataService.notifyChange(HG_STORES.MESSAGES, { broadcast: false });
    return updated;
  }

  // 按会话倒序分页读取（新消息在前），基于 conversation_time 索引游标翻页
  // beforeCreatedAt 传上一页最早一条消息的 created_at，实现向前翻页
  async pageByConversation(userId, conversationId, { beforeCreatedAt = null, limit = 30 } = {}) {
    if (!userId || !conversationId) {
      throw new Error("分页读取需要 userId 与 conversationId");
    }

    const upper = beforeCreatedAt ?? Number.MAX_SAFE_INTEGER;
    const range = IDBKeyRange.bound(
      [userId, conversationId, 0],
      [userId, conversationId, upper],
      false,
      beforeCreatedAt !== null
    );

    const items = await this.getPageByIndex("conversation_time", range, {
      direction: "prev",
      limit
    });

    return {
      items,
      hasMore: items.length === limit
    };
  }

  // 按会话序号分页读取（增量同步补拉场景），基于 conversation_seq 索引
  async pageBySeq(userId, conversationId, { afterSeq = 0, limit = 50 } = {}) {
    const range = IDBKeyRange.bound(
      [userId, conversationId, afterSeq],
      [userId, conversationId, Number.MAX_SAFE_INTEGER]
    );

    const items = await this.getPageByIndex("conversation_seq", range, {
      direction: "next",
      limit
    });

    return {
      items,
      hasMore: items.length === limit
    };
  }

  // 删除单条消息
  async removeMessage(userId, messageId) {
    const result = await this.delete([userId, messageId]);
    hgLocalDataService.notifyChange(HG_STORES.MESSAGES, { broadcast: false });
    return result;
  }
}

export const hgMessageRepository = new HGMessageRepository();
