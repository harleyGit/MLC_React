/*
 * 用户资料编辑页：由用户列表「编辑」按钮携带 user_id 跳转进入。
 * 路由参数 userId 指定编辑目标，location.state.user 提供资料回填；仅保存资料。
 * 「返回」通过浏览器后退（navigate(-1)）回到来源页。
 */
import React, { Component } from "react";
import { handleError } from "../../../api/HttpManagerV1";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../components/hg_page_header/hg_page_header_page";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import HGUserVM from "./hg_user_vm";
import styles from "./hg_user_edit_role.module.css";

/** 性别选项：与后端 gender 编码一致（1 男 / 2 女，其余按保密处理）。 */
const HG_GENDER_OPTIONS = [
  { value: 0, label: "保密" },
  { value: 1, label: "男" },
  { value: 2, label: "女" },
];

const HG_SIGNATURE_MAX_LENGTH = 200; // 签名输入上限；后端仍会做最终校验。

class HGUserEditRolePage extends Component {
  constructor(props) {
    super(props);
    // 编辑目标用户由列表页通过 location.state 带入，用于表单回填与安全字段比对。
    const user = props.location?.state?.user || {};
    // 路由参数指定编辑目标 ID；没有参数时使用列表带入的 user_id。
    this.userId = String(props.params?.userId ?? user.user_id ?? "").trim();
    this.hgMounted = false; // 挂载标记，防止卸载后的资料响应更新页面。
    this.state = {
      user, // 列表传入的编辑目标资料；缺省为空对象，不作为授权目标来源。
      // 资料编辑受控表单：空字符串表示用户未设置该项；仅手机号/邮箱变化时发送安全字段请求。
      profileForm: {
        nickname: user.nickname ?? user.user_name ?? "",
        gender: Number.isFinite(Number(user.gender)) ? Number(user.gender) : 0,
        signature: user.signature ?? "",
        avatar_url: user.avatar_url ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
      },
      profileErrors: {}, // 资料表单字段级错误文案；空对象表示尚无错误。
      saving: false, // 主提交按钮加载状态。
    };
  }

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

