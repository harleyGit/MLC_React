/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_create/hg_role_create_page.jsx
 * @Description: 创建角色页面，渲染角色名称和描述表单并提交到 CreateRole 接口
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../../components/hg_form/hg_form_page";
import HGInputPage, { HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import HGTreeSelectPage from "../../../../components/hg_tree_select/hg_tree_select_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGRoleCreateVM, {
  INITIAL_ROLE_CREATE_FORM_VALUES,
} from "./hg_role_create_vm";
import styles from "./hg_role_create.module.css";

/**
 * 创建角色页面。
 * 职责：收集角色名称、描述并调用 VM 提交；不直接维护接口常量和请求细节。
 */
class HGRoleCreatePage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      submitting: false,
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
   * 表单提交处理：清洗字段后调用 CreateRole 接口。
   * @param {Object} values 表单字段值
   */
  handleFinish = (values) => {
    const submitData = HGRoleCreateVM.transformSubmitData(values);

    this.setState({ submitting: true });
    HGRoleCreateVM.submitRole(submitData)
      .then(() => {
        message.success("角色创建成功");
        if (this.formRef.current) {
          this.formRef.current.resetFields();
        }
      })
      .catch((err) => {
        message.error(err?.message || "角色创建失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ submitting: false });
      });
  };

  /**
   * 重置创建角色表单。
   */
  handleReset = () => {
    if (this.formRef.current) {
      this.formRef.current.resetFields();
    }
  };

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

  /** 渲染不可修改的业务角色编码输入项。 */
  renderCodeField = (rules) => (
    <Item label="角色编码" name="code" rules={rules.code}>
      <HGInputPage allowClear maxLength={64} placeholder="例如 content_editor" className={styles.roleCreateInput} />
    </Item>
  );

  /** 权限从服务端目录选择，并与角色创建在一个事务中提交。 */
  renderPermissionsField = (rules) => (
    <Item label="角色权限" name="permissions" rules={rules.permissions}>
      <HGTreeSelectPage
        treeData={this.state.permissions.map((item) => ({ title: `${item.code} · ${item.description}`, value: item.code }))}
        placeholder="请选择权限（可多选）"
        allowClear
        treeCheckable
        treeDefaultExpandAll
        showCheckedStrategy="SHOW_CHILD"
      />
    </Item>
  );

  /**
   * 渲染角色描述字段。
   * @param {Object} rules 表单校验规则
   * @returns {React.ReactNode} 角色描述表单项
   */
  renderDescriptionField = (rules) => (
    <Item label="角色描述" name="description" rules={rules.description}>
      <HGInputTextArea
        maxLength={255}
        rows={4}
        placeholder="请输入角色职责说明，可为空"
        className={styles.roleCreateTextArea}
      />
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

  render() {
    const rules = HGRoleCreateVM.getFormRules();

    return (
      <div className={styles.roleCreateContainer}>
        <h2>创建角色</h2>
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
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGRoleCreatePage;
