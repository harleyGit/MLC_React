/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-04 21:18:23
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_create/hg_role_create_page.jsx
 * @Description: 创建角色页面，渲染角色编码、名称、描述与权限表单并提交创建与权限审批申请
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGTreeSelectPage from "../../../../components/hg_tree_select/hg_tree_select_page";
import HGRoleCreateVM, {
  INITIAL_ROLE_CREATE_FORM_VALUES,
} from "./hg_role_create_vm";
import styles from "./hg_role_create.module.css";

/**
 * 创建角色页面。
 * 职责：收集角色编码、名称、描述与预选权限，调用 VM 完成创建并按需发起权限审批申请。
 * 边界：只负责表单交互与展示；接口常量、数据清洗与提交编排全部下沉在 HGRoleCreateVM，
 *      校验规则也统一从 VM 读取，页面不复制规则细节。
 */
class HGRoleCreatePage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      /** @type {boolean} 创建提交中；置位期间禁用提交按钮，防止重复提交 */
      submitting: false,
      /** @type {Array<Object>} 服务端权威权限目录，供权限树选择使用 */
      permissions: [],
    };
  }

  /** 页面挂载时读取权威权限目录，避免提交前端硬编码的权限码。 */
  componentDidMount() {
    HGRoleCreateVM.fetchPermissions()
      .then((result) => this.setState({ permissions: result?.list || [] }))
      .catch(() => message.error("权限目录加载失败"));
  }

  /**
   * 表单提交处理：清洗字段后调用 VM 提交创建与权限申请。
   * 流程编排在 VM.submitRole，页面只负责结果反馈与表单收尾。
   * @param {Object} values 表单字段值
   */
  handleFinish = (values) => {
    const submitData = HGRoleCreateVM.transformSubmitData(values);

    this.setState({ submitting: true });
    HGRoleCreateVM.submitRole(submitData)
      .then(this.handleSubmitSuccess)
      .catch(this.handleSubmitError)
      .finally(this.handleSubmitSettled);
  };

  /** 提交成功：按是否附带权限申请给出差异提示，并重置表单便于连续创建。 */
  handleSubmitSuccess = (result) => {
    const successText = result?.approvalId
      ? `角色已创建，权限申请 ${result.approvalId} 待审批`
      : "空权限角色创建成功";
    message.success(successText);
    if (this.formRef.current) {
      this.formRef.current.resetFields();
    }
  };

  /** 提交失败：优先透出后端错误文案，保留表单内容便于修正后重试。 */
  handleSubmitError = (error) => {
    message.error(error?.message || "角色创建失败，请稍后重试");
  };

  /** 提交结束：无论成败都解除提交中状态，恢复按钮可点击。 */
  handleSubmitSettled = () => {
    this.setState({ submitting: false });
  };

  /**
   * 重置创建角色表单。
   * 约束：仅恢复初始值，不触发提交或校验。
   */
  handleReset = () => {
    if (this.formRef.current) {
      this.formRef.current.resetFields();
    }
  };

  /**
   * 将服务端权限目录映射为树选择节点。
   * 约束：title 展示“权限码 · 描述”便于检索，value 固定为权限码，与提交契约保持一致。
   * @returns {Array<{title: string, value: string}>} 权限树节点列表
   */
  buildPermissionTreeData = () =>
    this.state.permissions.map((item) => ({
      title: `${item.code} · ${item.description}`,
      value: item.code,
    }));

  /**
   * 渲染角色编码字段。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色编码表单项
   */
  renderCodeField = (rules) => (
    <Item label="角色编码" name="code" rules={rules.code}>
      <HGInputPage allowClear maxLength={64} placeholder="例如 content_editor" className={styles.roleCreateInput} />
    </Item>
  );

  /**
   * 渲染角色名称字段。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色名称表单项
   */
  renderNameField = (rules) => (
    <Item label="角色名称" name="name" rules={rules.name}>
      <HGInputPage
        allowClear
        maxLength={64}
        placeholder="请输入角色名称，如：运营主管"
        className={styles.roleCreateInput}
      />
    </Item>
  );

  /**
   * 渲染角色描述字段。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色描述表单项
   */
  renderDescriptionField = (rules) => (
    <Item
      label="角色描述"
      name="description"
      rules={rules.description}
      extra="建议说明角色可操作的业务域，例如“可审核视频与弹幕，不可操作商城订单”。"
    >
      <HGInputTextArea
        maxLength={255}
        rows={4}
        placeholder="请输入角色职责说明，可为空"
        className={styles.roleCreateTextArea}
      />
    </Item>
  );

  /**
   * 渲染角色权限字段：权限从服务端目录选择，创建后另行提交双人审批申请。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色权限表单项
   */
  renderPermissionsField = (rules) => (
    <Item
      label="角色权限"
      name="permissions"
      rules={rules.permissions}
      extra="权限需经双人审批通过后才会生效，审批不影响角色本身创建。"
    >
      <HGTreeSelectPage
        treeData={this.buildPermissionTreeData()}
        placeholder="请选择权限（可多选）"
        allowClear
        treeCheckable
        treeDefaultExpandAll
        showCheckedStrategy="SHOW_CHILD"
      />
    </Item>
  );

  /**
   * 渲染 MFA 验证码字段：仅在申请角色权限时需要。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} MFA 验证码表单项
   */
  renderMFAField = (rules) => (
    <Item
      label="申请人 MFA 验证码"
      name="mfaCode"
      rules={rules.mfaCode}
      extra="仅勾选角色权限时需要，用于校验申请人身份并发起审批。"
    >
      <HGInputPage maxLength={6} placeholder="选择权限时输入验证器 6 位验证码" className={styles.roleCreateInput} />
    </Item>
  );

  /**
   * 渲染提交和重置按钮。
   * @returns {React.ReactNode} 操作按钮区域
   */
  renderActions = () => {
    const { submitting } = this.state;

    return (
      <div className={styles.roleCreateActions}>
        <HGButtonPage
          type="primary"
          htmlType="submit"
          loading={submitting}
          className={styles.roleCreateButton}
        >
          创建角色
        </HGButtonPage>
        <HGButtonPage onClick={this.handleReset} className={styles.roleCreateButton}>
          重置
        </HGButtonPage>
      </div>
    );
  };

  /**
   * 渲染创建角色表单：按“基础信息 -> 权限 -> 验证”顺序组装各字段。
   * @returns {React.ReactNode} 表单节点
   */
  renderForm = () => {
    const rules = HGRoleCreateVM.getFormRules();

    return (
      <Form
        ref={this.formRef}
        layout="vertical"
        initialValues={INITIAL_ROLE_CREATE_FORM_VALUES}
        onFinish={this.handleFinish}
      >
        {this.renderCodeField(rules)}
        {this.renderNameField(rules)}
        {this.renderDescriptionField(rules)}
        {this.renderPermissionsField(rules)}
        {this.renderMFAField(rules)}
        {this.renderActions()}
      </Form>
    );
  };

  render() {
    return (
      <div className={styles.roleCreateContainer}>
        <HGPageHeaderPage
          title="创建角色"
          description="定义平台角色并预选权限；勾选权限后提交时将发起双人审批申请，审批通过后权限才对绑定用户生效。"
        />
        <HGCardPage title="角色信息">{this.renderForm()}</HGCardPage>
      </div>
    );
  }
}

export default HGRoleCreatePage;
