/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:27:11
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 17:29:34
 * @FilePath: /MLC_React/src/manager_antd/login_module/hglogin_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Form, Input, message } from "antd";
import React, { Component } from "react";
import { DEBUG_MAP } from "../auth/hg_auth";
import { WithNavigation } from "../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../router/hg_router_path";
import styles from "./hg_login.module.css";
import HGLoginVM, { HGRegisterType } from "./hg_login_vm";
import { LogOut } from "../../logger/hg_logger";

const { Item } = Form;

class HGLoginPage extends Component {
  formRef = React.createRef();

  state = {
    loading: false,
    userName: "",
  };

  handleSubmit = (values) => {
    console.log("🍎 values：", values);
    // return;
    this.setState({ loading: true });
    HGLoginVM.requestLogin({
      phone: values.username,
      password: values.password,
    })
      .then((data) => {
        LogOut("data:", data)
        // 这里的 data 是你上面 return response.data 的结果
        const from = this.props.location.state?.from || ROUTE_PATH.HOME;
        this.props.navigate?.(from);
        this.setState({ loading: false });
      })
      .catch((error) => {
        this.setState({ loading: false });
        // 处理登录失败
        message.error(error.message);
      });
  };

  handleRegister = () => {
    const { userName } = this.state;
    this.props.navigate?.(ROUTE_PATH.REGISTER, {
      state: {
        userName: userName,
        registerType: HGRegisterType.PHONE
      },
    });
  };

  handleForgetPassword = () => {
    this.props.navigate?.("/forget-password");
  };

  handleUserNameInputChange = (e) => {
    const value = e.target.value;
    // 此时 inputValue 是实时的输入值
    this.setState({
      userName: value,
    });
    console.log("当前输入值：", value);
  };
  render() {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>用户登录</h2>

          <Form
            name="login"
            onFinish={this.handleSubmit}
            size="large"
            initialValues={{
              //默认值
              username: DEBUG_MAP.userName, //"admin",
              password: DEBUG_MAP.password, //"123456",
            }}
          >
            <Item
              name="username"
              rules={[{ required: true, message: "请输入邮箱/手机号码" }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                onChange={this.handleUserNameInputChange}
              />
            </Item>

            <Item
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Item>

            <Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={this.state.loading}
                block
              >
                登录
              </Button>
            </Item>
          </Form>

          <div className={styles.actions}>
            <span className={styles.link} onClick={this.handleRegister}>
              注册账号
            </span>
            <span className={styles.link} onClick={this.handleForgetPassword}>
              忘记密码？
            </span>
          </div>
        </div>
      </div>
    );
  }
}

export default WithNavigation(HGLoginPage);
