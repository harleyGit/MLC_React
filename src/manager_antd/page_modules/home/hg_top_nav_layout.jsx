/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-03 10:29:22
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-30 21:31:34
 * @FilePath: /MLC_React/src/manager_antd/page_modules/home/hg_top_nav_layout.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// src/components/HGTopNavLayout.jsx
import { HGLayoutPage as Layout, HGLayoutHeader as Header, HGLayoutContent as Content, HGLayoutFooter as Footer } from "../../../components/hg_layout/hg_layout_page";
import HGMenuPage from "../../../components/hg_menu/hg_menu_page";
import React, { Component } from "react";
import { Link, Outlet } from "react-router-dom";
import { ROUTE_PATH } from "../../router/hg_router_path";
import { logout } from "../../auth/hg_auth";
import HGUserProfileStorage from "../../storage/hg_user_profile_storage";
import styles from "./hg_top_nav_layout.module.css";

class HGTopNavLayout extends Component {
  /**
   * 构造函数：初始化当前导航选中态和头像浮层状态，并创建浮层容器引用。
   */
  constructor(props) {
    super(props);
    this.state = {
      current: this.getCurrentPage(),
      showUserDropdown: false,
    };
    this.avatarMenuRef = React.createRef();
  }

  /**
   * 生命周期挂载：同步当前路由对应菜单高亮，并注册全局点击监听用于外部点击关闭浮层。
   */
  componentDidMount() {
    // 监听路由变化（通过 props.location 由 HOC 提供）
    this.updateCurrentPage();
    document.addEventListener("mousedown", this.handleDocumentClick);
  }

  /**
   * 生命周期更新：路由变化时刷新菜单高亮，并自动关闭头像下拉层。
   * @param {object} prevProps 更新前 props。
   */
  componentDidUpdate(prevProps) {
    if (prevProps.location?.pathname !== this.props.location?.pathname) {
      this.updateCurrentPage();
      this.setState({ showUserDropdown: false });
    }
  }

