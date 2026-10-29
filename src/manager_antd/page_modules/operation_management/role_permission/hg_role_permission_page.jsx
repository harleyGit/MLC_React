/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_permission/hg_role_permission_page.jsx
 * @Description: 权限管理页面，左侧选择角色，右侧按业务域勾选权限并提交绑定关系
 *
 * 存储角色与权限的绑定关系，实现一个角色批量分配多个菜单、按钮权限，是权限分配核心关联表，控制角色可访问的功能范围。
 * 权限模型：RBAC 负责「角色 → 权限」，具体资源归属与状态校验由后端 ABAC 权限引擎完成。
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGCheckbox } from "../../../../components/hg_checkbox/hg_checkbox_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGStatusTagPage from "../../../../components/hg_status_tag/hg_status_tag_page";
import HGRolePermissionVM, {
} from "./hg_role_permission_vm";
import styles from "./hg_role_permission.module.css";

/**
 * 权限管理页面。
 * 职责：选择角色 → 勾选权限（按业务域分组）→ 提交角色与权限的绑定关系。
 * 约束：
 * - 类组件，勾选状态由页面 state 管理，不依赖第三方表单库。
 * - 权限分组只做展示层聚合，权限编码与风险等级统一由 VM 计算。
 */
class HGRolePermissionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      /** 权限业务域分组；空数组表示尚未取得服务端目录。 */
      groups: [],
      /** 服务端权限目录树；空数组时禁止提交，不能使用本地 mock 作为权威数据。 */
      permissionTree: [],
      /** 当前已读取的角色；空数组表示尚未加载或没有角色。 */
      roles: [],
      /** 角色列表请求中；初始为 true 以避免误显示空态。 */
      loadingRoles: true,
      /** 后续角色页游标；空字符串表示没有下一页。 */
      nextRoleCursor: "",
      /** 角色列表加载错误；空字符串表示无错误。 */
      rolesError: "",
      /** 角色筛选关键词；空字符串表示展示当前加载的所有角色。 */
      roleKeyword: "",
      /** 当前选中角色十进制字符串 ID；空字符串表示未选。 */
      selectedRoleId: "",
      /** 当前角色勾选的权威权限编码；仅允许目录中的叶子节点。 */
      selectedValues: [],
      /** 本次角色读取失败文案；空字符串表示无错误，失败时不展示可保存的空配置。 */
      permissionsError: "",
      /** 角色权限请求进行中；为 true 时禁止编辑和保存。 */
      loadingPermissions: false,
      /** 申请提交中；防止重复申请。 */
      submitting: false,
      /** 是否展示提交审批所需的 MFA 弹窗；默认关闭。 */
      mfaVisible: false,
      /** 仅保存在内存中的 6 位验证码；关闭或完成时清空。 */
      mfaCode: "",
      /** 待审批申请编号；空字符串表示当前没有已提交的申请。 */
      approvalId: "",
    };
    /** 组件是否已卸载；卸载后丢弃异步响应。 */
    this.hgMounted = false;
    /** 角色权限请求序号；切换角色时丢弃晚到的旧响应。 */
    this.hgPermissionRequest = 0;
  }

  /**
   * 挂载后默认选中第一个角色，避免右侧出现空白面板。
   */
  componentDidMount() {
    this.hgMounted = true;
    this.loadRoles("0");
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgPermissionRequest += 1;
  }

  /** 读取一页活动角色；失败时保留已取得的页面，不伪造角色或权限。 */
  loadRoles = (cursor) => {
    if (this.state.loadingRoles && cursor !== "0") return;
    this.setState({ loadingRoles: true, rolesError: "" });
    HGRolePermissionVM.fetchRoles(cursor)
      .then((res) => {
        if (!this.hgMounted) return;
        if (!Array.isArray(res?.list) || typeof res?.hasMore !== "boolean" || (res.hasMore && !res.nextCursor)) {
          throw new Error("角色列表格式无效");
        }
        const roles = res.list.map((role) => ({
          value: String(role.id), label: role.name, code: role.code,
          desc: role.description || "", builtIn: Boolean(role.builtIn),
        }));
        if (roles.some((role) => !/^[1-9]\d*$/.test(role.value))) throw new Error("角色 ID 格式无效");
        this.setState((prev) => ({
          roles: cursor === "0" ? roles : [...prev.roles, ...roles],
          nextRoleCursor: res.hasMore ? String(res.nextCursor) : "",
        }), () => {
          if (cursor === "0" && roles.length > 0) this.handleSelectRole(roles[0].value);
        });
      })
      .catch(() => {
        if (this.hgMounted) this.setState({ rolesError: "角色列表加载失败，请重试" });
      })
      .finally(() => { if (this.hgMounted) this.setState({ loadingRoles: false }); });
  };

  /**
   * 切换角色并回填该角色已分配的权限。
   * @param {string} roleId 角色 ID。
   */
  handleSelectRole = (roleId) => {
    if (!roleId || this.state.submitting) return;
    const request = ++this.hgPermissionRequest;
    this.setState({ selectedRoleId: roleId, loadingPermissions: true, permissionsError: "", selectedValues: [], permissionTree: [], groups: [], approvalId: "", mfaVisible: false, mfaCode: "" });

    HGRolePermissionVM.fetchRolePermissions(roleId)
      .then((res) => {
        if (!this.hgMounted || request !== this.hgPermissionRequest) return;
        if (!Array.isArray(res?.list) || !Array.isArray(res?.selected)) throw new Error("权限响应格式无效");
        const permissionTree = HGRolePermissionVM.buildCatalogTree(res.list);
        const allowed = new Set(HGRolePermissionVM.collectLeafValues(permissionTree));
        if (res.selected.some((code) => typeof code !== "string" || !allowed.has(code))) throw new Error("角色权限不在目录中");
        const selectedValues = HGRolePermissionVM.normalizeSelectedValues(
          permissionTree, res.selected
        );
        this.setState({ permissionTree, groups: HGRolePermissionVM.buildPermissionGroups(permissionTree), selectedValues });
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgPermissionRequest) this.setState({ permissionsError: "角色权限加载失败，请重试", groups: [], permissionTree: [] });
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgPermissionRequest) this.setState({ loadingPermissions: false });
      });
  };

  /**
   * 角色筛选关键词变化。
   * @param {Object} event 输入事件。
   */
  handleRoleKeywordChange = (event) => {
    this.setState({ roleKeyword: event?.target?.value || "" });
  };

  /**
   * 勾选/取消单个权限。
   * @param {string} value 权限值。
   */
  handleTogglePermission = (value) => {
    if (this.state.submitting || this.state.approvalId || this.getSelectedRole()?.builtIn) return;
    this.setState((prevState) => {
      const exists = prevState.selectedValues.includes(value);
      return {
        selectedValues: exists
          ? prevState.selectedValues.filter((item) => item !== value)
          : [...prevState.selectedValues, value],
      };
    });
  };

  /**
   * 收集某个业务域分组下的全部权限值。
   * @param {Object} group 业务域分组。
   * @returns {Array<string>} 权限值数组。
   */
  getGroupValues = (group) => {
    return (group.children || []).reduce((acc, resource) => {
      return acc.concat((resource.items || []).map((item) => item.key));
    }, []);
  };

  /**
   * 业务域分组全选/取消全选。
   * @param {Object} group 业务域分组。
   */
  handleToggleGroup = (group) => {
    if (this.state.submitting || this.state.approvalId || this.getSelectedRole()?.builtIn) return;
    const groupValues = this.getGroupValues(group);
    const allSelected = HGRolePermissionVM.isGroupAllSelected(
      group,
      this.state.selectedValues
    );

    this.setState((prevState) => ({
      selectedValues: allSelected
        ? prevState.selectedValues.filter((value) => !groupValues.includes(value))
        : Array.from(new Set([...prevState.selectedValues, ...groupValues])),
    }));
  };

  /**
   * 全选所有权限。
   */
  handleSelectAll = () => {
    if (this.state.submitting || this.state.approvalId || this.getSelectedRole()?.builtIn) return;
    this.setState({
      selectedValues: HGRolePermissionVM.collectLeafValues(this.state.permissionTree),
    });
  };

  /**
   * 清空所有已选权限。
   */
  handleClearAll = () => {
    if (this.state.submitting || this.state.approvalId || this.getSelectedRole()?.builtIn) return;
    this.setState({ selectedValues: [] });
  };

  /**
   * 重置：重新拉取当前角色已保存的权限。
   */
  handleReset = () => {
    const { selectedRoleId } = this.state;
    if (!selectedRoleId || this.state.submitting) return;
    this.handleSelectRole(selectedRoleId);
  };

  /**
   * 提交角色权限审批申请。
   * 高风险全量替换只能先申请审批；内置角色不可配置。
   */
  handleSubmit = () => {
    const { selectedRoleId, selectedValues, roles, permissionTree, submitting, loadingPermissions, approvalId } = this.state;
    if (!selectedRoleId || loadingPermissions || submitting || approvalId || permissionTree.length === 0) {
      message.warning("请先选择需要配置权限的角色");
      return;
    }
    if (roles.find((role) => role.value === selectedRoleId)?.builtIn) {
      message.warning("内置角色权限由后端维护，不支持在此修改");
      return;
    }
    if (selectedValues.length > 50) {
      message.warning("单个角色最多配置 50 项权限");
      return;
    }
    this.setState({ mfaVisible: true, mfaCode: "" });
  };

  /** 校验验证码后提交申请；审批成功前不改写页面中当前已生效权限。 */
  handleConfirmSubmit = () => {
    const { selectedRoleId, selectedValues, mfaCode, submitting } = this.state;
    if (!this.state.mfaVisible || submitting || this.state.approvalId || this.getSelectedRole()?.builtIn || selectedValues.length > 50 || !/^\d{6}$/.test(mfaCode)) {
      message.warning("请输入 6 位 MFA 验证码");
      return;
    }
    const request = this.hgPermissionRequest;
    const submitData = HGRolePermissionVM.transformSubmitData({
      roleId: selectedRoleId,
      permissionValues: selectedValues,
      mfaCode,
    });
    this.setState({ submitting: true, mfaCode: "", mfaVisible: false });
    HGRolePermissionVM.submitRolePermission(submitData)
      .then((res) => {
        if (!this.hgMounted || request !== this.hgPermissionRequest) return;
        if (res?.status !== "pending" || !res?.approvalId) throw new Error("审批申请响应格式无效");
        this.setState({ approvalId: String(res.approvalId) });
        message.success("审批申请已提交，待另一名管理员批准后生效");
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgPermissionRequest) message.error("申请结果未确认，请先核对审批记录再决定是否重新提交");
      })
      .finally(() => {
        if (this.hgMounted) this.setState({ submitting: false });
      });
  };

  /**
   * 获取当前选中角色对象。
   * @returns {Object|undefined} 角色对象。
   */
  getSelectedRole = () => {
    return this.state.roles.find((role) => role.value === this.state.selectedRoleId);
  };

  /**
   * 渲染顶部指标卡：可选角色、权限项总数、已选权限、高风险权限。
   * @returns {React.ReactNode} 指标卡节点。
   */
  renderStats = () => {
    const { roles, selectedValues, loadingPermissions, permissionTree } = this.state;
    const risk = HGRolePermissionVM.countRisk(selectedValues);
    const totalPermissions = HGRolePermissionVM.collectLeafValues(permissionTree).length;

    const items = [
      {
        label: "可选角色",
        value: roles.length,
        suffix: "个",
        tone: "blue",
        icon: "🛡",
      },
      {
        label: "权限项总数",
        value: totalPermissions,
        suffix: "项",
        tone: "purple",
        icon: "≡",
      },
      {
        label: "当前角色已选",
        value: loadingPermissions ? "-" : selectedValues.length,
        suffix: "项",
        tone: "green",
        icon: "✓",
      },
      {
        label: "高风险权限",
        value: loadingPermissions ? "-" : risk.high,
        suffix: "项",
        tone: "orange",
        icon: "!",
      },
    ];

    return <HGStatCardPage items={items} />;
  };

  /**
   * 渲染角色卡片。
   * @param {Object} role 角色数据。
   * @returns {React.ReactNode} 角色卡片节点。
   */
  renderRoleItem = (role) => {
    const { selectedRoleId } = this.state;
    const active = role.value === selectedRoleId;

    return (
      <button
        key={role.value}
        type="button"
        className={`${styles.roleItem} ${active ? styles.roleItemActive : ""}`}
        onClick={() => this.handleSelectRole(role.value)}
        disabled={this.state.submitting}
        aria-pressed={active}
      >
        <span
          className={styles.roleBadge}
          style={{ background: HGRolePermissionVM.getRoleBadgeColor(role.value) }}
        >
          {role.label.slice(0, 1)}
        </span>
        <span className={styles.roleInfo}>
          <span className={styles.roleName}>{role.label}</span>
          <span className={styles.roleCode}>{role.code}</span>
          <span className={styles.roleDesc}>{role.desc}</span>
        </span>
      </button>
    );
  };

  /**
   * 渲染左侧角色选择面板。
   * @returns {React.ReactNode} 角色面板节点。
   */
  renderRolePanel = () => {
    const { roles, roleKeyword, loadingRoles, nextRoleCursor, rolesError } = this.state;
    const keyword = roleKeyword.trim().toLowerCase();
    const filteredRoles = keyword
      ? roles.filter(
          (role) =>
            role.label.toLowerCase().includes(keyword) ||
            role.code.toLowerCase().includes(keyword)
        )
      : roles;

    return (
      <HGCardPage
        title="角色"
        extra={<span className={styles.panelCount}>{roles.length}</span>}
        className={styles.rolePanel}
      >
        <div className={styles.roleSearch}>
          <HGInputSearch
            allowClear
            placeholder="搜索角色名称或编码"
            onChange={this.handleRoleKeywordChange}
          />
        </div>
        <div className={styles.roleList}>
          {filteredRoles.length === 0 ? (
            <div className={styles.placeholderText}>{loadingRoles ? "正在加载角色..." : rolesError || "没有匹配的角色"}</div>
          ) : (
            filteredRoles.map(this.renderRoleItem)
          )}
        </div>
        {rolesError && roles.length > 0 ? <div className={styles.placeholderText}>{rolesError}</div> : null}
        {rolesError && roles.length === 0 ? <HGButtonPage onClick={() => this.loadRoles("0")}>重试</HGButtonPage> : null}
        {nextRoleCursor ? <HGButtonPage disabled={loadingRoles} onClick={() => this.loadRoles(nextRoleCursor)}>{loadingRoles ? "加载中..." : "加载更多角色"}</HGButtonPage> : null}
      </HGCardPage>
    );
  };

  /**
   * 渲染权限项行：复选框 + 权限名称 + 权限编码 + 风险标签。
   * @param {Object} item 权限项。
   * @returns {React.ReactNode} 权限行节点。
   */
  renderPermissionItem = (item) => {
    const { selectedValues } = this.state;
    const checked = selectedValues.includes(item.key);
    const showRisk = item.risk.level !== "low";

    return (
      <div
        key={item.key}
        className={`${styles.permRow} ${checked ? styles.permRowChecked : ""}`}
      >
        <HGCheckbox checked={checked} disabled={this.state.submitting || Boolean(this.state.approvalId) || this.getSelectedRole()?.builtIn} onChange={() => this.handleTogglePermission(item.key)}>
          {item.title}
        </HGCheckbox>
        <span className={styles.permCode}>{item.code}</span>
        {showRisk ? (
          <HGStatusTagPage tone={item.risk.tone} dot={false}>
            {item.risk.label}风险
          </HGStatusTagPage>
        ) : null}
      </div>
    );
  };

  /**
   * 渲染资源分组（第二层）。
   * @param {Object} resource 资源节点。
   * @returns {React.ReactNode} 资源分组节点。
   */
  renderResourceBlock = (resource) => {
    const { selectedValues } = this.state;
    const total = (resource.items || []).length;
    const selected = (resource.items || []).filter((item) =>
      selectedValues.includes(item.key)
    ).length;

    return (
      <div key={resource.key} className={styles.resourceBlock}>
        <div className={styles.resourceHead}>
          <span className={styles.resourceTitle}>{resource.title}</span>
          <span className={styles.resourceCount}>
            {selected} / {total}
          </span>
        </div>
        <div className={styles.permList}>{resource.items.map(this.renderPermissionItem)}</div>
      </div>
    );
  };

  /**
   * 渲染业务域分组（第一层）。
   * @param {Object} group 业务域节点。
   * @returns {React.ReactNode} 业务域分组节点。
   */
  renderGroup = (group) => {
    const { selectedValues } = this.state;
    const total = HGRolePermissionVM.countGroupTotal(group);
    const selected = HGRolePermissionVM.countGroupSelected(group, selectedValues);
    const allSelected = HGRolePermissionVM.isGroupAllSelected(group, selectedValues);

    return (
      <section key={group.key} className={styles.group}>
        <header className={styles.groupHead}>
          <div className={styles.groupTitleArea}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <span className={styles.groupCount}>
              {selected} / {total}
            </span>
          </div>
          <HGButtonPage type="text" disabled={this.state.submitting || Boolean(this.state.approvalId) || this.getSelectedRole()?.builtIn} onClick={() => this.handleToggleGroup(group)}>
            {allSelected ? "取消全选" : "全选"}
          </HGButtonPage>
        </header>
        <div className={styles.resourceGrid}>
          {group.children.map(this.renderResourceBlock)}
        </div>
      </section>
    );
  };

  /**
   * 渲染右侧权限面板头部：当前角色摘要 + 批量操作。
   * @returns {React.ReactNode} 面板头部节点。
   */
  renderPermissionHeader = () => {
    const { selectedValues } = this.state;
    const role = this.getSelectedRole();
    if (!role) return null;

    return (
      <div className={styles.permissionHeader}>
        <div className={styles.permissionHeaderMain}>
          <span
            className={styles.roleBadge}
            style={{ background: HGRolePermissionVM.getRoleBadgeColor(role.value) }}
          >
            {role.label.slice(0, 1)}
          </span>
          <div className={styles.permissionHeaderMeta}>
            <div className={styles.permissionHeaderName}>
              {role.label}
              <span className={styles.roleCode}>{role.code}</span>
            </div>
            <div className={styles.permissionHeaderDesc}>{role.desc}</div>
          </div>
        </div>
        <div className={styles.permissionHeaderActions}>
          <span className={styles.selectedBadge}>已选 {selectedValues.length} 项</span>
          <HGButtonPage type="text" disabled={this.state.submitting || Boolean(this.state.approvalId) || role.builtIn} onClick={this.handleSelectAll}>
            全选
          </HGButtonPage>
          <HGButtonPage
            type="text"
            onClick={this.handleClearAll}
            disabled={selectedValues.length === 0 || this.state.submitting || Boolean(this.state.approvalId) || role.builtIn}
          >
            清空
          </HGButtonPage>
        </div>
      </div>
    );
  };

  /**
   * 渲染底部操作栏：风险提示 + 重置/提交审批。
   * @returns {React.ReactNode} 操作栏节点。
   */
  renderFooter = () => {
    const { selectedValues, submitting, selectedRoleId, approvalId, permissionTree } = this.state;
    const risk = HGRolePermissionVM.countRisk(selectedValues);
    const builtIn = this.getSelectedRole()?.builtIn;

    return (
      <div className={styles.footerBar}>
        <div className={styles.footerHint}>
          {approvalId ? (
            <span>申请 {approvalId} 待另一名管理员审批；审批通过前不生效。可重置刷新最新状态。</span>
          ) : builtIn ? (
            <span>内置角色权限由后端维护，不支持在此修改。</span>
          ) : risk.high > 0 ? (
            <>
              <HGStatusTagPage tone="warning" dot={false}>
                含 {risk.high} 项高风险权限
              </HGStatusTagPage>
              <span>权限调整需 MFA 验证并由另一名管理员审批，批准后才会生效。</span>
            </>
          ) : (
            <span>提交后进入双人审批，批准后才会生效。</span>
          )}
        </div>
        <div className={styles.footerActions}>
          <HGButtonPage onClick={this.handleReset} disabled={!selectedRoleId || submitting}>
            重置
          </HGButtonPage>
          <HGButtonPage
            type="primary"
            onClick={this.handleSubmit}
            loading={submitting}
            disabled={!selectedRoleId || builtIn || Boolean(approvalId) || permissionTree.length === 0 || selectedValues.length > 50}
          >
            提交审批申请
          </HGButtonPage>
        </div>
      </div>
    );
  };

  /**
   * 渲染右侧权限面板内容。
   * @returns {React.ReactNode} 权限面板节点。
   */
  renderPermissionPanel = () => {
    const { groups, selectedRoleId, loadingPermissions, permissionsError } = this.state;

    return (
      <HGCardPage title="权限配置" className={styles.permissionPanel}>
        {!selectedRoleId ? (
          <div className={styles.emptyState}>请先在左侧选择需要配置权限的角色</div>
        ) : loadingPermissions ? (
          <div className={styles.emptyState}>正在加载该角色的权限...</div>
        ) : permissionsError ? (
          <div className={styles.emptyState}>{permissionsError}<HGButtonPage onClick={this.handleReset}>重试</HGButtonPage></div>
        ) : groups.length === 0 ? (
          <div className={styles.emptyState}>服务端暂无可配置权限</div>
        ) : (
          <>
            {this.renderPermissionHeader()}
            <div className={styles.groupList}>{groups.map(this.renderGroup)}</div>
            {this.renderFooter()}
          </>
        )}
      </HGCardPage>
    );
  };

  render() {
    return (
      <div className={styles.rolePermissionContainer}>
        <HGPageHeaderPage
          title="权限管理"
          description="按「业务域:资源:操作」为角色配置权限，遵循最小权限原则；高风险权限建议配合审批与短期授权。"
        />

        {this.renderStats()}

        <div className={styles.layout}>
          {this.renderRolePanel()}
          {this.renderPermissionPanel()}
        </div>
        {this.renderMfaModal()}
      </div>
    );
  }

  /** 审批申请验证码仅存于组件内存，关闭弹窗即清空；不得持久化或打印。 */
  renderMfaModal = () => (
    <HGModalPage
      visible={this.state.mfaVisible}
      title="提交角色权限审批申请"
      onClose={() => this.setState({ mfaVisible: false, mfaCode: "" })}
      onCancel={() => this.setState({ mfaVisible: false, mfaCode: "" })}
      onOk={this.handleConfirmSubmit}
      okText="验证并提交申请"
    >
      <p>本次操作会全量替换角色权限{this.state.selectedValues.length === 0 ? "（包括清空全部权限）" : ""}，需本人 MFA 验证；申请成功后仍须另一名管理员审批。</p>
      <label htmlFor="hgRolePermissionMfa">MFA 验证码</label>
      <input
        id="hgRolePermissionMfa"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={this.state.mfaCode}
        onChange={(event) => this.setState({ mfaCode: event.target.value.replace(/\D/g, "").slice(0, 6) })}
      />
    </HGModalPage>
  );
}

export default HGRolePermissionPage;
