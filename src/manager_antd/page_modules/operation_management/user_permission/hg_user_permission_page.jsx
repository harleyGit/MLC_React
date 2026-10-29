/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/user_permission/hg_user_permission_page.jsx
 * @Description: 用户管理页面，展示管理员/用户列表并支持通过弹窗分配角色
 *
 * 千万级表约束：
 * - 管理员列表使用 cursor 分页，避免 OFFSET 深分页扫描。
 * - 后端不返回实时 total，前端仅根据 hasMore 计算"至少 N 条"。
 * - 角色选项最多加载 500 个，避免前端渲染过多选项。
 * - 搜索接口严格限制关键词长度和返回条数。
 */
import React, { Component } from "react";
import HGAvatarPage from "../../../../components/hg_avatar/hg_avatar_page";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGDetailGridPage from "../../../../components/hg_detail_grid/hg_detail_grid_page";
import HGInputPage, {
  HGInputSearch,
} from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGUserPermissionVM, {
  USER_PERMISSION_PAGE_SIZE,
} from "./hg_user_permission_vm";
import styles from "./hg_user_permission.module.css";

/**
 * 用户管理页面。
 * 职责：展示用户 cursor 分页列表，提供分配角色弹窗。
 * 说明：页面负责展示与交互编排，接口调用与数据转换统一由 VM 提供。
 */
class HGUserPermissionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      /** @type {Array<Object>} 用户列表数据 */
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
      /** @type {boolean} 弹窗是否可见 */
      modalVisible: false,
      /** @type {Object|null} 当前编辑的用户信息 */
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
      /** @type {string} 弹窗内角色筛选关键词 */
      roleFilter: "",
    };
  }

  /**
   * 组件挂载后只读取用户列表；旧授权入口停用后不再预加载角色目录。
   */
  componentDidMount() {
    const { pagination } = this.state;
    this.fetchAdminList(pagination.current, pagination.pageSize);
  }

  /**
   * 加载所有角色选项（用于弹窗中的角色多选）。
   * 千万级表约束：最多加载 500 个角色，避免前端渲染过多选项。
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
   * 拉取用户列表，使用后端 cursor 分页接口。
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
        message.error("用户列表获取失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 搜索用户；空关键词恢复默认列表模式。
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
          message.info("未搜索到匹配用户");
        }
      })
      .catch(() => {
        message.error("用户搜索失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 刷新列表：搜索态重放关键词搜索，列表态回到第一页。
   */
  handleRefresh = () => {
    const { keyword } = this.state;
    if (keyword) {
      this.handleSearch(keyword);
      return;
    }
    this.setState({ cursorByPage: { 1: 0 } }, () => {
      this.fetchAdminList(1, this.state.pagination.pageSize);
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
   * 旧授权入口不能将 IAM 角色 ID 用作旧表绑定，保留明确拒绝提示。
   */
  handleEditClick = () => {
    // 旧批量角色视图与写接口均返回 410；不能混用 IAM 角色 ID 与旧 ops 授权表。
    message.warning("旧批量授权已停用，角色分配尚需接入 IAM 审批流程");
  };

  /**
   * 关闭分配角色弹窗并清理临时状态。
   */
  handleModalClose = () => {
    this.setState({
      modalVisible: false,
      editingAdmin: null,
      selectedRoleIds: [],
      roleFilter: "",
    });
  };

  /**
   * 切换角色选中状态。
   * @param {string} roleId 角色 ID。
   */
  handleRoleToggle = (roleId) => {
    this.setState((prevState) => {
      const selected = prevState.selectedRoleIds.includes(roleId);
      const selectedRoleIds = selected
        ? prevState.selectedRoleIds.filter((id) => id !== roleId)
        : [...prevState.selectedRoleIds, roleId];
      return { selectedRoleIds };
    });
  };

  /**
   * 清空已选角色。
   */
  handleClearRoles = () => {
    this.setState({ selectedRoleIds: [] });
  };

  /**
   * 角色筛选关键词变化。
   * @param {Object|string} eventOrValue 输入组件事件或直接值。
   */
  handleRoleFilterChange = (eventOrValue) => {
    const value =
      typeof eventOrValue === "string"
        ? eventOrValue
        : eventOrValue?.target?.value || "";
    this.setState({ roleFilter: value });
  };

  /**
   * 旧批量接口已停用；即使表单被程序触发也不得提交。
   */
  handleSubmitRoles = () => {
    message.warning("旧批量授权已停用，请使用 IAM 授权流程");
  };

  /**
   * 渲染用户主体信息单元格：头像 + 姓名 + 昵称。
   * @param {Object} record 用户行数据。
   * @returns {React.ReactNode} 主体信息节点。
   */
  renderUserCell = (record) => (
    <div className={styles.userCell}>
      <HGAvatarPage name={record.name || record.nickName || record.id} />
      <div className={styles.userMeta}>
        <span className={styles.userName}>{record.name || "-"}</span>
        <span className={styles.userSub}>
          {record.nickName ? `@${record.nickName}` : "未设置昵称"}
        </span>
      </div>
    </div>
  );

  /**
   * 用户表格列配置。
   * @returns {Array<Object>} 表格列定义。
   */
  getColumns = () => [
    {
      title: "用户",
      dataIndex: "name",
      width: 220,
      render: (_, record) => this.renderUserCell(record),
    },
    {
      title: "用户ID",
      dataIndex: "id",
      width: 150,
      render: (text) => <span className={styles.idText}>{text || "-"}</span>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      width: 210,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "手机号",
      dataIndex: "mobile",
      width: 150,
      render: (text) => <span className={styles.cellText}>{text || "未绑定"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (text) => (
        <HGStatusTagPage tone={HGUserPermissionVM.getStatusTone(text)}>
          {HGUserPermissionVM.getStatusText(text)}
        </HGStatusTagPage>
      ),
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 120,
      render: () => (
        <HGButtonPage type="link" disabled title="旧批量授权已停用，需通过 IAM 审批授权">
          IAM 授权
        </HGButtonPage>
      ),
    },
  ];

  /**
   * 渲染顶部指标卡：用户总数、本页启用/禁用、每页条数。
   * @returns {React.ReactNode} 指标卡节点。
   */
  renderStats = () => {
    const { data, pagination, keyword, loading } = this.state;
    const enabledCount = HGUserPermissionVM.countByStatus(data, 1);
    const disabledCount = data.length - enabledCount;

    const items = [
      {
        label: "用户总数",
        value: loading ? "-" : pagination.total,
        suffix: keyword ? "条命中" : "条起",
        tone: "blue",
        icon: "👤",
      },
      {
        label: "本页启用",
        value: loading ? "-" : enabledCount,
        suffix: "人",
        tone: "green",
        icon: "✓",
      },
      {
        label: "本页禁用",
        value: loading ? "-" : disabledCount,
        suffix: "人",
        tone: "orange",
        icon: "!",
      },
      {
        label: "每页条数",
        value: pagination.pageSize,
        suffix: keyword ? "搜索模式" : "条/页",
        tone: "purple",
        icon: "≡",
      },
    ];

    return <HGStatCardPage items={items} />;
  };

  /**
   * 渲染提示条，区分列表模式与搜索模式。
   * @returns {React.ReactNode} 提示条节点。
   */
  renderTip = () => {
    const { keyword, pagination } = this.state;
    if (!keyword) {
      return (
        <div className={styles.tipBar}>
          <span className={styles.tipDot} />
          <span>
            当前为列表模式，共至少 {pagination.total} 条用户记录；旧批量授权已停用，角色分配尚需接入 IAM 的 MFA 与双人审批流程。
          </span>
        </div>
      );
    }
    return (
      <div className={`${styles.tipBar} ${styles.tipBarSearch}`}>
        <span className={styles.tipDot} />
        <span>
          搜索“{keyword}”命中 {pagination.total} 条记录，清空搜索框可回到列表模式。
        </span>
      </div>
    );
  };

  /**
   * 渲染弹窗中的用户摘要：头像 + 关键字段。
   * @returns {React.ReactNode} 用户摘要节点。
   */
  renderUserSummary = () => {
    const { editingAdmin } = this.state;
    if (!editingAdmin) return null;

    return (
      <div className={styles.userSummary}>
        <div className={styles.userSummaryHead}>
          <HGAvatarPage
            name={editingAdmin.name || editingAdmin.nickName || editingAdmin.id}
            size="large"
          />
          <div className={styles.userSummaryMeta}>
            <div className={styles.userSummaryName}>
              {editingAdmin.name || "-"}
              <HGStatusTagPage
                tone={HGUserPermissionVM.getStatusTone(editingAdmin.status)}
              >
                {HGUserPermissionVM.getStatusText(editingAdmin.status)}
              </HGStatusTagPage>
            </div>
            <div className={styles.userSummarySub}>
              {editingAdmin.nickName ? `@${editingAdmin.nickName}` : "未设置昵称"}
            </div>
          </div>
        </div>
        <HGDetailGridPage
          columns={2}
          items={[
            { label: "用户ID", value: editingAdmin.id },
            { label: "邮箱", value: editingAdmin.email },
            { label: "手机号", value: editingAdmin.mobile },
            {
              label: "已选角色",
              value: `${this.state.selectedRoleIds.length} 个`,
            },
          ]}
        />
      </div>
    );
  };

  /**
   * 渲染角色选择区：支持关键词筛选的角色卡片网格。
   * @returns {React.ReactNode} 角色选择区节点。
   */
  renderRoleSelector = () => {
    const {
      roleOptions,
      selectedRoleIds,
      loadingUserRoles,
      loadingRoles,
      roleFilter,
    } = this.state;

    if (loadingUserRoles) {
      return <div className={styles.placeholderText}>正在加载用户已分配角色...</div>;
    }

    if (loadingRoles) {
      return <div className={styles.placeholderText}>正在加载角色列表...</div>;
    }

    if (roleOptions.length === 0) {
      return <div className={styles.placeholderText}>暂无可分配角色</div>;
    }

    const keyword = roleFilter.trim().toLowerCase();
    const filteredOptions = keyword
      ? roleOptions.filter((option) =>
          String(option.label).toLowerCase().includes(keyword)
        )
      : roleOptions;

    return (
      <div className={styles.roleSection}>
        <div className={styles.roleToolbar}>
          <div className={styles.roleSectionTitle}>
            分配角色
            <span className={styles.roleCounter}>
              已选 {selectedRoleIds.length} / {roleOptions.length}
            </span>
          </div>
          <div className={styles.roleToolbarActions}>
            <HGInputPage
              value={roleFilter}
              placeholder="筛选角色名称"
              allowClear
              onChange={this.handleRoleFilterChange}
              className={styles.roleFilterInput}
            />
            <HGButtonPage
              type="text"
              onClick={this.handleClearRoles}
              disabled={selectedRoleIds.length === 0}
            >
              清空
            </HGButtonPage>
          </div>
        </div>

        {filteredOptions.length === 0 ? (
          <div className={styles.placeholderText}>没有匹配的角色</div>
        ) : (
          <div className={styles.roleOptionGrid}>
            {filteredOptions.map((option) => {
              const checked = selectedRoleIds.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.roleOption} ${
                    checked ? styles.roleOptionActive : ""
                  }`}
                  onClick={() => this.handleRoleToggle(option.value)}
                  aria-pressed={checked}
                >
                  <span className={styles.roleOptionCheck}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className={styles.roleOptionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染分配角色弹窗。
   * @returns {React.ReactNode} 弹窗节点。
   */
  renderModal = () => {
    const { modalVisible, submitting } = this.state;
    return (
      <HGModalPage
        visible={modalVisible}
        title="分配角色"
        size="large"
        onClose={this.handleModalClose}
        onCancel={this.handleModalClose}
        onOk={this.handleSubmitRoles}
        okText={submitting ? "提交中..." : "保存角色"}
        cancelText="取消"
        okType="primary"
      >
        <div className={styles.modalContent}>
          {this.renderUserSummary()}
          {this.renderRoleSelector()}
        </div>
      </HGModalPage>
    );
  };

  render() {
    const { data, loading, pagination, keyword } = this.state;
    return (
      <div className={styles.userPermissionContainer}>
        <HGPageHeaderPage
          title="用户管理"
          description="查看平台用户账号并为其分配角色，角色决定用户可访问的业务范围与操作权限。"
          extra={
            <HGButtonPage onClick={this.handleRefresh} loading={loading}>
              刷新
            </HGButtonPage>
          }
        />

        {this.renderStats()}

        <HGCardPage
          title="用户账户"
          extra={
            <HGSpacePage>
              <HGInputSearch
                allowClear
                enterButton={loading ? "搜索中..." : "搜索"}
                disabled={loading}
                placeholder="用户ID、姓名、昵称、邮箱或手机号前缀"
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
            scroll={{ y: 460 }}
          />
        </HGCardPage>
        {this.renderModal()}
      </div>
    );
  }
}

export default HGUserPermissionPage;
