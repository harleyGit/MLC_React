import React from "react";
import HGChatInput from "../../../components/hg_chat_input/hg_chat_input";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import HGIMCallPanel from "../../../components/hg_im_call/hg_im_call_panel";
import HGIMMessageList from "../../../components/hg_im_messages/hg_im_message_list";
import { hgFormatConversationTime } from "../../../components/hg_im_messages/hg_im_message_time.js";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import { logout } from "../../auth/hg_auth";
import styles from "./hg_home.module.css";
import HGHomeVM from "./hg_home_vm";
import { HG_IM_RECONNECT_EVENT } from "./hg_im_connection_events";

/** 真实单聊首页；pageNavigator 由既有导航框架注入，无默认值。 */
export default class HGHomePage extends React.Component {
  hgVM = null; // 挂载时创建，卸载/切换账号时关闭。
  hgMounted = false; // 防止异步回调覆盖卸载页面。
  hgCall = React.createRef(); // 来电指针交给独立通话控制组件。
  hgCreating = false; // 单聊创建防连点，不依赖异步 setState。
  hgClock = null; // 每分钟更新会话列表本地时间；卸载后停止。
  hgMenuRef = React.createRef(); // 当前会话操作浮层的边界；点击外部或按 Escape 关闭。
  state = {
    hgSnapshot: null, // VM 权威视图，初始 null 表示尚未启动。
    hgSearch: "", // 仅过滤当前已加载会话，不冒充服务端全量搜索。
    hgPeer: "", // 用户明确输入的对方 userId。
    hgCreating: false, // 创建单聊中的按钮状态。
    hgUpload: null, // 仅发送方本机的待审核气泡；null 表示没有未同步完的附件。
    hgNotice: "", // 页面操作结果或权限错误。
    hgInvalidOwner: false, // 账号切换/退出时清空聊天 DOM 和媒体设备。
    hgNow: new Date(), // 会话最近活动时间的本机显示基准，跨午夜或时区变更时更新。
    hgMenuId: "", // 当前打开的会话操作浮层 ID；空字符串表示关闭。
    hgConfirmDelete: false, // 删除双方三天前消息前需要明确二次确认。
    hgActionId: "", // 当前正在提交设置或分批清理的会话 ID；空字符串表示空闲。
  };

  componentDidMount() {
    this.hgMounted = true;
    if (import.meta.env.MODE !== "debug") return;
    this.hgVM = new HGHomeVM(
      (hgSnapshot) =>
        new Promise((hgResolve) => {
          if (!this.hgMounted) {
            hgResolve();
            return;
          }
          this.setState({ hgSnapshot }, hgResolve);
        }),
      (hgCallID) => this.hgCall.current?.hgHint(hgCallID)
    );
    window.addEventListener("storage", this.hgCheckOwner);
    window.addEventListener("hg:auth-changed", this.hgCheckOwner);
    window.addEventListener(HG_IM_RECONNECT_EVENT, this.hgReconnect);
    window.addEventListener("online", this.hgWake);
    document.addEventListener("visibilitychange", this.hgWake);
    window.addEventListener("focus", this.hgRefreshTime);
    document.addEventListener("mousedown", this.hgCloseMenuOutside);
    document.addEventListener("keydown", this.hgCloseMenuEscape);
    this.hgClock = window.setInterval(this.hgRefreshTime, 60 * 1000);
    void this.hgVM.hgStart().then(() => this.hgOpenContactConversation());
  }

  componentWillUnmount() {
    this.hgMounted = false;
    if (this.state.hgUpload?.url) URL.revokeObjectURL(this.state.hgUpload.url);
    this.hgVM?.hgClose();
    window.removeEventListener("storage", this.hgCheckOwner);
    window.removeEventListener("hg:auth-changed", this.hgCheckOwner);
    window.removeEventListener(HG_IM_RECONNECT_EVENT, this.hgReconnect);
    window.removeEventListener("online", this.hgWake);
    document.removeEventListener("visibilitychange", this.hgWake);
    window.removeEventListener("focus", this.hgRefreshTime);
    document.removeEventListener("mousedown", this.hgCloseMenuOutside);
    document.removeEventListener("keydown", this.hgCloseMenuEscape);
    window.clearInterval(this.hgClock);
  }

