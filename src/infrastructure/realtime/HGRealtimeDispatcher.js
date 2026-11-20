/**
 * 实时事件分发器
 * 职责：按 event_type 将 WebSocket 事件写入对应的本地表（验证码通知 / 聊天消息 / 系统通知等）。
 * 关键约束：
 * 1. userId 必须由认证模块提供，不能信任消息体自行声明的用户身份；
 * 2. 分发器只做入库，不做业务鉴权；权限、订单状态等以 Go 后端为准；
 * 3. 生产环境还需校验事件结构、数据长度与协议版本。
 */

import { hgNotificationRepository } from "../../modules/notification/HGNotificationRepository";
import { hgMessageRepository } from "../../modules/chat/HGMessageRepository";

// 将一条实时事件写入本地数据库；与当前用户无关的事件直接丢弃
export async function hgDispatchRealtimeEvent(event, userId) {
  if (!event || event.user_id !== userId) {
    return;
  }

  switch (event.event_type) {
    case "verification.received":
      // 验证码通知：只保存脱敏元数据，不持久化明文验证码
      await hgNotificationRepository.saveVerification(event.payload, userId);
      break;

    case "chat.message":
      // 聊天消息：put 幂等覆盖，重复推送不会产生重复记录
      await hgMessageRepository.save(event.payload, userId);
      break;

    case "notification.created":
      // 系统通知 / 订单通知
      await hgNotificationRepository.saveNotification(event.payload, userId);
      break;

    default:
      // 未注册的事件类型仅记录，不中断消息循环
      console.debug("[HGRealtimeDispatcher] 未处理的事件类型", event.event_type);
  }
}
