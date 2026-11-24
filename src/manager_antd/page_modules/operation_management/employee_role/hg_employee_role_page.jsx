/* IAM 员工角色管理页：授权查询、角色申请与双人授权审批；MFA 绑定已迁移至个人中心「安全中心」。 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGInputPage from "../../../../components/hg_input/hg_input_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM, { INITIAL_BINDING_FORM } from "./hg_employee_role_vm";
import { HGAuthButton } from "../../../../modules/iam/hg_permission";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";

/** 将服务端 RFC3339 失效时间转换为本地表单值；空值代表长期有效。 */
const hgBindingLocalDateTime = (expiresAt) => {
  if (!expiresAt) return "";
  const date = new Date(expiresAt); // 无效时间不回填表单。
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0"); // 两位本地日期/时间字段。
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

class HGEmployeeRolePage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgBindingRequest = 0; // 活动授权请求序号，切换用户或刷新后忽略旧响应。
    this.hgPendingRequest = 0; // 待审批查询序号，与活动授权分别管理。
    this.hgPermissionRequest = 0; // 角色权限查询序号，切换角色时忽略旧响应。
    this.hgDecidingApprovalId = ""; // 当前正在裁决的申请 ID；空值表示空闲。
    this.hgGranting = false; // 申请提交中的同步锁，避免同一次 MFA 重复提交。
    this.hgApprovalRequest = 0; // 审批游标请求序号，避免刷新后被旧页响应覆盖。
    this.state = {
      form: { ...INITIAL_BINDING_FORM }, // 授权申请与查询共用目标用户 ID；空值表示尚未指定。
      roles: [], // 可选角色分页；空数组表示未加载或没有角色。
      nextCursor: "", // 角色选项续页游标；空值表示无续页。
      hasMore: false, // 角色选项是否有续页。
      hgRolePermissions: [], // 当前角色已生效的业务权限；空数组表示未选或无权限。
      hgSelectedPermission: "", // 仅查看权限编码；空值表示未选，不参与授权提交。
      hgPermissionLoading: false, // 角色权限请求进行中。
      hgPermissionError: "", // 权限请求失败文案；空值表示无错误。
      bindings: [], // 当前用户已生效的授权绑定。
      nextBindingCursor: "", // 活动授权续页游标；空值表示无续页。
      hasMoreBindings: false, // 活动授权是否有续页。
      pendingGrants: [], // 当前用户未过期的待审批授权申请。
      nextPendingCursor: "", // 待审批申请续页游标；空值表示无续页。
      hasMorePending: false, // 待审批申请是否有续页。
      hgAssignmentsQueried: false, // 是否已主动查询目标用户；初次进入不展示无授权空态。
      loading: false, // 活动授权查询进行中。
      pendingLoading: false, // 待审批查询进行中。
      bindingError: "", // 活动授权查询失败文案。
      pendingError: "", // 待审批查询失败文案。
      approvalDecisionId: "", // 当前用户申请裁决中的编号；空值表示空闲。
      hgSelectedBindingId: "", // 当前查看的绑定 ID；空值表示新授权申请模式。
      granting: false, // 新授权申请提交进行中。
      approvalCode: "", // 指定用户申请的审批动态码；清空后不保留。
      queueApprovalCode: "", // 独立审批队列的动态码；不与指定用户审批或申请 MFA 共用。
      approvals: [], // 独立的待审批队列，空数组代表暂无数据或未加载。
      approvalNextCursor: "", // 审批队列续页游标。
      approvalHasMore: false, // 审批队列是否有续页。
      approvalLoading: false, // 双人审批队列及验证码。
    };
  }

  /** 挂载后加载角色选项与审批队列；指定用户的授权由查询按钮获取。 */
  componentDidMount() {
    this.hgMounted = true;
    this.loadRoles(0);
    this.loadApprovals(0);
  }

  /** 角色切换同步读取已生效权限，不修改角色授权范围。 */
  componentDidUpdate(_previousProps, previousState) {
    if (previousState.form.roleId !== this.state.form.roleId) {
      this.loadRolePermissions(this.state.form.roleId);
    }
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgApprovalRequest += 1;
    this.hgBindingRequest += 1;
    this.hgPendingRequest += 1;
    this.hgPermissionRequest += 1;
  }

  /** 更新受控授权表单，作用域切回 global 时清空组织标识。 */
  setField = (field, value) => {
    if (field === "userId") {
      this.hgBindingRequest += 1;
      this.hgPendingRequest += 1;
    }
    this.setState((previous) => ({
      form: {
        ...(field === "userId" ? INITIAL_BINDING_FORM : previous.form),
        [field]: value,
        ...(field === "scopeType" && value === "global" ? { scopeId: "" } : {}),
      },
      ...(field === "userId"
        ? {
            bindings: [],
            nextBindingCursor: "",
            hasMoreBindings: false,
            pendingGrants: [],
            nextPendingCursor: "",
            hasMorePending: false,
            hgAssignmentsQueried: false,
            loading: false,
            pendingLoading: false,
            bindingError: "",
            pendingError: "",
            approvalCode: "",
            approvalDecisionId: "",
            hgSelectedBindingId: "",
          }
        : {}),
    }));
  };

  /** 手动查看一条已授权绑定；只回填展示字段，不预填 MFA，也不产生新的授权意图。 */
  hgSelectBinding = (binding) => {
    this.setState((previous) => ({
      hgSelectedBindingId: String(binding.id),
      form: {
        ...previous.form,
        roleId: String(binding.roleId),
        scopeType: binding.scopeType,
        scopeId: binding.scopeId || "",
        expiresAt: hgBindingLocalDateTime(binding.expiresAt),
        mfaCode: "",
      },
    }));
  };

  /** 退出已有授权查看，清除回填及 MFA 后才允许填写新的授权申请。 */
  hgClearBindingSelection = () => {
    this.setState((previous) => ({
      hgSelectedBindingId: "",
      form: { ...INITIAL_BINDING_FORM, userId: previous.form.userId },
    }));
  };

  /** 有界游标加载角色选择项，供授权申请表单下拉使用。 */
  loadRoles = (cursor) => {
    HGEmployeeRoleVM.fetchRoles(cursor)
      .then((result) => {
        if (!this.hgMounted) return;
        this.setState((previous) => ({
          roles: cursor
            ? [...previous.roles, ...(result?.list || [])]
            : result?.list || [],
          nextCursor: result?.nextCursor || "",
          hasMore: Boolean(result?.hasMore),
        }));
      })
      .catch(() => {
        if (this.hgMounted) message.error("角色列表加载失败");
      });
  };

  /** 只展示所选角色已生效的权限；列表与 selected 均来自同一角色请求。 */
  loadRolePermissions = (roleId) => {
    const request = ++this.hgPermissionRequest; // 当前查询身份；重新选择同一角色也会使旧请求失效。
    this.setState({ hgRolePermissions: [], hgSelectedPermission: "", hgPermissionLoading: Boolean(roleId), hgPermissionError: "" });
    if (!roleId) return;
    HGEmployeeRoleVM.fetchRolePermissions(roleId)
      .then((result) => {
        if (!this.hgMounted || request !== this.hgPermissionRequest || this.state.form.roleId !== roleId) return;
        if (!Array.isArray(result?.list) || !Array.isArray(result?.selected)) throw new Error("角色权限响应格式无效");
        const selected = new Set(result.selected); // 服务端已生效权限编码；目录中未登记的编码不展示为可选项。
        this.setState({ hgRolePermissions: result.list.filter((item) => selected.has(item.code)) });
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgPermissionRequest && this.state.form.roleId === roleId) {
          this.setState({ hgPermissionError: "业务权限加载失败，请重试" });
        }
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgPermissionRequest && this.state.form.roleId === roleId) {
          this.setState({ hgPermissionLoading: false });
        }
      });
  };

  /** 同时刷新两个来源；任一路失败时另一来源仍可独立展示，绝不将空响应伪装成成功。 */
  loadAssignments = () => {
    const userId = this.state.form.userId.trim(); // 输入的精确目标管理员 ID；空值不发请求。
    if (!userId) {
      message.error("请输入管理员用户 ID");
      return;
    }
    this.setState({ hgAssignmentsQueried: true });
    this.loadBindings(0);
    this.loadPendingGrants(0);
  };

  /** 按输入的精确管理员业务 ID 加载当前活动绑定。 */
  loadBindings = (cursor = 0) => {
    const userId = this.state.form.userId.trim();
    if (!userId) {
      message.error("请输入管理员用户 ID");
      return;
    }
    const request = ++this.hgBindingRequest;
    this.setState({ loading: true, bindingError: "", ...(cursor ? {} : { bindings: [], nextBindingCursor: "", hasMoreBindings: false }) });
    HGEmployeeRoleVM.fetchBindings(userId, cursor)
      .then((result) => {
        if (
          !this.hgMounted ||
          request !== this.hgBindingRequest ||
          userId !== this.state.form.userId.trim()
        )
          return;
        this.setState((previous) => ({
          bindings: cursor
            ? [...previous.bindings, ...(result?.list || [])]
            : result?.list || [],
          nextBindingCursor: result?.nextCursor || "",
          hasMoreBindings: Boolean(result?.hasMore),
          ...(cursor || !previous.hgSelectedBindingId ? {} : {
            hgSelectedBindingId: "",
            form: { ...INITIAL_BINDING_FORM, userId: previous.form.userId },
          }),
        }));
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgBindingRequest) {
          this.setState({ bindingError: "已授权角色查询失败，请重试" });
          message.error("授权查询失败");
        }
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgBindingRequest)
          this.setState({ loading: false });
      });
  };

  /** 按目标管理员查询未过期的待审批申请；游标与活动绑定分别管理。 */
  loadPendingGrants = (cursor = 0) => {
    const userId = this.state.form.userId.trim(); // 查询当时目标 ID；完成前切换用户则忽略响应。
    if (!userId) return;
    const request = ++this.hgPendingRequest; // 每次分页/刷新递增，拒绝覆盖更新结果的旧响应。
    this.setState({ pendingLoading: true, pendingError: "", ...(cursor ? {} : { pendingGrants: [], nextPendingCursor: "", hasMorePending: false }) });
    HGEmployeeRoleVM.fetchPendingGrants(userId, cursor)
      .then((result) => {
        if (!this.hgMounted || request !== this.hgPendingRequest || userId !== this.state.form.userId.trim()) return;
        this.setState((previous) => ({
          pendingGrants: cursor ? [...previous.pendingGrants, ...(result?.list || [])] : result?.list || [],
          nextPendingCursor: result?.nextCursor || "",
          hasMorePending: Boolean(result?.hasMore),
        }));
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgPendingRequest) {
          this.setState({ pendingError: "待审批角色查询失败，请重试" });
          message.error("待审批角色查询失败");
        }
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgPendingRequest) this.setState({ pendingLoading: false });
      });
  };

  /** 仅对当前目标用户的待审批申请裁决；权限、非本人审批和 MFA 仍由服务端复核。 */
  decideApproval = async (grant, approve) => {
    const userId = this.state.form.userId.trim(); // 点击时的目标用户，防止切换用户后刷新错误列表。
    const approvalId = String(grant.approvalId); // 申请编号，不是生效绑定 ID。
    if (!userId || this.hgDecidingApprovalId || !this.state.pendingGrants.some((item) => String(item.approvalId) === approvalId)) return;
    const mfaCode = this.state.approvalCode.trim(); // 一次性审批验证码，仅提交一次，不持久化或回填。
    if (!/^\d{6}$/.test(mfaCode)) {
      message.error("请输入审批人的 6 位 MFA 验证码");
      return;
    }
    this.hgDecidingApprovalId = approvalId;
    this.setState({ approvalDecisionId: approvalId, approvalCode: "" });
    try {
      await HGEmployeeRoleVM.decideApproval(approvalId, mfaCode, approve);
      if (this.hgMounted && this.state.form.userId.trim() === userId) {
        message.success(approve ? "审批通过并已生效" : "申请已拒绝");
        this.loadAssignments();
        this.loadApprovals(0);
      }
    } catch (error) {
      if (this.hgMounted && this.state.form.userId.trim() === userId)
        message.error(error?.message || "审批失败");
    } finally {
      this.hgDecidingApprovalId = "";
      if (this.hgMounted && this.state.form.userId.trim() === userId)
        this.setState({ approvalDecisionId: "" });
    }
  };

  /** 精确撤销一条绑定；超级管理员引导授权由后端保护。 */
  revokeRole = (bindingId) => {
    const userId = this.state.form.userId.trim(); // 操作时的目标用户；切换查询目标后不刷新新用户结果。
    HGEmployeeRoleVM.revoke(userId, bindingId)
      .then(() => {
        if (this.hgMounted && this.state.form.userId.trim() === userId) {
          message.success("授权已撤销");
          this.loadAssignments();
        }
      })
      .catch((error) => {
        if (this.hgMounted && this.state.form.userId.trim() === userId) message.error(error?.message || "撤销失败");
      });
  };

  /** 独立提交授权审批申请；只提交当前目标用户的表单，不更新用户资料。 */
  grantRole = async () => {
    if (this.hgGranting) return;
    const form = { ...this.state.form }; // 点击时的申请快照，异步期间切换用户不影响提交对象。
    if (!form.userId.trim()) {
      message.error("请输入管理员用户 ID");
      return;
    }
    if (!form.roleId) {
      message.error("请选择授予角色");
      return;
    }
    if (!this.validateGrant().valid) return;
    this.hgGranting = true;
    this.setState({ granting: true });
    try {
      const approval = await HGEmployeeRoleVM.grant(form); // 回执仅为申请编号，不是绑定 ID。
      if (this.hgMounted && this.state.form.userId.trim() === form.userId.trim()) {
        message.success(`授权申请${approval?.approvalId ? ` #${approval.approvalId}` : ""}已提交，等待另一名管理员审批`);
        this.setState((previous) => ({
          form: previous.form.roleId === form.roleId && previous.form.mfaCode === form.mfaCode
            ? { ...INITIAL_BINDING_FORM, userId: previous.form.userId }
            : { ...previous.form, mfaCode: "" },
        })); // 提交期间若已编辑下一份申请，不覆盖新输入，但清除旧验证码。
        this.loadAssignments();
      }
    } catch (error) {
      if (this.hgMounted && this.state.form.userId.trim() === form.userId.trim()) message.error(error?.message || "授权申请失败");
    } finally {
      this.hgGranting = false;
      if (this.hgMounted) this.setState({ granting: false });
    }
  };

  /** 校验新授权的作用域、重复申请、时间与申请人 MFA；服务端仍做最终鉴权。 */
  validateGrant = () => {
    const { form, hgSelectedBindingId, bindings, pendingGrants } = this.state;
    if (hgSelectedBindingId || !form.roleId) return { valid: false };
    if (bindings.some((binding) =>
      String(binding.roleId) === form.roleId && binding.scopeType === form.scopeType &&
      (binding.scopeId || "") === (form.scopeId || "")
    )) {
      message.error("该角色在当前作用域已授权，请勿重复申请");
      return { valid: false };
    }
    if (pendingGrants.some((grant) =>
      String(grant.roleId) === form.roleId && grant.scopeType === form.scopeType &&
      (grant.scopeId || "") === (form.scopeId || "")
    )) {
      message.error("该角色在当前作用域已有待审批申请");
      return { valid: false };
    }
    if (form.scopeType !== "global" && !form.scopeId.trim()) {
      message.error("请填写组织作用域 ID");
      return { valid: false };
    }
    if (form.expiresAt && (!Number.isFinite(new Date(form.expiresAt).getTime()) || new Date(form.expiresAt) <= new Date())) {
      message.error("失效时间必须晚于当前时间");
      return { valid: false };
    }
    if (!/^\d{6}$/.test(form.mfaCode)) {
      message.error("请输入 6 位 MFA 验证码");
      return { valid: false };
    }
    return { valid: true };
  };

  /** 审批列表按游标分页，处理后只刷新首页避免旧状态残留。 */
  loadApprovals = (cursor = 0) => {
    const request = ++this.hgApprovalRequest;
    this.setState({ approvalLoading: true });
    HGEmployeeRoleVM.fetchApprovals(cursor)
      .then((result) => {
        if (!this.hgMounted || request !== this.hgApprovalRequest) return;
        this.setState((previous) => ({
          approvals: cursor
            ? [...previous.approvals, ...(result?.list || [])]
            : result?.list || [],
          approvalNextCursor: result?.nextCursor || "",
          approvalHasMore: Boolean(result?.hasMore),
        }));
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgApprovalRequest)
          message.error("待审批列表加载失败");
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgApprovalRequest)
          this.setState({ approvalLoading: false });
      });
  };

  /** 服务端复核申请人与审批人不同、权限和 MFA，裁决结果不可由页面自行生效。 */
  decideQueueApproval = (id, approve) => {
    if (!/^\d{6}$/.test(this.state.queueApprovalCode)) {
      message.error("请输入审批人的 6 位 MFA 验证码");
      return;
    }
    HGEmployeeRoleVM.decideApproval(id, this.state.queueApprovalCode, approve)
      .then(() => {
        if (!this.hgMounted) return;
        this.setState({ queueApprovalCode: "" });
        message.success(approve ? "审批通过并已生效" : "申请已拒绝");
        this.loadApprovals(0);
        if (this.state.form.userId.trim()) this.loadAssignments();
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "审批失败");
      });
  };

  /** 按手工输入的管理员 ID 查询活动授权与待审批申请，展示独立授权表单。 */
  renderUserLookup = () => (
    <HGCardPage title="角色授权（已授权与待审批）" className={styles.card}>
      <div className={styles.inlineRow}>
        <HGInputPage
          id="hg-iam-user-id"
          value={this.state.form.userId}
          onChange={(event) => this.setField("userId", event.target.value)}
          placeholder="请输入 admin_user.user_id"
          className={styles.inlineInput}
        />
        <HGButtonPage
          onClick={this.loadAssignments}
          loading={this.state.loading || this.state.pendingLoading}
        >
          查询角色授权
        </HGButtonPage>
      </div>
      {this.renderBindings()}
    </HGCardPage>
  );

  /** 同表展示生效绑定与待审批申请；申请仅能通过服务端双人审批裁决，不能当作绑定撤销。 */
  renderBindings = () => {
    const { bindings, pendingGrants, roles } = this.state;
    const roleNames = new Map(roles.map((role) => [String(role.id), role.name || role.code])); // 待审批项使用当前已加载角色名，未加载时用角色 ID，不额外发 N+1 请求。
    const rows = [
      ...bindings.map((binding) => ({ ...binding, hgRecordType: "binding", hgRowKey: `binding-${binding.id}` })),
      ...pendingGrants.map((grant) => ({ ...grant, hgRecordType: "pending", hgRowKey: `approval-${grant.approvalId}` })),
    ]; // 仅在渲染时合并两种记录；不把申请编号写入绑定 ID，也不存储冗余列表状态。
    const columns = [
      { title: "角色", dataIndex: "roleId", width: 180, align: "left", render: (_, record) => record.hgRecordType === "binding" ? record.roleCode : roleNames.get(String(record.roleId)) || `角色 #${record.roleId}` },
      { title: "作用域", dataIndex: "scopeType", width: 180, align: "left", render: (value, record) => `${value}${record.scopeId ? ` / ${record.scopeId}` : ""}` },
      { title: "失效时间", dataIndex: "expiresAt", width: 190, align: "left", render: (value, record) => value ? new Date(value).toLocaleString() : record.hgRecordType === "pending" ? "长期（审批后）" : "长期" },
      { title: "状态", dataIndex: "hgRecordType", width: 100, align: "left", render: (value) => <span className={value === "pending" ? styles.pendingStatus : styles.activeStatus}>{value === "pending" ? "待审批" : "已授权"}</span> },
      { title: "操作", dataIndex: "hgRowKey", width: 260, align: "left", render: (_, record) => record.hgRecordType === "pending" ? (
        <div className={styles.rowActions}>
          <span>申请 #{record.approvalId}</span>
          <HGAuthButton appearance="link" allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]} onClick={() => this.decideApproval(record, true)} disabled={Boolean(this.state.approvalDecisionId)}>允许</HGAuthButton>
          <HGAuthButton appearance="link" danger allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]} onClick={() => this.decideApproval(record, false)} disabled={Boolean(this.state.approvalDecisionId)}>拒绝</HGAuthButton>
        </div>
      ) : (
        <div className={styles.rowActions}>
          <HGButtonPage type="link" onClick={() => this.hgSelectBinding(record)}>查看回填</HGButtonPage>
          <HGAuthButton appearance="link" danger permission={HG_PERMISSIONS.IAM_GRANT} onClick={() => this.revokeRole(record.id)} disabled={record.roleCode === "super_admin"}>撤销</HGAuthButton>
        </div>
      ) },
    ]; // HGTablePage 通过 columns[].render(value, record) 分别展示两种操作，禁用内置全量分页以保留后端独立游标。
    return <div className={styles.bindingsWrap}>
      <HGTablePage rowKey="hgRowKey" columns={columns} dataSource={rows} loading={this.state.loading || this.state.pendingLoading} pagination={false} autoRowHeight />
      {pendingGrants.length > 0 && (
        <label className={styles.approvalField} htmlFor="hg-iam-approval-otp">
          <span className={styles.label}>审批人 MFA 验证码（申请人不可自批）</span>
          <input
            id="hg-iam-approval-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={this.state.approvalCode}
            onChange={(event) => this.setState({ approvalCode: event.target.value })}
            placeholder="由另一名有审批权限的管理员输入 6 位动态码"
            className={styles.control}
          />
        </label>
      )}
      {this.state.hasMoreBindings && (
        <HGButtonPage
          onClick={() => this.loadBindings(this.state.nextBindingCursor)}
          disabled={this.state.loading}
        >
          加载更多授权
        </HGButtonPage>
      )}
      {this.state.hasMorePending && (
        <HGButtonPage onClick={() => this.loadPendingGrants(this.state.nextPendingCursor)} disabled={this.state.pendingLoading}>
          加载更多待审批
        </HGButtonPage>
      )}
      {this.state.bindingError && <p role="alert" className={styles.errorText}>{this.state.bindingError}</p>}
      {this.state.pendingError && <p role="alert" className={styles.errorText}>{this.state.pendingError}</p>}
      {!this.state.loading && !this.state.pendingLoading && !this.state.bindingError && !this.state.pendingError && bindings.length === 0 && pendingGrants.length === 0 && (
        <p className={styles.emptyText}>{this.state.hgAssignmentsQueried ? "暂无已授权或待审批角色" : "请输入管理员用户 ID 并查询角色授权"}</p>
      )}
    </div>
  };

  /** 渲染授权申请表单：权限仅供查看，实际申请仍按角色、作用域与 MFA 提交。 */
  renderGrantForm = () => {
    const { form, roles, nextCursor, hasMore, bindings, hgSelectedBindingId, hgRolePermissions, hgSelectedPermission, hgPermissionLoading, hgPermissionError } = this.state;
    const selectedBinding = bindings.find((binding) => String(binding.id) === hgSelectedBindingId); // 当前查看的活动授权；未选中为 undefined。
    const selectedRoleInOptions = roles.some((role) => String(role.id) === form.roleId); // 已授权角色不在当前角色页时补只读选项。
    return (
      <HGCardPage title="授予新角色" className={styles.card}>
        {hgSelectedBindingId && (
          <div className={styles.selectionNotice}>
            <span>当前仅查看已有授权；退出查看后才可申请新授权。</span>
            <HGButtonPage onClick={this.hgClearBindingSelection}>退出查看，申请新授权</HGButtonPage>
          </div>
        )}
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>授予角色</span>
            <select
              id="hg-iam-role-id"
              value={form.roleId}
              onChange={(event) => this.setField("roleId", event.target.value)}
              className={styles.control}
              disabled={Boolean(hgSelectedBindingId)}
            >
              <option value="">请选择角色</option>
              {selectedBinding && !selectedRoleInOptions && (
                <option value={form.roleId}>{selectedBinding.roleCode}（已授权角色）</option>
              )}
              {roles.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.name}（{role.code}）
                </option>
              ))}
            </select>
          </label>
          {hasMore && (
            <HGButtonPage onClick={() => this.loadRoles(nextCursor)}>
              加载更多角色
            </HGButtonPage>
          )}
          <label className={styles.field}>
            <span className={styles.label}>业务权限（随角色授予，仅查看）</span>
            <select
              id="hg-iam-role-permission"
              value={hgSelectedPermission}
              onChange={(event) => this.setState({ hgSelectedPermission: event.target.value })}
              className={styles.control}
              disabled={!form.roleId || hgPermissionLoading || Boolean(hgPermissionError) || hgRolePermissions.length === 0}
            >
              <option value="">{!form.roleId ? "请先选择角色" : hgPermissionLoading ? "业务权限加载中" : hgPermissionError || (hgRolePermissions.length ? "查看该角色的业务权限" : "该角色暂无业务权限")}</option>
              {hgRolePermissions.map((permission) => (
                <option key={permission.code} value={permission.code}>
                  {permission.description || permission.code}（{permission.code}）
                </option>
              ))}
            </select>
            {hgPermissionError && (
              <span role="alert" className={styles.errorText}>
                {hgPermissionError} <HGButtonPage type="link" onClick={() => this.loadRolePermissions(form.roleId)}>重试</HGButtonPage>
              </span>
            )}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>作用域</span>
            <select
              id="hg-iam-scope-type"
              value={form.scopeType}
              onChange={(event) => this.setField("scopeType", event.target.value)}
              className={styles.control}
              disabled={Boolean(hgSelectedBindingId)}
            >
              <option value="global">全局</option>
              <option value="shop">店铺</option>
              <option value="org">组织</option>
            </select>
          </label>
          {form.scopeType !== "global" && (
            <label className={styles.field}>
              <span className={styles.label}>组织 / 店铺 ID</span>
              <HGInputPage
                value={form.scopeId}
                onChange={(event) => this.setField("scopeId", event.target.value)}
                placeholder="已登记的店铺/组织 ID"
                disabled={Boolean(hgSelectedBindingId)}
              />
            </label>
          )}
          <label className={styles.field}>
            <span className={styles.label}>失效时间（可选）</span>
            <input
              id="hg-iam-expires-at"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => this.setField("expiresAt", event.target.value)}
              className={styles.control}
              disabled={Boolean(hgSelectedBindingId)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>申请人 MFA 验证码</span>
            <input
              id="hg-iam-grant-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={form.mfaCode}
              onChange={(event) => this.setField("mfaCode", event.target.value)}
              placeholder="授予角色时必填，6 位动态码"
              className={styles.control}
              disabled={Boolean(hgSelectedBindingId)}
            />
          </label>
        </div>
        <div className={styles.submitRow}>
          <HGAuthButton permission={HG_PERMISSIONS.IAM_GRANT} onClick={this.grantRole} disabled={this.state.granting || Boolean(hgSelectedBindingId)}>
            提交授权申请
          </HGAuthButton>
        </div>
      </HGCardPage>
    );
  };

  renderApprovals = () => (
    <div className={styles.formItem}>
      <h3>待审批授权</h3>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={this.state.queueApprovalCode}
        onChange={(event) =>
          this.setState({ queueApprovalCode: event.target.value })
        }
        placeholder="审批人 MFA 验证码"
        className={styles.inputField}
      />
      <HGButtonPage
        onClick={() => this.loadApprovals(0)}
        loading={this.state.approvalLoading}
      >
        刷新待审批
      </HGButtonPage>
      <table>
        <thead>
          <tr>
            <th>申请单</th>
            <th>申请人</th>
            <th>操作</th>
            <th>变更内容</th>
            <th>失效时间</th>
            <th>裁决</th>
          </tr>
        </thead>
        <tbody>
          {this.state.approvals.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.applicantId}</td>
              <td>{item.action}</td>
              <td>
                <code>{JSON.stringify(item.payload)}</code>
              </td>
              <td>{new Date(item.expiresAt).toLocaleString()}</td>
              <td>
                <HGAuthButton allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
                   onClick={() => this.decideQueueApproval(item.id, true)}
                >
                  批准
                </HGAuthButton>
                <HGAuthButton allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]} danger
                   onClick={() => this.decideQueueApproval(item.id, false)}
                >
                  拒绝
                </HGAuthButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {this.state.approvalHasMore && (
        <HGButtonPage
          onClick={() => this.loadApprovals(this.state.approvalNextCursor)}
        >
          加载更多
        </HGButtonPage>
      )}
      {this.state.approvals.length === 0 && <p>暂无待审批申请</p>}
    </div>
  );

  render() {
    return (
      <div className={styles.employeeRoleContainer}>
        <h2 className={styles.formTitle}>管理员工角色</h2>
        {this.renderUserLookup()}
        {this.renderGrantForm()}
        {this.renderApprovals()}
      </div>
    );
  }
}

export default HGEmployeeRolePage;
