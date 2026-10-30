/*
 * @Description: 消息中心 ViewModel。集中管理分类枚举、接口契约、时间与分组格式化、未读汇总和本地示例数据装配。
 */
import { HGMANAGER_API } from "../../api/hg_api_constants";
import HGNet from "../../net_handle/hg_net_manager_vm";
import {
  HG_DEMO_CONVERSATIONS,
  HG_DEMO_MESSAGES,
  HG_DEMO_NOTIFICATIONS,
  HG_DEMO_PREFERENCES,
} from "./hg_message_center_fixtures.js";

/**
 * 数据源开关。
 * local：使用 fixtures 中的示例数据，仅本地状态变化，不请求服务端；
 * remote：按通知服务 / IM 服务 HTTP 契约读取真实数据。
 * 约束：切换为 remote 前必须确认后端已上线对应接口，否则请求层会弹出全局错误提示。
 */
export const MESSAGE_DATA_SOURCE = "local";

/** 单页拉取条数；与后端 pageSize 上限保持一致，避免一次拉全量。 */
export const MESSAGE_PAGE_SIZE = 8;

/** 私信视图的固定 key，与通知分类 key 共用左侧导航。 */
export const IM_VIEW_KEY = "im";

/** 当前登录用户在示例数据中的身份 ID，仅用于判断消息方向，真实环境由后端下发。 */
export const SELF_USER_ID = "u_self";

/**
 * 消息分类配置。
 * 约束：key 与后端 HGMessageCategory 枚举一一对应，新增分类必须由后端枚举驱动而非前端硬编码业务表名。
 */
export const MESSAGE_CATEGORIES = [
  { key: "system", label: "系统通知", icon: "bell", tone: "blue", desc: "账号安全、审核结果与平台公告" },
  { key: "comment", label: "回复我的", icon: "comment", tone: "green", desc: "评论、弹幕与商品问答的回复" },
  { key: "like", label: "收到的赞", icon: "like", tone: "pink", desc: "视频、评论与商品获得的点赞" },
  { key: "mention", label: "@我的", icon: "at", tone: "purple", desc: "在评论或动态中被提到" },
  { key: "follow", label: "新增粉丝", icon: "follow", tone: "orange", desc: "关注你的新粉丝" },
  { key: "trade", label: "交易通知", icon: "trade", tone: "cyan", desc: "订单、支付与物流进度" },
  { key: "wallet", label: "钱包", icon: "wallet", tone: "gold", desc: "充值、消费与 M币变动" },
];

/** 通知偏好中的渠道定义，标签与通知渠道中心使用同一套 channel code。 */
export const NOTIFY_CHANNEL_OPTIONS = [
  { key: "in_app", label: "站内信", desc: "持久化到消息中心" },
  { key: "sms", label: "短信", desc: "安全与交易类必达" },
  { key: "email", label: "邮件", desc: "汇总与对账单" },
  { key: "push", label: "移动推送", desc: "APNs / FCM" },
  { key: "realtime", label: "实时提醒", desc: "WebSocket 在线提醒" },
];

/** 偏好中的可选分类（系统与安全通知不允许关闭，故不在此列表内）。 */
export const PREFERENCE_CATEGORIES = [
  { key: "comment", label: "回复与评论" },
  { key: "like", label: "点赞与收藏" },
  { key: "mention", label: "@我的" },
  { key: "follow", label: "新增粉丝" },
  { key: "trade", label: "交易与物流" },
  { key: "wallet", label: "钱包变动" },
  { key: "marketing", label: "运营与营销" },
];

/** 摘要投递频率选项。 */
export const DIGEST_OPTIONS = [
  { value: "instant", label: "实时推送" },
  { value: "hourly", label: "每小时汇总" },
  { value: "daily", label: "每日汇总（20:00）" },
];

/** 分类色调到样式类名的映射，避免在 JSX 中拼接动态类名。 */
export const TONE_CLASS_MAP = {
  blue: "toneBlue",
  green: "toneGreen",
  pink: "tonePink",
  purple: "tonePurple",
  orange: "toneOrange",
  cyan: "toneCyan",
  gold: "toneGold",
};

/** 消息中心 ViewModel：接口、格式化与示例数据装配。 */
export default class HGMessageCenterVM {
  /** 是否走真实接口；页面据此决定错误提示与演示标记。 */
  static isRemote = () => MESSAGE_DATA_SOURCE === "remote";

