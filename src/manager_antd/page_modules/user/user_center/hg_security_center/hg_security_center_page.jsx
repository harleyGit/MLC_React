/*
 * @Description: 个人中心「安全中心 → MFA 动态口令」页面：TOTP 绑定、一次性密钥展示与激活。
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../../components/hg_card/hg_card_page";
import HGInputPage, {
  HGInputPassword,
} from "../../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import { logout } from "../../../../auth/hg_auth";
import { hgIMOwner, hgIMSessionID } from "../../../../storage/hg_im_session";
import styles from "./hg_security_center_page.module.css";
import HGSecurityCenterVM from "./hg_security_center_vm";

// 仅用于收件地址交互；自定义域名使用“其他”，不将供应商选项发给后端。
const HG_RECOVERY_MAIL_PROVIDERS = [
  {
    value: "icloud",
    label: "iCloud",
    domains: ["icloud.com", "me.com", "mac.com"],
  },
  { value: "gmail", label: "Gmail", domains: ["gmail.com", "googlemail.com"] },
  {
    value: "qq",
    label: "QQ 邮箱",
    domains: ["qq.com", "vip.qq.com", "foxmail.com"],
  },
  { value: "other", label: "其他邮箱", domains: [] },
];

/**
 * 安全中心页面（MFA 动态口令）。
 * 职责：按「密码复核 → 添加验证器 → 确认激活」三步引导绑定管理员 TOTP。
 * 约束：全部操作由用户显式点击触发；一次性密钥不持久化，激活后立即清除。
 */
class HGSecurityCenterPage extends Component {
  state = {
    hgMfaPassword: "", // 当前登录密码；仅用于生成绑定密钥的请求，空字符串表示未输入，生成后立即清空。
    hgMfaSecret: "", // 服务端返回的一次性 TOTP 绑定密钥；空字符串表示尚未生成或已清除，激活成功后清空。
    hgMfaUri: "", // 服务端返回的 otpauth 绑定 URI；与密钥同生命周期，激活或重新生成时清空。
    hgMfaConfirmCode: "", // 验证器生成的 6 位动态码；仅在激活弹窗内编辑，取消或激活成功后清空，不回填。
    hgConfirmModalOpen: false, // 激活确认弹窗开关；true 表示正在弹窗中录入动态码。
    hgEnrolling: false, // 生成绑定密钥请求进行中；true 时禁用生成按钮。
    hgConfirming: false, // 激活 MFA 请求进行中；true 时禁用激活按钮。
    hgRecoveryStatus: null, // 服务端权威邮箱状态；null 表示未加载，不能推断未绑定。
    hgRecoveryLoadFailed: false, // 状态读失败时显示重试，不无限显示加载中。
    hgRecoveryReady: false, // 恢复邮箱冷却期结束后才显示可发送；后端仍独立验证。
    hgRecoveryEmail: "", // 新恢复邮箱；空字符串表示尚未输入。
    hgRecoveryProvider: "", // 收件邮箱类型，空字符串表示尚未选择。
    hgBindSentTo: "", // 最近确认发信的地址；改地址不复用旧验证码。
    hgResetSent: false, // 本次页面已确认发送找回码；刷新页面可以重新发送。
    hgRecoveryEmailCode: "", // 绑定邮箱的邮件码；只存页面内存，提交后清空。
    hgRecoveryMfaCode: "", // 当前验证器的 TOTP；用于绑定或更换邮箱，提交后清空。
    hgResetPassword: "", // 当前登录密码，仅用于找回 MFA 时复核，提交后清空。
    hgResetEmailCode: "", // 已验证恢复邮箱的邮件码；不与绑定邮箱码共用。
    hgRecoveryBusy: false, // 发信或提交恢复操作进行中；阻止重复请求。
  };

  hgMounted = false; // 页面挂载标记，卸载后丢弃异步响应，不写敏感状态。
  hgEnrollFlight = false; // 生成密钥同步锁，与加载态分离，防止连击期间重复提交。
  hgConfirmFlight = false; // 激活同步锁，防止连击期间重复提交同一验证码。
  hgRecoveryFlight = false; // 本人恢复邮箱请求锁；卸载后不写页面状态。
  hgRecoveryTimer = null; // 冷却结束时唤醒界面，离开页面后清理。
  hgRecoveryRead = 0; // 仅应用最近一次状态响应。
  hgPageSession = ""; // 账号与会话身份快照；续签不更换 sid。

