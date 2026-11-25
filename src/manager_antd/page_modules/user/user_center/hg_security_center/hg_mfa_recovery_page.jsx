/*
 * @Description: 安全中心的恢复邮箱绑定及 MFA 找回页面。
 */
import React, { Component } from "react";
import { Link } from "react-router-dom";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../../components/hg_card/hg_card_page";
import HGInputPage, {
  HGInputPassword,
} from "../../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
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
 * 恢复邮箱页面：绑定、更换及找回指引；敏感输入只保存在当前页面内存。
 * @param {object} props
 * @param {string} props.hgMfaUrl 个人中心传入的 MFA 验证器子页地址；不传时只显示说明。
 */
class HGMFARecoveryPage extends Component {
  static defaultProps = {
    hgMfaUrl: undefined, // 验证器子页 URL；缺省时只显示文字指引，不生成链接。
  };

  state = {
    hgRecoveryStatus: null, // 服务端权威邮箱状态；null 表示未加载，不能推断未绑定。
    hgRecoveryLoadFailed: false, // 状态读失败时显示重试，不无限显示加载中。
    hgRecoveryEmail: "", // 新恢复邮箱；空字符串表示尚未输入。
    hgRecoveryProvider: "", // 收件邮箱类型，空字符串表示尚未选择。
    hgBindSentTo: "", // 最近确认发信的地址；改地址不复用旧验证码。
    hgRecoveryEmailCode: "", // 绑定邮箱的邮件码；只存页面内存，提交后清空。
    hgRecoveryMfaCode: "", // 当前验证器的 TOTP；用于绑定或更换邮箱，提交后清空。
    hgRecoveryBusy: false, // 发信或提交恢复操作进行中；阻止重复请求。
  };

  hgMounted = false; // 页面挂载标记，卸载后丢弃异步响应，不写敏感状态。
  hgRecoveryFlight = false; // 本人恢复邮箱请求锁；卸载后不写页面状态。
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
      if (!this.hgMounted || hgRead !== this.hgRecoveryRead || this.hgSessionIdentity() !== this.hgPageSession) return;
      this.setState({ hgRecoveryStatus: hgStatus });
    } catch (hgError) {
      if (this.hgMounted && hgRead === this.hgRecoveryRead && this.hgSessionIdentity() === this.hgPageSession) {
        this.setState({
          hgRecoveryLoadFailed: true,
          hgRecoveryStatus: null,
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
              {hgStatus.emailVerified
                ? `恢复邮箱已验证（${hgStatus.emailMasked}）`
                : "尚未绑定恢复邮箱"}
            </p>
            {hgStatus.availableAt && (
              <p className={styles.stepDesc}>
                恢复功能生效时间：
                {new Date(hgStatus.availableAt).toLocaleString()}
              </p>
            )}
            {hgStatus.mfaEnabled ? (
              <section className={styles.stepSection}>
                <h3 className={styles.stepTitle}>第一步 · 发送邮箱验证码</h3>
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
                <h3 className={styles.stepTitle}>第二步 · 核对两个验证码</h3>
                <p className={styles.stepDesc}>
                  邮件码在邮箱里查收，MFA 动态码在当前验证器 App
                  里查看；两者不能互换。
                </p>
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
                  当前验证器的六位 MFA 动态码
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
                还不能绑定恢复邮箱。请先
                {this.renderMfaLink("绑定并启用 MFA 验证器")}。
              </p>
            )}
          </>
        )}
      </HGCardPage>
    );
  };

  /** 恢复表单统一由验证器页的弹窗处理，恢复邮箱页保留导航和前置条件说明。 */
  renderRecoveryHelp = () => {
    const { hgRecoveryStatus: hgStatus } = this.state; // 用权威状态区分未启用和未验证邮箱。
    if (!hgStatus?.mfaEnabled) return null;
    return (
      <HGCardPage title="验证器丢失 · 找回 MFA" className={styles.card}>
        <p className={styles.stepDesc}>
          {hgStatus.emailVerified ? (
            <>请前往「{this.renderMfaLink("绑定 MFA 验证器")}」，点击标题右侧的「重置 MFA」。</>
          ) : "此账号尚未绑定已验证的恢复邮箱，不能通过邮件自行重置 MFA。如果验证器已丢失，请联系管理员。"}
        </p>
      </HGCardPage>
    );
  };

  /** 个人中心提供内部导航；缺省地址时只显示文字。 */
  renderMfaLink = (hgLabel) => this.props.hgMfaUrl
    ? <Link to={this.props.hgMfaUrl}>{hgLabel}</Link>
    : hgLabel;

  /** 先区分日常验证与找回，再解释绑定前置条件和重置影响。 */
  renderRecoveryGuide = () => {
    return (
      <HGCardPage title="为什么要绑定恢复邮箱？" className={styles.card}>
        <p className={styles.intro}>
          验证器提供日常敏感操作用的 MFA 动态码；
          <br />
          「验证邮箱并绑定」是把这个邮箱设为当前账号的 MFA 恢复邮箱。
          它不是发送验证码，也不会更改登录邮箱或重置当前 MFA。
          <br />
          绑定邮箱是为了以后可以使用邮箱码找回 MFA，而不需要旧动态码。
        </p>
        <ol className={styles.guideList}>
          <li>
            先{this.renderMfaLink("绑定并启用 MFA 验证器")}
            ，再选择一个自己长期能访问的邮箱。
          </li>
          <li>
            邮箱验证成功、冷却期结束后，如果验证器丢了，你可以登录账号，用当前登录密码
            + 恢复邮箱收到的验证码重置 MFA，不需要旧验证器的动态码。
          </li>
          <li>
            重置会让旧验证器和所有旧登录会话失效。之后重新登录，再绑定一个新验证器。邮箱不能直接替代日常的
            MFA 动态码，也不能单独用于重置。
          </li>
          <li>
            首次绑定或更换邮箱后，需等到页面显示的生效时间才能找回
            MFA（本地调试为 1 分钟，预发和生产为 1 小时）。
          </li>
        </ol>
        <p className={styles.stepDesc}>
          验证器丢失后，先登录，再用当前登录密码和恢复邮箱收到的验证码重置
          MFA，无需旧动态码。
          重置后旧验证器和旧登录会话失效，需要重新登录并绑定新验证器。
        </p>
      </HGCardPage>
    );
  };

  render() {
    return (
      <div className={styles.securityCenterContainer}>
        {this.renderRecoveryHelp()}
        {this.renderRecoveryEmail()}
        {this.renderRecoveryGuide()}
      </div>
    );
  }
}

export default HGMFARecoveryPage;
