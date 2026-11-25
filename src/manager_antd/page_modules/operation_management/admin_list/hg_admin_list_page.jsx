/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-25 20:36:09
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_list/hg_admin_list_page.jsx
 * @Description: 管理员列表页面，默认 cursor 分页展示管理员并支持关键词搜索
 */
import React, { Component } from "react";
import HGAvatarPage from "../../../../components/hg_avatar/hg_avatar_page";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGCheckbox } from "../../../../components/hg_checkbox/hg_checkbox_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGSpacePage from "../../../../components/hg_space/hg_space_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import { hgTableColumns, hgTableProps } from "../../../../components/hg_table/hg_table_contract.js";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import { HGAuthButton } from "../../../../modules/iam/hg_permission";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
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
    this.hgDecidingApprovalId = ""; // 提交中的申请编号；防止同一次 MFA 并发裁决。
    this.hgRevokingBindingId = ""; // 提交中的绑定编号；防止重复撤销。
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
      bindingPermissions: {}, // 角色 ID -> {list, selected, error}；每页绑定加载后自动查询角色权限。
      bindingDetailLoading: false, // 当前页角色名称及权限查询进行中。
      bindingRoleError: "", // 角色目录错误；空字符串表示无错误。
      bindingView: "permissions", // 弹窗展示模式：permissions 只查生效角色，authorization 同时查待审批申请。
      pendingGrants: [], // 当前管理员已加载的待审批申请；不算作活动授权。
      pendingCursor: "", // 待审批申请的下一页字符串游标；空字符串表示无续页。
      pendingHasMore: false, // 服务端是否还有未加载的待审批申请。
      pendingLoading: false, // 待审批页请求进行中，避免重复查询。
      pendingLoaded: false, // 待审批首页是否成功返回；与空态区分。
      pendingDetailLoading: false, // 待审批申请的角色名称加载中。
      pendingError: "", // 待审批接口错误；不与活动绑定错误混淆。
      pendingRoleError: "", // 待审批角色名称查询错误；不影响已生效权限展示。
      approvalCode: "", // 审批人的一次性 MFA；弹窗关闭或提交后清空。
      approvalDecisionId: "", // 当前正在裁决的申请编号，空字符串表示空闲。
      revokingBindingId: "", // 当前正在撤销的绑定编号，空字符串表示空闲。
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

  /** 按当前行精确业务用户 ID 打开弹窗；授权查询额外加载待审批，不能将其视作生效角色。 */
  openBindings = (admin, view = "permissions") => {
    if (!admin.id) {
      message.error("该管理员缺少业务用户 ID，无法查询角色");
      return;
    }
    const request = ++this.hgBindingRequest; // 当前弹窗身份；旧管理员的响应不可覆盖新管理员。
    this.setState(
      {
        bindingAdmin: admin,
        bindings: [],
        bindingCursor: "",
        bindingHasMore: false,
        bindingLoading: false,
        bindingLoaded: false,
        bindingError: "",
        bindingRoles: {},
        bindingPermissions: {},
        bindingDetailLoading: false,
        bindingRoleError: "",
        bindingView: view,
        pendingGrants: [],
        pendingCursor: "",
        pendingHasMore: false,
        pendingLoading: false,
        pendingLoaded: false,
        pendingDetailLoading: false,
        pendingError: "",
        pendingRoleError: "",
        approvalCode: "",
        approvalDecisionId: "",
        revokingBindingId: "",
      },
      () => {
        this.loadBindings("0", request, admin.id);
        if (view === "authorization")
          this.loadPendingGrants("0", request, admin.id);
      }
    );
  };

  /** 关闭弹窗并使在途绑定及权限请求失效；下次打开重新读取授权。 */
  closeBindings = () => {
    this.hgBindingRequest += 1;
    this.setState({
      bindingAdmin: null,
      bindings: [],
      bindingLoading: false,
      bindingDetailLoading: false,
      pendingGrants: [],
      pendingLoading: false,
      pendingDetailLoading: false,
      approvalCode: "",
    });
  };

  /** 按绑定 ID 字符串游标加载一页，避免将权限接口失败当作用户没有角色。 */
  loadBindings = async (
    cursor,
    request = this.hgBindingRequest,
    userId = this.state.bindingAdmin?.id
  ) => {
    if (
      !userId ||
      request !== this.hgBindingRequest ||
      userId !== this.state.bindingAdmin?.id ||
      this.state.bindingLoading ||
      this.state.bindingDetailLoading
    )
      return;
    this.setState({ bindingLoading: true, bindingError: "" });
    try {
      const result = await HGAdminListVM.fetchBindings(userId, cursor);
      if (!this.hgMounted || request !== this.hgBindingRequest) return;
      if (
        !Array.isArray(result?.list) ||
        (result.hasMore &&
          (!result.nextCursor ||
            String(result.nextCursor) === String(cursor) ||
            result.list.length === 0))
      ) {
        throw new Error("绑定响应无效");
      }
      this.setState((previous) => ({
        bindings:
          cursor === "0" ? result.list : [...previous.bindings, ...result.list],
        bindingCursor: result.nextCursor || "",
        bindingHasMore: Boolean(result.hasMore),
        bindingLoaded: true,
        bindingLoading: false,
        bindingDetailLoading: result.list.length > 0,
      }));
      if (!result.list.length) return;

      const roleIds = [
        ...new Set(result.list.map((binding) => String(binding.roleId))),
      ]; // 本页角色名称去重查询。
      const permissionIds = [
        ...new Set(
          result.list
            .filter(
              (binding) =>
                this.state.bindingView === "authorization" ||
                !binding.permissionsLimited
            )
            .map((binding) => String(binding.roleId))
        ),
      ]; // 授权查询自动读取本页角色配置；普通查看不查询受限绑定，不能推断其实际权限。
      const [names, permissions] = await Promise.allSettled([
        HGAdminListVM.fetchRoleNames(roleIds),
        permissionIds.length
          ? HGAdminListVM.fetchRolePermissions(permissionIds)
          : Promise.resolve({}),
      ]);
      if (!this.hgMounted || request !== this.hgBindingRequest) return;
      this.setState((previous) => ({
        bindingRoles: {
          ...previous.bindingRoles,
          ...(names.status === "fulfilled" ? names.value : {}),
        },
        bindingPermissions: {
          ...previous.bindingPermissions,
          ...Object.fromEntries(
            permissionIds.map((roleId) => {
              const detail =
                permissions.status === "fulfilled"
                  ? permissions.value?.[roleId]
                  : null;
              return [
                roleId,
                Array.isArray(detail?.list) && Array.isArray(detail?.selected)
                  ? detail
                  : { list: [], selected: [], error: "业务权限加载失败，请重试" },
              ];
            })
          ),
        },
        bindingRoleError:
          names.status === "rejected" ? "角色名称加载失败，请重试" : "",
        bindingDetailLoading: false,
      }));
    } catch {
      if (this.hgMounted && request === this.hgBindingRequest) {
        this.setState({
          bindingError: "角色绑定加载失败，请重试",
          bindingLoading: false,
          bindingDetailLoading: false,
        });
      }
    }
  };

  /** 待审批申请独立游标加载；响应失效或查询失败不影响另一来源的授权结果。 */
  loadPendingGrants = async (
    cursor,
    request = this.hgBindingRequest,
    userId = this.state.bindingAdmin?.id
  ) => {
    if (
      !userId ||
      request !== this.hgBindingRequest ||
      userId !== this.state.bindingAdmin?.id ||
      this.state.bindingView !== "authorization" ||
      this.state.pendingLoading ||
      this.state.pendingDetailLoading
    )
      return;
    this.setState({ pendingLoading: true, pendingError: "" });
    try {
      const result = await HGAdminListVM.fetchPendingGrants(userId, cursor);
      if (!this.hgMounted || request !== this.hgBindingRequest) return;
      if (
        !Array.isArray(result?.list) ||
        (result.hasMore &&
          (!result.nextCursor ||
            String(result.nextCursor) === String(cursor) ||
            result.list.length === 0))
      ) {
        throw new Error("待审批响应无效");
      }
      this.setState((previous) => ({
        pendingGrants:
          cursor === "0"
            ? result.list
            : [...previous.pendingGrants, ...result.list],
        pendingCursor: result.nextCursor || "",
        pendingHasMore: Boolean(result.hasMore),
        pendingLoaded: true,
        pendingLoading: false,
        pendingDetailLoading: result.list.length > 0,
      }));
      if (!result.list.length) return;
      const roleIds = [
        ...new Set(result.list.map((grant) => String(grant.roleId))),
      ]; // 当前页待审批角色 ID；复用角色目录而不读取权限当作生效授权。
      try {
        const names = await HGAdminListVM.fetchRoleNames(roleIds);
        if (this.hgMounted && request === this.hgBindingRequest) {
          this.setState((previous) => ({
            bindingRoles: { ...previous.bindingRoles, ...names },
            pendingRoleError: "",
            pendingDetailLoading: false,
          }));
        }
      } catch {
        if (this.hgMounted && request === this.hgBindingRequest) {
          this.setState({
            pendingRoleError: "待审批角色名称加载失败，请重试",
            pendingDetailLoading: false,
          });
        }
      }
    } catch {
      if (this.hgMounted && request === this.hgBindingRequest) {
        this.setState({
          pendingError: "待审批授权加载失败，请重试",
          pendingLoading: false,
          pendingDetailLoading: false,
        });
      }
    }
  };

  /** 按原有双人审批流程裁决目标申请；服务端仍复核审批人与 MFA，切换目标后不刷新新用户。 */
  decideApproval = async (grant, approve) => {
    const admin = this.state.bindingAdmin; // 提交时目标账号快照，避免异步期间切换目标。
    const request = this.hgBindingRequest; // 当前弹窗身份；响应迟到时不写入其他管理员的状态。
    const approvalId = String(grant.approvalId); // 待审批申请 ID，不是绑定 ID。
    if (
      this.state.bindingView !== "authorization" ||
      !admin ||
      this.hgDecidingApprovalId ||
      !this.state.pendingGrants.some(
        (item) => String(item.approvalId) === approvalId
      )
    )
      return;
    const mfaCode = this.state.approvalCode.trim(); // 审批人验证码只在内存持有至本次提交。
    if (!/^\d{6}$/.test(mfaCode)) {
      message.error("请输入审批人的 6 位 MFA 验证码");
      return;
    }
    this.hgDecidingApprovalId = approvalId;
    this.setState({ approvalDecisionId: approvalId, approvalCode: "" });
    try {
      await HGAdminListVM.decideApproval(approvalId, mfaCode, approve);
      if (this.hgMounted && request === this.hgBindingRequest) {
        message.success(approve ? "审批通过并已生效" : "申请已拒绝");
        this.openBindings(admin, "authorization");
      }
    } catch (error) {
      if (this.hgMounted && request === this.hgBindingRequest)
        message.error(error?.message || "审批失败");
    } finally {
      this.hgDecidingApprovalId = "";
      if (this.hgMounted) this.setState({ approvalDecisionId: "" });
    }
  };

  /** 按原有后端签名接口精确撤销活动绑定；不能撤销引导超管绑定或待审批申请。 */
  revokeBinding = async (binding) => {
    const admin = this.state.bindingAdmin; // 操作目标快照，重开弹窗后不刷新别的管理员。
    const request = this.hgBindingRequest; // 防止旧撤销请求覆盖当前查询。
    const bindingId = String(binding.id); // 后端绑定主键字符串；不能用 roleId。
    const currentBinding = this.state.bindings.find(
      (item) => String(item.id) === bindingId
    ); // 必须校验当前页的活动绑定。
    if (
      this.state.bindingView !== "authorization" ||
      !admin ||
      this.hgRevokingBindingId ||
      !currentBinding ||
      currentBinding.roleCode === "super_admin"
    )
      return;
    this.hgRevokingBindingId = bindingId;
    this.setState({ revokingBindingId: bindingId });
    try {
      await HGAdminListVM.revokeBinding(admin.id, bindingId);
      if (this.hgMounted && request === this.hgBindingRequest) {
        message.success("授权已撤销");
        this.openBindings(admin, "authorization");
      }
    } catch (error) {
      if (this.hgMounted && request === this.hgBindingRequest)
        message.error(error?.message || "撤销失败");
    } finally {
      this.hgRevokingBindingId = "";
      if (this.hgMounted) this.setState({ revokingBindingId: "" });
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
   * @returns {ReturnType<typeof hgTableColumns>} 表格列定义；点击字段可查看 HGTableColumn 的默认值、用途与优先级。
   */
  getColumns = () => hgTableColumns([
    {
      title: "管理员",
      dataIndex: "name",
      width: 220,
      align: "left",
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
      width: 205,
      render: (_, record) => (
        <HGSpacePage>
          <HGButtonPage
            type="link"
            disabled={!record.id}
            onClick={() => this.openBindings(record)}
          >
            查看权限
          </HGButtonPage>
          <HGButtonPage
            type="link"
            disabled={!record.id}
            onClick={() => this.openBindings(record, "authorization")}
          >
            授权查询
          </HGButtonPage>
        </HGSpacePage>
      ),
    },
  ]);

  /** 只读展示角色权限目录：selected 中的权限勾选，未选权限不勾选；受限绑定不推断实际权限。 */
  renderBindingPermissions = (binding) => {
    const limited = Boolean(binding.permissionsLimited); // 单独限制的绑定不能把角色配置当作实际权限。
    if (limited && this.state.bindingView !== "authorization") {
      return (
        <span>该绑定已限制权限；接口未返回实际权限子集，无法确认业务权限</span>
      );
    }
    const result = this.state.bindingPermissions[String(binding.roleId)]; // 当前角色权限加载结果；undefined 表示仍未加载。
    const loading = this.state.bindingDetailLoading; // 当前页角色权限与名称并行加载。
    const notice = limited && (
      <p className={styles.permissionHint}>
        该绑定已限制权限；下方仅为角色配置，接口未返回此绑定的实际权限子集。
      </p>
    ); // 即使接口返回角色的 selected，也不能声称受限绑定拥有这些权限。
    if (!result)
      return (
        <>
          {notice}
          <span>
            {loading ? "业务权限加载中..." : "业务权限未能加载，请重试"}
          </span>
        </>
      );
    if (result.error)
      return (
        <>
          {notice}
          <span role="alert">{result.error}</span>
        </>
      );
    if (!result.list.length)
      return (
        <>
          {notice}
          <span>暂无可展示的业务权限目录</span>
        </>
      );
    const selected = new Set(result.selected); // 服务端该角色已配置的权限编码，不能由目录条目本身推定授权。
    return (
      <>
        {notice || (
          <p className={styles.permissionHint}>
            勾选表示角色已配置；实际访问仍受适用范围限制（仅查看）。
          </p>
        )}
        <div
          className={styles.permissionGrid}
          role="group"
          aria-label="角色业务权限（仅查看）"
        >
          {result.list.map((item) => (
            <div className={styles.permissionItem} key={item.code}>
              <HGCheckbox checked={selected.has(item.code)} readOnly>
                {item.description || item.code}（{item.code}）
              </HGCheckbox>
            </div>
          ))}
        </div>
      </>
    );
  };

  /** 单条活动绑定的只读详情：查看权限直接展示，授权查询由“查看回填”展开。 */
  renderBinding = (binding) => {
    const roleName = this.state.bindingRoles[String(binding.roleId)]; // 权威角色目录中的名称；缺失仅回退编码。
    const scopeNames = { global: "全局", shop: "店铺", org: "组织" }; // 已知作用域中文名；其他类型保留原值。
    const scope = scopeNames[binding.scopeType] || binding.scopeType || "未知"; // 绑定作用域，非 global 需显示资源 ID。
    return (
      <article key={binding.id} className={styles.bindingCard}>
        <h4 className={styles.bindingTitle}>
          {roleName ||
            `角色名称未获取（${binding.roleCode || binding.roleId}）`}
        </h4>
        <p>角色编码：{binding.roleCode || "—"}</p>
        <p>
          适用范围：{scope}
          {binding.scopeId ? ` · ${binding.scopeId}` : ""}
        </p>
        <p>
          有效期：
          {binding.expiresAt
            ? `至 ${new Date(binding.expiresAt).toLocaleString()}`
            : "长期有效"}
        </p>
        <div>业务权限：{this.renderBindingPermissions(binding)}</div>
      </article>
    );
  };

  /** 授权查询中的已生效角色卡片：权限目录与选中态来自角色接口，受限绑定不冒充实际权限。 */
  renderAuthorizationBinding = (binding) => {
    const roleName = this.state.bindingRoles[String(binding.roleId)]; // 角色目录名称；缺失时保留角色编码。
    const scopeNames = { global: "全局", shop: "店铺", org: "组织" }; // 已知作用域文案，未知类型原样展示。
    const scope = scopeNames[binding.scopeType] || binding.scopeType || "未知"; // 绑定适用范围，非全局显示资源 ID。
    return (
      <article key={`binding-${binding.id}`} className={styles.bindingCard}>
        <div className={styles.authorizationCardHeader}>
          <h5 className={styles.bindingTitle}>
            {roleName || binding.roleCode || `角色 #${binding.roleId}`}
          </h5>
          <span className={styles.activeStatus}>已授权</span>
        </div>
        <p>角色编码：{binding.roleCode || "—"}</p>
        <p>作用域：{scope}{binding.scopeId ? ` / ${binding.scopeId}` : ""}</p>
        <p>失效时间：{binding.expiresAt ? new Date(binding.expiresAt).toLocaleString() : "长期"}</p>
        <div className={styles.bindingActions}>
          <HGAuthButton
            appearance="link"
            danger
            permission={HG_PERMISSIONS.IAM_GRANT}
            onClick={() => this.revokeBinding(binding)}
            disabled={
              binding.roleCode === "super_admin" ||
              Boolean(this.state.revokingBindingId || this.hgRevokingBindingId)
            }
          >
            撤销
          </HGAuthButton>
        </div>
        <div>业务权限：{this.renderBindingPermissions(binding)}</div>
      </article>
    );
  };

  /** 待审批申请卡片：申请未生效，不展示角色权限选中态。 */
  renderAuthorizationGrant = (grant) => {
    const roleName = this.state.bindingRoles[String(grant.roleId)]; // 角色目录可能缺失，保留角色 ID。
    const scopeNames = { global: "全局", shop: "店铺", org: "组织" }; // 与活动绑定使用同一作用域文案。
    const scope = scopeNames[grant.scopeType] || grant.scopeType || "未知"; // 申请目标作用域。
    return (
      <article key={`approval-${grant.approvalId}`} className={styles.bindingCard}>
        <div className={styles.authorizationCardHeader}>
          <h5 className={styles.bindingTitle}>{roleName || `角色 #${grant.roleId}`}</h5>
          <span className={styles.pendingStatus}>待审批</span>
        </div>
        <p>申请 #{grant.approvalId}</p>
        <p>作用域：{scope}{grant.scopeId ? ` / ${grant.scopeId}` : ""}</p>
        <p>失效时间：{grant.expiresAt ? new Date(grant.expiresAt).toLocaleString() : "长期（审批后）"}</p>
        {grant.approvalExpiresAt && (
          <p>申请有效期：至 {new Date(grant.approvalExpiresAt).toLocaleString()}</p>
        )}
        <p className={styles.permissionHint}>尚未生效，不展示业务权限。</p>
        <div className={styles.bindingActions}>
          <HGAuthButton
            appearance="link"
            allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
            onClick={() => this.decideApproval(grant, true)}
            disabled={Boolean(this.state.approvalDecisionId || this.hgDecidingApprovalId)}
          >
            允许
          </HGAuthButton>
          <HGAuthButton
            appearance="link"
            danger
            allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
            onClick={() => this.decideApproval(grant, false)}
            disabled={Boolean(this.state.approvalDecisionId || this.hgDecidingApprovalId)}
          >
            拒绝
          </HGAuthButton>
        </div>
      </article>
    );
  };

  /** 授权查询使用卡片展示已生效绑定和待审批申请，两个来源仍独立分页与报错。 */
  renderAuthorizationTable = () => {
    const {
      bindingAdmin,
      bindings,
      bindingCursor,
      bindingHasMore,
      bindingLoading,
      bindingLoaded,
      bindingDetailLoading,
      bindingError,
      bindingRoleError,
      pendingGrants,
      pendingCursor,
      pendingHasMore,
      pendingLoading,
      pendingLoaded,
      pendingDetailLoading,
      pendingError,
      pendingRoleError,
      approvalCode,
    } = this.state;
    return (
      <section className={styles.bindingSection} aria-label="查询角色授权">
        <h4>查询角色授权</h4>
        <p>
          已授权与待审批分别查询；角色权限自动加载，待审批不会获得权限。
        </p>
        <HGButtonPage
          disabled={
            bindingLoading ||
            pendingLoading ||
            bindingDetailLoading ||
            pendingDetailLoading
          }
          onClick={() => this.openBindings(bindingAdmin, "authorization")}
        >
          查询角色授权
        </HGButtonPage>
        <div className={styles.authorizationCards}>
          {bindings.map(this.renderAuthorizationBinding)}
          {pendingGrants.map(this.renderAuthorizationGrant)}
        </div>
        {bindingLoading && <p role="status">角色绑定加载中...</p>}
        {bindingError && <p role="alert">{bindingError}</p>}
        {bindingRoleError && (
          <p role="alert">{bindingRoleError}；已使用角色编码标识</p>
        )}
        {pendingLoading && <p role="status">待审批申请加载中...</p>}
        {pendingError && <p role="alert">{pendingError}</p>}
        {pendingRoleError && (
          <p role="alert">{pendingRoleError}；已使用角色 ID 标识</p>
        )}
        {this.hgDecidingApprovalId && (
          <p role="status">上一笔审批正在处理，请稍候</p>
        )}
        {this.hgRevokingBindingId && (
          <p role="status">上一笔撤销正在处理，请稍候</p>
        )}
        {bindingDetailLoading && <p role="status">角色名称加载中...</p>}
        {pendingDetailLoading && <p role="status">待审批角色名称加载中...</p>}
        {bindingLoaded &&
          pendingLoaded &&
          !bindingLoading &&
          !pendingLoading &&
          !bindingError &&
          !pendingError &&
          bindings.length === 0 &&
          pendingGrants.length === 0 && <p>暂无已授权或待审批角色</p>}
        {pendingGrants.length > 0 && (
          <label className={styles.approvalField}>
            <span>审批人 MFA 验证码（申请人不可自批）</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={approvalCode}
              onChange={(event) =>
                this.setState({ approvalCode: event.target.value })
              }
              placeholder="由另一名有审批权限的管理员输入 6 位动态码"
            />
          </label>
        )}
        {(bindingError ||
          bindingRoleError ||
          pendingError ||
          pendingRoleError ||
          bindings.some(
            (binding) => this.state.bindingPermissions[String(binding.roleId)]?.error
          )) && (
          <HGButtonPage
            onClick={() => this.openBindings(bindingAdmin, "authorization")}
          >
            重新加载
          </HGButtonPage>
        )}
        {bindingHasMore && (
          <HGButtonPage
            disabled={bindingLoading || bindingDetailLoading}
            loading={bindingLoading}
            onClick={() => this.loadBindings(bindingCursor)}
          >
            加载更多授权
          </HGButtonPage>
        )}
        {pendingHasMore && (
          <HGButtonPage
            disabled={pendingLoading || pendingDetailLoading}
            loading={pendingLoading}
            onClick={() => this.loadPendingGrants(pendingCursor)}
          >
            加载更多待审批
          </HGButtonPage>
        )}
      </section>
    );
  };

  /** “查看权限”与“授权查询”均使用卡片，授权查询另外展示待审批申请。 */
  renderBindingsModal = () => {
    const {
      bindingAdmin,
      bindings,
      bindingCursor,
      bindingHasMore,
      bindingLoading,
      bindingDetailLoading,
      bindingLoaded,
      bindingError,
      bindingRoleError,
      bindingView,
    } = this.state;
    if (!bindingAdmin) return null;
    return (
      <HGModalPage
        visible
        size="large"
        title={`${
          bindingView === "authorization" ? "授权查询" : "角色权限"
        } · ${bindingAdmin.name || bindingAdmin.nickName || bindingAdmin.id}`}
        onClose={this.closeBindings}
        footer={<HGButtonPage onClick={this.closeBindings}>关闭</HGButtonPage>}
      >
        <div className={styles.bindingDetails}>
          <p>管理员 ID：{bindingAdmin.id}</p>
          {bindingView === "authorization" ? (
            this.renderAuthorizationTable()
          ) : (
            <>
              {bindingLoading && <p role="status">角色绑定加载中...</p>}
              {bindingError && <p role="alert">{bindingError}</p>}
              {bindingRoleError && (
                <p role="alert">{bindingRoleError}；已使用角色编码标识</p>
              )}
              {bindingLoaded &&
                !bindingLoading &&
                !bindingError &&
                bindings.length === 0 && <p>暂无已生效的角色绑定</p>}
              {bindings.map(this.renderBinding)}
              {bindingDetailLoading && (
                <p role="status">角色名称及业务权限加载中...</p>
              )}
              {(bindingError ||
                bindingRoleError ||
                (!bindingDetailLoading &&
                  bindings.some(
                    (binding) =>
                      !binding.permissionsLimited &&
                      this.state.bindingPermissions[String(binding.roleId)]
                        ?.error
                  ))) && (
                <HGButtonPage
                  onClick={() => this.openBindings(bindingAdmin, bindingView)}
                >
                  重新加载
                </HGButtonPage>
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
            </>
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
          <HGTablePage {...hgTableProps({
            rowKey: (record) => record.id,
            columns: this.getColumns(),
            dataSource: data,
            loading: loading,
            pagination: {
              ...pagination,
              showSizeChanger: !keyword,
              showQuickJumper: !keyword,
            },
            onChange: this.handleTableChange,
          })} />
        </HGCardPage>
        {this.renderBindingsModal()}
      </div>
    );
  }
}

export default HGAdminListPage;