  componentDidMount() {
    this.hgMounted = true;
    this.hgPageSession = this.hgSessionIdentity();
    this.hgLoadRecoveryStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRecoveryRead++;
    clearTimeout(this.hgRecoveryTimer);
  }

  /** 不持有令牌原值；账号切换后不发出旧请求、也不清理新会话。 */
  hgSessionIdentity = () => `${hgIMOwner()}:${hgIMSessionID()}`;

  hgRequestOptions = () => ({
    validateRequest: () => {
      if (
        !this.hgPageSession ||
        this.hgSessionIdentity() !== this.hgPageSession
      ) {
        throw new Error("当前登录会话已变化");
      }
    },
  });

  /** 从服务端加载本人已验证邮箱状态，不将邮箱地址或验证码存入浏览器持久化空间。 */
  hgLoadRecoveryStatus = async () => {
    const hgRead = ++this.hgRecoveryRead; // 阻止乱序响应覆盖新邮箱状态。
    this.setState({ hgRecoveryLoadFailed: false });
    try {
      const hgStatus = await HGSecurityCenterVM.recoveryStatus(
        this.hgRequestOptions()
      );
      if (!this.hgMounted || hgRead !== this.hgRecoveryRead) return;
      clearTimeout(this.hgRecoveryTimer);
      const hgWait = hgStatus.availableAt
        ? Date.parse(hgStatus.availableAt) - Date.now()
        : NaN; // 冷却剩余毫秒；未绑定时为 NaN。
      this.setState({
        hgRecoveryStatus: hgStatus,
        hgRecoveryReady: hgWait <= 0,
      });
      if (hgWait > 0) {
        this.hgRecoveryTimer = setTimeout(() => {
          if (
            !this.hgMounted ||
            this.hgSessionIdentity() !== this.hgPageSession
          )
            return;
          if (hgWait <= 3_600_000) this.setState({ hgRecoveryReady: true });
          else void this.hgLoadRecoveryStatus();
        }, Math.min(hgWait, 3_600_000));
      }
    } catch (hgError) {
      if (this.hgMounted && hgRead === this.hgRecoveryRead) {
        clearTimeout(this.hgRecoveryTimer);
        this.setState({
          hgRecoveryLoadFailed: true,
          hgRecoveryStatus: null,
          hgRecoveryReady: false,
        });
        message.error(hgError?.message || "无法获取恢复邮箱状态");
      }
    }
  };

  /** 所有发信/提交串行化；保留失败输入方便纠正，成功后清空验证码与密码。 */
  hgRecoveryAction = async (hgCall, hgSuccess, hgClear, hgReload = false) => {
    if (this.hgRecoveryFlight) return;
    this.hgRecoveryFlight = true;
    this.setState({ hgRecoveryBusy: true });
    try {
      await hgCall();
      if (!this.hgMounted) return;
      this.setState(hgClear);
      message.success(hgSuccess);
      if (hgReload) await this.hgLoadRecoveryStatus();
    } catch (hgError) {
      if (this.hgMounted)
        message.error(hgError?.message || "操作失败，请稍后重试");
    } finally {
      this.hgRecoveryFlight = false;
      if (this.hgMounted) this.setState({ hgRecoveryBusy: false });
    }
  };

  /** MFA 丢失后只能发送到已验证且冷却期结束的邮箱，不允许客户端指定目的地址。 */
  hgSendResetCode = () =>
    this.hgRecoveryAction(
      () => HGSecurityCenterVM.sendResetCode(this.hgRequestOptions()),
      "找回邮件已发送，请查看已绑定邮箱",
      { hgResetSent: true, hgResetEmailCode: "" }
    );

  /** 新地址与上次已发送地址不同时，不使用之前的邮件码。 */
  hgSetRecoveryAddress = (event) =>
    this.setState({
      hgRecoveryEmail: event.target.value,
      hgBindSentTo: "",
      hgRecoveryEmailCode: "",
      hgRecoveryMfaCode: "",
    });

  /** 更换收件邮箱类型时丢弃旧地址和验证码，不把旧邮件码用于新的邮箱。 */
  hgSetRecoveryProvider = (event) =>
    this.setState({
      hgRecoveryProvider: event.target.value,
      hgRecoveryEmail: "",
      hgBindSentTo: "",
      hgRecoveryEmailCode: "",
      hgRecoveryMfaCode: "",
    });