  /**
   * 生命周期卸载：移除全局点击监听，避免事件泄漏。
   */
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleDocumentClick);
  }

  /**
   * 根据当前 pathname 计算菜单高亮 key。
   * @returns {string} 对应 Menu key。
   */
  getCurrentPage = () => {
    const path = this.props.location?.pathname || "/";
    if (path === ROUTE_PATH.DEFAULT || path === ROUTE_PATH.HOME) return "home";
    if (path === ROUTE_PATH.PRODUCTS) return "products";
    if (path === ROUTE_PATH.ABOUT) return "about";
    if (path === ROUTE_PATH.USER_PROFILE) return "profile";
    if (path === ROUTE_PATH.EDIT_USER_INFO) return "avatar";
    if (path === ROUTE_PATH.OPERATION_MANAGEMENT) return "operation";
    if (path === ROUTE_PATH.BILI_DOUGA) return "bili_douga";
    return "home";
  };

  /**
   * 将菜单高亮状态同步为当前路由对应 key。
   */
  updateCurrentPage = () => {
    this.setState({ current: this.getCurrentPage() });
  };

  /**
   * 处理顶部菜单点击高亮。
   * @param {{key: string}} e antd Menu 点击事件对象。
   */
  handleClick = (e) => {
    this.setState({ current: e.key });
  };

  /**
   * 点击头像切换浮层显示状态。
   * 约束：只切换布尔值，不在此方法内做路由跳转。
   */
  toggleUserDropdown = () => {
    this.setState((prevState) => {
      const nextShowUserDropdown = !prevState.showUserDropdown;
      return {
        current: nextShowUserDropdown ? "avatar" : this.getCurrentPage(),
        showUserDropdown: nextShowUserDropdown,
      };
    });
  };

  /**
   * 点击页面其他区域时关闭头像下拉浮层。
   * @param {MouseEvent} event 文档级鼠标事件。
   * 约束：若点击点不在头像浮层容器内则强制关闭。
   */
  handleDocumentClick = (event) => {
    if (!this.avatarMenuRef.current?.contains(event.target)) {
      this.setState({
        current: this.getCurrentPage(),
        showUserDropdown: false,
      });
    }
  };

  /**
   * 获取本地缓存用户资料。
   * @returns {Object} 当前可用于页面展示的用户资料；无缓存时返回空对象。
   */
  getUserProfile = () => {
    return HGUserProfileStorage.getUserProfile() || {};
  };

  /**
   * 获取用户展示名称。
   * @param {Object} userProfile 本地缓存用户资料。
   * @returns {string} 优先昵称，其次用户名，最后使用默认占位。
   */
  getUserDisplayName = (userProfile) => {
    return (
      userProfile.nickname ||
      userProfile.username ||
      userProfile.userName ||
      "用户"
    );
  };

  /**
   * 获取头像图片地址。
   * @param {Object} userProfile 本地缓存用户资料。
   * @returns {string} 可展示的头像地址；无头像时返回空字符串。
   */
  getUserAvatarUrl = (userProfile) => {
    return userProfile.avatar_url || userProfile.avatarUrl || "";
  };

  /**
   * 获取头像文字占位。
   * @param {string} displayName 用户展示名称。
   * @returns {string} 截取后的头像文字，限制长度避免撑破圆形容器。
   */
  getAvatarText = (displayName) => {
    return displayName.slice(0, 2).toUpperCase();
  };

  /**
   * 获取用户信息副标题。
   * @param {Object} userProfile 本地缓存用户资料。
   * @returns {string} 优先展示签名，其次邮箱、手机号；都不存在则为空。
   */
  getUserSubtitle = (userProfile) => {
    return userProfile.signature || userProfile.email || userProfile.phone || "";
  };

  /**
   * 打开个人中心页面。
   * 约束：先关闭浮层，再执行路由跳转。
   */
  gotoUserProfile = () => {
    this.setState({ showUserDropdown: false });
    this.props.navigate(ROUTE_PATH.EDIT_USER_INFO);
  };

  /**
   * 退出登录：清除登录态并跳转到登录页。
   * 约束：先关闭浮层，调用 logout 清除 token，再跳转到登录页。
   */
  gotoLogoutPage = () => {
    this.setState({ showUserDropdown: false });
    logout();
    this.props.navigate(ROUTE_PATH.LOGIN);
  };
 

  /**
   * 组件主渲染：顶部导航 + 头像下拉 + 子路由内容容器 + 页脚。
   * @returns {React.ReactNode} 布局根节点。
   */
  render() {
    const { current, showUserDropdown } = this.state;
    const userProfile = this.getUserProfile();
    const userDisplayName = this.getUserDisplayName(userProfile);
    const userAvatarUrl = this.getUserAvatarUrl(userProfile);
    const avatarText = this.getAvatarText(userDisplayName);
    const userSubtitle = this.getUserSubtitle(userProfile);
    const avatarButtonClassName = `${styles.avatarButton} ${
      current === "avatar" ? styles.avatarButtonActive : ""
    }`;

    return (
      <Layout className={styles.layout}>
        <Header className={styles.header}>
          <div className={styles.logo} />
          <HGMenuPage
            theme="dark"
            mode="horizontal"
            selectedKeys={[current]}
            onClick={this.handleClick}
            className={styles.topMenu}
            items={[
              { key: "home", label: <Link to={ROUTE_PATH.HOME} className={styles.menuLink}>首页</Link> },
              { key: "products", label: <Link to={ROUTE_PATH.PRODUCTS} className={styles.menuLink}>产品</Link> },
              { key: "about", label: <Link to={ROUTE_PATH.ABOUT} className={styles.menuLink}>我们</Link> },
              { key: "operation", label: <Link to={ROUTE_PATH.OPERATION_MANAGEMENT} className={styles.menuLink}>运维管理</Link> },
              { key: "bili_douga", label: <Link to={ROUTE_PATH.BILI_DOUGA} className={styles.menuLink}>B站动画</Link> },
              { key: "profile", label: <Link to={ROUTE_PATH.USER_PROFILE} className={styles.menuLink}>我的信息</Link> },
            ]}
          />
          <div className={styles.avatarWrap} ref={this.avatarMenuRef}>
            <button
              type="button"
              className={avatarButtonClassName}
              onClick={this.toggleUserDropdown}
            >
              {userAvatarUrl ? (
                <img
                  className={styles.avatarImage}
                  src={userAvatarUrl}
                  alt={userDisplayName}
                />
              ) : (
                <span className={styles.avatarText}>{avatarText}</span>
              )}
            </button>
            {showUserDropdown ? (
              <div className={styles.userDropdown}>
                <div className={styles.userInfoCard}>
                  <div className={styles.userInfoAvatar}>
                    {userAvatarUrl ? (
                      <img
                        className={styles.userInfoAvatarImage}
                        src={userAvatarUrl}
                        alt={userDisplayName}
                      />
                    ) : (
                      avatarText
                    )}
                  </div>
                  <div className={styles.userInfoText}>
                    <div className={styles.userName}>{userDisplayName}</div>
                    {userSubtitle ? (
                      <div className={styles.userSubtitle}>{userSubtitle}</div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.dropdownDivider} />
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={this.gotoUserProfile}
                >
                  个人中心
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={this.gotoLogoutPage}
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </Header>

        <Content className={styles.content}>
          <div className={styles.contentWrapper}>
            <Outlet /> {/* 渲染子路由 */}
          </div>
        </Content>

        <Footer style={{ textAlign: "center", padding: "24px 0" }}>
          Ant Design ©2026
        </Footer>
      </Layout>
    );
  }
}

export default HGTopNavLayout;
