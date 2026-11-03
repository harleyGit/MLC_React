import React from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGModalPage from "../../../components/hg_modal/hg_modal_page";
import styles from "./hg_user_edit_modal.module.css";

/** 性别选项：与后端 gender 编码一致（1 男 / 2 女，其余按保密处理）。 */
const HG_GENDER_OPTIONS = [
  { value: 0, label: "保密" },
  { value: 1, label: "男" },
  { value: 2, label: "女" },
];

const HG_SIGNATURE_MAX_LENGTH = 200; // 签名输入上限；后端仍会做最终校验。

/**
 * 用户资料编辑弹窗。
 * 职责：维护表单状态与前置校验；接口调用、提交状态与列表刷新由页面负责。
 * 约束：仅在打开时挂载，关闭即卸载，避免上一次编辑内容残留到下一次。
 */
class HGUserEditModal extends React.Component {
  constructor(props) {
    super(props);
    const user = props.user || {};
    this.state = {
      form: {
        nickname: user.nickname ?? user.user_name ?? "",
        gender: Number.isFinite(Number(user.gender)) ? Number(user.gender) : 0,
        signature: user.signature ?? "",
      },
      errors: {}, // 字段级错误文案。
    };
  }

  /**
   * 更新单个表单字段并清除该字段错误。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段新值。
   */
  handleFieldChange = (fieldName, fieldValue) => {
    this.setState((previousState) => ({
      form: {
        ...previousState.form,
        [fieldName]: fieldValue,
      },
      errors: {
        ...previousState.errors,
        [fieldName]: "",
      },
    }));
  };

  /**
   * 提交校验：昵称必填；通过后把请求体交给页面调用接口。
   */
  handleSubmit = () => {
    const { submitting, onSubmit } = this.props;
    if (submitting) {
      return;
    }
    const nickname = this.state.form.nickname.trim();
    if (!nickname) {
      this.setState({ errors: { nickname: "请输入昵称" } });
      return;
    }
    onSubmit?.({
      nickname,
      gender: this.state.form.gender,
      signature: this.state.form.signature.trim(),
    });
  };

  /**
   * 渲染单行字段容器。
   * @param {string} label 字段名称。
   * @param {React.ReactNode} control 受控控件。
   * @param {string} [error] 字段错误文案。
   * @param {string} [extra] 字段补充说明。
   * @returns {React.ReactNode} 字段行 JSX。
   */
  renderField = (label, control, error, extra) => {
    return (
      <label className={styles.field}>
        <span className={styles.label}>{label}</span>
        {control}
        {error ? <span className={styles.errorText}>{error}</span> : null}
        {!error && extra ? <span className={styles.extraText}>{extra}</span> : null}
      </label>
    );
  };

  /**
   * 渲染编辑表单：昵称、性别与个性签名。
   * @returns {React.ReactNode} 表单 JSX。
   */
  renderForm = () => {
    const { form, errors } = this.state;
    return (
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          this.handleSubmit();
        }}
      >
        {this.renderField(
          "昵称",
          <input
            className={`${styles.control} ${errors.nickname ? styles.controlError : ""}`}
            value={form.nickname}
            maxLength={30}
            placeholder="请输入昵称"
            onChange={(event) => this.handleFieldChange("nickname", event.target.value)}
          />,
          errors.nickname
        )}
        {this.renderField(
          "性别",
          <select
            className={styles.control}
            value={form.gender}
            onChange={(event) => this.handleFieldChange("gender", Number(event.target.value))}
          >
            {HG_GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {this.renderField(
          "个性签名",
          <textarea
            className={`${styles.control} ${styles.textarea}`}
            value={form.signature}
            maxLength={HG_SIGNATURE_MAX_LENGTH}
            rows={4}
            placeholder="介绍一下自己"
            onChange={(event) => this.handleFieldChange("signature", event.target.value)}
          />,
          null,
          `还可以输入 ${HG_SIGNATURE_MAX_LENGTH - form.signature.length} 个字符`
        )}
      </form>
    );
  };

  /**
   * 渲染弹窗底部按钮。
   * @returns {React.ReactNode} 底部 JSX。
   */
  renderFooter = () => {
    const { submitting, onCancel } = this.props;
    return (
      <div className={styles.footer}>
        <HGButtonPage disabled={submitting} onClick={onCancel}>
          取消
        </HGButtonPage>
        <HGButtonPage type="primary" loading={submitting} onClick={this.handleSubmit}>
          保存
        </HGButtonPage>
      </div>
    );
  };

  render() {
    const { user, submitting, onCancel } = this.props;
    return (
      <HGModalPage
        visible
        size="small"
        title={user ? `编辑用户：${user.user_name ?? ""}` : "编辑用户"}
        closable={!submitting}
        onClose={onCancel}
        footer={this.renderFooter()}
      >
        {this.renderForm()}
      </HGModalPage>
    );
  }
}

export default HGUserEditModal;
