/*
 * 用户编辑与角色绑定独立页：由用户列表「编辑」按钮携带 user_id 跳转进入。
 * 职责：承接原 HGUserEditModal 的资料编辑表单，并承载自员工角色页迁入的
 * 授权查询（renderUserLookup）、授权申请（renderGrantForm）与活动绑定（renderBindings）。
 * 约束：
 * - 路由参数 userId 为授权查询的初始管理员 ID；资料回填数据来自 location.state.user。
 * - 页面只有一个主提交按钮「保存」：保存资料后，若授权表单已选角色则一并提交授权审批。
 * - 「返回」通过浏览器后退（navigate(-1)）回到来源页，配合运维页的选中态持久化停留在原子菜单。
 */
import React, { Component } from "react";
import { handleError } from "../../../api/HttpManagerV1";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGInputPage from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../components/hg_page_header/hg_page_header_page";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import HGEmployeeRoleVM, {
  INITIAL_BINDING_FORM,
} from "../operation_management/employee_role/hg_employee_role_vm";
import HGUserVM from "./hg_user_vm";
import styles from "./hg_user_edit_role.module.css";

/** 性别选项：与后端 gender 编码一致（1 男 / 2 女，其余按保密处理）。 */
const HG_GENDER_OPTIONS = [
  { value: 0, label: "保密" },
  { value: 1, label: "男" },
  { value: 2, label: "女" },
];

const HG_SIGNATURE_MAX_LENGTH = 200; // 签名输入上限；后端仍会做最终校验。

class HGUserEditRolePage extends Component {
  constructor(props) {
    super(props);
    // 编辑目标用户由列表页通过 location.state 带入，用于表单回填与安全字段比对。
    const user = props.location?.state?.user || {};
    // 路由参数 userId 是授权查询（renderUserLookup）的初始管理员业务 ID。
    const initialUserId = String(props.params?.userId ?? user.user_id ?? "").trim();
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgBindingRequest = 0; // 员工授权查询序号，避免旧用户请求覆盖新用户结果。
    this.state = {
      user,
      // 资料编辑受控表单：空字符串表示用户未设置该项；仅手机号/邮箱变化时发送安全字段请求。
      profileForm: {
        nickname: user.nickname ?? user.user_name ?? "",
        gender: Number.isFinite(Number(user.gender)) ? Number(user.gender) : 0,
        signature: user.signature ?? "",
        avatar_url: user.avatar_url ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
      },
      profileErrors: {}, // 资料表单字段级错误文案。
      saving: false, // 主提交按钮加载状态。
      form: { ...INITIAL_BINDING_FORM, userId: initialUserId }, // 当前授权申请表单，userId 由路由参数带入。
      roles: [],
      nextCursor: "",
      hasMore: false, // 有界角色选择页及游标。
      bindings: [],
      nextBindingCursor: "",
      hasMoreBindings: false, // 当前员工绑定页。
      loading: false,
    };
  }

  /** 进入页面即加载角色选项；已带用户 ID 时同时拉取其活动绑定。 */
  componentDidMount() {
    this.hgMounted = true;
    this.loadRoles(0);
    if (this.state.form.userId) this.loadBindings(0);
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgBindingRequest += 1;
  }