  /** 邮箱码与密码由服务端在重置事务前核验；成功立即清理本地会话，不用旧 JWT 续签。 */
  hgResetMFA = async () => {
    if (this.hgRecoveryFlight) return;
    const { hgResetPassword, hgResetEmailCode } = this.state; // 点击时的敏感输入快照。
    if (
      !this.state.hgResetSent ||
      !hgResetPassword ||
      !/^\d{6}$/.test(hgResetEmailCode)
    )
      return;
    if (!window.confirm("重置 MFA 会让所有旧设备退出登录。是否继续？")) return;
    this.hgRecoveryFlight = true;
    this.setState({ hgRecoveryBusy: true });
    try {
      const hgResult = await HGSecurityCenterVM.resetMFA(
        hgResetPassword,
        hgResetEmailCode,
        this.hgRequestOptions()
      );
      if (!hgResult?.reloginRequired)
        throw new Error("服务端未确认 MFA 已重置，请检查安全中心状态");
      if (this.hgSessionIdentity() !== this.hgPageSession) return;
      logout();
      window.location.replace("/login?mfaReset=1");
    } catch (hgError) {
      if (this.hgMounted) message.error(hgError?.message || "MFA 找回失败");
    } finally {
      this.hgRecoveryFlight = false;
      if (this.hgMounted)
        this.setState({ hgRecoveryBusy: false, hgResetPassword: "" });
    }
  };

  /** 更新登录密码输入；仅维护受控字段，不触发任何请求。 */
  hgSetPassword = (event) => {
    this.setState({ hgMfaPassword: event.target.value });
  };

  /** 更新激活动态码；仅保留数字并截断为 6 位，避免提交非数字内容。 */
  hgSetConfirmCode = (event) => {
    const hgCode = String(event.target.value || "")
      .replace(/\D/g, "")
      .slice(0, 6); // 过滤后的展示值；长度不足 6 时激活按钮保持禁用。
    this.setState({ hgMfaConfirmCode: hgCode });
  };

  /** 打开激活确认弹窗；仅在已生成密钥后由第三步按钮触发，打开时不发请求。 */
  hgOpenConfirmModal = () => {
    this.setState({ hgConfirmModalOpen: true });
  };

  /** 取消或关闭激活弹窗；动态码为一次性敏感输入，关闭时立即清空。 */
  hgCloseConfirmModal = () => {
    if (this.hgConfirmFlight) return; // 请求进行中不允许关闭，避免状态与请求脱节。
    this.setState({ hgConfirmModalOpen: false, hgMfaConfirmCode: "" });
  };

  /** 密码复核通过后获取一次性 TOTP 绑定密钥；响应与页面均不持久化密钥。 */
  hgEnrollMFA = () => {
    if (this.hgEnrollFlight) return;
    const hgPassword = this.state.hgMfaPassword; // 点击时的密码快照，异步期间输入变化不影响本次请求。
    if (!hgPassword) {
      message.error("请输入当前登录密码");
      return;
    }
    this.hgEnrollFlight = true;
    this.setState({ hgEnrolling: true });
    HGSecurityCenterVM.enrollMFA(hgPassword, this.hgRequestOptions())
      .then((result) => {
        if (!this.hgMounted) return;
        this.setState({
          hgMfaSecret: result?.secret || "",
          hgMfaUri: result?.otpauthUri || "",
          hgMfaPassword: "",
        });
      })
      .catch((error) => {
        if (!this.hgMounted) return;
        if (
          error?.status === 409 &&
          error?.code === HGSecurityCenterVM.hgMfaAlreadyEnabledCode
        ) {
          // 仅后端“因子已启用”专用业务码对应已绑定；普通冲突不能据 HTTP 状态猜测。
          this.setState({
            hgMfaPassword: "",
            hgMfaSecret: "",
            hgMfaUri: "",
            hgMfaConfirmCode: "",
            hgConfirmModalOpen: false,
          });
          message.warning(
            "你已经绑定了 MFA。若验证器丢失，请使用下方已验证恢复邮箱找回。"
          );
          return;
        }
        if (error?.status === 403) {
          message.warning(
            "密码校验失败、权限不足或 MFA 尝试次数过多，请核实后重试。"
          );
          return;
        }
        if (error?.status === 429) {
          message.warning("操作过于频繁，请稍后再试。");
          return;
        }
        if (error?.status === 503) {
          message.error("MFA 服务暂不可用，请稍后再试。");
          return;
        }
        message.error(error?.message || "MFA 绑定失败");
      })
      .finally(() => {
        this.hgEnrollFlight = false;
        if (this.hgMounted) this.setState({ hgEnrolling: false });
      });
  };

