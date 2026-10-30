/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:43:08
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-31 00:10:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/home/hg_home_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koroFileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import HGChatInput from "../../../components/hg_chat_input/hg_chat_input.jsx";
import HGMessageList, { HG_MESSAGE_TYPES } from "../../../components/hg_message_list/hg_message_list.jsx";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import { logout } from "../../auth/hg_auth";
import CSStyles from "./hg_home.module.css";

/** 消息发送者方向常量，供多类型消息复用。 */
const FROM_ME = "me";
const FROM_PEER = "peer";

/**
 * 默认演示会话数据。
 * 约束：仅用于本地展示；后续接入真实接口时由 VM 层替换，不在视图内写死请求。
 */
const DEFAULT_CONVERSATIONS = [
  {
    id: "conv_product",
    name: "产品讨论组",
    avatarText: "产",
    avatarColor: "#5b8def",
    lastTime: "22:41",
    unread: 2,
    messages: [
      { id: "msg_p_t", type: HG_MESSAGE_TYPES.TIME, text: "22:38", from: FROM_PEER },
      { id: "msg_p1", type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "小张", text: "新版本的聊天首页布局评审过了吗？", time: "22:38" },
      { id: "msg_p2", type: HG_MESSAGE_TYPES.TEXT, from: FROM_ME, text: "已经过了，按 iPad 微信的双栏布局做。", time: "22:39" },
      { id: "msg_p3", type: HG_MESSAGE_TYPES.IMAGE, from: FROM_PEER, sender: "小张", alt: "设计稿截图", color: "#4f8bf5", text: "这是最新的双栏设计稿", time: "22:40" },
      { id: "msg_p4", type: HG_MESSAGE_TYPES.VOICE, from: FROM_ME, duration: 8, time: "22:40" },
      { id: "msg_p5", type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "小张", text: "好的，那左侧列表记得带未读角标。", time: "22:41" },
    ],
  },
  {
    id: "conv_dev",
    name: "前端小分队",
    avatarText: "前",
    avatarColor: "#27c0a8",
    lastTime: "21:12",
    unread: 0,
    messages: [
      { id: "msg_d_t", type: HG_MESSAGE_TYPES.TIME, text: "21:10", from: FROM_PEER },
      { id: "msg_d1", type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "阿明", text: "路由还是走 createBrowserRouter，页面内双栏不新增路由。", time: "21:10" },
      { id: "msg_d2", type: HG_MESSAGE_TYPES.VIDEO, from: FROM_ME, alt: "效果演示视频", color: "#6c4cf1", text: "演示一下滚动效果", time: "21:11" },
      { id: "msg_d3", type: HG_MESSAGE_TYPES.EMOJI, from: FROM_PEER, sender: "阿明", text: "👍", time: "21:11" },
      { id: "msg_d4", type: HG_MESSAGE_TYPES.TEXT, from: FROM_ME, text: "收到，样式继续用 CSS Modules。", time: "21:12" },
    ],
  },
  {
    id: "conv_ops",
    name: "运维值班",
    avatarText: "运",
    avatarColor: "#f2a93b",
    lastTime: "18:05",
    unread: 5,
    messages: [
      { id: "msg_o_t", type: HG_MESSAGE_TYPES.TIME, text: "18:05", from: FROM_PEER },
      { id: "msg_o1", type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "值班同事", text: "今晚 23:00 采集平台例行发布，注意告警。", time: "18:05" },
    ],
  },
  {
    id: "conv_notice",
    name: "系统通知",
    avatarText: "系",
    avatarColor: "#8e9aaf",
    lastTime: "昨天",
    unread: 0,
    messages: [
      { id: "msg_n_t", type: HG_MESSAGE_TYPES.TIME, text: "昨天 20:30", from: FROM_PEER },
      { id: "msg_n1", type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "系统", text: "你的账号已于新设备登录，如非本人操作请及时修改密码。", time: "昨天 20:30" },
    ],
  },
];

/** 每个会话共享的历史消息池，用于上拉加载更多（按时间正序，倒序插入头部）。 */
const HISTORY_POOL = [
  { type: HG_MESSAGE_TYPES.TEXT, from: FROM_PEER, sender: "队友", text: "早啊，昨天的进度同步一下？", time: "昨天 09:12" },
  { type: HG_MESSAGE_TYPES.EMOJI, from: FROM_ME, text: "😄", time: "昨天 09:13" },
  { type: HG_MESSAGE_TYPES.IMAGE, from: FROM_PEER, sender: "队友", alt: "流程图", color: "#27c0a8", text: "这是最新的接口时序图", time: "昨天 09:20" },
  { type: HG_MESSAGE_TYPES.VOICE, from: FROM_PEER, sender: "队友", duration: 12, time: "昨天 09:25" },
  { type: HG_MESSAGE_TYPES.TEXT, from: FROM_ME, text: "收到，我下午整理一版文档。", time: "昨天 09:30" },
  { type: HG_MESSAGE_TYPES.VIDEO, from: FROM_PEER, sender: "队友", alt: "录屏", color: "#f2a93b", text: "复现步骤录屏", time: "昨天 10:00" },
];