  /* ===== 接口契约（与通知服务 / IM 服务对齐） ===== */

  /** 站内通知分页；cursor 由后端下发，前端不推导时间或主键边界。 */
  static fetchNotifications = ({ category, cursor = "", pageSize = MESSAGE_PAGE_SIZE, unreadOnly = false } = {}) =>
    HGNet.get(HGMANAGER_API.NOTIFICATION_LIST, {
      category: category || "",
      cursor,
      pageSize,
      unreadOnly: unreadOnly ? 1 : 0,
    });

  /** 各分类未读数；用于左侧导航角标与顶部汇总。 */
  static fetchUnreadSummary = () => HGNet.get(HGMANAGER_API.NOTIFICATION_UNREAD);

  /** 批量已读；只提交当前用户可见的 notificationId。 */
  static markRead = (notificationIds) =>
    HGNet.post(HGMANAGER_API.NOTIFICATION_READ, { notificationIds });

  /** 单分类全部已读。 */
  static markAllRead = (category) =>
    HGNet.post(HGMANAGER_API.NOTIFICATION_READ, { category, all: true });

  /** 用户级删除（不影响其他接收人）。 */
  static deleteNotification = (notificationId) =>
    HGNet.post(HGMANAGER_API.NOTIFICATION_DELETE, { notificationId });

  static fetchPreferences = () => HGNet.get(HGMANAGER_API.NOTIFICATION_PREFERENCES);

  static savePreferences = (preferences) => HGNet.put(HGMANAGER_API.NOTIFICATION_PREFERENCES, preferences);

  /** 会话列表；服务端按置顶、最后更新时间排序。 */
  static fetchConversations = () => HGNet.get(HGMANAGER_API.IM_CONVERSATIONS);

  /** 会话历史按 seq 游标向前翻页，禁止深度 offset。 */
  static fetchMessages = ({ conversationId, beforeSeq = 0, limit = 30 }) =>
    HGNet.get(HGMANAGER_API.IM_CONVERSATION_MESSAGES(conversationId), { beforeSeq, limit });

  /** 上报已读位置；lastReadSeq 单调递增，服务端只接受更大值。 */
  static reportRead = ({ conversationId, lastReadSeq }) =>
    HGNet.post(HGMANAGER_API.IM_CONVERSATION_READ(conversationId), { lastReadSeq });

  /** 发送私信：clientMsgId 负责幂等，sender 由服务端从登录态解析。 */
  static sendMessage = ({ conversationId, clientMsgId, messageType = "text", content }) =>
    HGNet.post(HGMANAGER_API.IM_SEND, { conversationId, clientMsgId, messageType, content });

  /* ===== 工具方法 ===== */

  /** 生成客户端幂等 ID；发送失败重试时复用同一个 ID，避免重复消息。 */
  static createClientMsgId = () => {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `cmsg_${random}`;
  };

  /** 按 key 取分类配置；未知 key 返回 null，由页面降级为中性展示。 */
  static getCategoryMeta = (key) => MESSAGE_CATEGORIES.find((item) => item.key === key) || null;

  /** 归一化单条通知，兼容后端可能的驼峰/下划线字段。 */
  static normalizeNotification = (raw = {}) => ({
    notificationId: raw.notificationId || raw.notification_id || "",
    category: raw.category || "system",
    actorNames: raw.actorNames || raw.actor_names || (raw.actorName ? [raw.actorName] : []),
    aggregateCount: Number(raw.aggregateCount || raw.aggregate_count || 1),
    title: raw.title || "",
    content: raw.content || "",
    quote: raw.quote || "",
    targetType: raw.targetType || raw.target_type || "",
    targetId: raw.targetId || raw.target_id || "",
    targetLabel: raw.targetLabel || raw.target_label || "",
    isRead: Boolean(raw.isRead ?? raw.is_read ?? false),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
  });

