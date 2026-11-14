import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGPermissionConfigVM, {
  HG_GRANT_PERMISSION,
  HG_INVENTORY_PERMISSION,
} from "./hg_permission_config_vm";
import styles from "./hg_permission_config.module.css";

/** 管理员权限核验及受控开通指引；实际授权只经既有 IAM 审批入口生效。 */
class HGPermissionConfigPage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 卸载后不更新查询结果。
    this.hgRequest = 0; // 用户切换或重新查询时，废弃此前的异步响应。
    this.state = {
      userId: "", // 待核验的精确业务 user_id；默认空，不预设或硬编码授权对象。
      admin: null, // 精确匹配的管理员记录；null 表示不存在或尚未查询。
      checked: false, // 是否已完成当前 user_id 的管理员查询；初始 false。
      loading: false, // 当前管理员查询标记；默认 false。
      bindings: [], // 当前目标已加载的全局 IAM 绑定；初始为空，不等于已确认无绑定。
      loadingBindings: false, // 当前绑定分页请求标记；避免重复请求及加载中显示错误空态。
      bindingCursor: "", // 下一页绑定游标；空字符串表示当前没有下一页。
      hasMore: false, // 服务端是否还有未加载的绑定；默认 false。
      bindingError: "", // 授权查询失败提示；空字符串表示无已知错误。
      checkingRole: "", // 正在核验的绑定 ID；空字符串表示没有核验任务。
      roleChecks: {}, // 绑定 ID -> 已核验权限结论；缺失表示尚未核验。
    };
  }

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequest += 1;
  }

  /** 修改业务 ID 后丢弃旧结果，避免将上一个用户的角色显示给新用户。 */
  setUserId = (userId) => {
    this.hgRequest += 1;
    this.setState({ userId, admin: null, checked: false, loading: false, bindings: [], loadingBindings: false, bindingCursor: "", hasMore: false, bindingError: "", checkingRole: "", roleChecks: {} });
  };

  /** 按精确 ID 查管理员；只有活动管理员才继续查询 IAM 绑定。 */
  checkUser = async () => {
    const userId = this.state.userId.trim();
    if (!userId || userId.length > 64) {
      message.error("请输入不超过 64 个字符的业务 user_id");
      return;
    }
    const request = ++this.hgRequest;
    this.setState({ loading: true, checked: false, admin: null, bindings: [], loadingBindings: false, bindingCursor: "", hasMore: false, roleChecks: {}, bindingError: "" });
    try {
      const admin = await HGPermissionConfigVM.findAdmin(userId);
      if (!this.hgMounted || request !== this.hgRequest) return;
      this.setState({ admin, checked: true });
      if (admin?.status === 1) this.loadBindings(userId, "0", request);
    } catch (error) {
      if (this.hgMounted && request === this.hgRequest) message.error(error?.message || "管理员状态查询失败");
    } finally {
      if (this.hgMounted && request === this.hgRequest) this.setState({ loading: false });
    }
  };

  /** 按后端游标追加当前目标的绑定；失败时不推断该用户无权限。 */
  loadBindings = async (userId, cursor, request) => {
    if (this.state.loadingBindings) return;
    this.setState({ loadingBindings: true });
    try {
      const result = await HGPermissionConfigVM.fetchBindings(userId, cursor);
      if (!this.hgMounted || request !== this.hgRequest) return;
      if (!Array.isArray(result?.list)) throw new Error("IAM 绑定响应无效");
      this.setState((previous) => ({
        bindings: cursor === "0" ? result.list : [...previous.bindings, ...result.list],
        bindingCursor: result?.nextCursor || "",
        hasMore: Boolean(result?.hasMore),
        bindingError: "",
      }));
    } catch (error) {
      if (this.hgMounted && request === this.hgRequest) this.setState({ bindingError: error?.message || "IAM 绑定查询失败，请由有权管理员复核" });
    } finally {
      if (this.hgMounted && request === this.hgRequest) this.setState({ loadingBindings: false });
    }
  };

  /** 单次核验一个角色的权限；不自动对所有角色发起 N+1 查询。 */
  checkRole = async (binding) => {
    if (this.state.checkingRole) return;
    const request = this.hgRequest;
    this.setState({ checkingRole: binding.id });
    try {
      const result = await HGPermissionConfigVM.fetchRolePermissions(binding.roleId);
      if (!this.hgMounted || request !== this.hgRequest) return;
      if (!Array.isArray(result?.selected)) throw new Error("角色权限响应无效");
      this.setState((previous) => ({
        roleChecks: {
          ...previous.roleChecks,
          [binding.id]: {
            inventory: HGPermissionConfigVM.hasPermission(result.selected, HG_INVENTORY_PERMISSION),
            grant: HGPermissionConfigVM.hasPermission(result.selected, HG_GRANT_PERMISSION),
          },
        },
      }));
    } catch (error) {
      if (this.hgMounted && request === this.hgRequest) message.error(error?.message || "角色权限核验失败");
    } finally {
      if (this.hgMounted && request === this.hgRequest) this.setState({ checkingRole: "" });
    }
  };

  /** 只跳转至已有的受控页面，不代填 MFA、自动审批或修改数据库。 */
  goTo = (key) => this.props.onMenuSelect?.(key);

  renderLookup = () => {
    const { userId, admin, checked, loading } = this.state;
    return (
      <section className={styles.section}>
        <h3>1. 核对活动管理员</h3>
        <label htmlFor="hg-permission-config-user">业务 user_id（不是手机号或 users.id）</label>
        <div className={styles.row}>
          <input id="hg-permission-config-user" className={styles.input} value={userId} onChange={(event) => this.setUserId(event.target.value)} placeholder="输入目标账号的完整 user_id" />
          <HGButtonPage onClick={this.checkUser} loading={loading} disabled={loading}>核验管理员</HGButtonPage>
        </div>
        {checked && <p role="status">{admin?.status === 1 ? "活动管理员已确认" : admin ? "管理员未启用，需由有权人员处理状态" : "未查到该 ID 的管理员记录；请由有权人员先添加管理员"}</p>}
        <HGButtonPage onClick={() => this.goTo("admin_add")}>前往添加管理员</HGButtonPage>
      </section>
    );
  };

  renderBindings = () => {
    const { admin, bindings, bindingError, hasMore, bindingCursor, roleChecks, checkingRole, loadingBindings } = this.state;
    if (admin?.status !== 1) return null;
    return (
      <section className={styles.section}>
        <h3>2. 核验全局 IAM 角色</h3>
        <p>只有未撤销、未过期的全局角色绑定及其已生效权限可放行。角色名称和旧 ops 角色不构成授权。</p>
        {bindingError && <p role="alert" className={styles.error}>{bindingError}；不能据此判定无权限。</p>}
        {bindings.filter((binding) => binding.scopeType === "global" && !binding.scopeId).map((binding) => (
          <div key={binding.id} className={styles.binding}>
            <span>{binding.roleCode}（{binding.expiresAt ? `失效于 ${new Date(binding.expiresAt).toLocaleString()}` : "长期"}）</span>
            <HGButtonPage onClick={() => this.checkRole(binding)} disabled={Boolean(checkingRole)} loading={checkingRole === binding.id}>核验角色权限</HGButtonPage>
            {roleChecks[binding.id] && <span role="status">盘点读取：{roleChecks[binding.id].inventory ? "有" : "无"}；授权管理：{roleChecks[binding.id].grant ? "有" : "无"}</span>}
          </div>
        ))}
        {!bindingError && !loadingBindings && bindings.length === 0 && !hasMore && <p>当前查询页没有活动绑定；如刚发起申请，请等待另一名管理员审批后刷新。</p>}
        {hasMore && <HGButtonPage onClick={() => this.loadBindings(this.state.userId.trim(), bindingCursor, this.hgRequest)} loading={loadingBindings} disabled={loadingBindings}>加载更多绑定</HGButtonPage>}
      </section>
    );
  };

  renderActions = () => (
    <section className={styles.section}>
      <h3>3. 按受控流程开通</h3>
        <p>由已有授权资格的管理员为目标账号申请全局角色：角色须拥有 <code>{HG_INVENTORY_PERMISSION}</code>；若该账号还要给别人授权，则需额外申请 <code>{HG_GRANT_PERMISSION}</code>，查询角色与绑定还需 <code>iam:role:read</code>。提交申请不等于生效，须由另一名合格管理员使用自己的 MFA 审批；当前账号不能自行扩权。</p>
      <div className={styles.row}>
        <HGButtonPage onClick={() => this.goTo("role_list")}>检查 / 配置角色权限</HGButtonPage>
        <HGButtonPage onClick={() => this.goTo("role_employee")}>申请全局绑定 / 审批</HGButtonPage>
      </div>
    </section>
  );

  render() {
    return (
      <div className={styles.container}>
        <h2>权限配置</h2>
        <p>本页仅核验并引导已有管理员及 IAM 流程，不会因打开页面或输入账号而自动授权。</p>
        {this.renderLookup()}
        {this.renderBindings()}
        {this.renderActions()}
      </div>
    );
  }
}

export default HGPermissionConfigPage;
