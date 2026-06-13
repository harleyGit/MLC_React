/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_list/hg_admin_list_page.jsx
 * @Description: 管理员列表页面，默认 cursor 分页展示管理员并支持关键词搜索
 */
import React, { Component } from "react";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGAdminListVM, { ADMIN_LIST_PAGE_SIZE } from "./hg_admin_list_vm";
import styles from "./hg_admin_list.module.css";

/**
 * 管理员列表页面。
 * 职责：展示管理员 cursor 分页列表，并提供关键词搜索管理员能力。
 */
class HGAdminListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      loading: false,
      keyword: "",
      cursorByPage: { 1: 0 },
      pagination: {
        current: 1,
        pageSize: ADMIN_LIST_PAGE_SIZE,
        total: 0,
      },
    };
  }

  componentDidMount() {
    const { pagination } = this.state;
    this.fetchAdminList(pagination.current, pagination.pageSize);
  }

  /**
   * 拉取管理员列表，使用后端 cursor 分页接口。
   * @param {number} pageNum 当前前端页码。
   * @param {number} pageSize 每页条数。
   */
  fetchAdminList = (pageNum, pageSize) => {
    const { cursorByPage } = this.state;
    const cursor = Number(cursorByPage[pageNum] ?? 0);
    this.setState({ loading: true, keyword: "" });
    HGAdminListVM.fetchAdminList({ cursor, pageSize })
      .then((res) => {
        const rows = HGAdminListVM.toAdminRows(res?.list || []);
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
              total: HGAdminListVM.buildCursorPaginationTotal({
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
    HGAdminListVM.searchAdmins(keyword)
      .then((res) => {
        const rows = HGAdminListVM.toAdminRows(res?.list || []);
        this.setState({
          data: rows,
          pagination: {
            current: 1,
            pageSize: ADMIN_LIST_PAGE_SIZE,
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
      width: 160,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "昵称",
      dataIndex: "nickName",
      width: 160,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      width: 220,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "手机号",
      dataIndex: "mobile",
      width: 160,
      render: (text) => <span className={styles.cellText}>{text || "-"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (text) => <span className={styles.statusText}>{HGAdminListVM.getStatusText(text)}</span>,
    },
  ];

  renderTip = () => {
    const { keyword, pagination } = this.state;
    if (!keyword) {
      return (
        <p className={styles.tipText}>
          默认展示管理员列表，使用 cursor 分页避免深分页扫描；可输入关键词进行精确/前缀搜索。
        </p>
      );
    }
    return (
      <p className={styles.tipText}>
        当前关键词：{keyword}，返回 {pagination.total} 条匹配管理员。清空搜索框可回到列表模式。
      </p>
    );
  };

  render() {
    const { data, loading, pagination, keyword } = this.state;
    return (
      <div className={styles.adminListContainer}>
        <HGCardPage
          title="管理员列表"
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
      </div>
    );
  }
}

export default HGAdminListPage;
