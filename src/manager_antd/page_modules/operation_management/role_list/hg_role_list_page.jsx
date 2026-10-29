/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-10-29 23:31:14
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_list/hg_role_list_page.jsx
 * @Description: 角色管理页面，默认 cursor 分页展示角色列表并支持编辑、删除
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGTreeSelectPage from "../../../../components/hg_tree_select/hg_tree_select_page";
import styles from "./hg_role_list.module.css";
import HGRoleListVM, { ROLE_LIST_PAGE_SIZE } from "./hg_role_list_vm";

/**
 * 角色管理页面。
 * 职责：展示角色 cursor 分页列表，支持编辑与删除角色。
 * 性能约束：
 * - 使用 cursor 分页，避免 OFFSET 深分页扫描，应对千万级 role 表。
 * - 后端不返回实时 total，前端仅根据 hasMore 计算"至少 N 条"，避免 COUNT(*) 锁竞争。
 * - 每次最多加载 pageSize+1 条数据判断 hasMore，减少单次网络传输量。
 */
class HGRoleListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      /** @type {Array<Object>} 角色列表数据 */
      data: [],
      /** @type {boolean} 加载状态 */
      loading: false,
      /**
       * cursorByPage: 页码到 cursor 的映射。
       * key=页码，value=该页起始 cursor（上一页最后一条的 id）。
       * 1 页的 cursor 固定为 0，表示从头开始。
       */
      cursorByPage: { 1: 0 },
      /** @type {Object} 分页状态 */
      pagination: {
        current: 1,
        pageSize: ROLE_LIST_PAGE_SIZE,
        total: 0,
      },
      /** @type {boolean} 编辑弹窗可见性 */
      editModalVisible: false,
      /** @type {Object} 编辑表单数据 */
      editFormData: { id: "", name: "", description: "" },
      /** @type {boolean} 编辑提交加载状态 */
      editLoading: false,
      /** @type {boolean} 删除确认弹窗可见性 */
      deleteModalVisible: false,
      /** @type {Object} 待删除的角色记录 */
      deleteRecord: null,
      permissionModalVisible: false,
      permissionRole: null,
      permissionOptions: [],
      selectedPermissions: [],
      permissionLoading: false,
      permissionMFACode: "", // 当前权限替换申请的一次性 MFA 验证码。
    };
  }

  /**
   * 组件挂载后立即拉取首页数据。
   */
  componentDidMount() {
    const { pagination } = this.state;
    this.fetchRoleList(pagination.current, pagination.pageSize);
  }

  /**
   * 拉取角色列表，使用后端 cursor 分页接口。
   * cursor 分页原理：
   * 1. 首页 cursor=0，后端查 id DESC LIMIT pageSize+1。
   * 2. 后端返回 nextCursor=最后一条的 id，hasMore=true/false。
   * 3. 前端将 nextCursor 存入 cursorByPage[2]，翻到第 2 页时取出使用。
   * 4. 后端查 id < cursor LIMIT pageSize+1，避免 OFFSET 扫描。
   *
   * @param {number} pageNum 当前前端页码。
   * @param {number} pageSize 每页条数。
   */
  fetchRoleList = (pageNum, pageSize) => {
    const { cursorByPage } = this.state;
    const cursor = Number(cursorByPage[pageNum] ?? 0);
    this.setState({ loading: true });

    HGRoleListVM.fetchRoleList({ cursor, pageSize })
      .then((res) => {
        const rows = HGRoleListVM.toRoleRows(res?.list || []);

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
              total: HGRoleListVM.buildCursorPaginationTotal({
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
        message.error("角色列表获取失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 表格分页变化处理。
   * @param {Object} paginationInfo 表格分页信息。
   */
  handleTableChange = (paginationInfo) => {
    const { pagination } = this.state;
    const pageSizeChanged = paginationInfo.pageSize !== pagination.pageSize;
    if (pageSizeChanged) {
      this.setState({ cursorByPage: { 1: 0 } }, () => {
        this.fetchRoleList(1, paginationInfo.pageSize);
      });
      return;
    }
    this.fetchRoleList(paginationInfo.current, paginationInfo.pageSize);
  };

  /**
   * 刷新当前页；cursor 映射失效时回到第一页。
   */
  handleRefresh = () => {
    const { pagination } = this.state;
    this.fetchRoleList(pagination.current, pagination.pageSize);
  };

  /**
   * 打开编辑弹窗并回填角色信息。
   * @param {Object} record 角色记录。
   */
  handleEdit = (record) => {
    this.setState({
      editModalVisible: true,
      editFormData: {
        id: record.id,
        name: record.name,
        description: record.description || "",
      },
    });
  };

  /**
   * 关闭编辑弹窗。
   */
  handleEditModalClose = () => {
    this.setState({
      editModalVisible: false,
      editFormData: { id: "", name: "", description: "" },
    });
  };

  /**
   * 编辑表单字段变化处理。
   * @param {string} field 字段名。
   * @param {string} value 字段值。
   */
  handleEditFormChange = (field, value) => {
    this.setState((prevState) => ({
      editFormData: { ...prevState.editFormData, [field]: value },
    }));
  };

  /**
   * 确认编辑角色。
   */
  handleEditConfirm = () => {
    const { editFormData } = this.state;
    if (!editFormData.name.trim()) {
      message.error("角色名称不能为空");
      return;
    }
    this.setState({ editLoading: true });
    HGRoleListVM.updateRole(editFormData)
      .then(() => {
        message.success("角色更新成功");
        this.handleEditModalClose();
        this.handleRefresh();
      })
      .catch(() => {
        message.error("角色更新失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ editLoading: false });
      });
  };

  /**
   * 打开删除确认弹窗。
   * @param {Object} record 角色记录。
   */
  handleDelete = (record) => {
    this.setState({ deleteModalVisible: true, deleteRecord: record });
  };

  /**
   * 关闭删除确认弹窗。
   */
  handleDeleteModalClose = () => {
    this.setState({ deleteModalVisible: false, deleteRecord: null });
  };

  /** 打开自定义角色的权限编辑页，并从服务端读取当前授权。 */
  handlePermissions = (record) => {
    this.setState({
      permissionRole: record,
      permissionModalVisible: true,
      permissionLoading: true,
      permissionOptions: [],
      selectedPermissions: [],
      permissionMFACode: "",
    });
    HGRoleListVM.fetchPermissions(record.id)
      .then((result) =>
        this.setState({
          permissionOptions: result?.list || [],
          selectedPermissions: result?.selected || [],
        })
      )
      .catch(() => {
        message.error("权限目录加载失败");
        this.setState({ permissionModalVisible: false });
      })
      .finally(() => this.setState({ permissionLoading: false }));
  };

  /** 保存权限全量快照；后台事务失败时保持弹窗，供用户重试。 */
  handlePermissionsConfirm = () => {
    const {
      permissionRole,
      selectedPermissions,
      permissionLoading,
      permissionMFACode,
    } = this.state;
    if (!permissionRole || permissionLoading) return;
    if (!/^\d{6}$/.test(permissionMFACode)) {
      message.error("请输入申请人的 6 位 MFA 验证码");
      return;
    }
    this.setState({ permissionLoading: true });
    HGRoleListVM.updatePermissions(
      permissionRole.id,
      selectedPermissions,
      permissionMFACode
    )
      .then((result) => {
        message.success(
          `权限变更已提交审批，申请单 ${result?.approvalId || ""}`
        );
        this.setState({ permissionModalVisible: false, permissionMFACode: "" });
      })
      .catch((error) => message.error(error?.message || "角色权限更新失败"))
      .finally(() => this.setState({ permissionLoading: false }));
  };

  /**
   * 确认删除角色。
   */
  handleDeleteConfirm = () => {
    const { deleteRecord } = this.state;
    if (!deleteRecord) return;

    HGRoleListVM.deleteRole({ id: deleteRecord.id })
      .then(() => {
        message.success("角色删除成功");
        this.handleDeleteModalClose();
        this.handleRefresh();
      })
      .catch(() => {
        message.error("角色删除失败，请稍后重试");
      });
  };

  /**
   * 渲染角色名称单元格：角色标识徽标 + 名称 + ID。
   * @param {Object} record 角色记录。
   * @returns {React.ReactNode} 角色名称节点。
   */
  renderRoleCell = (record) => (
    <div className={styles.roleCell}>
      <span
        className={styles.roleBadge}
        style={{ background: HGRoleListVM.getRoleBadgeColor(record.id) }}
      >
        {(record.name || "角").slice(0, 1)}
      </span>
      <div className={styles.roleMeta}>
        <span className={styles.roleName}>{record.name || "-"}</span>
        <span className={styles.roleId}>ID：{record.id || "-"}</span>
      </div>
    </div>
  );

  /**
   * 角色表格列配置。
   * 字段来源：role 表的 role_id, name, description, create_at。
   * @returns {Array<Object>} 表格列定义。
   */
  getColumns = () => [
    {
      title: "角色名称",
      dataIndex: "name",
      width: 260,
      render: (_, record) => this.renderRoleCell(record),
    },
    {
      title: "角色描述",
      dataIndex: "description",
      width: 340,
      render: (text) =>
        text ? (
          <span className={styles.descriptionText}>{text}</span>
        ) : (
          <span className={styles.emptyText}>暂无描述</span>
        ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 200,
      render: (text) =>
        text ? (
          <span className={styles.timeText}>{text}</span>
        ) : (
          <span className={styles.emptyText}>-</span>
        ),
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 160,
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <HGButtonPage type="link" onClick={() => this.handleEdit(record)}>
            编辑
          </HGButtonPage>
          <span className={styles.actionDivider} />
          <HGButtonPage
            type="link"
            danger
            onClick={() => this.handleDelete(record)}
          >
            删除
          </HGButtonPage>
        </div>
      ),
    },
  ];

  /**
   * 渲染顶部指标卡：角色总数、本页展示、含描述角色、每页条数。
   * @returns {React.ReactNode} 指标卡节点。
   */
  renderStats = () => {
    const { data, pagination, loading } = this.state;
    const describedCount = data.filter((row) =>
      Boolean(row.description)
    ).length;

    const items = [
      {
        label: "角色总数",
        value: loading ? "-" : pagination.total,
        suffix: "条起",
        tone: "blue",
        icon: "🛡",
      },
      {
        label: "本页展示",
        value: loading ? "-" : data.length,
        suffix: "个角色",
        tone: "purple",
        icon: "≡",
      },
      {
        label: "含描述角色",
        value: loading ? "-" : describedCount,
        suffix: "个",
        tone: "green",
        icon: "✎",
      },
      {
        label: "每页条数",
        value: pagination.pageSize,
        suffix: "条/页",
        tone: "gray",
        icon: "◷",
      },
    ];

    return <HGStatCardPage items={items} />;
  };

  /**
   * 渲染提示条：说明分页策略与总数口径。
   * @returns {React.ReactNode} 提示条节点。
   */
  renderTip = () => {
    const { pagination } = this.state;
    return (
      <div className={styles.tipBar}>
        <span className={styles.tipDot} />
        <span>
          共至少 {pagination.total} 条角色记录，使用 cursor
          分页避免深分页扫描；角色权限通过“权限管理”分配。
        </span>
      </div>
    );
  };

  /**
   * 渲染编辑弹窗表单内容。
   * @returns {React.ReactNode} 表单节点。
   */
  renderEditForm = () => {
    const { editFormData } = this.state;
    return (
      <div className={styles.formBody}>
        <div className={styles.formItem}>
          <label className={styles.formLabel}>角色ID</label>
          <input
            type="text"
            className={`${styles.formInput} ${styles.formInputDisabled}`}
            value={editFormData.id}
            disabled
          />
        </div>
        <div className={styles.formItem}>
          <label className={styles.formLabel}>
            角色名称 <span className={styles.requiredMark}>*</span>
          </label>
          <input
            type="text"
            className={styles.formInput}
            value={editFormData.name}
            onChange={(e) => this.handleEditFormChange("name", e.target.value)}
            placeholder="请输入角色名称，例如：内容审核员"
          />
        </div>
        <div className={styles.formItem}>
          <label className={styles.formLabel}>角色描述</label>
          <textarea
            className={styles.formTextarea}
            value={editFormData.description}
            onChange={(e) =>
              this.handleEditFormChange("description", e.target.value)
            }
            placeholder="描述该角色的职责范围，便于后续授权时判断"
            rows={4}
          />
          <span className={styles.formHint}>
            建议说明角色可操作的业务域，例如“可审核视频与弹幕，不可操作商城订单”。
          </span>
        </div>
      </div>
    );
  };

  /**
   * 渲染删除确认弹窗内容：角色标签 + 风险提示。
   * @returns {React.ReactNode} 删除确认节点。
   */
  renderDeleteContent = () => {
    const { deleteRecord } = this.state;
    if (!deleteRecord) return null;

    return (
      <div className={styles.deleteBody}>
        <div className={styles.deleteRoleRow}>
          <span
            className={styles.roleBadge}
            style={{
              background: HGRoleListVM.getRoleBadgeColor(deleteRecord.id),
            }}
          >
            {(deleteRecord.name || "角").slice(0, 1)}
          </span>
          <div className={styles.roleMeta}>
            <span className={styles.roleName}>{deleteRecord.name}</span>
            <span className={styles.roleId}>ID：{deleteRecord.id}</span>
          </div>
        </div>
        <HGStatusTagPage tone="error" dot={false}>
          删除后不可恢复
        </HGStatusTagPage>
        <p className={styles.deleteText}>
          删除角色后，已绑定该角色的用户将立即失去对应权限，相关授权记录建议保留审计留痕。
        </p>
      </div>
    );
  };

  render() {
    const {
      data,
      loading,
      pagination,
      editModalVisible,
      editLoading,
      deleteModalVisible,
    } = this.state;
    return (
      <div className={styles.roleListContainer}>
        <HGPageHeaderPage
          title="角色管理"
          description="维护平台角色定义，角色是权限的集合；用户通过绑定角色获得对应业务范围的操作能力。"
          extra={
            <HGButtonPage onClick={this.handleRefresh} loading={loading}>
              刷新
            </HGButtonPage>
          }
        />

        {this.renderStats()}

        <HGCardPage title="角色列表">
          {this.renderTip()}
          <HGTablePage
            rowKey={(record) => record.id}
            columns={this.getColumns()}
            dataSource={data}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
            }}
            onChange={this.handleTableChange}
            scroll={{ y: 460 }}
            autoRowHeight
          />
        </HGCardPage>

        {/* 编辑角色弹窗 */}
        <HGModalPage
          visible={editModalVisible}
          title="编辑角色"
          onClose={this.handleEditModalClose}
          onOk={this.handleEditConfirm}
          onCancel={this.handleEditModalClose}
          okText={editLoading ? "提交中..." : "保存"}
          cancelText="取消"
          okType="primary"
        >
          {this.renderEditForm()}
        </HGModalPage>

        <HGModalPage
          visible={this.state.permissionModalVisible}
          title={`角色权限 · ${this.state.permissionRole?.name || ""}`}
          onClose={() =>
            this.setState({
              permissionModalVisible: false,
              permissionMFACode: "",
            })
          }
          onCancel={() =>
            this.setState({
              permissionModalVisible: false,
              permissionMFACode: "",
            })
          }
          onOk={this.handlePermissionsConfirm}
          okText={this.state.permissionLoading ? "处理中..." : "提交权限审批"}
          cancelText="取消"
        >
          <HGTreeSelectPage
            treeData={this.state.permissionOptions.map((item) => ({
              title: `${item.code} · ${item.description}`,
              value: item.code,
            }))}
            value={this.state.selectedPermissions}
            onChange={(values) =>
              this.setState({ selectedPermissions: values })
            }
            treeCheckable
            allowClear
            showCheckedStrategy="SHOW_CHILD"
          />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={this.state.permissionMFACode}
            onChange={(event) =>
              this.setState({ permissionMFACode: event.target.value })
            }
            placeholder="申请人 MFA 验证码"
          />
        </HGModalPage>

        {/* 停用确认弹窗 */}
        <HGModalPage
          visible={deleteModalVisible}
          title="删除角色"
          onClose={this.handleDeleteModalClose}
          onOk={this.handleDeleteConfirm}
          onCancel={this.handleDeleteModalClose}
          okText="确认删除"
          cancelText="取消"
          okType="danger"
        >
          {this.renderDeleteContent()}
        </HGModalPage>
      </div>
    );
  }
}

export default HGRoleListPage;
