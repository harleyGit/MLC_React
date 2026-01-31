/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:30:41
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 21:18:17
 * @FilePath: /MLC_React/src/manager_antd/login_module/hg_ register_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import {
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, message } from "antd";
// import { Component, React } from "react";
import React, { Component } from "react";
import { LogError, LogOut } from "../../logger/hg_logger";
import { WithNavigation } from "../router/hg_naviagion_hook";
import HGLoginVM, { HGRegisterType } from "./hg_login_vm";
import styles from "./hg_register.module.css";

const { Item } = Form;

class HGRegisterPage extends Component {
  formRef = React.createRef();
  timer = null;

  constructor(props) {
    super(props);
    // ✅ 正确：从 props 获取 location，而不是调用 useLocation()
    const { location } = this.props;

    this.state = {
      loading: false,
      codeLoading: false,
      countdown: 0,
      registerType: location.state.registeType || HGRegisterType.PHONE, // true=邮箱，false=手机号
      contactWay: "",
      userName: location.state?.userName || "",
    };
  }

  componentDidMount() {}

  componentWillUnmount() {
    this.timer && clearInterval(this.timer);
  }

  handleSendCodeV2 = () => {
    const formValues = this.formRef.current?.getFieldsValue();
    const isEmail = this.state.registerType == HGRegisterType.EMAIL;
    const target = isEmail ? formValues.email : formValues.phone;

    if (!target) {
      message.error(
        this.state.registerType ? "请先输入邮箱" : "请先输入手机号"
      );
      return;
    }

    // 调用发送验证码 API
    this.sendCodeAPI(target, isEmail ? "email" : "phone");
  };
  handleSendCodeV3 = (type) => {
    const form = formRef.current;
    form.validateFields().then((values) => {
      let target;
      if (type === RegisterType.PHONE) {
        target = values.phone;
      } else if (type === RegisterType.EMAIL) {
        target = values.email;
      }

      // 调用 API
      api
        .sendVerificationCode({ target, type })
        .then(() => startCountdown())
        .catch(showError);
    });
  };

  /** 发送验证码 */
  handleSendCode = async () => {
    //"contactWay"
    const contactWay = this.formRef.current?.getFieldValue(
      this.state.registerType
    );

    if (!contactWay) {
      message.warning("请先输入邮箱");
      return;
    }
    this.setState({ codeLoading: true });
    message.success("验证码已发送");
    this.startCountdown();

    HGLoginVM.requestSendVerifyCode({
      phone: contactWay,
    })
      .then((data) => {
        LogOut("data:", data);
        this.setState({ codeLoading: false });
      })
      .catch((error) => {
        LogError("错误：", error);
        this.setState({ codeLoading: false });
        // 处理登录失败
        message.error(error.message);
      });
  };

  /** 启动倒计时 */
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

  toggleInputType = () => {
    this.setState((prev) => ({ useEmail: !prev.useEmail }));
  };
  /** 提交注册 */
  handleSubmit = (values) => {
    if (values.password !== values.confirmPassword) {
      message.error("两次密码不一致");
      return;
    }

    this.setState({ loading: true });

    // 🔜 替换为真实注册 API
    setTimeout(() => {
      console.log("注册数据:", values);
      message.success("注册成功，请登录");
      this.setState({ loading: false });
      this.props.navigate("/login");
    }, 1000);
  };
  inputChange = (e) => {
    const value = e.target.value;
    this.setState(
      {
        contactWay: value,
      },
      () => {}
    );
    console.log("当前输入值：", value);
  };

  render() {
    const { loading, codeLoading, countdown, userName, registerType } =
      this.state;
    const isEmail = registerType == HGRegisterType.EMAIL;
    console.log("🍎用户名：userName:", userName);
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>用户注册</h2>
          <Form
            ref={this.formRef}
            size="large"
            initialValues={{
              username: userName || "",
            }}
            onFinish={this.handleSubmit}
          >
            <Item
              name="username"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Item>

            {isEmail ? (
              <Item
                name="email"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "邮箱格式不正确" }, // ⚠️ 注意：type 应该是 "email"，不是 "phone"
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
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
                <Input
                  prefix={<MobileOutlined />} // 建议换图标
                  placeholder="手机号"
                  onChange={this.inputChange}
                />
              </Item>
            )}

            <Item
              name="code"
              rules={[{ required: true, message: "请输入验证码" }]}
            >
              <div className={styles.codeRow}>
                <Input placeholder="验证码" />
                <Button
                  type="primary"
                  onClick={this.handleSendCode}
                  disabled={this.state.countdown > 0}
                  loading={this.state.codeLoading}
                >
                  {this.state.countdown > 0
                    ? `${this.state.countdown}s`
                    : "发送验证码"}
                </Button>
              </div>
            </Item>

            <Item
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Item>

            <Item
              name="confirmPassword"
              rules={[{ required: true, message: "请确认密码" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
              />
            </Item>

            <Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                注册
              </Button>
            </Item>
          </Form>
        </div>
      </div>
    );
  }
}

export default WithNavigation(HGRegisterPage);