  /** 归一化会话；unreadCount 缺失时按 lastSeq 与 lastReadSeq 推导。 */
  static normalizeConversation = (raw = {}) => {
    const lastSeq = Number(raw.lastSeq ?? raw.last_seq ?? 0);
    const lastReadSeq = Number(raw.lastReadSeq ?? raw.last_read_seq ?? 0);
    return {
      conversationId: raw.conversationId || raw.conversation_id || "",
      type: Number(raw.type ?? 1),
      peer: raw.peer || { userId: raw.peerId || "", name: raw.peerName || "未知用户", subtitle: "", online: false },
      peerLastReadSeq: Number(raw.peerLastReadSeq ?? raw.peer_last_read_seq ?? 0),
      peerDeliveredSeq: Number(raw.peerDeliveredSeq ?? raw.peer_delivered_seq ?? 0),
      lastSeq,
      lastReadSeq,
      unreadCount: Number(raw.unreadCount ?? raw.unread_count ?? Math.max(lastSeq - lastReadSeq, 0)),
      isPinned: Boolean(raw.isPinned ?? raw.is_pinned ?? false),
      isMuted: Boolean(raw.isMuted ?? raw.is_muted ?? false),
      updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
      preview: raw.preview || "",
    };
  };

  /**
   * 归一化私信消息。
   * 约束：seq 由服务端分配，前端只排序与去重；本地追加的消息带 local 标记，不代表已落地。
   */
  static normalizeMessage = (raw = {}) => ({
    messageId: raw.messageId || raw.message_id || "",
    seq: Number(raw.seq || 0),
    senderId: raw.senderId || raw.sender_id || "",
    messageType: raw.messageType || raw.message_type || "text",
    content: raw.content || {},
    status: raw.status || "normal",
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    local: Boolean(raw.local),
  });

  /** 通过 seq 与对方已读/已送达位置推导回执状态：read > delivered > sent。 */
  static getReceiptStatus = (message, conversation) => {
    if (!message || !conversation) return "sent";
    if (conversation.peerLastReadSeq >= message.seq) return "read";
    if (conversation.peerDeliveredSeq >= message.seq) return "delivered";
    return "sent";
  };

  /** 回执状态文案。 */
  static getReceiptLabel = (status) => {
    if (status === "read") return "已读";
    if (status === "delivered") return "已送达";
    return "已发送";
  };

  /** 相对时间：刚刚 / N分钟前 / 今天 HH:mm / 昨天 HH:mm / M月D日 / YYYY-MM-DD。 */
  static formatRelativeTime = (iso, now = Date.now()) => {
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "--";
    const diff = now - time;
    if (diff < 60 * 1000) return "刚刚";
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;

    const date = new Date(time);
    const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const dayDiff = HGMessageCenterVM.getDayOffset(date, new Date(now));
    if (dayDiff === 0) return `今天 ${clock}`;
    if (dayDiff === 1) return `昨天 ${clock}`;
    if (date.getFullYear() === new Date(now).getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  /** 计算自然日偏移（今天 0，昨天 1），用于分组与“昨天”文案。 */
  static getDayOffset = (date, now) => {
    const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    return Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));
  };

  /** 会话列表与会话内时间分隔使用的时钟文案。 */
  static formatConversationTime = (iso, now = Date.now()) => {
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "";
    const dayDiff = HGMessageCenterVM.getDayOffset(new Date(time), new Date(now));
    if (dayDiff === 0) return `${String(new Date(time).getHours()).padStart(2, "0")}:${String(new Date(time).getMinutes()).padStart(2, "0")}`;
    if (dayDiff === 1) return "昨天";
    return `${new Date(time).getMonth() + 1}/${new Date(time).getDate()}`;
  };

