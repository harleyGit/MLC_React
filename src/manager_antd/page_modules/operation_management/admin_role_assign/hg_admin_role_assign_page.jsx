/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_role_assign/hg_admin_role_assign_page.jsx
 * @Description: 管理员角色分配表单页面，支持选择管理员并批量分配角色
 *
 * 1.管理员角色分配：将一个管理员与多个角色关联，实现 RBAC 权限绑定
 *  核心作用：
 *    选择指定管理员
 *    勾选需要分配的角色（支持多选）
 *    提交分配结果
 * 
 * 2. admin_user_role 管理员角色关联表
 * 作用：绑定管理员账号与所属角色，一个管理员可兼任多角色，依托角色间接获取对应权限，区分后台人员操作权限层级。
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../../components/hg_form/hg_form_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import { HGCheckboxGroup } from "../../../../components/hg_checkbox/hg_checkbox_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGAdminRoleAssignVM, {
  MOCK_ADMIN_LIST,
  MOCK_ROLE_OPTIONS,
  INITIAL_FORM_VALUES,
} from "./hg_admin_role_assign_vm";
import styles from "./hg_admin_role_assign.module.css";

/**
 * 管理员角色分配表单页面
 * 职责：渲染管理员选择 + 角色多选表单，收集用户输入并提交
 * 约束：类组件，使用 HGFormPage 进行表单管理与校验
 */
class HGAdminRoleAssignPage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      submitting: false,
    };
  }

  /**
   * 表单提交处理：校验通过后调用 VM 层提交逻辑
   * @param {Object} values 表单收集的字段值
   */
  handleFinish = (values) => {
    this.setState({ submitting: true });
    const submitData = HGAdminRoleAssignVM.transformSubmitData(values);
    HGAdminRoleAssignVM.submitAdminRole(submitData)
      .then((res) => {
        if (res.code === 0) {
          message.success(res.message || "提交成功");
        } else {
          message.error(res.message || "提交失败");
        }
      })
      .catch(() => {
        message.error("网络异常，请稍后重试");
      })
      .finally(() => {
        this.setState({ submitting: false });
      });
  };

  /**
   * 重置表单：清空所有字段为初始值
   */
  handleReset = () => {
    if (this.formRef.current) {
      this.formRef.current.resetFields();
    }
  };

  /**
   * 渲染管理员选择字段
   * @returns {React.ReactNode} Select 下拉框
   */
  renderAdminField = () => (
    <Item
      label="管理员"
      name="admin_user_id"
      rules={HGAdminRoleAssignVM.getFormRules().admin_user_id}
      className={styles.formItem}
    >
      <HGSelectPage
        options={MOCK_ADMIN_LIST}
        placeholder="请选择管理员"
        allowClear
        className={styles.inputField}
      />
    </Item>
  );

  /**
   * 渲染角色多选字段
   * @returns {React.ReactNode} CheckboxGroup 复选框组
   */
  renderRolesField = () => (
    <Item
      label="分配角色"
      name="role_ids"
      rules={HGAdminRoleAssignVM.getFormRules().role_ids}
      className={styles.formItem}
    >
      <HGCheckboxGroup options={MOCK_ROLE_OPTIONS} />
    </Item>
  );

  /**
   * 渲染提交/取消按钮
   * @returns {React.ReactNode} 按钮组
   */
  renderActions = () => {
    const { submitting } = this.state;
    return (
      <div className={styles.submitRow}>
        <HGButtonPage
          type="primary"
          htmlType="submit"
          loading={submitting}
          className={styles.submitBtn}
        >
          提交
        </HGButtonPage>
        <HGButtonPage onClick={this.handleReset} className={styles.submitBtn}>
          取消
        </HGButtonPage>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.adminRoleAssignContainer}>
        <h2 className={styles.formTitle}>管理员角色分配</h2>
        <Form
          ref={this.formRef}
          layout="vertical"
          initialValues={INITIAL_FORM_VALUES}
          onFinish={this.handleFinish}
        >
          {this.renderAdminField()}
          {this.renderRolesField()}
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGAdminRoleAssignPage;
