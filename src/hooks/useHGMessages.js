/**
 * 聊天消息 Hook
 * 职责：按会话从本地库分页读取消息（新消息在前）并订阅变更，支持向前翻页。
 * 边界：只负责本地库分页与订阅；消息发送、服务端确认与增量同步由
 *       HGMessageRepository + HGSyncEngine + WebSocket 链路处理。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { hgMessageRepository } from "../modules/chat/HGMessageRepository";
import { HG_STORES } from "../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../infrastructure/storage/HGLocalDataService";

// 单页消息数量：基于索引游标分页，避免大会话一次性加载全部记录
const HG_MESSAGE_PAGE_SIZE = 30;

export function useHGMessages(userId, conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // 游标：当前已加载最早一条消息的 created_at，用于向前翻页
  const oldestCursorRef = useRef(null);

  // 加载一页消息；reset 为 true 时从头读取（首次加载 / 收到新消息）
  const loadPage = useCallback(async ({ reset = false } = {}) => {
    if (!userId || !conversationId) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    try {
      const beforeCreatedAt = reset ? null : oldestCursorRef.current;
      const page = await hgMessageRepository.pageByConversation(userId, conversationId, {
        beforeCreatedAt,
        limit: HG_MESSAGE_PAGE_SIZE
      });

      setMessages((prev) => (reset ? page.items : [...page.items, ...prev]));
      oldestCursorRef.current = page.items.length
        ? page.items[page.items.length - 1].created_at
        : null;
      setHasMore(page.hasMore);
    } finally {
      setLoading(false);
    }
  }, [userId, conversationId]);

  useEffect(() => {
    oldestCursorRef.current = null;
    loadPage({ reset: true });

    // 收到新消息（WebSocket 入库 / 增量同步 / 其他标签页广播）后从头刷新
    // 头部场景数据量可控；若后续出现长会话重绘压力，再改为合并通知的增量插入
    const unsubscribe = hgLocalDataService.subscribe(HG_STORES.MESSAGES, () => {
      loadPage({ reset: true });
    });
    return unsubscribe;
  }, [loadPage]);

  return {
    messages,
    loading,
    hasMore,
    loadMore: () => loadPage({ reset: false }),
    reload: () => loadPage({ reset: true })
  };
}
