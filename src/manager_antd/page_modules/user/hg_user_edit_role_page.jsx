/*
 * 用户资料编辑页：由用户列表「编辑」按钮携带 user_id 跳转进入。
 * 路由参数 userId 指定编辑目标，location.state.user 提供资料回填。
 * 资料保存与受限即时角色分配为独立操作；权限仅供查看，实际授权由服务端复核。
 * 「返回」通过浏览器后退（navigate(-1)）回到来源页。
 */
import React, { Component } from "react";
import { handleError } from "../../../api/HttpManagerV1";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../components/hg_page_header/hg_page_header_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import HGTreeSelectPage from "../../../components/hg_tree_select/hg_tree_select_page";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import styles from "./hg_user_edit_role.module.css";
import HGUserRoleAssignVM from "./hg_user_role_assign_vm";
import HGUserVM from "./hg_user_vm";

/** 性别选项：与后端 gender 编码一致（1 男 / 2 女，其余按保密处理）。 */
const HG_GENDER_OPTIONS = [
  { value: 0, label: "保密" },
  { value: 1, label: "男" },
  { value: 2, label: "女" },
];

const HG_SIGNATURE_MAX_LENGTH = 200; // 签名输入上限；后端仍会做最终校验。

/** 从当前路由用户资料构建表单；缺省字段不继承上一个编辑目标。 */
const hgProfileFormFromUser = (user) => ({
  nickname: user.nickname ?? user.user_name ?? "", // 未设置时为空，保存前校验。
  gender: Number.isFinite(Number(user.gender)) ? Number(user.gender) : 0, // 缺省为保密。
  signature: user.signature ?? "", // 空字符串表示未填写。
  avatar_url: user.avatar_url ?? "", // 空字符串表示无头像。
  phone: user.phone ?? "", // 空字符串表示未绑定。
  email: user.email ?? "", // 空字符串表示未绑定。
});

