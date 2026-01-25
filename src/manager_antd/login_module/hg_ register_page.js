/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:30:41
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-25 22:30:51
 * @FilePath: /MLC_React/src/manager_antd/login_module/hg_ register_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Form, Input, message } from "antd";
import React, { Component } from "react";

const { Item } = Form;

class HGRegisterPage extends Component {
  formRef = React.createRef();

  state = {
    loading: false,
  };

  handleSubmit = (values) => {
    if (values.password !== values.confirmPassword) {
      message.error("两次密码不一致");
      return;
    }

    this.setState({ loading: true });
    setTimeout(() => {
      // 🔜 替换为真实注册 API
      console.log("注册数据:", values);
      message.success("注册成功！请登录");
      // 示例跳转：window.location.href = '/login';
      this.setState({ loading: false });
    }, 800);
  };

  render() {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", padding: 24 }}>
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>用户注册</h2>
        <Form
          ref={this.formRef}
          name="register"
          onFinish={this.handleSubmit}
          size="large"
        >
          <Item
            name="username"
            rules={[{ required: true, message: "请输入用户名!" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Item>

          <Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱!" },
              { type: "email", message: "邮箱格式不正确!" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Item>

          <Item
            name="password"
            rules={[{ required: true, message: "请输入密码!" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Item>

          <Item
            name="confirmPassword"
            rules={[{ required: true, message: "请确认密码!" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Item>

          <Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={this.state.loading}
              block
            >
              注册
            </Button>
          </Item>
        </Form>
      </div>
    );
  }
}

export default HGRegisterPage;
