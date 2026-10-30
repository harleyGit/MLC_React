/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:43:08
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-30 23:35:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/home/hg_home_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koroFileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import { logout } from "../../auth/hg_auth";
import CSStyles from "./hg_home.module.css";

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
      { id: "msg_p1", from: "peer", text: "新版本的聊天首页布局评审过了吗？", time: "22:38" },
      { id: "msg_p2", from: "me", text: "已经过了，按 iPad 微信的双栏布局做。", time: "22:39" },
      { id: "msg_p3", from: "peer", text: "好的，那左侧列表记得带未读角标。", time: "22:41" },
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
      { id: "msg_d1", from: "peer", text: "路由还是走 createBrowserRouter，页面内双栏不新增路由。", time: "21:10" },
      { id: "msg_d2", from: "me", text: "收到，样式继续用 CSS Modules。", time: "21:12" },
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
      { id: "msg_o1", from: "peer", text: "今晚 23:00 采集平台例行发布，注意告警。", time: "18:05" },
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
      { id: "msg_n1", from: "peer", text: "你的账号已于新设备登录，如非本人操作请及时修改密码。", time: "昨天 20:30" },
    ],
  },
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
    };
    this.messageListRef = React.createRef();
  }

  /**
   * 生命周期挂载：记录挂载标记；会话消息容器滚动到底部。
   */
  componentDidMount() {
    this.hgMounted = true;
    this.scrollToBottom();
  }

  /**
   * 生命周期更新：消息列表内容变化时保持滚动到底部。
   * @param {object} prevProps 更新前 props。
   * @param {object} prevState 更新前 state。
   */
  componentDidUpdate(prevProps, prevState) {
    const prevConversation = this.findConversation(
      prevState.conversations,
      prevState.activeId
    );
    const currConversation = this.findConversation(
      this.state.conversations,
      this.state.activeId
    );
    const prevCount = prevConversation?.messages.length || 0;
    const currCount = currConversation?.messages.length || 0;
    if (prevState.activeId !== this.state.activeId || prevCount !== currCount) {
      this.scrollToBottom();
    }
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
   * 将消息列表容器滚动到底部，展示最新消息。
   */
  scrollToBottom = () => {
    const node = this.messageListRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
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
   * 发送草稿到当前会话：追加本人消息、刷新列表时间；内容为空时不发送。
   * @returns {void}
   */
  handleSend = () => {
    const text = this.state.draft.trim();
    if (!text || !this.state.activeId) {
      return;
    }
    const time = hgGetNowTime();
    this.setState(
      (prevState) => ({
        draft: "",
        conversations: prevState.conversations.map((item) =>
          item.id === prevState.activeId
            ? {
                ...item,
                lastTime: time,
                messages: [
                  ...item.messages,
                  { id: `msg_me_${Date.now()}`, from: "me", text, time },
                ],
              }
            : item
        ),
      }),
      this.scheduleAutoReply
    );
  };

  /**
   * 输入框内按 Enter 发送消息；Shift+Enter 保留为换行。
   * @param {React.KeyboardEvent} event 键盘事件。
   */
  handleDraftKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
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
                    id: `msg_reply_${Date.now()}`,
                    from: "peer",
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
   * 渲染左侧会话列表的单个会话项。
   * @param {object} conversation 会话数据。
   * @returns {React.ReactNode} 会话项节点。
   */
  renderConversationItem = (conversation) => {
    const isActive = conversation.id === this.state.activeId;
    const lastMessage =
      conversation.messages[conversation.messages.length - 1];
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
            {lastMessage ? lastMessage.text : ""}
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
   * 渲染单条消息气泡；本人消息靠右绿色，对端消息靠左白色。
   * @param {object} message 消息数据。
   * @returns {React.ReactNode} 消息行节点。
   */
  renderMessageItem = (message) => {
    const isMine = message.from === "me";
    const rowClassName = `${CSStyles.messageRow} ${
      isMine ? CSStyles.messageRowMine : CSStyles.messageRowPeer
    }`;
    const bubbleClassName = `${CSStyles.messageBubble} ${
      isMine ? CSStyles.messageBubbleMine : CSStyles.messageBubblePeer
    }`;
    return (
      <div key={message.id} className={rowClassName}>
        <span className={CSStyles.messageAvatar}>{isMine ? "我" : "友"}</span>
        <div className={CSStyles.messageBody}>
          <span className={bubbleClassName}>{message.text}</span>
          <span className={CSStyles.messageTime}>{message.time}</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染右侧消息列表区；容器滚动由 scrollToBottom 维护。
   * @param {object} activeConversation 当前选中会话。
   * @returns {React.ReactNode} 消息列表节点。
   */
  renderMessageList = (activeConversation) => {
    return (
      <div className={CSStyles.messageList} ref={this.messageListRef}>
        {activeConversation.messages.map(this.renderMessageItem)}
      </div>
    );
  };

  /**
   * 渲染右侧底部输入区：多行输入框与发送按钮。
   * @returns {React.ReactNode} 输入区节点。
   */
  renderChatInput = () => {
    return (
      <div className={CSStyles.chatInputBar}>
        <textarea
          className={CSStyles.chatInput}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          value={this.state.draft}
          onChange={this.handleDraftChange}
          onKeyDown={this.handleDraftKeyDown}
        />
        <HGButtonPage
          type="primary"
          className={CSStyles.sendButton}
          disabled={!this.state.draft.trim()}
          onClick={this.handleSend}
        >
          发送
        </HGButtonPage>
      </div>
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
    const activeConversation = this.findConversation(
      this.state.conversations,
      this.state.activeId
    );
    if (!activeConversation) {
      return this.renderChatEmpty();
    }
    return (
      <section className={CSStyles.chatMain}>
        {this.renderChatHeader(activeConversation)}
        {this.renderMessageList(activeConversation)}
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
