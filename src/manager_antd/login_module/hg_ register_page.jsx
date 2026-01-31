/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:30:41
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 16:13:22
 * @FilePath: /MLC_React/src/manager_antd/login_module/hg_ register_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Form, Input, message } from "antd";
// import { Component, React } from "react";
import React, { Component } from "react";
import HGNet from "../../api/hg_net_manager";
import { WithNavigation } from "../router/hg_naviagion_hook";
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
      email: "",
      userName: location.state?.userName || "",
    };
  }

  componentDidMount() {}

  componentWillUnmount() {
    this.timer && clearInterval(this.timer);
  }

  /** 发送验证码 */
  handleSendCode = async () => {
    const email = this.formRef.current?.getFieldValue("email");

    if (!email) {
      message.warning("请先输入邮箱");
      return;
    }

    this.setState({ codeLoading: true });

    HGNet.post("/auth/send_code", {
      phone: values.username,
      password: values.password,
    })
      .then((res) => {
        console.log("登录成功", res);
        localStorage.setItem(TOKEN_KEY, res.result?.token);

        const from = this.props.location.state?.from || ROUTE_PATH.USER_PROFILE;
        // window.location.href = "/home";
        this.props.navigate?.(from);
        this.setState({ loading: false });
      })
      .catch((err) => {
        this.setState({ loading: false });
        console.error("登录失败", err);
      });
    // 🔜 替换为真实 API
    // setTimeout(() => {
    //   message.success("验证码已发送");
    //   this.startCountdown();
    //   this.setState({ codeLoading: false });
    // }, 800);
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
  emailInputChange = (e) => {
    const value = e.target.value;
    this.setState(
      {
        email: value,
      },
      () => {}
    );
    console.log("当前输入值：", value);
  };

  render() {
    const { loading, codeLoading, countdown, userName } = this.state;
    console.log("🍎用户名：userName:", userName);
    return (
      <div className={styles.container}>
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

          <Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              onChange={this.emailInputChange}
              placeholder="邮箱"
            />
          </Item>

          <Item
            name="code"
            rules={[{ required: true, message: "请输入验证码" }]}
          >
            <div className={styles.codeRow}>
              <Input placeholder="邮箱验证码" />
              <Button
                type="primary"
                onClick={this.handleSendCode}
                disabled={countdown > 0}
                loading={codeLoading}
              >
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
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
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Item>

          <Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Item>
        </Form>
      </div>
    );
  }
}

export default WithNavigation(HGRegisterPage);