/**
 * 获取当前时间 HH:mm 文本。
 * @returns {string} 形如 "23:05" 的时间字符串。
 */
const hgGetNowTime = () => {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
};

/**
 * 生成消息唯一 id。
 * @param {string} prefix 前缀。
 * @returns {string} 唯一 id 字符串。
 */
const hgNextId = (prefix = "msg") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * 聊天首页（已登录态）
 * 职责：以 iPad 微信风格展示「左侧会话列表 + 右侧聊天内容」的双栏布局。
 * 输入：props - 包含 pageNavigator，用于个人资料页面跳转。
 * 约束：当前为本地演示数据与本地状态，不发起网络请求；退出登录仍使用原生 window.location。
 */
class HGHomePage extends React.Component {
  hgMounted = false; // 挂载标记；卸载后忽略延迟的自动回复。

  /**
   * 构造函数：初始化会话数据、当前选中会话、搜索关键字与输入草稿。
   */
  constructor(props) {
    super(props);
    this.state = {
      conversations: DEFAULT_CONVERSATIONS,
      activeId: DEFAULT_CONVERSATIONS[0]?.id || "",
      searchKeyword: "",
      draft: "",
      historyOffset: 0, // 已加载的历史消息条数，用于上拉加载更多。
    };
  }

  /**
   * 生命周期挂载：记录挂载标记。
   */
  componentDidMount() {
    this.hgMounted = true;
  }

  /**
   * 生命周期卸载：清除挂载标记，阻止延迟自动回复写入状态。
   */
  componentWillUnmount() {
    this.hgMounted = false;
  }

  /**
   * 在会话列表中查找指定 id 的会话。
   * @param {Array} conversations 会话数组。
   * @param {string} activeId 目标会话 id。
   * @returns {object|undefined} 命中的会话；未命中返回 undefined。
   */
  findConversation = (conversations, activeId) => {
    return conversations.find((item) => item.id === activeId);
  };

  /**
   * 获取当前选中会话对象。
   * @returns {object|undefined} 当前会话。
   */
  getActiveConversation = () => {
    return this.findConversation(this.state.conversations, this.state.activeId);
  };

  /**
   * 退出登录，清除本地登录态并强制跳转到登录页。
   * @returns {void}
   */
  handleLogout = () => {
    logout();
    window.location.href = "/login"; // 强制浏览器跳转到登录页
  };

  /**
   * 跳转到个人资料页面。
   * @returns {void}
   */
  viewPersonalProfile = () => {
    this.props.pageNavigator.open({ page: PAGE.USER_PROFILE });
  };

  /**
   * 更新会话搜索关键字。
   * @param {React.ChangeEvent} event 输入框变更事件。
   */
  handleSearchChange = (event) => {
    this.setState({ searchKeyword: event.target.value });
  };

  /**
   * 选中某个会话并清除其未读数。
   * @param {string} conversationId 目标会话 id。
   */
  selectConversation = (conversationId) => {
    this.setState((prevState) => ({
      activeId: conversationId,
      conversations: prevState.conversations.map((item) =>
        item.id === conversationId ? { ...item, unread: 0 } : item
      ),
    }));
  };

  /**
   * 更新输入草稿内容。
   * @param {React.ChangeEvent} event 输入框变更事件。
   */
  handleDraftChange = (event) => {
    this.setState({ draft: event.target.value });
  };

  /**
   * 向当前会话追加一条本人消息并刷新列表时间，随后安排自动回复。
   * @param {object} message 新消息对象（不含 id/时间，内部补齐）。
   * @returns {void}
   */
  appendMyMessage = (message) => {
    if (!this.state.activeId) {
      return;
    }
    const time = hgGetNowTime();
    const newMessage = { id: hgNextId("msg_me"), time, ...message };
    this.setState(
      (prevState) => ({
        conversations: prevState.conversations.map((item) =>
          item.id === prevState.activeId
            ? {
                ...item,
                lastTime: time,
                messages: [...item.messages, newMessage],
              }
            : item
        ),
      }),
      this.scheduleAutoReply
    );
  };

