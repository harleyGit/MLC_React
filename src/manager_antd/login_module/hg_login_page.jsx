/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:27:11
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-25 23:55:38
 * @FilePath: /MLC_React/src/manager_antd/login_module/hglogin_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Form, Input, message } from "antd";
import React, { Component } from "react";
import HGNet from "../net_handle/hg_net_manager";

const { Item } = Form;

class HGLoginPage extends Component {
  formRef = React.createRef();

  state = {
    loading: false,
  };

  handleSubmit = (values) => {
    this.setState({ loading: true });
    // 调用接口，路径为 /api/profile
    HGNet.get("/auth/login")
      .then((res) => {
        console.log("用户信息", res);
        setUser(res);
      })
      .catch((err) => {
        console.error("接口错误", err);
      });

    setTimeout(() => {
      // 🔜 替换为真实 API 调用
      console.log("登录数据:", values);
      message.success("登录成功！");
      // 示例跳转：window.location.href = '/dashboard';
      this.setState({ loading: false });
    }, 800);
  };

  render() {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", padding: 24 }}>
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>用户登录</h2>
        <Form
          ref={this.formRef}
          name="login"
          onFinish={this.handleSubmit}
          initialValues={{ remember: true }}
          size="large"
        >
          <Item
            name="username"
            rules={[{ required: true, message: "请输入用户名!" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Item>

          <Item
            name="password"
            rules={[{ required: true, message: "请输入密码!" }]}
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
      </div>
    );
  }
}

export default HGLoginPage;
