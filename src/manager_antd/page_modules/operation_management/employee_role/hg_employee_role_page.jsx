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
    this.state = { form: { ...INITIAL_BINDING_FORM }, roles: [], nextCursor: "", hasMore: false, bindings: [], nextBindingCursor: "", hasMoreBindings: false, loading: false, submitting: false };
  }

  /** 首次只加载一页角色，后续由用户主动加载更多。 */
  componentDidMount() { this.loadRoles(0); }

  loadRoles = (cursor) => {
    HGEmployeeRoleVM.fetchRoles(cursor).then((result) => this.setState((previous) => ({
      roles: cursor ? [...previous.roles, ...(result?.list || [])] : (result?.list || []),
      nextCursor: result?.nextCursor || "", hasMore: Boolean(result?.hasMore),
    }))).catch(() => message.error("角色列表加载失败"));
  };

  /** 更新受控表单，作用域切回 global 时清空组织标识。 */
  setField = (field, value) => this.setState((previous) => ({
    form: { ...previous.form, [field]: value, ...(field === "scopeType" && value === "global" ? { scopeId: "" } : {}) },
    ...(field === "userId" ? { bindings: [], nextBindingCursor: "", hasMoreBindings: false } : {}),
  }));

  /** 按输入的精确管理员业务 ID 加载当前活动绑定。 */
  loadBindings = (cursor = 0) => {
    const userId = this.state.form.userId.trim();
    if (!userId) { message.error("请输入管理员用户 ID"); return; }
    this.setState({ loading: true });
    HGEmployeeRoleVM.fetchBindings(userId, cursor).then((result) => this.setState((previous) => ({
      bindings: cursor ? [...previous.bindings, ...(result?.list || [])] : (result?.list || []),
      nextBindingCursor: result?.nextCursor || "",
      hasMoreBindings: Boolean(result?.hasMore),
    })))
      .catch(() => message.error("授权查询失败"))
      .finally(() => this.setState({ loading: false }));
  };

  /** 授予一个精确作用域绑定；重复授权由服务端唯一键拒绝。 */
  grantRole = () => {
    const { form } = this.state;
    if (!form.userId.trim() || !form.roleId || (form.scopeType !== "global" && !form.scopeId.trim())) {
      message.error("请填写管理员、角色和作用域"); return;
    }
    if (form.expiresAt && new Date(form.expiresAt) <= new Date()) { message.error("失效时间必须晚于当前时间"); return; }
    this.setState({ submitting: true });
    HGEmployeeRoleVM.grant(form).then(() => { message.success("授权成功"); this.loadBindings(); })
      .catch((error) => message.error(error?.message || "授权失败"))
      .finally(() => this.setState({ submitting: false }));
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
      <HGButtonPage type="primary" onClick={this.grantRole} loading={submitting}>授予角色</HGButtonPage>
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

  render() { return <div className={styles.employeeRoleContainer}>
    <h2 className={styles.formTitle}>管理员工角色</h2>
    {this.renderUserLookup()}{this.renderGrantForm()}{this.renderBindings()}
  </div>; }
}

export default HGEmployeeRolePage;
