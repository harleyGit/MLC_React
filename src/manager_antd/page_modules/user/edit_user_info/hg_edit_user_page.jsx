import React from "react";
import { handleError } from "../../../../api/HttpManagerV1";
import { LogOut } from "../../../../logger/hg_logger";
import styles from "./hg_edit_user_page.module.css";
import HGAccountSecurityPage from "./hg_account_security_page";
import HGEditUserPageVM, { MENU_KEYS, MENU_LIST } from "./hg_edit_user_page_vm";

class HGEditUserPage extends React.Component {
  /**
   * 构造函数：初始化页面本地状态与头像 Object URL 缓存引用。
   * 约束：仅维护页面壳、资料表单和头像预览，账号安全由子模块维护。
   */
  constructor(props) {
    super(props);
    this.state = HGEditUserPageVM.createInitialState();
    this.avatarObjectUrl = "";
    this.selectedAvatarFile = null;
  }

  /**
   * 生命周期挂载：进入页面时获取当前用户资料和头像。
   */
  async componentDidMount() {
    try {
      const userInfo = await HGEditUserPageVM.getUserProfile();
      this.setState({
        userProfile: userInfo,
        profileForm: {
          nickName: userInfo.nickname ?? "",
          signature: userInfo.signature ?? "",
          gender: HGEditUserPageVM.genderValueToText(userInfo.gender),
          birthMonth: userInfo.birth_month ?? "",
        },
      });

      const avatarResult = await HGEditUserPageVM.getAvatar();
      if (avatarResult?.avatarUrl) {
        this.setState({
          avatarPreviewUrl: avatarResult.avatarUrl,
        });
      }
    } catch (error) {
      handleError(error);
      this.setState({
        operationTips: "获取用户信息失败，请刷新重试。",
      });
    }
  }