  /** 返回来源页；配合运维页选中态持久化，后退后停留在原「用户列表」子菜单。 */
  handleBack = () => {
    if (this.props.navigate) {
      this.props.navigate(-1);
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  /** 更新受控授权表单，作用域切回 global 时清空组织标识。 */
  setField = (field, value) => {
    if (field === "userId") this.hgBindingRequest += 1;
    this.setState((previous) => ({
      form: {
        ...previous.form,
        [field]: value,
        ...(field === "scopeType" && value === "global" ? { scopeId: "" } : {}),
      },
      ...(field === "userId"
        ? {
            bindings: [],
            nextBindingCursor: "",
            hasMoreBindings: false,
            loading: false,
          }
        : {}),
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

  /** 按输入的精确管理员业务 ID 加载当前活动绑定。 */
  loadBindings = (cursor = 0) => {
    const userId = this.state.form.userId.trim();
    if (!userId) {
      message.error("请输入管理员用户 ID");
      return;
    }
    const request = ++this.hgBindingRequest;
    this.setState({ loading: true });
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
        }));
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgBindingRequest)
          message.error("授权查询失败");
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgBindingRequest)
          this.setState({ loading: false });
      });
  };

  /** 精确撤销一条绑定；超级管理员引导授权由后端保护。 */
  revokeRole = (bindingId) => {
    HGEmployeeRoleVM.revoke(this.state.form.userId, bindingId)
      .then(() => {
        message.success("授权已撤销");
        this.loadBindings();
      })
      .catch((error) => message.error(error?.message || "撤销失败"));
  };

  /**
   * 更新资料表单单个字段并清除该字段错误。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段新值。
   */
  handleProfileFieldChange = (fieldName, fieldValue) => {
    this.setState((previousState) => ({
      profileForm: {
        ...previousState.profileForm,
        [fieldName]: fieldValue,
      },
      profileErrors: {
        ...previousState.profileErrors,
        [fieldName]: "",
      },
    }));
  };

  /** 校验资料表单；昵称必填，联系方式与头像按变化量校验，返回是否通过。 */
  validateProfile = () => {
    const { profileForm, user } = this.state;
    const nickname = profileForm.nickname.trim();
    const phone = profileForm.phone.trim();
    const email = profileForm.email.trim();
    const avatarURL = profileForm.avatar_url.trim();
    const errors = {};
    if (!nickname) errors.nickname = "请输入昵称";
    if (phone !== (user?.phone ?? "") && !/^1\d{10}$/.test(phone)) {
      errors.phone = "请输入 11 位手机号";
    }
    if (email !== (user?.email ?? "") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "请输入有效的邮箱地址";
    }
    if (avatarURL && !/^https?:\/\//i.test(avatarURL) && !avatarURL.startsWith("/uploads/")) {
      errors.avatar_url = "头像 URL 需为 HTTPS/HTTP 地址或 /uploads/ 路径";
    }
    this.setState({ profileErrors: errors });
    return Object.keys(errors).length === 0;
  };

  /** 校验授权表单；仅当已选择角色时才要求完整作用域与 MFA。 */
  validateGrant = () => {
    const { form } = this.state;
    // 未选择角色视为本次不授予角色，跳过授权校验。
    if (!form.roleId) return { valid: true, skip: true };
    if (form.scopeType !== "global" && !form.scopeId.trim()) {
      message.error("请填写组织作用域 ID");
      return { valid: false };
    }
    if (form.expiresAt && new Date(form.expiresAt) <= new Date()) {
      message.error("失效时间必须晚于当前时间");
      return { valid: false };
    }
    if (!/^\d{6}$/.test(form.mfaCode)) {
      message.error("请输入 6 位 MFA 验证码");
      return { valid: false };
    }
    return { valid: true, skip: false };
  };

  /**
   * 主提交入口：页面唯一提交按钮。
   * 先保存资料；若授权表单已选角色，则继续提交授权审批。两者独立报告结果。
   */
  handleSubmit = async () => {
    const { saving, user } = this.state;
    if (saving) return;
    if (!this.validateProfile()) return;
    const grantCheck = this.validateGrant();
    if (!grantCheck.valid) return;

    this.setState({ saving: true });
    const { profileForm, form } = this.state;
    try {
      await HGUserVM.updateUserByUserId({
        userId: this.state.form.userId,
        previousPhone: user?.phone,
        previousEmail: user?.email,
        nickname: profileForm.nickname.trim(),
        gender: profileForm.gender,
        signature: profileForm.signature.trim(),
        avatar_url: profileForm.avatar_url.trim(),
        phone: profileForm.phone.trim(),
        email: profileForm.email.trim(),
      });
      if (this.hgMounted) message.success("用户资料已更新");

      if (!grantCheck.skip) {
        await HGEmployeeRoleVM.grant(form);
        if (this.hgMounted) message.success("授权申请已提交，请等待审批");
        this.setField("mfaCode", "");
      }
    } catch (error) {
      if (this.hgMounted) handleError(error);
    } finally {
      if (this.hgMounted) this.setState({ saving: false });
    }
  };

  /**
   * 渲染资料表单单行字段容器。
   * @param {string} label 字段名称。
   * @param {React.ReactNode} control 受控控件。
   * @param {string} [error] 字段错误文案。
   * @param {string} [extra] 字段补充说明。
   * @returns {React.ReactNode} 字段行 JSX。
   */
  renderProfileField = (label, control, error, extra) => (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {control}
      {error ? <span className={styles.errorText}>{error}</span> : null}
      {!error && extra ? <span className={styles.extraText}>{extra}</span> : null}
    </label>
  );

  /** 渲染资料编辑区块：公开资料与账号联系方式；联系方式变化走独立安全接口。 */
  renderProfileForm = () => {
    const { profileForm, profileErrors } = this.state;
    return (
      <HGCardPage title="基本资料" className={styles.card}>
        <div className={styles.formGrid}>
          {this.renderProfileField(
            "昵称",
            <input
              className={`${styles.control} ${profileErrors.nickname ? styles.controlError : ""}`}
              value={profileForm.nickname}
              maxLength={30}
              placeholder="请输入昵称"
              onChange={(event) => this.handleProfileFieldChange("nickname", event.target.value)}
            />,
            profileErrors.nickname
          )}
          {this.renderProfileField(
            "性别",
            <select
              className={styles.control}
              value={profileForm.gender}
              onChange={(event) => this.handleProfileFieldChange("gender", Number(event.target.value))}
            >
              {HG_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {this.renderProfileField(
            "手机号",
            <input
              className={`${styles.control} ${profileErrors.phone ? styles.controlError : ""}`}
              type="tel"
              value={profileForm.phone}
              maxLength={32}
              placeholder="请输入手机号"
              onChange={(event) => this.handleProfileFieldChange("phone", event.target.value)}
            />,
            profileErrors.phone
          )}
          {this.renderProfileField(
            "邮箱",
            <input
              className={`${styles.control} ${profileErrors.email ? styles.controlError : ""}`}
              type="email"
              value={profileForm.email}
              maxLength={255}
              placeholder="请输入邮箱"
              onChange={(event) => this.handleProfileFieldChange("email", event.target.value)}
            />,
            profileErrors.email,
            "管理员修改他人联系方式将写入审计记录"
          )}
          {this.renderProfileField(
            "头像 URL",
            <input
              className={`${styles.control} ${profileErrors.avatar_url ? styles.controlError : ""}`}
              value={profileForm.avatar_url}
              maxLength={512}
              placeholder="/uploads/user/avatar.png"
              onChange={(event) => this.handleProfileFieldChange("avatar_url", event.target.value)}
            />,
            profileErrors.avatar_url
          )}
          {this.renderProfileField(
            "个性签名",
            <textarea
              className={`${styles.control} ${styles.textarea}`}
              value={profileForm.signature}
              maxLength={HG_SIGNATURE_MAX_LENGTH}
              rows={4}
              placeholder="介绍一下自己"
              onChange={(event) => this.handleProfileFieldChange("signature", event.target.value)}
            />,
            null,
            `还可以输入 ${HG_SIGNATURE_MAX_LENGTH - profileForm.signature.length} 个字符`
          )}
        </div>
      </HGCardPage>
    );
  };

  /** 渲染授权查询区块：管理员 ID 由编辑入口带入，可手动修正后重新查询。 */
  renderUserLookup = () => (
    <HGCardPage title="已授权角色" className={styles.card}>
      <div className={styles.inlineRow}>
        <HGInputPage
          id="hg-iam-user-id"
          value={this.state.form.userId}
          onChange={(event) => this.setField("userId", event.target.value)}
          placeholder="请输入 admin_user.user_id"
          className={styles.inlineInput}
        />
        <HGButtonPage
          onClick={() => this.loadBindings(0)}
          loading={this.state.loading}
        >
          查询已授权角色
        </HGButtonPage>
      </div>
      {this.renderBindings()}
    </HGCardPage>
  );

  /** 渲染当前活动授权列表：展示绑定明细并支持精确撤销。 */
  renderBindings = () => (
    <div className={styles.bindingsWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>角色</th>
            <th>作用域</th>
            <th>失效时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {this.state.bindings.map((binding) => (
            <tr key={binding.id}>
              <td>{binding.roleCode}</td>
              <td>
                {binding.scopeType}
                {binding.scopeId ? ` / ${binding.scopeId}` : ""}
              </td>
              <td>
                {binding.expiresAt
                  ? new Date(binding.expiresAt).toLocaleString()
                  : "长期"}
              </td>
              <td>
                <HGButtonPage
                  type="link"
                  danger
                  onClick={() => this.revokeRole(binding.id)}
                  disabled={binding.roleCode === "super_admin"}
                >
                  撤销
                </HGButtonPage>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {this.state.hasMoreBindings && (
        <HGButtonPage
          onClick={() => this.loadBindings(this.state.nextBindingCursor)}
        >
          加载更多授权
        </HGButtonPage>
      )}
      {this.state.bindings.length === 0 && <p className={styles.emptyText}>暂无活动授权</p>}
    </div>
  );

  /** 渲染授权申请表单：角色、作用域、失效时间与申请人 MFA 验证码。 */
  renderGrantForm = () => {
    const { form, roles, nextCursor, hasMore } = this.state;
    return (
      <HGCardPage title="授予新角色" className={styles.card}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>授予角色</span>
            <select
              id="hg-iam-role-id"
              value={form.roleId}
              onChange={(event) => this.setField("roleId", event.target.value)}
              className={styles.control}
            >
              <option value="">不授予角色（仅保存资料）</option>
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
            <span className={styles.label}>作用域</span>
            <select
              id="hg-iam-scope-type"
              value={form.scopeType}
              onChange={(event) => this.setField("scopeType", event.target.value)}
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
                onChange={(event) => this.setField("scopeId", event.target.value)}
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
              onChange={(event) => this.setField("expiresAt", event.target.value)}
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
      </HGCardPage>
    );
  };

  render() {
    const { saving } = this.state;
    return (
      <div className={styles.pageContainer}>
        <HGPageHeaderPage
          title="编辑用户"
          description="修改用户基本资料，并可按需授予或撤销该用户的作用域角色绑定。"
          extra={
            <HGButtonPage onClick={this.handleBack}>返回</HGButtonPage>
          }
        />
        {this.renderProfileForm()}
        {this.renderGrantForm()}
        {this.renderUserLookup()}
        <div className={styles.footerBar}>
          <HGButtonPage type="primary" loading={saving} onClick={this.handleSubmit}>
            保存
          </HGButtonPage>
        </div>
      </div>
    );
  }
}

// 注入路由能力：params 提供 userId，location.state 提供编辑目标用户。
const HGUserEditRolePageWithNavigation = WithNavigation(HGUserEditRolePage);

export default HGUserEditRolePageWithNavigation;