  hgCheckOwner = () => {
    if (this.hgVM && !this.hgVM.hgAlive()) {
      this.hgVM.hgClose();
      if (this.state.hgUpload?.url)
        URL.revokeObjectURL(this.state.hgUpload.url);
      if (this.hgMounted)
        this.setState({
          hgSnapshot: null,
          hgUpload: null,
          hgInvalidOwner: true,
        });
    }
  };

  hgWake = () => {
    this.hgCheckOwner();
    if (document.visibilityState === "visible") {
      this.hgRefreshTime();
      this.hgVM?.hgSchedule();
      void this.hgCall.current?.hgRefresh();
    }
  };

  /** 页面恢复或本地日历变化时重算会话时间，不改变服务端更新时间。 */
  hgRefreshTime = () => {
    if (this.hgMounted && document.visibilityState !== "hidden")
      this.setState({ hgNow: new Date() });
  };

  /** 顶栏再次点击 Chat 时复用当前 VM；首次进页由 hgStart 自动连接。 */
  hgReconnect = () => {
    if (this.hgVM?.hgAlive()) void this.hgVM.hgReconnect();
  };

  /** 操作统一捕获失败，具体服务端错误由 VM 映射，不把原始秘密响应带入 UI。 */
  hgRun = async (hgAction, hgName) => {
    try {
      await hgAction();
    } catch (hgError) {
      this.hgVM?.hgError(hgError, hgName);
    }
  };

  hgSelect = (hgID) => {
    this.setState({ hgMenuId: "", hgConfirmDelete: false });
    void this.hgRun(() => this.hgVM.hgSelect(hgID), "读取会话");
  };

  /** 联系人页仅导航并传 peerId；聊天页挂载并同步后由服务端创建/恢复权威会话。 */
  hgOpenContactConversation = async () => {
    const hgPeer = new URLSearchParams(this.props.location?.search || "").get("peerId"); // 无参数时维持默认会话。
    if (!hgPeer || !this.hgVM?.hgAlive() || this.hgCreating) return;
    this.hgCreating = true;
    this.setState({ hgCreating: true });
    try {
      await this.hgVM.hgCreateConversation(hgPeer);
      // 只消费一次来源参数；刷新聊天页不应无意恢复已删除的会话。
      if (this.hgMounted && this.hgVM.hgAlive()) {
        await this.props.pageNavigator.open({ page: PAGE.HOME, replace: true });
      }
    } catch (hgError) {
      this.hgVM.hgError(hgError, "打开好友聊天");
    } finally {
      this.hgCreating = false;
      if (this.hgMounted) this.setState({ hgCreating: false });
    }
  };

  /** 仅浮层外点击或 Escape 关闭；不改变当前聊天会话。 */
  hgCloseMenuOutside = (hgEvent) => {
    if (this.state.hgMenuId && !this.hgMenuRef.current?.contains(hgEvent.target))
      this.setState({ hgMenuId: "", hgConfirmDelete: false });
  };
  hgCloseMenuEscape = (hgEvent) => {
    if (hgEvent.key === "Escape" && this.state.hgMenuId)
      this.setState({ hgMenuId: "", hgConfirmDelete: false });
  };

  /** 更新服务端本人免打扰标志；失败时不提前改变图标状态。 */
  hgToggleMuted = async (hgConversation) => {
    if (this.state.hgActionId) return;
    this.setState({ hgActionId: hgConversation.conversationId, hgNotice: "" });
    try {
      await this.hgVM.hgSetMuted(hgConversation.conversationId, !hgConversation.muted);
      if (this.hgMounted) this.setState({ hgMenuId: "", hgConfirmDelete: false });
    } catch (hgError) {
      this.hgVM.hgError(hgError, "设置免打扰");
    } finally {
      if (this.hgMounted) this.setState({ hgActionId: "" });
    }
  };

  /** 分批清理双方三天以前的历史；只有服务端宣告完成后才从本人列表移除。 */
  hgDeleteConversation = async (hgID) => {
    if (this.state.hgActionId) return;
    this.setState({ hgActionId: hgID, hgNotice: "" });
    try {
      await this.hgVM.hgDeleteConversation(hgID);
      if (this.hgMounted) this.setState({ hgMenuId: "", hgConfirmDelete: false, hgNotice: "会话已移除；双方三天以前的消息已清理" });
    } catch (hgError) {
      if (this.hgMounted && hgError?.message?.includes("本次已清理部分"))
        this.setState({ hgNotice: "历史较多，本次已清理部分。请再次点击删除继续清理。" });
      else this.hgVM.hgError(hgError, "删除会话");
    } finally {
      if (this.hgMounted) this.setState({ hgActionId: "" });
    }
  };

