/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-25 22:27:11
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-10-27 22:08:23
 * @FilePath: /MLC_React/src/manager_antd/login_module/hglogin_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import { LogOut } from "../../../logger/hg_logger";
import HGLoading from "../../../components/hg_loading";
import { DEBUG_MAP } from "../../auth/hg_auth";
import { getHGLoginReturn } from "../../auth/hg_login_return.js";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../../router/hg_router_path";
import { PAGE, getHGPageTarget } from "../../../components/hg_navigation/hg_page_registry";
import HGEditUserPageVM from "../user/edit_user_info/hg_edit_user_page_vm";
import styles from "./hg_login.module.css";
import HGLoginVM, { HGRegisterType } from "./hg_login_vm";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputPassword } from "../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGIconPage from "../../../components/hg_icon/hg_icon_page";
import HGLoginHistoryStorage from "../../storage/hg_login_history_storage";

/**
 * 用户登录页面
 * 职责：提供用户登录表单，处理登录、注册跳转及忘记密码操作。
 * 输入：props - 包含 location（获取来源页）、pageNavigator（由 WithNavigation 注入）。
 * 约束：登录成功后跳转至来源页或首页；使用 HGLoginVM 进行登录请求。
 */
class HGLoginPage extends Component {
  formRef = React.createRef();
  passwordInputRef = React.createRef();

  state = {
    loading: false,
    userName: "",
    recentAccounts: [],
    recentAccountsVisible: false,
    activeAccountIndex: -1,
  };

