import React, { Component } from "react";
import { Link } from "react-router-dom";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../../components/hg_card/hg_card_page";
import HGInputPage, { HGInputPassword } from "../../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import { logout } from "../../../../auth/hg_auth";
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

/** 每次打开或关闭重置弹窗时丢弃上次操作的验证码和密码。 */
const hgEmptyReset = () => ({
  hgResetStatus: null, // 弹窗内读取的服务端状态；null 表示还没有可用结果。
  hgResetReady: false, // 已到服务端给出的生效时间；发信和重置仍由后端校验。
  hgResetSent: false, // 本次弹窗已收到发信成功响应，失败时不打开提交权限。
  hgResetPassword: "", // 仅用于重置的当前登录密码；取消或提交后清除。
  hgResetEmailCode: "", // 恢复邮箱中的六位码；不用于激活 MFA。
  hgResetError: "", // 弹窗内显示的最近一次错误；空表示无错误。
});

/**
 * MFA 验证器绑定及重置页。恢复邮箱的设置由独立子页处理。
 * @param {object} props
 * @param {string} props.hgRecoveryUrl 个人中心传入的恢复邮箱子页地址；不传时不显示设置链接。
 */
class HGSecurityCenterPage extends Component {
  static defaultProps = {
    hgRecoveryUrl: undefined, // 恢复邮箱子页 URL；缺省时不显示前往子页的链接。
  };

  state = {
    ...hgEmptyEnrollment(),
    ...hgEmptyReset(),
    hgMfaEnabled: null, // null 表示尚无服务端状态，不能当作未启用。
    hgStatusFailed: false, // 状态读取失败时提供重试。
    hgEnrolling: false, // 生成密钥时禁用提交。
    hgConfirming: false, // 确认动态码时禁止关闭弹窗或重复提交。
    hgResetModalOpen: false, // 用户主动打开后才读取可重置状态，不自动发信。
    hgResetBusy: "", // 空表示空闲；send/reset 对应当前发信或提交按钮的加载状态。
  };

  hgMounted = false; // 离开子页后不再应用异步响应。
  hgPageSession = ""; // 当前账号与会话标识，不保存令牌。
  hgEnrollFlight = false; // 在 React 更新按钮前阻止重复生成。
  hgConfirmFlight = false; // 在 React 更新按钮前阻止重复激活。
  hgResetFlight = false; // 发信与提交共用同步锁，避免在按钮更新前重复请求。
  hgResetRead = 0; // 状态请求序号，关闭弹窗或重试后丢弃旧响应。
  hgResetTimer = null; // 恢复邮箱到达生效时间时更新弹窗，关闭时清除。

