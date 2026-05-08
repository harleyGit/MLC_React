import React from "react";
import { handleError } from "../../../../api/HttpManagerV1";
import { LogOut } from "../../../../logger/hg_logger";
import HGVerifyCodeInput from "../../../components/hg_verify_code_input";
import styles from "./hg_account_security_page.module.css";
import HGAccountSecurityPageVM from "./hg_account_security_page_vm";

/**
 * 账号安全页：负责安全项列表、详情页切换、验证码发送和安全项提交。
 */
class HGAccountSecurityPage extends React.Component {
  /**
   * 构造函数：初始化账号安全局部状态和验证码倒计时引用。
   * @param {Object} props 组件属性。
   * 约束：只维护账号安全模块状态，父页面只传入用户资料快照。
   */
  constructor(props) {
    super(props);
    this.state = HGAccountSecurityPageVM.createInitialState(props.userProfile);
    this.countdownTimer = null;
  }

  /**
   * 生命周期更新：父页面异步加载用户资料后，同步安全项绑定状态。
   * @param {Object} prevProps 上一次 props。
   * 约束：正在详情页编辑时不覆盖用户输入，只更新列表展示资料快照。
   */
  componentDidUpdate(prevProps) {
    if (prevProps.userProfile === this.props.userProfile) {
      return;
    }

    this.setState((prevState) => {
      const nextState = {
        userProfile: this.props.userProfile ?? {},
        securityItems: HGAccountSecurityPageVM.buildSecurityItemsFromProfile(
          this.props.userProfile
        ),
      };
      if (!prevState.activeSecurityKey) {
        nextState.securityForm = HGAccountSecurityPageVM.createSecurityForm();
      }
      return nextState;
    });
  }

