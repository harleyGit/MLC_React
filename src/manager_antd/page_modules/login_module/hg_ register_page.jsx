/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:30:41
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:47:56
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
import React, { Component } from "react";
// import { handleError } from "../../api/HttpManagerV1";
import { handleError } from "../../../api/HttpManagerV1";
import { showSuccess } from "../../../api/hg_ui_feedback";
import { LogError, LogOut } from "../../../logger/hg_logger";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../../router/hg_router_path";
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
      verifyCode: "", //验证码
    };
  }

  componentDidMount() {
    const { location } = this.props;
    // testEmail:'harleysor@qq.com',
    // testCode:123456,
    LogOut(
      "testEmail:",
      location.state.testEmail,
      "testCode:",
      location.state.testCode
    );
  }

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
    showSuccess("验证码发送成功");
    this.startCountdown();

    HGLoginVM.requestSendVerifyCode({
      phone: contactWay,
    })
      .then((verifyCode) => {
        if (this.formRef.current) {
          this.formRef.current.setFieldsValue({ code: verifyCode });
        }
        // ✅ 关键：主动设置表单字段值
        // this.formRef.current?.setFieldsValue({
        //   code: code,
        // });
        this.setState({ verifyCode: code });
      })
      .catch(handleError)
      .finally(() => {
        this.setState({ codeLoading: false });
      });
  };

  /** 提交注册 */
  handleSubmit = (values) => {
    if (values.password !== values.confirmPassword) {
      message.error("两次密码不一致");
      return;
    }
    LogOut("表单值：", values);
    this.setState({ loading: true });

    HGLoginVM.requestRegisterUser({
      userName: values.username,
      phone: values.phone,
      code: values.code,
      password: values.password,
    })
      .then((res) => {
        message.success("注册成功，请登录");
        this.props.navigate(ROUTE_PATH.LOGIN);
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
    const {
      loading,
      codeLoading,
      countdown,
      userName,
      registerType,
      verifyCode,
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
            <div className={styles.codeRow}>
              <Item
                name="code"
                rules={[{ required: true, message: "请输入验证码" }]}
                style={{ flex: 1, marginBottom: 0 }} // ⭐ 核心 2
              >
                <Input placeholder="验证码" />
              </Item>
              <Button
                type="primary"
                onClick={this.handleSendCode}
                disabled={countdown > 0}
                loading={codeLoading}
              >
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
              </Button>
            </div>
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
