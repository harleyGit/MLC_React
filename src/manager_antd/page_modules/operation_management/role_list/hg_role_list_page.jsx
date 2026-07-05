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

  render() {
    const { data, loading, pagination } = this.state;
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
          />
        </HGCardPage>
      </div>
    );
  }
}

export default HGRoleListPage;
