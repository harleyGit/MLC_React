import React from "react";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGAddressBookVM, { ADDRESS_FIELD_LIMIT } from "./hg_address_book_vm";
import { HG_REGION_PROVINCES, hgFindProvince } from "./hg_region_data";
import styles from "./hg_address_form_modal.module.css";

/**
 * 收货地址新建/编辑弹窗。
 * 职责：维护弹窗内表单状态并做前置校验，接口调用与列表刷新由页面负责。
 * 约束：组件只在打开时挂载，关闭即卸载，避免上一次编辑内容残留到下一次。
 */
class HGAddressFormModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      form: HGAddressBookVM.addressToForm(props.address), // 表单值；新建时为空表单。
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
        // 省市任一变化都重新校验地区组合，清空地区错误避免旧提示残留。
        ...(fieldName === "provinceCode" || fieldName === "cityCode" ? { region: "" } : {}),
      },
    }));
  };

  /**
   * 切换省份：城市必须重选，防止出现跨省的省市组合。
   * @param {string} provinceCode 省级行政区划代码。
   */
  handleProvinceChange = (provinceCode) => {
    this.setState((previousState) => ({
      form: {
        ...previousState.form,
        provinceCode,
        cityCode: "",
      },
      errors: {
        ...previousState.errors,
        region: "",
      },
    }));
  };

  /**
   * 提交校验通过后把请求体交给页面；校验失败只更新行内错误。
   */
  handleSubmit = () => {
    const { submitting, onSubmit } = this.props;
    if (submitting) {
      return;
    }
    const { errors, addressInput } = HGAddressBookVM.validateForm(this.state.form);
    if (addressInput === null) {
      this.setState({ errors });
      return;
    }
    onSubmit?.(addressInput, { setDefault: this.state.form.setDefault });
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
   * 渲染收件人与手机号。
   * @returns {React.ReactNode} 两行输入框 JSX。
   */
  renderContactFields = () => {
    const { form, errors } = this.state;
    return (
      <>
        {this.renderField(
          "收件人",
          <input
            className={`${styles.control} ${errors.receiverName ? styles.controlError : ""}`}
            value={form.receiverName}
            maxLength={ADDRESS_FIELD_LIMIT.receiverName}
            placeholder="请填写真实姓名"
            autoComplete="name"
            onChange={(event) => this.handleFieldChange("receiverName", event.target.value)}
          />,
          errors.receiverName
        )}
        {this.renderField(
          "手机号",
          <input
            className={`${styles.control} ${errors.receiverPhone ? styles.controlError : ""}`}
            value={form.receiverPhone}
            maxLength={11}
            inputMode="numeric"
            placeholder="请输入 11 位手机号"
            autoComplete="tel"
            onChange={(event) =>
              this.handleFieldChange("receiverPhone", event.target.value.replace(/\D/g, ""))
            }
          />,
          errors.receiverPhone,
          "用于快递派送联系，请填写可接听号码"
        )}
      </>
    );
  };

  /**
   * 渲染省市二级联动。
   * @returns {React.ReactNode} 地区选择 JSX。
   */
  renderRegionFields = () => {
    const { form, errors } = this.state;
    const province = hgFindProvince(form.provinceCode);
    const cityOptions = province?.cities ?? [];
    return (
      <div className={styles.field}>
        <span className={styles.label}>所在地区</span>
        <div className={styles.regionRow}>
          <select
            className={`${styles.control} ${errors.region ? styles.controlError : ""}`}
            value={form.provinceCode}
            onChange={(event) => this.handleProvinceChange(event.target.value)}
          >
            <option value="">请选择省份</option>
            {HG_REGION_PROVINCES.map((provinceItem) => (
              <option key={provinceItem.code} value={provinceItem.code}>
                {provinceItem.name}
              </option>
            ))}
          </select>
          <select
            className={`${styles.control} ${errors.region ? styles.controlError : ""}`}
            value={form.cityCode}
            disabled={!province}
            onChange={(event) => this.handleFieldChange("cityCode", event.target.value)}
          >
            <option value="">{province ? "请选择城市" : "请先选择省份"}</option>
            {cityOptions.map((cityItem) => (
              <option key={cityItem.code} value={cityItem.code}>
                {cityItem.name}
              </option>
            ))}
          </select>
        </div>
        {errors.region ? <span className={styles.errorText}>{errors.region}</span> : null}
      </div>
    );
  };

  /**
   * 渲染详细地址与默认地址勾选。
   * @returns {React.ReactNode} 文本域与勾选 JSX。
   */
  renderDetailFields = () => {
    const { form, errors } = this.state;
    return (
      <>
        {this.renderField(
          "详细地址",
          <textarea
            className={`${styles.control} ${styles.textarea} ${errors.detailAddress ? styles.controlError : ""}`}
            value={form.detailAddress}
            maxLength={ADDRESS_FIELD_LIMIT.detailAddress}
            placeholder="街道、门牌号、楼栋与房间号"
            onChange={(event) => this.handleFieldChange("detailAddress", event.target.value)}
          />,
          errors.detailAddress,
          `还可以输入 ${ADDRESS_FIELD_LIMIT.detailAddress - form.detailAddress.length} 个字符`
        )}
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.setDefault}
            onChange={(event) => this.handleFieldChange("setDefault", event.target.checked)}
          />
          <span>保存后设为默认地址</span>
        </label>
      </>
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
        <button type="button" className={styles.cancelButton} disabled={submitting} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={styles.submitButton} disabled={submitting} onClick={this.handleSubmit}>
          {submitting ? "保存中…" : "保存地址"}
        </button>
      </div>
    );
  };

  render() {
    const { address, submitting, onCancel } = this.props;
    return (
      <HGModalPage
        visible
        size="large"
        title={address ? "编辑收货地址" : "新建收货地址"}
        closable={!submitting}
        onClose={onCancel}
        footer={this.renderFooter()}
      >
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            this.handleSubmit();
          }}
        >
          {this.renderContactFields()}
          {this.renderRegionFields()}
          {this.renderDetailFields()}
        </form>
      </HGModalPage>
    );
  }
}

export default HGAddressFormModal;
