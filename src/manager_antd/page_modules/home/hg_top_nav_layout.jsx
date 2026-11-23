/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-03 10:29:22
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-20 21:12:15
 * @FilePath: /MLC_React/src/manager_antd/page_modules/home/hg_top_nav_layout.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// src/components/HGTopNavLayout.jsx
import React, { Component } from "react";
import { Link, Outlet } from "react-router-dom";
import {
  HGLayoutContent as Content,
  HGLayoutFooter as Footer,
  HGLayoutHeader as Header,
  HGLayoutPage as Layout,
} from "../../../components/hg_layout/hg_layout_page";
import HGMenuPage from "../../../components/hg_menu/hg_menu_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import { HG_STORES } from "../../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../../infrastructure/storage/HGLocalDataService";
import { hgEvaluateAccess } from "../../../modules/iam/hg_access_evaluator";
import { hgRevokeIAMLogin } from "../../../modules/iam/hg_iam_api";
import { HGIAMContext } from "../../../modules/iam/hg_iam_provider";
import { hgCurrentIAMUser } from "../../../modules/iam/hg_iam_session";
import { HG_PERMISSIONS } from "../../../modules/iam/hg_permission_codes";
import { hgUserRepository } from "../../../modules/user/HGUserRepository";
import { logout } from "../../auth/hg_auth";
import { hgRevokeIMDevice } from "../../auth/hg_im_device";
import { ROUTE_PATH } from "../../router/hg_router_path";
import { hgIMOwner } from "../../storage/hg_im_session";
import HGUserProfileStorage from "../../storage/hg_user_profile_storage";
import {
  HG_IM_CONNECTION_EVENT,
  HG_IM_RECONNECT_EVENT,
} from "./hg_im_connection_events";
import styles from "./hg_top_nav_layout.module.css";
import { hgTopNavKeyForPath } from "./hg_top_nav_selection";

class HGTopNavLayout extends Component {
  static contextType = HGIAMContext;
  hgMounted = false; // 页面挂载标记；卸载后忽略延迟返回的管理员状态。
  hgLoggingOut = false; // 退出请求进行中，防止重复撤销和清空后续账号的登录态。
  hgConnectionOwner = ""; // 上一次连接状态所属账号；切换账号时不沿用旧状态。
  hgTabHistory = new Map(); // 按路由 entry key 保存展示归属；同 URL 从不同栏目进入时不会互相覆盖。
  /**
   * 构造函数：初始化当前导航选中态和头像浮层状态，并创建浮层容器引用。
   */
  constructor(props) {
    super(props);
    this.state = {
      current: this.getCurrentPage(), // 当前高亮 Tab；直达无明确归属的路径时为空，不默认高亮 Chat。
      showUserDropdown: false, // 头像浮层显示状态，不再修改页面的 Tab 归属。
      hgChatFailed: false, // 仅当前账号实时连接最终失败时标红；消息操作在断线时失败关闭。
      hgProfile: HGUserProfileStorage.getUserProfile(), // 当前标签页展示资料；null 时才读取 IndexedDB。
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
    this.hgMounted = true;
    this.hgUnsubscribeProfile = hgLocalDataService.subscribe(
      HG_STORES.USERS,
      this.hgLoadProfile
    );
    this.hgLoadProfile();
    window.addEventListener(HG_IM_CONNECTION_EVENT, this.hgOnChatConnection);
    window.addEventListener("hg:auth-changed", this.hgResetChatConnection);
  }

  /**
   * 生命周期更新：路由变化时刷新菜单高亮，并自动关闭头像下拉层。
   * @param {object} prevProps 更新前 props。
   */
  componentDidUpdate(prevProps) {
    if (prevProps.location !== this.props.location) {
      this.updateCurrentPage();
      this.setState({ showUserDropdown: false });
    }
  }

  /**
   * 生命周期卸载：移除全局点击监听，避免事件泄漏。
   */
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgUnsubscribeProfile?.();
    window.removeEventListener(HG_IM_CONNECTION_EVENT, this.hgOnChatConnection);
    window.removeEventListener("hg:auth-changed", this.hgResetChatConnection);
    document.removeEventListener("mousedown", this.handleDocumentClick);
  }

