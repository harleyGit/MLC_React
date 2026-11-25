/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:30:41
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:47:56
 * @FilePath: /MLC_React/src/manager_antd/login_module/hg_ register_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
// import { handleError } from "../../api/HttpManagerV1";
import { handleError } from "../../../api/HttpManagerV1";
import { showSuccess } from "../../../api/hg_ui_feedback";
import { LogError } from "../../../logger/hg_logger";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import HGLoginVM, { HGRegisterType } from "./hg_login_vm";
import styles from "./hg_register.module.css";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputPassword } from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import HGClickCaptchaPage from "../../../components/hg_click_captcha/hg_click_captcha_page";

/**
 * 用户注册页面
 * 职责：提供用户注册表单，支持手机号/邮箱注册、验证码发送、密码设置及提交注册。
 * 输入：props - 包含 location（获取注册类型和用户名）、pageNavigator（由 WithNavigation 注入）。
 * 约束：注册类型由上游页面决定；验证码倒计时需在组件卸载时清除定时器。
 */
class HGRegisterPage extends Component {
  formRef = React.createRef();
  timer = null;
  hgEmailCodeInFlight = false; // 等待本次邮件提交确认，防止重复消耗点选验证凭证。
  hgMounted = false; // 发信响应在离开注册页后不写页面状态或启动倒计时。

