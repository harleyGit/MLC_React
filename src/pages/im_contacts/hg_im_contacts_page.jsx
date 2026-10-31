/*
 * @Description: 联系人页面，模仿微信电脑端通讯录：左侧分类导航 + 中间联系人列表 + 右侧资料详情与编辑。
 * 职责：维护联系人/群组/好友申请/黑名单四类数据的选择、搜索、接受申请、资料修改、拉黑与删除等交互。
 * 约束：数据由 hg_im_contacts_vm 提供模拟实现；真实 Go IM 接口落地后仅替换 VM 数据源，本页面逻辑不变。
 */
import React, { Component } from "react";
import iconContacts from "../../assets/icons/icon_im_contacts.svg";
import iconRequest from "../../assets/icons/icon_im_request.svg";
import iconGroup from "../../assets/icons/icon_im_group.svg";
import HGImContactsVM from "./hg_im_contacts_vm";
import styles from "./hg_im_contacts_page.module.css";

/** 左侧导航过滤器配置：key 对应 activeFilter 状态。 */
const RAIL_FILTERS = [
  { key: "contacts", label: "联系人", icon: iconContacts },
  { key: "requests", label: "新的朋友", icon: iconRequest },
  { key: "groups", label: "群组", icon: iconGroup },
];

/**
 * 联系人页面组件。
 * 约束：类组件实现；JSX 按 renderXxx 拆分，render 只负责组装；隐私字段仅做展示不做持久化。
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
      activeFilter: "contacts",
      selected: null, // { type: 'friend' | 'group' | 'blocked' | 'request', id }
      editing: false,
      editForm: null, // { remark, tags, phone, description }
      confirmAction: null, // 'delete' | 'block'，触发前需二次确认
      toast: "",
    };
    this.toastTimer = null;
  }

  componentDidMount() {
    this.loadContacts();
  }

  componentWillUnmount() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  /**
   * 加载联系人模块数据，并默认选中第一位好友，避免右侧空白。
   */
  loadContacts = async () => {
    const data = await HGImContactsVM.fetchContacts();
    const firstFriend = data.friends.length > 0 ? data.friends[0] : null;
    this.setState({
      loading: false,
      friends: data.friends,
      groups: data.groups,
      requests: data.requests,
      blocked: data.blocked,
      selected: firstFriend ? { type: "friend", id: firstFriend.userId } : null,
    });
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
    const { friends, groups, requests, keyword, activeFilter } = this.state;
    const trimmed = keyword.trim();
    const sections = [];

    const matchedFriends = friends.filter((item) => HGImContactsVM.matchKeyword(item, trimmed));
    const matchedGroups = groups.filter((item) => HGImContactsVM.matchKeyword(item, trimmed));

    if (activeFilter === "requests") {
      sections.push({ key: "requests", title: "新的朋友", type: "request", items: requests });
      return sections;
    }
    if (activeFilter === "groups") {
      sections.push({ key: "groups", title: "我的群组", type: "group", items: matchedGroups });
      return sections;
    }

    // 联系人视图：无关键字时展示「新的朋友」入口，有关键字时聚焦搜索结果。
    if (!trimmed && requests.length > 0) {
      sections.push({ key: "requests", title: "新的朋友", type: "request", items: requests });
    }
    const letterGroups = HGImContactsVM.groupFriendsByLetter(matchedFriends).map((group) => ({
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
   * 左侧导航切换回调。
   * @param {string} filter 过滤器 key。
   */
  handleFilterChange = (filter) => {
    this.setState({ activeFilter: filter, editing: false, confirmAction: null });
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

  /** 保存编辑：调用 VM 模拟接口并同步本地好友列表。 */
  handleEditSave = async () => {
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
    await HGImContactsVM.saveFriendProfile(friend.userId, patch);
    this.setState((prevState) => ({
      editing: false,
      editForm: null,
      friends: prevState.friends.map((item) =>
        item.userId === friend.userId ? { ...item, ...patch } : item,
      ),
    }));
    this.showToast("联系人资料已更新");
  };

  /**
   * 接受好友申请：模拟接口返回新好友资料后转入好友列表并选中。
   * @param {Object} request 好友申请对象。
   */
  handleAcceptRequest = async (request) => {
    const newFriend = await HGImContactsVM.acceptFriendRequest(request);
    this.setState((prevState) => ({
      requests: prevState.requests.filter((item) => item.requestId !== request.requestId),
      friends: [...prevState.friends, newFriend],
      selected: { type: "friend", id: newFriend.userId },
    }));
    this.showToast(`已添加 ${HGImContactsVM.getDisplayName(newFriend)} 为联系人`);
  };

  /**
   * 拒绝好友申请：仅移除申请记录，保留历史由服务端负责。
   * @param {Object} request 好友申请对象。
   */
  handleRejectRequest = (request) => {
    this.setState((prevState) => ({
      requests: prevState.requests.filter((item) => item.requestId !== request.requestId),
      selected: prevState.selected && prevState.selected.id === request.requestId ? null : prevState.selected,
    }));
    this.showToast("已拒绝该好友申请");
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
   * 约束：删除好友仅移除本地列表并提示保留历史聊天，真实逻辑由服务端控制。
   */
  handleConfirmExecute = () => {
    const { confirmAction } = this.state;
    const friend = this.getSelectedItem();
    if (!friend || !confirmAction) {
      this.setState({ confirmAction: null });
      return;
    }
    if (confirmAction === "delete") {
      this.setState((prevState) => ({
        friends: prevState.friends.filter((item) => item.userId !== friend.userId),
        selected: null,
        confirmAction: null,
      }));
      this.showToast("已删除联系人，历史聊天记录仍会保留");
      return;
    }
    const blockedRecord = {
      userId: friend.userId,
      publicId: friend.publicId,
      username: friend.username,
      nickname: friend.nickname,
      remark: friend.remark || "",
      region: friend.region || "未知",
      signature: friend.signature || "",
      blockNote: "手动加入黑名单",
      blockedAt: "2026-11-01",
    };
    this.setState((prevState) => ({
      friends: prevState.friends.filter((item) => item.userId !== friend.userId),
      blocked: [...prevState.blocked, blockedRecord],
      selected: null,
      confirmAction: null,
    }));
    this.showToast("已加入黑名单，双方无法继续单聊");
  };

  /**
   * 解除拉黑：将黑名单记录还原为好友并保持选中。
   * @param {Object} record 黑名单记录。
   */
  handleUnblock = (record) => {
    const restoredFriend = {
      userId: record.userId,
      publicId: record.publicId,
      username: record.username,
      nickname: record.nickname,
      remark: record.remark || "",
      region: record.region || "未知",
      signature: record.signature || "这个人很懒，什么都没有写。",
      source: "黑名单解除后恢复",
      phone: "",
      email: "",
      tags: [],
      description: "",
      starred: false,
      friendSince: "2026-11-01",
    };
    this.setState((prevState) => ({
      blocked: prevState.blocked.filter((item) => item.userId !== record.userId),
      friends: [...prevState.friends, restoredFriend],
      selected: { type: "friend", id: record.userId },
    }));
    this.showToast("已解除拉黑并恢复联系人");
  };

  /** 发消息按钮：聊天模块尚未接入，先给轻提示。 */
  handleStartChat = () => {
    this.showToast("聊天功能即将上线，敬请期待");
  };

  /**
   * 渲染头像：按标识取色的首字符头像。
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
    </div>
  );

  /**
   * 渲染左侧深色导航栏：联系人 / 新的朋友（含待处理角标）/ 群组。
   * @returns {React.ReactNode} 导航栏节点。
   */
  renderRail = () => {
    const { activeFilter, requests } = this.state;
    return (
      <div className={styles.rail}>
        {RAIL_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          const badgeCount = filter.key === "requests" ? requests.length : 0;
          return (
            <button
              key={filter.key}
              type="button"
              className={`${styles.railItem} ${isActive ? styles.railItemActive : ""}`}
              onClick={() => this.handleFilterChange(filter.key)}
              title={filter.label}
            >
              <img className={styles.railIcon} src={filter.icon} alt={filter.label} />
              {badgeCount > 0 && <span className={styles.railBadge}>{badgeCount}</span>}
              <span className={styles.railLabel}>{filter.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染中间联系人列表：搜索框 + 分组列表（新的朋友 / 字母分组 / 群组）。
   * @returns {React.ReactNode} 列表节点。
   */
  renderListPane = () => {
    const { keyword, loading } = this.state;
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
        <div className={styles.listScroll}>
          {loading && <p className={styles.listTip}>联系人加载中…</p>}
          {!loading && !hasContent && (
            <p className={styles.listTip}>
              {keyword.trim() ? "没有匹配的联系人或群组" : "暂无内容"}
            </p>
          )}
          {!loading &&
            sections.map((section) => {
              if (section.items.length === 0) return null;
              return (
                <div key={section.key} className={styles.section}>
                  <div className={styles.sectionTitle}>{section.title}</div>
                  {section.items.map((item) => this.renderListRow(section.type, item))}
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
    const rowId = type === "group" ? item.groupId : type === "request" ? item.requestId : item.userId;
    const isActive =
      selected && selected.type === type && String(selected.id) === String(rowId);
    const displayName = HGImContactsVM.getDisplayName(item);
    const seed = type === "group" ? item.groupId : item.userId;
    const subText =
      type === "group"
        ? `${item.memberCount} 人`
        : type === "request"
          ? item.createdAt
          : item.nickname !== displayName
            ? `昵称：${item.nickname}`
            : item.username || "";
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
      return <div className={styles.detailPane}><p className={styles.emptyText}>加载中…</p></div>;
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
      return <div className={styles.detailPane}>{this.renderGroupDetail(item)}</div>;
    }
    if (selected.type === "request") {
      return <div className={styles.detailPane}>{this.renderRequestDetail(item)}</div>;
    }
    if (selected.type === "blocked") {
      return <div className={styles.detailPane}>{this.renderBlockedDetail(item)}</div>;
    }
    return <div className={styles.detailPane}>{this.renderFriendDetail(item)}</div>;
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
              {friend.starred && <span className={styles.starBadge}>★ 星标联系人</span>}
            </div>
            <p className={styles.detailMeta}>
              {friend.nickname !== displayName ? `昵称：${friend.nickname} · ` : ""}微信号：{friend.username}
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
                      <span key={tag} className={styles.tagChip}>{tag}</span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryBtn} onClick={this.handleStartChat}>
                发消息
              </button>
              <button type="button" className={styles.outlineBtn} onClick={this.handleStartChat}>
                音视频通话
              </button>
              <button type="button" className={styles.outlineBtn} onClick={this.handleEditOpen}>
                编辑资料
              </button>
            </div>

            {confirmAction ? (
              this.renderConfirmBar(
                confirmAction === "delete"
                  ? `确定删除「${displayName}」吗？删除后双方将无法继续单聊。`
                  : `确定将「${displayName}」加入黑名单吗？双方将无法继续单聊。`,
              )
            ) : (
              <div className={styles.dangerRow}>
                <button type="button" className={styles.dangerBtn} onClick={this.handleBlockConfirm}>
                  加入黑名单
                </button>
                <button type="button" className={styles.dangerBtn} onClick={this.handleDeleteConfirm}>
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
        <input className={styles.editInput} type="text" value={friend.nickname} disabled />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>备注名</span>
        <input
          className={styles.editInput}
          type="text"
          maxLength={32}
          value={editForm.remark}
          onChange={(event) => this.handleEditFieldChange("remark", event.target.value)}
          placeholder="仅自己可见，留空则显示昵称"
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>标签</span>
        <input
          className={styles.editInput}
          type="text"
          value={editForm.tags}
          onChange={(event) => this.handleEditFieldChange("tags", event.target.value)}
          placeholder="用「、」分隔，最多 6 个"
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>电话</span>
        <input
          className={styles.editInput}
          type="text"
          maxLength={20}
          value={editForm.phone}
          onChange={(event) => this.handleEditFieldChange("phone", event.target.value)}
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
          onChange={(event) => this.handleEditFieldChange("description", event.target.value)}
          placeholder="补充备忘信息，如认识场景、负责业务等"
        />
      </label>
      <div className={styles.editActions}>
        <button type="button" className={styles.outlineBtn} onClick={this.handleEditCancel}>
          取消
        </button>
        <button type="button" className={styles.primaryBtn} onClick={this.handleEditSave}>
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
        <button type="button" className={styles.outlineBtn} onClick={this.handleConfirmCancel}>
          取消
        </button>
        <button type="button" className={styles.dangerSolidBtn} onClick={this.handleConfirmExecute}>
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
        <div className={styles.memberTitle}>群成员（展示前 {group.members.length} 位）</div>
        <div className={styles.memberGrid}>
          {group.members.map((name, index) => (
            <div key={name} className={styles.memberItem}>
              <div
                className={`${styles.avatar} ${styles.avatarSmall}`}
                style={{ backgroundColor: HGImContactsVM.getAvatarColor(`${group.groupId}-${index}`) }}
              >
                {name.charAt(0)}
              </div>
              <span className={styles.memberName}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actionRow}>
        <button type="button" className={styles.primaryBtn} onClick={this.handleStartChat}>
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
        >
          接受
        </button>
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={() => this.handleRejectRequest(request)}
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
            <span className={styles.detailName}>{HGImContactsVM.getDisplayName(record)}</span>
            <span className={styles.blockedBadge}>已拉黑</span>
          </div>
          <p className={styles.detailMeta}>微信号：{record.username}</p>
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
        {this.renderRail()}
        {this.renderListPane()}
        {this.renderDetailPane()}
        {this.renderToast()}
      </div>
    );
  }
}

export default HGImContactsPage;