  /** 使用验证器 6 位动态码激活 MFA；成功后立即清除页面中的明文密钥与验证码。 */
  hgConfirmMFA = () => {
    if (this.hgConfirmFlight) return;
    const hgCode = this.state.hgMfaConfirmCode; // 点击时的动态码快照，仅本次请求使用。
    if (!/^\d{6}$/.test(hgCode)) {
      message.error("请从验证器输入 6 位动态码（不是短信验证码）");
      return;
    }
    this.hgConfirmFlight = true;
    this.setState({ hgConfirming: true });
    HGSecurityCenterVM.confirmMFA(hgCode, this.hgRequestOptions())
      .then(() => {
        if (!this.hgMounted) return;
        this.setState({
          hgMfaSecret: "",
          hgMfaUri: "",
          hgMfaConfirmCode: "",
          hgConfirmModalOpen: false,
        });
        message.success("MFA 已启用");
        void this.hgLoadRecoveryStatus();
      })
      .catch((error) => {
        if (this.hgMounted) message.error(error?.message || "MFA 验证失败");
      })
      .finally(() => {
        this.hgConfirmFlight = false;
        if (this.hgMounted) this.setState({ hgConfirming: false });
      });
  };

  /** 复制一次性密钥或绑定 URI；剪贴板不可用时如实提示，不静默失败。 */
  hgCopyText = async (hgText, hgLabel) => {
    try {
      await navigator.clipboard.writeText(hgText);
      message.success(`${hgLabel}已复制`);
    } catch {
      message.error(`${hgLabel}复制失败，请手动选择复制`);
    }
  };

  /** 第一步：密码复核表单；密码非空才允许生成，生成期间按钮加载中。 */
  renderStepEnroll = () => {
    const { hgMfaPassword, hgEnrolling, hgMfaSecret } = this.state;
    return (
      <section className={styles.stepSection}>
        <h3 className={styles.stepTitle}>第一步 · 复核登录密码</h3>
        <p className={styles.stepDesc}>
          输入当前登录密码生成绑定密钥；密码仅在本次请求中复核，页面不保存。
        </p>
        <div className={styles.stepBody}>
          <label
            className={styles.fieldLabel}
            htmlFor="hg-security-mfa-password"
          >
            当前登录密码
          </label>
          <HGInputPassword
            id="hg-security-mfa-password"
            value={hgMfaPassword}
            onChange={this.hgSetPassword}
            placeholder="请输入当前登录密码"
            autoComplete="current-password"
            className={styles.control}
          />
          <HGButtonPage
            type="primary"
            onClick={this.hgEnrollMFA}
            loading={hgEnrolling}
            disabled={!hgMfaPassword || hgEnrolling}
          >
            {hgMfaSecret ? "重新生成绑定密钥" : "生成绑定密钥"}
          </HGButtonPage>
        </div>
      </section>
    );
  };

  /** 第二步：一次性密钥与绑定 URI 展示；未生成时仅显示引导文案。 */
  renderStepSecret = () => {
    const { hgMfaSecret, hgMfaUri } = this.state;
    return (
      <section className={styles.stepSection}>
        <h3 className={styles.stepTitle}>第二步 · 添加验证器</h3>
        <p className={styles.stepDesc}>
          将密钥或绑定 URI 添加到支持 TOTP 的验证器（如 Google
          身份验证器）。动态码由验证器生成，服务端不会提供获取动态码的接口。
        </p>
        {hgMfaSecret ? (
          <div className={styles.stepBody}>
            <div className={styles.secretRow}>
              <span className={styles.fieldLabel}>一次性密钥</span>
              <code className={styles.codeBlock}>{hgMfaSecret}</code>
              <HGButtonPage
                type="link"
                onClick={() => this.hgCopyText(hgMfaSecret, "一次性密钥")}
              >
                复制
              </HGButtonPage>
            </div>
            <div className={styles.secretRow}>
              <span className={styles.fieldLabel}>绑定 URI</span>
              <code className={styles.codeBlock}>{hgMfaUri}</code>
              <HGButtonPage
                type="link"
                onClick={() => this.hgCopyText(hgMfaUri, "绑定 URI")}
              >
                复制
              </HGButtonPage>
            </div>
            <p className={styles.secretTip} role="note">
              密钥仅本次展示，离开或激活后无法再次查看；请先复制到验证器再继续。
            </p>
          </div>
        ) : (
          <p className={styles.stepPending}>完成第一步后在此展示一次性密钥。</p>
        )}
      </section>
    );
  };