  /** 消息流中的日期分隔文案。 */
  static formatDayDivider = (iso, now = Date.now()) => {
    const date = new Date(iso);
    const dayDiff = HGMessageCenterVM.getDayOffset(date, new Date(now));
    if (dayDiff === 0) return "今天";
    if (dayDiff === 1) return "昨天";
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  /** 按自然日把通知分成“今天 / 昨天 / 更早”三段，段序固定。 */
  static groupByDay = (items = [], now = Date.now()) => {
    const buckets = [
      { key: "today", label: "今天", items: [] },
      { key: "yesterday", label: "昨天", items: [] },
      { key: "earlier", label: "更早", items: [] },
    ];
    items.forEach((item) => {
      const offset = HGMessageCenterVM.getDayOffset(new Date(item.createdAt), new Date(now));
      if (offset <= 0) buckets[0].items.push(item);
      else if (offset === 1) buckets[1].items.push(item);
      else buckets[2].items.push(item);
    });
    return buckets.filter((bucket) => bucket.items.length > 0);
  };

  /** 汇总未读数；传入分类 map 或通知数组都支持。 */
  static sumUnread = (source) => {
    if (Array.isArray(source)) return source.filter((item) => !item.isRead).length;
    return Object.values(source || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  };

  /** 从通知数组统计各分类未读数。 */
  static countUnreadByCategory = (items = []) =>
    items.reduce((acc, item) => {
      if (!item.isRead) acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

  /** 头像文字：昵称取首字，英文取首字母。 */
  static getAvatarText = (name) => {
    const text = String(name || "").trim();
    return text ? text.slice(0, 1).toUpperCase() : "?";
  };

  /** 头像底色：按名称哈希取色，保证同一用户颜色稳定。 */
  static getAvatarColor = (name) => {
    const palette = ["#3c7bff", "#00a1d6", "#00b578", "#ff7d00", "#722ed1", "#f5455c", "#14b8a6", "#e8a33d"];
    const text = String(name || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) % 100000;
    }
    return palette[hash % palette.length];
  };

  /** 头像堆叠最多展示 3 个，其余归入 +N。 */
  static getAvatarStack = (names = []) => {
    const unique = Array.from(new Set(names.filter(Boolean)));
    if (unique.length === 0) return { visible: [], overflow: 0 };
    return { visible: unique.slice(0, 3), overflow: Math.max(unique.length - 3, 0) };
  };

  /** 聚合文案：A、B 等 100 人，避免向用户重复推送 100 条同类通知。 */
  static getActorSummary = (notification) => {
    const names = notification.actorNames || [];
    const count = Number(notification.aggregateCount || names.length || 1);
    if (names.length === 0) return "系统";
    if (count <= 1) return names[0];
    const head = names.slice(0, 2).join("、");
    return `${head} 等 ${count} 人`;
  };

  /** 目标资源标签，用于列表右侧的资源胶囊。 */
  static getTargetBadge = (targetType) => {
    const map = {
      video: "视频",
      comment: "评论",
      order: "订单",
      product: "商品",
      wallet: "钱包",
      user: "用户",
      notice: "公告",
      dynamic: "动态",
      security: "安全",
    };
    return map[targetType] || "";
  };

  /** 真实环境下可跳转的目标地址；未知类型返回空串，由页面给出提示而不是猜测路由。 */
  static buildTargetUrl = (notification) => {
    const { targetType, targetId } = notification;
    if (!targetId) return "";
    if (targetType === "video") return `/bilibili/content/video/${encodeURIComponent(targetId)}`;
    if (targetType === "order") return `/mall/orders/${encodeURIComponent(targetId)}`;
    if (targetType === "user") return `/space/${encodeURIComponent(targetId)}`;
    return "";
  };

  /** 会话最后一条消息预览：图片/文件类型不展示正文，避免泄露媒体内容。 */
  static getMessagePreview = (message) => {
    if (!message) return "";
    if (message.messageType === "image") return "[图片]";
    if (message.messageType === "file") return "[文件]";
    return message.content?.text || "";
  };

  /** 装配本地示例态：通知、未读、会话、消息与偏好一次返回，页面只做一次 setState。 */
  static buildDemoState = () => {
    const notifications = HG_DEMO_NOTIFICATIONS.map(HGMessageCenterVM.normalizeNotification);
    const conversations = HG_DEMO_CONVERSATIONS.map(HGMessageCenterVM.normalizeConversation).sort(
      (left, right) => Number(right.isPinned) - Number(left.isPinned) || new Date(right.updatedAt) - new Date(left.updatedAt)
    );
    const messagesByConversation = Object.fromEntries(
      Object.entries(HG_DEMO_MESSAGES).map(([conversationId, messages]) => [
        conversationId,
        messages.map(HGMessageCenterVM.normalizeMessage).sort((left, right) => left.seq - right.seq),
      ])
    );
    return {
      notifications,
      unreadByCategory: HGMessageCenterVM.countUnreadByCategory(notifications),
      conversations,
      messagesByConversation,
      preferences: JSON.parse(JSON.stringify(HG_DEMO_PREFERENCES)),
    };
  };
}
