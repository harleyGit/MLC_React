/* IAM 员工角色办理页：角色申请与独立审批队列；目标授权查询、撤销和逐项审批位于管理员列表弹窗。 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import { hgTableColumns } from "../../../../components/hg_table/hg_table_contract";
import { hgCurrentIAMUser, hgGetIAMSnapshot } from "../../../../modules/iam/hg_iam_session";
import { HGAuthButton } from "../../../../modules/iam/hg_permission";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM, { HG_APPROVAL_PAGE_SIZE, INITIAL_BINDING_FORM } from "./hg_employee_role_vm";

// /bindings/grant 业务码与 Go IAM 错误映射保持一致；只显示可操作的公开提示，不依赖 HTTP 状态。
const HG_GRANT_ERROR_TOAST = {
  404009: "当前账号尚未绑定 MFA，请先绑定验证器",
  404010: "当前账号的 MFA 尚未启用，请先完成验证",
  404011: "MFA 验证码错误或已过期，请输入当前动态码",
  404012: "MFA 验证码已使用，请等待下一组动态码",
  404013: "MFA 尝试次数过多，请稍后再试",
  404014:
    "目标不是活动管理员：请核对 ID，先在「添加管理员」中开通并启用；普通用户的非超管角色请走即时授权",
};

class HGEmployeeRolePage extends Component {
  static defaultProps = {
    /** 运维容器注入的菜单导航回调；缺省 undefined 时“查看管理员列表”不触发导航。 */
    onMenuSelect: undefined,
  };

  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgPermissionRequest = 0; // 角色权限查询序号，切换角色时忽略旧响应。
    this.hgGranting = false; // 申请提交中的同步锁，避免同一次 MFA 重复提交。
    this.hgApprovalRequest = 0; // 审批游标请求序号，避免刷新后被旧页响应覆盖。
    this.hgApprovalDeciding = false; // 裁决提交同步锁；卸载或请求结束后释放。
    this.state = {
      form: { ...INITIAL_BINDING_FORM }, // 新授权申请表单；空 userId 表示尚未指定目标。
      roles: [], // 可选角色分页；空数组表示未加载或没有角色。
      nextCursor: "", // 角色选项续页游标；空值表示无续页。
      hasMore: false, // 角色选项是否有续页。
      hgRolePermissions: [], // 当前角色已生效的业务权限；空数组表示未选或无权限。
      hgSelectedPermission: "", // 仅查看权限编码；空值表示未选，不参与授权提交。
      hgPermissionLoading: false, // 角色权限请求进行中。
      hgPermissionError: "", // 权限请求失败文案；空值表示无错误。
      granting: false, // 新授权申请提交进行中。
      grantModalVisible: false, // 授权申请弹窗显示状态；默认隐藏，关闭时清除 MFA 验证码。
      queueApprovalCode: "", // 当前审批弹窗的一次性动态码；关闭或提交立即清空。
      queueApprovalTarget: null, // 当前待裁决的 {id, approve}；null 表示审批弹窗关闭。
      approvalDeciding: false, // 裁决请求是否进行中；期间禁用其他行的操作。
      approvals: [], // 当前审批页数据；空数组表示当前页无待审批申请。
      approvalCursorByPage: { 1: 0 }, // 页码到服务端游标映射；首页固定从 0 开始。
      approvalCurrentPage: 1, // 当前审批表格页码，从 1 开始。
      approvalTotal: 0, // 供表格显示下一页的最小条数，不是服务端精确总数。
      approvalLoading: false, // 审批队列是否正在加载。
    };
  }

  /** 挂载后加载申请角色选项与独立审批队列；目标授权查询位于管理员列表。 */
  componentDidMount() {
    this.hgMounted = true;
    this.loadRoles(0);
    this.loadApprovals(1);
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
    this.hgPermissionRequest += 1;
  }

  /** 更新受控授权表单，作用域切回 global 时清空组织标识。 */
  setField = (field, value) => {
    this.setState((previous) => ({
      form: {
        ...(field === "userId" ? INITIAL_BINDING_FORM : previous.form),
        [field]: value,
        ...(field === "scopeType" && value === "global" ? { scopeId: "" } : {}),
      },
    }));
  };

  /** 关闭授权弹窗时保留未提交的业务字段，但清除一次性验证码；提交期间禁止关闭。 */
  closeGrantModal = () => {
    if (this.hgGranting) return;
    this.setState((previous) => ({
      grantModalVisible: false,
      form: { ...previous.form, mfaCode: "" },
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
    this.setState({
      hgRolePermissions: [],
      hgSelectedPermission: "",
      hgPermissionLoading: Boolean(roleId),
      hgPermissionError: "",
    });
    if (!roleId) return;
    HGEmployeeRoleVM.fetchRolePermissions(roleId)
      .then((result) => {
        if (
          !this.hgMounted ||
          request !== this.hgPermissionRequest ||
          this.state.form.roleId !== roleId
        )
          return;
        if (!Array.isArray(result?.list) || !Array.isArray(result?.selected))
          throw new Error("角色权限响应格式无效");
        const selected = new Set(result.selected); // 服务端已生效权限编码；目录中未登记的编码不展示为可选项。
        this.setState({
          hgRolePermissions: result.list.filter((item) =>
            selected.has(item.code)
          ),
        });
      })
      .catch(() => {
        if (
          this.hgMounted &&
          request === this.hgPermissionRequest &&
          this.state.form.roleId === roleId
        ) {
          this.setState({ hgPermissionError: "业务权限加载失败，请重试" });
        }
      })
      .finally(() => {
        if (
          this.hgMounted &&
          request === this.hgPermissionRequest &&
          this.state.form.roleId === roleId
        ) {
          this.setState({ hgPermissionLoading: false });
        }
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
      if (
        this.hgMounted &&
        this.state.form.userId.trim() === form.userId.trim()
      ) {
        message.success(
          `授权申请${
            approval?.approvalId ? ` #${approval.approvalId}` : ""
          }已提交，等待另一名管理员审批`
        );
        this.setState((previous) => ({
          form:
            previous.form.roleId === form.roleId &&
            previous.form.mfaCode === form.mfaCode
              ? { ...INITIAL_BINDING_FORM, userId: previous.form.userId }
              : { ...previous.form, mfaCode: "" },
        })); // 提交期间若已编辑下一份申请，不覆盖新输入，但清除旧验证码。
        this.reloadApprovals();
      }
    } catch (error) {
      if (
        this.hgMounted &&
        this.state.form.userId.trim() === form.userId.trim()
      ) {
        message.error(
          HG_GRANT_ERROR_TOAST[error?.code] || error?.message || "授权申请失败"
        );
        this.setState((previous) => ({
          form:
            previous.form.mfaCode === form.mfaCode
              ? { ...previous.form, mfaCode: "" }
              : previous.form,
        })); // 已提交的动态码不可重试，保留提交期间新输入的验证码。
      }
    } finally {
      this.hgGranting = false;
      if (this.hgMounted) this.setState({ granting: false });
    }
  };

  /** 本地仅验证申请格式；重复绑定与待审批去重须由后端权威数据校验，不能依赖一页查询。 */
  validateGrant = () => {
    const { form } = this.state; // 当前新授权表单；读取目标已授权状态交由管理员列表弹窗。
    if (!form.roleId) return { valid: false };
    if (form.scopeType !== "global" && !form.scopeId.trim()) {
      message.error("请填写组织作用域 ID");
      return { valid: false };
    }
    if (
      form.expiresAt &&
      (!Number.isFinite(new Date(form.expiresAt).getTime()) ||
        new Date(form.expiresAt) <= new Date())
    ) {
      message.error("失效时间必须晚于当前时间");
      return { valid: false };
    }
    if (!/^\d{6}$/.test(form.mfaCode)) {
      message.error("请输入 6 位 MFA 验证码");
      return { valid: false };
    }
    return { valid: true };
  };

  /** 页码映射为后端游标，服务端不提供精确 total，仅合成允许下一页的最小数量。 */
  loadApprovals = (page = 1) => {
    const cursor = this.state.approvalCursorByPage[page]; // 仅允许访问首页或已知游标的页面。
    if (cursor === undefined) return;
    const request = ++this.hgApprovalRequest;
    this.setState({ approvalLoading: true });
    HGEmployeeRoleVM.fetchApprovals(cursor)
      .then((result) => {
        if (!this.hgMounted || request !== this.hgApprovalRequest) return;
        const rows = result?.list || []; // 当前游标页的原始审批数据；不拼接旧页。
        const hasNext = Boolean(result?.hasMore && result?.nextCursor); // 缺少游标时不展示不可达的下一页。
        this.setState((previous) => ({
          approvals: rows,
          approvalCurrentPage: page,
          approvalTotal: (page - 1) * HG_APPROVAL_PAGE_SIZE + rows.length + (hasNext ? 1 : 0),
          approvalCursorByPage: hasNext
            ? { ...previous.approvalCursorByPage, [page + 1]: result.nextCursor }
            : previous.approvalCursorByPage,
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

  /** 仅切换已获得游标的页面；页容量与后端固定值保持一致。 */
  handleApprovalPageChange = ({ current }) => {
    if (this.state.approvalLoading) return;
    this.loadApprovals(current);
  };

  /** 提交新申请或完成裁决后重建游标链，避免旧页重复或漏行。 */
  reloadApprovals = () => {
    this.setState({ approvalCursorByPage: { 1: 0 } }, () => this.loadApprovals(1));
  };

  /** 普通管理员不能自审；快照仅供提前提示，超管资格仍由服务端事务内复核。 */
  openQueueApproval = (item, approve) => {
    if (this.hgApprovalDeciding) return;
    const actor = hgCurrentIAMUser(); // 当前会话账号仅用于提示；空值交由服务端鉴权。
    const roles = actor === item.applicantId ? hgGetIAMSnapshot()?.roles : null; // 当前账号的展示角色；缺失时不拦截请求。
    if (actor && actor === item.applicantId && Array.isArray(roles) && !roles.includes("super_admin")) {
      message.error("不能审批本人提交的申请，请由另一名有审批权限的管理员处理");
      return;
    }
    this.setState({ queueApprovalTarget: { id: item.id, approve }, queueApprovalCode: "" });
  };

  /** 取消审批时丢弃动态码，不发起裁决请求。 */
  closeQueueApproval = () => {
    if (this.hgApprovalDeciding) return;
    this.setState({ queueApprovalTarget: null, queueApprovalCode: "" });
  };

  /** 弹窗关闭后提交一次性 MFA；最终权限、申请人与审批人关系仍由服务端复核。 */
  decideQueueApproval = () => {
    const { queueApprovalTarget, queueApprovalCode } = this.state; // 本次裁决快照，避免异步期间读取下一次输入。
    if (!queueApprovalTarget || this.hgApprovalDeciding) return;
    if (!/^\d{6}$/.test(queueApprovalCode)) {
      message.error("请输入审批人的 6 位 MFA 验证码");
      return;
    }
    this.hgApprovalDeciding = true;
    this.setState(
      { queueApprovalTarget: null, queueApprovalCode: "", approvalDeciding: true },
      () => {
        HGEmployeeRoleVM.decideApproval(queueApprovalTarget.id, queueApprovalCode, queueApprovalTarget.approve)
          .then(() => {
            if (!this.hgMounted) return;
            message.success(queueApprovalTarget.approve ? "审批通过并已生效" : "申请已拒绝");
            this.reloadApprovals();
          })
          .catch((error) => {
            if (!this.hgMounted) return;
            if (error?.code === 100009) {
              message.error("审批冲突：请核对申请人、审批有效期、目标授权或角色版本；列表将重新加载");
              this.reloadApprovals();
              return;
            }
            message.error(error?.message || "审批失败");
          })
          .finally(() => {
            this.hgApprovalDeciding = false;
            if (this.hgMounted) this.setState({ approvalDeciding: false });
          });
      }
    );
  };

  /** 复用运维容器的菜单导航，切换到管理员列表而不拼接源码文件路径。 */
  handleOpenAdminList = () => {
    this.props.onMenuSelect?.("admin_list");
  };

  /** 授权弹窗中的管理员前置条件；跳转按钮不参与授权提交。 */
  renderAdminPrerequisite = () => (
    <div className={styles.adminPrerequisite}>
      <span className={styles.adminPrerequisiteText}>
        目标用户必须先添加为启用的管理员，才能在此分配对应角色权限；否则无法提交授权申请。未加入请先使用「添加管理员」，或到管理员列表核对状态。
      </span>
      <HGButtonPage
        type="link"
        onClick={this.handleOpenAdminList}
        disabled={this.state.granting}
      >
        查看管理员列表
      </HGButtonPage>
    </div>
  );

  /** 弹窗中的新角色申请表单；目标用户从表单输入，已生效授权由管理员列表查看。 */
  renderGrantForm = () => {
    const {
      form,
      roles,
      nextCursor,
      hasMore,
      hgRolePermissions,
      hgSelectedPermission,
      hgPermissionLoading,
      hgPermissionError,
    } = this.state;
    return (
      <div>
        {this.renderAdminPrerequisite()}
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>目标管理员用户 ID</span>
            <HGInputPage
              id="hg-iam-user-id"
              value={form.userId}
              onChange={(event) => this.setField("userId", event.target.value)}
              placeholder="请输入 admin_user.user_id"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>授予角色</span>
            <select
              id="hg-iam-role-id"
              value={form.roleId}
              onChange={(event) => this.setField("roleId", event.target.value)}
              className={styles.control}
            >
              <option value="">请选择角色</option>
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
              onChange={(event) =>
                this.setState({ hgSelectedPermission: event.target.value })
              }
              className={styles.control}
              disabled={
                !form.roleId ||
                hgPermissionLoading ||
                Boolean(hgPermissionError) ||
                hgRolePermissions.length === 0
              }
            >
              <option value="">
                {!form.roleId
                  ? "请先选择角色"
                  : hgPermissionLoading
                  ? "业务权限加载中"
                  : hgPermissionError ||
                    (hgRolePermissions.length
                      ? "查看该角色的业务权限"
                      : "该角色暂无业务权限")}
              </option>
              {hgRolePermissions.map((permission) => (
                <option key={permission.code} value={permission.code}>
                  {permission.description || permission.code}（{permission.code}
                  ）
                </option>
              ))}
            </select>
            {hgPermissionError && (
              <span role="alert" className={styles.errorText}>
                {hgPermissionError}{" "}
                <HGButtonPage
                  type="link"
                  onClick={() => this.loadRolePermissions(form.roleId)}
                >
                  重试
                </HGButtonPage>
              </span>
            )}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>作用域</span>
            <select
              id="hg-iam-scope-type"
              value={form.scopeType}
              onChange={(event) =>
                this.setField("scopeType", event.target.value)
              }
              className={styles.control}
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
                onChange={(event) =>
                  this.setField("scopeId", event.target.value)
                }
                placeholder="已登记的店铺/组织 ID"
              />
            </label>
          )}
          <label className={styles.field}>
            <span className={styles.label}>失效时间（可选）</span>
            <input
              id="hg-iam-expires-at"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) =>
                this.setField("expiresAt", event.target.value)
              }
              className={styles.control}
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
            />
          </label>
        </div>
        <div className={styles.submitRow}>
          <HGAuthButton
            permission={HG_PERMISSIONS.IAM_GRANT}
            onClick={this.grantRole}
            disabled={this.state.granting}
          >
            提交授权申请
          </HGAuthButton>
        </div>
      </div>
    );
  };

  /** 授权与角色权限变更共享列表，按协议字段分别展开为可读列。 */
  renderApprovals = () => {
    const columns = hgTableColumns([
      { title: "申请单", dataIndex: "id", width: 120 },
      { title: "申请人", dataIndex: "applicantId", width: 160 },
      { title: "操作", dataIndex: "action", width: 180 },
      {
        title: "目标管理员 ID",
        key: "targetUserId",
        dataIndex: "payload",
        width: 180,
        render: (payload) => payload?.userId || "—",
      },
      {
        title: "角色 ID",
        key: "targetRoleId",
        dataIndex: "payload",
        width: 120,
        render: (payload) => payload?.roleId ?? "—",
      },
      {
        title: "作用域",
        key: "targetScopeType",
        dataIndex: "payload",
        width: 120,
        render: (payload) => payload?.scopeType || "—",
      },
      {
        title: "作用域 ID",
        key: "targetScopeId",
        dataIndex: "payload",
        width: 160,
        render: (payload) => payload?.scopeId || "—",
      },
      {
        title: "授权到期",
        key: "grantExpiresAt",
        dataIndex: "payload",
        width: 180,
        render: (payload) => payload?.expiresAt ? new Date(payload.expiresAt).toLocaleString() : "—",
      },
      {
        title: "权限编码",
        key: "rolePermissions",
        dataIndex: "payload",
        minWidth: 240,
        render: (payload) => Array.isArray(payload?.permissions)
          ? <span className={styles.approvalPermissions}>{payload.permissions.join("、") || "清空权限"}</span>
          : "—",
      },
      {
        title: "角色版本",
        key: "roleVersion",
        dataIndex: "payload",
        width: 120,
        render: (payload) => payload?.version ?? "—",
      },
      {
        title: "审批截止",
        dataIndex: "expiresAt",
        width: 180,
        render: (expiresAt) => new Date(expiresAt).toLocaleString(),
      },
      {
        title: "裁决",
        key: "decision",
        width: 180,
        render: (_, item) => (
          <div className={styles.approvalActions}>
            <HGAuthButton
              allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
              disabled={this.state.approvalDeciding}
              onClick={() => this.openQueueApproval(item, true)}
            >
              批准
            </HGAuthButton>
            <HGAuthButton
              allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
              danger
              disabled={this.state.approvalDeciding}
              onClick={() => this.openQueueApproval(item, false)}
            >
              拒绝
            </HGAuthButton>
          </div>
        ),
      },
    ]);
    return (
      <div className={styles.formItem}>
        <h3>角色权限改变后待审批授权</h3>
        <HGTablePage
          rowKey="id"
          columns={columns}
          dataSource={this.state.approvals}
          loading={this.state.approvalLoading}
          fillHeight={false}
          align="left"
          pagination={{
            current: this.state.approvalCurrentPage,
            pageSize: HG_APPROVAL_PAGE_SIZE,
            total: this.state.approvalTotal,
          }}
          onChange={this.handleApprovalPageChange}
        />
        <p className={styles.approvalPaginationHint}>审批接口未提供总数；分页器中的条数仅用于提示是否可以翻到下一页。</p>
      </div>
    );
  };

  /** 只在选中一条申请后显示 MFA 输入；取消或确认均不保留动态码。 */
  renderApprovalModal = () => {
    const { queueApprovalTarget, queueApprovalCode } = this.state;
    if (!queueApprovalTarget) return null;
    return (
      <HGModalPage
        visible
        title={`${queueApprovalTarget.approve ? "批准" : "拒绝"}申请单 #${queueApprovalTarget.id}`}
        onClose={this.closeQueueApproval}
        footer={null}
      >
        <form onSubmit={(event) => { event.preventDefault(); this.decideQueueApproval(); }}>
          <label className={styles.field}>
            <span className={styles.label}>审批人 MFA 验证码</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={queueApprovalCode}
              onChange={(event) => this.setState({ queueApprovalCode: event.target.value })}
              placeholder="请输入 6 位动态码"
              className={styles.control}
            />
          </label>
          <div className={styles.submitRow}>
            <HGButtonPage onClick={this.closeQueueApproval}>取消</HGButtonPage>
            <HGAuthButton
              allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
              danger={!queueApprovalTarget.approve}
              type="submit"
            >
              确认{queueApprovalTarget.approve ? "批准" : "拒绝"}
            </HGAuthButton>
          </div>
        </form>
      </HGModalPage>
    );
  };

  render() {
    return (
      <div className={styles.employeeRoleContainer}>
        <h2 className={styles.formTitle}>管理员工角色</h2>
        <div className={styles.grantActionRow}>
          <HGAuthButton
            permission={HG_PERMISSIONS.IAM_GRANT}
            onClick={() => this.setState({ grantModalVisible: true })}
          >
            分配管理员角色权限
          </HGAuthButton>
        </div>
        {this.renderApprovals()}
        {this.renderApprovalModal()}
        {this.state.grantModalVisible && (
          <HGModalPage
            visible
            size="large"
            title="分配管理员角色权限"
            closable={!this.state.granting}
            onClose={this.closeGrantModal}
            footer={null}
          >
            {this.renderGrantForm()}
          </HGModalPage>
        )}
      </div>
    );
  }
}

export default HGEmployeeRolePage;
