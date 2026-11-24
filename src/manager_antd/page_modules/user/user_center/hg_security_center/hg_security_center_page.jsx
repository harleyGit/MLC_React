/*
 * @Description: 个人中心「安全中心 → MFA 动态口令」页面：TOTP 绑定、一次性密钥展示与激活。
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../../components/hg_card/hg_card_page";
import HGInputPage, {
  HGInputPassword,
} from "../../../../../components/hg_input/hg_input_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGSecurityCenterVM from "./hg_security_center_vm";
import styles from "./hg_security_center_page.module.css";

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
  };

  hgMounted = false; // 页面挂载标记，卸载后丢弃异步响应，不写敏感状态。
  hgEnrollFlight = false; // 生成密钥同步锁，与加载态分离，防止连击期间重复提交。
  hgConfirmFlight = false; // 激活同步锁，防止连击期间重复提交同一验证码。

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

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
    HGSecurityCenterVM.enrollMFA(hgPassword)
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
        if (error?.status === 409 && error?.code === HGSecurityCenterVM.hgMfaAlreadyEnabledCode) {
          // 仅后端“因子已启用”专用业务码对应已绑定；普通冲突不能据 HTTP 状态猜测。
          this.setState({
            hgMfaPassword: "",
            hgMfaSecret: "",
            hgMfaUri: "",
            hgMfaConfirmCode: "",
            hgConfirmModalOpen: false,
          });
          message.warning("你已经绑定了 MFA，请使用原验证器的动态码；如已丢失，请联系管理员恢复，勿重复绑定。");
          return;
        }
        if (error?.status === 403) {
          message.warning("密码校验失败、权限不足或 MFA 尝试次数过多，请核实后重试。");
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
    HGSecurityCenterVM.confirmMFA(hgCode)
      .then(() => {
        if (!this.hgMounted) return;
        this.setState({
          hgMfaSecret: "",
          hgMfaUri: "",
          hgMfaConfirmCode: "",
          hgConfirmModalOpen: false,
        });
        message.success("MFA 已启用");
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
          <label className={styles.fieldLabel} htmlFor="hg-security-mfa-password">
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
            <p className={styles.stepPending}>完成前两步生成密钥后，此按钮才可点击。</p>
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
        <label className={styles.fieldLabel} htmlFor="hg-security-mfa-confirm-code">
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

  render() {
    return (
      <div className={styles.securityCenterContainer}>
        <HGCardPage title="MFA 动态口令（TOTP）" className={styles.card}>
          <p className={styles.intro}>
            绑定后，角色授予、授权审批等敏感操作需要额外输入验证器动态码；
            全流程分三步完成，中途可重新生成密钥。
          </p>
          {this.renderStepEnroll()}
          {this.renderStepSecret()}
          {this.renderStepConfirm()}
        </HGCardPage>
        {this.renderConfirmModal()}
      </div>
    );
  }
}

export default HGSecurityCenterPage;
