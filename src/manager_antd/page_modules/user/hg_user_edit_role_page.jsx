/*
 * 用户编辑与角色绑定独立页：由用户列表「编辑」按钮携带 user_id 跳转进入。
 * 职责：承接原 HGUserEditModal 的资料编辑表单，并承载自员工角色页迁入的
 * 授权查询（renderUserLookup）、授权申请（renderGrantForm）与合并角色列表（renderBindings）。
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
import HGTablePage from "../../../components/hg_table/hg_table_page";
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

/** 将服务端 RFC3339 失效时间转换为浏览器本地 datetime-local 值；空值表示长期有效。 */
const hgBindingLocalDateTime = (expiresAt) => {
  if (!expiresAt) return "";
  const date = new Date(expiresAt); // 授权绑定的 UTC/RFC3339 时间；无效日期不回填表单。
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0"); // 日期及时间的本地两位字段。
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

class HGUserEditRolePage extends Component {
  constructor(props) {
    super(props);
    // 编辑目标用户由列表页通过 location.state 带入，用于表单回填与安全字段比对。
    const user = props.location?.state?.user || {};
    // 路由参数 userId 是授权查询（renderUserLookup）的初始管理员业务 ID。
    const initialUserId = String(props.params?.userId ?? user.user_id ?? "").trim();
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgBindingRequest = 0; // 员工授权查询序号，避免旧用户请求覆盖新用户结果。
    this.hgPendingRequest = 0; // 待审批查询序号；切换用户/刷新后旧响应不可覆盖新用户。
    this.hgDecidingApprovalId = ""; // 正在提交的申请编号；空字符串表示没有裁决请求，防止同一验证码并发重复提交。
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
      roles: [], // 可授予角色选项；空数组表示尚未加载或无角色。
      nextCursor: "", // 角色选项下一页游标，空字符串表示无续页。
      hasMore: false, // 角色选项是否仍有后续页。
      bindings: [], // 当前查询用户已生效的授权绑定，非待审批申请。
      nextBindingCursor: "", // 活动绑定续页游标；空字符串表示无续页。
      hasMoreBindings: false, // 活动绑定是否仍有后续页。
      pendingGrants: [], // 当前查询用户的未过期待审批授权；不会提供撤销绑定操作。
      nextPendingCursor: "", // 待审批申请续页游标；空字符串表示无续页。
      hasMorePending: false, // 待审批申请是否仍有后续页。
      loading: false, // 活动绑定请求是否进行中。
      pendingLoading: false, // 待审批请求是否进行中。
      bindingError: "", // 活动绑定查询失败时的提示；空字符串表示无错误。
      pendingError: "", // 待审批查询失败时的提示；空字符串表示无错误。
      approvalCode: "", // 审批人验证器的 6 位动态码；只在裁决时使用，不与申请人 MFA 共用。
      approvalDecisionId: "", // 正在裁决的申请编号；空字符串表示按钮未处于提交中。
      hgSelectedBindingId: "", // 当前回填查看的活动授权绑定 ID；空字符串表示新授权编辑模式。
    };
  }

  /** 进入页面加载角色选项；已带用户 ID 时同时拉取活动绑定及待审批申请。 */
  componentDidMount() {
    this.hgMounted = true;
    this.loadRoles(0);
    if (this.state.form.userId) this.loadAssignments();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgBindingRequest += 1;
    this.hgPendingRequest += 1;
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

  /** 同时刷新两个来源；任一路失败时另一来源仍可独立展示，绝不将空响应伪装成成功。 */
  loadAssignments = () => {
    const userId = this.state.form.userId.trim(); // 输入的精确目标管理员 ID；空值不发请求。
    if (!userId) {
      message.error("请输入管理员用户 ID");
      return;
    }
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
    HGEmployeeRoleVM.revoke(this.state.form.userId, bindingId)
      .then(() => {
        message.success("授权已撤销");
        this.loadAssignments();
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
    const { form, hgSelectedBindingId, bindings, pendingGrants } = this.state;
    // 查看已有授权不代表申请；只保存资料时不应再次触发授权或 MFA 校验。
    if (hgSelectedBindingId) return { valid: true, skip: true };
    // 未选择角色视为本次不授予角色，跳过授权校验。
    if (!form.roleId) return { valid: true, skip: true };
    if (bindings.some((binding) =>
      String(binding.roleId) === form.roleId &&
      binding.scopeType === form.scopeType &&
      (binding.scopeId || "") === (form.scopeId || "")
    )) {
      message.error("该角色在当前作用域已授权，请勿重复申请");
      return { valid: false };
    }
    if (pendingGrants.some((grant) =>
      String(grant.roleId) === form.roleId &&
      grant.scopeType === form.scopeType &&
      (grant.scopeId || "") === (form.scopeId || "")
    )) {
      message.error("该角色在当前作用域已有待审批申请");
      return { valid: false };
    }
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
        const approval = await HGEmployeeRoleVM.grant(form); // 回执 approvalId 仅是申请单号，不是生效授权 ID。
        if (this.hgMounted) {
          message.success(`授权申请${approval?.approvalId ? ` #${approval.approvalId}` : ""}已提交，等待另一名管理员审批`);
          if (this.state.form.userId.trim() === form.userId.trim()) {
            this.setState((previous) => ({ form: { ...INITIAL_BINDING_FORM, userId: previous.form.userId } }));
            this.loadAssignments();
          }
        }
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

  /** 合并角色区块：管理员 ID 由编辑入口带入，可手动修正后重新查询。 */
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
      {this.renderGrantForm()}
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
          <HGButtonPage type="link" onClick={() => this.decideApproval(record, true)} loading={this.state.approvalDecisionId === String(record.approvalId)} disabled={Boolean(this.state.approvalDecisionId)}>允许</HGButtonPage>
          <HGButtonPage type="link" danger onClick={() => this.decideApproval(record, false)} disabled={Boolean(this.state.approvalDecisionId)}>拒绝</HGButtonPage>
        </div>
      ) : (
        <div className={styles.rowActions}>
          <HGButtonPage type="link" onClick={() => this.hgSelectBinding(record)}>查看回填</HGButtonPage>
          <HGButtonPage type="link" danger onClick={() => this.revokeRole(record.id)} disabled={record.roleCode === "super_admin"}>撤销</HGButtonPage>
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
        <p className={styles.emptyText}>暂无已授权或待审批角色</p>
      )}
    </div>
  };

  /** 渲染授权申请表单：角色、作用域、失效时间与申请人 MFA 验证码。 */
  renderGrantForm = () => {
    const { form, roles, nextCursor, hasMore, bindings, hgSelectedBindingId } = this.state;
    const selectedBinding = bindings.find((binding) => String(binding.id) === hgSelectedBindingId); // 当前查看的活动授权；未选中为 undefined。
    const selectedRoleInOptions = roles.some((role) => String(role.id) === form.roleId); // 已授权角色不在当前角色页时补只读选项。
    return (
      <section className={styles.grantSection} aria-label="授予新角色">
        <h3 className={styles.grantTitle}>授予新角色</h3>
        {hgSelectedBindingId && (
          <div className={styles.selectionNotice}>
            <span>当前仅查看已有授权；点击“保存”只保存资料，不会重复授予角色。</span>
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
              <option value="">不授予角色（仅保存资料）</option>
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
      </section>
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