  /**
   * 根据当前 pathname 计算菜单高亮 key。
   * @returns {string} 对应 Menu key。
   */
  getCurrentPage = () => {
    const location = this.props.location; // Router 注入的当前历史项，包括同路径不同 query 的 entry。
    const path = location?.pathname || "/"; // 未注入路由时仅按首页处理。
    return (
      this.hgTabHistory.get(location?.key) ??
      hgTopNavKeyForPath(path, ROUTE_PATH) ??
      this.state?.current ??
      ""
    );
  };

  /**
   * 将菜单高亮状态同步为当前路由对应 key。
   */
  updateCurrentPage = () => {
    const current = this.getCurrentPage(); // 新历史项继承来源；POP 使用该项原来记录的归属。
    if (this.props.location?.key)
      this.hgTabHistory.set(this.props.location.key, current);
    this.setState({ current });
  };

  /**
   * 处理顶部菜单点击高亮。
   * @param {{key: string}} e antd Menu 点击事件对象。
   */
  handleClick = (e) => {
    // 高亮只在路由真正变化后更新；修饰键打开新标签页不能改变当前页的 Tab。
    // 从其他路由进入时新页面会自动建连；仅同路由点击才通知存活的 VM，避免重复建连。
    if (
      e.key === "home" &&
      this.props.location?.pathname === ROUTE_PATH.HOME &&
      import.meta.env.MODE === "debug"
    ) {
      window.dispatchEvent(new Event(HG_IM_RECONNECT_EVENT));
    }
  };

  /** 只接受当前账号的安全状态文案；一次失败只弹一次 toast，恢复后清除红色。 */
  hgOnChatConnection = (hgEvent) => {
    const { owner, state, reason } = hgEvent.detail || {};
    if (!owner || owner !== hgIMOwner()) return;
    this.hgConnectionOwner = owner;
    const hgFailed = state === "failed";
    if (hgFailed && !this.state.hgChatFailed)
      message.error(reason || "聊天实时连接失败，请等待 WebSocket 恢复", 8000);
    if (hgFailed || state === "connected" || state === "idle")
      this.setState({ hgChatFailed: hgFailed });
  };

  /** 账号或聊天页关闭时清理旧账号的连接提示。 */
  hgResetChatConnection = () => {
    this.hgConnectionOwner = "";
    if (this.hgMounted) this.setState({ hgChatFailed: false });
  };

