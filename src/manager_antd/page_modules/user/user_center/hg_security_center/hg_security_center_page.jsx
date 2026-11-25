import React, { Component } from "react";
import { Link } from "react-router-dom";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../../components/hg_card/hg_card_page";
import HGInputPage, { HGInputPassword } from "../../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import { hgIMOwner, hgIMSessionID } from "../../../../storage/hg_im_session";
import styles from "./hg_security_center_page.module.css";
import HGSecurityCenterVM from "./hg_security_center_vm";

const hgEmptyEnrollment = () => ({
  hgMfaPassword: "", // 当前登录密码；为空表示未输入，生成密钥后清除。
  hgMfaSecret: "", // 验证器设置密钥；只在本页内存中保留至激活。
  hgMfaUri: "", // 绑定 URI；与设置密钥一起清除。
  hgMfaConfirmCode: "", // 验证器当前六位动态码；关闭弹窗或确认成功后清除。
  hgConfirmModalOpen: false, // 动态码确认弹窗；默认关闭。
});

/**
 * MFA 验证器绑定页。邮箱绑定与找回由独立子页面处理。
 * @param {object} props
 * @param {string} props.hgRecoveryUrl 个人中心传入的恢复邮箱子页地址；必传，无默认值。
 */
class HGSecurityCenterPage extends Component {
  state = {
    ...hgEmptyEnrollment(),
    hgMfaEnabled: null, // null 表示尚无服务端状态，不能当作未启用。
    hgStatusFailed: false, // 状态读取失败时提供重试。
    hgEnrolling: false, // 生成密钥时禁用提交。
    hgConfirming: false, // 确认动态码时禁止关闭弹窗或重复提交。
  };

  hgMounted = false; // 离开子页后不再应用异步响应。
  hgPageSession = ""; // 当前账号与会话标识，不保存令牌。
  hgEnrollFlight = false; // 在 React 更新按钮前阻止重复生成。
  hgConfirmFlight = false; // 在 React 更新按钮前阻止重复激活。

