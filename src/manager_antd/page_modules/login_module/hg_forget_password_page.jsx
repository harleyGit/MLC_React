import React, { Component } from "react";
import { LogOut } from "../../../logger/hg_logger";
import HGLoading from "../../../components/hg_loading";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../../router/hg_router_path";
import styles from "./hg_forget_password.module.css";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputPassword } from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import HGNet from "../../net_handle/hg_net_manager_vm";

/**
 * 忘记密码页面
 * 职责：通过手机验证码验证用户身份后重置密码。
 * 流程：输入手机号 → 发送验证码 → 输入验证码和新密码 → 提交重置。
 */
class HGForgetPasswordPage extends Component {
  formRef = React.createRef();

  state = {
    loading: false,
    codeSending: false,
    countdown: 0,
  };

  /**
   * 发送验证码，启动 60 秒倒计时。
   * @returns {void}
   */
  handleSendCode = () => {
    const phone = this.formRef.current?.getFieldValue?.("phone");
    if (!phone) {
      message.error("请先输入手机号");
      return;
    }

    this.setState({ codeSending: true });
    HGNet.sendResetPasswordCode({ phone })
      .then((res) => {
        LogOut("发送忘记密码验证码响应：", res);
        message.success("验证码已发送");
        this.startCountdown();
      })
      .catch((error) => {
        message.error(error.message || "发送验证码失败");
      })
      .finally(() => {
        this.setState({ codeSending: false });
      });
  };

  /**
   * 启动 60 秒倒计时。
   * @returns {void}
   */
  startCountdown = () => {
    this.setState({ countdown: 60 });
    this._timer = setInterval(() => {
      this.setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(this._timer);
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  /**
   * 组件卸载时清除定时器。
   * @returns {void}
   */
  componentWillUnmount() {
    if (this._timer) {
      clearInterval(this._timer);
    }
  }

  /**
   * 提交重置密码表单，调用重置密码接口。
   * @param {Object} values - 表单值，包含 phone、code、newPassword、confirmPassword。
   * @returns {void}
   */
  handleSubmit = (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("两次密码不一致");
      return;
    }

    this.setState({ loading: true });
    HGNet.resetPassword({
      phone: values.phone,
      code: values.code,
      new_password: values.newPassword,
    })
      .then((res) => {
        LogOut("重置密码响应：", res);
        message.success("密码重置成功，请重新登录");
        this.props.navigate?.(ROUTE_PATH.LOGIN);
      })
      .catch((error) => {
        message.error(error.message || "重置密码失败");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 跳转回登录页面。
   * @returns {void}
   */
  handleBackToLogin = () => {
    this.props.navigate?.(ROUTE_PATH.LOGIN);
  };

  render() {
    const { loading, codeSending, countdown } = this.state;

    return (
      <div className={styles.page}>
        <HGLoading
          fullscreen
          text="正在重置密码..."
          visible={loading}
        />
        <div className={styles.card}>
          <h2 className={styles.title}>忘记密码</h2>

          <Form
            name="forgetPassword"
            onFinish={this.handleSubmit}
            size="large"
            ref={this.formRef}
          >
            <Item
              name="phone"
              rules={[{ required: true, message: "请输入手机号" }]}
            >
              <HGInputPage
                prefix={<HGIconPage type="user" />}
                placeholder="请输入注册手机号"
              />
            </Item>

            <Item
              name="code"
              rules={[{ required: true, message: "请输入验证码" }]}
            >
              <div className={styles.codeRow}>
                <HGInputPage
                  prefix={<HGIconPage type="lock" />}
                  placeholder="验证码"
                />
                <HGButtonPage
                  type="default"
                  onClick={this.handleSendCode}
                  loading={codeSending}
                  disabled={countdown > 0}
                >
                  {countdown > 0 ? `${countdown}秒后重发` : "发送验证码"}
                </HGButtonPage>
              </div>
            </Item>

            <Item
              name="newPassword"
              rules={[
                { required: true, message: "请输入新密码" },
                { min: 6, message: "密码长度不能少于6位" },
              ]}
            >
              <HGInputPassword
                prefix={<HGIconPage type="lock" />}
                placeholder="新密码（至少6位）"
              />
            </Item>

            <Item
              name="confirmPassword"
              rules={[{ required: true, message: "请确认新密码" }]}
            >
              <HGInputPassword
                prefix={<HGIconPage type="lock" />}
                placeholder="确认新密码"
              />
            </Item>

            <Item>
              <HGButtonPage
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                重置密码
              </HGButtonPage>
            </Item>
          </Form>

          <div className={styles.actions}>
            <span className={styles.link} onClick={this.handleBackToLogin}>
              返回登录
            </span>
          </div>
        </div>
      </div>
    );
  }
}

const HGForgetPasswordPageWithNavigation = WithNavigation(HGForgetPasswordPage);

export default HGForgetPasswordPageWithNavigation;