  /** 第三步：激活入口；按钮始终展示，未生成密钥时禁用，动态码在确认弹窗中录入。 */
  renderStepConfirm = () => {
    const { hgMfaSecret } = this.state;
    return (
      <section className={styles.stepSection}>
        <h3 className={styles.stepTitle}>第三步 · 确认激活</h3>
        <p className={styles.stepDesc}>
          点击下方按钮，在弹窗中输入验证器【Google Authenticator（Google
          身份验证器）】显示的 6 位动态码（非短信验证码）完成绑定。
        </p>
        <div className={styles.stepBody}>
          <HGButtonPage
            type="primary"
            onClick={this.hgOpenConfirmModal}
            disabled={!hgMfaSecret}
          >
            输入动态码并激活
          </HGButtonPage>
          {!hgMfaSecret && (
            <p className={styles.stepPending}>
              完成前两步生成密钥后，此按钮才可点击。
            </p>
          )}
        </div>
      </section>
    );
  };

  /**
   * 激活确认弹窗：录入 6 位动态码并提供确认/取消；
   * 请求进行中不可关闭，取消时清空动态码。
   */
  renderConfirmModal = () => {
    const { hgMfaConfirmCode, hgConfirming, hgConfirmModalOpen } = this.state;
    return (
      <HGModalPage
        visible={hgConfirmModalOpen}
        title="确认激活 MFA"
        closable={!hgConfirming}
        onClose={this.hgCloseConfirmModal}
        footer={
          <div className={styles.modalFooter}>
            <HGButtonPage
              onClick={this.hgCloseConfirmModal}
              disabled={hgConfirming}
            >
              取消
            </HGButtonPage>
            <HGButtonPage
              type="primary"
              onClick={this.hgConfirmMFA}
              loading={hgConfirming}
              disabled={!/^\d{6}$/.test(hgMfaConfirmCode) || hgConfirming}
            >
              确认并启用
            </HGButtonPage>
          </div>
        }
      >
        <p className={styles.modalHint}>
          请输入验证器当前显示的 6 位动态码（不是短信验证码）；验证成功后 MFA
          立即启用，一次性密钥同时失效。
        </p>
        <label
          className={styles.fieldLabel}
          htmlFor="hg-security-mfa-confirm-code"
        >
          验证器 6 位动态码
        </label>
        <HGInputPage
          id="hg-security-mfa-confirm-code"
          value={hgMfaConfirmCode}
          onChange={this.hgSetConfirmCode}
          placeholder="输入验证器中的 6 位动态码"
          autoComplete="one-time-code"
          maxLength={6}
          allowClear
          disabled={hgConfirming}
          className={styles.control}
        />
      </HGModalPage>
    );
  };