  /**
   * 页面挂载后读取本机成功登录历史；历史仅包含账号和登录时间。
   * @returns {void}
   */
  componentDidMount() {
    this.setState({ recentAccounts: HGLoginHistoryStorage.getRecentAccounts() });
  }

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
        const recentAccounts = HGLoginHistoryStorage.recordSuccessfulLogin(values.username);
        this.setState({ recentAccounts });
        return HGEditUserPageVM.getUserProfile();
      })
      .then(() => {
        const from = getHGLoginReturn(
          this.props.location.state?.from,
          this.props.location.search,
          ROUTE_PATH.HOME
        );
        // 仅将已校验的站内来源转换为页面目标，保留查询、路径参数和锚点。
        const target = getHGPageTarget(from) || { page: PAGE.HOME };
        this.props.pageNavigator?.open(target);
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
    this.props.pageNavigator?.open({
      page: PAGE.REGISTER,
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
    this.props.pageNavigator?.open({ page: PAGE.FORGET_PASSWORD });
  };

  /**
   * 用户名输入框变化回调，实时更新 state 中的 userName。
   * @param {Event} e - 输入框 change 事件对象。
   * @returns {void}
   */
  handleUserNameInputChange = (e) => {
    const value = e.target.value;
    this.setState({
      userName: value,
      recentAccountsVisible: true,
      activeAccountIndex: -1,
    });
  };

  /**
   * 打开最近登录账号列表。
   * @returns {void}
   */
  handleUserNameFocus = () => {
    this.setState({ recentAccountsVisible: true, activeAccountIndex: -1 });
  };

  /**
   * 输入框失焦后关闭列表，为列表按钮点击保留一个事件周期。
   * @returns {void}
   */
  handleUserNameBlur = () => {
    window.setTimeout(() => {
      this.setState({ recentAccountsVisible: false, activeAccountIndex: -1 });
    }, 0);
  };

  /**
   * 选择历史账号并清空旧密码，随后聚焦密码框供浏览器密码管理器自动填充。
   * @param {string} userName - 被选择的历史账号。
   * @returns {void}
   */
  handleSelectRecentAccount = (userName) => {
    this.formRef.current?.setFieldsValue({ username: userName, password: "" });
    this.setState(
      {
        userName,
        recentAccountsVisible: false,
        activeAccountIndex: -1,
      },
      () => this.passwordInputRef.current?.focus()
    );
  };

  /**
   * 支持通过方向键、回车和 Escape 操作最近账号列表。
   * @param {React.KeyboardEvent} event - 用户名输入框键盘事件。
   * @returns {void}
   */
  handleUserNameKeyDown = (event) => {
    const { recentAccounts, recentAccountsVisible, activeAccountIndex } = this.state;
    if (recentAccounts.length === 0) {
      return;
    }

    if (event.key === "Escape") {
      this.setState({ recentAccountsVisible: false, activeAccountIndex: -1 });
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") {
      return;
    }

    if (event.key === "Enter" && (!recentAccountsVisible || activeAccountIndex < 0)) {
      return;
    }

    event.preventDefault();
    if (event.key === "Enter") {
      this.handleSelectRecentAccount(recentAccounts[activeAccountIndex].userName);
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const startIndex = activeAccountIndex < 0 ? (direction > 0 ? -1 : 0) : activeAccountIndex;
    const nextIndex = (startIndex + direction + recentAccounts.length) % recentAccounts.length;
    this.setState({ recentAccountsVisible: true, activeAccountIndex: nextIndex });
  };

  /**
   * 渲染最近成功登录的账号列表，列表顺序由成功登录时间决定。
   * @returns {React.ReactNode} 最近账号列表或 null。
   */
  renderRecentAccounts = () => {
    const { recentAccounts, recentAccountsVisible, activeAccountIndex } = this.state;
    if (!recentAccountsVisible || recentAccounts.length === 0) {
      return null;
    }

    return (
      <div id="recent-login-accounts" className={styles.recentAccounts} role="listbox">
        <div className={styles.recentAccountsTitle}>最近登录</div>
        {recentAccounts.map((account, index) => {
          const isActive = index === activeAccountIndex;
          return (
            <button
              id={`recent-login-account-${index}`}
              key={account.userName}
              className={`${styles.recentAccountItem} ${isActive ? styles.recentAccountItemActive : ""}`}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => this.handleSelectRecentAccount(account.userName)}
            >
              <HGIconPage type="user" />
              <span>{account.userName}</span>
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染带最近账号选择器的用户名字段。
   * @returns {React.ReactNode} 用户名表单区域。
   */
  renderUserNameField = () => {
    const { recentAccountsVisible, activeAccountIndex } = this.state;
    const activeDescendant =
      recentAccountsVisible && activeAccountIndex >= 0
        ? `recent-login-account-${activeAccountIndex}`
        : undefined;

    return (
      <div className={styles.accountField}>
        <Item
          name="username"
          rules={[{ required: true, message: "请输入邮箱/手机号码" }]}
          style={{ marginBottom: 0 }}
        >
          <HGInputPage
            prefix={<HGIconPage type="user" />}
            placeholder="用户名"
            autoComplete="username"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="recent-login-accounts"
            aria-expanded={recentAccountsVisible}
            aria-activedescendant={activeDescendant}
            onChange={this.handleUserNameInputChange}
            onFocus={this.handleUserNameFocus}
            onBlur={this.handleUserNameBlur}
            onKeyDown={this.handleUserNameKeyDown}
          />
        </Item>
        {this.renderRecentAccounts()}
      </div>
    );
  };

  /**
   * 渲染登录表单，保留标准自动填充语义供浏览器密码管理器识别。
   * @returns {React.ReactNode} 登录表单。
   */
  renderLoginForm = () => {
    return (
      <Form
        ref={this.formRef}
        name="login"
        autoComplete="on"
        onFinish={this.handleSubmit}
        size="large"
        initialValues={{
          username: DEBUG_MAP.userName,
          password: DEBUG_MAP.password,
        }}
      >
        {this.renderUserNameField()}

        <Item
          name="password"
          rules={[{ required: true, message: "请输入密码" }]}
        >
          <HGInputPassword
            ref={this.passwordInputRef}
            prefix={<HGIconPage type="lock" />}
            placeholder="密码"
            autoComplete="current-password"
          />
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
    );
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

          {this.renderLoginForm()}

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
