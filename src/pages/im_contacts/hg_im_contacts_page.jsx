/*
 * @Description: 联系人页面，模仿微信电脑端通讯录：左侧联系人列表 + 右侧资料详情与编辑。
 * 职责：维护联系人/群组/好友申请/黑名单四类数据的选择、搜索、接受申请、资料修改、拉黑与删除等交互。
 * 约束：视图分类（联系人/新的朋友/群组）由个人中心「即时通信」菜单 children 通过 hgInitialFilter 下发；
 *       联系人数据通过 VM 真实接口获取，服务端失败时不伪造成功关系。
 */
import React, { Component } from "react";
import styles from "./hg_im_contacts_page.module.css";
import HGImContactsVM from "./hg_im_contacts_vm";
import { PAGE } from "../../components/hg_navigation/hg_page_registry";

/** 合法的视图过滤器集合：与「即时通信」菜单 children 的 key 一一对应。 */
const VALID_FILTERS = ["contacts", "requests", "groups"];

/**
 * 联系人页面组件。
 * 约束：类组件实现；JSX 按 renderXxx 拆分，render 只负责组装；隐私字段仅做展示不做持久化。
 * @param {string} hgInitialFilter 初始视图过滤器（contacts/requests/groups），切换菜单时通过 props 更新。
 */
class HGImContactsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      friends: [],
      groups: [],
      requests: [],
      blocked: [],
      keyword: "",
      activeFilter: VALID_FILTERS.includes(props.hgInitialFilter)
        ? props.hgInitialFilter
        : "contacts",
      selected: null, // { type: 'friend' | 'group' | 'blocked' | 'request', id }
      editing: false,
      editForm: null, // { remark, tags, phone, description }
      confirmAction: null, // 'delete' | 'block'，触发前需二次确认
      toast: "",
      error: "", // 空值表示加载正常，非空时展示错误及重试入口。
      saving: false, // 写操作进行中禁用重复提交。
      searchType: "public_id", // 新好友精确搜索类型，默认公开系统 ID，可切换自定义 ID。
      searchValue: "", // 精确搜索输入；空值不调用服务端。
      searchResult: null, // 搜索到的公开资料；null 表示尚无结果或已经清空。
      requestMessage: "", // 申请附言，默认不填写，最多 128 字符。
    };
    this.toastTimer = null;
    this.hgUnmounted = false; // 卸载后忽略旧请求响应。
  }

  componentDidMount() {
    this.loadContacts();
  }

  /**
   * 响应菜单切换：个人中心「即时通信」children 切换时同步视图过滤器并重置选中项。
   * @param {Object} prevProps 上一次的 props。
   */
  componentDidUpdate(prevProps) {
    const nextFilter = this.props.hgInitialFilter;
    if (
      nextFilter !== prevProps.hgInitialFilter &&
      VALID_FILTERS.includes(nextFilter) &&
      nextFilter !== this.state.activeFilter
    ) {
      this.setState((prevState) => ({
        activeFilter: nextFilter,
        editing: false,
        editForm: null,
        confirmAction: null,
        selected: this.pickDefaultSelection(nextFilter, prevState),
      }));
    }
  }

  componentWillUnmount() {
    this.hgUnmounted = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  /**
   * 根据视图过滤器挑选默认选中项，避免右侧详情区空白。
   * @param {string} filter 当前视图过滤器。
   * @param {{friends: Array, groups: Array, requests: Array}} data 联系人模块数据。
   * @returns {Object|null} 默认选中目标。
   */
  pickDefaultSelection = (filter, data) => {
    if (filter === "requests") {
      const first = data.requests[0];
      return first ? { type: "request", id: first.requestId } : null;
    }
    if (filter === "groups") {
      const first = data.groups[0];
      return first ? { type: "group", id: first.groupId } : null;
    }
    const first = data.friends[0];
    return first ? { type: "friend", id: first.userId } : null;
  };

  /**
   * 加载联系人模块数据，并按当前视图过滤器选中默认项。
   */
  loadContacts = async () => {
    this.setState({ loading: true, error: "" });
    try {
      const data = await HGImContactsVM.fetchContacts();
      if (this.hgUnmounted) return;
      this.setState((state) => ({
        loading: false,
        error: "",
        ...data,
        selected: this.pickDefaultSelection(state.activeFilter, data),
      }));
    } catch {
      if (!this.hgUnmounted)
        this.setState({ loading: false, error: "联系人加载失败，请重试" });
    }
  };

  /**
   * 展示轻提示，2.4 秒后自动消失。
   * @param {string} message 提示文案。
   */
  showToast = (message) => {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setState({ toast: message });
    this.toastTimer = setTimeout(() => {
      this.setState({ toast: "" });
      this.toastTimer = null;
    }, 2400);
  };

  /**
   * 根据当前选中项查找完整数据对象。
   * @returns {Object|null} 选中对象（好友/群组/黑名单/申请），未选中返回 null。
   */
  getSelectedItem = () => {
    const { selected, friends, groups, blocked, requests } = this.state;
    if (!selected) return null;
    if (selected.type === "friend") {
      return friends.find((item) => item.userId === selected.id) || null;
    }
    if (selected.type === "group") {
      return groups.find((item) => item.groupId === selected.id) || null;
    }
    if (selected.type === "blocked") {
      return blocked.find((item) => item.userId === selected.id) || null;
    }
    return requests.find((item) => item.requestId === selected.id) || null;
  };

  /**
   * 计算当前过滤器与关键字下，中间列表应展示的分组。
   * @returns {Array<{key: string, title: string, type: string, items: Array}>} 列表分组配置。
   */
  getListSections = () => {
    const { friends, groups, requests, blocked, keyword, activeFilter } =
      this.state;
    const trimmed = keyword.trim();
    const sections = [];

    const matchedFriends = friends.filter((item) =>
      HGImContactsVM.matchKeyword(item, trimmed)
    );
    const matchedGroups = groups.filter((item) =>
      HGImContactsVM.matchKeyword(item, trimmed)
    );

    if (activeFilter === "requests") {
      sections.push({
        key: "requests",
        title: "新的朋友",
        type: "request",
        items: requests,
      });
      return sections;
    }
    if (activeFilter === "groups") {
      sections.push({
        key: "groups",
        title: "我的群组",
        type: "group",
        items: matchedGroups,
      });
      return sections;
    }

    // 联系人视图：无关键字时展示「新的朋友」入口，有关键字时聚焦搜索结果。
    if (!trimmed && requests.length > 0) {
      sections.push({
        key: "requests",
        title: "新的朋友",
        type: "request",
        items: requests,
      });
    }
    const letterGroups = HGImContactsVM.groupFriendsByLetter(
      matchedFriends
    ).map((group) => ({
      key: `letter-${group.letter}`,
      title: group.letter,
      type: "friend",
      items: group.items,
    }));
    sections.push(...letterGroups);
    if (matchedGroups.length > 0) {
      sections.push({
        key: "groups",
        title: trimmed ? "群组搜索结果" : "我的群组",
        type: "group",
        items: matchedGroups,
      });
    }
    if (blocked.length > 0 && !trimmed)
      sections.push({
        key: "blocked",
        title: "黑名单",
        type: "blocked",
        items: blocked,
      });
    return sections;
  };

  /**
   * 搜索框输入回调。
   * @param {React.ChangeEvent<HTMLInputElement>} event 输入事件。
   */
  handleKeywordChange = (event) => {
    this.setState({ keyword: event.target.value });
  };

  /**
   * 列表项点击回调：更新选中项并退出编辑态。
   * @param {{type: string, id: string}} target 选中目标。
   */
  handleSelect = (target) => {
    this.setState({ selected: target, editing: false, confirmAction: null });
  };

  /** 进入编辑态：以当前好友资料初始化编辑表单。 */
  handleEditOpen = () => {
    const friend = this.getSelectedItem();
    if (!friend) return;
    this.setState({
      editing: true,
      confirmAction: null,
      editForm: {
        remark: friend.remark || "",
        tags: (friend.tags || []).join("、"),
        phone: friend.phone || "",
        description: friend.description || "",
      },
    });
  };

  /** 取消编辑：退出编辑态并丢弃未保存的表单内容。 */
  handleEditCancel = () => {
    this.setState({ editing: false, editForm: null });
  };

  /**
   * 编辑表单字段变更。
   * @param {string} field 字段名。
   * @param {string} value 新值。
   */
  handleEditFieldChange = (field, value) => {
    this.setState((prevState) => ({
      editForm: { ...prevState.editForm, [field]: value },
    }));
  };

  /** 保存编辑：服务端成功后才同步本地好友列表。 */
  handleEditSave = async () => {
    if (this.state.saving) return;
    const { editForm } = this.state;
    const friend = this.getSelectedItem();
    if (!friend || !editForm) return;
    const patch = {
      remark: editForm.remark.trim(),
      tags: editForm.tags
        .split(/[、,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
      phone: editForm.phone.trim(),
      description: editForm.description.trim(),
    };
    this.setState({ saving: true });
    try {
      await HGImContactsVM.saveFriendProfile(friend.userId, patch);
      if (this.hgUnmounted) return;
      this.setState((state) => ({
        editing: false,
        editForm: null,
        friends: state.friends.map((item) =>
          item.userId === friend.userId ? { ...item, ...patch } : item
        ),
      }));
      this.showToast("联系人资料已更新");
    } catch {
      if (!this.hgUnmounted) this.showToast("保存失败，请重试");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /**
   * 接受好友申请：仅依据服务端确认的好友资料更新列表。
   * @param {Object} request 好友申请对象。
   */
  handleAcceptRequest = async (request) => {
    if (this.state.saving) return;
    this.setState({ saving: true });
    try {
      const newFriend = await HGImContactsVM.acceptFriendRequest(request);
      if (this.hgUnmounted) return;
      if (!newFriend) {
        await this.loadContacts();
        this.showToast("已接受申请，请刷新好友列表");
        return;
      }
      this.setState((state) => {
        const requests = state.requests.filter(
          (item) => item.requestId !== request.requestId
        );
        return {
          requests,
          friends: state.friends.some(
            (item) => item.userId === newFriend.userId
          )
            ? state.friends
            : [...state.friends, newFriend],
          selected:
            state.selected?.id === request.requestId
              ? this.pickDefaultSelection(state.activeFilter, {
                  ...state,
                  requests,
                })
              : state.selected,
        };
      });
      this.showToast(
        `已添加 ${HGImContactsVM.getDisplayName(newFriend)} 为联系人`
      );
    } catch {
      if (!this.hgUnmounted) this.showToast("接受申请失败，请重试");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /**
   * 拒绝好友申请：仅移除申请记录，保留历史由服务端负责。
   * @param {Object} request 好友申请对象。
   */
  handleRejectRequest = async (request) => {
    if (this.state.saving) return;
    this.setState({ saving: true });
    try {
      await HGImContactsVM.rejectFriendRequest(request);
      if (this.hgUnmounted) return;
      this.setState((state) => {
        const requests = state.requests.filter(
          (item) => item.requestId !== request.requestId
        );
        return {
          requests,
          selected:
            state.selected?.id === request.requestId
              ? this.pickDefaultSelection(state.activeFilter, {
                  ...state,
                  requests,
                })
              : state.selected,
        };
      });
      this.showToast("已拒绝该好友申请");
    } catch {
      if (!this.hgUnmounted) this.showToast("拒绝申请失败，请重试");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /** 进入删除好友确认态。 */
  handleDeleteConfirm = () => {
    this.setState({ confirmAction: "delete" });
  };

  /** 进入拉黑确认态。 */
  handleBlockConfirm = () => {
    this.setState({ confirmAction: "block" });
  };

  /** 取消二次确认。 */
  handleConfirmCancel = () => {
    this.setState({ confirmAction: null });
  };

  /**
   * 执行二次确认的操作：删除好友或加入黑名单。
   * 约束：服务端提交后才移除本地关系；删除好友保留历史聊天。
   */
  handleConfirmExecute = async () => {
    if (this.state.saving) return;
    const { confirmAction } = this.state;
    const friend = this.getSelectedItem();
    if (!friend || !confirmAction) {
      this.setState({ confirmAction: null });
      return;
    }
    this.setState({ saving: true });
    let committed = false; // 服务端写入成功后，列表二次读取失败不能误报成写入失败。
    try {
      if (confirmAction === "delete")
        await HGImContactsVM.deleteFriend(friend.userId);
      else await HGImContactsVM.blockFriend(friend.userId);
      committed = true;
      const blocked =
        confirmAction === "block"
          ? await HGImContactsVM.fetchBlocked()
          : this.state.blocked;
      if (this.hgUnmounted) return;
      this.setState((state) => {
        const friends = state.friends.filter(
          (item) => item.userId !== friend.userId
        );
        return {
          friends,
          blocked,
          selected:
            state.selected?.id === friend.userId
              ? this.pickDefaultSelection(state.activeFilter, {
                  ...state,
                  friends,
                })
              : state.selected,
          confirmAction: null,
        };
      });
      this.showToast(
        confirmAction === "delete"
          ? "已删除联系人，历史聊天记录仍保留"
          : "已加入黑名单"
      );
    } catch {
      if (!this.hgUnmounted) {
        if (committed) {
          this.setState({ confirmAction: null });
          this.loadContacts();
        }
        this.showToast(
          committed
            ? "操作已提交，列表刷新失败，请重试"
            : "操作失败，请刷新后重试"
        );
      }
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /**
   * 解除拉黑不会恢复好友，重新成为好友需双方同意。
   * @param {Object} record 黑名单记录。
   */
  handleUnblock = async (record) => {
    if (this.state.saving) return;
    this.setState({ saving: true });
    try {
      await HGImContactsVM.unblockFriend(record.userId);
      if (this.hgUnmounted) return;
      this.setState((state) => {
        const blocked = state.blocked.filter(
          (item) => item.userId !== record.userId
        );
        return {
          blocked,
          selected:
            state.selected?.id === record.userId
              ? state.activeFilter === "contacts" && blocked[0]
                ? { type: "blocked", id: blocked[0].userId }
                : this.pickDefaultSelection(state.activeFilter, state)
              : state.selected,
        };
      });
      this.showToast("已解除拉黑；重新成为好友需双方同意");
    } catch {
      if (!this.hgUnmounted) this.showToast("解除拉黑失败，请重试");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /** 好友单聊交给聊天页创建/恢复；不在联系人页伪造会话。 */
  handleStartChat = (friend) => {
    if (!friend?.userId || import.meta.env.MODE !== "debug") {
      this.showToast("聊天当前仅在 debug 环境开放");
      return;
    }
    try {
      void Promise.resolve(this.props.pageNavigator.open({
        page: PAGE.HOME,
        params: { peerId: friend.userId },
      })).catch(() => {
        if (!this.hgUnmounted) this.showToast("打开聊天失败，请重试");
      });
    } catch {
      this.showToast("打开聊天失败，请重试");
    }
  };

  /** 搜索公开身份；不把精确搜索降级为手机号/邮箱枚举。 */
  handleSearchUser = async () => {
    const { searchType, searchValue, saving } = this.state;
    if (saving || !searchValue.trim()) return;
    this.setState({ saving: true, searchResult: null });
    try {
      const result = await HGImContactsVM.searchUser(
        searchType,
        searchValue.trim()
      );
      if (!this.hgUnmounted) this.setState({ searchResult: result });
    } catch {
      if (!this.hgUnmounted) this.showToast("未找到用户或搜索失败");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /** 发送附言并等待对方同意，绝不在本地直接创建好友。 */
  handleSendRequest = async () => {
    const { searchResult, requestMessage, saving } = this.state;
    if (!searchResult || saving) return;
    this.setState({ saving: true });
    try {
      await HGImContactsVM.sendFriendRequest(
        searchResult.userId,
        requestMessage.trim()
      );
      if (!this.hgUnmounted) {
        this.setState({ searchResult: null, requestMessage: "" });
        if (searchResult.friendStatus === "incoming_pending")
          await this.loadContacts();
        this.showToast(
          searchResult.friendStatus === "incoming_pending"
            ? "双方已同意，好友列表已刷新"
            : "申请已发送，等待对方同意"
        );
      }
    } catch {
      if (!this.hgUnmounted) this.showToast("申请失败或双方已有待处理关系");
    } finally {
      if (!this.hgUnmounted) this.setState({ saving: false });
    }
  };

  /** 联系人列表的添加好友入口，复用当前页面而非新增路由。 */
  renderAddFriend = () => {
    const { searchType, searchValue, searchResult, requestMessage, saving } =
      this.state;
    return (
      <div className={styles.searchWrap}>
        <select
          className={styles.searchInput}
          aria-label="搜索方式"
          value={searchType}
          onChange={(event) =>
            this.setState({
              searchType: event.target.value,
              searchResult: null,
            })
          }
        >
          <option value="public_id">系统 ID</option>
          <option value="username">自定义 ID</option>
        </select>
        <input
          className={styles.searchInput}
          aria-label="添加好友 ID"
          value={searchValue}
          maxLength={255}
          onChange={(event) =>
            this.setState({
              searchValue: event.target.value,
              searchResult: null,
            })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") this.handleSearchUser();
          }}
          placeholder="精确搜索 ID"
        />
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={this.handleSearchUser}
          disabled={saving || !searchValue.trim()}
        >
          查找用户
        </button>
        {searchResult && (
          <div className={styles.messageCard}>
            {this.renderAvatar(
              searchResult,
              searchResult.userId,
              styles.avatarMedium
            )}
            <p>
              {searchResult.nickname || searchResult.publicId} ·{" "}
              {searchResult.publicId}
            </p>
            <input
              className={styles.searchInput}
              aria-label="好友申请附言"
              value={requestMessage}
              maxLength={128}
              onChange={(event) =>
                this.setState({ requestMessage: event.target.value })
              }
              placeholder="填写申请附言（可选）"
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={this.handleSendRequest}
              disabled={
                saving ||
                !["none", "incoming_pending"].includes(
                  searchResult.friendStatus
                )
              }
            >
              {searchResult.friendStatus === "incoming_pending"
                ? "同意对方申请"
                : "发送申请"}
            </button>
            {searchResult.friendStatus !== "none" && (
              <p>当前状态：{searchResult.friendStatus}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染头像：优先使用用户资料中的 URL；缺失或加载失败时展示首字占位。
   * @param {Object} contact 联系人或群组对象。
   * @param {string} seed 取色标识。
   * @param {string} sizeClass 尺寸样式类。
   * @returns {React.ReactNode} 头像节点。
   */
  renderAvatar = (contact, seed, sizeClass) => (
    <div
      className={`${styles.avatar} ${sizeClass}`}
      style={{ backgroundColor: HGImContactsVM.getAvatarColor(seed) }}
    >
      {HGImContactsVM.getAvatarText(contact)}
      {contact?.avatarUrl && (
        <img
          key={contact.avatarUrl}
          className={styles.avatarImage}
          src={contact.avatarUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );

  /**
   * 渲染中间联系人列表：搜索框 + 分组列表（新的朋友 / 字母分组 / 群组）。
   * @returns {React.ReactNode} 列表节点。
   */
  renderListPane = () => {
    const { keyword, loading, error } = this.state;
    const sections = this.getListSections();
    const hasContent = sections.some((section) => section.items.length > 0);

    return (
      <div className={styles.listPane}>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="text"
            value={keyword}
            onChange={this.handleKeywordChange}
            placeholder="搜索联系人 / 群组 / ID"
          />
        </div>
        {this.state.activeFilter === "contacts" && this.renderAddFriend()}
        <div className={styles.listScroll}>
          {loading && <p className={styles.listTip}>联系人加载中…</p>}
          {error && (
            <p className={styles.listTip}>
              {error}{" "}
              <button type="button" onClick={this.loadContacts}>
                重试
              </button>
            </p>
          )}
          {!loading && !error && !hasContent && (
            <p className={styles.listTip}>
              {keyword.trim()
                ? "没有匹配的联系人或群组"
                : this.state.activeFilter === "groups"
                ? "群组接口尚未接入"
                : "暂无内容"}
            </p>
          )}
          {!loading &&
            !error &&
            sections.map((section) => {
              if (section.items.length === 0) return null;
              return (
                <div key={section.key} className={styles.section}>
                  <div className={styles.sectionTitle}>{section.title}</div>
                  {section.items.map((item) =>
                    this.renderListRow(section.type, item)
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  /**
   * 渲染单条列表行：头像 + 展示名 + 辅助信息。
   * @param {string} type 行类型（friend/group/request）。
   * @param {Object} item 行数据。
   * @returns {React.ReactNode} 列表行节点。
   */
  renderListRow = (type, item) => {
    const { selected } = this.state;
    const rowId =
      type === "group"
        ? item.groupId
        : type === "request"
        ? item.requestId
        : item.userId;
    const isActive =
      selected &&
      selected.type === type &&
      String(selected.id) === String(rowId);
    const displayName = HGImContactsVM.getDisplayName(item);
    const seed = type === "group" ? item.groupId : item.userId;
    const subText =
      type === "group"
        ? `${item.memberCount} 人`
        : type === "request"
        ? new Date(item.createdAt).toLocaleString("zh-CN")
        : item.nickname !== displayName
        ? `昵称：${item.nickname}`
        : item.username || item.publicId || "";
    return (
      <button
        key={rowId}
        type="button"
        className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
        onClick={() => this.handleSelect({ type, id: rowId })}
      >
        {this.renderAvatar(item, seed, styles.avatarMedium)}
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{displayName}</span>
          {subText && <span className={styles.rowSub}>{subText}</span>}
        </span>
        {item.starred && <span className={styles.rowStar}>星标</span>}
      </button>
    );
  };

  /**
   * 渲染右侧详情区：按选中类型分发到好友/群组/申请/黑名单/空态。
   * @returns {React.ReactNode} 详情节点。
   */
  renderDetailPane = () => {
    const { loading, selected } = this.state;
    if (loading) {
      return (
        <div className={styles.detailPane}>
          <p className={styles.emptyText}>加载中…</p>
        </div>
      );
    }
    if (!selected) {
      return (
        <div className={styles.detailPane}>
          {this.renderEmptyState("选择一个联系人或群组查看资料")}
        </div>
      );
    }
    const item = this.getSelectedItem();
    if (!item) {
      return (
        <div className={styles.detailPane}>
          {this.renderEmptyState("该内容已被移除，请选择其他联系人")}
        </div>
      );
    }
    if (selected.type === "group") {
      return (
        <div className={styles.detailPane}>{this.renderGroupDetail(item)}</div>
      );
    }
    if (selected.type === "request") {
      return (
        <div className={styles.detailPane}>
          {this.renderRequestDetail(item)}
        </div>
      );
    }
    if (selected.type === "blocked") {
      return (
        <div className={styles.detailPane}>
          {this.renderBlockedDetail(item)}
        </div>
      );
    }
    return (
      <div className={styles.detailPane}>{this.renderFriendDetail(item)}</div>
    );
  };

  /**
   * 渲染空态提示。
   * @param {string} text 提示文案。
   * @returns {React.ReactNode} 空态节点。
   */
  renderEmptyState = (text) => (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>💬</div>
      <p className={styles.emptyText}>{text}</p>
    </div>
  );

  /**
   * 渲染好友详情：头部资料卡 + 信息列表 + 操作按钮 + 危险区（删除/拉黑二次确认）。
   * @param {Object} friend 好友对象。
   * @returns {React.ReactNode} 好友详情节点。
   */
  renderFriendDetail = (friend) => {
    const { editing, editForm, confirmAction } = this.state;
    const displayName = HGImContactsVM.getDisplayName(friend);
    const infoRows = [
      { label: "备注名", value: friend.remark },
      { label: "系统 ID", value: friend.publicId },
      { label: "自定义 ID", value: friend.username },
      { label: "手机号", value: friend.phone || "未提供" },
      { label: "邮箱", value: friend.email || "未提供" },
      { label: "地区", value: friend.region },
      { label: "个性签名", value: friend.signature || "暂无签名" },
      { label: "来源", value: friend.source },
      { label: "添加时间", value: friend.friendSince },
      { label: "描述", value: friend.description },
    ].filter((row) => row.value);

    return (
      <div className={styles.detailScroll}>
        <div className={styles.detailHeader}>
          {this.renderAvatar(friend, friend.userId, styles.avatarLarge)}
          <div className={styles.detailHeaderMain}>
            <div className={styles.detailNameRow}>
              <span className={styles.detailName}>{displayName}</span>
              {friend.starred && (
                <span className={styles.starBadge}>★ 星标联系人</span>
              )}
            </div>
            <p className={styles.detailMeta}>
              {friend.nickname !== displayName
                ? `昵称：${friend.nickname} · `
                : ""}
              自定义 ID：{friend.username || "未设置"}
            </p>
          </div>
        </div>

        {editing && editForm ? (
          this.renderEditForm(editForm, friend)
        ) : (
          <>
            <div className={styles.infoCard}>
              {infoRows.map((row) => (
                <div key={row.label} className={styles.infoRow}>
                  <span className={styles.infoLabel}>{row.label}</span>
                  <span className={styles.infoValue}>{row.value}</span>
                </div>
              ))}
              {friend.tags && friend.tags.length > 0 && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>标签</span>
                  <span className={styles.infoValue}>
                    {friend.tags.map((tag) => (
                      <span key={tag} className={styles.tagChip}>
                        {tag}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => this.handleStartChat(friend)}
              >
                发消息
              </button>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => this.showToast("请先进入聊天页发起通话")}
              >
                音视频通话
              </button>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={this.handleEditOpen}
              >
                编辑资料
              </button>
            </div>

            {confirmAction ? (
              this.renderConfirmBar(
                confirmAction === "delete"
                  ? `确定删除「${displayName}」吗？删除后双方将无法继续单聊。`
                  : `确定将「${displayName}」加入黑名单吗？双方将无法继续单聊。`
              )
            ) : (
              <div className={styles.dangerRow}>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={this.handleBlockConfirm}
                >
                  加入黑名单
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={this.handleDeleteConfirm}
                >
                  删除联系人
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /**
   * 渲染编辑表单：备注、标签、电话、描述四项，按设计文档备注为单向数据。
   * @param {Object} editForm 表单数据。
   * @param {Object} friend 正在编辑的好友。
   * @returns {React.ReactNode} 表单节点。
   */
  renderEditForm = (editForm, friend) => (
    <div className={styles.editCard}>
      <div className={styles.editTitle}>编辑联系人资料</div>
      <label className={styles.editField}>
        <span className={styles.editLabel}>昵称</span>
        <input
          className={styles.editInput}
          type="text"
          value={friend.nickname}
          disabled
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>备注名</span>
        <input
          className={styles.editInput}
          type="text"
          maxLength={32}
          value={editForm.remark}
          onChange={(event) =>
            this.handleEditFieldChange("remark", event.target.value)
          }
          placeholder="仅自己可见，留空则显示昵称"
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>标签</span>
        <input
          className={styles.editInput}
          type="text"
          value={editForm.tags}
          onChange={(event) =>
            this.handleEditFieldChange("tags", event.target.value)
          }
          placeholder="用「、」分隔，最多 6 个"
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>电话备忘</span>
        <input
          className={styles.editInput}
          type="text"
          maxLength={20}
          value={editForm.phone}
          onChange={(event) =>
            this.handleEditFieldChange("phone", event.target.value)
          }
          placeholder="展示用手机号"
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>描述</span>
        <textarea
          className={styles.editTextarea}
          maxLength={128}
          rows={3}
          value={editForm.description}
          onChange={(event) =>
            this.handleEditFieldChange("description", event.target.value)
          }
          placeholder="补充备忘信息，如认识场景、负责业务等"
        />
      </label>
      <div className={styles.editActions}>
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={this.handleEditCancel}
        >
          取消
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={this.handleEditSave}
          disabled={this.state.saving}
        >
          保存
        </button>
      </div>
    </div>
  );

  /**
   * 渲染危险操作确认条。
   * @param {string} text 确认文案。
   * @returns {React.ReactNode} 确认条节点。
   */
  renderConfirmBar = (text) => (
    <div className={styles.confirmBar}>
      <p className={styles.confirmText}>{text}</p>
      <div className={styles.confirmActions}>
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={this.handleConfirmCancel}
        >
          取消
        </button>
        <button
          type="button"
          className={styles.dangerSolidBtn}
          onClick={this.handleConfirmExecute}
          disabled={this.state.saving}
        >
          确定
        </button>
      </div>
    </div>
  );

  /**
   * 渲染群组详情：群资料 + 成员头像网格 + 发消息。
   * @param {Object} group 群组对象。
   * @returns {React.ReactNode} 群组详情节点。
   */
  renderGroupDetail = (group) => (
    <div className={styles.detailScroll}>
      <div className={styles.detailHeader}>
        {this.renderAvatar(group, group.groupId, styles.avatarLarge)}
        <div className={styles.detailHeaderMain}>
          <div className={styles.detailNameRow}>
            <span className={styles.detailName}>{group.groupName}</span>
            <span className={styles.memberCount}>{group.memberCount} 人</span>
          </div>
          <p className={styles.detailMeta}>群号：{group.groupId}</p>
        </div>
      </div>

      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>群主</span>
          <span className={styles.infoValue}>{group.ownerNickname}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>成员数</span>
          <span className={styles.infoValue}>{group.memberCount} 人</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>群公告</span>
          <span className={styles.infoValue}>{group.announcement}</span>
        </div>
      </div>

      <div className={styles.memberSection}>
        <div className={styles.memberTitle}>
          群成员（展示前 {group.members.length} 位）
        </div>
        <div className={styles.memberGrid}>
          {group.members.map((name, index) => (
            <div key={name} className={styles.memberItem}>
              <div
                className={`${styles.avatar} ${styles.avatarSmall}`}
                style={{
                  backgroundColor: HGImContactsVM.getAvatarColor(
                    `${group.groupId}-${index}`
                  ),
                }}
              >
                {name.charAt(0)}
              </div>
              <span className={styles.memberName}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => this.showToast("群聊暂未接入")}
        >
          发消息
        </button>
      </div>
    </div>
  );

  /**
   * 渲染好友申请详情：申请附言 + 接受 / 拒绝操作。
   * @param {Object} request 好友申请对象。
   * @returns {React.ReactNode} 申请详情节点。
   */
  renderRequestDetail = (request) => (
    <div className={styles.detailScroll}>
      <div className={styles.detailHeader}>
        {this.renderAvatar(request, request.userId, styles.avatarLarge)}
        <div className={styles.detailHeaderMain}>
          <div className={styles.detailNameRow}>
            <span className={styles.detailName}>{request.nickname}</span>
          </div>
          <p className={styles.detailMeta}>
            自定义 ID：{request.username} · {request.createdAt}
          </p>
        </div>
      </div>

      <div className={styles.messageCard}>
        <div className={styles.messageTitle}>申请附言</div>
        <p className={styles.messageContent}>{request.message}</p>
      </div>

      <div className={styles.requestTip}>
        接受申请后双方建立好友关系，才能发起普通单聊（群聊不要求互为好友）。
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => this.handleAcceptRequest(request)}
          disabled={this.state.saving}
        >
          接受
        </button>
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={() => this.handleRejectRequest(request)}
          disabled={this.state.saving}
        >
          拒绝
        </button>
      </div>
    </div>
  );

  /**
   * 渲染黑名单联系人详情：拉黑原因 + 解除拉黑。
   * @param {Object} record 黑名单记录。
   * @returns {React.ReactNode} 黑名单详情节点。
   */
  renderBlockedDetail = (record) => (
    <div className={styles.detailScroll}>
      <div className={styles.detailHeader}>
        {this.renderAvatar(record, record.userId, styles.avatarLarge)}
        <div className={styles.detailHeaderMain}>
          <div className={styles.detailNameRow}>
            <span className={styles.detailName}>
              {HGImContactsVM.getDisplayName(record)}
            </span>
            <span className={styles.blockedBadge}>已拉黑</span>
          </div>
          <p className={styles.detailMeta}>
            自定义 ID：{record.username || "未设置"}
          </p>
        </div>
      </div>

      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>系统 ID</span>
          <span className={styles.infoValue}>{record.publicId}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>地区</span>
          <span className={styles.infoValue}>{record.region}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>拉黑原因</span>
          <span className={styles.infoValue}>{record.blockNote}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>拉黑时间</span>
          <span className={styles.infoValue}>{record.blockedAt}</span>
        </div>
      </div>

      <div className={styles.requestTip}>
        拉黑期间双方无法互发单聊消息，也无法互相发送好友申请。
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => this.handleUnblock(record)}
          disabled={this.state.saving}
        >
          解除拉黑
        </button>
      </div>
    </div>
  );

  /**
   * 渲染轻提示浮层。
   * @returns {React.ReactNode} 提示节点，无内容时不渲染。
   */
  renderToast = () => {
    const { toast } = this.state;
    if (!toast) return null;
    return <div className={styles.toast}>{toast}</div>;
  };

  render() {
    return (
      <div className={styles.pageRoot}>
        {this.renderListPane()}
        {this.renderDetailPane()}
        {this.renderToast()}
      </div>
    );
  }
}

export default HGImContactsPage;
