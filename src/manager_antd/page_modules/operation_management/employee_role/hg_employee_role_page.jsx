/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24 21:04:36
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/employee_role/hg_employee_role_page.jsx
 * @Description: 员工角色管理表单页面，支持新增/编辑员工并绑定角色
 * 
 * 管理员表 = 后台管理系统的 “员工账号表”
存储后台运营、客服、运营主管、超级管理员的账号信息
用来登录后台、鉴权、操作日志归属、个人信息管理
和前台普通用户（user 表）完全分开，互不干扰
配合权限表，控制不同管理员能看什么页面、能点什么按钮

核心作用：
后台登录认证
账号启用 / 禁用
记录谁操作了后台
绑定角色（权限）
支持手机号 / 密码 / 飞书登录
 */
import { Button, Form, Input, Radio, Switch, TreeSelect, message } from "antd";
import React, { Component } from "react";
import styles from "./hg_employee_role.module.css";
import HGEmployeeRoleVM, {
  GENDER_OPTIONS,
  INITIAL_FORM_VALUES,
  MOCK_ROLE_TREE,
} from "./hg_employee_role_vm";

const { Password } = Input;

/**
 * 员工角色管理表单页面
 * 职责：渲染员工新增/编辑表单，收集用户输入并提交
 * 输入：editData（编辑模式下的回填数据，可选）、isEdit（是否编辑模式）
 * 约束：类组件，使用 antd Form 进行表单管理与校验
 */
class HGEmployeeRolePage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      submitting: false,
    };
  }

  /**
   * 挂载后：若为编辑模式，回填表单数据
   */
  componentDidMount() {
    const { editData } = this.props;
    if (editData && this.formRef.current) {
      this.formRef.current.setFieldsValue(editData);
    }
  }

  /**
   * 表单提交处理：校验通过后调用 VM 层提交逻辑
   * @param {Object} values 表单收集的字段值
   */
  handleFinish = (values) => {
    this.setState({ submitting: true });
    const submitData = HGEmployeeRoleVM.transformSubmitData(values);
    HGEmployeeRoleVM.submitEmployeeRole(submitData)
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
   * 渲染姓名字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderNameField = () => (
    <Form.Item
      label="姓名"
      name="name"
      rules={HGEmployeeRoleVM.getFormRules().name}
      className={styles.formItem}
    >
      <Input placeholder="请输入姓名" className={styles.inputField} />
    </Form.Item>
  );

  /**
   * 渲染昵称字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderNicknameField = () => (
    <Form.Item
      label="昵称"
      name="nickname"
      rules={HGEmployeeRoleVM.getFormRules().nickname}
      className={styles.formItem}
    >
      <Input placeholder="请输入昵称（选填）" className={styles.inputField} />
    </Form.Item>
  );

  /**
   * 渲染手机号字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderPhoneField = () => (
    <Form.Item
      label="手机号"
      name="phone"
      rules={HGEmployeeRoleVM.getFormRules().phone}
      className={styles.formItem}
    >
      <Input
        placeholder="请输入手机号"
        maxLength={11}
        className={styles.inputField}
      />
    </Form.Item>
  );

  /**
   * 渲染密码字段
   * @returns {React.ReactNode} InputPassword 密码框
   */
  renderPasswordField = () => {
    const { isEdit } = this.props;
    return (
      <Form.Item
        label="密码"
        name="password"
        rules={HGEmployeeRoleVM.getFormRules(isEdit).password}
        className={styles.formItem}
        extra={isEdit ? "编辑时可不填，留空表示不修改密码" : ""}
      >
        <Password
          placeholder={isEdit ? "留空则不修改密码" : "请输入密码"}
          className={styles.inputField}
        />
      </Form.Item>
    );
  };

  /**
   * 渲染性别字段
   * @returns {React.ReactNode} Radio 单选框
   */
  renderGenderField = () => (
    <Form.Item
      label="性别"
      name="gender"
      rules={HGEmployeeRoleVM.getFormRules().gender}
      className={styles.formItem}
    >
      <Radio.Group options={GENDER_OPTIONS} />
    </Form.Item>
  );

  /**
   * 渲染账号状态字段
   * @returns {React.ReactNode} Switch 开关
   */
  renderStatusField = () => (
    <Form.Item
      label="账号状态"
      name="status"
      valuePropName="checked"
      className={styles.formItem}
    >
      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
    </Form.Item>
  );

  /**
   * 渲染绑定角色字段
   * @returns {React.ReactNode} TreeSelect 树形选择器（多选）
   */
  renderRolesField = () => (
    <Form.Item
      label="绑定角色"
      name="roles"
      rules={HGEmployeeRoleVM.getFormRules().roles}
      className={styles.formItem}
    >
      <TreeSelect
        treeData={MOCK_ROLE_TREE}
        placeholder="请选择角色（可多选）"
        allowClear
        treeCheckable
        treeDefaultExpandAll
        showCheckedStrategy={TreeSelect.SHOW_CHILD}
        className={styles.inputField}
      />
    </Form.Item>
  );

  /**
   * 渲染提交/重置按钮
   * @returns {React.ReactNode} 按钮组
   */
  renderActions = () => {
    const { submitting } = this.state;
    return (
      <div className={styles.submitRow}>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting}
          className={styles.submitBtn}
        >
          提交
        </Button>
        <Button onClick={this.handleReset} className={styles.submitBtn}>
          重置
        </Button>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.employeeRoleContainer}>
        <h2 className={styles.formTitle}>管理员工角色</h2>
        <Form
          ref={this.formRef}
          layout="vertical"
          initialValues={INITIAL_FORM_VALUES}
          onFinish={this.handleFinish}
        >
          {this.renderNameField()}
          {this.renderNicknameField()}
          {this.renderPhoneField()}
          {this.renderPasswordField()}
          {this.renderGenderField()}
          {this.renderStatusField()}
          {this.renderRolesField()}
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGEmployeeRolePage;