  componentDidMount() {
    this.hgMounted = true;
    this.hgPageSession = this.hgSessionIdentity();
    void this.hgLoadMfaStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    clearTimeout(this.hgResetTimer);
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
        message.warning("你已经绑定了 MFA。若验证器丢失，请点击右上角「重置 MFA」。");
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

  /** 打开时读取最新恢复状态；查看弹窗不会触发发信或重置。 */
  hgOpenResetModal = () => {
    if (!this.hgIsCurrent() || this.state.hgResetModalOpen || this.state.hgMfaEnabled !== true || this.state.hgStatusFailed) return;
    this.setState({ ...hgEmptyReset(), hgResetModalOpen: true });
    return this.hgLoadResetStatus();
  };

  /** 关闭未提交的弹窗时清除敏感输入与冷却计时。 */
  hgCloseResetModal = () => {
    if (this.hgResetFlight) return;
    this.hgResetRead++;
    clearTimeout(this.hgResetTimer);
    this.hgResetTimer = null;
    this.setState({ ...hgEmptyReset(), hgResetModalOpen: false });
  };

  /** 获取已验证的恢复邮箱及生效时间；不接收或保存完整邮箱地址。 */
  hgLoadResetStatus = async () => {
    const hgRead = ++this.hgResetRead; // 仅接受本次打开后最近一次读取的结果。
    clearTimeout(this.hgResetTimer);
    this.setState({ hgResetStatus: null, hgResetReady: false, hgResetError: "" });
    try {
      const hgStatus = await HGSecurityCenterVM.recoveryStatus(this.hgRequestOptions());
      if (!this.hgIsCurrent() || hgRead !== this.hgResetRead) return;
      const hgWait = Date.parse(hgStatus.availableAt) - Date.now(); // 毫秒；无有效时间时为 NaN，不开放重置。
      if (hgStatus.mfaEnabled && hgStatus.emailVerified && hgStatus.resetEnabled && !Number.isFinite(hgWait)) {
        throw new Error("无法获取恢复邮箱生效时间，请重试");
      }
      this.setState({ hgResetStatus: hgStatus, hgResetReady: hgWait <= 0 });
      if (hgStatus.mfaEnabled && hgStatus.emailVerified && hgStatus.resetEnabled && hgWait > 0) {
        this.hgResetTimer = setTimeout(() => {
          if (!this.hgIsCurrent() || hgRead !== this.hgResetRead) return;
          if (Date.parse(hgStatus.availableAt) <= Date.now()) this.setState({ hgResetReady: true });
          else void this.hgLoadResetStatus();
        }, Math.min(hgWait, 3_600_000));
      }
    } catch (hgError) {
      if (this.hgIsCurrent() && hgRead === this.hgResetRead) {
        this.setState({ hgResetError: hgError?.message || "无法获取恢复邮箱状态" });
      }
    }
  };

  /** 页面仅控制交互可用性；身份、邮箱和冷却条件由服务端重新验证。 */
  hgResetAvailable = () => {
    const { hgResetStatus, hgResetReady } = this.state; // 尚无服务端状态时不允许发信或提交。
    return !!(hgResetStatus?.mfaEnabled && hgResetStatus.emailVerified && hgResetStatus.resetEnabled && hgResetReady);
  };

  /** 只向服务端指定的恢复邮箱发信，不向接口传收件地址。 */
  hgSendResetCode = async () => {
    if (!this.hgIsCurrent() || !this.state.hgResetModalOpen || this.hgResetFlight || !this.hgResetAvailable()) return;
    this.hgResetFlight = true;
    this.setState({ hgResetBusy: "send", hgResetError: "" });
    try {
      await HGSecurityCenterVM.sendResetCode(this.hgRequestOptions());
      if (this.hgIsCurrent()) this.setState({ hgResetSent: true, hgResetEmailCode: "" });
    } catch (hgError) {
      if (this.hgIsCurrent()) this.setState({ hgResetError: hgError?.message || "发送找回邮件失败，请稍后重试" });
    } finally {
      this.hgResetFlight = false;
      if (this.hgIsCurrent()) this.setState({ hgResetBusy: "" });
    }
  };

  /** 弹窗确认即提交，不再弹二次确认；成功后仅清除原会话并重新登录。 */
  hgResetMFA = async () => {
    const { hgResetModalOpen, hgResetSent, hgResetPassword, hgResetEmailCode } = this.state; // 本次确认的输入快照。
    if (!this.hgIsCurrent() || !hgResetModalOpen || this.hgResetFlight || !this.hgResetAvailable()
      || !hgResetSent || !hgResetPassword || !/^\d{6}$/.test(hgResetEmailCode)) return;
    this.hgResetFlight = true;
    this.setState({ hgResetBusy: "reset", hgResetError: "" });
    try {
      const hgResult = await HGSecurityCenterVM.resetMFA(hgResetPassword, hgResetEmailCode, this.hgRequestOptions()); // 仅接受服务端明确的重登结果。
      if (!hgResult?.reloginRequired) throw new Error("服务端未确认 MFA 已重置，请检查安全中心状态");
      if (this.hgSessionIdentity() !== this.hgPageSession) return;
      if (this.hgMounted) this.setState({ ...hgEmptyReset(), hgResetModalOpen: false, hgResetBusy: "" });
      logout();
      window.location.replace("/login?mfaReset=1");
    } catch (hgError) {
      if (this.hgIsCurrent()) this.setState({ hgResetError: hgError?.message || "MFA 找回失败" });
    } finally {
      this.hgResetFlight = false;
      if (this.hgIsCurrent()) this.setState({ hgResetBusy: "", hgResetPassword: "" });
    }
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

  /** 展示重置前置条件或验证表单；未验证邮箱时仅提供处理提示。 */
  renderResetBody = () => {
    const { hgResetStatus, hgResetError, hgResetBusy, hgResetSent, hgResetEmailCode, hgResetPassword } = this.state; // 仅用于当前弹窗。
    if (!hgResetStatus) return hgResetError ? (
      <p role="alert">{hgResetError} <HGButtonPage type="link" onClick={this.hgLoadResetStatus}>重试</HGButtonPage></p>
    ) : <p role="status">正在读取恢复邮箱状态…</p>;
    if (!hgResetStatus.mfaEnabled) return <p role="status">MFA 尚未启用，无需重置。</p>;
    if (!hgResetStatus.emailVerified) return (
      <p role="status">尚未绑定已验证的恢复邮箱，无法通过邮件自助重置 MFA。如果验证器已丢失，请联系管理员。</p>
    );
    if (!hgResetStatus.resetEnabled) return <p role="status">当前环境暂未开放重置 MFA，请联系管理员。</p>;
    if (!this.hgResetAvailable()) return (
      <p role="status">
        恢复邮箱尚在冷却期。
        {hgResetStatus.availableAt && `请在 ${new Date(hgResetStatus.availableAt).toLocaleString()} 后重试。`}
      </p>
    );
    return (
      <div className={styles.stepBody}>
        <p className={styles.intro}>找回码只会发送到已验证邮箱 {hgResetStatus.emailMasked}，不需要旧验证器的动态码。</p>
        <HGButtonPage onClick={this.hgSendResetCode} disabled={!!hgResetBusy} loading={hgResetBusy === "send"}>发送找回邮件码</HGButtonPage>
        {hgResetSent && <p className={styles.stepDesc} role="status">找回邮件已发送，请查收。</p>}
        <label className={styles.fieldLabel} htmlFor="hg-recovery-reset-code">邮件中的六位验证码</label>
        <HGInputPage id="hg-recovery-reset-code" className={styles.control} value={hgResetEmailCode}
          maxLength={6} autoComplete="one-time-code" inputMode="numeric" disabled={!hgResetSent || !!hgResetBusy}
          onChange={(event) => this.setState({ hgResetEmailCode: event.target.value.replace(/\D/g, "").slice(0, 6) })}
        />
        <label className={styles.fieldLabel} htmlFor="hg-recovery-password">当前登录密码</label>
        <HGInputPassword id="hg-recovery-password" className={styles.control} value={hgResetPassword}
          autoComplete="current-password" disabled={!hgResetSent || !!hgResetBusy}
          onChange={(event) => this.setState({ hgResetPassword: event.target.value })}
        />
        {hgResetError && <p role="alert" className={styles.secretTip}>{hgResetError}</p>}
        <p className={styles.secretTip}>确认后旧验证器和所有旧登录会话将失效。请重新登录并绑定新验证器。</p>
      </div>
    );
  };

  /** 底栏仅保留取消与确认；发信按钮放在正文中。 */
  renderResetModal = () => {
    const { hgResetModalOpen, hgResetBusy, hgResetSent, hgResetPassword, hgResetEmailCode } = this.state; // 提交前须有发信成功记录、密码和六位邮箱码。
    if (!hgResetModalOpen) return null;
    return (
      <HGModalPage visible title="通过恢复邮箱重置 MFA" closable={!hgResetBusy} onClose={this.hgCloseResetModal}
        footer={
          <div className={styles.modalFooter}>
            <HGButtonPage onClick={this.hgCloseResetModal} disabled={!!hgResetBusy}>取消</HGButtonPage>
            <HGButtonPage type="primary" danger onClick={this.hgResetMFA} loading={hgResetBusy === "reset"}
              disabled={!!hgResetBusy || !this.hgResetAvailable() || !hgResetSent || !hgResetPassword || !/^\d{6}$/.test(hgResetEmailCode)}>
              确认
            </HGButtonPage>
          </div>
        }>
        {this.renderResetBody()}
      </HGModalPage>
    );
  };

  /** 保留恢复邮箱子页入口；只有尚未启用的账号才显示绑定步骤。 */
  renderMfaSetup = () => {
    const { hgMfaEnabled, hgStatusFailed } = this.state; // 读取失败和未启用是不同状态。
    if (hgStatusFailed) return (
      <p role="alert">无法获取 MFA 状态。 <HGButtonPage type="link" onClick={this.hgLoadMfaStatus}>重试</HGButtonPage></p>
    );
    if (hgMfaEnabled === null) return <p role="status">正在读取 MFA 状态…</p>;
    if (hgMfaEnabled) return (
      <section className={styles.stepSection}>
        <p role="status">MFA 已启用。</p>
        <p className={styles.stepDesc}>验证器丢失时，点击右上角「重置 MFA」。找回需要已验证且已生效的恢复邮箱。</p>
        {this.props.hgRecoveryUrl && <p className={styles.recoveryLink}><Link to={this.props.hgRecoveryUrl}>设置或更换恢复邮箱</Link></p>}
      </section>
    );
    return (
      <>
        {this.renderStepEnroll()}
        {this.renderStepSecret()}
        {this.renderStepConfirm()}
        {this.props.hgRecoveryUrl && (
          <p className={styles.recoveryLink}>
            绑定完成后，建议前往：<Link to={this.props.hgRecoveryUrl}>恢复邮箱与找回 MFA</Link>
          </p>
        )}
      </>
    );
  };

  render() {
    return (
      <div className={styles.securityCenterContainer}>
        <HGCardPage title="绑定 MFA 验证器" className={styles.card} extra={
          this.state.hgMfaEnabled === true && !this.state.hgStatusFailed
            ? <HGButtonPage danger size="small" onClick={this.hgOpenResetModal}>重置 MFA</HGButtonPage>
            : undefined
        }>
          <p className={styles.intro}>
            MFA 为角色授予、授权审批等敏感操作加一道验证，目前不用于登录第二步。需要验证时，请使用验证器 App 生成的六位动态码。
          </p>
          {this.renderMfaSetup()}
        </HGCardPage>
        {this.renderConfirmModal()}
        {this.renderResetModal()}
      </div>
    );
  }
}

export default HGSecurityCenterPage;
