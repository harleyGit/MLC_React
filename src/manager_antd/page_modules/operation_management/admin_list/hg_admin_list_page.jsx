/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-01 14:41:35
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_list/hg_admin_list_page.jsx
 * @Description: 管理员列表页面，默认 cursor 分页展示管理员并支持关键词搜索
 */
import React, { Component } from "react";
import HGAvatarPage from "../../../../components/hg_avatar/hg_avatar_page";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import styles from "./hg_admin_list.module.css";
import HGAdminListVM, { ADMIN_LIST_PAGE_SIZE } from "./hg_admin_list_vm";

/**
 * 管理员列表页面。
 * 职责：展示管理员 cursor 分页列表，并提供关键词搜索管理员能力。
 * 说明：页面只负责展示与交互编排，分页/搜索/状态文案统一由 VM 提供。
 */
class HGAdminListPage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记；卸载后不再更新弹窗内的授权信息。
    this.hgBindingRequest = 0; // 弹窗查询序号；切换管理员或关闭时废弃旧响应。
    this.state = {
      data: [], // 当前页管理员记录；空数组表示尚未加载或查询无结果。
      loading: false, // 管理员列表/搜索请求标记；默认 false。
      keyword: "", // 当前搜索关键词；空字符串表示列表模式。
      cursorByPage: { 1: 0 }, // 前端页码到后端游标的映射；首页游标为 0。
      pagination: {
        current: 1, // 前端当前页码，初始第一页。
        pageSize: ADMIN_LIST_PAGE_SIZE, // 单页管理员条数，初始 20。
        total: 0, // 搜索命中数或 cursor 列表的最小估计数，初始 0。
      },
      bindingAdmin: null, // 正在查看绑定的管理员；null 表示弹窗关闭。
      bindings: [], // 已加载的活动绑定；空数组仅在请求成功后表示无绑定。
      bindingCursor: "", // 下一页绑定游标；空字符串表示无下一页。
      bindingHasMore: false, // 服务端是否还有绑定续页。
      bindingLoading: false, // 绑定页请求进行中，避免重复加载。
      bindingLoaded: false, // 首页是否成功返回，用于区分初始态与空态。
      bindingError: "", // 绑定请求错误；空字符串表示无错误。
      bindingRoles: {}, // 角色 ID -> 角色名称；缺失时只展示角色编码。
      bindingPermissions: {}, // 角色 ID -> {list, error}；不含被单独限制权限的绑定。
      bindingDetailLoading: false, // 当前页角色名称及权限查询进行中。
      bindingRoleError: "", // 角色目录错误；空字符串表示无错误。
    };
  }

  componentDidMount() {
    this.hgMounted = true;
    const { pagination } = this.state;
    this.fetchAdminList(pagination.current, pagination.pageSize);
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgBindingRequest += 1;
  }

  /** 打开目标管理员的只读授权弹窗；必须使用当前行的精确业务用户 ID。 */
  openBindings = (admin) => {
    if (!admin.id) {
      message.error("该管理员缺少业务用户 ID，无法查询角色");
      return;
    }
    const request = ++this.hgBindingRequest; // 当前弹窗身份；旧管理员的响应不可覆盖新管理员。
    this.setState({
      bindingAdmin: admin, bindings: [], bindingCursor: "", bindingHasMore: false,
      bindingLoading: false, bindingLoaded: false, bindingError: "",
      bindingRoles: {}, bindingPermissions: {}, bindingDetailLoading: false, bindingRoleError: "",
    }, () => this.loadBindings("0", request, admin.id));
  };

  /** 关闭弹窗并使在途绑定及权限请求失效；下次打开重新读取授权。 */
  closeBindings = () => {
    this.hgBindingRequest += 1;
    this.setState({ bindingAdmin: null, bindings: [], bindingLoading: false, bindingDetailLoading: false });
  };

  /** 按绑定 ID 字符串游标加载一页，避免将权限接口失败当作用户没有角色。 */
  loadBindings = async (cursor, request = this.hgBindingRequest, userId = this.state.bindingAdmin?.id) => {
    if (!userId || request !== this.hgBindingRequest || userId !== this.state.bindingAdmin?.id ||
      this.state.bindingLoading || this.state.bindingDetailLoading) return;
    this.setState({ bindingLoading: true, bindingError: "" });
    try {
      const result = await HGAdminListVM.fetchBindings(userId, cursor);
      if (!this.hgMounted || request !== this.hgBindingRequest) return;
      if (!Array.isArray(result?.list) || (result.hasMore && (!result.nextCursor || String(result.nextCursor) === String(cursor) || result.list.length === 0))) {
        throw new Error("绑定响应无效");
      }
      this.setState((previous) => ({
        bindings: cursor === "0" ? result.list : [...previous.bindings, ...result.list],
        bindingCursor: result.nextCursor || "",
        bindingHasMore: Boolean(result.hasMore),
        bindingLoaded: true,
        bindingLoading: false,
        bindingDetailLoading: result.list.length > 0,
      }));
      if (!result.list.length) return;

      const roleIds = [...new Set(result.list.map((binding) => String(binding.roleId)))]; // 本页角色名称去重查询。
      const permissionIds = [...new Set(result.list.filter((binding) => !binding.permissionsLimited)
        .map((binding) => String(binding.roleId)))]; // 权限受限的绑定不能用角色权限冒充实际权限。
      const [names, permissions] = await Promise.allSettled([
        HGAdminListVM.fetchRoleNames(roleIds),
        HGAdminListVM.fetchRolePermissions(permissionIds),
      ]);
      if (!this.hgMounted || request !== this.hgBindingRequest) return;
      this.setState((previous) => ({
        bindingRoles: { ...previous.bindingRoles, ...(names.status === "fulfilled" ? names.value : {}) },
        bindingPermissions: {
          ...previous.bindingPermissions,
          ...(permissions.status === "fulfilled"
            ? permissions.value
            : Object.fromEntries(permissionIds.map((roleId) => [roleId, { list: [], error: "业务权限加载失败，请重试" }]))),
        },
        bindingRoleError: names.status === "rejected" ? "角色名称加载失败，请重试" : "",
        bindingDetailLoading: false,
      }));
    } catch {
      if (this.hgMounted && request === this.hgBindingRequest) {
        this.setState({ bindingError: "角色绑定加载失败，请重试", bindingLoading: false, bindingDetailLoading: false });
      }
    }
  };

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
      render: (text) => (
        <span className={styles.cellText}>{text || "未绑定"}</span>
      ),
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
    {
      title: "角色权限",
      dataIndex: "id",
      width: 125,
      render: (_, record) => (
        <HGButtonPage type="link" disabled={!record.id} onClick={() => this.openBindings(record)}>
          查看权限
        </HGButtonPage>
      ),
    },
  ];

  /** 展示角色当前权限；绑定单独限制权限时后端不返回子集，明确不推断实际权限。 */
  renderBindingPermissions = (binding) => {
    if (binding.permissionsLimited) {
      return <span>该绑定已限制权限；接口未返回实际权限子集，无法确认业务权限</span>;
    }
    const result = this.state.bindingPermissions[String(binding.roleId)]; // 当前角色权限加载结果；undefined 表示仍未加载。
    if (!result) return <span>{this.state.bindingDetailLoading ? "业务权限加载中..." : "业务权限未能加载，请重试"}</span>;
    if (result.error) return <span role="alert">{result.error}</span>;
    if (!result.list.length) return <span>该角色暂无业务权限</span>;
    return (
      <ul className={styles.permissionList}>
        {result.list.map((item) => (
          <li key={item.code}>{item.description || item.code}（{item.code}）</li>
        ))}
      </ul>
    );
  };

  /** 单条活动绑定展示角色名称、业务权限与适用作用域，不将待审批角色混入。 */
  renderBinding = (binding) => {
    const roleName = this.state.bindingRoles[String(binding.roleId)]; // 权威角色目录中的名称；缺失仅回退编码。
    const scopeNames = { global: "全局", shop: "店铺", org: "组织" }; // 已知作用域中文名；其他类型保留原值。
    const scope = scopeNames[binding.scopeType] || binding.scopeType || "未知"; // 绑定作用域，非 global 需显示资源 ID。
    return (
      <article key={binding.id} className={styles.bindingCard}>
        <h4 className={styles.bindingTitle}>{roleName || `角色名称未获取（${binding.roleCode || binding.roleId}）`}</h4>
        <p>角色编码：{binding.roleCode || "—"}</p>
        <p>适用范围：{scope}{binding.scopeId ? ` · ${binding.scopeId}` : ""}</p>
        <p>有效期：{binding.expiresAt ? `至 ${new Date(binding.expiresAt).toLocaleString()}` : "长期有效"}</p>
        <div>业务权限：{this.renderBindingPermissions(binding)}</div>
      </article>
    );
  };

  /** 弹窗只按用户主动点击加载，支持失败重试与有界游标续页。 */
  renderBindingsModal = () => {
    const {
      bindingAdmin, bindings, bindingCursor, bindingHasMore, bindingLoading,
      bindingDetailLoading, bindingLoaded, bindingError, bindingRoleError,
    } = this.state;
    if (!bindingAdmin) return null;
    return (
      <HGModalPage
        visible
        size="large"
        title={`角色权限 · ${bindingAdmin.name || bindingAdmin.nickName || bindingAdmin.id}`}
        onClose={this.closeBindings}
        footer={<HGButtonPage onClick={this.closeBindings}>关闭</HGButtonPage>}
      >
        <div className={styles.bindingDetails}>
          <p>管理员 ID：{bindingAdmin.id}</p>
          {bindingLoading && <p role="status">角色绑定加载中...</p>}
          {bindingError && <p role="alert">{bindingError}</p>}
          {bindingRoleError && <p role="alert">{bindingRoleError}；已使用角色编码标识</p>}
          {bindingLoaded && !bindingLoading && !bindingError && bindings.length === 0 && <p>暂无已生效的角色绑定</p>}
          {bindings.map(this.renderBinding)}
          {bindingDetailLoading && <p role="status">角色名称及业务权限加载中...</p>}
          {(bindingError || bindingRoleError || (!bindingDetailLoading && bindings.some((binding) =>
            !binding.permissionsLimited && this.state.bindingPermissions[String(binding.roleId)]?.error))) && (
            <HGButtonPage onClick={() => this.openBindings(bindingAdmin)}>重新加载</HGButtonPage>
          )}
          {bindingHasMore && (
            <HGButtonPage
              disabled={bindingLoading || bindingDetailLoading}
              loading={bindingLoading}
              onClick={() => this.loadBindings(bindingCursor)}
            >
              加载更多绑定
            </HGButtonPage>
          )}
        </div>
      </HGModalPage>
    );
  };

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
            当前为列表模式，cursor 分页避免深分页扫描；共至少 {pagination.total}{" "}
            条管理员记录。
          </span>
        </div>
      );
    }
    return (
      <div className={`${styles.tipBar} ${styles.tipBarSearch}`}>
        <span className={styles.tipDot} />
        <span>
          搜索“{keyword}”命中 {pagination.total}{" "}
          条记录，清空搜索框可回到列表模式。
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
          />
        </HGCardPage>
        {this.renderBindingsModal()}
      </div>
    );
  }
}

export default HGAdminListPage;