  /** 恢复邮箱状态与绑定表单；已绑定时可使用当前 MFA 更换，生效时间由服务端决定。 */
  renderRecoveryEmail = () => {
    const {
      hgRecoveryStatus: hgStatus,
      hgRecoveryEmail: hgEmail,
      hgRecoveryEmailCode: hgCode,
      hgRecoveryMfaCode: hgMfa,
      hgRecoveryBusy: hgBusy,
      hgBindSentTo,
      hgRecoveryLoadFailed,
      hgRecoveryProvider,
    } = this.state;
    const hgProvider = HG_RECOVERY_MAIL_PROVIDERS.find(
      ({ value }) => value === hgRecoveryProvider
    ); // 找不到时禁止填写与发送。
    const hgAddress = hgEmail.trim(); // 页面仅做基础输入提示，服务端规范化和验证地址。
    const hgValidAddress =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hgAddress) && hgAddress.length <= 254;
    const hgDomain = hgAddress.split("@")[1]?.toLowerCase(); // 域名大小写不影响邮箱类型校验。
    const hgDomainMatches =
      hgProvider &&
      (!hgProvider.domains.length || hgProvider.domains.includes(hgDomain));
    const hgCanSend = hgValidAddress && !!hgDomainMatches; // 不允许选错邮箱类型后误发。
    const hgCanBind =
      hgCanSend &&
      hgBindSentTo === hgAddress &&
      /^\d{6}$/.test(hgCode) &&
      /^\d{6}$/.test(hgMfa);
    return (
      <HGCardPage title="恢复邮箱" className={styles.card}>
        <p className={styles.intro}>
          支持 Gmail、iCloud、QQ 等邮箱。绑定或更换须验证邮箱码和当前 MFA
          动态码，不会更改登录邮箱。
        </p>
        {hgRecoveryLoadFailed ? (
          <p role="alert">
            无法获取恢复邮箱状态。{" "}
            <HGButtonPage type="link" onClick={this.hgLoadRecoveryStatus}>
              重试
            </HGButtonPage>
          </p>
        ) : hgStatus === null ? (
          <p role="status">正在读取恢复邮箱状态…</p>
        ) : (
          <>
            <p role="status">
              状态：
              {hgStatus.emailVerified
                ? `已验证（${hgStatus.emailMasked}）`
                : "未绑定已验证邮箱"}
            </p>
            {hgStatus.availableAt && (
              <p className={styles.stepDesc}>
                恢复功能生效时间：
                {new Date(hgStatus.availableAt).toLocaleString()}
              </p>
            )}
            {hgStatus.mfaEnabled ? (
              <section className={styles.stepSection}>
                <label
                  className={styles.fieldLabel}
                  htmlFor="hg-recovery-provider"
                >
                  收件邮箱类型
                </label>
                <select
                  id="hg-recovery-provider"
                  className={`${styles.control} ${styles.mailProvider}`}
                  value={hgRecoveryProvider}
                  onChange={this.hgSetRecoveryProvider}
                  disabled={hgBusy}
                >
                  <option value="" disabled>
                    请选择邮箱类型
                  </option>
                  {HG_RECOVERY_MAIL_PROVIDERS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label
                  className={styles.fieldLabel}
                  htmlFor="hg-recovery-email"
                >
                  新恢复邮箱
                </label>
                <HGInputPage
                  id="hg-recovery-email"
                  type="email"
                  className={styles.control}
                  value={hgEmail}
                  onChange={this.hgSetRecoveryAddress}
                  autoComplete="email"
                  maxLength={254}
                  disabled={!hgProvider || hgBusy}
                  placeholder={
                    hgProvider?.domains.length
                      ? `例如 name@${hgProvider.domains[0]}`
                      : "请输入完整邮箱地址"
                  }
                />
                {hgProvider && hgValidAddress && !hgDomainMatches && (
                  <p className={styles.stepDesc} role="status">
                    邮箱后缀与所选类型不符，可切换为正确类型或选择「其他邮箱」。
                  </p>
                )}
                <HGButtonPage
                  disabled={!hgCanSend || hgBusy}
                  loading={hgBusy}
                  onClick={() =>
                    this.hgRecoveryAction(
                      () =>
                        HGSecurityCenterVM.sendBindCode(
                          hgAddress,
                          this.hgRequestOptions()
                        ),
                      "验证码已发送，请手动输入邮件码",
                      { hgBindSentTo: hgAddress, hgRecoveryEmailCode: "" }
                    )
                  }
                >
                  发送邮箱验证码
                </HGButtonPage>
                <label
                  className={styles.fieldLabel}
                  htmlFor="hg-recovery-bind-code"
                >
                  邮件中的六位验证码
                </label>
                <HGInputPage
                  id="hg-recovery-bind-code"
                  className={styles.control}
                  value={hgCode}
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={!hgBindSentTo || hgBusy}
                  onChange={(event) =>
                    this.setState({
                      hgRecoveryEmailCode: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    })
                  }
                />
                <label
                  className={styles.fieldLabel}
                  htmlFor="hg-recovery-bind-mfa"
                >
                  当前 MFA 六位动态码
                </label>
                <HGInputPage
                  id="hg-recovery-bind-mfa"
                  className={styles.control}
                  value={hgMfa}
                  maxLength={6}
                  autoComplete="off"
                  inputMode="numeric"
                  disabled={!hgBindSentTo || hgBusy}
                  onChange={(event) =>
                    this.setState({
                      hgRecoveryMfaCode: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    })
                  }
                />
                <HGButtonPage
                  type="primary"
                  disabled={!hgCanBind || hgBusy}
                  loading={hgBusy}
                  onClick={() =>
                    this.hgRecoveryAction(
                      () =>
                        HGSecurityCenterVM.bindRecovery(
                          hgAddress,
                          hgCode,
                          hgMfa,
                          this.hgRequestOptions()
                        ),
                      "恢复邮箱已验证",
                      {
                        hgRecoveryEmail: "",
                        hgBindSentTo: "",
                        hgRecoveryEmailCode: "",
                        hgRecoveryMfaCode: "",
                        hgResetSent: false,
                        hgResetEmailCode: "",
                        hgResetPassword: "",
                      },
                      true
                    )
                  }
                >
                  验证邮箱并绑定
                </HGButtonPage>
              </section>
            ) : (
              <p className={styles.stepDesc}>
                先绑定并启用 MFA，再设置恢复邮箱。
              </p>
            )}
          </>
        )}
      </HGCardPage>
    );
  };