  /**
   * 生命周期卸载：释放头像预览 Object URL，避免浏览器内存泄漏。
   */
  componentWillUnmount() {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
    }
  }

  /**
   * 切换左侧菜单。
   * @param {string} menuKey 目标菜单标识（info/avatar/security）。
   * 约束：只切换一级模块并清空父页面操作提示。
   */
  handleMenuClick = (menuKey) => {
    this.setState({
      activeMenuKey: menuKey,
      operationTips: "",
    });
  };

  /**
   * 同步账号安全子模块更新后的用户资料快照。
   * @param {Object} nextUserProfile 更新后的用户资料对象。
   * 约束：只更新父页面资料快照，避免重置当前菜单和头像状态。
   */
  handleUserProfileChange = (nextUserProfile) => {
    this.setState({
      userProfile: nextUserProfile,
    });
  };

  /**
   * 更新个人资料表单字段。
   * @param {string} fieldName 需要更新的字段名。
   * @param {string} fieldValue 对应字段值。
   * 约束：只更新目标字段，必须保留其余字段现值。
   */
  handleProfileFieldChange = (fieldName, fieldValue) => {
    this.setState((prevState) => {
      return {
        profileForm: {
          ...prevState.profileForm,
          [fieldName]: fieldValue,
        },
      };
    });
  };

  /**
   * 保存个人资料。
   * 约束：调用后端 UpdateProfile 接口，成功后同步最新表单和用户资料快照。
   */
  handleSaveProfile = async () => {
    const { profileForm, userProfile } = this.state;
    const profileData = {
      nickname: profileForm.nickName,
      signature: profileForm.signature,
      gender: HGEditUserPageVM.genderTextToValue(profileForm.gender),
      birth_month: profileForm.birthMonth || undefined,
    };

    try {
      const response = await HGEditUserPageVM.updateUserProfile(profileData);
      LogOut("用户资料响应数据为：", response);
      const newProfileForm = {
        nickName: response.nickname ?? profileForm.nickName,
        signature: response.signature ?? profileForm.signature,
        gender: HGEditUserPageVM.genderValueToText(response.gender) ?? profileForm.gender,
        birthMonth: response.birth_month ?? profileForm.birthMonth,
      };
      this.setState({
        userProfile: {
          ...userProfile,
          ...response,
        },
        profileForm: newProfileForm,
        operationTips: "个人资料已保存成功。",
      });
    } catch (error) {
      handleError(error);
      this.setState({
        operationTips: "个人资料保存失败，请稍后重试。",
      });
    }
  };

  /**
   * 处理头像文件选择并生成预览。
   * @param {Event} event 文件输入控件 change 事件。
   * 约束：仅允许 image/*；每次替换前释放旧 URL；处理后清空 input 值便于重复选择同文件。
   */
  handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.setState({
        operationTips: "请选择图片文件。",
      });
      event.target.value = "";
      return;
    }

    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
    }

    this.avatarObjectUrl = URL.createObjectURL(file);
    this.selectedAvatarFile = file;
    this.setState({
      avatarPreviewUrl: this.avatarObjectUrl,
      operationTips: `已选择头像：${file.name}`,
    });
    event.target.value = "";
  };

  /**
   * 保存头像。
   * 约束：未选择头像时给出阻断提示；调用后端上传接口并同步预览 URL。
   */
  handleSaveAvatar = async () => {
    if (!this.selectedAvatarFile) {
      this.setState({
        operationTips: "请先选择头像图片。",
      });
      return;
    }

    try {
      const result = await HGEditUserPageVM.uploadAvatar(this.selectedAvatarFile);
      LogOut("头像上传结果：", result);
      const newState = {
        operationTips: result.isNew ? "头像已上传成功。" : "头像已存在，直接使用。",
      };
      if (result.avatarUrl) {
        newState.avatarPreviewUrl = result.avatarUrl;
      }
      this.setState(newState);
      this.selectedAvatarFile = null;
    } catch (error) {
      handleError(error);
      this.setState({
        operationTips: "头像保存失败，请稍后重试。",
      });
    }
  };

  /**
   * 渲染左侧菜单区域。
   * @returns {React.ReactNode} 菜单 JSX。
   */
  renderLeftMenu = () => {
    const { activeMenuKey } = this.state;
    return (
      <aside className={styles.menuWrap}>
        <h2 className={styles.menuTitle}>用户中心</h2>
        {MENU_LIST.map((menuItem) => {
          const isActive = activeMenuKey === menuItem.key;
          return (
            <button
              key={menuItem.key}
              type="button"
              className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
              onClick={() => this.handleMenuClick(menuItem.key)}
            >
              {menuItem.label}
            </button>
          );
        })}
      </aside>
    );
  };

  /**
   * 渲染“我的信息”内容区。
   * @returns {React.ReactNode} 信息编辑表单 JSX。
   */
  renderInfoContent = () => {
    const { profileForm } = this.state;
    return (
      <section className={styles.contentBlock}>
        <h3 className={styles.contentTitle}>我的信息</h3>
        <label className={styles.formItem}>
          <span className={styles.formLabel}>修改昵称</span>
          <input
            className={styles.inputControl}
            value={profileForm.nickName}
            maxLength={24}
            onChange={(event) =>
              this.handleProfileFieldChange("nickName", event.target.value)
            }
          />
        </label>
        <label className={styles.formItem}>
          <span className={styles.formLabel}>我的签名</span>
          <textarea
            className={`${styles.inputControl} ${styles.textareaControl}`}
            value={profileForm.signature}
            maxLength={120}
            onChange={(event) =>
              this.handleProfileFieldChange("signature", event.target.value)
            }
          />
        </label>
        <div className={styles.formItem}>
          <span className={styles.formLabel}>性别</span>
          <div className={styles.genderGroup}>
            {["保密", "男", "女"].map((genderValue) => {
              return (
                <label key={genderValue} className={styles.genderOption}>
                  <input
                    type="radio"
                    name="gender"
                    checked={profileForm.gender === genderValue}
                    onChange={() =>
                      this.handleProfileFieldChange("gender", genderValue)
                    }
                  />
                  <span>{genderValue}</span>
                </label>
              );
            })}
          </div>
        </div>
        <label className={styles.formItem}>
          <span className={styles.formLabel}>出生日期</span>
          <input
            type="date"
            className={styles.inputControl}
            value={profileForm.birthMonth}
            onChange={(event) =>
              this.handleProfileFieldChange("birthMonth", event.target.value)
            }
          />
        </label>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={this.handleSaveProfile}
        >
          保存资料
        </button>
      </section>
    );
  };

  /**
   * 渲染“我的头像”内容区。
   * @returns {React.ReactNode} 头像上传与预览 JSX。
   */
  renderAvatarContent = () => {
    const { avatarPreviewUrl } = this.state;
    return (
      <section className={styles.contentBlock}>
        <h3 className={styles.contentTitle}>我的头像</h3>
        <div className={styles.avatarEditor}>
          <div className={styles.avatarPreviewBox}>
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="头像预览"
                className={styles.avatarPreviewImg}
              />
            ) : (
              <span className={styles.avatarPlaceholder}>未上传头像</span>
            )}
          </div>
          <div className={styles.avatarAction}>
            <input
              type="file"
              accept="image/*"
              className={styles.fileControl}
              onChange={this.handleAvatarChange}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={this.handleSaveAvatar}
            >
              保存头像
            </button>
          </div>
        </div>
      </section>
    );
  };

  /**
   * 渲染“账号安全”内容区入口。
   * @returns {React.ReactNode} 独立账号安全子模块。
   */
  renderSecurityContent = () => {
    return (
      <HGAccountSecurityPage
        userProfile={this.state.userProfile}
        onUserProfileChange={this.handleUserProfileChange}
      />
    );
  };

  /**
   * 根据当前菜单渲染右侧主内容。
   * @returns {React.ReactNode} 当前激活模块对应的 JSX。
   */
  renderRightContent = () => {
    const { activeMenuKey } = this.state;
    if (activeMenuKey === MENU_KEYS.AVATAR) {
      return this.renderAvatarContent();
    }
    if (activeMenuKey === MENU_KEYS.SECURITY) {
      return this.renderSecurityContent();
    }
    return this.renderInfoContent();
  };

  /**
   * 组件主渲染：组装整体双栏布局与提示区。
   * @returns {React.ReactNode} 页面根节点 JSX。
   */
  render() {
    const { activeMenuKey, operationTips } = this.state;
    const shouldShowTips = operationTips && activeMenuKey !== MENU_KEYS.SECURITY;
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          {this.renderLeftMenu()}
          <main className={styles.contentWrap}>
            {shouldShowTips ? (
              <div className={styles.operationTips}>{operationTips}</div>
            ) : null}
            {this.renderRightContent()}
          </main>
        </div>
      </div>
    );
  }
}

export default HGEditUserPage;