  /** 返回来源页；配合运维页选中态持久化，后退后停留在原「用户列表」子菜单。 */
  handleBack = () => {
    if (this.props.navigate) {
      this.props.navigate(-1);
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  /**
   * 更新资料表单单个字段并清除该字段错误。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段新值。
   */
  handleProfileFieldChange = (fieldName, fieldValue) => {
    this.setState((previousState) => ({
      profileForm: {
        ...previousState.profileForm,
        [fieldName]: fieldValue,
      },
      profileErrors: {
        ...previousState.profileErrors,
        [fieldName]: "",
      },
    }));
  };

  /** 校验资料表单；昵称必填，联系方式与头像按变化量校验，返回是否通过。 */
  validateProfile = () => {
    const { profileForm, user } = this.state;
    const nickname = profileForm.nickname.trim();
    const phone = profileForm.phone.trim();
    const email = profileForm.email.trim();
    const avatarURL = profileForm.avatar_url.trim();
    const errors = {};
    if (!nickname) errors.nickname = "请输入昵称";
    if (phone !== (user?.phone ?? "") && !/^1\d{10}$/.test(phone)) {
      errors.phone = "请输入 11 位手机号";
    }
    if (email !== (user?.email ?? "") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "请输入有效的邮箱地址";
    }
    if (avatarURL && !/^https?:\/\//i.test(avatarURL) && !avatarURL.startsWith("/uploads/")) {
      errors.avatar_url = "头像 URL 需为 HTTPS/HTTP 地址或 /uploads/ 路径";
    }
    this.setState({ profileErrors: errors });
    return Object.keys(errors).length === 0;
  };

  /** 校验并保存用户资料；角色授权在员工角色页独立提交。 */
  handleSubmit = async () => {
    if (this.state.saving || !this.validateProfile()) return;
    const { profileForm, user } = this.state;
    this.setState({ saving: true });
    try {
      await HGUserVM.updateUserByUserId({
        userId: this.userId,
        previousPhone: user?.phone,
        previousEmail: user?.email,
        nickname: profileForm.nickname.trim(),
        gender: profileForm.gender,
        signature: profileForm.signature.trim(),
        avatar_url: profileForm.avatar_url.trim(),
        phone: profileForm.phone.trim(),
        email: profileForm.email.trim(),
      });
      if (this.hgMounted) message.success("用户资料已更新");
    } catch (error) {
      if (this.hgMounted) handleError(error);
    } finally {
      if (this.hgMounted) this.setState({ saving: false });
    }
  };

  /**
   * 渲染资料表单单行字段容器。
   * @param {string} label 字段名称。
   * @param {React.ReactNode} control 受控控件。
   * @param {string} [error] 字段错误文案。
   * @param {string} [extra] 字段补充说明。
   * @returns {React.ReactNode} 字段行 JSX。
   */
  renderProfileField = (label, control, error, extra) => (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {control}
      {error ? <span className={styles.errorText}>{error}</span> : null}
      {!error && extra ? <span className={styles.extraText}>{extra}</span> : null}
    </label>
  );

  /** 渲染资料编辑区块：公开资料与账号联系方式；联系方式变化走独立安全接口。 */
  renderProfileForm = () => {
    const { profileForm, profileErrors } = this.state;
    return (
      <HGCardPage title="基本资料" className={styles.card}>
        <div className={styles.formGrid}>
          {this.renderProfileField(
            "昵称",
            <input
              className={`${styles.control} ${profileErrors.nickname ? styles.controlError : ""}`}
              value={profileForm.nickname}
              maxLength={30}
              placeholder="请输入昵称"
              onChange={(event) => this.handleProfileFieldChange("nickname", event.target.value)}
            />,
            profileErrors.nickname
          )}
          {this.renderProfileField(
            "性别",
            <select
              className={styles.control}
              value={profileForm.gender}
              onChange={(event) => this.handleProfileFieldChange("gender", Number(event.target.value))}
            >
              {HG_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {this.renderProfileField(
            "手机号",
            <input
              className={`${styles.control} ${profileErrors.phone ? styles.controlError : ""}`}
              type="tel"
              value={profileForm.phone}
              maxLength={32}
              placeholder="请输入手机号"
              onChange={(event) => this.handleProfileFieldChange("phone", event.target.value)}
            />,
            profileErrors.phone
          )}
          {this.renderProfileField(
            "邮箱",
            <input
              className={`${styles.control} ${profileErrors.email ? styles.controlError : ""}`}
              type="email"
              value={profileForm.email}
              maxLength={255}
              placeholder="请输入邮箱"
              onChange={(event) => this.handleProfileFieldChange("email", event.target.value)}
            />,
            profileErrors.email,
            "管理员修改他人联系方式将写入审计记录"
          )}
          {this.renderProfileField(
            "头像 URL",
            <input
              className={`${styles.control} ${profileErrors.avatar_url ? styles.controlError : ""}`}
              value={profileForm.avatar_url}
              maxLength={512}
              placeholder="/uploads/user/avatar.png"
              onChange={(event) => this.handleProfileFieldChange("avatar_url", event.target.value)}
            />,
            profileErrors.avatar_url
          )}
          {this.renderProfileField(
            "个性签名",
            <textarea
              className={`${styles.control} ${styles.textarea}`}
              value={profileForm.signature}
              maxLength={HG_SIGNATURE_MAX_LENGTH}
              rows={4}
              placeholder="介绍一下自己"
              onChange={(event) => this.handleProfileFieldChange("signature", event.target.value)}
            />,
            null,
            `还可以输入 ${HG_SIGNATURE_MAX_LENGTH - profileForm.signature.length} 个字符`
          )}
        </div>
      </HGCardPage>
    );
  };

  render() {
    const { saving } = this.state;
    return (
      <div className={styles.pageContainer}>
        <HGPageHeaderPage
          title="编辑用户"
          description="修改用户基本资料；角色授权请前往员工角色管理。"
          extra={
            <HGButtonPage onClick={this.handleBack}>返回</HGButtonPage>
          }
        />
        {this.renderProfileForm()}
        <div className={styles.footerBar}>
          <HGButtonPage type="primary" loading={saving} onClick={this.handleSubmit}>
            保存
          </HGButtonPage>
        </div>
      </div>
    );
  }
}

// 注入路由能力：params 提供编辑目标 userId，location.state 提供资料回填。
const HGUserEditRolePageWithNavigation = WithNavigation(HGUserEditRolePage);

export default HGUserEditRolePageWithNavigation;
