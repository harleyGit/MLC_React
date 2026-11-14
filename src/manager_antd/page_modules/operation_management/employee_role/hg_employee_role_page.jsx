/* IAM 员工角色管理页：MFA 绑定与双人授权审批。
 * 授权查询、授权申请与活动绑定区块已迁至 user/hg_user_edit_role_page.jsx，由用户列表「编辑」进入。 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM from "./hg_employee_role_vm";

class HGEmployeeRolePage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载标记，阻止异步响应在卸载后写入敏感状态。
    this.hgApprovalRequest = 0; // 审批游标请求序号，避免刷新后被旧页响应覆盖。
    this.state = {
      mfaPassword: "",
      mfaSecret: "",
      mfaURI: "",
      mfaConfirmCode: "", // 验证器生成的 6 位动态码；初始为空，只在首次确认请求中发送，不由服务端获取。
      approvalCode: "",
      approvals: [],
      approvalNextCursor: "",
      approvalHasMore: false,
      approvalLoading: false, // 双人审批队列及验证码。
    };
  }

  /** 挂载后加载审批队列首页，后续由用户主动刷新或加载更多。 */
  componentDidMount() {
    this.hgMounted = true;
    this.loadApprovals(0);
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgApprovalRequest += 1;
  }

  /** 密码复核通过后显示一次性 TOTP 绑定密钥；响应和页面均不持久化密钥。 */
  enrollMFA = () => {
    if (!this.state.mfaPassword) {
      message.error("请输入当前登录密码");
      return;
    }
    HGEmployeeRoleVM.enrollMFA(this.state.mfaPassword)
      .then((result) => {
        if (this.hgMounted)
          this.setState({
            mfaSecret: result?.secret || "",
            mfaURI: result?.otpauthUri || "",
            mfaPassword: "",
          });
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "MFA 绑定失败");
      });
  };

  /** 激活后立即清除页面中的明文密钥与验证码。 */
  confirmMFA = () => {
    if (!/^\d{6}$/.test(this.state.mfaConfirmCode)) {
      message.error("请从验证器输入 6 位动态码（不是短信验证码）");
      return;
    }
    HGEmployeeRoleVM.confirmMFA(this.state.mfaConfirmCode)
      .then(() => {
        if (this.hgMounted) {
          this.setState({ mfaSecret: "", mfaURI: "", mfaConfirmCode: "" });
          message.success("MFA 已启用");
        }
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "MFA 验证失败");
      });
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
  decideApproval = (id, approve) => {
    if (!/^\d{6}$/.test(this.state.approvalCode)) {
      message.error("请输入审批人的 6 位 MFA 验证码");
      return;
    }
    HGEmployeeRoleVM.decideApproval(id, this.state.approvalCode, approve)
      .then(() => {
        if (!this.hgMounted) return;
        this.setState({ approvalCode: "" });
        message.success(approve ? "审批通过并已生效" : "申请已拒绝");
        this.loadApprovals(0);
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "审批失败");
      });
  };

  renderMFA = () => (
    <div className={styles.formItem}>
      <h3>绑定管理员 MFA</h3>
      <p>
        先输入当前登录密码生成绑定密钥，再将密钥或绑定 URI 添加到支持 TOTP
        的验证器。动态码由验证器生成，服务端不会提供获取动态码的接口。
      </p>
      <input
        type="password"
        autoComplete="current-password"
        value={this.state.mfaPassword}
        onChange={(event) => this.setState({ mfaPassword: event.target.value })}
        placeholder="当前登录密码"
        className={styles.inputField}
      />
      <HGButtonPage onClick={this.enrollMFA}>生成绑定密钥</HGButtonPage>
      {this.state.mfaSecret && (
        <p>
          一次性密钥：<code>{this.state.mfaSecret}</code>
          <br />
          绑定 URI：<code>{this.state.mfaURI}</code>
        </p>
      )}
      <label htmlFor="hg-iam-mfa-confirm-code">
        验证器【Google Authenticator（Google 身份验证器）】显示的 6
        位动态码（非短信验证码）
      </label>
      <input
        id="hg-iam-mfa-confirm-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={this.state.mfaConfirmCode}
        onChange={(event) =>
          this.setState({ mfaConfirmCode: event.target.value })
        }
        placeholder="输入验证器中的 6 位动态码"
        className={styles.inputField}
      />
      <HGButtonPage
        onClick={this.confirmMFA}
        disabled={!/^\d{6}$/.test(this.state.mfaConfirmCode)}
      >
        确认并启用 MFA
      </HGButtonPage>
    </div>
  );

  renderApprovals = () => (
    <div className={styles.formItem}>
      <h3>待审批授权</h3>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={this.state.approvalCode}
        onChange={(event) =>
          this.setState({ approvalCode: event.target.value })
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
                <HGButtonPage
                  onClick={() => this.decideApproval(item.id, true)}
                >
                  批准
                </HGButtonPage>
                <HGButtonPage
                  onClick={() => this.decideApproval(item.id, false)}
                >
                  拒绝
                </HGButtonPage>
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
        {this.renderMFA()}
        {this.renderApprovals()}
      </div>
    );
  }
}

export default HGEmployeeRolePage;
