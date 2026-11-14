/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-14 22:52:22
 * @FilePath: /MLC_React/src/manager_antd/user/hg_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 *   HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）
*/
import React from "react";
import { handleError } from "../../../api/HttpManagerV1";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGCollectionView from "../../../components/hg_collection_view/hg_collection_view";
import { HGInputSearch } from "../../../components/hg_input/hg_input_page";
import HGLoading from "../../../components/hg_loading/hg_loading";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../components/hg_modal/hg_modal_page";
import HGSpacePage from "../../../components/hg_space/hg_space_page";
import { LogOut } from "../../../logger/hg_logger";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../../router/hg_router_path";
import styles from "./hg_user_profile.module.css";
import HGUserVM from "./hg_user_vm";

/**
 * 用户资料列表页面
 * 职责：以卡片列表展示用户资料（HGCollectionView），支持搜索和 cursor 分页查询。
 * 输入：props - 包含 navigate 方法（由 WithNavigation 注入），用于页面跳转。
 * 约束：使用 cursor 分页模式；搜索关键词自动去除首尾空格；卡片需完整展示用户全部字段。
 */
class HGUserProfilePage extends React.Component {
  /**
   * 构造函数，初始化组件状态。
   * @param {Object} props - 组件 props。
   */
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      loading: false,
      keyword: "",
      // cursor 分页映射：pageNum -> cursor
      cursorByPage: {
        1: 0,
      },
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0,
      },
      // 服务端是否还有下一页；供卡片列表分页条判断「下一页」可用性。
      hasMore: false,
      // 卡片操作状态：待删除用户（确认弹窗）与提交中标记。
      // 编辑不再使用弹窗：点击「编辑」携带用户数据跳转独立编辑页。
      deletingUser: null,
      deleteSubmitting: false,
      count: 0,
      refreshed: false,
      // 签名完整内容悬浮窗：记录打开的用户及弹层定位（fixed 坐标），null 表示关闭。
      signaturePopup: null,
    };
  }

  componentDidMount() {
    const { pagination } = this.state;
    this.fetchUsers(pagination.current, pagination.pageSize);
    // 点击签名悬浮窗与触发图标以外的区域时统一关闭悬浮窗。
    document.addEventListener("mousedown", this.handleGlobalMouseDownCloseSignature);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleGlobalMouseDownCloseSignature);
  }

  /**
   * 拉取用户列表（cursor 分页）
   */
  fetchUsers = (pageNum, pageSize, keyword = "") => {
    this.setState({ loading: true });

    const { cursorByPage } = this.state;
    const currentCursor = Number(cursorByPage[pageNum] ?? 0);

    HGUserVM.requestUserInfoDataList({
      pageSize,
      pageNum,
      keyword,
      cursor: currentCursor,
    })
      .then((res) => {
        console.log("获取用户列表成功", res);

        this.setState((prevState) => {
          const nextCursorByPage = { ...prevState.cursorByPage };

          if (res?.hasMore && Number(res?.nextCursor) > 0) {
            nextCursorByPage[pageNum + 1] = Number(res.nextCursor);
          }

          return {
            data: res?.result ?? [],
            hasMore: Boolean(res?.hasMore),
            pagination: {
              current: pageNum,
              pageSize,
              total: res?.total ?? 0,
            },
            cursorByPage: nextCursorByPage,
          };
        });
      })
      .catch(() => {
        message.error("Failed to fetch user data");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 卡片列表分页变化（HGCollectionView onChange 契约：{ current, pageSize }）。
   * 约束：cursor 只按页序累积，翻页沿用 cursorByPage 中已知游标。
   */
  handleTableChange = (paginationInfo) => {
    const { keyword, pagination } = this.state;
    const pageSizeChanged = paginationInfo.pageSize !== pagination.pageSize;

    if (pageSizeChanged) {
      this.setState(
        {
          cursorByPage: { 1: 0 },
          pagination: {
            ...pagination,
            current: 1,
            pageSize: paginationInfo.pageSize,
          },
        },
        () => {
          this.fetchUsers(1, paginationInfo.pageSize, keyword);
        }
      );
      return;
    }

    this.fetchUsers(paginationInfo.current, paginationInfo.pageSize, keyword);
  };

  /**
   * 搜索
   */
  handleSearch = (value) => {
    // 统一去除首尾空格，避免把纯空白词传给后端。
    const keyword = (value ?? "").trim();
    this.setState(
      {
        keyword,
        cursorByPage: { 1: 0 },
      },
      () => {
        this.fetchUsers(1, this.state.pagination.pageSize, keyword);
      }
    );
  };

  /**
   * 将 ISO 时间字符串格式化为本地「YYYY-MM-DD HH:mm」。
   * @param {string} isoTime ISO 时间字符串。
   * @returns {string} 本地时间文案；空值或非法时间返回占位符。
   */
  formatDateTime = (isoTime) => {
    if (!isoTime) return "-.-";
    const date = new Date(isoTime);
    if (Number.isNaN(date.getTime())) return String(isoTime);
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  /**
   * 性别编码转展示文案；未知编码统一显示「保密」。
   * @param {number} gender 性别编码（1 男 / 2 女）。
   * @returns {string} 展示文案。
   */
  genderLabel = (gender) => {
    if (gender === 1) return "男";
    if (gender === 2) return "女";
    return "保密";
  };

  /**
   * 性别展示文案对应的样式类名。
   * @param {number} gender 性别编码。
   * @returns {string} CSS Module 类名。
   */
  genderClass = (gender) => {
    if (gender === 1) return styles.genderMale;
    if (gender === 2) return styles.genderFemale;
    return styles.genderUnknown;
  };

  /**
   * 按当前页码与关键词重新拉取列表；编辑/删除成功后的刷新入口。
   */
  refreshCurrentPage = () => {
    const { pagination, keyword } = this.state;
    this.fetchUsers(pagination.current, pagination.pageSize, keyword);
  };

  /**
   * 点击「编辑」：携带用户数据跳转到独立编辑页（资料编辑 + 角色绑定）。
   * 编辑页通过路由参数 userId 定位授权查询，location.state.user 回填资料表单。
   * @param {Object} user 待编辑用户。
   */
  handleEditClick = (user) => {
    const userId = user.user_id || user.id;
    if (!userId) {
      message.error("缺少用户 ID，无法进入编辑页");
      return;
    }
    this.props.navigate(
      ROUTE_PATH.USER_EDIT_ROLE.replace(":userId", encodeURIComponent(userId)),
      { state: { user } }
    );
  };

  /**
   * 打开删除确认弹窗。
   * @param {Object} user 待删除用户。
   */
  handleAskDelete = (user) => {
    this.setState({ deletingUser: user });
  };

  /**
   * 关闭删除确认弹窗；提交中不允许关闭。
   */
  handleCancelDelete = () => {
    if (this.state.deleteSubmitting) return;
    this.setState({ deletingUser: null });
  };

  /**
   * 确认删除：仅无业务关联时允许删除，后端撤销会话；成功后重置游标重新加载首页。
   */
  handleConfirmDelete = async () => {
    const { deletingUser, deleteSubmitting } = this.state;
    if (!deletingUser || deleteSubmitting) return;
    this.setState({ deleteSubmitting: true });
    try {
      await HGUserVM.deleteUserByUserId(deletingUser.user_id);
      message.success("用户已删除");
      this.setState({ deletingUser: null, cursorByPage: { 1: 0 } }, () => {
        this.fetchUsers(1, this.state.pagination.pageSize, this.state.keyword);
      });
    } catch (error) {
      handleError(error);
    } finally {
      this.setState({ deleteSubmitting: false });
    }
  };

  /**
   * 截断签名为卡片内展示的短文案；超过 max 字时截断并追加省略号。
   * @param {string} text 原始签名。
   * @param {number} max 最大展示字数，默认 16。
   * @returns {string} 截断后的文案。
   */
  truncateSignature = (text, max = 16) => {
    const plain = String(text ?? "").trim();
    if (plain.length <= max) return plain;
    return `${plain.slice(0, max)}…`;
  };

  /**
   * 点击签名展开图标：切换完整签名悬浮窗；按图标位置做 fixed 定位并防止超出视口。
   * @param {Object} user 用户对象。
   * @param {MouseEvent} event 点击事件，取 currentTarget 的位置作为弹层锚点。
   */
  handleToggleSignature = (user, event) => {
    event.stopPropagation();
    const { signaturePopup } = this.state;
    const userId = user.user_id || user.id;

    if (signaturePopup && signaturePopup.userId === userId) {
      this.setState({ signaturePopup: null });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    // 预估弹层高度约 160px：视口放不下时改为向上弹出。
    const estimatedHeight = 160;
    const placeAbove = rect.bottom + estimatedHeight > window.innerHeight;
    const top = placeAbove
      ? Math.max(8, rect.top - estimatedHeight - 8)
      : rect.bottom + 8;
    // 预估弹层最大宽度约 340px：避免右侧溢出视口。
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 348));

    this.setState({
      signaturePopup: {
        userId,
        name: user.nickname || user.user_name || "",
        signature: String(user.signature ?? "").trim(),
        top,
        left,
      },
    });
  };

  /**
   * 全局 mousedown：点击签名弹层与触发图标以外的区域时关闭悬浮窗。
   * 通过 data-signature-layer 标记识别弹层内部点击，避免误关。
   * @param {MouseEvent} event 文档级 mousedown 事件。
   */
  handleGlobalMouseDownCloseSignature = (event) => {
    if (!this.state.signaturePopup) return;
    if (event.target.closest && event.target.closest("[data-signature-layer]")) return;
    this.setState({ signaturePopup: null });
  };

  /**
   * 渲染完整签名悬浮窗（fixed 定位，挂在页面根节点下避免被虚拟列表裁剪）。
   * @returns {React.ReactNode} 悬浮窗 JSX；未打开时返回 null。
   */
  renderSignaturePopup = () => {
    const { signaturePopup } = this.state;
    if (!signaturePopup) return null;
    const { top, left, name, signature } = signaturePopup;
    return (
      <div
        className={styles.signaturePopup}
        data-signature-layer="popup"
        style={{ top, left }}
        role="tooltip"
      >
        <span className={styles.signaturePopupName}>{name} 的完整签名</span>
        <p className={styles.signaturePopupText}>“{signature}”</p>
      </div>
    );
  };

  /**
   * 渲染签名行：超过 16 字截断省略，尾部展开图标点击后弹出完整内容。
   * @param {Object} user 用户对象。
   * @returns {React.ReactNode} 签名行 JSX。
   */
  renderSignature = (user) => {
    if (!user.signature) {
      return <p className={styles.signature}>这个人很酷，什么都没写。</p>;
    }
    return (
      <p className={styles.signatureRow}>
        <span className={styles.signatureText}>
          “{this.truncateSignature(user.signature)}”
        </span>
        <button
          type="button"
          className={styles.signatureToggle}
          data-signature-layer="trigger"
          title="查看完整签名"
          aria-label="查看完整签名"
          onClick={(event) => this.handleToggleSignature(user, event)}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7.2v3.6" />
            <path d="M8 4.8v.2" />
          </svg>
        </button>
      </p>
    );
  };

  /**
   * 渲染页头工具区：搜索框与新增用户按钮。
   * @returns {React.ReactNode} 工具区 JSX。
   */
  renderToolbar = () => {
    return (
      <HGSpacePage>
        <HGInputSearch
          placeholder="搜索用户名/昵称/手机号"
          allowClear
          onSearch={this.handleSearch}
          style={{ width: 250 }}
        />
        <HGButtonPage
          type="primary"
          onClick={() => message.info("Add user clicked")}
        >
          Add User
        </HGButtonPage>
      </HGSpacePage>
    );
  };

  /**
   * 汇总用户卡片的元数据项；以后新增展示字段只需在此数组追加一项。
   * @param {Object} user 用户对象。
   * @returns {Array<{label: string, value: React.ReactNode}>} 元数据项列表。
   */
  userMetaItems = (user) => {
    return [
      { label: "用户ID", value: user.user_id ?? "-.-" },
      { label: "公开ID", value: user.publicId ?? "-.-" },
      { label: "手机号", value: user.phone ?? "-.-" },
      { label: "邮箱", value: user.email ?? "-.-" },
    ];
  };

  /**
   * 渲染用户元数据栅格：位于头像区块下方，按容器宽度自适应多列、自动换行成多行。
   * @param {Object} user 用户对象。
   * @returns {React.ReactNode} 元数据栅格 JSX。
   */
  renderMetaGrid = (user) => {
    const items = this.userMetaItems(user);
    return (
      <dl className={styles.metaGrid}>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  /**
   * 渲染单张用户资料卡片：头像、昵称、性别、签名、右侧操作按钮与全部元数据字段。
   * @param {Object} user 用户对象。
   * @returns {React.ReactNode} 用户卡片 JSX。
   */
  renderUserCard = (user) => {
    // 展示名优先取昵称，无昵称时回退用户名；两者同时存在且不同时，附注 @用户名。
    const displayName = user.nickname || user.user_name || "-.-";
    const showSubName = Boolean(user.nickname && user.user_name && user.nickname !== user.user_name);
    // 删除操作进行中时统一禁用其他卡片按钮，避免并发删除造成状态混乱。
    const actionDisabled = this.state.deleteSubmitting;
    return (
      <article className={styles.userCard}>
        <div className={styles.cardHead}>
          <div className={styles.avatarWrap}>
            <span className={styles.avatarFallback} aria-hidden="true">
              {String(displayName).trim().charAt(0) || "?"}
            </span>
            {user.avatar_url ? (
              <img
                className={styles.avatar}
                src={user.avatar_url}
                alt={`${displayName} 的头像`}
                loading="lazy"
                onError={(event) => {
                  // 头像加载失败时露出底衬首字占位，不阻断卡片其余内容。
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
          <div className={styles.headMain}>
            <div className={styles.nameRow}>
              <span className={styles.userName}>{displayName}</span>
              <span className={`${styles.genderTag} ${this.genderClass(user.gender)}`}>
                {this.genderLabel(user.gender)}
              </span>
              {showSubName ? (
                <span className={styles.userNameSub}>@{user.user_name}</span>
              ) : null}
            </div>
            {this.renderSignature(user)}
          </div>
          <div className={styles.cardActions}>
            <HGButtonPage
              disabled={actionDisabled}
              onClick={() => this.handleEditClick(user)}
            >
              编辑
            </HGButtonPage>
            <HGButtonPage
              danger
              disabled={actionDisabled}
              title="仅可删除无关联记录的用户；删除时会强制退出所有设备"
              onClick={() => this.handleAskDelete(user)}
            >
              删除
            </HGButtonPage>
          </div>
        </div>
        {this.renderMetaGrid(user)}
        <footer className={styles.cardFoot}>
          <span>创建于 {this.formatDateTime(user.created_at)}</span>
          <span>更新于 {this.formatDateTime(user.updated_at)}</span>
        </footer>
      </article>
    );
  };

  /**
   * 渲染用户卡片列表（虚拟滚动 + 分页）。
   * 约束：分页受控于页面 cursor 状态；换关键词时通过 resetKey 清空旧高度测量。
   * @returns {React.ReactNode} HGCollectionView 实例 JSX。
   */
  renderUserList = () => {
    const { data, loading, pagination, hasMore, keyword } = this.state;
    return (
      <HGCollectionView
        items={data}
        getKey={(user) => user.user_id || user.id}
        renderCell={this.renderUserCard}
        loading={loading}
        hasMore={hasMore}
        resetKey={keyword}
        pageKey={pagination.current}
        ariaLabel="用户资料列表"
        emptyText="暂无用户数据，换个关键词试试"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          loadedCount: data.length,
          hasMore,
        }}
        onChange={this.handleTableChange}
      />
    );
  };

  /**
   * 渲染删除确认弹窗；未选择待删除用户时返回 null。
   * @returns {React.ReactNode} 删除确认弹窗 JSX。
   */
  renderDeleteModal = () => {
    const { deletingUser, deleteSubmitting } = this.state;
    if (!deletingUser) return null;
    return (
      <HGModalPage
        visible
        size="small"
        title="删除用户"
        closable={!deleteSubmitting}
        onClose={this.handleCancelDelete}
        okText={deleteSubmitting ? "删除中…" : "确认删除"}
        cancelText="取消"
        okType="danger"
        onOk={this.handleConfirmDelete}
        onCancel={this.handleCancelDelete}
      >
        <p>
          确认删除用户 {deletingUser.user_name ?? deletingUser.user_id}？
          仅无业务关联的账号可以删除；删除将强制退出所有设备且不可恢复。
        </p>
      </HGModalPage>
    );
  };

  render() {
    const { data, loading } = this.state;
    LogOut("🍎 用户列表数据：", data);
    return (
      <div className={styles.container}>
        <HGLoading fullscreen text="正在加载用户列表..." visible={loading} />
        <HGCardPage title="用户列表" extra={this.renderToolbar()}>
          {this.renderUserList()}
        </HGCardPage>
        {this.renderDeleteModal()}
        {this.renderSignaturePopup()}
      </div>
    );
  }
}

const HGUserProfilePageWithNavigation = WithNavigation(HGUserProfilePage);

export default HGUserProfilePageWithNavigation;