  componentDidMount() {
    this.hgMounted = true;
    this.hgPageSession = this.hgSessionIdentity();
    void this.hgLoadMfaStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

  /** 仅跟踪会话归属，普通令牌续签不影响页面输入。 */
  hgSessionIdentity = () => `${hgIMOwner()}:${hgIMSessionID()}`;

  hgIsCurrent = () => this.hgMounted && this.hgSessionIdentity() === this.hgPageSession;

  /** 切换用户或离开此子页后，禁止旧请求借用当前账号重试。 */
  hgRequestOptions = () => ({
    validateRequest: () => {
      if (!this.hgIsCurrent()) throw new Error("安全设置页面或登录会话已变化");
    },
  });

  /** 进入子页只读取激活状态，不自动生成密钥。 */
  hgLoadMfaStatus = async () => {
    this.setState({ hgStatusFailed: false });
    try {
      const hgStatus = await HGSecurityCenterVM.recoveryStatus(this.hgRequestOptions()); // 共用本人状态接口，仅使用 MFA 标记。
      if (this.hgIsCurrent()) this.setState({ hgMfaEnabled: hgStatus.mfaEnabled === true });
    } catch {
      if (this.hgIsCurrent()) this.setState({ hgStatusFailed: true });
    }
  };

  /** 密码通过服务端复核后才显示验证器密钥。 */
  hgEnrollMFA = async () => {
    if (this.hgEnrollFlight || this.state.hgMfaEnabled !== false) return;
    const hgPassword = this.state.hgMfaPassword; // 当前点击的密码快照，只发给本人绑定接口。
    if (!hgPassword) return;
    this.hgEnrollFlight = true;
    this.setState({ hgEnrolling: true });
    try {
      const hgResult = await HGSecurityCenterVM.enrollMFA(hgPassword, this.hgRequestOptions()); // 短期展示的设置密钥与 URI。
      if (!this.hgIsCurrent()) return;
      this.setState({
        hgMfaSecret: hgResult?.secret || "",
        hgMfaUri: hgResult?.otpauthUri || "",
        hgMfaPassword: "",
        hgMfaConfirmCode: "",
      });
    } catch (hgError) {
      if (!this.hgIsCurrent()) return;
      if (hgError?.status === 409 && hgError?.code === HGSecurityCenterVM.hgMfaAlreadyEnabledCode) {
        this.setState({ ...hgEmptyEnrollment(), hgMfaEnabled: true });
        message.warning("你已经绑定了 MFA。若验证器丢失，请前往「恢复邮箱与找回 MFA」。");
      } else if (hgError?.status === 403) {
        message.warning("密码校验失败、权限不足或 MFA 尝试次数过多，请核实后重试。");
      } else if (hgError?.status === 429) {
        message.warning("操作过于频繁，请稍后再试。");
      } else if (hgError?.status === 503) {
        message.error("MFA 服务暂不可用，请稍后再试。");
      } else {
        message.error(hgError?.message || "MFA 绑定失败");
      }
    } finally {
      this.hgEnrollFlight = false;
      if (this.hgIsCurrent()) this.setState({ hgEnrolling: false });
    }
  };

  /** 使用验证器显示的动态码激活；成功后清除设置密钥并引导配置恢复邮箱。 */
  hgConfirmMFA = async () => {
    const { hgMfaConfirmCode, hgMfaSecret } = this.state; // 必须先生成设置密钥，再提交六位动态码。
    if (this.hgConfirmFlight || !hgMfaSecret || !/^\d{6}$/.test(hgMfaConfirmCode)) return;
    this.hgConfirmFlight = true;
    this.setState({ hgConfirming: true });
    try {
      await HGSecurityCenterVM.confirmMFA(hgMfaConfirmCode, this.hgRequestOptions());
      if (!this.hgIsCurrent()) return;
      this.setState({ ...hgEmptyEnrollment(), hgMfaEnabled: true });
      message.success("MFA 已启用，建议接着绑定恢复邮箱");
    } catch (hgError) {
      if (this.hgIsCurrent()) message.error(hgError?.message || "MFA 验证失败");
    } finally {
      this.hgConfirmFlight = false;
      if (this.hgIsCurrent()) this.setState({ hgConfirming: false });
    }
  };

  /** 用户显式复制密钥或 URI，失败时不改变绑定状态。 */
  hgCopyText = async (hgText, hgLabel) => {
    try {
      await navigator.clipboard.writeText(hgText);
      if (this.hgIsCurrent()) message.success(`${hgLabel}已复制`);
    } catch {
      if (this.hgIsCurrent()) message.error(`${hgLabel}复制失败，请手动选择复制`);
    }
  };

  /** 关闭未提交的确认弹窗时清空动态码。 */
  hgCloseConfirmModal = () => {
    if (!this.hgConfirmFlight) this.setState({ hgConfirmModalOpen: false, hgMfaConfirmCode: "" });
  };

  /** 第一项操作：用当前密码生成设置密钥。 */
  renderStepEnroll = () => {
    const { hgMfaPassword, hgEnrolling, hgMfaSecret } = this.state; // 密码为空或生成中时不可提交。
    return (
      <section className={styles.stepSection}>
        <h3 className={styles.stepTitle}>第一步 · 复核登录密码</h3>
        <p className={styles.stepDesc}>输入当前登录密码，生成添加到验证器的设置密钥。</p>
        <div className={styles.stepBody}>
          <label className={styles.fieldLabel} htmlFor="hg-security-mfa-password">当前登录密码</label>
          <HGInputPassword id="hg-security-mfa-password" value={hgMfaPassword}
            onChange={(event) => this.setState({ hgMfaPassword: event.target.value })}
            placeholder="请输入当前登录密码" autoComplete="current-password" className={styles.control} disabled={hgEnrolling} />
          <HGButtonPage type="primary" onClick={this.hgEnrollMFA} loading={hgEnrolling} disabled={!hgMfaPassword || hgEnrolling}>
            {hgMfaSecret ? "重新生成绑定密钥" : "生成绑定密钥"}
          </HGButtonPage>
        </div>
      </section>
    );
  };

  /** 第二项操作：把设置密钥或绑定链接添加到支持 TOTP 的验证器。 */
  renderStepSecret = () => {
    const { hgMfaSecret, hgMfaUri } = this.state; // 未生成密钥时只显示引导，不显示空的凭据。
    return (
      <section className={styles.stepSection}>
        <h3 className={styles.stepTitle}>第二步 · 添加验证器</h3>
        <p className={styles.stepDesc}>在验证器 App（例如 Google 身份验证器）里添加账号，并输入设置密钥。App 会生成不断更新的六位动态码。</p>
        {hgMfaSecret ? (
          <div className={styles.stepBody}>
            {[
              ["设置密钥", hgMfaSecret],
              ["绑定 URI", hgMfaUri],
            ].map(([hgLabel, hgValue]) => (
              <div key={hgLabel} className={styles.secretRow}>
                <span className={styles.fieldLabel}>{hgLabel}</span>
                <code className={styles.codeBlock}>{hgValue}</code>
                <HGButtonPage type="link" onClick={() => this.hgCopyText(hgValue, hgLabel)}>复制</HGButtonPage>
              </div>
            ))}
            <p className={styles.secretTip} role="note">密钥仅本次展示。先添加到自己的验证器，不要发给他人。</p>
          </div>
        ) : <p className={styles.stepPending}>完成第一步后在此显示设置密钥。</p>}
      </section>
    );
  };

  /** 第三项操作：在弹窗中确认验证器已正确生成动态码。 */
  renderStepConfirm = () => (
    <section className={styles.stepSection}>
      <h3 className={styles.stepTitle}>第三步 · 确认激活</h3>
      <p className={styles.stepDesc}>输入验证器 App 当前显示的六位动态码，不是邮件或短信验证码。</p>
      <div className={styles.stepBody}>
        <HGButtonPage type="primary" disabled={!this.state.hgMfaSecret || this.state.hgEnrolling}
          onClick={() => this.setState({ hgConfirmModalOpen: true })}>
          输入动态码并激活
        </HGButtonPage>
      </div>
    </section>
  );

  /** 动态码确认弹窗；提交期间禁止重复提交或清空当前输入。 */
  renderConfirmModal = () => {
    const { hgMfaConfirmCode, hgConfirming, hgConfirmModalOpen } = this.state; // 弹窗状态与请求状态只在本页维护。
    return (
      <HGModalPage visible={hgConfirmModalOpen} title="确认激活 MFA" closable={!hgConfirming} onClose={this.hgCloseConfirmModal}
        footer={
          <div className={styles.modalFooter}>
            <HGButtonPage onClick={this.hgCloseConfirmModal} disabled={hgConfirming}>取消</HGButtonPage>
            <HGButtonPage type="primary" onClick={this.hgConfirmMFA} loading={hgConfirming}
              disabled={!/^\d{6}$/.test(hgMfaConfirmCode) || hgConfirming}>确认并启用</HGButtonPage>
          </div>
        }>
        <label className={styles.fieldLabel} htmlFor="hg-security-mfa-confirm-code">验证器六位动态码</label>
        <HGInputPage id="hg-security-mfa-confirm-code" value={hgMfaConfirmCode} className={styles.control}
          onChange={(event) => this.setState({ hgMfaConfirmCode: event.target.value.replace(/\D/g, "").slice(0, 6) })}
          placeholder="输入验证器中的动态码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} allowClear disabled={hgConfirming} />
      </HGModalPage>
    );
  };

  /** 仅在服务端确认尚未启用时展示绑定步骤。 */
  renderMfaSetup = () => {
    const { hgMfaEnabled, hgStatusFailed } = this.state; // 读取失败和未启用是不同状态。
    if (hgStatusFailed) return (
      <p role="alert">无法获取 MFA 状态。 <HGButtonPage type="link" onClick={this.hgLoadMfaStatus}>重试</HGButtonPage></p>
    );
    if (hgMfaEnabled === null) return <p role="status">正在读取 MFA 状态…</p>;
    if (hgMfaEnabled) return <p role="status">MFA 已启用。</p>;
    return <>{this.renderStepEnroll()}{this.renderStepSecret()}{this.renderStepConfirm()}</>;
  };

  render() {
    return (
      <div className={styles.securityCenterContainer}>
        <HGCardPage title="绑定 MFA 验证器" className={styles.card}>
          <p className={styles.intro}>
            MFA 为角色授予、授权审批等敏感操作加一道验证，目前不用于登录第二步。需要验证时，请使用验证器 App 生成的六位动态码。
          </p>
          {this.renderMfaSetup()}
          <p className={styles.recoveryLink}>
            {this.state.hgMfaEnabled ? "建议现在设置备用找回方式：" : "绑定完成后，建议前往："}
            <Link to={this.props.hgRecoveryUrl}>恢复邮箱与找回 MFA</Link>
          </p>
        </HGCardPage>
        {this.renderConfirmModal()}
      </div>
    );
  }
}

export default HGSecurityCenterPage;
