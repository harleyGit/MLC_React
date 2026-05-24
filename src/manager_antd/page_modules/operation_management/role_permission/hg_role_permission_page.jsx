/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24 21:19:41
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_permission/hg_role_permission_page.jsx
 * @Description: 角色权限分配页面，选择角色后勾选对应权限树
 * 
 * 存储角色与权限的绑定关系，实现一个角色批量分配多个菜单、按钮权限，是权限分配核心关联表，控制角色可访问的功能范围
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { HGFormPage as Form, HGFormItem as Item } from "../../../../components/hg_form/hg_form_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import HGTreeSelectPage from "../../../../components/hg_tree_select/hg_tree_select_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGRolePermissionVM, {
  INITIAL_FORM_VALUES,
  MOCK_PERMISSION_TREE,
  MOCK_ROLE_LIST,
} from "./hg_role_permission_vm";
import styles from "./hg_role_permission.module.css";

/**
 * 角色权限分配页面
 * 职责：选择角色，勾选权限树，提交角色与权限的绑定关系
 * 约束：类组件，使用 antd Form 管理表单，TreeSelect 实现权限多选
 */
class HGRolePermissionPage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      submitting: false,
    };
  }

  /**
   * 角色切换处理：选择角色后加载该角色已分配权限（编辑回填）
   * @param {string} roleId 选中的角色 ID
   */
  handleRoleChange = (roleId) => {
    if (!roleId) return;
    HGRolePermissionVM.fetchRolePermissions(roleId).then((permIds) => {
      if (this.formRef.current) {
        this.formRef.current.setFieldsValue({ permission_ids: permIds });
      }
    });
  };

  /**
   * 表单提交处理：校验通过后调用 VM 层提交逻辑
   * @param {Object} values 表单收集的字段值
   */
  handleFinish = (values) => {
    this.setState({ submitting: true });
    const submitData = HGRolePermissionVM.transformSubmitData(values);
    HGRolePermissionVM.submitRolePermission(submitData)
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
   * 渲染角色选择字段
   * @returns {React.ReactNode} Select 下拉选择器
   */
  renderRoleField = () => (
    <Item
      label="选择角色"
      name="role_id"
      rules={HGRolePermissionVM.getFormRules().role_id}
      className={styles.formItem}
    >
      <HGSelectPage
        placeholder="请选择角色"
        options={MOCK_ROLE_LIST}
        allowClear
        className={styles.inputField}
        onChange={this.handleRoleChange}
      />
    </Item>
  );

  /**
   * 渲染权限勾选字段
   * @returns {React.ReactNode} TreeSelect 树形多选组件
   */
  renderPermissionField = () => (
    <Item
      label="权限勾选"
      name="permission_ids"
      rules={HGRolePermissionVM.getFormRules().permission_ids}
      className={styles.formItem}
    >
      <HGTreeSelectPage
        treeData={MOCK_PERMISSION_TREE}
        placeholder="请勾选权限（可多选）"
        allowClear
        treeCheckable
        treeDefaultExpandAll
        showCheckedStrategy="SHOW_CHILD"
        className={styles.inputField}
        dropdownClassName={styles.permissionTreeBox}
      />
    </Item>
  );

  /**
   * 渲染提交/重置按钮
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
          重置
        </HGButtonPage>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.rolePermissionContainer}>
        <h2 className={styles.formTitle}>角色权限分配</h2>
        <Form
          ref={this.formRef}
          layout="vertical"
          initialValues={INITIAL_FORM_VALUES}
          onFinish={this.handleFinish}
        >
          {this.renderRoleField()}
          {this.renderPermissionField()}
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGRolePermissionPage;
