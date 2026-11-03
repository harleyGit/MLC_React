/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-03 20:49:17
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
import HGUserEditModal from "./hg_user_edit_modal";
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
      // 卡片操作状态：编辑目标用户与提交中标记、待删除用户（确认弹窗）与提交中标记。
      editingUser: null,
      editSubmitting: false,
      deletingUser: null,
      deleteSubmitting: false,
      count: 0,
      refreshed: false,
    };
  }

  componentDidMount() {
    const { pagination } = this.state;
    this.fetchUsers(pagination.current, pagination.pageSize);
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
   * 打开编辑弹窗。
   * @param {Object} user 待编辑用户。
   */
  handleEditClick = (user) => {
    this.setState({ editingUser: user });
  };

  /**
   * 关闭编辑弹窗；提交中不允许关闭，避免请求结果与界面状态不一致。
   */
  handleCancelEdit = () => {
    if (this.state.editSubmitting) return;
    this.setState({ editingUser: null });
  };

  /**
   * 提交编辑：走 PUT /api/v1/profile/update?user_id=xxx，成功后刷新当前页。
   * @param {Object} formInput 表单值（nickname / gender / signature）。
   */
  handleSubmitEdit = async (formInput) => {
    const { editingUser, editSubmitting } = this.state;
    if (!editingUser || editSubmitting) return;
    this.setState({ editSubmitting: true });
    try {
      await HGUserVM.updateUserByUserId({
        userId: editingUser.user_id,
        ...formInput,
      });
      message.success("用户资料已更新");
      this.setState({ editingUser: null });
      this.refreshCurrentPage();
    } catch (error) {
      handleError(error);
    } finally {
      this.setState({ editSubmitting: false });
    }
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
   * 确认删除：走 DELETE /api/v1/profile/delete?user_id=xxx，成功后刷新当前页。
   * 注意：后端删除路由尚未实现，联调前该请求会失败并弹错误提示。
   */
  handleConfirmDelete = async () => {
    const { deletingUser, deleteSubmitting } = this.state;
    if (!deletingUser || deleteSubmitting) return;
    this.setState({ deleteSubmitting: true });
    try {
      await HGUserVM.deleteUserByUserId(deletingUser.user_id);
      message.success("用户已删除");
      this.setState({ deletingUser: null });
      this.refreshCurrentPage();
    } catch (error) {
      handleError(error);
    } finally {
      this.setState({ deleteSubmitting: false });
    }
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
      { label: "记录编号", value: user.id ?? "-.-" },
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
    const displayName = user.nickname || user.user_name || "-.-";
    // 任一写操作进行中时统一禁用其他卡片按钮，避免并发编辑/删除造成状态混乱。
    const actionDisabled = this.state.editSubmitting || this.state.deleteSubmitting;
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
              <span className={styles.userName}>{user.user_name ?? "-.-"}</span>
              <span className={`${styles.genderTag} ${this.genderClass(user.gender)}`}>
                {this.genderLabel(user.gender)}
              </span>
              {user.nickname ? (
                <span className={styles.nickname}>昵称：{user.nickname}</span>
              ) : null}
            </div>
            <p className={styles.signature}>
              {user.signature ? `“${user.signature}”` : "这个人很酷，什么都没写。"}
            </p>
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
        height={560}
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
   * 渲染编辑弹窗；未打开时返回 null。
   * @returns {React.ReactNode} 编辑弹窗 JSX。
   */
  renderEditModal = () => {
    const { editingUser, editSubmitting } = this.state;
    if (!editingUser) return null;
    return (
      <HGUserEditModal
        user={editingUser}
        submitting={editSubmitting}
        onCancel={this.handleCancelEdit}
        onSubmit={this.handleSubmitEdit}
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
          删除后该用户将无法登录，此操作不可恢复。
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
        {this.renderEditModal()}
        {this.renderDeleteModal()}
      </div>
    );
  }
}

const HGUserProfilePageWithNavigation = WithNavigation(HGUserProfilePage);

export default HGUserProfilePageWithNavigation;