  /**
   * 发送草稿到当前会话：内容为空时不发送。
   * @returns {void}
   */
  handleSend = () => {
    const text = this.state.draft.trim();
    if (!text) {
      return;
    }
    this.setState({ draft: "" });
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.TEXT,
      from: FROM_ME,
      text,
    });
  };

  /**
   * 发送语音消息（由 HGChatInput 长按录音松开后回调）。
   * @param {number} seconds 语音时长（秒）。
   */
  handleSendVoice = (seconds) => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.VOICE,
      from: FROM_ME,
      duration: seconds,
    });
  };

  /**
   * 发送表情消息（表情面板点击即发送）。
   * @param {string} emoji 表情字符。
   */
  handleSendEmoji = (emoji) => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.EMOJI,
      from: FROM_ME,
      text: emoji,
    });
  };

  /** 发送图片消息（演示占位图）。 */
  handleSendImage = () => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.IMAGE,
      from: FROM_ME,
      alt: "图片消息",
      color: "#4f8bf5",
      text: "图片",
    });
  };

  /** 发送视频消息（演示占位封面）。 */
  handleSendVideo = () => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.VIDEO,
      from: FROM_ME,
      alt: "视频消息",
      color: "#6c4cf1",
      text: "视频",
    });
  };

  /** 发送红包消息。 */
  handleSendRedPacket = () => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.RED_PACKET,
      from: FROM_ME,
    });
  };

  /** 发送联系人名片消息。 */
  handleSendCard = () => {
    this.appendMyMessage({
      type: HG_MESSAGE_TYPES.CARD,
      from: FROM_ME,
      cardName: "张工",
      text: "前端负责人 · 个人名片",
    });
  };

  /**
   * 发送后安排一条延迟自动回复，模拟对端响应。
   * 约束：仅本地演示；组件卸载后不再写入状态。
   */
  scheduleAutoReply = () => {
    window.setTimeout(() => {
      if (!this.hgMounted) {
        return;
      }
      const time = hgGetNowTime();
      this.setState((prevState) => ({
        conversations: prevState.conversations.map((item) =>
          item.id === prevState.activeId
            ? {
                ...item,
                lastTime: time,
                messages: [
                  ...item.messages,
                  {
                    id: hgNextId("msg_reply"),
                    type: HG_MESSAGE_TYPES.TEXT,
                    from: FROM_PEER,
                    sender: item.name,
                    text: "收到，稍后回复你。",
                    time,
                  },
                ],
              }
            : item
        ),
      }));
    }, 800);
  };

  /**
   * 上拉加载更多：把历史消息按时间倒序插到当前会话消息顶部。
   * 约束：仅本地演示；历史池耗尽后 hasMore 置为 false。
   */
  handleLoadMore = () => {
    const active = this.getActiveConversation();
    if (!active) return;
    const offset = this.state.historyOffset;
    const batch = HISTORY_POOL.slice(offset, offset + 3);
    if (batch.length === 0) return;
    // 历史消息统一倒序插入头部，保持时间线顺序（旧消息在前）。
    const prepend = [...batch].reverse().map((message) => ({
      ...message,
      id: hgNextId("hist"),
    }));
    const conversations = this.state.conversations.map((item) =>
      item.id === active.id
        ? { ...item, messages: [...prepend, ...item.messages] }
        : item
    );
    this.setState({ conversations, historyOffset: offset + batch.length });
  };

  /**
   * 计算当前会话是否还有更多历史消息可加载。
   * @returns {boolean} hasMore 标记。
   */
  getHasMore = () => {
    return this.state.historyOffset < HISTORY_POOL.length;
  };

  /**
   * 按搜索关键字过滤会话列表。
   * @returns {Array} 过滤后的会话数组。
   */
  getVisibleConversations = () => {
    const keyword = this.state.searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return this.state.conversations;
    }
    return this.state.conversations.filter((item) =>
      item.name.toLowerCase().includes(keyword)
    );
  };

  /**
   * 根据消息类型生成会话列表的摘要文案。
   * @param {object} message 最后一条消息。
   * @returns {string} 摘要文案。
   */
  getMessagePreview = (message) => {
    if (!message || message.type === HG_MESSAGE_TYPES.TIME) return "";
    switch (message.type) {
      case HG_MESSAGE_TYPES.IMAGE:
        return "[图片]";
      case HG_MESSAGE_TYPES.VOICE:
        return "[语音]";
      case HG_MESSAGE_TYPES.VIDEO:
        return "[视频]";
      case HG_MESSAGE_TYPES.EMOJI:
        return "[表情]";
      case HG_MESSAGE_TYPES.RED_PACKET:
        return "[红包]";
      case HG_MESSAGE_TYPES.CARD:
        return "[名片]";
      default:
        return message.text;
    }
  };

  /**
   * 渲染左侧会话列表的单个会话项。
   * @param {object} conversation 会话数据。
   * @returns {React.ReactNode} 会话项节点。
   */
  renderConversationItem = (conversation) => {
    const isActive = conversation.id === this.state.activeId;
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const itemClassName = `${CSStyles.conversationItem} ${
      isActive ? CSStyles.conversationItemActive : ""
    }`;
    return (
      <button
        key={conversation.id}
        type="button"
        className={itemClassName}
        onClick={() => this.selectConversation(conversation.id)}
      >
        <span
          className={CSStyles.conversationAvatar}
          style={{ backgroundColor: conversation.avatarColor }}
        >
          {conversation.avatarText}
          {conversation.unread > 0 ? (
            <span className={CSStyles.unreadBadge}>{conversation.unread}</span>
          ) : null}
        </span>
        <span className={CSStyles.conversationInfo}>
          <span className={CSStyles.conversationTopRow}>
            <span className={CSStyles.conversationName}>{conversation.name}</span>
            <span className={CSStyles.conversationTime}>
              {conversation.lastTime}
            </span>
          </span>
          <span className={CSStyles.conversationPreview}>
            {this.getMessagePreview(lastMessage)}
          </span>
        </span>
      </button>
    );
  };

  /**
   * 渲染左侧会话列表栏：搜索框、会话列表与底部账号操作区。
   * @returns {React.ReactNode} 侧栏节点。
   */
  renderSidebar = () => {
    const visibleConversations = this.getVisibleConversations();
    return (
      <aside className={CSStyles.sidebar}>
        <div className={CSStyles.sidebarHeader}>
          <span className={CSStyles.sidebarTitle}>微信</span>
          <button
            type="button"
            className={CSStyles.sidebarAction}
            onClick={this.viewPersonalProfile}
            title="查看我的资料"
          >
            资料
          </button>
          <button
            type="button"
            className={CSStyles.sidebarAction}
            onClick={this.handleLogout}
            title="退出登录"
          >
            退出
          </button>
        </div>
        <div className={CSStyles.searchBox}>
          <input
            className={CSStyles.searchInput}
            type="text"
            placeholder="搜索"
            value={this.state.searchKeyword}
            onChange={this.handleSearchChange}
          />
        </div>
        <div className={CSStyles.conversationList}>
          {visibleConversations.length > 0 ? (
            visibleConversations.map(this.renderConversationItem)
          ) : (
            <div className={CSStyles.conversationEmpty}>没有匹配的会话</div>
          )}
        </div>
      </aside>
    );
  };

  /**
   * 渲染右侧聊天区顶部标题栏。
   * @param {object} activeConversation 当前选中会话。
   * @returns {React.ReactNode} 标题栏节点。
   */
  renderChatHeader = (activeConversation) => {
    return (
      <header className={CSStyles.chatHeader}>
        <span className={CSStyles.chatHeaderName}>{activeConversation.name}</span>
      </header>
    );
  };

  /**
   * 渲染右侧消息列表（复用 HGMessageList 虚拟滚动）。
   * @param {object} activeConversation 当前选中会话。
   * @returns {React.ReactNode} 消息列表节点。
   */
  renderMessageList = (activeConversation) => {
    return (
      <HGMessageList
        messages={activeConversation.messages}
        currentUserId={FROM_ME}
        loading={false}
        hasMore={this.getHasMore()}
        onLoadMore={this.handleLoadMore}
      />
    );
  };

  /**
   * 渲染右侧底部输入区：微信风格多模式输入（文字/语音/表情/扩展面板）。
   * @returns {React.ReactNode} 输入区节点。
   */
  renderChatInput = () => {
    return (
      <HGChatInput
        value={this.state.draft}
        onChange={this.handleDraftChange}
        onSendText={this.handleSend}
        onSendVoice={this.handleSendVoice}
        onSendEmoji={this.handleSendEmoji}
        onSendImage={this.handleSendImage}
        onSendVideo={this.handleSendVideo}
        onSendRedPacket={this.handleSendRedPacket}
        onSendCard={this.handleSendCard}
      />
    );
  };

  /**
   * 渲染未选中会话时的右侧占位空态。
   * @returns {React.ReactNode} 空态节点。
   */
  renderChatEmpty = () => {
    return (
      <div className={CSStyles.chatEmpty}>
        <span className={CSStyles.chatEmptyText}>未选择聊天</span>
      </div>
    );
  };

  /**
   * 渲染右侧聊天内容区：标题 + 消息列表 + 输入区。
   * @returns {React.ReactNode} 聊天区节点。
   */
  renderChatMain = () => {
    const activeConversation = this.getActiveConversation();
    if (!activeConversation) {
      return this.renderChatEmpty();
    }
    return (
      <section className={CSStyles.chatMain}>
        {this.renderChatHeader(activeConversation)}
        <div className={CSStyles.messageListWrap}>
          {this.renderMessageList(activeConversation)}
        </div>
        {this.renderChatInput()}
      </section>
    );
  };

  render() {
    return (
      <div className={CSStyles.container}>
        {this.renderSidebar()}
        {this.renderChatMain()}
      </div>
    );
  }
}

export default HGHomePage;
