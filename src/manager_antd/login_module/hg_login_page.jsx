/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:27:11
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-01-29 23:18:59
 * @FilePath: /MLC_React/src/manager_antd/login_module/hglogin_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Form, Input } from "antd";
import React, { Component } from "react";
import HGNet from "../net_handle/hg_net_manager";
import styles from "./hg_login.module.css";
import { TOKEN_KEY } from "../auth/hg_auth";


const { Item } = Form;

class HGLoginPage extends Component {
  formRef = React.createRef();
  

  state = {
    loading: false,
  };

  handleSubmit = (values) => {
    this.setState({ loading: true });
    HGNet.post("/auth/login", {
      phone: "13800000000",
      password: "123456",
    })
      .then((res) => {
        console.log("登录成功", res);
        localStorage.setItem(TOKEN_KEY, res.result?.token);
        // window.location.href = "/home";
        this.setState({ loading: false });
      })
      .catch((err) => {
        this.setState({ loading: false });
        console.error("登录失败", err);
      });

    // setTimeout(() => {
    //   // 🔜 替换为真实 API 调用
    //   console.log("登录数据:", values);
    //   message.success("登录成功！");
    //   // 示例跳转：window.location.href = '/dashboard';
    //   this.setState({ loading: false });
    // }, 800);
  };

  formRef = React.createRef();

  state = {
    loading: false,
  };

  // handleSubmit = (values) => {
  //   this.setState({ loading: true });

  //   // 模拟登录
  //   setTimeout(() => {
  //     console.log("login values:", values);
  //     this.setState({ loading: false });
  //   }, 1000);
  // };

  handleRegister = () => {
    this.props.navigate?.("/register");
  };

  handleForgetPassword = () => {
    this.props.navigate?.("/forget-password");
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
            initialValues={{//默认值
              username: "admin",
              password: "123456",
            }}
          >
            <Item
              name="username"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
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

export default HGLoginPage;