  /**
   * 点击头像切换浮层显示状态。
   * 约束：进入账号相关页面时只高亮头像，不自动打开浮层；浮层仅由此点击事件触发。
   */
  toggleUserDropdown = () => {
    this.setState((prevState) => {
      const nextShowUserDropdown = !prevState.showUserDropdown;
      return {
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
    if (
      this.state.showUserDropdown &&
      !this.avatarMenuRef.current?.contains(event.target)
    ) {
      this.setState({
        showUserDropdown: false,
      });
    }
  };

  /**
   * 获取本地缓存用户资料。
   * @returns {Object} 当前可用于页面展示的用户资料；无缓存时返回空对象。
   */
  getUserProfile = () => {
    return this.state.hgProfile || {};
  };

  /** 组件已有资料优先使用；无值时读取与当前账号绑定的本地非敏感字段。 */
  hgLoadProfile = async () => {
    const owner = hgCurrentIAMUser();
    const sessionProfile = HGUserProfileStorage.getUserProfile();
    if (sessionProfile?.user_id === owner) {
      if (this.hgMounted) this.setState({ hgProfile: sessionProfile });
      return;
    }
    if (!owner) {
      if (this.hgMounted) this.setState({ hgProfile: null });
      return;
    }
    const cached = await hgUserRepository.getProfile(owner).catch(() => null);
    if (this.hgMounted && owner === hgCurrentIAMUser())
      this.setState({ hgProfile: cached || null });
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
    return (
      userProfile.signature || userProfile.email || userProfile.phone || ""
    );
  };

  /**
   * 打开个人中心页面。
   * 约束：先关闭浮层，再执行路由跳转。
   */
  gotoUserProfile = () => {
    this.setState({ showUserDropdown: false });
    this.props.pageNavigator.open({ page: PAGE.EDIT_USER_INFO });
  };

  /**
   * 跳转到内容管理页面（投稿、课程管理）。
   * 约束：先关闭浮层，再执行路由跳转。
   */
  gotoPersonalCenter = () => {
    this.setState({ showUserDropdown: false });
    this.props.pageNavigator.open({ page: PAGE.PERSONAL_CENTER });
  };

  /**
   * 退出登录：先撤销本标签页聊天设备，再清除本地登录态。
   * 撤销失败时由用户决定是否仅退出本地登录，不声称已释放设备额度。
   */
  gotoLogoutPage = async () => {
    if (this.hgLoggingOut) return;
    this.hgLoggingOut = true;
    const hgOwner = hgIMOwner(); // 异步撤销期间若账号切换，不清空新账号登录态。
    this.setState({ showUserDropdown: false });
    try {
      if (import.meta.env.MODE === "debug") {
        try {
          await hgRevokeIMDevice();
        } catch {
          message.warning("设备撤销未确认，仍可能占用聊天设备名额。", 8000);
          if (
            !window.confirm(
              "设备撤销失败。是否仅退出本地登录？该设备可能继续占用名额。"
            )
          )
            return;
        }
      }
      if (hgIMOwner() !== hgOwner) return;
      try {
        await hgRevokeIAMLogin();
      } catch {
        message.warning("服务端会话或实时连接撤销未确认。", 8000);
        if (!window.confirm("服务端撤销未确认，是否仅退出本地登录？旧连接可能仍存活。")) return;
      }
      logout();
      this.props.pageNavigator.open({ page: PAGE.LOGIN });
    } finally {
      this.hgLoggingOut = false;
    }
  };

  /**
   * 渲染顶部导航菜单。
   * @param {string} current 当前选中的菜单 key。
   * @returns {React.ReactNode} 顶部菜单节点。
   */
  renderTopMenu = (current) => {
    return (
      <HGMenuPage
        theme="dark"
        mode="horizontal"
        selectedKeys={[current]}
        onClick={this.handleClick}
        className={styles.topMenu}
        items={[
          {
            key: "home",
            label: (
              <Link
                to={ROUTE_PATH.HOME}
                className={`${styles.menuLink} ${
                  this.state.hgChatFailed &&
                  this.hgConnectionOwner === hgIMOwner()
                    ? styles.menuLinkFailed
                    : ""
                }`}
              >
                Chat
              </Link>
            ),
          },
          {
            key: "products",
            label: (
              <Link to={ROUTE_PATH.PRODUCTS} className={styles.menuLink}>
                商品
              </Link>
            ),
          },
          {
            key: "message",
            label: (
              <Link to={ROUTE_PATH.MESSAGE_CENTER} className={styles.menuLink}>
                消息中心
              </Link>
            ),
          },
          ...(this.context?.status === "ready" &&
          [
            HG_PERMISSIONS.IAM_READ,
            HG_PERMISSIONS.USER_READ,
            HG_PERMISSIONS.OPS_METRICS_READ,
            HG_PERMISSIONS.CRAWLER_READ,
            HG_PERMISSIONS.IAM_GRANT,
            HG_PERMISSIONS.OPS_FILE_READ,
            HG_PERMISSIONS.OPS_MENU_READ,
            HG_PERMISSIONS.OPS_TAG_READ,
            HG_PERMISSIONS.ASSET_BALANCE_READ,
            HG_PERMISSIONS.RECHARGE_READ,
            HG_PERMISSIONS.MALL_REVIEW,
            HG_PERMISSIONS.NOTIFICATION_CHANNEL_READ,
          ].some(
            (permission) =>
              hgEvaluateAccess(this.context.snapshot, { permission }).allowed
          )
            ? [
                {
                  key: "operation",
                  label: (
                    <Link
                      to={ROUTE_PATH.OPERATION_MANAGEMENT}
                      className={styles.menuLink}
                    >
                      运维管理
                    </Link>
                  ),
                },
              ]
            : []),
          ...(this.context?.status === "ready" &&
          hgEvaluateAccess(this.context.snapshot, {
            permission: HG_PERMISSIONS.CRAWLER_READ,
          }).allowed
            ? [
                {
                  key: "crawler",
                  label: (
                    <Link
                      to={ROUTE_PATH.CRAWLER_PLATFORM}
                      className={styles.menuLink}
                    >
                      采集平台
                    </Link>
                  ),
                },
              ]
            : []),
          {
            key: "test_module",
            label: (
              <Link to={ROUTE_PATH.TEST_MODULE} className={styles.menuLink}>
                测试模块
              </Link>
            ),
          },
          {
            key: "bili_douga",
            label: (
              <Link to={ROUTE_PATH.BILI_DOUGA} className={styles.menuLink}>
                B站动画
              </Link>
            ),
          },
          {
            key: "profile",
            label: (
              <Link to={ROUTE_PATH.USER_CENTER} className={styles.menuLink}>
                个人中心
              </Link>
            ),
          },
        ]}
      />
    );
  };

  /**
   * 渲染头像按钮及用户下拉菜单。
   * @param {string} current 当前选中的菜单 key。
   * @param {boolean} showUserDropdown 是否显示用户下拉菜单。
   * @returns {React.ReactNode} 头像区域节点。
   */
  renderAvatarMenu = (current, showUserDropdown) => {
    const userProfile = this.getUserProfile();
    const userDisplayName = this.getUserDisplayName(userProfile);
    const userAvatarUrl = this.getUserAvatarUrl(userProfile);
    const avatarText = this.getAvatarText(userDisplayName);
    const userSubtitle = this.getUserSubtitle(userProfile);
    const avatarButtonClassName = `${styles.avatarButton} ${
      current === "avatar" || showUserDropdown ? styles.avatarButtonActive : ""
    }`;

    return (
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
              onClick={this.gotoPersonalCenter}
            >
              内容管理
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
    );
  };

  /**
   * 渲染页面头部，组合 Logo、顶部菜单和头像区域。
   * @param {string} current 当前选中的菜单 key。
   * @param {boolean} showUserDropdown 是否显示用户下拉菜单。
   * @returns {React.ReactNode} 页面头部节点。
   */
  renderHeader = (current, showUserDropdown) => {
    return (
      <Header className={styles.header}>
        <div className={styles.logo} />
        {this.renderTopMenu(current)}
        {this.renderAvatarMenu(current, showUserDropdown)}
      </Header>
    );
  };

  /**
   * 渲染子路由内容容器。
   * @returns {React.ReactNode} 页面内容节点。
   */
  renderContent = () => {
    return (
      <Content className={styles.content}>
        <div className={styles.contentWrapper}>
          <Outlet /> {/* 渲染子路由 */}
        </div>
      </Content>
    );
  };

  /**
   * 渲染页面页脚。
   * @returns {React.ReactNode} 页面页脚节点。
   */
  renderFooter = () => {
    return (
      <Footer style={{ textAlign: "center", padding: "24px 0" }}>
        Ant Design ©2026
      </Footer>
    );
  };

  /**
   * 组件主渲染：顶部导航 + 头像下拉 + 子路由内容容器 + 页脚。
   * @returns {React.ReactNode} 布局根节点。
   */
  render() {
    const { current, showUserDropdown } = this.state;

    return (
      <Layout className={styles.layout}>
        {this.renderHeader(current, showUserDropdown)}
        {this.renderContent()}
        {this.renderFooter()}
      </Layout>
    );
  }
}

export default HGTopNavLayout;
