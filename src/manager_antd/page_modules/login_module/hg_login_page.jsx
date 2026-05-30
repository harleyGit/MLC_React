/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:27:11
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:41:26
 * @FilePath: /MLC_React/src/manager_antd/login_module/hglogin_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import { LogOut } from "../../../logger/hg_logger";
import HGLoading from "../../../components/hg_loading";
import { DEBUG_MAP } from "../../auth/hg_auth";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../../router/hg_router_path";
import HGEditUserPageVM from "../user/edit_user_info/hg_edit_user_page_vm";
import styles from "./hg_login.module.css";
import HGLoginVM, { HGRegisterType } from "./hg_login_vm";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputPassword } from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";

/**
 * 用户登录页面
 * 职责：提供用户登录表单，处理登录、注册跳转及忘记密码操作。
 * 输入：props - 包含 location（获取来源页）、navigate 方法（由 WithNavigation 注入）。
 * 约束：登录成功后跳转至来源页或首页；使用 HGLoginVM 进行登录请求。
 */
class HGLoginPage extends Component {
  formRef = React.createRef();

  state = {
    loading: false,
    userName: "",
  };

  /**
   * 提交登录表单，调用登录接口并获取用户资料，成功后跳转至来源页。
   * @param {Object} values - 表单值，包含 username 和 password。
   * @returns {void}
   */
  handleSubmit = (values) => {
    console.log("🍎 values：", values);
    // return;
    this.setState({ loading: true });
    HGLoginVM.requestLogin({
      phone: values.username,
      password: values.password,
    })
      .then((data) => {
        LogOut("data:", data);
        return HGEditUserPageVM.getUserProfile();
      })
      .then(() => {
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

  /**
   * 跳转到注册页面，携带当前用户名和注册类型。
   * @param {string} registerType - 注册类型（手机号或邮箱）。
   * @returns {void}
   */
  handleRegister = (registerType = HGRegisterType.PHONE) => {
    const { userName } = this.state;
    this.props.navigate?.(ROUTE_PATH.REGISTER, {
      state: {
        userName: userName,
        registerType: registerType,
        testEmail: "harleysor@qq.com",
        testCode: 123456,
      },
    });
  };

  /**
   * 跳转到忘记密码页面。
   * @returns {void}
   */
  handleForgetPassword = () => {
    this.props.navigate?.(ROUTE_PATH.FORGET_PASSWORD);
  };

  /**
   * 用户名输入框变化回调，实时更新 state 中的 userName。
   * @param {Event} e - 输入框 change 事件对象。
   * @returns {void}
   */
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
        <HGLoading
          fullscreen
          text="正在登录..."
          visible={this.state.loading}
        />
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
              <HGInputPage
                prefix={<HGIconPage type="user" />}
                placeholder="用户名"
                onChange={this.handleUserNameInputChange}
              />
            </Item>

            <Item
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <HGInputPassword prefix={<HGIconPage type="lock" />} placeholder="密码" />
            </Item>

            <Item>
              <HGButtonPage
                type="primary"
                htmlType="submit"
                loading={this.state.loading}
                block
              >
                登录
              </HGButtonPage>
            </Item>
          </Form>

          <div className={styles.actions}>
            <span className={styles.link} onClick={() => this.handleRegister(HGRegisterType.PHONE)}>
              手机注册
            </span>
            <span className={styles.link} onClick={() => this.handleRegister(HGRegisterType.EMAIL)}>
              邮箱注册
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

const HGLoginPageWithNavigation = WithNavigation(HGLoginPage);

export default HGLoginPageWithNavigation;
