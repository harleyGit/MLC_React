/* IAM 员工角色办理页：角色申请与独立审批队列；目标授权查询、撤销和逐项审批位于管理员列表弹窗。 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import { HGAuthButton } from "../../../../modules/iam/hg_permission";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM, { INITIAL_BINDING_FORM } from "./hg_employee_role_vm";

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
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgPermissionRequest = 0; // 角色权限查询序号，切换角色时忽略旧响应。
    this.hgGranting = false; // 申请提交中的同步锁，避免同一次 MFA 重复提交。
    this.hgApprovalRequest = 0; // 审批游标请求序号，避免刷新后被旧页响应覆盖。
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
      queueApprovalCode: "", // 独立审批队列的动态码；不与指定用户审批或申请 MFA 共用。
      approvals: [], // 独立的待审批队列，空数组代表暂无数据或未加载。
      approvalNextCursor: "", // 审批队列续页游标。
      approvalHasMore: false, // 审批队列是否有续页。
      approvalLoading: false, // 双人审批队列及验证码。
    };
  }

  /** 挂载后加载申请角色选项与独立审批队列；目标授权查询位于管理员列表。 */
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
        this.loadApprovals(0);
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
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "审批失败");
      });
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
                <HGAuthButton
                  allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
                  onClick={() => this.decideQueueApproval(item.id, true)}
                >
                  批准
                </HGAuthButton>
                <HGAuthButton
                  allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_APPROVE]}
                  danger
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
        <div className={styles.grantActionRow}>
          <HGAuthButton
            permission={HG_PERMISSIONS.IAM_GRANT}
            onClick={() => this.setState({ grantModalVisible: true })}
          >
            分配管理员角色权限
          </HGAuthButton>
        </div>
        {this.renderApprovals()}
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
