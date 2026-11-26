/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-04 21:18:23
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_create/hg_role_create_page.jsx
 * @Description: 角色表单页面，以创建/编辑模式复用角色编码、名称、描述与权限表单
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGTreeSelectPage from "../../../../components/hg_tree_select/hg_tree_select_page";
import HGRoleCreateVM, {
  INITIAL_ROLE_CREATE_FORM_VALUES,
} from "./hg_role_create_vm";
import styles from "./hg_role_create.module.css";

/**
 * 角色表单页面。
 * 职责：创建时收集全量角色数据；编辑时回填所选角色并按变化提交基础信息和权限审批。
 * 边界：只负责表单交互与展示；接口常量、数据清洗与提交编排全部下沉在 HGRoleCreateVM，
 *      校验规则也统一从 VM 读取，页面不复制规则细节。
 */
class HGRoleCreatePage extends Component {
  static defaultProps = {
    /** 页面模式 key，默认创建角色；role_edit 表示编辑同一套表单。 */
    selectedKey: "role_create",
    /** 路由位置由运维容器注入；默认 undefined 表示没有编辑回填数据。 @type {Object|undefined} */
    location: undefined,
    /** 返回上一层页面的回调由运维容器注入；默认 undefined 时返回按钮不操作。 @type {Function|undefined} */
    onBack: undefined,
  };

  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.returnAfterSubmit = false; // 编辑成功后在提交状态收尾完成再返回，避免卸载后继续 setState。
    this.hgSubmitting = false; // 同步防重入标记；React 批量更新 submitting 前也只能发送一次。
    this.state = {
      /** @type {boolean} 创建或编辑提交中；置位期间禁用提交按钮，防止重复提交 */
      submitting: false,
      /** @type {Array<Object>} 服务端权威权限目录，供权限树选择使用 */
      permissions: [],
      /** @type {Array<string>} 编辑页初次加载的权限快照；创建页固定为空数组 */
      initialPermissions: [],
      /** @type {boolean} 权限目录及角色权限加载中；加载完成前禁止提交 */
      permissionsLoading: true,
      /** @type {string} 编辑回填或权限目录错误；空字符串表示当前可编辑 */
      loadError: "",
      /** @type {Object|null} 已通过主表单校验的待确认草稿；null 表示弹窗关闭，不存放 MFA */
      pendingSubmitData: null,
      /** @type {string} 当前弹窗输入的 6 位一次性验证码；空字符串表示未输入，取消或提交时清空 */
      mfaCode: "",
      /** @type {string} 弹窗内 MFA 校验反馈；空字符串表示无需展示错误 */
      mfaError: "",
    };
  }

  /** 当前是否为角色编辑模式。 */
  isEditMode = () => this.props.selectedKey === "role_edit";

  /**
   * 读取列表页放入当前 history state 的角色快照，并与 URL 中的角色 ID 交叉核对。
   * 服务端仍负责最终对象权限校验；该快照只用于表单回填，不作为授权依据。
   */
  getEditRole = () => {
    if (!this.isEditMode()) return null;
    const roleId = new URLSearchParams(this.props.location?.search || "").get(
      "roleId"
    );
    const role = this.props.location?.state?.role;
    if (!roleId || !role || String(role.id) !== roleId) return null;
    return {
      id: roleId,
      code: String(role.code || ""),
      name: String(role.name || ""),
      description: String(role.description || ""),
      builtIn: Boolean(role.builtIn), // 列表快照只控制表单交互；写入仍以服务端角色状态为准。
    };
  };

  /** 表单初始值：创建始终为空；编辑仅采用经过角色 ID 核对的列表快照。 */
  getInitialFormValues = () => {
    const role = this.getEditRole();
    if (!role) return { ...INITIAL_ROLE_CREATE_FORM_VALUES };
    return {
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: this.state.initialPermissions,
    };
  };

  /** 页面挂载时读取权威权限目录；编辑模式同时读取当前角色的已选权限并回填。 */
  componentDidMount() {
    const role = this.getEditRole();
    if (this.isEditMode() && !role) {
      this.setState({
        permissionsLoading: false,
        loadError: "缺少有效的角色回填数据，请返回角色列表后重新编辑",
      });
      return;
    }
    return HGRoleCreateVM.fetchPermissions(role?.id)
      .then((result) => {
        const selected = this.isEditMode() ? result?.selected || [] : [];
        this.setState(
          {
            permissions: result?.list || [],
            initialPermissions: selected,
            permissionsLoading: false,
          },
          () => {
            this.formRef.current?.setFieldsValue({
              permissions: selected,
            });
          }
        );
      })
      .catch(() => {
        const loadError = this.isEditMode()
          ? "角色权限加载失败，请返回列表后重试"
          : "权限目录加载失败，请稍后重试";
        this.setState({ permissionsLoading: false, loadError });
        message.error(loadError);
      });
  }

  /**
   * 主表单校验通过后只暂存当前草稿；用户在弹窗确认前不得创建或更新角色。
   * @param {Object} values 表单字段值
   */
  handleFinish = (values) => {
    const { permissionsLoading, pendingSubmitData, submitting, loadError } = this.state;
    if (permissionsLoading || loadError) {
      message.error(loadError || "角色数据仍在加载，请稍后再试");
      return;
    }
    if (submitting || this.hgSubmitting || pendingSubmitData) return;
    const submitData = HGRoleCreateVM.transformSubmitData({ ...values, mfaCode: "" });
    const editRole = this.getEditRole();
    if (this.isEditMode() && !editRole) {
      message.error("角色回填数据无效，请返回列表后重试");
      return;
    }

    this.setState({
      pendingSubmitData: this.isEditMode() ? { ...submitData, id: editRole.id } : submitData,
      mfaCode: "",
      mfaError: "",
    });
  };

  /** 关闭弹窗即丢弃草稿与 MFA；不会触发任何角色写入。 */
  handleCancelSubmit = () => {
    if (this.hgSubmitting || this.state.submitting) return;
    this.setState({ pendingSubmitData: null, mfaCode: "", mfaError: "" });
  };

  /** 是否需要申请角色权限；只更新基础信息时现有接口不校验 MFA。 */
  requiresMFA = (submitData) => this.isEditMode()
    ? HGRoleCreateVM.permissionsChanged(this.state.initialPermissions, submitData.permissions)
    : submitData.permissions.length > 0;

  /** 确认时校验本次 MFA 后才启动 VM 编排；失败也不保留一次性验证码。 */
  handleConfirmSubmit = () => {
    const { pendingSubmitData, mfaCode, initialPermissions } = this.state;
    if (!pendingSubmitData || this.hgSubmitting || this.state.submitting) return;
    const mfaRule = HGRoleCreateVM.getFormRules().mfaCode[0]; // 与 VM 的 6 位数字规则保持一致。
    if (this.requiresMFA(pendingSubmitData) && !mfaRule.pattern.test(mfaCode)) {
      this.setState({ mfaError: mfaRule.message });
      return;
    }
    this.hgSubmitting = true;
    const submitData = { ...pendingSubmitData, mfaCode }; // 仅当前确认动作携带验证码。
    this.setState({ submitting: true, pendingSubmitData: null, mfaCode: "", mfaError: "" });
    const request = this.isEditMode()
      ? HGRoleCreateVM.submitRoleEdit(submitData, initialPermissions, this.getEditRole())
      : HGRoleCreateVM.submitRole(submitData);
    return request
      .then(this.handleSubmitSuccess)
      .catch(this.handleSubmitError)
      .finally(this.handleSubmitSettled);
  };

  /** 提交成功：创建页清空表单；编辑页在状态收尾后返回列表。 */
  handleSubmitSuccess = (result) => {
    if (this.isEditMode()) {
      const successText = result?.approvalId
        ? result?.metadataUpdated === false
          ? `权限申请 ${result.approvalId} 待审批`
          : `角色已更新，权限申请 ${result.approvalId} 待审批`
        : result?.unchanged ? "角色信息与权限未变化，无需提交" : "角色更新成功";
      message.success(successText);
      this.returnAfterSubmit = true;
      return;
    }
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
    const fallback = this.isEditMode()
      ? "角色更新失败，请稍后重试"
      : "角色创建失败，请稍后重试";
    message.error(error?.message || fallback);
  };

  /** 提交结束：先恢复按钮状态；编辑成功时随后返回，避免卸载后更新状态。 */
  handleSubmitSettled = () => {
    this.hgSubmitting = false;
    this.setState({ submitting: false }, () => {
      if (this.returnAfterSubmit) {
        this.returnAfterSubmit = false;
        this.props.onBack?.();
      }
    });
  };

  /**
   * 重置创建角色表单。
   * 约束：仅恢复初始值，不触发提交或校验。
   */
  handleReset = () => {
    if (this.hgSubmitting || this.state.submitting) return;
    this.handleCancelSubmit();
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
   * 仅将后端目录已经登记的系统通知模板权限写入当前表单选择。
   * 不发起授权；创建或编辑提交仍须申请人 MFA 和 IAM 双人审批。
   */
  handleNotificationTemplatePreset = () => {
    if (this.state.permissionsLoading || this.state.loadError || this.state.submitting) return;
    const role = this.getEditRole(); // 内置角色中仅运维角色可以申请权限变更。
    if (role?.builtIn && role.code !== "ops_engineer") return;
    const form = this.formRef.current; // 当前角色的受控表单；未挂载时不能修改权限。
    if (!form) return;
    try {
      const selected = form.getFieldValue("permissions") || []; // 以用户当前勾选值为准，保留其他业务权限。
      const permissions = HGRoleCreateVM.selectNotificationTemplatePermissions(this.state.permissions, selected);
      form.setFieldsValue({ permissions });
      message.success("已预选系统通知模板管理权限，提交后仍需 MFA 和另一名管理员审批");
    } catch (error) {
      message.error(error?.message || "通知模板权限预选失败");
    }
  };

  /**
   * 渲染角色编码字段。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色编码表单项
   */
  renderCodeField = (rules) => (
    <Item label="角色编码" name="code" rules={rules.code}>
      <HGInputPage
        allowClear={!this.isEditMode()}
        disabled={this.isEditMode()}
        maxLength={64}
        placeholder="例如 content_editor"
        className={styles.roleCreateInput}
      />
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
        disabled={Boolean(this.getEditRole()?.builtIn)}
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
        disabled={Boolean(this.getEditRole()?.builtIn)}
        maxLength={255}
        rows={4}
        placeholder="请输入角色职责说明，可为空"
        className={styles.roleCreateTextArea}
      />
    </Item>
  );

  /**
   * 渲染角色权限字段：权限从服务端目录选择，新增或变更权限时另行提交双人审批申请。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色权限表单项
   */
  renderPermissionsField = (rules) => (
    <>
      <Item
        label="角色权限"
        name="permissions"
        rules={rules.permissions}
        extra="新增或变更权限需经双人审批通过后才会生效，基础信息与权限审批分别处理。"
      >
        <HGTreeSelectPage
          treeData={this.buildPermissionTreeData()}
          placeholder="请选择权限（可多选）"
          disabled={this.state.permissionsLoading || Boolean(this.state.loadError) ||
            (this.getEditRole()?.builtIn && this.getEditRole()?.code !== "ops_engineer")}
          allowClear
          treeCheckable
          treeDefaultExpandAll
          showCheckedStrategy="SHOW_CHILD"
        />
      </Item>
      <div className={styles.rolePermissionPreset}>
        <HGButtonPage
          onClick={this.handleNotificationTemplatePreset}
          disabled={this.state.permissionsLoading || Boolean(this.state.loadError) || this.state.submitting ||
            (this.getEditRole()?.builtIn && this.getEditRole()?.code !== "ops_engineer")}
        >
          预选系统通知模板管理权限
        </HGButtonPage>
        <p>从后端权限目录选择查看、创建、编辑、删除草稿四项能力；不会自动授予、审核或发布权限。</p>
      </div>
    </>
  );

  /**
   * 渲染弹窗内的一次性 MFA 验证码；不加入主表单，也不随草稿缓存。
   * @returns {React.ReactNode} MFA 输入及验证反馈
   */
  renderMFAField = () => (
    <div>
      <label>
        申请人 MFA 验证码
        <HGInputPage
          value={this.state.mfaCode}
          maxLength={6}
          disabled={!this.state.pendingSubmitData || !this.requiresMFA(this.state.pendingSubmitData)}
          autoComplete="one-time-code"
          placeholder="申请权限时输入验证器 6 位验证码"
          className={styles.roleCreateInput}
          onChange={(event) => this.setState({
            mfaCode: event.target.value.replace(/\D/g, "").slice(0, 6),
            mfaError: "",
          })}
        />
      </label>
      {this.state.mfaError && <p role="alert">{this.state.mfaError}</p>}
    </div>
  );

  /** 保存前统一展示 MFA 确认；权限不变时只确认基础信息，不伪称 MFA 已验证。 */
  renderMFAModal = () => {
    const submitData = this.state.pendingSubmitData; // null 表示未请求保存或已取消。
    const originalRole = this.getEditRole(); // 用于区分信息编辑与未变化的确认文案。
    const metadataChanged = originalRole &&
      (submitData?.name !== originalRole.name || submitData?.description !== originalRole.description);
    return (
      <HGModalPage
        visible={Boolean(submitData)}
        title={this.isEditMode() ? "确认保存角色" : "确认创建角色"}
        onClose={this.handleCancelSubmit}
        onCancel={this.handleCancelSubmit}
        onOk={this.handleConfirmSubmit}
        okText="确认保存"
      >
        <p>{submitData && this.requiresMFA(submitData)
          ? "本次将申请角色权限，需输入本人 MFA 验证码；权限经另一名管理员审批后才生效。"
          : this.isEditMode() && !metadataChanged
            ? "角色信息与权限未变化，确认后无需提交；MFA 不会用于本次请求。"
            : "本次不申请角色权限，仅确认保存基础信息；MFA 不会用于本次请求。"}</p>
        {this.renderMFAField()}
      </HGModalPage>
    );
  };

  /**
   * 渲染提交和重置按钮。
   * @returns {React.ReactNode} 操作按钮区域
   */
  renderActions = () => {
    const { submitting, permissionsLoading, loadError, pendingSubmitData } = this.state;
    const disabled = permissionsLoading || Boolean(loadError) || Boolean(pendingSubmitData);

    return (
      <div className={styles.roleCreateActions}>
        <HGButtonPage
          type="primary"
          htmlType="submit"
          loading={submitting}
          disabled={disabled}
          className={styles.roleCreateButton}
        >
          {this.isEditMode() ? "保存角色" : "创建角色"}
        </HGButtonPage>
        <HGButtonPage onClick={this.handleReset} disabled={submitting || Boolean(pendingSubmitData)} className={styles.roleCreateButton}>
          {this.isEditMode() ? "恢复原值" : "重置"}
        </HGButtonPage>
      </div>
    );
  };

  /**
   * 渲染角色表单：主表单仅含基础信息与权限，MFA 在确认弹窗输入。
   * @returns {React.ReactNode} 表单节点
   */
  renderForm = () => {
    const rules = HGRoleCreateVM.getFormRules();

    return (
      <Form
        ref={this.formRef}
        layout="vertical"
        initialValues={this.getInitialFormValues()}
        onFinish={this.handleFinish}
      >
        {this.renderCodeField(rules)}
        {this.renderNameField(rules)}
        {this.renderDescriptionField(rules)}
        {this.renderPermissionsField(rules)}
        {this.renderActions()}
      </Form>
    );
  };

  /**
   * 返回角色列表：后退一步历史栈，与浏览器返回按钮行为一致。
   * 边界：容器未注入 onBack 时不操作。
   */
  handleBack = () => {
    this.props.onBack?.();
  };

  render() {
    const editing = this.isEditMode();
    return (
      <div className={styles.roleCreateContainer}>
        <HGPageHeaderPage
          title={editing ? "编辑角色" : "创建角色"}
          description={
            editing
              ? "修改角色基础信息与权限；权限发生变化时将发起双人审批申请，审批通过后才会生效。"
              : "定义平台角色并预选权限；勾选权限后提交时将发起双人审批申请，审批通过后权限才对绑定用户生效。"
          }
          extra={
            <HGButtonPage onClick={this.handleBack}>返回</HGButtonPage>
          }
        />
        <HGCardPage title={editing ? "编辑角色信息" : "角色信息"}>
          {this.state.loadError ? (
            <p role="alert">{this.state.loadError}</p>
          ) : (
            this.renderForm()
          )}
        </HGCardPage>
        {this.renderMFAModal()}
      </div>
    );
  }
}

export default HGRoleCreatePage;