  constructor(props) {
    super(props);
    // ✅ 正确：从 props 获取 location，而不是调用 useLocation()
    // 路由注入的 state 仅是上页提供的提示；直接访问或刷新后丢失时仍可选择注册方式。
    const registerState = this.props.location?.state;

    this.state = {
      loading: false,
      codeLoading: false,
      countdown: 0,
      registerType: registerState?.registerType || HGRegisterType.PHONE, // 默认手机号；缺少路由 state 时也可注册。
      contactWay: "",
      userName: registerState?.userName || "", // 缺省为空，不依赖跳转来源。
      verifyCode: "", //验证码
      captchaVisible: false, // 点选验证码弹窗是否可见
    };
  }

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.timer && clearInterval(this.timer);
  }

  /** 发送验证码 */
  handleSendCode = async () => {
    //"contactWay"
    const contactWay = this.formRef.current?.getFieldValue(
      this.state.registerType
    );

    if (!contactWay) {
      message.warning(this.state.registerType === HGRegisterType.EMAIL ? "请先输入邮箱" : "请先输入手机号");
      return;
    }

    // 显示点选验证码弹窗
    this.setState({ captchaVisible: true });
  };

  /**
   * 点选验证码验证成功回调。
   * @param {string} verifyToken - 验证通过后的 token。
   */
  handleCaptchaSuccess = (verifyToken) => {
    if (this.hgEmailCodeInFlight || this.state.codeLoading) return;
    this.setState({ captchaVisible: false });

    const contactWay = this.formRef.current?.getFieldValue(
      this.state.registerType
    );

    this.setState({ codeLoading: true });

    const isEmail = this.state.registerType === HGRegisterType.EMAIL;
    if (isEmail) this.hgEmailCodeInFlight = true;
    const requestPromise = isEmail
      ? HGLoginVM.requestSendEmailVerifyCode({ email: contactWay, verifyToken })
      : HGLoginVM.requestSendVerifyCode({ phone: contactWay, verifyToken });

    requestPromise
      .then((verifyCode) => {
        if (!this.hgMounted) return;
        if (isEmail) {
          this.setState({ verifyCode: "" });
          this.formRef.current?.setFieldsValue({ code: "" });
        } else {
          this.formRef.current?.setFieldsValue({ code: verifyCode });
          this.setState({ verifyCode });
        }
        showSuccess(isEmail ? "邮件已发送，请查收并手动输入验证码" : "验证码发送成功");
        this.startCountdown();
      })
      .catch((error) => {
        if (this.hgMounted) handleError(error);
      })
      .finally(() => {
        this.hgEmailCodeInFlight = false;
        if (this.hgMounted) this.setState({ codeLoading: false });
      });
  };

  /**
   * 点选验证码验证失败回调。
   */
  handleCaptchaError = (errorMsg) => {
    message.error(errorMsg || "验证码验证失败");
  };

  /**
   * 关闭点选验证码弹窗。
   */
  handleCaptchaClose = () => {
    this.setState({ captchaVisible: false });
  };

  /** 提交注册 */
  handleSubmit = (values) => {
    if (values.password !== values.confirmPassword) {
      message.error("两次密码不一致");
      return;
    }
    this.setState({ loading: true });

    const isEmail = this.state.registerType === HGRegisterType.EMAIL;
    const registerPromise = isEmail 
      ? HGLoginVM.requestRegisterUserWithEmail({
          userName: values.username,
          email: values.email,
          code: values.code,
          password: values.password,
        })
      : HGLoginVM.requestRegisterUser({
          userName: values.username,
          phone: values.phone,
          code: values.code,
          password: values.password,
        });

    registerPromise
      .then(() => {
        message.success("注册成功，请登录");
        this.props.pageNavigator.open({ page: PAGE.LOGIN });
      })
      .catch((err) => {
        LogError("注册错误：", err);
        // 注册失败
        message.error(err.message);
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 启动 60 秒验证码倒计时，每秒递减，归零后自动清除定时器。
   * @returns {void}
   */
  startCountdown = () => {
    this.setState({ countdown: 60 });

    this.timer = setInterval(() => {
      this.setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(this.timer);
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  /**
   * 切换输入类型（邮箱/手机号）。
   * @returns {void}
   */
  toggleInputType = () => {
    this.setState((prev) => ({ useEmail: !prev.useEmail }));
  };

  /**
   * 联系方式输入框变化回调，实时更新 state 中的 contactWay。
   * @param {Event} e - 输入框 change 事件对象。
   * @returns {void}
   */
  inputChange = (e) => {
    const value = e.target.value;
    this.setState(
      {
        contactWay: value,
      },
      () => {}
    );
  };

  render() {
    const {
      loading,
      codeLoading,
      countdown,
      userName,
      registerType,
      verifyCode,
      captchaVisible,
    } = this.state;
    const isEmail = registerType == HGRegisterType.EMAIL;

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>用户注册</h2>
          <Form
            ref={this.formRef}
            size="large"
            initialValues={{
              username: userName || "",
              code: verifyCode,
            }}
            onFinish={this.handleSubmit}
          >
            <Item
              name="username"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <HGInputPage prefix={<HGIconPage type="user" />} placeholder="用户名" />
            </Item>

            {isEmail ? (
              <Item
                name="email"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "邮箱格式不正确" }, // ⚠️ 注意：type 应该是 "email"，不是 "phone"
                ]}
              >
                <HGInputPage
                  prefix={<HGIconPage type="mail" />}
                  placeholder="邮箱"
                  onChange={this.inputChange}
                />
              </Item>
            ) : (
              <Item
                name="phone"
                rules={[
                  { required: true, message: "请输入手机号" },
                  {
                    pattern: /^1[3-9]\d{9}$/,
                    message: "手机号格式不正确",
                  },
                ]}
              >
                <HGInputPage
                  prefix={<HGIconPage type="mobile" />} // 建议换图标
                  placeholder="手机号"
                  onChange={this.inputChange}
                />
              </Item>
            )}
            <div className={styles.codeRow}>
              <Item
                name="code"
                rules={[{ required: true, message: "请输入验证码" }]}
                style={{ flex: 1, marginBottom: 0 }} // ⭐ 核心 2
              >
                <HGInputPage placeholder="验证码" />
              </Item>
              <HGButtonPage
                type="primary"
                onClick={this.handleSendCode}
                disabled={countdown > 0}
                loading={codeLoading}
              >
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
              </HGButtonPage>
            </div>
            <Item
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <HGInputPassword prefix={<HGIconPage type="lock" />} placeholder="密码" />
            </Item>

            <Item
              name="confirmPassword"
              rules={[{ required: true, message: "请确认密码" }]}
            >
              <HGInputPassword
                prefix={<HGIconPage type="lock" />}
                placeholder="确认密码"
              />
            </Item>

            <Item>
              <HGButtonPage type="primary" htmlType="submit" loading={loading} block>
                注册
              </HGButtonPage>
            </Item>
          </Form>
        </div>

        {/* 点选验证码弹窗 */}
        <HGClickCaptchaPage
          visible={captchaVisible}
          onClose={this.handleCaptchaClose}
          onSuccess={this.handleCaptchaSuccess}
          onError={this.handleCaptchaError}
        />
      </div>
    );
  }
}

const HGRegisterPageWithNavigation = WithNavigation(HGRegisterPage);
export default HGRegisterPageWithNavigation;
