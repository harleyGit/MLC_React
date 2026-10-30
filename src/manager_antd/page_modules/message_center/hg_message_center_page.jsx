/*
 * @Description: 消息中心页面。左侧为通知分类与私信导航，右侧为通知列表、私信会话及通知偏好，
 *               结构与后端 notification_inbox / im_conversation / im_message 保持一致。
 */
import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGInputPage, { HGInputSearch } from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../components/hg_select/hg_select_page";
import HGStatusTagPage from "../../../components/hg_status_tag/hg_status_tag_page";
import HGSwitchPage from "../../../components/hg_switch/hg_switch_page";
import HGMessageIcon from "./hg_message_center_icon";
import HGMessageCenterVM, {
  DIGEST_OPTIONS,
  IM_VIEW_KEY,
  MESSAGE_CATEGORIES,
  MESSAGE_DATA_SOURCE,
  MESSAGE_PAGE_SIZE,
  NOTIFY_CHANNEL_OPTIONS,
  PREFERENCE_CATEGORIES,
  SELF_USER_ID,
  TONE_CLASS_MAP,
} from "./hg_message_center_vm";
import styles from "./hg_message_center.module.css";

/** 时间 medium 琐碎格式化，避免每帧重复构造 Intl 实例。 */
const TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 消息中心页面组件。
 * 职责：组织通知分类导航、通知列表、私信会话与通知偏好四处交互。
 * 约束：
 * - 未读状态以分类 map 缓存，每次本地变更后重算，避免与列表不同步；
 * - 私信与通知共用 Kafka/Redis 等基础设施，但数据模型独立，页面同样分离建模；
 * - dataSource 为 local 时不发起任何请求，所有变更只影响本地 state。
 */
class HGMessageCenterPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      refreshing: false,
      activeKey: MESSAGE_CATEGORIES[0].key,
      unreadOnly: false,
      page: 1,
      nextCursor: "", // 下一页通知的服务端游标；空串表示无更多记录。
      hasMore: false, // 当前分类是否还能继续加载；只以服务端 nextCursor 判定。
      notifications: [],
      unreadByCategory: {},
      conversations: [],
      peerIdInput: "", // 新单聊的对方用户 ID；空串表示尚未输入，不推断当前用户身份。
      imLoading: false, // 私信接口请求中的状态；不与通知列表 loading 混用。
      messagesByConversation: {},
      activeConversationId: "",
      composerText: "",
      sending: false,
      conversationKeyword: "",
      preferences: null,
      preferencesOpen: false,
      preferencesSaving: false,
      now: Date.now(),
    };
    this.messageEndRef = React.createRef();
    this.hgListRequest = 0; // 最近一次列表请求序号，用于丢弃切换分类后的过期响应。
    this.hgMounted = false; // 页面挂载状态；卸载后禁止网络响应回写 UI。
    this.hgImTimer = null; // 私信历史的有界补拉定时器；未进入私信视图时为 null。
    this.hgImRequest = 0; // 会话历史请求序号；切换会话后丢弃过时响应。
    this.hgPendingSend = null; // 失败重试时复用原 clientMsgId；成功或修改草稿后清空。
    this.hgDevice = null; // 仅当前浏览器标签使用的临时设备凭据；不会放入 URL/日志。
    this.hgDeviceBusy = false; // 单标签最多一个待确认补拉请求，避免定时器放大并发。
  }

  componentDidMount() {
    this.hgMounted = true;
    if (HGMessageCenterVM.isRemote()) {
      this.loadRemoteData();
      return;
    }
    this.applyDemoState();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgListRequest += 1;
    this.hgImRequest += 1;
    if (this.hgImTimer) clearInterval(this.hgImTimer);
  }

  componentDidUpdate(prevProps, prevState) {
    // 切换会话或新消息落地后把消息区滚到底，避免漏看对方最新一条。
    const scrolled =
      prevState.activeConversationId !== this.state.activeConversationId ||
      this.countMessages(prevState) !== this.countMessages(this.state);
    if (scrolled) this.scrollMessageAreaToBottom();
  }

  /* ================= 数据加载 ================= */

  /** 装配本地示例数据并补齐会话与偏好默认值。 */
  applyDemoState = () => {
    const demo = HGMessageCenterVM.buildDemoState();
    this.setState({
      notifications: demo.notifications,
      unreadByCategory: demo.unreadByCategory,
      conversations: demo.conversations,
      messagesByConversation: demo.messagesByConversation,
      preferences: demo.preferences,
      activeConversationId: demo.conversations[0]?.conversationId || "",
      loading: false,
      now: Date.now(),
    });
  };

  /** remote 模式的一次性初始化：未读汇总、首个分类列表与会话列表。 */
  loadRemoteData = () => {
    const hgRequest = ++this.hgListRequest; // 初始化请求也遵守分类切换后的过期响应隔离。
    this.setState({ loading: true });
    Promise.all([
      HGMessageCenterVM.fetchUnreadSummary(),
      HGMessageCenterVM.fetchNotifications({ category: this.state.activeKey, pageSize: MESSAGE_PAGE_SIZE }),
    ])
      .then(([summary, list]) => {
        if (!this.hgMounted || hgRequest !== this.hgListRequest) return;
        const notifications = (list?.list || []).map(HGMessageCenterVM.normalizeNotification);
        this.setState({
          unreadByCategory: summary?.unreadByCategory || {},
          notifications,
          nextCursor: list?.nextCursor || "",
          hasMore: Boolean(list?.nextCursor),
          loading: false,
          now: Date.now(),
        });
      })
      .catch((error) => {
        if (!this.hgMounted || hgRequest !== this.hgListRequest) return;
        this.setState({ loading: false });
        message.error(error?.message || "消息中心数据加载失败");
      });
  };

  /** remote 模式下切换分类时重新拉取列表。 */
  loadCategoryFromRemote = (category, { append = false } = {}) => {
    if (!HGMessageCenterVM.isRemote()) return;
    const hgRequest = ++this.hgListRequest; // 仅最新分类请求有权写列表，避免乱序响应覆盖。
    const cursor = append ? this.state.nextCursor : ""; // 追加页只使用服务端游标，不计算 OFFSET。
    if (append && !cursor) return;
    this.setState({ refreshing: true });
    HGMessageCenterVM.fetchNotifications({ category, cursor, pageSize: MESSAGE_PAGE_SIZE, unreadOnly: this.state.unreadOnly })
      .then((result) => {
        if (!this.hgMounted || hgRequest !== this.hgListRequest || category !== this.state.activeKey) return;
        const notifications = (result?.list || []).map(HGMessageCenterVM.normalizeNotification);
        this.setState({
          notifications: append ? [...this.state.notifications, ...notifications] : notifications,
          nextCursor: result?.nextCursor || "",
          hasMore: Boolean(result?.nextCursor),
          page: 1,
          refreshing: false,
          now: Date.now(),
        });
      })
      .catch((error) => {
        if (!this.hgMounted || hgRequest !== this.hgListRequest) return;
        this.setState({ refreshing: false });
        message.error(error?.message || "通知列表加载失败");
      });
  };

  /* ================= 视图计算 ================= */

  /** 当前选中的分类配置；私信视图没有分类配置，返回 null。 */
  getActiveCategory = () =>
    this.state.activeKey === IM_VIEW_KEY ? null : HGMessageCenterVM.getCategoryMeta(this.state.activeKey);

  /** 当前分类可见通知：按未读过滤后做“加载更多”的有界分页。 */
  getVisibleNotifications = () => {
    const { activeKey, notifications, unreadOnly, page } = this.state;
    const filtered = notifications.filter(
      (item) => item.category === activeKey && (!unreadOnly || !item.isRead)
    );
    return HGMessageCenterVM.isRemote() ? filtered : filtered.slice(0, page * MESSAGE_PAGE_SIZE);
  };

  /** 当前分类的全部条数，用于判断是否还有更多。 */
  getCategoryTotal = () => {
    const { activeKey, notifications, unreadOnly } = this.state;
    return notifications.filter((item) => item.category === activeKey && (!unreadOnly || !item.isRead)).length;
  };

  /** 私信会话查询：支持按昵称搜索，搜索端不成立时不展示空列表误导。 */
  getFilteredConversations = () => {
    const { conversations, conversationKeyword } = this.state;
    const keyword = conversationKeyword.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((item) => item.peer.name.toLowerCase().includes(keyword));
  };

  /** 当前会话消息列表；只按 seq 升序，不依赖时间戳排序。 */
  getActiveMessages = () => {
    const { activeConversationId, messagesByConversation } = this.state;
    const messages = messagesByConversation[activeConversationId] || [];
    return [...messages].sort((left, right) => left.seq - right.seq);
  };

  /** 当前会话对象。 */
  getActiveConversation = () =>
    this.state.conversations.find((item) => item.conversationId === this.state.activeConversationId) || null;

  /** 统计消息总数，用于判断是否需要自动滚动。 */
  countMessages = (state) =>
    (state.messagesByConversation[state.activeConversationId] || []).length;

  /** 滚动会话消息区到底部。 */
  scrollMessageAreaToBottom = () => {
    if (this.messageEndRef.current) {
      this.messageEndRef.current.scrollIntoView({ block: "end" });
    }
  };

  /** 本地重算未读分布，保证左侧角标与列表一致。 */
  refreshUnreadSummary = (notifications) => {
    this.setState({ unreadByCategory: HGMessageCenterVM.countUnreadByCategory(notifications) });
  };

  /** 更新单条通知并同步未读数。 */
  updateNotifications = (updater) => {
    this.setState((state) => {
      const notifications = updater(state.notifications);
      return HGMessageCenterVM.isRemote()
        ? { notifications }
        : { notifications, unreadByCategory: HGMessageCenterVM.countUnreadByCategory(notifications) };
    });
  };

  /* ================= 通知交互 ================= */

  /** 切换左侧导航：通知分类或私信视图。 */
  handleNavSelect = (key) => {
    if (key === IM_VIEW_KEY && !HGMessageCenterVM.isIMAvailable()) {
      message.info("私信仍在 debug 环境联调，尚未开放实时网关及媒体授权");
      return;
    }
    if (key === this.state.activeKey) return;
    this.setState({ activeKey: key, unreadOnly: false, page: 1 });
    if (key === IM_VIEW_KEY) {
      if (HGMessageCenterVM.isRemote()) {
        this.loadIMConversations();
        this.ensureIMDevice();
        if (this.hgImTimer) clearInterval(this.hgImTimer);
        // WS 网关尚未部署；仅在私信页进行有界补拉，不把轮询称为实时送达。
        this.hgImTimer = setInterval(() => {
          this.loadIMHistory(true);
          this.loadIMDevicePending();
        }, 8000);
      }
      return;
    }
    if (this.hgImTimer) clearInterval(this.hgImTimer);
    this.hgImTimer = null;
    this.hgListRequest += 1;
    this.setState({ loading: false, notifications: [], nextCursor: "", hasMore: false }, () => this.loadCategoryFromRemote(key));
  };

  /** 切换“只看未读”。 */
  handleUnreadOnlyToggle = () => {
    this.setState((state) => {
      const unreadOnly = !state.unreadOnly;
      return { unreadOnly, page: 1 };
    }, () => {
      if (HGMessageCenterVM.isRemote()) this.loadCategoryFromRemote(this.state.activeKey);
    });
  };

  /** 加载更多：local 递增页，remote 走 cursor（当前由后端游标控制 pageSize）。 */
  handleLoadMore = () => {
    if (HGMessageCenterVM.isRemote()) {
      if (!this.state.refreshing && this.state.hasMore) this.loadCategoryFromRemote(this.state.activeKey, { append: true });
      return;
    }
    this.setState((state) => ({ page: state.page + 1 }));
  };

  /** 刷新：local 模式只重置时间戳，remote 模式重新拉列表。 */
  handleRefresh = () => {
    if (!HGMessageCenterVM.isRemote()) {
      this.setState({ now: Date.now(), page: 1 });
      message.info("当前展示本地示例数据，刷新只会重算相对时间");
      return;
    }
    if (this.state.activeKey === IM_VIEW_KEY) return;
    this.setState({ page: 1 }, () => this.loadCategoryFromRemote(this.state.activeKey));
    HGMessageCenterVM.fetchUnreadSummary().then((summary) => {
      if (this.hgMounted) this.setState({ unreadByCategory: summary?.unreadByCategory || {} });
    }).catch((error) => message.error(error?.message || "未读数刷新失败"));
  };

  /** 单条标记已读：点击消息体即视为已读，符合 B 站等平台的消息消费习惯。 */
  markAsRead = (item) => {
    if (item.isRead) return;
    if (HGMessageCenterVM.isRemote()) {
      return HGMessageCenterVM.markRead([item.notificationId]).then(() => {
        if (!this.hgMounted) return;
        this.updateNotifications((list) => list.map((row) => row.notificationId === item.notificationId ? { ...row, isRead: true } : row));
        HGMessageCenterVM.fetchUnreadSummary()
          .then((summary) => { if (this.hgMounted) this.setState({ unreadByCategory: summary?.unreadByCategory || {} }); })
          .catch((error) => message.error(error?.message || "未读数刷新失败"));
        return true;
      }).catch((error) => { message.error(error?.message || "已读状态提交失败"); return false; });
    }
    this.updateNotifications((list) =>
      list.map((row) => (row.notificationId === item.notificationId ? { ...row, isRead: true } : row))
    );
  };

  /** 当前分类全部已读。 */
  handleMarkAllRead = () => {
    const activeKey = this.state.activeKey;
    if (HGMessageCenterVM.isRemote()) {
      HGMessageCenterVM.markAllRead(activeKey).then((result) => {
        if (!this.hgMounted) return;
        message.info(result?.hasMore ? "已处理 500 条，请再次点击继续标记剩余通知" : "当前分类已全部标记为已读");
        this.handleRefresh();
      }).catch((error) => message.error(error?.message || "全部已读提交失败"));
      return;
    }
    this.updateNotifications((list) => list.map((row) => (row.category === activeKey ? { ...row, isRead: true } : row)));
    message.success(`已将 ${HGMessageCenterVM.getCategoryMeta(activeKey)?.label || "该分类"} 标记为已读`);
  };

  /** 用户级删除：只影响当前登录用户的收件箱。 */
  handleDelete = (item) => {
    if (HGMessageCenterVM.isRemote()) {
      HGMessageCenterVM.deleteNotification(item.notificationId).then(() => {
        if (this.hgMounted) this.handleRefresh();
      }).catch((error) => message.error(error?.message || "删除失败"));
      return;
    }
    this.updateNotifications((list) => list.filter((row) => row.notificationId !== item.notificationId));
    message.success("已在本地移除该条通知");
  };

  /** 跳转目标资源：demo 模式明确告知不可跳转，避免点击后落到空白业务页。 */
  openTarget = (item) => {
    if (!HGMessageCenterVM.isRemote()) {
      this.markAsRead(item);
      message.info(`示例数据：targetType=${item.targetType || "无"}，接入业务服务后按 targetId 跳转`);
      return;
    }
    const url = HGMessageCenterVM.buildTargetUrl(item);
    if (!url) {
      message.info("该通知没有与之关联的可跳转资源");
      return;
    }
    if (item.isRead) {
      window.location.href = url;
      return;
    }
    this.markAsRead(item)?.then((ok) => { if (ok) window.location.href = url; });
  };

  /* ================= 私信交互 ================= */

  /** 仅 debug 试运行时复用当前标签的设备凭据；服务端仍按 JWT 校验归属和失效时间。 */
  ensureIMDevice = () => {
    if (this.hgDevice) return;
    try {
      const cached = JSON.parse(sessionStorage.getItem("hg.im.device.debug") || "null");
      if (cached?.deviceId && cached?.secret) {
        this.hgDevice = cached;
        this.loadIMDevicePending();
        return;
      }
    } catch { sessionStorage.removeItem("hg.im.device.debug"); }
    HGMessageCenterVM.registerDevice()
      .then((credential) => {
        if (!this.hgMounted) return;
        this.hgDevice = credential;
        sessionStorage.setItem("hg.im.device.debug", JSON.stringify(credential));
        this.loadIMDevicePending();
      })
      .catch((error) => { if (this.hgMounted) message.error(error?.message || "设备注册失败"); });
  };

  /** 只 ACK 已在本人聊天窗口获取的消息；失败保留待确认记录供后续重试。 */
  loadIMDevicePending = () => {
    if (!this.hgDevice || this.hgDeviceBusy || this.state.activeKey !== IM_VIEW_KEY) return;
    this.hgDeviceBusy = true;
    HGMessageCenterVM.fetchDevicePending(this.hgDevice)
      .then((result) => {
        if (!this.hgMounted) return;
        const visible = new Set(Object.values(this.state.messagesByConversation).flat().map((item) => item.messageId));
        return Promise.all((result?.list || []).filter((item) => visible.has(item.messageId)).slice(0, 10)
          .map((item) => HGMessageCenterVM.ackDeviceMessage(this.hgDevice, item.messageId)));
      })
      .catch((error) => {
        if (!this.hgMounted) return;
        if (error?.status === 403) {
          sessionStorage.removeItem("hg.im.device.debug");
          this.hgDevice = null;
        }
      })
      .finally(() => { this.hgDeviceBusy = false; });
  };

  /** 拉取本人会话；失败保留现有会话，不用空列表掩盖接口故障。 */
  loadIMConversations = () => {
    this.setState({ imLoading: true });
    HGMessageCenterVM.fetchConversations()
      .then((result) => {
        if (!this.hgMounted || this.state.activeKey !== IM_VIEW_KEY) return;
        const conversations = (result?.list || []).map(HGMessageCenterVM.normalizeConversation);
        this.setState((state) => ({
          imLoading: false,
          conversations,
          activeConversationId: conversations.some((item) => item.conversationId === state.activeConversationId)
            ? state.activeConversationId : (conversations[0]?.conversationId || ""),
        }), () => this.loadIMHistory(false));
      })
      .catch((error) => {
        if (!this.hgMounted) return;
        this.setState({ imLoading: false });
        message.error(error?.message || "会话加载失败");
      });
  };

  /** 根据服务端 seq 补拉；切换会话后旧请求不得覆盖新聊天窗口。 */
  loadIMHistory = (append = false) => {
    const conversationId = this.state.activeConversationId;
    if (!conversationId || !this.hgMounted || this.state.activeKey !== IM_VIEW_KEY) return;
    const existing = this.state.messagesByConversation[conversationId] || [];
    const afterSeq = append && existing.length ? Math.max(...existing.map((item) => item.seq)) : 0;
    const request = ++this.hgImRequest;
    HGMessageCenterVM.fetchMessages({ conversationId, afterSeq })
      .then((result) => {
        if (!this.hgMounted || request !== this.hgImRequest || this.state.activeConversationId !== conversationId) return;
        const incoming = (result?.list || []).map(HGMessageCenterVM.normalizeMessage);
        this.setState((state) => {
          const current = append ? (state.messagesByConversation[conversationId] || []) : [];
          const byId = new Map(current.map((item) => [item.messageId, item]));
          incoming.forEach((item) => byId.set(item.messageId, item));
          return { messagesByConversation: { ...state.messagesByConversation, [conversationId]: [...byId.values()] } };
        }, this.loadIMDevicePending);
        const lastSeq = incoming[incoming.length - 1]?.seq || 0;
        const recorded = this.state.conversations.find((item) => item.conversationId === conversationId)?.lastReadSeq || 0;
        if (lastSeq > recorded) {
          HGMessageCenterVM.reportRead({ conversationId, lastReadSeq: lastSeq })
            .then(() => {
              if (!this.hgMounted) return;
              this.setState((state) => ({ conversations: state.conversations.map((item) =>
                item.conversationId === conversationId ? { ...item, lastReadSeq: Math.max(item.lastReadSeq, lastSeq) } : item) }));
            })
            .catch((error) => { if (this.hgMounted) message.error(error?.message || "已读位置上报失败"); });
        }
      })
      .catch((error) => { if (this.hgMounted && !append) message.error(error?.message || "私信历史加载失败"); });
  };

  /** 通过对方用户 ID 发起单聊；成功后重新读取服务端权威会话列表。 */
  handleCreateConversation = () => {
    const peerId = this.state.peerIdInput.trim();
    if (!peerId || this.state.imLoading) return;
    this.setState({ imLoading: true });
    HGMessageCenterVM.createConversation(peerId)
      .then((result) => {
        if (!this.hgMounted) return;
        this.setState({ peerIdInput: "", activeConversationId: result?.conversationId || "" }, this.loadIMConversations);
      })
      .catch((error) => { if (this.hgMounted) this.setState({ imLoading: false }); message.error(error?.message || "创建单聊失败"); });
  };

  /** 选中会话：清本地未读并向服务端上报已读位置。 */
  handleSelectConversation = (conversationId) => {
    this.setState({ activeConversationId: conversationId }, () => {
      if (HGMessageCenterVM.isRemote()) this.loadIMHistory(false);
      this.reportReadAndResetUnread();
      this.scrollMessageAreaToBottom();
    });
  };

  /** 上报已读位置并清零该会话未读计数。 */
  reportReadAndResetUnread = () => {
    const conversation = this.getActiveConversation();
    if (!conversation || conversation.unreadCount <= 0) return;
    const lastSeq = Math.max(conversation.lastSeq, conversation.lastReadSeq);
    this.setState((state) => ({
      conversations: state.conversations.map((item) =>
        item.conversationId === conversation.conversationId ? { ...item, unreadCount: 0, lastReadSeq: lastSeq } : item
      ),
    }));
    if (HGMessageCenterVM.isRemote()) {
      HGMessageCenterVM.reportRead({ conversationId: conversation.conversationId, lastReadSeq: lastSeq }).catch(
        (error) => message.error(error?.message || "已读位置上报失败")
      );
    }
  };

  /** 会话搜索输入。 */
  handleConversationKeywordChange = (event) => {
    this.setState({ conversationKeyword: event.target.value });
  };

  /** 会话搜索提交；无匹配时不改选中会话，避免列表与聊天区错位。 */
  handleConversationSearch = (keyword) => {
    this.setState({ conversationKeyword: keyword });
  };

  /** 输入框受控变更。 */
  handleComposerChange = (event) => {
    this.hgPendingSend = null;
    this.setState({ composerText: event.target.value });
  };

  /** Enter 发送、Shift+Enter 换行，与主流 IM 客户端一致。 */
  handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSendMessage();
    }
  };

  /** 发送私信：clientMsgId 负责幂等；local 模式只追加带 local 标记的气泡。 */
  handleSendMessage = () => {
    const { composerText, activeConversationId } = this.state;
    const text = composerText.trim();
    if (!text) {
      message.warning("请输入消息内容");
      return;
    }
    const conversation = this.getActiveConversation();
    if (!conversation) {
      message.warning("请先选择一个会话");
      return;
    }
    const clientMsgId = this.hgPendingSend?.conversationId === activeConversationId && this.hgPendingSend?.text === text
      ? this.hgPendingSend.clientMsgId : HGMessageCenterVM.createClientMsgId();
    this.hgPendingSend = { conversationId: activeConversationId, text, clientMsgId };
    const pendingMessage = {
      messageId: `local_${clientMsgId}`,
      seq: conversation.lastSeq + 1,
      senderId: SELF_USER_ID,
      messageType: "text",
      content: { text },
      status: "normal",
      createdAt: new Date().toISOString(),
      local: true,
    };

    const commitLocal = () => {
      this.setState((state) => ({
        composerText: "",
        conversations: state.conversations.map((item) =>
          item.conversationId === activeConversationId
            ? { ...item, lastSeq: pendingMessage.seq, lastReadSeq: pendingMessage.seq, updatedAt: pendingMessage.createdAt }
            : item
        ),
        messagesByConversation: {
          ...state.messagesByConversation,
          [activeConversationId]: [...(state.messagesByConversation[activeConversationId] || []), pendingMessage],
        },
      }));
    };

    if (!HGMessageCenterVM.isRemote()) {
      commitLocal();
      message.info("示例数据：消息仅追加到本地列表，未写入 IM 服务");
      return;
    }

    this.setState({ sending: true });
    HGMessageCenterVM.sendMessage({ conversationId: activeConversationId, clientMsgId, messageType: "text", content: { text } })
      .then((result) => {
        if (!this.hgMounted) return;
        this.hgPendingSend = null;
        const normalized = HGMessageCenterVM.normalizeMessage(result?.message || result || {});
        this.setState((state) => ({
          composerText: "",
          sending: false,
          messagesByConversation: {
            ...state.messagesByConversation,
            [activeConversationId]: [
              ...(state.messagesByConversation[activeConversationId] || []).filter((item) => item.messageId !== normalized.messageId),
              { ...pendingMessage, messageId: normalized.messageId || pendingMessage.messageId, seq: normalized.seq || pendingMessage.seq, local: false, isSelf: true },
            ],
          },
        }));
      })
      .catch((error) => {
        if (!this.hgMounted) return;
        // 失败不丢弃草稿，clientMsgId 保留以便安全重试。
        this.setState({ sending: false });
        message.error(error?.message || "消息发送失败，可重试（幂等键未变更）");
      });
  };

  /* ================= 通知偏好 ================= */

  /** 打开偏好弹窗。 */
  openPreferences = () => {
    if (HGMessageCenterVM.isRemote()) {
      HGMessageCenterVM.fetchPreferences()
        .then((preferences) => { if (this.hgMounted) this.setState({ preferences, preferencesOpen: true }); })
        .catch((error) => message.error(error?.message || "通知偏好加载失败"));
      return;
    }
    this.setState({ preferencesOpen: true });
  };

  /** 关闭偏好弹窗。 */
  closePreferences = () => {
    if (!this.state.preferencesSaving) this.setState({ preferencesOpen: false });
  };

  /** 修改分类或渠道开关。 */
  togglePreference = (group, key) => {
    this.setState((state) => ({
      preferences: {
        ...state.preferences,
        [group]: { ...state.preferences[group], [key]: !state.preferences[group][key] },
      },
    }));
  };

  /** 修改免打扰开关。 */
  toggleQuietHours = () => {
    this.setState((state) => ({
      preferences: {
        ...state.preferences,
        quietHours: { ...state.preferences.quietHours, enabled: !state.preferences.quietHours.enabled },
      },
    }));
  };

  /** 修改免打扰起止时间。 */
  changeQuietTime = (field, value) => {
    this.setState((state) => ({
      preferences: { ...state.preferences, quietHours: { ...state.preferences.quietHours, [field]: value } },
    }));
  };

  /** 修改汇总频率。 */
  changeDigest = (digest) => {
    this.setState((state) => ({ preferences: { ...state.preferences, digest } }));
  };

  /** 保存偏好；local 模式提示不会同步到服务端。 */
  handleSavePreferences = () => {
    const { preferences } = this.state;
    if (!HGMessageCenterVM.isRemote()) {
      message.success("偏好已保存到本地（示例数据，未提交服务端）");
      this.setState({ preferencesOpen: false });
      return;
    }
    this.setState({ preferencesSaving: true });
    HGMessageCenterVM.savePreferences(preferences)
      .then(() => {
        message.success("通知偏好已保存，下次投递立即生效");
        this.setState({ preferencesOpen: false, preferencesSaving: false });
      })
      .catch((error) => {
        this.setState({ preferencesSaving: false });
        message.error(error?.message || "通知偏好保存失败");
      });
  };

  /* ================= 渲染：左侧导航 ================= */

  /** 未读数字展示：超过 99 收敛为 99+，避免角标撑破导航。 */
  renderUnreadBadge = (count) => {
    if (!count || count <= 0) return null;
    return <span className={styles.navBadge}>{count > 99 ? "99+" : count}</span>;
  };

  /** 单个导航项：图标、名称、未读角标，私信项额外显示会话未读总数。 */
  renderNavItem = (item) => {
    const { activeKey, unreadByCategory, conversations } = this.state;
    const isActive = activeKey === item.key;
    const unread = item.key === IM_VIEW_KEY
      ? conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
      : (unreadByCategory[item.key] || 0);
    const toneClass = styles[TONE_CLASS_MAP[item.tone] || "toneBlue"];

    return (
      <button
        key={item.key}
        type="button"
        className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
        onClick={() => this.handleNavSelect(item.key)}
      >
        <span className={`${styles.navIcon} ${toneClass}`}>
          <HGMessageIcon type={item.icon} size={18} />
        </span>
        <span className={styles.navLabel}>{item.label}</span>
        {this.renderUnreadBadge(unread)}
      </button>
    );
  };

  /** 左侧导航：通知分类 + 私信入口 + 通知设置。 */
  renderSideNav = () => {
    const activeCategory = this.getActiveCategory();
    const totalUnread = HGMessageCenterVM.sumUnread(this.state.unreadByCategory);

    return (
      <aside className={styles.sideNav}>
        <div className={styles.navBrand}>
          <span className={styles.navBrandIcon}>
            <HGMessageIcon type="bell" size={20} />
          </span>
          <div className={styles.navBrandText}>
            <strong>消息中心</strong>
            <span>{totalUnread > 0 ? `${totalUnread} 条未读` : "全部已读"}</span>
          </div>
        </div>

        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>通知分类</span>
          {MESSAGE_CATEGORIES.map((item) => this.renderNavItem(item))}
        </div>

        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>即时通信</span>
          {this.renderNavItem({ key: IM_VIEW_KEY, label: HGMessageCenterVM.isIMAvailable() ? "私信（HTTP 补拉）" : "私信（待上线）", icon: "chat", tone: "blue" })}
        </div>

        <button type="button" className={styles.navFooter} onClick={this.openPreferences}>
          <HGMessageIcon type="settings" size={16} />
          <span>通知设置</span>
        </button>

        {activeCategory ? <p className={styles.navHint}>{activeCategory.desc}</p> : null}
      </aside>
    );
  };

  /* ================= 渲染：头部 ================= */

  /** 顶部标题条：当前视图说明、示例数据标记与全局动作。 */
  renderPageHeader = () => {
    const activeCategory = this.getActiveCategory();
    const isIm = this.state.activeKey === IM_VIEW_KEY;
    const title = isIm ? "私信" : (activeCategory?.label || "消息中心");
    const subtitle = isIm
      ? "单聊、图片与文件消息；消息顺序由服务端 seq 决定，支持离线补拉与已读回执。"
      : "系统通知、互动提醒与交易消息统一在此查看，按分类维护未读状态。";

    return (
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderMain}>
          <h1 className={styles.pageTitle}>{title}</h1>
          <p className={styles.pageSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.pageHeaderActions}>
          <span className={styles.sourceTag} title={`当前数据源：${MESSAGE_DATA_SOURCE}`}>
            {HGMessageCenterVM.isRemote() ? "实时数据" : "示例数据"}
          </span>
          <HGButtonPage onClick={this.handleRefresh} loading={this.state.refreshing}>
            刷新
          </HGButtonPage>
          {!isIm ? (
            <HGButtonPage type="primary" onClick={this.handleMarkAllRead}>
              全部已读
            </HGButtonPage>
          ) : null}
        </div>
      </header>
    );
  };

  /* ================= 渲染：通知列表 ================= */

  /** 骨架屏：首次加载占位，避免布局跳动。 */
  renderSkeleton = () => (
    <div className={styles.skeletonList}>
      {[0, 1, 2, 3].map((key) => (
        <div className={styles.skeletonRow} key={key}>
          <span className={styles.skeletonAvatar} />
          <div className={styles.skeletonLines}>
            <span className={styles.skeletonLine} style={{ width: "38%" }} />
            <span className={styles.skeletonLine} style={{ width: "72%" }} />
            <span className={styles.skeletonLine} style={{ width: "24%" }} />
          </div>
        </div>
      ))}
    </div>
  );

  /** 头像区域：多人聚合时展示堆叠头像，系统类通知展示分类图标。 */
  renderAvatar = (item) => {
    const category = HGMessageCenterVM.getCategoryMeta(item.category);
    const { visible, overflow } = HGMessageCenterVM.getAvatarStack(item.actorNames);
    const toneClass = styles[TONE_CLASS_MAP[category?.tone || "blue"] || "toneBlue"];

    if (visible.length === 0) {
      return (
        <span className={`${styles.itemAvatar} ${styles.itemAvatarSystem} ${toneClass}`}>
          <HGMessageIcon type={category?.icon || "bell"} size={22} />
        </span>
      );
    }
    if (visible.length === 1) {
      return (
        <span
          className={styles.itemAvatar}
          style={{ backgroundColor: HGMessageCenterVM.getAvatarColor(visible[0]) }}
        >
          {HGMessageCenterVM.getAvatarText(visible[0])}
        </span>
      );
    }
    return (
      <span className={styles.avatarStack}>
        {visible.map((name) => (
          <span
            key={name}
            className={styles.stackAvatar}
            style={{ backgroundColor: HGMessageCenterVM.getAvatarColor(name) }}
          >
            {HGMessageCenterVM.getAvatarText(name)}
          </span>
        ))}
        {overflow > 0 ? <span className={styles.stackOverflow}>+{overflow}</span> : null}
      </span>
    );
  };

  /** 单条通知：头像、聚合文案、正文引用、来源资源胶囊、时间与悬浮操作。 */
  renderNotificationItem = (item) => {
    const { now } = this.state;
    const actorSummary = HGMessageCenterVM.getActorSummary(item);
    const badge = HGMessageCenterVM.getTargetBadge(item.targetType);

    return (
      <article
        key={item.notificationId}
        className={`${styles.noticeItem} ${item.isRead ? "" : styles.noticeItemUnread}`}
      >
        <div className={styles.itemAvatarWrap}>{this.renderAvatar(item)}</div>
        <div className={styles.itemBody} onClick={() => this.markAsRead(item)}>
          <div className={styles.itemTitleRow}>
            <span className={styles.itemActor}>{actorSummary}</span>
            <span className={styles.itemAction}>{item.title}</span>
            {!item.isRead ? <span className={styles.unreadDot} /> : null}
          </div>
          <p className={styles.itemContent}>{item.content}</p>
          {item.quote ? <p className={styles.itemQuote}>{item.quote}</p> : null}
          <div className={styles.itemMeta}>
            <span>{HGMessageCenterVM.formatRelativeTime(item.createdAt, now)}</span>
            {badge ? (
              <span className={styles.targetBadge}>
                <HGMessageIcon type="inbox" size={12} />
                {item.targetLabel || badge}
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.itemActions}>
          <HGButtonPage type="link" onClick={() => this.openTarget(item)}>
            查看
          </HGButtonPage>
          <HGButtonPage type="link" onClick={() => this.markAsRead(item)} disabled={item.isRead}>
            已读
          </HGButtonPage>
          <HGButtonPage type="link" danger onClick={() => this.handleDelete(item)}>
            删除
          </HGButtonPage>
        </div>
      </article>
    );
  };

  /** 空状态：区分“全部空”与“未读过滤后为空”。 */
  renderEmptyState = () => {
    const { unreadOnly } = this.state;
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>
          <HGMessageIcon type="inbox" size={34} />
        </span>
        <strong>{unreadOnly ? "没有未读消息" : "暂无消息"}</strong>
        <p>
          {unreadOnly
            ? "当前分类的消息都已读完，切换到“全部”可以查看历史记录。"
            : "有新的互动、审核或交易动态时，会第一时间出现在这里。"}
        </p>
        <HGButtonPage type="primary" onClick={this.handleRefresh}>
          刷新消息
        </HGButtonPage>
      </div>
    );
  };

  /** 通知列表主体：工具条 + 按日分组列表 + 加载更多。 */
  renderNoticeView = () => {
    const { activeKey, loading, unreadOnly } = this.state;
    const category = this.getActiveCategory();
    const visible = this.getVisibleNotifications();
    const total = this.getCategoryTotal();
    const grouped = HGMessageCenterVM.groupByDay(visible, this.state.now);
    const categoryUnread = this.state.unreadByCategory[activeKey] || 0;
    const hasMore = HGMessageCenterVM.isRemote() ? this.state.hasMore : visible.length < total;

    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleRow}>
            <span className={`${styles.panelIcon} ${styles[TONE_CLASS_MAP[category?.tone || "blue"] || "toneBlue"]}`}>
              <HGMessageIcon type={category?.icon || "bell"} size={18} />
            </span>
            <div>
              <h2 className={styles.panelTitle}>{category?.label || "消息中心"}</h2>
              <p className={styles.panelSubtitle}>
                {HGMessageCenterVM.isRemote() ? `已加载 ${total} 条` : `共 ${total} 条`} · 未读 {categoryUnread} 条
              </p>
            </div>
          </div>
          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterChip} ${unreadOnly ? "" : styles.filterChipActive}`}
              onClick={() => this.setState({ unreadOnly: false, page: 1 }, () => {
                if (HGMessageCenterVM.isRemote()) this.loadCategoryFromRemote(this.state.activeKey);
              })}
            >
              全部
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${unreadOnly ? styles.filterChipActive : ""}`}
              onClick={this.handleUnreadOnlyToggle}
            >
              只看未读
            </button>
          </div>
        </div>

        {loading ? (
          this.renderSkeleton()
        ) : visible.length === 0 ? (
          this.renderEmptyState()
        ) : (
          <>
            <div className={styles.noticeList}>
              {grouped.map((group) => (
                <div className={styles.dayGroup} key={group.key}>
                  <div className={styles.dayLabel}>{group.label}</div>
                  {group.items.map((item) => this.renderNotificationItem(item))}
                </div>
              ))}
            </div>
            {hasMore ? (
              <div className={styles.loadMoreRow}>
                <HGButtonPage onClick={this.handleLoadMore} loading={this.state.refreshing}>加载更多（已展示 {visible.length} 条）</HGButtonPage>
              </div>
            ) : (
              <p className={styles.listFooter}>已经到底了 · 已展示 {visible.length} 条</p>
            )}
          </>
        )}
      </section>
    );
  };

  /* ================= 渲染：私信 ================= */

  /** 会话列表项：头像、昵称、预览、时间与未读角标。 */
  renderConversationItem = (conversation) => {
    const { activeConversationId, messagesByConversation, now } = this.state;
    const messages = messagesByConversation[conversation.conversationId] || [];
    const lastMessage = messages[messages.length - 1];
    const isActive = activeConversationId === conversation.conversationId;

    return (
      <button
        key={conversation.conversationId}
        type="button"
        className={`${styles.conversationItem} ${isActive ? styles.conversationItemActive : ""}`}
        onClick={() => this.handleSelectConversation(conversation.conversationId)}
      >
        <span
          className={styles.conversationAvatar}
          style={{ backgroundColor: HGMessageCenterVM.getAvatarColor(conversation.peer.name) }}
        >
          {HGMessageCenterVM.getAvatarText(conversation.peer.name)}
          {conversation.peer.online ? <i className={styles.onlineDot} /> : null}
        </span>
        <span className={styles.conversationMain}>
          <span className={styles.conversationName}>
            {conversation.peer.name}
            {conversation.isPinned ? <HGMessageIcon type="pin" size={12} /> : null}
            {conversation.isMuted ? <em className={styles.mutedTag}>免打扰</em> : null}
          </span>
          <span className={styles.conversationPreview}>
            {HGMessageCenterVM.getMessagePreview(lastMessage) || conversation.peer.subtitle}
          </span>
        </span>
        <span className={styles.conversationMeta}>
          <span className={styles.conversationTime}>
            {HGMessageCenterVM.formatConversationTime(conversation.updatedAt, now)}
          </span>
          {this.renderUnreadBadge(conversation.unreadCount)}
        </span>
      </button>
    );
  };

  /** 会话列表：搜索 + 有界会话项。 */
  renderConversationList = () => {
    const conversations = this.getFilteredConversations();
    return (
      <div className={styles.conversationPanel}>
        {HGMessageCenterVM.isRemote() ? (
          <div className={styles.imCreateRow}>
            <input
              type="text"
              maxLength={128}
              value={this.state.peerIdInput}
              aria-label="对方用户 ID"
              placeholder="输入对方用户 ID 开始单聊"
              onChange={(event) => this.setState({ peerIdInput: event.target.value })}
            />
            <button type="button" disabled={this.state.imLoading || !this.state.peerIdInput.trim()} onClick={this.handleCreateConversation}>创建单聊</button>
          </div>
        ) : null}
        <div className={styles.conversationSearch}>
          <HGInputSearch
            value={this.state.conversationKeyword}
            allowClear
            enterButton="搜索"
            placeholder="搜索会话对象"
            onChange={this.handleConversationKeywordChange}
            onSearch={this.handleConversationSearch}
          />
        </div>
        {conversations.length === 0 ? (
          <p className={styles.conversationEmpty}>没有匹配的会话</p>
        ) : (
          <div className={styles.conversationList}>{conversations.map(this.renderConversationItem)}</div>
        )}
      </div>
    );
  };

  /** 单条气泡：文本/图片区分渲染，自己的消息展示回执状态。 */
  renderMessageBubble = (message, conversation) => {
    const isSelf = HGMessageCenterVM.isRemote() ? message.isSelf : message.senderId === SELF_USER_ID;
    const receipt = HGMessageCenterVM.getReceiptStatus(message, conversation);

    return (
      <div
        key={message.messageId}
        className={`${styles.bubbleRow} ${isSelf ? styles.bubbleRowSelf : ""}`}
      >
        <span className={styles.bubbleAvatar} style={{ backgroundColor: isSelf ? "#2b5bd7" : HGMessageCenterVM.getAvatarColor(conversation.peer.name) }}>
          {isSelf ? "我" : HGMessageCenterVM.getAvatarText(conversation.peer.name)}
        </span>
        <div className={styles.bubbleMain}>
          <div className={styles.bubbleMeta}>
            <span>{isSelf ? "我" : conversation.peer.name}</span>
            <span className={styles.bubbleSeq}>seq {message.seq}</span>
            <span>{TIME_FORMATTER.format(new Date(message.createdAt))}</span>
          </div>
          <div className={styles.bubble}>
            {message.messageType === "image" ? (
              <div className={styles.imageBubble}>
                <HGMessageIcon type="image" size={26} />
                <span className={styles.imageMeta}>
                  {message.content?.width || 0} × {message.content?.height || 0}
                </span>
                <span className={styles.imageNote}>图片走对象存储，消息体内只保存 mediaId 引用</span>
              </div>
            ) : (
              <p className={styles.bubbleText}>{message.content?.text || ""}</p>
            )}
          </div>
          <div className={styles.bubbleFooter}>
            {isSelf ? (
              <span className={`${styles.receipt} ${styles[receipt]}`}>
                {HGMessageCenterVM.getReceiptLabel(receipt)}
              </span>
            ) : null}
            {message.local ? <span className={styles.localTag}>本地未落库</span> : null}
          </div>
        </div>
      </div>
    );
  };

  /** 聊天窗口：会话头、消息流与输入区。 */
  renderChatWindow = () => {
    const conversation = this.getActiveConversation();
    if (!conversation) {
      return (
        <div className={styles.chatEmpty}>
          <HGMessageIcon type="chat" size={40} />
          <p>选择一个会话开始聊天</p>
        </div>
      );
    }
    const messages = this.getActiveMessages();
    const pinned = conversation.isPinned;

    return (
      <div className={styles.chatWindow}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderMain}>
            <strong>{conversation.peer.name}</strong>
            <span>{conversation.peer.subtitle}</span>
          </div>
          <div className={styles.chatHeaderMeta}>
            <HGStatusTagPage tone={conversation.peer.online ? "success" : "neutral"}>
              {conversation.peer.online ? "在线" : "离线"}
            </HGStatusTagPage>
            <span className={styles.seqTag}>
              seq {conversation.lastReadSeq}/{conversation.lastSeq}
            </span>
            {pinned ? <HGMessageIcon type="pin" size={14} /> : null}
          </div>
        </div>

        <div className={styles.messageArea}>
          {messages.length === 0 ? (
            <p className={styles.messageEmpty}>还没有聊天记录</p>
          ) : (
            messages.map((message) => this.renderMessageBubble(message, conversation))
          )}
          <div ref={this.messageEndRef} />
        </div>

        <div className={styles.composer}>
          <textarea
            className={styles.composerInput}
            rows={2}
            maxLength={1000}
            value={this.state.composerText}
            placeholder="输入消息，Enter 发送、Shift + Enter 换行"
            onChange={this.handleComposerChange}
            onKeyDown={this.handleComposerKeyDown}
          />
          <div className={styles.composerFooter}>
            <span className={styles.composerHint}>
              clientMsgId 负责幂等；发送失败重试不会产生重复消息
            </span>
            <HGButtonPage
              type="primary"
              loading={this.state.sending}
              disabled={!this.state.composerText.trim()}
              onClick={this.handleSendMessage}
            >
              发送
            </HGButtonPage>
          </div>
        </div>
      </div>
    );
  };

  /** 私信视图：会话列表 + 聊天窗口。 */
  renderImView = () => (
    <section className={`${styles.panel} ${styles.imPanel}`}>
      {this.renderConversationList()}
      {this.renderChatWindow()}
    </section>
  );

  /* ================= 渲染：通知偏好弹窗 ================= */

  /** 通知偏好弹窗：分类订阅、渠道开关、免打扰时段与汇总频率。 */
  renderPreferencesModal = () => {
    const { preferencesOpen, preferences, preferencesSaving } = this.state;
    if (!preferencesOpen || !preferences) return null;

    return (
      <HGModalPage
        visible
        title="通知设置"
        size="large"
        closable={!preferencesSaving}
        onClose={this.closePreferences}
        footer={
          <>
            <HGButtonPage disabled={preferencesSaving} onClick={this.closePreferences}>
              取消
            </HGButtonPage>
            <HGButtonPage type="primary" loading={preferencesSaving} onClick={this.handleSavePreferences}>
              保存设置
            </HGButtonPage>
          </>
        }
      >
        <div className={styles.prefsSection}>
          <h3 className={styles.prefsTitle}>消息分类</h3>
          <p className={styles.prefsDesc}>系统与安全类通知不能关闭；互动类可按需关闭。</p>
          <div className={styles.switchGrid}>
            {PREFERENCE_CATEGORIES.map((item) => (
              <div className={styles.switchRow} key={item.key}>
                <span>{item.label}</span>
                  <HGSwitchPage
                    checked={Boolean(preferences.categories[item.key])}
                  onChange={() => this.togglePreference("categories", item.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.prefsSection}>
          <h3 className={styles.prefsTitle}>投递渠道</h3>
          <p className={styles.prefsDesc}>同一事件可落到多个渠道，实际是否发送还取决于渠道是否启用与频控。</p>
          <div className={styles.switchGrid}>
            {NOTIFY_CHANNEL_OPTIONS.map((item) => (
              <div className={styles.switchRow} key={item.key}>
                <span>
                  {item.label}
                  <em className={styles.switchDesc}>{item.desc}</em>
                </span>
                <HGSwitchPage
                  checked={Boolean(preferences.channels[item.key])}
                  disabled={HGMessageCenterVM.isRemote()}
                  onChange={() => this.togglePreference("channels", item.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.prefsSection}>
          <h3 className={styles.prefsTitle}>免打扰与汇总</h3>
          <div className={styles.quietRow}>
            <div className={styles.switchRow}>
              <span>免打扰时段</span>
              <HGSwitchPage checked={Boolean(preferences.quietHours.enabled)} disabled={HGMessageCenterVM.isRemote()} onChange={this.toggleQuietHours} />
            </div>
            <div className={styles.timeRange}>
              <HGInputPage
                value={preferences.quietHours.start}
                disabled={!preferences.quietHours.enabled}
                maxLength={5}
                onChange={(event) => this.changeQuietTime("start", event.target.value)}
              />
              <span className={styles.timeDash}>至</span>
              <HGInputPage
                value={preferences.quietHours.end}
                disabled={!preferences.quietHours.enabled}
                maxLength={5}
                onChange={(event) => this.changeQuietTime("end", event.target.value)}
              />
            </div>
            <label className={styles.digestField}>
              汇总频率
              <HGSelectPage value={preferences.digest} options={DIGEST_OPTIONS} disabled={HGMessageCenterVM.isRemote()} onChange={this.changeDigest} />
            </label>
          </div>
        </div>
      </HGModalPage>
    );
  };

  /* ================= 主渲染 ================= */

  render() {
    const { activeKey, loading } = this.state;
    const isIm = activeKey === IM_VIEW_KEY;

    return (
      <div className={styles.messageCenter}>
        {this.renderPageHeader()}
        <div className={styles.body}>
          {this.renderSideNav()}
          <main className={styles.content}>
            {isIm ? this.renderImView() : loading ? (
              <section className={styles.panel}>{this.renderSkeleton()}</section>
            ) : (
              this.renderNoticeView()
            )}
          </main>
        </div>
        {this.renderPreferencesModal()}
      </div>
    );
  }
}

export default HGMessageCenterPage;