  /** 切换会话时保留原会话的本机待发送气泡；确认消息进入窗口后释放本地预览。 */
  componentDidUpdate() {
    const hgUpload = this.state.hgUpload; // sent 仍等待连续补拉，不提前冒充已展示消息。
    if (
      hgUpload?.state === "sent" &&
      this.state.hgSnapshot?.messages.some(
        (hgMessage) => hgMessage.messageId === hgUpload.messageId
      )
    ) {
      this.hgUpdateUpload(null);
    }
  }

  hgUpdateUpload = (hgUpdate) => {
    if (!this.hgMounted) return;
    if (!hgUpdate) {
      if (this.state.hgUpload?.url)
        URL.revokeObjectURL(this.state.hgUpload.url);
      this.setState({ hgUpload: null });
      return;
    }
    if (hgUpdate.file) {
      if (this.state.hgUpload?.url)
        URL.revokeObjectURL(this.state.hgUpload.url);
      const hgURL = ["image", "video"].includes(hgUpdate.messageType)
        ? URL.createObjectURL(hgUpdate.file)
        : ""; // 只用于本机未审核预览。
      this.setState({
        hgUpload: {
          ...hgUpdate,
          url: hgURL,
          fileName: hgUpdate.file.name || "录音",
          fileSize: hgUpdate.file.size, // 文件卡片展示大小；录音 Blob 也有真实字节数。
          file: undefined,
        },
      });
    } else {
      this.setState((hgPrevious) =>
        hgPrevious.hgUpload?.clientMsgId === hgUpdate.clientMsgId
          ? { hgUpload: { ...hgPrevious.hgUpload, ...hgUpdate } }
          : null
      );
    }
  };