  /** 找回表单不要求已丢失的 MFA，但必须密码加已验证邮箱码，成功后全部旧会话下线。 */
  renderRecoveryReset = () => {
    const {
      hgRecoveryStatus: hgStatus,
      hgResetPassword,
      hgResetEmailCode,
      hgRecoveryBusy: hgBusy,
      hgRecoveryReady,
      hgResetSent,
    } = this.state;
    if (!hgStatus?.mfaEnabled || !hgStatus.emailVerified) return null;
    const hgReady = hgStatus.resetEnabled && hgRecoveryReady; // 部署已开放且过了冷却期。
    return (
      <HGCardPage title="验证器丢失 · 找回 MFA" className={styles.card}>
        <p className={styles.intro}>
          找回邮件只发送到已验证邮箱 {hgStatus.emailMasked}
          。找回后旧会话全部失效，须重新登录并绑定新验证器。
        </p>
        {!hgStatus.resetEnabled ? (
          <p role="status">当前环境暂未开放找回 MFA，请联系管理员。</p>
        ) : (
          !hgReady && (
            <p role="status">恢复能力尚在冷却期，请等待生效时间后操作。</p>
          )
        )}
        <section className={styles.stepSection}>
          <HGButtonPage
            disabled={!hgReady || hgBusy}
            loading={hgBusy}
            onClick={this.hgSendResetCode}
          >
            发送找回邮件码
          </HGButtonPage>
          <label className={styles.fieldLabel} htmlFor="hg-recovery-reset-code">
            邮件中的六位验证码
          </label>
          <HGInputPage
            id="hg-recovery-reset-code"
            className={styles.control}
            value={hgResetEmailCode}
            maxLength={6}
            autoComplete="one-time-code"
            inputMode="numeric"
            disabled={!hgResetSent || hgBusy}
            onChange={(event) =>
              this.setState({
                hgResetEmailCode: event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6),
              })
            }
          />
          <label className={styles.fieldLabel} htmlFor="hg-recovery-password">
            当前登录密码
          </label>
          <HGInputPassword
            id="hg-recovery-password"
            className={styles.control}
            value={hgResetPassword}
            autoComplete="current-password"
            disabled={!hgResetSent || hgBusy}
            onChange={(event) =>
              this.setState({ hgResetPassword: event.target.value })
            }
          />
          <HGButtonPage
            danger
            loading={hgBusy}
            disabled={
              !hgReady ||
              !hgResetSent ||
              !hgResetPassword ||
              !/^\d{6}$/.test(hgResetEmailCode) ||
              hgBusy
            }
            onClick={this.hgResetMFA}
          >
            验证并重置 MFA
          </HGButtonPage>
        </section>
      </HGCardPage>
    );
  };

  render() {
    return (
      <div className={styles.securityCenterContainer}>
        <HGCardPage title="MFA 动态口令（TOTP）" className={styles.card}>
          <p className={styles.intro}>
            绑定后，角色授予、授权审批等敏感操作需要额外输入验证器动态码； MFA
            目前不作为登录的第二步验证。绑定后可设置恢复邮箱。
          </p>
          {this.state.hgRecoveryStatus?.mfaEnabled ? (
            <p role="status">MFA 已启用</p>
          ) : (
            <>
              {this.renderStepEnroll()}
              {this.renderStepSecret()}
              {this.renderStepConfirm()}
            </>
          )}
        </HGCardPage>
        {this.renderRecoveryEmail()}
        {this.renderRecoveryReset()}
        {this.renderConfirmModal()}
      </div>
    );
  }
}

export default HGSecurityCenterPage;
