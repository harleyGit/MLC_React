/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/hg_permission_menu_page.jsx
 * @Description: 菜单权限新增/编辑表单页面
 */
import {
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  Switch,
  TreeSelect,
  message,
} from "antd";
import React, { Component } from "react";
import HGPermissionMenuVM, {
  INITIAL_FORM_VALUES,
  MOCK_PARENT_TREE,
  PERMISSION_TYPE_OPTIONS,
} from "./hg_permission_menu_vm";
import styles from "./hg_permission_menu.module.css";

const { TextArea } = Input;

/**
 * 菜单权限表单页面
 * 职责：渲染权限新增/编辑表单，收集用户输入并提交
 * 输入：editData（编辑模式下的回填数据，可选）
 * 约束：类组件，使用 antd Form 进行表单管理与校验
 */
class HGPermissionMenuPage extends Component {
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
    const submitData = HGPermissionMenuVM.transformSubmitData(values);
    HGPermissionMenuVM.submitPermission(submitData)
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
   * 渲染权限编码字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderCodeField = () => (
    <Form.Item
      label="权限编码"
      name="code"
      rules={HGPermissionMenuVM.getFormRules().code}
      className={styles.formItem}
    >
      <Input placeholder="请输入权限编码，如：system:user:list" className={styles.inputField} />
    </Form.Item>
  );

  /**
   * 渲染权限类型字段
   * @returns {React.ReactNode} Radio 单选框
   */
  renderTypeField = () => (
    <Form.Item
      label="权限类型"
      name="type"
      rules={HGPermissionMenuVM.getFormRules().type}
      className={styles.formItem}
    >
      <Radio.Group options={PERMISSION_TYPE_OPTIONS} />
    </Form.Item>
  );

  /**
   * 渲染权限名称字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderNameField = () => (
    <Form.Item
      label="权限名称"
      name="name"
      rules={HGPermissionMenuVM.getFormRules().name}
      className={styles.formItem}
    >
      <Input placeholder="请输入权限名称" className={styles.inputField} />
    </Form.Item>
  );

  /**
   * 渲染页面路径字段
   * @returns {React.ReactNode} Input 输入框
   */
  renderPagePathField = () => (
    <Form.Item
      label="页面路径"
      name="page_path"
      rules={HGPermissionMenuVM.getFormRules().page_path}
      className={styles.formItem}
    >
      <Input placeholder="请输入页面路由路径，如：/system/user" className={styles.inputField} />
    </Form.Item>
  );

  /**
   * 渲染上级菜单字段
   * @returns {React.ReactNode} TreeSelect 树形选择器
   */
  renderParentField = () => (
    <Form.Item
      label="上级菜单"
      name="parent_id"
      className={styles.formItem}
    >
      <TreeSelect
        treeData={MOCK_PARENT_TREE}
        placeholder="请选择上级菜单（可为空）"
        allowClear
        treeDefaultExpandAll
        className={styles.inputField}
      />
    </Form.Item>
  );

  /**
   * 渲染启用状态字段
   * @returns {React.ReactNode} Switch 开关
   */
  renderStatusField = () => (
    <Form.Item
      label="启用状态"
      name="status"
      valuePropName="checked"
      className={styles.formItem}
    >
      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
    </Form.Item>
  );

  /**
   * 渲染排序值字段
   * @returns {React.ReactNode} InputNumber 数字输入框
   */
  renderSortField = () => (
    <Form.Item
      label="排序值"
      name="sort"
      rules={HGPermissionMenuVM.getFormRules().sort}
      className={styles.formItem}
    >
      <InputNumber
        min={0}
        placeholder="数值越小排序越靠前"
        style={{ width: "100%" }}
      />
    </Form.Item>
  );

  /**
   * 渲染描述备注字段
   * @returns {React.ReactNode} TextArea 文本域
   */
  renderDescField = () => (
    <Form.Item
      label="描述备注"
      name="desc"
      rules={HGPermissionMenuVM.getFormRules().desc}
      className={styles.formItem}
    >
      <TextArea
        placeholder="请输入描述备注"
        rows={4}
        className={styles.textAreaField}
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
      <div className={styles.permissionMenuContainer}>
        <h2 className={styles.formTitle}>菜单权限配置</h2>
        <Form
          ref={this.formRef}
          layout="vertical"
          initialValues={INITIAL_FORM_VALUES}
          onFinish={this.handleFinish}
        >
          {this.renderCodeField()}
          {this.renderTypeField()}
          {this.renderNameField()}
          {this.renderPagePathField()}
          {this.renderParentField()}
          {this.renderStatusField()}
          {this.renderSortField()}
          {this.renderDescField()}
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGPermissionMenuPage;