  /**
   * 生命周期卸载：清理验证码倒计时定时器，避免异步 setState 泄漏。
   */
  componentWillUnmount() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }

  /**
   * 进入指定安全项详情页。
   * @param {string} itemKey 安全项标识（qq/password/phone/email/wechat）。
   * 约束：进入详情页时重置表单和提示，避免跨安全项状态串扰。
   */
  handleSecurityAction = (itemKey) => {
    const securityMeta = HGAccountSecurityPageVM.getSecurityMeta(itemKey);
    if (!securityMeta.title) {
      return;
    }

    this.setState({
      activeSecurityKey: itemKey,
      securityForm: HGAccountSecurityPageVM.createSecurityForm(
        itemKey,
        this.state.userProfile
      ),
      tips: "",
    });
  };

  /**
   * 返回账号安全列表页。
   * 约束：返回时清理详情表单和倒计时，避免旧验证码影响下一次设置。
   */
  handleBackSecurityList = () => {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.setState({
      activeSecurityKey: "",
      securityForm: HGAccountSecurityPageVM.createSecurityForm(),
      codeLoading: false,
      saving: false,
      countdown: 0,
      tips: "",
    });
  };

  /**
   * 更新账号安全详情普通字段。
   * @param {string} fieldName 字段名。
   * @param {string} fieldValue 字段值。
   * 约束：只更新详情表单，不能改动父页面个人资料表单。
   */
  handleSecurityFieldChange = (fieldName, fieldValue) => {
    this.setState((prevState) => {
      return {
        securityForm: {
          ...prevState.securityForm,
          [fieldName]: fieldValue,
        },
      };
    });
  };

  /**
   * 更新验证码字段。
   * @param {string} verificationCode 六位数字验证码。
   * 约束：验证码组件已过滤非数字，这里只同步业务表单值。
   */
  handleVerifyCodeChange = (verificationCode) => {
    this.handleSecurityFieldChange("verificationCode", verificationCode);
  };

  /**
   * 启动验证码倒计时。
   * 约束：新倒计时开始前清理旧定时器，倒计时结束恢复按钮可点击。
   */
  startCountdown = () => {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.setState({ countdown: 60 });
    this.countdownTimer = setInterval(() => {
      this.setState((prevState) => {
        if (prevState.countdown <= 1) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          return { countdown: 0 };
        }
        return { countdown: prevState.countdown - 1 };
      });
    }, 1000);
  };

  /**
   * 获取账号安全验证码。
   * 约束：仅手机号/邮箱需要验证码；发送前先校验目标账号格式。
   */
  handleSendSecurityCode = async () => {
    const { activeSecurityKey, securityForm } = this.state;
    const validateResult = HGAccountSecurityPageVM.validateSecurityTarget(
      activeSecurityKey,
      securityForm
    );
    if (!validateResult.valid) {
      this.setState({ tips: validateResult.message });
      return;
    }

    this.setState({ codeLoading: true, tips: "" });
    try {
      await HGAccountSecurityPageVM.requestSecurityVerifyCode({
        itemKey: activeSecurityKey,
        targetValue: securityForm.targetValue.trim(),
      });
      this.startCountdown();
      this.setState({ tips: "验证码已发送，请注意查收。" });
    } catch (error) {
      handleError(error);
      this.setState({ tips: "验证码发送失败，请稍后重试。" });
    } finally {
      this.setState({ codeLoading: false });
    }
  };

  /**
   * 提交账号安全设置。
   * 约束：先本地校验再调用接口；成功后同步本模块和父页面用户资料快照。
   */
  handleSubmitSecurityForm = async () => {
    const { activeSecurityKey, securityForm, securityItems, userProfile } = this.state;
    const currentSecurityItem = securityItems.find((item) => {
      return item.key === activeSecurityKey;
    });
    const validateResult = HGAccountSecurityPageVM.validateSecuritySubmit(
      activeSecurityKey,
      securityForm,
      Boolean(currentSecurityItem?.bound)
    );
    if (!validateResult.valid) {
      this.setState({ tips: validateResult.message });
      return;
    }

    this.setState({ saving: true, tips: "" });
    try {
      const response = await HGAccountSecurityPageVM.updateAccountSecurity({
        itemKey: activeSecurityKey,
        securityForm,
      });
      LogOut("账号安全设置响应：", response);
      const nextUserProfile = HGAccountSecurityPageVM.buildNextUserProfile(
        userProfile,
        activeSecurityKey,
        securityForm
      );
      this.props.onUserProfileChange?.(nextUserProfile);
      this.setState({
        userProfile: nextUserProfile,
        securityItems: HGAccountSecurityPageVM.buildNextSecurityItems(
          securityItems,
          activeSecurityKey
        ),
        activeSecurityKey: "",
        securityForm: HGAccountSecurityPageVM.createSecurityForm(),
        tips: HGAccountSecurityPageVM.buildSecuritySuccessTip(activeSecurityKey),
      });
    } catch (error) {
      handleError(error);
      this.setState({ tips: "账号安全设置失败，请稍后重试。" });
    } finally {
      this.setState({ saving: false });
    }
  };

  /**
   * 渲染手机号/邮箱验证码区域。
   * @returns {React.ReactNode} 获取验证码按钮和通用验证码输入组件。
   */
  renderCodeSection = () => {
    const { activeSecurityKey, codeLoading, countdown, saving, securityForm } = this.state;
    if (!HGAccountSecurityPageVM.shouldUseVerificationCode(activeSecurityKey)) {
      return null;
    }

    return (
      <div className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <span className={styles.formLabel}>验证码</span>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={codeLoading || countdown > 0 || saving}
            onClick={this.handleSendSecurityCode}
          >
            {countdown > 0
              ? `${countdown}s 后重试`
              : codeLoading
                ? "发送中..."
                : "获取验证码"}
          </button>
        </div>
        <HGVerifyCodeInput
          value={securityForm.verificationCode}
          disabled={saving}
          onChange={this.handleVerifyCodeChange}
        />
      </div>
    );
  };

  /**
   * 渲染密码安全项表单。
   * @param {Object} securityMeta 安全项元信息。
   * @param {boolean} itemBound 当前密码是否已设置。
   * @returns {React.ReactNode} 密码设置表单。
   */
  renderPasswordForm = (securityMeta, itemBound) => {
    const { securityForm, saving } = this.state;
    return (
      <>
        {itemBound ? (
          <label className={styles.formItem}>
            <span className={styles.formLabel}>当前密码</span>
            <input
              type="password"
              className={styles.inputControl}
              value={securityForm.oldPassword}
              disabled={saving}
              placeholder="请输入当前密码"
              onChange={(event) =>
                this.handleSecurityFieldChange("oldPassword", event.target.value)
              }
            />
          </label>
        ) : null}
        <label className={styles.formItem}>
          <span className={styles.formLabel}>{securityMeta.valueLabel}</span>
          <input
            type="password"
            className={styles.inputControl}
            value={securityForm.passwordValue}
            disabled={saving}
            placeholder={securityMeta.placeholder}
            onChange={(event) =>
              this.handleSecurityFieldChange("passwordValue", event.target.value)
            }
          />
        </label>
        <label className={styles.formItem}>
          <span className={styles.formLabel}>确认新密码</span>
          <input
            type="password"
            className={styles.inputControl}
            value={securityForm.confirmPassword}
            disabled={saving}
            placeholder="请再次输入新密码"
            onChange={(event) =>
              this.handleSecurityFieldChange("confirmPassword", event.target.value)
            }
          />
        </label>
      </>
    );
  };

  /**
   * 渲染非密码安全项表单。
   * @param {Object} securityMeta 安全项元信息。
   * @returns {React.ReactNode} QQ、手机、邮箱、微信表单。
   */
  renderAccountForm = (securityMeta) => {
    const { securityForm, saving } = this.state;
    return (
      <>
        {securityForm.currentValueText ? (
          <div className={styles.currentValue}>
            当前{securityMeta.valueLabel}：{securityForm.currentValueText}
          </div>
        ) : null}
        <label className={styles.formItem}>
          <span className={styles.formLabel}>{securityMeta.valueLabel}</span>
          <input
            className={styles.inputControl}
            value={securityForm.targetValue}
            disabled={saving}
            placeholder={securityMeta.placeholder}
            onChange={(event) =>
              this.handleSecurityFieldChange("targetValue", event.target.value)
            }
          />
        </label>
        {this.renderCodeSection()}
      </>
    );
  };

  /**
   * 渲染账号安全详情页。
   * @returns {React.ReactNode} 单个安全项设置页面。
   */
  renderDetailContent = () => {
    const { activeSecurityKey, securityItems, saving } = this.state;
    const securityMeta = HGAccountSecurityPageVM.getSecurityMeta(activeSecurityKey);
    const currentSecurityItem = securityItems.find((item) => {
      return item.key === activeSecurityKey;
    });
    const itemBound = Boolean(currentSecurityItem?.bound);

    return (
      <section className={styles.contentBlock}>
        <button
          type="button"
          className={styles.backButton}
          onClick={this.handleBackSecurityList}
        >
          返回账号安全
        </button>
        <h3 className={styles.contentTitle}>{securityMeta.detailTitle}</h3>
        <p className={styles.detailDesc}>{securityMeta.desc}</p>
        {activeSecurityKey === "password"
          ? this.renderPasswordForm(securityMeta, itemBound)
          : this.renderAccountForm(securityMeta)}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={saving}
          onClick={this.handleSubmitSecurityForm}
        >
          {saving ? "设置中..." : "设置"}
        </button>
      </section>
    );
  };

  /**
   * 渲染账号安全列表页。
   * @returns {React.ReactNode} 安全项列表。
   */
  renderListContent = () => {
    const securityViewItems = HGAccountSecurityPageVM.buildSecurityViewItems(
      this.state.securityItems,
      this.state.userProfile
    );

    return (
      <section className={styles.contentBlock}>
        <h3 className={styles.contentTitle}>账号安全</h3>
        <div className={styles.securityList}>
          {securityViewItems.map((securityItem) => {
            return (
              <div key={securityItem.key} className={styles.securityRow}>
                <div className={styles.securityName}>{securityItem.title}</div>
                <div className={styles.securityDesc}>{securityItem.desc}</div>
                <div
                  className={`${styles.securityStatus} ${
                    securityItem.bound ? styles.statusBound : styles.statusUnbound
                  }`}
                >
                  {securityItem.statusText}
                </div>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => this.handleSecurityAction(securityItem.key)}
                >
                  {securityItem.actionText}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  /**
   * 渲染账号安全模块根节点。
   * @returns {React.ReactNode} 账号安全模块内容。
   */
  render() {
    const { activeSecurityKey, tips } = this.state;
    return (
      <>
        {tips ? <div className={styles.operationTips}>{tips}</div> : null}
        {activeSecurityKey ? this.renderDetailContent() : this.renderListContent()}
      </>
    );
  }
}

export default HGAccountSecurityPage;
