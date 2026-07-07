/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-07-05
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-07-05
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_list/hg_role_list_page.jsx
 * @Description: 角色列表页面，默认 cursor 分页展示角色列表
 */
import React, { Component } from "react";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGRoleListVM, { ROLE_LIST_PAGE_SIZE } from "./hg_role_list_vm";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import styles from "./hg_role_list.module.css";

/**
 * 角色列表页面。
 * 职责：展示角色 cursor 分页列表，支持翻页浏览。
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
       * 作用：翻页时直接取出对应 cursor 发给后端，无需后端维护分页状态。
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
    // 从映射中取出当前页对应的 cursor；首页为 0。
    const cursor = Number(cursorByPage[pageNum] ?? 0);
    this.setState({ loading: true });

    HGRoleListVM.fetchRoleList({ cursor, pageSize })
      .then((res) => {
        // 将后端数据转换为表格行格式
        const rows = HGRoleListVM.toRoleRows(res?.list || []);

        this.setState((prevState) => {
          // 如果有下一页，将 nextCursor 存入 cursorByPage
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
              // 构建"至少 N 条"的分页 total，避免后端执行 COUNT(*)
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
      // 切换每页条数时重置 cursor 映射，从第 1 页重新加载
      this.setState({ cursorByPage: { 1: 0 } }, () => {
        this.fetchRoleList(1, paginationInfo.pageSize);
      });
      return;
    }
    this.fetchRoleList(paginationInfo.current, paginationInfo.pageSize);
  };

  /**
   * 编辑角色处理。
   * @param {Object} record 角色记录。
   */
  handleEdit = (record) => {
    this.setState({
      editModalVisible: true,
      editFormData: { id: record.id, name: record.name, description: record.description || "" },
    });
  };

  /**
   * 关闭编辑弹窗。
   */
  handleEditModalClose = () => {
    this.setState({ editModalVisible: false, editFormData: { id: "", name: "", description: "" } });
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
        // 刷新当前页
        const { pagination } = this.state;
        this.fetchRoleList(pagination.current, pagination.pageSize);
      })
      .catch(() => {
        message.error("角色更新失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ editLoading: false });
      });
  };

  /**
   * 删除角色处理。
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
        // 刷新当前页
        const { pagination } = this.state;
        this.fetchRoleList(pagination.current, pagination.pageSize);
      })
      .catch(() => {
        message.error("角色删除失败，请稍后重试");
      });
  };

  /**
   * 角色表格列配置。
   * 字段来源：role 表的 role_id, name, description, create_at。
   * @returns {Array<Object>} 表格列定义。
   */
  getColumns = () => [
    {
      title: "角色ID",
      dataIndex: "id",
      width: 180,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "角色名称",
      dataIndex: "name",
      width: 180,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "角色描述",
      dataIndex: "description",
      width: 300,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 200,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 200,
      render: (_, record) => (
        <span>
          <a onClick={() => this.handleEdit(record)}>编辑</a>
          <span style={{ margin: "0 8px", color: "#e8e8e8" }}>|</span>
          <a onClick={() => this.handleDelete(record)}>删除</a>
        </span>
      ),
    },
  ];

  /**
   * 渲染提示信息。
   * @returns {React.ReactNode} 提示文本节点。
   */
  renderTip = () => {
    const { pagination } = this.state;
    return (
      <p className={styles.tipText}>
        共 {pagination.total}+ 条角色记录，使用 cursor 分页避免深分页扫描。
      </p>
    );
  };

  /**
   * 渲染编辑弹窗表单内容。
   * @returns {React.ReactNode} 表单节点。
   */
  renderEditForm = () => {
    const { editFormData } = this.state;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>角色ID</label>
          <input
            type="text"
            value={editFormData.id}
            disabled
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              backgroundColor: "#f5f5f5",
              color: "#666",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>角色名称 <span style={{ color: "#ff4d4f" }}>*</span></label>
          <input
            type="text"
            value={editFormData.name}
            onChange={(e) => this.handleEditFormChange("name", e.target.value)}
            placeholder="请输入角色名称"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>角色描述</label>
          <textarea
            value={editFormData.description}
            onChange={(e) => this.handleEditFormChange("description", e.target.value)}
            placeholder="请输入角色描述"
            rows={4}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              resize: "vertical",
            }}
          />
        </div>
      </div>
    );
  };

  render() {
    const { data, loading, pagination, editModalVisible, editLoading, deleteModalVisible, deleteRecord } = this.state;
    return (
      <div className={styles.roleListContainer}>
        <HGCardPage
          title="角色列表"
          extra={
            <HGButtonPage
              type="primary"
              onClick={() => this.fetchRoleList(1, pagination.pageSize)}
            >
              刷新
            </HGButtonPage>
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
              showSizeChanger: true,
              showQuickJumper: true,
            }}
            onChange={this.handleTableChange}
            scroll={{ y: 420 }}
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
          okText={editLoading ? "提交中..." : "确认"}
          cancelText="取消"
          okType="primary"
        >
          {this.renderEditForm()}
        </HGModalPage>

        {/* 删除确认弹窗 */}
        <HGModalPage
          visible={deleteModalVisible}
          title="确认删除"
          onClose={this.handleDeleteModalClose}
          onOk={this.handleDeleteConfirm}
          onCancel={this.handleDeleteModalClose}
          okText="确认删除"
          cancelText="取消"
          okType="danger"
        >
          <p>确定要删除角色 "{deleteRecord?.name}" 吗？删除后将无法恢复。</p>
        </HGModalPage>
      </div>
    );
  }
}

export default HGRoleListPage;