  hgCreate = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgCreating || !this.state.hgPeer.trim()) return;
    this.hgCreating = true;
    this.setState({ hgCreating: true, hgNotice: "" });
    try {
      await this.hgVM.hgCreateConversation(this.state.hgPeer);
      if (this.hgMounted) this.setState({ hgPeer: "" });
    } catch (hgError) {
      this.hgVM.hgError(hgError, "创建单聊");
    } finally {
      this.hgCreating = false;
      if (this.hgMounted) this.setState({ hgCreating: false });
    }
  };

  /** 登出前尝试释放本机通话和设备；服务端失败不谎报撤销，但仍允许用户结束本地登录。 */
  hgLogout = async () => {
    this.hgCall.current?.hgDisconnect();
    try {
      await this.hgVM?.hgRevoke();
    } catch {
      if (this.hgMounted)
        this.setState({
          hgNotice: "设备撤销未确认；可重试撤销或直接退出本地登录。",
        });
      return;
    }
    logout();
    window.location.href = "/login";
  };

  hgDeleteMedia = async (hgMessage) => {
    try {
      await this.hgVM.hgAPI.hgMediaDelete(hgMessage.content.mediaId);
      if (this.hgMounted)
        this.setState({
          hgNotice: "附件已撤销，后续读取将被拒绝；当前配额尚不自动返还。",
        });
      return true;
    } catch (hgError) {
      this.hgVM.hgError(hgError, "撤销附件");
      return false;
    }
  };

  renderSidebar() {
    const hgSnapshot = this.state.hgSnapshot; // VM 已加载会话与分页状态。
    const hgKeyword = this.state.hgSearch.trim().toLowerCase(); // 本地过滤，不发起全表搜索。
    const hgConversations = (hgSnapshot?.conversations || []).filter((hgItem) =>
      `${hgItem.peer.name} ${hgItem.peer.userId}`
        .toLowerCase()
        .includes(hgKeyword)
    );
    return (
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>聊天</span>
          <button
            type="button"
            className={styles.sidebarAction}
            onClick={() =>
              this.props.pageNavigator.open({ page: PAGE.USER_PROFILE })
            }
          >
            资料
          </button>
          <button
            type="button"
            className={styles.sidebarIconBtn}
            aria-label="添加联系人"
            title="添加联系人"
            onClick={() =>
              this.props.pageNavigator.open({ page: PAGE.ADD_CONTACT })
            }
          >
            <HGIconPage
              type="add-user"
              style={{ fontSize: 18, color: "inherit" }}
            />
          </button>
        </div>
        <div className={styles.searchBox}>
          <input
            className={styles.searchInput}
            aria-label="过滤已加载会话"
            placeholder="过滤已加载会话"
            value={this.state.hgSearch}
            onChange={(hgEvent) =>
              this.setState({ hgSearch: hgEvent.target.value })
            }
          />
        </div>
        <form className={styles.createForm} onSubmit={this.hgCreate}>
          <input
            aria-label="对方用户ID"
            placeholder="输入对方用户ID"
            value={this.state.hgPeer}
            maxLength={128}
            onChange={(hgEvent) =>
              this.setState({ hgPeer: hgEvent.target.value })
            }
          />
          <button
            type="submit"
            disabled={
              !hgSnapshot || this.state.hgCreating || !this.state.hgPeer.trim()
            }
          >
            新建单聊
          </button>
        </form>
        <div className={styles.conversationList}>
          {hgConversations.map((hgConversation) => (
            <div key={hgConversation.conversationId} className={styles.conversationWrap}
              ref={this.state.hgMenuId === hgConversation.conversationId ? this.hgMenuRef : null}>
            <button
              type="button"
              className={`${styles.conversationItem} ${
                hgSnapshot.activeId === hgConversation.conversationId
                  ? styles.conversationItemActive
                  : ""
              }`}
              aria-pressed={
                hgSnapshot.activeId === hgConversation.conversationId
              }
              onClick={() => this.hgSelect(hgConversation.conversationId)}
            >
              <span
                className={styles.conversationAvatar}
                style={{ backgroundColor: "#5b8def" }}
              >
                {[...hgConversation.peer.name][0] || "友"}
              </span>
              <span className={styles.conversationInfo}>
                <span className={styles.conversationTopRow}>
                  <span className={styles.conversationName}>{hgConversation.peer.name}</span>
                  {hgConversation.muted && <span className={styles.mutedBadge} title="免打扰">免打扰</span>}
                  <time className={styles.conversationTime} dateTime={hgConversation.updatedAt}>
                    {hgFormatConversationTime(hgConversation.updatedAt, this.state.hgNow)}
                  </time>
                </span>
                <span className={styles.conversationPreview}>
                  会话 {hgConversation.conversationId} · 最新序号{" "}
                  {hgConversation.lastSeq}
                </span>
              </span>
            </button>
            <button type="button" className={styles.conversationMore} aria-label={`管理${hgConversation.peer.name}的会话`}
              aria-expanded={this.state.hgMenuId === hgConversation.conversationId}
              onClick={() => this.setState((hgPrevious) => ({
                hgMenuId: hgPrevious.hgMenuId === hgConversation.conversationId ? "" : hgConversation.conversationId,
                hgConfirmDelete: false,
              }))}>
              ⋯
            </button>
            {this.state.hgMenuId === hgConversation.conversationId && (
              <div className={styles.conversationMenu} role="group" aria-label="会话操作">
                <button type="button" disabled={!!this.state.hgActionId}
                  onClick={() => void this.hgToggleMuted(hgConversation)}>
                  {hgConversation.muted ? "关闭免打扰" : "免打扰"}
                </button>
                {this.state.hgConfirmDelete ? (
                  <div className={styles.conversationConfirm}>
                    <p>确定删除？双方三天以前的聊天记录将永久删除，无法撤销。</p>
                    <button type="button" disabled={!!this.state.hgActionId}
                      onClick={() => void this.hgDeleteConversation(hgConversation.conversationId)}>确认删除</button>
                    <button type="button" disabled={!!this.state.hgActionId}
                      onClick={() => this.setState({ hgConfirmDelete: false })}>取消</button>
                  </div>
                ) : (
                  <button type="button" disabled={!!this.state.hgActionId}
                    onClick={() => this.setState({ hgConfirmDelete: true })}>删除会话</button>
                )}
                {this.state.hgActionId === hgConversation.conversationId && <span role="status">处理中…</span>}
              </div>
            )}
            </div>
          ))}
          {!hgConversations.length && (
            <div className={styles.conversationEmpty}>
              {hgSnapshot?.loading
                ? "正在读取会话…"
                : "暂无会话，可输入用户ID创建单聊"}
            </div>
          )}
          {hgSnapshot?.moreConversations && (
            <button
              type="button"
              disabled={hgSnapshot.conversations.length >= 300}
              onClick={() =>
                void this.hgRun(
                  () => this.hgVM.hgLoadConversations(true),
                  "会话翻页"
                )
              }
            >
              加载更多会话（最多300个）
            </button>
          )}
        </div>
      </aside>
    );
  }

  renderStatus() {
    const hgSnapshot = this.state.hgSnapshot; // 网络连接不等于端到端已送达。
    return (
      <div className={styles.connectionBar}>
        <span role="status">{hgSnapshot?.realtime || "初始化中"}</span>
        <button type="button" onClick={() => this.hgVM.hgSchedule()}>
          同步消息
        </button>
        {(hgSnapshot?.error || this.state.hgNotice) && (
          <p role="alert">
            {hgSnapshot?.error || this.state.hgNotice}
            {this.state.hgNotice.includes("退出本地") && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
              >
                仅退出本地登录
              </button>
            )}
          </p>
        )}
      </div>
    );
  }

  renderChat() {
    const hgSnapshot = this.state.hgSnapshot; // 当前窗口与成员信息由 Go 返回。
    const hgConversation = hgSnapshot?.conversations.find(
      (hgItem) => hgItem.conversationId === hgSnapshot.activeId
    );
    return (
      <section className={styles.chatMain}>
        {this.renderStatus()}
        {this.hgVM && (
          <HGIMCallPanel
            ref={this.hgCall}
            vm={this.hgVM}
            deviceReady={hgSnapshot?.deviceReady || false}
            conversationId={hgSnapshot?.activeId || ""}
          />
        )}
        {hgConversation ? (
          <>
            <header className={styles.chatHeader}>
              <strong className={styles.chatHeaderName}>
                {hgConversation.peer.name}
              </strong>
              <button
                type="button"
                onClick={() =>
                  void this.hgRun(() => this.hgVM.hgMarkRead(), "标记已读")
                }
              >
                标记当前及此前已读
              </button>
            </header>
            <div className={styles.historyControls}>
              <button
                type="button"
                disabled={hgSnapshot.loading}
                onClick={() =>
                  void this.hgRun(
                    () => this.hgVM.hgHistory("latest"),
                    "最新消息"
                  )
                }
              >
                回到最新
              </button>
              <span>
                {hgSnapshot.loading
                  ? "加载中…"
                  : `${this.hgVM.hgFollow ? "最新" : "历史"}窗口 · ${
                      hgSnapshot.messages.length
                    }条`}
              </span>
            </div>
            <HGIMMessageList
              key={hgSnapshot.activeId}
              messages={hgSnapshot.messages}
              latestSeq={hgConversation.lastSeq}
              loading={hgSnapshot.loading}
              onHistory={(hgDirection) => this.hgVM.hgHistory(hgDirection)}
              onHistoryError={(hgError) =>
                this.hgVM.hgError(hgError, "历史翻页")
              }
              peerName={hgConversation.peer.name}
              upload={
                this.state.hgUpload?.conversationId === hgSnapshot.activeId
                  ? this.state.hgUpload
                  : null
              }
              api={this.hgVM.hgAPI}
              onDelete={this.hgDeleteMedia}
            />
            <HGChatInput
              api={this.hgVM.hgAPI}
              conversationId={hgSnapshot.activeId}
              onSend={(hgCommand) => this.hgVM.hgSend(hgCommand)}
              onCall={(hgMediaType) =>
                void this.hgCall.current?.hgCreate(hgMediaType)
              }
              callReady={hgSnapshot.deviceReady}
              onUploadChange={this.hgUpdateUpload}
              disabled={!this.hgVM.hgAlive()}
            />
          </>
        ) : (
          <div className={styles.chatEmpty}>选择会话或创建单聊</div>
        )}
      </section>
    );
  }

  render() {
    if (import.meta.env.MODE !== "debug")
      return (
        <div className={styles.chatEmpty}>
          IM 当前仅在隔离 debug 环境开放，pre/release 尚未启用。
        </div>
      );
    if (this.state.hgInvalidOwner)
      return (
        <div className={styles.chatEmpty}>
          登录账号已变化，聊天和媒体连接已关闭，请重新打开页面。
        </div>
      );
    return (
      <div className={styles.container}>
        {this.renderSidebar()}
        {this.renderChat()}
      </div>
    );
  }
}