class HGUserEditRolePage extends Component {
  constructor(props) {
    super(props);
    // 编辑目标用户由列表页通过 location.state 带入，用于表单回填与安全字段比对。
    const user = props.location?.state?.user || {};
    // 路由参数指定编辑目标 ID；没有参数时使用列表带入的 user_id。
    this.userId = String(props.params?.userId ?? user.user_id ?? "").trim();
    this.hgMounted = false; // 挂载标记，防止卸载后的资料响应更新页面。
    this.hgRolesRequest = 0; // 角色目录请求序号；同目标重试时也拒绝旧响应覆盖。
    this.hgBindingRequest = 0; // 绑定查询序号；刷新或卸载后拒绝旧结果覆盖。
    this.hgPermissionRequest = 0; // 角色权限查询序号；切换角色或卸载后丢弃旧响应。
    this.hgRoleSubmitting = false; // 授权提交同步锁；请求完成前阻止双击重复消费 MFA。
    this.state = {
      user, // 列表传入的编辑目标资料；缺省为空对象，不作为授权目标来源。
      // 资料编辑受控表单：空字符串表示用户未设置该项；仅手机号/邮箱变化时发送安全字段请求。
      profileForm: hgProfileFormFromUser(user),
      profileErrors: {}, // 资料表单字段级错误文案；空对象表示尚无错误。
      saving: false, // 主提交按钮加载状态。
      hgRoles: [], // 已加载的活动角色选项；空数组表示未加载或无可选角色。
      hgRolesLoading: false, // 角色目录请求中；必须先于当前用户绑定查询。
      hgRolesError: "", // 角色目录查询失败文案；空值表示正常。
      hgRolesTruncated: false, // 角色超过安全聚合上限时提示未完整加载。
      hgBindings: [], // 当前目标 user_id 的已生效角色绑定；不包含待审批申请。
      hgBindingCursor: "", // 已生效绑定下一页游标；空值表示没有续页。
      hgHasMoreBindings: false, // 是否有下一页绑定，不能把当前页当作全部角色。
      hgBindingsLoading: false, // 当前目标绑定查询进行中。
      hgBindingsError: "", // 绑定查询失败文案；空值表示正常。
      hgShowAssignRow: false, // 点击图标后显示 HGTable 中的单条新分配行。
      hgRoleIds: [], // 多选角色的主键列表；最多四个，以免批量授权事务无界增长。
      hgScopeTypes: [], // 已选择的作用域类型编码，最多三个。
      hgScopeIDs: {}, // 按非全局类型填写的已登记 ID，空对象表示没有填写。
      hgScopeCatalog: [], // 服务端作用域字典；status=0 的项目只显示在管理页。
      hgMFACode: "", // 当前操作者六位 MFA 动态码；提交后清空，不保存至缓存。
      hgPermissionRoleId: "", // 当前查看权限的角色 ID；空值表示未选择。
      hgPermissions: [], // 当前角色的已生效业务权限，只用于展示。
      hgPermissionLoading: false, // 权限请求中；避免旧角色权限误显示。
      hgPermissionError: "", // 权限请求错误文案；空值表示正常。
      hgRoleSaving: false, // 即时授权请求进行中，与资料保存独立。
    };
  }

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadRolesAndBindings();
  }

  /** 同一页面实例切换路由目标时清空旧用户绑定及 MFA，拒绝旧异步响应污染新目标。 */
  componentDidUpdate(previousProps) {
    const previousUserId = String(
      previousProps.params?.userId ??
        previousProps.location?.state?.user?.user_id ??
        ""
    ).trim(); // 前一个路由的目标 ID。
    const nextUserId = String(
      this.props.params?.userId ??
        this.props.location?.state?.user?.user_id ??
        ""
    ).trim(); // 当前路由的目标 ID。
    if (previousUserId === nextUserId) return;
    this.userId = nextUserId;
    this.hgRolesRequest += 1;
    this.hgBindingRequest += 1;
    this.hgPermissionRequest += 1;
    const user = this.props.location?.state?.user || {}; // 新目标资料，缺省时不沿用旧资料。
    this.setState(
      {
        user,
        profileForm: hgProfileFormFromUser(user),
        profileErrors: {},
        saving: false,
        hgRoles: [],
        hgRolesLoading: false,
        hgRolesError: "",
        hgRolesTruncated: false,
        hgBindings: [],
        hgBindingCursor: "",
        hgHasMoreBindings: false,
        hgBindingsLoading: false,
        hgBindingsError: "",
        hgShowAssignRow: false,
        hgRoleIds: [],
        hgScopeTypes: [],
        hgScopeIDs: {},
        hgScopeCatalog: [],
        hgMFACode: "",
        hgPermissionRoleId: "",
        hgPermissions: [],
        hgPermissionLoading: false,
        hgPermissionError: "",
      },
      this.hgLoadRolesAndBindings
    );
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRolesRequest += 1;
    this.hgBindingRequest += 1;
    this.hgPermissionRequest += 1;
  }

  /** 首先读取有界角色目录，再按路由 user_id 查询生效绑定；失败时不伪造无角色空态。 */
  hgLoadRolesAndBindings = async () => {
    if (!this.userId) {
      this.setState({ hgRolesError: "缺少用户 ID，无法分配角色" });
      return;
    }
    const userId = this.userId; // 发起请求时的目标 ID；切换路由后忽略旧目录结果。
    const request = ++this.hgRolesRequest; // 同目标重试时只接受最后一次角色目录响应。
    this.setState({ hgRolesLoading: true, hgRolesError: "" });
    try {
      const [result, scopeResult] = await Promise.all([HGUserRoleAssignVM.fetchAllRoles(), HGUserRoleAssignVM.fetchScopeTypes()]); // 两个权威目录全部成功才允许授权。
      if (!Array.isArray(scopeResult?.list) || scopeResult.hasMore) throw new Error("作用域类型目录不完整");
      if (
        !this.hgMounted ||
        this.userId !== userId ||
        request !== this.hgRolesRequest
      )
        return;
      this.setState({
        hgRoles: result.list,
        hgScopeCatalog: scopeResult.list.filter((item) => item.status === 1),
        hgRolesTruncated: result.truncated,
        hgRolesLoading: false,
      });
      this.hgLoadBindings(0);
    } catch (error) {
      if (
        this.hgMounted &&
        this.userId === userId &&
        request === this.hgRolesRequest
      )
        this.setState({
          hgRolesError: error?.message || "角色列表加载失败",
          hgRolesLoading: false,
        });
    }
  };

  /** 按 ID 游标加载当前用户的活动绑定；申请成功后重读首页而非在本地假设已授权。 */
  hgLoadBindings = (cursor = 0) => {
    const request = ++this.hgBindingRequest; // 同一用户刷新与翻页的请求身份标记。
    const userId = this.userId; // 查询时目标 ID；禁止迟到的旧用户结果显示在新用户页。
    this.setState({
      hgBindingsLoading: true,
      hgBindingsError: "",
      ...(cursor
        ? {}
        : { hgBindings: [], hgBindingCursor: "", hgHasMoreBindings: false }),
    });
    HGUserRoleAssignVM.fetchBindings(userId, cursor)
      .then((result) => {
        if (
          !this.hgMounted ||
          request !== this.hgBindingRequest ||
          this.userId !== userId
        )
          return;
        if (!Array.isArray(result?.list))
          throw new Error("角色绑定响应格式无效");
        this.setState((previous) => ({
          hgBindings: cursor
            ? [...previous.hgBindings, ...result.list]
            : result.list,
          hgBindingCursor: result.nextCursor || "",
          hgHasMoreBindings: Boolean(result.hasMore),
        }));
      })
      .catch((error) => {
        if (
          this.hgMounted &&
          request === this.hgBindingRequest &&
          this.userId === userId
        )
          this.setState({
            hgBindingsError: error?.message || "角色绑定加载失败",
          });
      })
      .finally(() => {
        if (
          this.hgMounted &&
          request === this.hgBindingRequest &&
          this.userId === userId
        )
          this.setState({ hgBindingsLoading: false });
      });
  };

  /** 选中角色后读取该角色的已生效权限；响应顺序变化不能把旧权限挂在新角色上。 */
  hgSelectRole = (roleId) => {
    const request = ++this.hgPermissionRequest; // 切换/重试角色时废弃较早的权限请求。
    this.setState({
      hgPermissionRoleId: roleId,
      hgPermissions: [],
      hgPermissionLoading: Boolean(roleId),
      hgPermissionError: "",
    });
    if (!roleId) return;
    HGUserRoleAssignVM.fetchRolePermissions(roleId)
      .then((result) => {
        if (!this.hgMounted || request !== this.hgPermissionRequest) return;
        if (!Array.isArray(result?.list) || !Array.isArray(result?.selected))
          throw new Error("角色权限响应格式无效");
        const selected = new Set(result.selected); // 只展示角色已生效且在权限目录中的编码。
        this.setState({
          hgPermissions: result.list.filter((item) => selected.has(item.code)),
        });
      })
      .catch((error) => {
        if (this.hgMounted && request === this.hgPermissionRequest)
          this.setState({
            hgPermissionError: error?.message || "业务权限加载失败",
          });
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgPermissionRequest)
          this.setState({ hgPermissionLoading: false });
      });
  };

  /** 图标仅切换一行未提交的表单；关闭时清空权限、作用域和一次性验证码。 */
  hgToggleAssignRow = () => {
    this.hgPermissionRequest += 1;
    this.setState((previous) => ({
      hgShowAssignRow: !previous.hgShowAssignRow,
      hgRoleIds: [],
      hgScopeTypes: [],
      hgScopeIDs: {},
      hgMFACode: "",
      hgPermissionRoleId: "",
      hgPermissions: [],
      hgPermissionLoading: false,
      hgPermissionError: "",
    }));
  };

  /** 多选角色后分别读取已生效权限，合并为只读集合；旧响应不得覆盖当前选择。 */
  hgSelectRoles = (ids) => {
    const request = ++this.hgPermissionRequest; // 多选变更与卸载都会让旧权限结果失效。
    this.setState({ hgRoleIds: ids, hgPermissions: [], hgPermissionRoleId: ids.join(","), hgPermissionLoading: ids.length > 0, hgPermissionError: "" });
    if (!ids.length) return;
    Promise.all(ids.map((id) => HGUserRoleAssignVM.fetchRolePermissions(id)))
      .then((results) => {
        if (!this.hgMounted || request !== this.hgPermissionRequest) return;
        const permissions = new Map(); // 服务端角色权限并集，展示用而非授权参数。
        results.forEach((result) => {
          if (!Array.isArray(result?.list) || !Array.isArray(result?.selected)) throw new Error("角色权限响应格式无效");
          const selected = new Set(result.selected); // 服务端返回的实际生效权限编码。
          result.list.filter((item) => selected.has(item.code)).forEach((item) => permissions.set(item.code, item));
        });
        this.setState({ hgPermissions: [...permissions.values()] });
      })
      .catch((error) => { if (this.hgMounted && request === this.hgPermissionRequest) this.setState({ hgPermissionError: error?.message || "业务权限加载失败" }); })
      .finally(() => { if (this.hgMounted && request === this.hgPermissionRequest) this.setState({ hgPermissionLoading: false }); });
  };

  /** 作用域类型多选后仅保留仍被选择的资源 ID；避免类型切换后错误复用 ID。 */
  hgSelectScopeTypes = (types) => this.setState((previous) => ({
    hgScopeTypes: types,
    hgScopeIDs: Object.fromEntries(Object.entries(previous.hgScopeIDs).filter(([type]) => types.includes(type))),
  }));

  /** 选好多个角色和作用域后一次 MFA 原子提交；失败不在本地伪造已授权绑定。 */
  hgSubmitRole = async () => {
    if (this.hgRoleSubmitting || !this.state.hgShowAssignRow) return;
    const userId = this.userId; // 点击时的授权目标；路由切换后不刷新或显示旧用户结果。
    const { hgRoleIds, hgScopeTypes, hgScopeIDs, hgMFACode, hgBindings, hgRoles, hgScopeCatalog } = this.state; // 点击时的受控表单快照。
    if (this.state.hgBindingsLoading || this.state.hgBindingsError || this.state.hgRolesLoading || this.state.hgRolesError || this.state.hgPermissionLoading || this.state.hgPermissionError) {
      message.error("请先完成角色与绑定查询");
      return;
    }
    if (!hgRoleIds.length || !hgScopeTypes.length || hgRoleIds.length * hgScopeTypes.length > 12 || hgRoleIds.some((id) => !hgRoles.some((role) => String(role.id) === id && role.code !== "super_admin"))) { message.error("请选择有效角色和作用域（最多 12 个绑定）"); return; }
    if (hgScopeTypes.some((type) => !hgScopeCatalog.some((item) => item.code === type && item.status === 1) || (type !== "global" && !hgScopeIDs[type]?.trim()))) { message.error("请输入已登记的作用域 ID"); return; }
    const bindings = hgRoleIds.flatMap((roleId) => hgScopeTypes.map((scopeType) => ({ roleId, scopeType, scopeId: scopeType === "global" ? "" : hgScopeIDs[scopeType].trim() }))); // 多选的笛卡尔积，每项单独校验权限与目标。
    if (bindings.some((item) => hgBindings.some((binding) => String(binding.roleId) === item.roleId && binding.scopeType === item.scopeType && (binding.scopeId || "") === item.scopeId))) { message.error("选中的角色与作用域中存在已生效绑定"); return; }
    if (!/^\d{6}$/.test(hgMFACode.trim())) {
      message.error("请输入操作者的 6 位 MFA 验证码");
      return;
    }
    this.hgRoleSubmitting = true;
    this.setState({ hgRoleSaving: true, hgMFACode: "" });
    try {
      const result = await HGUserRoleAssignVM.grantDirectBatch({ userId, bindings, mfaCode: hgMFACode });
      if (
        this.hgMounted &&
        this.userId === userId &&
        result?.granted === true
      ) {
        message.success("角色已立即生效");
        this.setState({
          hgShowAssignRow: false,
          hgRoleIds: [],
          hgScopeTypes: [],
          hgScopeIDs: {},
          hgPermissions: [],
          hgPermissionRoleId: "",
        });
        this.hgLoadBindings(0);
      } else if (this.hgMounted && this.userId === userId) {
        message.error("授权结果未确认，请重新查询后再操作");
      }
    } catch (error) {
      if (this.hgMounted && this.userId === userId)
        message.error(error?.message || "角色分配失败，请查询后确认状态");
    } finally {
      this.hgRoleSubmitting = false;
      if (this.hgMounted) this.setState({ hgRoleSaving: false });
    }
  };

  /** 返回来源页；配合运维页选中态持久化，后退后停留在原「用户列表」子菜单。 */
  handleBack = () => {
    if (this.props.navigate) {
      this.props.navigate(-1);
    } else if (window.history.length > 1) {
      window.history.back();
    }
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
    if (
      email !== (user?.email ?? "") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.email = "请输入有效的邮箱地址";
    }
    if (
      avatarURL &&
      !/^https?:\/\//i.test(avatarURL) &&
      !avatarURL.startsWith("/uploads/")
    ) {
      errors.avatar_url = "头像 URL 需为 HTTPS/HTTP 地址或 /uploads/ 路径";
    }
    this.setState({ profileErrors: errors });
    return Object.keys(errors).length === 0;
  };

  /** 校验并保存用户资料；角色授权使用独立即时授权请求，不随资料保存提交。 */
  handleSubmit = async () => {
    if (this.state.saving || !this.validateProfile()) return;
    const userId = this.userId; // 提交时的路由目标；异步返回不覆盖其他用户的页面。
    const { profileForm, user } = this.state;
    this.setState({ saving: true });
    try {
      await HGUserVM.updateUserByUserId({
        userId,
        previousPhone: user?.phone,
        previousEmail: user?.email,
        nickname: profileForm.nickname.trim(),
        gender: profileForm.gender,
        signature: profileForm.signature.trim(),
        avatar_url: profileForm.avatar_url.trim(),
        phone: profileForm.phone.trim(),
        email: profileForm.email.trim(),
      });
      if (this.hgMounted && this.userId === userId)
        message.success("用户资料已更新");
    } catch (error) {
      if (this.hgMounted && this.userId === userId) handleError(error);
    } finally {
      if (this.hgMounted && this.userId === userId)
        this.setState({ saving: false });
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
      {!error && extra ? (
        <span className={styles.extraText}>{extra}</span>
      ) : null}
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
              className={`${styles.control} ${
                profileErrors.nickname ? styles.controlError : ""
              }`}
              value={profileForm.nickname}
              maxLength={30}
              placeholder="请输入昵称"
              onChange={(event) =>
                this.handleProfileFieldChange("nickname", event.target.value)
              }
            />,
            profileErrors.nickname
          )}
          {this.renderProfileField(
            "性别",
            <select
              className={styles.control}
              value={profileForm.gender}
              onChange={(event) =>
                this.handleProfileFieldChange(
                  "gender",
                  Number(event.target.value)
                )
              }
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
              className={`${styles.control} ${
                profileErrors.phone ? styles.controlError : ""
              }`}
              type="tel"
              value={profileForm.phone}
              maxLength={32}
              placeholder="请输入手机号"
              onChange={(event) =>
                this.handleProfileFieldChange("phone", event.target.value)
              }
            />,
            profileErrors.phone
          )}
          {this.renderProfileField(
            "邮箱",
            <input
              className={`${styles.control} ${
                profileErrors.email ? styles.controlError : ""
              }`}
              type="email"
              value={profileForm.email}
              maxLength={255}
              placeholder="请输入邮箱"
              onChange={(event) =>
                this.handleProfileFieldChange("email", event.target.value)
              }
            />,
            profileErrors.email,
            "管理员修改他人联系方式将写入审计记录"
          )}
          {this.renderProfileField(
            "头像 URL",
            <input
              className={`${styles.control} ${
                profileErrors.avatar_url ? styles.controlError : ""
              }`}
              value={profileForm.avatar_url}
              maxLength={512}
              placeholder="/uploads/user/avatar.png"
              onChange={(event) =>
                this.handleProfileFieldChange("avatar_url", event.target.value)
              }
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
              onChange={(event) =>
                this.handleProfileFieldChange("signature", event.target.value)
              }
            />,
            null,
            `还可以输入 ${
              HG_SIGNATURE_MAX_LENGTH - profileForm.signature.length
            } 个字符`
          )}
        </div>
      </HGCardPage>
    );
  };

  /** 角色权限仅展示服务端 selected 编码；下拉选择不改变角色的权限配置。 */
  renderRolePermissions = (roleId) => {
    if (this.state.hgPermissionRoleId !== String(roleId))
      return <span>选择角色查看权限</span>;
    const {
      hgPermissions,
      hgPermissionLoading,
      hgPermissionError,
    } = this.state;
    if (hgPermissionError)
      return (
        <span role="alert" className={styles.errorText}>
          {hgPermissionError}{" "}
          <HGButtonPage
            type="link"
            onClick={() => this.state.hgShowAssignRow ? this.hgSelectRoles(this.state.hgRoleIds) : this.hgSelectRole(String(roleId))}
          >
            重试
          </HGButtonPage>
        </span>
      );
    return <div role="group" aria-label="该角色已生效的业务权限（仅查看）">
      <HGTreeSelectPage treeCheckable value={hgPermissions.map((item) => item.code)} onChange={() => {}} treeData={hgPermissions.map((item) => ({ value: item.code, title: `${item.description || item.code}（${item.code}）` }))} placeholder={hgPermissionLoading ? "权限加载中" : "暂无业务权限"} />
    </div>;
  };

  /** 基本资料下方的独立分配区：先展示用户已有绑定；点击图标才追加一行即时授权表单。 */
  renderRoleAssignment = () => {
    const {
      hgRoles,
      hgBindings,
      hgShowAssignRow,
      hgRoleIds,
      hgScopeTypes,
      hgScopeIDs,
      hgScopeCatalog,
      hgMFACode,
    } = this.state;
    const roleNames = new Map(
      hgRoles.map((role) => [String(role.id), role.name || role.code])
    ); // 已有绑定角色未在当前目录时使用服务端角色编码。
    const rows = hgBindings.map((binding) => ({
      ...binding,
      hgRowKey: `binding-${binding.id}`,
      hgIsNew: false,
    })); // 已授权行使用稳定绑定主键。
    if (hgShowAssignRow)
      rows.push({ hgRowKey: "new-assignment", hgIsNew: true }); // 仅一条待分配行，非服务端生效绑定。
    const columns = [
      {
        title: "角色",
        dataIndex: "roleId",
        width: 200,
        render: (_, record) =>
          record.hgIsNew ? (
            <div role="group" aria-label="分配角色（可多选）"><HGTreeSelectPage treeCheckable showCheckedStrategy="SHOW_ALL" value={hgRoleIds} disabled={this.state.hgRoleSaving} onChange={(ids) => this.hgSelectRoles(ids.slice(0, 4))} treeData={hgRoles.filter((role) => role.code !== "super_admin").map((role) => ({ value: String(role.id), title: `${role.name}（${role.code}）` }))} placeholder="选择最多四个角色" /></div>
          ) : (
            roleNames.get(String(record.roleId)) ||
            record.roleCode ||
            `角色 #${record.roleId}`
          ),
      },
      {
        title: "业务权限（仅查看）",
        dataIndex: "hgRowKey",
        width: 240,
        render: (_, record) =>
          record.hgIsNew ? (
            this.renderRolePermissions(hgRoleIds.join(","))
          ) : hgShowAssignRow ? (
            <span>分配完成后可查看</span>
          ) : this.state.hgPermissionRoleId === String(record.roleId) ? (
            this.renderRolePermissions(record.roleId)
          ) : (
            <HGButtonPage
              type="link"
              onClick={() => this.hgSelectRole(String(record.roleId))}
            >
              查看权限
            </HGButtonPage>
          ),
      },
      {
        title: "作用域类型",
        dataIndex: "scopeType",
        width: 150,
        render: (value, record) =>
          record.hgIsNew ? (
            <div role="group" aria-label="作用域类型（可多选）"><HGTreeSelectPage treeCheckable showCheckedStrategy="SHOW_ALL" value={hgScopeTypes} disabled={this.state.hgRoleSaving} onChange={(types) => this.hgSelectScopeTypes(types.slice(0, 3))} treeData={hgScopeCatalog.map((item) => ({ value: item.code, title: `${item.name}（${item.code}）` }))} placeholder="选择最多三种作用域" /></div>
          ) : (
            value
          ),
      },
      {
        title: "作用域 ID",
        dataIndex: "scopeId",
        width: 190,
        render: (value, record) =>
          record.hgIsNew ? (
            hgScopeTypes.filter((type) => type !== "global").map((type) => (
              <label key={type}>{type}<input aria-label={`${type} 已登记的作用域 ID`} className={styles.control} value={hgScopeIDs[type] || ""} maxLength={64} disabled={this.state.hgRoleSaving} onChange={(event) => this.setState((previous) => ({ hgScopeIDs: { ...previous.hgScopeIDs, [type]: event.target.value } }))} /></label>
            ))
          ) : (
            value || "—"
          ),
      },
      {
        title: "操作者 MFA",
        dataIndex: "hgRowKey",
        width: 170,
        render: (_, record) =>
          record.hgIsNew ? (
            <input
              aria-label="操作者 MFA 验证码"
              className={styles.control}
              value={hgMFACode}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={this.state.hgRoleSaving}
              onChange={(event) =>
                this.setState({ hgMFACode: event.target.value })
              }
            />
          ) : (
            "—"
          ),
      },
      {
        title: "操作",
        dataIndex: "hgRowKey",
        width: 150,
        render: (_, record) =>
          record.hgIsNew ? (
            <HGButtonPage
              type="primary"
              onClick={this.hgSubmitRole}
              loading={this.state.hgRoleSaving}
            >
              一次验证并授予
            </HGButtonPage>
          ) : (
            "已生效"
          ),
      },
    ]; // HGTablePage 的列渲染签名为 render(value, record)；避免将未提交行当作已授权绑定。
    return (
      <HGCardPage title="分配角色" className={styles.card}>
        <div className={styles.roleToolbar}>
          <HGButtonPage
            onClick={this.hgToggleAssignRow}
            disabled={
              this.state.hgRolesLoading ||
              Boolean(this.state.hgRolesError) ||
              this.state.hgRoleSaving
            }
          >
            <HGIconPage type="plus" />{" "}
            {hgShowAssignRow ? "取消分配" : "分配角色"}
          </HGButtonPage>
          <HGButtonPage
            onClick={() => this.hgLoadBindings(0)}
            disabled={
              this.state.hgRolesLoading || Boolean(this.state.hgRolesError)
            }
            loading={this.state.hgBindingsLoading}
          >
            刷新已授权角色
          </HGButtonPage>
        </div>
        {this.state.hgRolesLoading && <p>角色列表加载中…</p>}
        {this.state.hgRolesError && (
          <p role="alert" className={styles.errorText}>
            {this.state.hgRolesError}{" "}
            <HGButtonPage type="link" onClick={this.hgLoadRolesAndBindings}>
              重试
            </HGButtonPage>
          </p>
        )}
        {this.state.hgRolesTruncated && (
          <p role="status">
            角色超过 500 个，仅加载前 500
            个；如需其他角色请在员工角色管理页操作。
          </p>
        )}
        {this.state.hgBindingsError && (
          <p role="alert" className={styles.errorText}>
            {this.state.hgBindingsError}
          </p>
        )}
        {!this.state.hgRolesLoading &&
          !this.state.hgRolesError &&
          (rows.length > 0 ? (
            <div className={styles.roleTable}>
              <HGTablePage
                rowKey="hgRowKey"
                columns={columns}
                dataSource={rows}
                loading={this.state.hgBindingsLoading}
                pagination={false}
                autoRowHeight
              />
            </div>
          ) : !this.state.hgBindingsLoading && !this.state.hgBindingsError ? (
            <p>当前用户暂无已生效角色</p>
          ) : null)}
        {this.state.hgHasMoreBindings && (
          <HGButtonPage
            onClick={() => this.hgLoadBindings(this.state.hgBindingCursor)}
            disabled={this.state.hgBindingsLoading}
          >
            加载更多已授权角色
          </HGButtonPage>
        )}
        <p className={styles.roleHint}>
          此处仅分配已有角色；业务权限随角色生效，不会修改角色权限。需持有专门即时授权权限，且不可给自己分配。
        </p>
      </HGCardPage>
    );
  };

  render() {
    const { saving } = this.state;
    return (
      <div className={styles.pageContainer}>
        <HGPageHeaderPage
          title="编辑用户"
          description="修改用户基本资料，并按权限为其他用户批量分配已有角色。"
          extra={<HGButtonPage onClick={this.handleBack}>返回</HGButtonPage>}
        />
        {this.renderProfileForm()}
        {this.renderRoleAssignment()}
        <div className={styles.footerBar}>
          <HGButtonPage
            type="primary"
            loading={saving}
            onClick={this.handleSubmit}
          >
            保存
          </HGButtonPage>
        </div>
      </div>
    );
  }
}

// 注入路由能力：params 提供编辑目标 userId，location.state 提供资料回填。
const HGUserEditRolePageWithNavigation = WithNavigation(HGUserEditRolePage);

export default HGUserEditRolePageWithNavigation;
