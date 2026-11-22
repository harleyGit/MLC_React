/*
 * 用户资料编辑页：由用户列表「编辑」按钮携带 user_id 跳转进入。
 * 路由参数 userId 指定编辑目标，location.state.user 提供资料回填。
 * 资料先保存，再以一次 MFA 批量提交待分配角色及每条绑定的权限子集；实际授权由服务端复核。
 * 「返回」通过浏览器后退（navigate(-1)）回到来源页。
 */
import React, { Component } from "react";
import { handleError } from "../../../api/HttpManagerV1";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGCollectionView from "../../../components/hg_collection_view/hg_collection_view";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../components/hg_page_header/hg_page_header_page";
import HGTreeSelectPage from "../../../components/hg_tree_select/hg_tree_select_page";
import { HGAuthButton } from "../../../modules/iam/hg_permission";
import { HG_PERMISSIONS } from "../../../modules/iam/hg_permission_codes";
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
const HG_ASSIGNABLE_SCOPE_TYPES = new Set([
  "global", "shop", "org", "creator", "organization", "environment",
  "crawler_project", "content_channel", "region",
]); // 仅限服务端已接入权威 ID 校验的类型；字典中的其他编码不能因启用就直接授权。

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
  static defaultProps = {
    // 由 WithNavigation 注入的路由参数；缺省时不带目标 ID，仍可从 location.state.user 回退。
    params: undefined,
    // 由 WithNavigation 注入的路由状态；缺省时不回填用户资料。
    location: undefined,
    // 由 WithNavigation 注入的返回导航函数；缺省时使用浏览器历史返回。
    navigate: undefined,
  };

  constructor(props) {
    super(props);
    // 编辑目标用户由列表页通过 location.state 带入，用于表单回填与安全字段比对。
    const user = props.location?.state?.user || {};
    // 路由参数指定编辑目标 ID；没有参数时使用列表带入的 user_id。
    this.userId = String(props.params?.userId ?? user.user_id ?? "").trim();
    this.hgMounted = false; // 挂载标记，防止卸载后的资料响应更新页面。
    this.hgRolesRequest = 0; // 角色目录请求序号；同目标重试时也拒绝旧响应覆盖。
    this.hgBindingRequest = 0; // 绑定查询序号；刷新或卸载后拒绝旧结果覆盖。
    this.hgBindingPermissionEpoch = 0; // 绑定权限批次序号；刷新/切换用户后丢弃旧角色权限。
    this.hgPermissionRequest = 0; // 每条草稿的权限查询序号；切换角色或卸载后丢弃旧响应。
    this.hgScopeResourceEpoch = 0; // 资源候选批次；切换用户后拒绝旧用户页面的候选响应。
    this.hgDraftSequence = 0; // 草稿稳定主键序号；删除或追加时不复用旧行标识。
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
      hgBindingPermissions: {}, // 按角色 ID 保存已有绑定的权限查询状态；空对象表示尚未读取。
      hgDrafts: [], // 待提交分配行；每行单选角色、可多选作用域，最多十二个绑定。
      hgScopeCatalog: [], // 服务端完整作用域字典；授权时仅显示 status=1 且已接入校验的九类作用域。
      hgScopeResources: {}, // 按作用域类型缓存授权候选页；缺少键表示尚未请求，不将失败误判为空资源。
      hgMFAVisible: false, // 仅当存在待分配行且点击底部保存时显示验证弹窗。
      hgMFACode: "", // 当前操作者六位 MFA 动态码；关闭或提交时清空。
      hgProfileSaved: false, // 本轮待授权资料已保存且未再次编辑；重试授权不重复保存资料。
      hgRoleSaving: false, // 资料与批量授权提交期间禁用草稿编辑。
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
    this.hgBindingPermissionEpoch += 1;
    this.hgPermissionRequest += 1;
    this.hgScopeResourceEpoch += 1;
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
        hgBindingPermissions: {},
        hgDrafts: [],
        hgScopeCatalog: [],
        hgScopeResources: {},
        hgMFAVisible: false,
        hgMFACode: "",
        hgProfileSaved: false,
        hgRoleSaving: false,
      },
      this.hgLoadRolesAndBindings
    );
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRolesRequest += 1;
    this.hgBindingRequest += 1;
    this.hgBindingPermissionEpoch += 1;
    this.hgPermissionRequest += 1;
    this.hgScopeResourceEpoch += 1;
  }

  /** 绑定查询与角色/作用域目录独立；目录故障不能阻止已有角色的只读回填。 */
  hgLoadRolesAndBindings = async () => {
    if (!this.userId) {
      this.setState({ hgRolesError: "缺少用户 ID，无法分配角色" });
      return;
    }
    const userId = this.userId; // 发起请求时的目标 ID；切换路由后忽略旧目录结果。
    const request = ++this.hgRolesRequest; // 同目标重试时只接受最后一次角色目录响应。
    this.setState({ hgRolesLoading: true, hgRolesError: "" });
    this.hgLoadBindings(0);
    try {
      const [result, scopeResult] = await Promise.all([
        HGUserRoleAssignVM.fetchAllRoles(),
        HGUserRoleAssignVM.fetchScopeTypes(),
      ]); // 两个权威目录全部成功才允许授权。
      if (!Array.isArray(scopeResult?.list) || scopeResult.hasMore)
        throw new Error("作用域类型目录不完整");
      if (
        !this.hgMounted ||
        this.userId !== userId ||
        request !== this.hgRolesRequest
      )
        return;
      this.setState({
        hgRoles: result.list,
        hgScopeCatalog: scopeResult.list, // 保留完整字典供展示；可授权性由后端实际支持范围限定。
        hgRolesTruncated: result.truncated,
        hgRolesLoading: false,
      });
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

  /** 按 ID 游标加载当前用户的活动绑定；授权后重读权威数据而非在本地伪造绑定。 */
  hgLoadBindings = (cursor = 0) => {
    const request = ++this.hgBindingRequest; // 同一用户刷新与翻页的请求身份标记。
    const userId = this.userId; // 查询时目标 ID；禁止迟到的旧用户结果显示在新用户页。
    if (!cursor) this.hgBindingPermissionEpoch += 1;
    this.setState({
      hgBindingsLoading: true,
      hgBindingsError: "",
      ...(cursor
        ? {}
        : {
            hgBindings: [],
            hgBindingCursor: "",
            hgHasMoreBindings: false,
            hgBindingPermissions: {},
          }),
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
        this.setState(
          (previous) => ({
            hgBindings: cursor
              ? [...previous.hgBindings, ...result.list]
              : result.list,
            hgBindingCursor: result.nextCursor || "",
            hgHasMoreBindings: Boolean(result.hasMore),
          }),
          () => this.hgLoadBindingPermissions(result.list.filter((binding) => !binding.permissionsLimited), userId)
        );
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

  /** 每页最多并行四个不同角色权限请求；刷新或切换用户时不再展示过期结果。 */
  hgLoadBindingPermissions = (bindings, userId) => {
    const epoch = this.hgBindingPermissionEpoch; // 当前绑定快照；翻页沿用，首页刷新更换。
    const roleIds = [
      ...new Set(bindings.map((item) => String(item.roleId))),
    ].filter((id) => id && !this.state.hgBindingPermissions[id]); // 同一角色多个作用域只请求一次；已加载和请求中的角色不重复查询。
    if (!roleIds.length) return;
    this.setState((previous) => ({
      hgBindingPermissions: {
        ...previous.hgBindingPermissions,
        ...Object.fromEntries(
          roleIds.map((id) => [id, { loading: true, list: [], error: "" }])
        ),
      },
    }));
    let next = 0; // 下一个待读取角色位置；最多四个 worker，共享本次有界页的队列。
    const loadNext = async () => {
      while (next < roleIds.length) {
        const roleId = roleIds[next++]; // 当前 worker 领取的角色 ID，仅用于读取权限。
        try {
          const result = await HGUserRoleAssignVM.fetchRolePermissions(roleId);
          if (!Array.isArray(result?.list) || !Array.isArray(result?.selected))
            throw new Error("角色权限响应格式无效");
          const selected = new Set(result.selected); // 仅回填该角色已生效的权限，不包含目录未选项。
          if (
            this.hgMounted &&
            this.userId === userId &&
            this.hgBindingPermissionEpoch === epoch
          )
            this.setState((previous) => ({
              hgBindingPermissions: {
                ...previous.hgBindingPermissions,
                [roleId]: {
                  loading: false,
                  list: result.list.filter((item) => selected.has(item.code)),
                  error: "",
                },
              },
            }));
        } catch (error) {
          if (
            this.hgMounted &&
            this.userId === userId &&
            this.hgBindingPermissionEpoch === epoch
          )
            this.setState((previous) => ({
              hgBindingPermissions: {
                ...previous.hgBindingPermissions,
                [roleId]: {
                  loading: false,
                  list: [],
                  error: error?.message || "业务权限加载失败",
                },
              },
            }));
        }
        if (
          !this.hgMounted ||
          this.userId !== userId ||
          this.hgBindingPermissionEpoch !== epoch
        )
          return;
      }
    };
    for (let index = 0; index < Math.min(4, roleIds.length); index += 1)
      void loadNext();
  };

  /** 点击“分配新角色”才追加一条空草稿；每条草稿使用稳定行键。 */
  hgAddDraft = () => {
    if (this.state.saving || this.state.hgRoleSaving || this.state.hgDrafts.length >= 12) return;
    const key = `draft-${++this.hgDraftSequence}`; // 删除后不复用，防止旧权限响应写入新草稿。
    this.setState((previous) =>
      previous.hgDrafts.length >= 12 ? null : {
        hgDrafts: [...previous.hgDrafts, {
          key, roleId: "", scopeTypes: [], scopeIDs: {},
          permissions: [], selectedPermissions: [], permissionLoading: false, permissionError: "", permissionRequest: 0,
        }],
        hgMFAVisible: false,
        hgMFACode: "",
      }
    );
  };

  /** 关闭/移除草稿不改变已有绑定，旧权限请求只能更新仍存在且匹配的行。 */
  hgRemoveDraft = (key) => {
    if (this.state.saving || this.state.hgRoleSaving) return;
    this.setState((previous) => ({
      hgDrafts: previous.hgDrafts.filter((draft) => draft.key !== key),
      hgMFAVisible: false,
      hgMFACode: "",
    }));
  };

  /** 不可变地修改指定草稿；任何草稿变动都废弃尚未使用的 MFA。 */
  hgUpdateDraft = (key, update) =>
    this.setState((previous) => ({
      hgDrafts: previous.hgDrafts.map((draft) =>
        draft.key === key ? { ...draft, ...update(draft) } : draft
      ),
      hgMFAVisible: false,
      hgMFACode: "",
    }));

  /** 每条草稿只选一个角色；默认选中该角色当前全部业务权限，拒绝旧角色/已删除行的迟到响应。 */
  hgSelectRole = (key, roleId) => {
    const request = ++this.hgPermissionRequest; // 当前草稿本次权限查询身份。
    this.hgUpdateDraft(key, () => ({
      roleId, permissions: [], selectedPermissions: [], permissionLoading: Boolean(roleId),
      permissionError: "", permissionRequest: request,
    }));
    if (!roleId) return;
    HGUserRoleAssignVM.fetchRolePermissions(roleId)
      .then((result) => {
        if (!Array.isArray(result?.list) || !Array.isArray(result?.selected))
          throw new Error("角色权限响应格式无效");
        const selected = new Set(result.selected); // 仅允许缩减当前角色已生效权限，不能扩张角色权限。
        if (!this.hgMounted) return;
        this.setState((previous) => ({
          hgDrafts: previous.hgDrafts.map((draft) =>
            draft.key === key && draft.permissionRequest === request && draft.roleId === roleId
              ? {
                  ...draft,
                  permissions: result.list.filter((item) => selected.has(item.code)),
                  selectedPermissions: result.list.filter((item) => selected.has(item.code)).map((item) => item.code),
                  permissionLoading: false,
                }
              : draft
          ),
        }));
      })
      .catch((error) => {
        if (!this.hgMounted) return;
        this.setState((previous) => ({
          hgDrafts: previous.hgDrafts.map((draft) =>
            draft.key === key && draft.permissionRequest === request && draft.roleId === roleId
              ? { ...draft, permissionError: error?.message || "业务权限加载失败", permissionLoading: false }
              : draft
          ),
        }));
      });
  };

  /** 只允许服务端已启用且当前授权链已实现的类型；选中后加载对应真实资源。 */
  hgSelectScopeTypes = (key, types) => {
    const available = types.filter((type) =>
      this.state.hgScopeCatalog.some((item) => item.code === type && item.status === 1 && HG_ASSIGNABLE_SCOPE_TYPES.has(type))
    ); // 不允许停用或尚未实现资源校验的字典项进入授权请求。
    this.hgUpdateDraft(key, (draft) => ({
      scopeTypes: available,
      scopeIDs: Object.fromEntries(
        Object.entries(draft.scopeIDs).filter(([type]) => available.includes(type))
      ),
    }));
    available.filter((type) => type !== "global" && !this.state.hgScopeResources[type])
      .forEach((type) => this.hgLoadScopeResources(type));
  };

  /** 按游标读取选定类型的候选资源；失败可重试，旧路由和旧请求不可覆盖新结果。 */
  hgLoadScopeResources = (type, cursor = "") => {
    const epoch = this.hgScopeResourceEpoch; // 当前页面用户的资源加载批次。
    const userId = this.userId; // 候选请求的页面身份，仅用于防止切换目标后的过期回填。
    if (type === "global" || !HG_ASSIGNABLE_SCOPE_TYPES.has(type) || this.state.hgScopeResources[type]?.loading) return;
    this.setState((previous) => ({
      hgScopeResources: {
        ...previous.hgScopeResources,
        [type]: { ...previous.hgScopeResources[type], list: cursor ? previous.hgScopeResources[type]?.list || [] : [],
          loading: true, error: "", nextCursor: cursor, hasMore: false },
      },
    }));
    HGUserRoleAssignVM.fetchScopeResources(type, cursor)
      .then((result) => {
        if (!Array.isArray(result?.list) || (result.hasMore && !result.nextCursor))
          throw new Error("作用域资源响应格式无效");
        if (!this.hgMounted || this.userId !== userId || epoch !== this.hgScopeResourceEpoch) return;
        this.setState((previous) => {
          const loaded = cursor ? previous.hgScopeResources[type]?.list || [] : []; // 同类型已加载候选项，登记 shop 优先于商家。
          const seen = new Set(loaded.map((item) => item.id)); // 商家与已登记 shop 共用 ID 时只显示一次。
          const list = [...loaded, ...result.list.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          })]; // 合并稳定游标页，不将重复候选展示给管理员。
          const singleID = !result.hasMore && list.length === 1 ? list[0].id : ""; // 只有确定唯一资源时才自动填充，不猜测用户目标。
          return {
            hgScopeResources: {
              ...previous.hgScopeResources,
              [type]: { list, loading: false, error: "", nextCursor: result.nextCursor || "", hasMore: Boolean(result.hasMore) },
            },
            hgDrafts: singleID ? previous.hgDrafts.map((draft) =>
              draft.scopeTypes.includes(type) && !draft.scopeIDs[type]
                ? { ...draft, scopeIDs: { ...draft.scopeIDs, [type]: singleID } }
                : draft
            ) : previous.hgDrafts,
          };
        });
      })
      .catch((error) => {
        if (!this.hgMounted || this.userId !== userId || epoch !== this.hgScopeResourceEpoch) return;
        this.setState((previous) => ({
          hgScopeResources: { ...previous.hgScopeResources,
            [type]: { ...previous.hgScopeResources[type], loading: false, error: error?.message || "作用域资源加载失败" } },
        }));
      });
  };

  /** 聚合并检查全部草稿；角色单选，重复绑定和已生效绑定均不得提交。 */
  hgGetPendingBindings = () => {
    const { hgDrafts, hgBindings, hgRoles, hgScopeCatalog, hgScopeResources } = this.state;
    if (
      this.state.hgBindingsLoading || this.state.hgBindingsError ||
      this.state.hgHasMoreBindings || this.state.hgRolesLoading ||
      this.state.hgRolesError || hgDrafts.some((draft) => draft.permissionLoading || draft.permissionError)
    ) {
      message.error("请先完成角色、权限与全部绑定查询");
      return null;
    }
    const bindings = []; // 一次批量授权的有界绑定列表；最多十二项。
    for (const draft of hgDrafts) {
      if (
        !draft.roleId || !draft.scopeTypes.length ||
        !hgRoles.some((role) => String(role.id) === draft.roleId && role.code !== "super_admin")
      ) {
        message.error("每条分配行请选择一个有效角色和作用域");
        return null;
      }
      if (
        draft.selectedPermissions.length > 200 ||
        draft.selectedPermissions.some((code) => !draft.permissions.some((item) => item.code === code))
      ) {
        message.error("所选业务权限不属于当前角色");
        return null;
      }
      for (const scopeType of draft.scopeTypes) {
        if (
          !hgScopeCatalog.some((item) => item.code === scopeType && item.status === 1) ||
          !HG_ASSIGNABLE_SCOPE_TYPES.has(scopeType) ||
          (scopeType !== "global" &&
            (hgScopeResources[scopeType]?.loading || hgScopeResources[scopeType]?.error ||
             !hgScopeResources[scopeType]?.list?.some((item) => item.id === draft.scopeIDs[scopeType])))
        ) {
          message.error("请从已加载的有效作用域资源中选择 ID");
          return null;
        }
        bindings.push({
          roleId: draft.roleId, scopeType,
          scopeId: scopeType === "global" ? "" : draft.scopeIDs[scopeType].trim(),
          permissions: draft.selectedPermissions,
        });
      }
    }
    if (bindings.length > 12) {
      message.error("一次最多分配 12 个角色作用域绑定");
      return null;
    }
    const keys = bindings.map((item) => JSON.stringify([item.roleId, item.scopeType, item.scopeId])); // 精确匹配三元组，避免拼接歧义。
    if (
      new Set(keys).size !== keys.length ||
      bindings.some((item) => hgBindings.some((binding) =>
        String(binding.roleId) === item.roleId &&
        binding.scopeType === item.scopeType &&
        (binding.scopeId || "") === item.scopeId
      ))
    ) {
      message.error("选中的角色与作用域中存在重复或已生效绑定");
      return null;
    }
    return bindings;
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
    if (this.state.saving) return;
    this.setState((previousState) => ({
      profileForm: {
        ...previousState.profileForm,
        [fieldName]: fieldValue,
      },
      profileErrors: {
        ...previousState.profileErrors,
        [fieldName]: "",
      },
      hgProfileSaved: false,
      hgMFAVisible: false,
      hgMFACode: "",
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

  /** 保存入口：无草稿时仅更新资料；有草稿时先检查全部授权参数，再要求一次 MFA。 */
  handleSubmit = async () => {
    if (this.state.saving || this.hgRoleSubmitting || !this.validateProfile()) return;
    if (this.state.hgDrafts.length) {
      if (!this.hgGetPendingBindings()) return;
      this.setState({ hgMFAVisible: true, hgMFACode: "" });
      return;
    }
    const userId = this.userId; // 切换目标后旧保存完成不得清除新目标的加载状态。
    this.setState({ saving: true });
    try {
      if (await this.hgSaveProfile()) message.success("用户资料已更新");
    } finally {
      if (this.hgMounted && this.userId === userId) this.setState({ saving: false });
    }
  };

  /** 资料保存成功才推进授权；重试授权时不重复写入未修改的资料。 */
  hgSaveProfile = async () => {
    if (this.state.hgProfileSaved) return true;
    const userId = this.userId; // 异步结果只能更新发起时的目标用户。
    const { profileForm, user } = this.state;
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
      if (!this.hgMounted || this.userId !== userId) return false;
      this.setState({
        user: { ...user, ...profileForm }, // 更新联系方式基线，避免下次提交重复使用旧值。
        hgProfileSaved: true,
      });
      return true;
    } catch (error) {
      if (this.hgMounted && this.userId === userId) handleError(error);
      return false;
    }
  };

  /** 验证一次 MFA：资料先保存，再一次批量授予；失败保留草稿供核对、重试。 */
  hgSubmitRole = async () => {
    if (this.hgRoleSubmitting || !this.state.hgMFAVisible || this.state.saving) return;
    if (!this.validateProfile()) return;
    const bindings = this.hgGetPendingBindings(); // 弹窗打开后仍重新验证当前草稿及绑定。
    if (!bindings) return;
    const userId = this.userId;
    const mfaCode = this.state.hgMFACode.trim(); // 一次性验证码只在此处进入请求。
    if (!/^\d{6}$/.test(mfaCode)) {
      message.error("请输入操作者的 6 位 MFA 验证码");
      return;
    }
    this.hgRoleSubmitting = true;
    this.setState({ saving: true, hgRoleSaving: true, hgMFAVisible: false, hgMFACode: "" });
    try {
      if (!await this.hgSaveProfile() || !this.hgMounted || this.userId !== userId) return;
      const result = await HGUserRoleAssignVM.grantDirectBatch({ userId, bindings, mfaCode });
      if (!this.hgMounted || this.userId !== userId) return;
      if (result?.granted !== true) {
        message.error("资料已保存，授权结果未确认；请查询角色绑定后再重试");
        this.hgLoadBindings(0);
        return;
      }
      message.success("用户资料已更新，角色已立即生效");
      this.setState({ hgDrafts: [] });
      this.hgLoadBindings(0);
    } catch {
      if (this.hgMounted && this.userId === userId) {
        if (this.state.hgProfileSaved) {
          message.error("资料已保存，角色授权失败或结果未确认；请查询绑定后再重试");
          this.hgLoadBindings(0);
        } else {
          message.error("资料保存失败，未提交角色授权");
        }
      }
    } finally {
      this.hgRoleSubmitting = false;
      if (this.hgMounted && this.userId === userId)
        this.setState({ saving: false, hgRoleSaving: false });
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

  /** 单条草稿默认全选该角色权限；可多选限制本次用户绑定，不修改共享角色权限。 */
  renderRolePermissions = (draft) => {
    if (draft.permissionError)
      return (
        <span role="alert" className={styles.errorText}>
          {draft.permissionError}{" "}
          <HGButtonPage
            type="link"
            onClick={() => this.hgSelectRole(draft.key, draft.roleId)}
          >
            重试
          </HGButtonPage>
        </span>
      );
    const hgHasPermissions = Boolean(draft.roleId && draft.permissions.length); // 只有角色已有生效权限时才开放多选，不把目录中未授权的权限作为候选。
    const hgPlaceholder = !draft.roleId ? "请先选择角色"
      : draft.permissionLoading ? "权限加载中"
      : hgHasPermissions ? "选择业务权限" : "该角色暂无业务权限"; // 空角色和加载态都保持禁用控件，不误导用户点击。
    return (
      <div role="group" aria-label="本次绑定业务权限（可多选）">
        <HGTreeSelectPage
          treeCheckable
          showCheckedStrategy="SHOW_ALL"
          disabled={!hgHasPermissions || draft.permissionLoading || this.state.hgRoleSaving}
          value={draft.selectedPermissions}
          onChange={(codes) => this.hgUpdateDraft(draft.key, () => ({ selectedPermissions: codes }))}
          treeData={draft.permissions.map((item) => ({
            value: item.code,
            title: item.description || item.code,
          }))}
          placeholder={hgPlaceholder}
        />
        {draft.roleId && !draft.permissionLoading && !hgHasPermissions && (
          <span role="status" className={styles.extraText}>
            该角色尚未配置业务权限，请先在角色权限管理中配置并生效后再分配
          </span>
        )}
      </div>
    );
  };

  /** 已生效绑定的权限按角色自动回填；单个角色查询失败不隐藏其绑定或作用域。 */
  renderBindingPermissions = (roleId) => {
    const roleKey = String(roleId); // 同一角色不同作用域共享只读权限结果。
    const result = this.state.hgBindingPermissions[roleKey]; // 未开始查询时显示加载态，不误判为空权限。
    if (!result || result.loading) return <span>权限加载中…</span>;
    if (result.error)
      return (
        <span role="alert" className={styles.errorText}>
          {result.error}{" "}
          <HGButtonPage
            type="link"
            onClick={() =>
              this.setState(
                (previous) => {
                  const permissions = { ...previous.hgBindingPermissions }; // 删除失败缓存以允许该角色重试。
                  delete permissions[roleKey];
                  return { hgBindingPermissions: permissions };
                },
                () =>
                  this.hgLoadBindingPermissions(
                    this.state.hgBindings.filter(
                      (binding) => String(binding.roleId) === roleKey
                    ),
                    this.userId
                  )
              )
            }
          >
            重试
          </HGButtonPage>
        </span>
      );
    if (!result.list.length) return <span>该角色暂无业务权限</span>;
    return (
      <div role="group" aria-label="该角色已生效的业务权限（仅查看）">
        <HGTreeSelectPage
          treeCheckable
          disabled
          value={result.list.map((item) => item.code)}
          treeData={result.list.map((item) => ({
            value: item.code,
            title: item.description || item.code,
          }))}
        />
      </div>
    );
  };

  /**
   * 渲染角色分配卡片中的单个字段：标签、控件与可选说明纵向排列。
   * @param {string} label 字段名称。
   * @param {React.ReactNode} control 受控控件或只读内容。
   * @param {string} [extra] 字段补充说明；缺省时不渲染。
   * @returns {React.ReactNode} 字段 JSX。
   */
  renderRoleField = (label, control, extra) => (
    <div className={styles.roleField}>
      <span className={styles.roleFieldLabel}>{label}</span>
      <div className={styles.roleFieldControl}>{control}</div>
      {extra ? <span className={styles.extraText}>{extra}</span> : null}
    </div>
  );

  /**
   * 渲染 HGCollectionView 的单行卡片：已生效绑定只读展示，未提交行是可编辑授权表单。
   * @param {Object} record 行数据；hgIsNew 区分待分配行与服务端已生效绑定。
   * @param {Map} roleNames 角色 ID 到展示名的映射；目录缺失时由行内编码兜底。
   * @returns {React.ReactNode} 行卡片 JSX。
   */
  renderRoleRow = (record, roleNames) => {
    const { hgRoles, hgScopeCatalog, hgScopeResources, hgRoleSaving } = this.state;
    if (record.hgIsNew) {
      const draft = record.hgDraft; // 草稿字段只属于该行，不复用其他待分配行的输入。
      return (
        <article className={`${styles.roleCard} ${styles.roleCardDraft}`}>
          <header className={styles.roleCardHead}>
            <span className={styles.roleCardTitle}>新增角色分配</span>
            <span
              className={`${styles.roleCardBadge} ${styles.roleCardBadgeDraft}`}
            >
              待提交
            </span>
          </header>
          <div className={styles.roleFieldGrid}>
            {this.renderRoleField(
              "角色",
              <div role="group" aria-label="分配角色（单选）">
                <HGTreeSelectPage
                  value={draft.roleId || null}
                  disabled={hgRoleSaving}
                  onChange={(roleId) => this.hgSelectRole(draft.key, roleId ?? "")}
                  treeData={hgRoles
                    .filter((role) => role.code !== "super_admin")
                    .map((role) => ({
                      value: String(role.id),
                      title: role.name,
                    }))}
                  placeholder="选择一个角色"
                />
              </div>
            )}
            {this.renderRoleField(
              "业务权限（可多选）",
              this.renderRolePermissions(draft)
            )}
            {this.renderRoleField(
              "作用域类型",
              <div role="group" aria-label="作用域类型（可多选）">
                <HGTreeSelectPage
                  treeCheckable
                  showCheckedStrategy="SHOW_ALL"
                  value={draft.scopeTypes}
                  disabled={hgRoleSaving}
                  onChange={(types) => this.hgSelectScopeTypes(draft.key, types)}
                  treeData={hgScopeCatalog.filter((item) => item.status === 1 && HG_ASSIGNABLE_SCOPE_TYPES.has(item.code)).map((item) => ({
                    value: item.code,
                    title: item.name,
                  }))}
                  placeholder="选择作用域类型"
                />
              </div>
            )}
            {draft.scopeTypes
              .filter((type) => type !== "global")
              .map((type) => {
                const resources = hgScopeResources[type]; // 已审核商家或已启用组织的游标页；缺省表示等待请求。
                return (
                  <React.Fragment key={type}>
                    {this.renderRoleField(
                      `${type} 作用域 ID`,
                      <select
                        aria-label={`${type} 作用域 ID`}
                        className={styles.control}
                        value={draft.scopeIDs[type] || ""}
                        disabled={hgRoleSaving || !resources || resources.loading}
                        onChange={(event) =>
                          this.hgUpdateDraft(draft.key, (previous) => ({
                            scopeIDs: { ...previous.scopeIDs, [type]: event.target.value },
                          }))
                        }
                      >
                        <option value="">{resources?.loading ? "候选资源加载中" : "请选择对应资源"}</option>
                        {(resources?.list || []).map((item) => (
                          <option key={item.id} value={item.id}>{item.name || item.id} · {item.id}</option>
                        ))}
                      </select>,
                      resources?.error || (!resources?.loading && resources?.list?.length === 0 ? "暂无可授权资源" : "")
                    )}
                    {resources?.error && <HGButtonPage type="link" onClick={() => this.hgLoadScopeResources(type, resources.nextCursor)}>重试加载 {type}</HGButtonPage>}
                    {resources?.hasMore && !resources.loading && <HGButtonPage type="link" onClick={() => this.hgLoadScopeResources(type, resources.nextCursor)}>加载更多 {type}</HGButtonPage>}
                  </React.Fragment>
                );
              })}
          </div>
          <footer className={styles.roleCardActions}>
            <HGButtonPage onClick={() => this.hgRemoveDraft(draft.key)} disabled={hgRoleSaving}>
              移除此行
            </HGButtonPage>
          </footer>
        </article>
      );
    }
    const roleName =
      roleNames.get(String(record.roleId)) ||
      record.roleCode ||
      `角色 #${record.roleId}`;
    return (
      <article className={styles.roleCard}>
        <header className={styles.roleCardHead}>
          <span className={styles.roleCardTitle}>{roleName}</span>
          <span className={styles.roleCardBadge}>已生效</span>
        </header>
        <div className={styles.roleScopeRow}>
          <span className={styles.roleScopeItem}>
            作用域类型 · {record.scopeType}
          </span>
          <span className={styles.roleScopeItem}>
            作用域 ID · {record.scopeId || "—"}
          </span>
        </div>
        {this.renderRoleField(
          "业务权限（仅查看）",
          record.permissionsLimited
            ? <span>该绑定已单独限制权限；角色权限并非此用户实际权限，请以服务端授权为准</span>
            : this.renderBindingPermissions(record.roleId)
        )}
      </article>
    );
  };

  /**
   * 渲染分配入口按钮，置于卡片标题栏右侧。
   * 刷新改由列表顶部下拉触发，不再占用列表上方的独立工具栏行。
   * @returns {React.ReactNode} 追加单条待分配行的入口。
   */
  renderRoleToolbar = () => (
    <HGAuthButton
      allOf={[HG_PERMISSIONS.IAM_GRANT, HG_PERMISSIONS.IAM_GRANT_DIRECT]}
      onClick={this.hgAddDraft}
      disabled={
        this.state.hgRolesLoading ||
        Boolean(this.state.hgRolesError) ||
        this.state.hgDrafts.length >= 12 ||
        this.state.saving ||
        this.state.hgRoleSaving
      }
    >
      <HGIconPage type="plus" /> 分配新角色
    </HGAuthButton>
  );

  /** 渲染目录与绑定的加载/错误/截断提示；无异常时返回 null，不占位。 */
  renderRoleStatus = () => {
    const {
      hgRolesLoading,
      hgRolesError,
      hgRolesTruncated,
      hgBindingsLoading,
      hgBindingsError,
    } = this.state;
    if (
      !hgRolesLoading &&
      !hgRolesError &&
      !hgRolesTruncated &&
      !hgBindingsLoading &&
      !hgBindingsError
    )
      return null;
    return (
      <div className={styles.roleStatus}>
        {hgRolesLoading && <p>角色列表加载中…</p>}
        {hgBindingsLoading && <p>用户角色绑定加载中…</p>}
        {hgRolesError && (
          <p role="alert" className={styles.errorText}>
            {hgRolesError}{" "}
            <HGButtonPage type="link" onClick={this.hgLoadRolesAndBindings}>
              重试
            </HGButtonPage>
          </p>
        )}
        {hgRolesTruncated && (
          <p role="status">
            角色超过 500 个，仅加载前 500
            个；如需其他角色请在员工角色管理页操作。
          </p>
        )}
        {hgBindingsError && (
          <p role="alert" className={styles.errorText}>
            {hgBindingsError}{" "}
            <HGButtonPage type="link" onClick={() => this.hgLoadBindings(0)}>
              重试
            </HGButtonPage>
          </p>
        )}
      </div>
    );
  };

  /**
   * 渲染角色列表或空态；自然高度模式由内容撑开，不预留固定高度空白。
   * @param {Array} rows 已生效绑定与待分配行组成的列表数据。
   * @param {Map} roleNames 角色 ID 到展示名的映射。
   * @returns {React.ReactNode} 列表或空态 JSX。
   */
  renderRoleList = (rows, roleNames) => {
    const { hgBindingsLoading, hgBindingsError } = this.state;
    if (rows.length === 0) {
      return !hgBindingsLoading && !hgBindingsError ? (
        <p>当前用户暂无已生效 IAM 角色绑定；普通账号身份不等于 IAM 授权。</p>
      ) : null;
    }
    return (
      <HGCollectionView
        items={rows}
        getKey={(row) => row.hgRowKey}
        renderCell={(row) => this.renderRoleRow(row, roleNames)}
        fillHeight={false} // 待分配行是可编辑表单，不能进虚拟复用池：内部滚动视口中聚焦滚动会让池窗口位移、整行重挂载导致输入框失焦和列表跳动；自然高度模式由内容撑开。
        loading={hgBindingsLoading}
        onRefresh={this.hgLoadBindings} // 列表顶部下拉刷新绑定，替代独立的刷新按钮。
        ariaLabel="用户角色分配列表"
        loadedText="已展示全部已生效角色"
      />
    );
  };

  /** 渲染「加载更多」入口；没有续页时不输出。 */
  renderRoleLoadMore = () => {
    const { hgHasMoreBindings, hgBindingsLoading, hgBindingCursor } =
      this.state;
    if (!hgHasMoreBindings) return null;
    return (
      <HGButtonPage
        onClick={() => this.hgLoadBindings(hgBindingCursor)}
        disabled={hgBindingsLoading}
      >
        加载更多已授权角色
      </HGButtonPage>
    );
  };

  /** 先展示已生效绑定；只在点击“分配新角色”后追加一条独立草稿。 */
  renderRoleAssignment = () => {
    const { hgRoles, hgBindings, hgDrafts } = this.state;
    const roleNames = new Map(
      hgRoles.map((role) => [String(role.id), role.name || role.code])
    ); // 已有绑定角色未在当前目录时使用服务端角色编码。
    const rows = hgBindings.map((binding) => ({
      ...binding,
      hgRowKey: `binding-${binding.id}`,
      hgIsNew: false,
    })); // 已授权行使用稳定绑定主键。
    hgDrafts.forEach((draft) =>
      rows.push({ hgRowKey: draft.key, hgIsNew: true, hgDraft: draft })
    ); // 草稿行与服务端生效绑定使用不同主键，不在本地伪造已授权记录。
    return (
      <HGCardPage
        title="分配角色"
        className={styles.card}
        extra={this.renderRoleToolbar()}
      >
        {this.renderRoleStatus()}
        {this.renderRoleList(rows, roleNames)}
        {this.renderRoleLoadMore()}
        <p className={styles.roleHint}>
          此处仅分配已有角色；新增绑定可从角色当前权限中缩减权限，不会修改其他用户的角色权限。已有绑定若设置了权限子集，仅展示限制提示。需持有专门即时授权权限，且不可给自己分配。
        </p>
      </HGCardPage>
    );
  };

  /** 渲染页头：标题、说明与返回入口。 */
  renderPageHeader = () => (
    <HGPageHeaderPage
      title="编辑用户"
      description="修改用户基本资料，并按权限为其他用户分配已有角色。"
      extra={<HGButtonPage onClick={this.handleBack}>返回</HGButtonPage>}
    />
  );

  /** 一次性验证码仅存在弹窗内存中；关闭时清除，不缓存、不按行重复填写。 */
  renderMFAModal = () => (
    <HGModalPage
      visible={this.state.hgMFAVisible}
      title="确认分配角色"
      closable={!this.state.hgRoleSaving}
      onClose={() => this.setState({ hgMFAVisible: false, hgMFACode: "" })}
      footer={
        <>
          <HGButtonPage disabled={this.state.hgRoleSaving} onClick={() => this.setState({ hgMFAVisible: false, hgMFACode: "" })}>取消</HGButtonPage>
          <HGButtonPage type="primary" loading={this.state.hgRoleSaving} onClick={this.hgSubmitRole}>验证并保存</HGButtonPage>
        </>
      }
    >
      <p>先保存基本资料，再用一次 MFA 批量分配 {this.state.hgDrafts.length} 条角色；授权失败时资料不会回滚。</p>
      <label className={styles.field}>
        <span className={styles.label}>操作者 MFA 验证码</span>
        <input
          aria-label="操作者 MFA 验证码"
          className={styles.control}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={this.state.hgMFACode}
          onChange={(event) => this.setState({ hgMFACode: event.target.value.replace(/\D/g, "").slice(0, 6) })}
        />
      </label>
    </HGModalPage>
  );

  /** 底部唯一保存入口：草稿存在时先弹一次 MFA，未新增角色时仅保存资料。 */
  renderFooterBar = () => (
    <div className={styles.footerBar}>
      <HGButtonPage
        type="primary"
        loading={this.state.saving}
        disabled={this.state.hgMFAVisible}
        onClick={this.handleSubmit}
      >
        保存
      </HGButtonPage>
    </div>
  );

  render() {
    return (
      <div className={styles.pageContainer}>
        {this.renderPageHeader()}
        {this.renderProfileForm()}
        {this.renderRoleAssignment()}
        {this.renderFooterBar()}
        {this.renderMFAModal()}
      </div>
    );
  }
}

// 注入路由能力：params 提供编辑目标 userId，location.state 提供资料回填。
const HGUserEditRolePageWithNavigation = WithNavigation(HGUserEditRolePage);

export default HGUserEditRolePageWithNavigation;
