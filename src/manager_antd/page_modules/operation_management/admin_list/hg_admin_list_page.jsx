/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_list/hg_admin_list_page.jsx
 * @Description: 管理员列表页面，默认 cursor 分页展示管理员并支持关键词搜索
 */
import React, { Component } from "react";
import HGAvatarPage from "../../../../components/hg_avatar/hg_avatar_page";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGAdminListVM, { ADMIN_LIST_PAGE_SIZE } from "./hg_admin_list_vm";
import styles from "./hg_admin_list.module.css";

/**
 * 管理员列表页面。
 * 职责：展示管理员 cursor 分页列表，并提供关键词搜索管理员能力。
 * 说明：页面只负责展示与交互编排，分页/搜索/状态文案统一由 VM 提供。
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
   * 刷新当前列表；搜索态下重放当前关键词搜索，列表态返回第一页。
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
   * 渲染管理员主体信息单元格：头像 + 姓名 + 昵称。
   * @param {Object} record 管理员行数据。
   * @returns {React.ReactNode} 主体信息节点。
   */
  renderAdminCell = (record) => (
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
   * 管理员表格列配置。
   * @returns {Array<Object>} 表格列定义。
   */
  getColumns = () => [
    {
      title: "管理员",
      dataIndex: "name",
      width: 220,
      render: (_, record) => this.renderAdminCell(record),
    },
    {
      title: "管理员ID",
      dataIndex: "id",
      width: 150,
      render: (text) => <span className={styles.idText}>{text || "-"}</span>,
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
      render: (text) => <span className={styles.cellText}>{text || "未绑定"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (text) => (
        <HGStatusTagPage tone={HGAdminListVM.getStatusTone(text)}>
          {HGAdminListVM.getStatusText(text)}
        </HGStatusTagPage>
      ),
    },
  ];

  /**
   * 渲染顶部指标卡：总数、本页启用/禁用、搜索命中。
   * @returns {React.ReactNode} 指标卡节点。
   */
  renderStats = () => {
    const { data, pagination, keyword, loading } = this.state;
    const enabledCount = HGAdminListVM.countByStatus(data, 1);
    const disabledCount = data.length - enabledCount;

    const items = [
      {
        label: "管理员总数",
        value: loading ? "-" : pagination.total,
        suffix: keyword ? "条命中" : "条起",
        tone: "blue",
        icon: "👥",
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
   * 渲染表格上方的提示条：区分列表模式与搜索模式。
   * @returns {React.ReactNode} 提示条节点。
   */
  renderTip = () => {
    const { keyword, pagination } = this.state;
    if (!keyword) {
      return (
        <div className={styles.tipBar}>
          <span className={styles.tipDot} />
          <span>
            当前为列表模式，cursor 分页避免深分页扫描；共至少 {pagination.total} 条管理员记录。
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

  render() {
    const { data, loading, pagination, keyword } = this.state;
    return (
      <div className={styles.adminListContainer}>
        <HGPageHeaderPage
          title="管理员管理"
          description="统一管理运维后台管理员账号，支持按 ID、姓名、昵称、邮箱或手机号前缀快速定位。"
          extra={
            <HGButtonPage onClick={this.handleRefresh} loading={loading}>
              刷新
            </HGButtonPage>
          }
        />

        {this.renderStats()}

        <HGCardPage
          title="管理员账户"
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
            scroll={{ y: 460 }}
          />
        </HGCardPage>
      </div>
    );
  }
}

export default HGAdminListPage;
