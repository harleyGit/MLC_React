/* IAM 员工角色管理页：查询、授予及精确撤销作用域绑定。 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM, { INITIAL_BINDING_FORM } from "./hg_employee_role_vm";

class HGEmployeeRolePage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgBindingRequest = 0; // 员工授权查询序号，避免旧用户请求覆盖新用户结果。
    this.hgApprovalRequest = 0; // 审批游标请求序号，避免刷新后被旧页响应覆盖。
    this.state = {
      form: { ...INITIAL_BINDING_FORM }, // 当前授权申请表单。
      roles: [], nextCursor: "", hasMore: false, // 有界角色选择页及游标。
      bindings: [], nextBindingCursor: "", hasMoreBindings: false, // 当前员工绑定页。
      loading: false, submitting: false, // 查询和提交状态。
      mfaPassword: "", mfaSecret: "", mfaURI: "", mfaConfirmCode: "", // 首次 TOTP 绑定数据；密钥仅在页面内短暂展示。
      approvalCode: "", approvals: [], approvalNextCursor: "", approvalHasMore: false, approvalLoading: false, // 双人审批队列及验证码。
    };
  }

  /** 首次只加载一页角色，后续由用户主动加载更多。 */
  componentDidMount() { this.hgMounted = true; this.loadRoles(0); this.loadApprovals(0); }

  componentWillUnmount() { this.hgMounted = false; this.hgBindingRequest += 1; this.hgApprovalRequest += 1; }

  loadRoles = (cursor) => {
    HGEmployeeRoleVM.fetchRoles(cursor).then((result) => { if (!this.hgMounted) return; this.setState((previous) => ({
      roles: cursor ? [...previous.roles, ...(result?.list || [])] : (result?.list || []),
      nextCursor: result?.nextCursor || "", hasMore: Boolean(result?.hasMore),
    })); }).catch(() => { if (this.hgMounted) message.error("角色列表加载失败"); });
  };

  /** 更新受控表单，作用域切回 global 时清空组织标识。 */
  setField = (field, value) => { if (field === "userId") this.hgBindingRequest += 1; this.setState((previous) => ({
    form: { ...previous.form, [field]: value, ...(field === "scopeType" && value === "global" ? { scopeId: "" } : {}) },
    ...(field === "userId" ? { bindings: [], nextBindingCursor: "", hasMoreBindings: false, loading: false } : {}),
  })); };

  /** 按输入的精确管理员业务 ID 加载当前活动绑定。 */
  loadBindings = (cursor = 0) => {
    const userId = this.state.form.userId.trim();
    if (!userId) { message.error("请输入管理员用户 ID"); return; }
    const request = ++this.hgBindingRequest;
    this.setState({ loading: true });
    HGEmployeeRoleVM.fetchBindings(userId, cursor).then((result) => { if (!this.hgMounted || request !== this.hgBindingRequest || userId !== this.state.form.userId.trim()) return; this.setState((previous) => ({
      bindings: cursor ? [...previous.bindings, ...(result?.list || [])] : (result?.list || []),
      nextBindingCursor: result?.nextCursor || "",
      hasMoreBindings: Boolean(result?.hasMore),
    })); })
      .catch(() => { if (this.hgMounted && request === this.hgBindingRequest) message.error("授权查询失败"); })
      .finally(() => { if (this.hgMounted && request === this.hgBindingRequest) this.setState({ loading: false }); });
  };

  /** 授予一个精确作用域绑定；重复授权由服务端唯一键拒绝。 */
  grantRole = () => {
    const { form } = this.state;
    if (!form.userId.trim() || !form.roleId || (form.scopeType !== "global" && !form.scopeId.trim())) {
      message.error("请填写管理员、角色和作用域"); return;
    }
    if (form.expiresAt && new Date(form.expiresAt) <= new Date()) { message.error("失效时间必须晚于当前时间"); return; }
    if (!/^\d{6}$/.test(form.mfaCode)) { message.error("请输入 6 位 MFA 验证码"); return; }
    this.setState({ submitting: true });
    HGEmployeeRoleVM.grant(form).then((result) => { if (!this.hgMounted) return; message.success(`授权申请已提交，审批单 ${result?.approvalId || ""}`); this.setField("mfaCode", ""); this.loadApprovals(0); })
      .catch((error) => { if (this.hgMounted) message.error(error?.message || "授权失败"); })
      .finally(() => { if (this.hgMounted) this.setState({ submitting: false }); });
  };

  /** 密码复核通过后显示一次性 TOTP 绑定密钥；响应和页面均不持久化密钥。 */
  enrollMFA = () => {
    if (!this.state.mfaPassword) { message.error("请输入当前登录密码"); return; }
    HGEmployeeRoleVM.enrollMFA(this.state.mfaPassword)
      .then((result) => { if (this.hgMounted) this.setState({ mfaSecret: result?.secret || "", mfaURI: result?.otpauthUri || "", mfaPassword: "" }); })
      .catch((error) => { if (this.hgMounted) message.error(error?.message || "MFA 绑定失败"); });
  };

  /** 激活后立即清除页面中的明文密钥与验证码。 */
  confirmMFA = () => {
    if (!/^\d{6}$/.test(this.state.mfaConfirmCode)) { message.error("请输入 6 位验证码"); return; }
    HGEmployeeRoleVM.confirmMFA(this.state.mfaConfirmCode)
      .then(() => { if (this.hgMounted) { this.setState({ mfaSecret: "", mfaURI: "", mfaConfirmCode: "" }); message.success("MFA 已启用"); } })
      .catch((error) => { if (this.hgMounted) message.error(error?.message || "MFA 验证失败"); });
  };

  /** 审批列表按游标分页，处理后只刷新首页避免旧状态残留。 */
  loadApprovals = (cursor = 0) => {
    const request = ++this.hgApprovalRequest;
    this.setState({ approvalLoading: true });
    HGEmployeeRoleVM.fetchApprovals(cursor).then((result) => { if (!this.hgMounted || request !== this.hgApprovalRequest) return; this.setState((previous) => ({
      approvals: cursor ? [...previous.approvals, ...(result?.list || [])] : (result?.list || []),
      approvalNextCursor: result?.nextCursor || "", approvalHasMore: Boolean(result?.hasMore),
    })); }).catch(() => { if (this.hgMounted && request === this.hgApprovalRequest) message.error("待审批列表加载失败"); })
      .finally(() => { if (this.hgMounted && request === this.hgApprovalRequest) this.setState({ approvalLoading: false }); });
  };

  /** 服务端复核申请人与审批人不同、权限和 MFA，裁决结果不可由页面自行生效。 */
  decideApproval = (id, approve) => {
    if (!/^\d{6}$/.test(this.state.approvalCode)) { message.error("请输入审批人的 6 位 MFA 验证码"); return; }
    HGEmployeeRoleVM.decideApproval(id, this.state.approvalCode, approve)
      .then(() => { if (!this.hgMounted) return; this.setState({ approvalCode: "" }); message.success(approve ? "审批通过并已生效" : "申请已拒绝"); this.loadApprovals(0); if (this.state.form.userId.trim()) this.loadBindings(0); })
      .catch((error) => { if (this.hgMounted) message.error(error?.message || "审批失败"); });
  };

  /** 精确撤销一条绑定；超级管理员引导授权由后端保护。 */
  revokeRole = (bindingId) => {
    HGEmployeeRoleVM.revoke(this.state.form.userId, bindingId)
      .then(() => { message.success("授权已撤销"); this.loadBindings(); })
      .catch((error) => message.error(error?.message || "撤销失败"));
  };

  renderUserLookup = () => <div className={styles.formItem}>
    <label htmlFor="hg-iam-user-id">管理员用户 ID</label>
    <HGInputPage id="hg-iam-user-id" value={this.state.form.userId} onChange={(event) => this.setField("userId", event.target.value)} placeholder="请输入 admin_user.user_id" className={styles.inputField} />
    <HGButtonPage onClick={() => this.loadBindings(0)} loading={this.state.loading}>查询已授权角色</HGButtonPage>
  </div>;

  renderGrantForm = () => {
    const { form, roles, nextCursor, hasMore, submitting } = this.state;
    return <div className={styles.formItem}>
      <label htmlFor="hg-iam-role-id">授予角色</label>
      <select id="hg-iam-role-id" value={form.roleId} onChange={(event) => this.setField("roleId", event.target.value)} className={styles.inputField}>
        <option value="">请选择角色</option>
        {roles.map((role) => <option key={role.id} value={String(role.id)}>{role.name}（{role.code}）</option>)}
      </select>
      {hasMore && <HGButtonPage onClick={() => this.loadRoles(nextCursor)}>加载更多角色</HGButtonPage>}
      <label htmlFor="hg-iam-scope-type">作用域</label>
      <select id="hg-iam-scope-type" value={form.scopeType} onChange={(event) => this.setField("scopeType", event.target.value)} className={styles.inputField}>
        <option value="global">全局</option><option value="shop">店铺</option><option value="org">组织</option>
      </select>
      {form.scopeType !== "global" && <HGInputPage value={form.scopeId} onChange={(event) => this.setField("scopeId", event.target.value)} placeholder="已登记的店铺/组织 ID" className={styles.inputField} />}
      <label htmlFor="hg-iam-expires-at">失效时间（可选）</label>
      <input id="hg-iam-expires-at" type="datetime-local" value={form.expiresAt} onChange={(event) => this.setField("expiresAt", event.target.value)} className={styles.inputField} />
      <label htmlFor="hg-iam-grant-otp">申请人 MFA 验证码</label>
      <input id="hg-iam-grant-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.mfaCode} onChange={(event) => this.setField("mfaCode", event.target.value)} className={styles.inputField} />
      <HGButtonPage type="primary" onClick={this.grantRole} loading={submitting}>提交授权审批</HGButtonPage>
    </div>;
  };

  renderBindings = () => <div className={styles.formItem}>
    <h3>当前活动授权</h3>
    <table><thead><tr><th>角色</th><th>作用域</th><th>失效时间</th><th>操作</th></tr></thead>
      <tbody>{this.state.bindings.map((binding) => <tr key={binding.id}>
        <td>{binding.roleCode}</td><td>{binding.scopeType}{binding.scopeId ? ` / ${binding.scopeId}` : ""}</td>
        <td>{binding.expiresAt ? new Date(binding.expiresAt).toLocaleString() : "长期"}</td>
        <td><HGButtonPage onClick={() => this.revokeRole(binding.id)} disabled={binding.roleCode === "super_admin"}>撤销</HGButtonPage></td>
      </tr>)}</tbody></table>
    {this.state.hasMoreBindings && <HGButtonPage onClick={() => this.loadBindings(this.state.nextBindingCursor)}>加载更多授权</HGButtonPage>}
    {this.state.bindings.length === 0 && <p>暂无活动授权</p>}
  </div>;

  renderMFA = () => <div className={styles.formItem}>
    <h3>绑定管理员 MFA</h3>
    <p>首次绑定请确认当前密码，再将一次性密钥添加到支持 TOTP 的验证器。</p>
    <input type="password" autoComplete="current-password" value={this.state.mfaPassword} onChange={(event) => this.setState({ mfaPassword: event.target.value })} placeholder="当前登录密码" className={styles.inputField} />
    <HGButtonPage onClick={this.enrollMFA}>生成绑定密钥</HGButtonPage>
    {this.state.mfaSecret && <p>一次性密钥：<code>{this.state.mfaSecret}</code><br />绑定 URI：<code>{this.state.mfaURI}</code></p>}
    <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={this.state.mfaConfirmCode} onChange={(event) => this.setState({ mfaConfirmCode: event.target.value })} placeholder="验证器 6 位验证码" className={styles.inputField} />
    <HGButtonPage onClick={this.confirmMFA}>确认并启用 MFA</HGButtonPage>
  </div>;

  renderApprovals = () => <div className={styles.formItem}>
    <h3>待审批授权</h3>
    <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={this.state.approvalCode} onChange={(event) => this.setState({ approvalCode: event.target.value })} placeholder="审批人 MFA 验证码" className={styles.inputField} />
    <HGButtonPage onClick={() => this.loadApprovals(0)} loading={this.state.approvalLoading}>刷新待审批</HGButtonPage>
    <table><thead><tr><th>申请单</th><th>申请人</th><th>操作</th><th>变更内容</th><th>失效时间</th><th>裁决</th></tr></thead>
      <tbody>{this.state.approvals.map((item) => <tr key={item.id}>
        <td>{item.id}</td><td>{item.applicantId}</td><td>{item.action}</td><td><code>{JSON.stringify(item.payload)}</code></td>
        <td>{new Date(item.expiresAt).toLocaleString()}</td><td><HGButtonPage onClick={() => this.decideApproval(item.id, true)}>批准</HGButtonPage><HGButtonPage onClick={() => this.decideApproval(item.id, false)}>拒绝</HGButtonPage></td>
      </tr>)}</tbody></table>
    {this.state.approvalHasMore && <HGButtonPage onClick={() => this.loadApprovals(this.state.approvalNextCursor)}>加载更多</HGButtonPage>}
    {this.state.approvals.length === 0 && <p>暂无待审批申请</p>}
  </div>;

  render() { return <div className={styles.employeeRoleContainer}>
    <h2 className={styles.formTitle}>管理员工角色</h2>
    {this.renderMFA()}{this.renderUserLookup()}{this.renderGrantForm()}{this.renderBindings()}{this.renderApprovals()}
  </div>; }
}

export default HGEmployeeRolePage;
