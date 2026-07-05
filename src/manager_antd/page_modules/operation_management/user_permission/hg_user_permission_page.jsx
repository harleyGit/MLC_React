/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-07-05
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/user_permission/hg_user_permission_page.jsx
 * @Description: 用户权限管理页面，展示管理员列表并支持通过弹窗编辑用户角色权限
 *
 * 千万级表约束：
 * - 管理员列表使用 cursor 分页，避免 OFFSET 深分页扫描。
 * - 后端不返回实时 total，前端仅根据 hasMore 计算"至少 N 条"。
 * - 角色选项最多加载 500 个，避免前端渲染过多复选框。
 * - 搜索接口严格限制关键词长度和返回条数。
 */
import React, { Component } from "react";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGUserPermissionVM, {
  USER_PERMISSION_PAGE_SIZE,
} from "./hg_user_permission_vm";
import styles from "./hg_user_permission.module.css";

/**
 * 用户权限管理页面。
 * 职责：展示管理员 cursor 分页列表，提供编辑角色权限弹窗。
 */
class HGUserPermissionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      /** @type {Array<Object>} 管理员列表数据 */
      data: [],
      /** @type {boolean} 加载状态 */
      loading: false,
      /** @type {string} 搜索关键词 */
      keyword: "",
      /**
       * cursorByPage: 页码到 cursor 的映射。
       * key=页码，value=该页起始 cursor（上一页最后一条的 id）。
       */
      cursorByPage: { 1: 0 },
      /** @type {Object} 分页状态 */
      pagination: {
        current: 1,
        pageSize: USER_PERMISSION_PAGE_SIZE,
        total: 0,
      },
      // 弹窗相关状态
      /** @type {boolean} 弹窗是否可见 */
      modalVisible: false,
      /** @type {Object|null} 当前编辑的管理员信息 */
      editingAdmin: null,
      /** @type {Array<Object>} 所有角色选项 */
      roleOptions: [],
      /** @type {boolean} 角色选项加载状态 */
      loadingRoles: false,
      /** @type {Array<string>} 当前用户已分配的角色 ID 列表 */
      selectedRoleIds: [],
      /** @type {boolean} 用户角色加载状态 */
      loadingUserRoles: false,
      /** @type {boolean} 提交状态 */
      submitting: false,
    };
  }

  /**
   * 组件挂载后立即拉取首页数据和角色选项。
   */
  componentDidMount() {
    const { pagination } = this.state;
    this.fetchAdminList(pagination.current, pagination.pageSize);
    this.loadRoleOptions();
  }

  /**
   * 加载所有角色选项（用于弹窗中的复选框）。
   * 千万级表约束：最多加载 500 个角色，避免前端渲染过多复选框。
   */
  loadRoleOptions = () => {
    this.setState({ loadingRoles: true });
    HGUserPermissionVM.fetchAllRoleOptions()
      .then((res) => {
        const roleOptions = HGUserPermissionVM.toRoleCheckboxOptions(res?.list || []);
        this.setState({ roleOptions });
        if (res?.truncated) {
          message.warning("角色数量较多，当前仅加载前 500 个角色");
        }
      })
      .catch(() => {
        message.error("角色列表获取失败，请刷新后重试");
      })
      .finally(() => {
        this.setState({ loadingRoles: false });
      });
  };

  /**
   * 拉取管理员列表，使用后端 cursor 分页接口。
   * cursor 分页原理：
   * 1. 首页 cursor=0，后端查 id DESC LIMIT pageSize+1。
   * 2. 后端返回 nextCursor=最后一条的 id，hasMore=true/false。
   * 3. 前端将 nextCursor 存入 cursorByPage[2]，翻到第 2 页时取出使用。
   * 4. 后端查 id < cursor LIMIT pageSize+1，避免 OFFSET 扫描。
   *
   * @param {number} pageNum 当前前端页码。
   * @param {number} pageSize 每页条数。
   */
  fetchAdminList = (pageNum, pageSize) => {
    const { cursorByPage } = this.state;
    const cursor = Number(cursorByPage[pageNum] ?? 0);
    this.setState({ loading: true, keyword: "" });

    HGUserPermissionVM.fetchAdminList({ cursor, pageSize })
      .then((res) => {
        const rows = HGUserPermissionVM.toAdminRows(res?.list || []);
        this.setState((prevState) => {
          const nextCursorByPage = { ...prevState.cursorByPage };
          if (res?.hasMore && Number(res?.nextCursor) > 0) {
            nextCursorByPage[pageNum + 1] = Number(res.nextCursor);
          }
          return {
            data: rows,
            cursorByPage: nextCursorByPage,
            pagination: {
              current: pageNum,
              pageSize,
              total: HGUserPermissionVM.buildCursorPaginationTotal({
                pageNum,
                pageSize,
                rowCount: rows.length,
                hasMore: Boolean(res?.hasMore),
              }),
            },
          };
        });
      })
      .catch(() => {
        message.error("管理员列表获取失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 搜索管理员；空关键词恢复默认列表模式。
   * @param {string} value 用户输入的管理员 ID、姓名、昵称、邮箱或手机号前缀。
   */
  handleSearch = (value) => {
    const keyword = String(value || "").trim();
    if (!keyword) {
      this.setState(
        {
          keyword: "",
          cursorByPage: { 1: 0 },
          pagination: { ...this.state.pagination, current: 1 },
        },
        () => this.fetchAdminList(1, this.state.pagination.pageSize)
      );
      return;
    }

    this.setState({ loading: true, keyword });
    HGUserPermissionVM.searchAdmins(keyword)
      .then((res) => {
        const rows = HGUserPermissionVM.toAdminRows(res?.list || []);
        this.setState({
          data: rows,
          pagination: {
            current: 1,
            pageSize: USER_PERMISSION_PAGE_SIZE,
            total: Number(res?.total || rows.length),
          },
        });
        if (rows.length === 0) {
          message.info("未搜索到匹配管理员");
        }
      })
      .catch(() => {
        message.error("管理员搜索失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 表格分页变化处理；搜索结果不支持翻页，默认列表支持 cursor 翻页。
   * @param {Object} paginationInfo 表格分页信息。
   */
  handleTableChange = (paginationInfo) => {
    const { keyword, pagination } = this.state;
    if (keyword) return;
    const pageSizeChanged = paginationInfo.pageSize !== pagination.pageSize;
    if (pageSizeChanged) {
      this.setState({ cursorByPage: { 1: 0 } }, () => {
        this.fetchAdminList(1, paginationInfo.pageSize);
      });
      return;
    }
    this.fetchAdminList(paginationInfo.current, paginationInfo.pageSize);
  };

  /**
   * 打开编辑弹窗，加载用户已分配角色。
   * @param {Object} admin 管理员信息。
   */
  handleEditClick = (admin) => {
    this.setState({
      modalVisible: true,
      editingAdmin: admin,
      loadingUserRoles: true,
      selectedRoleIds: [],
    });

    HGUserPermissionVM.fetchUserRoles(admin.id)
      .then((res) => {
        const roleIds = (res?.roles || []).map((role) => String(role.id));
        this.setState({ selectedRoleIds: roleIds });
      })
      .catch(() => {
        message.error("用户角色获取失败，请手动选择");
      })
      .finally(() => {
        this.setState({ loadingUserRoles: false });
      });
  };

  /**
   * 关闭编辑弹窗。
   */
  handleModalClose = () => {
    this.setState({
      modalVisible: false,
      editingAdmin: null,
      selectedRoleIds: [],
    });
  };

  /**
   * 角色复选框变化处理。
   * @param {string} roleId 角色 ID。
   * @param {boolean} checked 是否选中。
   */
  handleRoleChange = (roleId, checked) => {
    this.setState((prevState) => {
      const selectedRoleIds = checked
        ? [...prevState.selectedRoleIds, roleId]
        : prevState.selectedRoleIds.filter((id) => id !== roleId);
      return { selectedRoleIds };
    });
  };

  /**
   * 提交角色分配。
   * 千万级表约束：使用 POST 批量接口，减少网络往返。
   */
  handleSubmitRoles = () => {
    const { editingAdmin, selectedRoleIds } = this.state;
    if (!editingAdmin) return;

    this.setState({ submitting: true });
    HGUserPermissionVM.assignUserRoles(editingAdmin.id, selectedRoleIds)
      .then(() => {
        message.success("角色分配成功");
        this.handleModalClose();
      })
      .catch((err) => {
        message.error(err?.message || "角色分配失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ submitting: false });
      });
  };

  /**
   * 管理员表格列配置。
   * @returns {Array<Object>} 表格列定义。
   */
  getColumns = () => [
    {
      title: "管理员ID",
      dataIndex: "id",
      width: 140,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "姓名",
      dataIndex: "name",
      width: 120,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "昵称",
      dataIndex: "nickName",
      width: 120,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      width: 180,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "手机号",
      dataIndex: "mobile",
      width: 140,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (text) => (
        <span className={styles.statusText}>
          {HGUserPermissionVM.getStatusText(text)}
        </span>
      ),
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 100,
      render: (_, record) => (
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => this.handleEditClick(record)}
        >
          编辑权限
        </button>
      ),
    },
  ];

  /**
   * 渲染提示信息。
   * @returns {React.ReactNode} 提示文本节点。
   */
  renderTip = () => {
    const { keyword, pagination } = this.state;
    if (!keyword) {
      return (
        <p className={styles.tipText}>
          共 {pagination.total}+ 条管理员记录，使用 cursor 分页避免深分页扫描；点击"编辑权限"可修改用户角色。
        </p>
      );
    }
    return (
      <p className={styles.tipText}>
        当前关键词：{keyword}，返回 {pagination.total} 条匹配管理员。清空搜索框可回到列表模式。
      </p>
    );
  };

  /**
   * 渲染用户信息卡片。
   * @returns {React.ReactNode} 用户信息卡片节点。
   */
  renderUserCard = () => {
    const { editingAdmin } = this.state;
    if (!editingAdmin) return null;

    return (
      <div className={styles.userCard}>
        <div className={styles.userCardTitle}>用户信息</div>
        <div className={styles.userCardGrid}>
          <span>ID：{editingAdmin.id || "-"}</span>
          <span>姓名：{editingAdmin.name || "-"}</span>
          <span>昵称：{editingAdmin.nickName || "-"}</span>
          <span>邮箱：{editingAdmin.email || "-"}</span>
          <span>手机号：{editingAdmin.mobile || "-"}</span>
          <span>状态：{HGUserPermissionVM.getStatusText(editingAdmin.status)}</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染角色复选框组。
   * @returns {React.ReactNode} 角色复选框组节点。
   */
  renderRoleCheckboxes = () => {
    const { roleOptions, selectedRoleIds, loadingUserRoles, loadingRoles } = this.state;

    if (loadingUserRoles) {
      return <div className={styles.loadingText}>加载用户角色中...</div>;
    }

    if (loadingRoles) {
      return <div className={styles.loadingText}>加载角色选项中...</div>;
    }

    if (roleOptions.length === 0) {
      return <div className={styles.loadingText}>暂无可分配角色</div>;
    }

    return (
      <div className={styles.roleCheckboxGroup}>
        {roleOptions.map((option) => (
          <div key={option.value} className={styles.roleCheckboxItem}>
            <input
              type="checkbox"
              id={`role_${option.value}`}
              checked={selectedRoleIds.includes(option.value)}
              onChange={(e) => this.handleRoleChange(option.value, e.target.checked)}
            />
            <label htmlFor={`role_${option.value}`}>{option.label}</label>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染编辑权限弹窗。
   * @returns {React.ReactNode} 弹窗节点。
   */
  renderModal = () => {
    const { modalVisible, submitting } = this.state;

    if (!modalVisible) return null;

    return (
      <div className={styles.modalOverlay} onClick={this.handleModalClose}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>编辑用户权限</h3>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={this.handleModalClose}
            >
              ✕
            </button>
          </div>
          <div className={styles.modalBody}>
            {this.renderUserCard()}
            <div className={styles.roleSection}>
              <div className={styles.roleSectionTitle}>分配角色</div>
              {this.renderRoleCheckboxes()}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btn}
              onClick={this.handleModalClose}
            >
              取消
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={this.handleSubmitRoles}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "确认"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { data, loading, pagination, keyword } = this.state;
    return (
      <div className={styles.userPermissionContainer}>
        <HGCardPage
          title="用户权限管理"
          extra={
            <HGSpacePage>
              <HGInputSearch
                allowClear
                enterButton={loading ? "搜索中..." : "搜索"}
                disabled={loading}
                placeholder="管理员ID、姓名、昵称、邮箱或手机号前缀"
                className={styles.searchInput}
                onSearch={this.handleSearch}
              />
            </HGSpacePage>
          }
        >
          {this.renderTip()}
          <HGTablePage
            rowKey={(record) => record.id}
            columns={this.getColumns()}
            dataSource={data}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: !keyword,
              showQuickJumper: !keyword,
            }}
            onChange={this.handleTableChange}
            scroll={{ y: 420 }}
          />
        </HGCardPage>
        {this.renderModal()}
      </div>
    );
  }
}

export default HGUserPermissionPage;
