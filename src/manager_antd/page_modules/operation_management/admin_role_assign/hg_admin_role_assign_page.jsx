/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-29 21:21:57
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
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import { HGCheckboxGroup } from "../../../../components/hg_checkbox/hg_checkbox_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGAdminRoleAssignVM, {
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
      loadingRoles: false,
      searchingAdmins: false,
      selectedAdmin: null,
      adminOptions: [],
      roleOptions: [],
    };
  }

  componentDidMount() {
    this.loadRoleOptions();
  }

  loadRoleOptions = () => {
    this.setState({ loadingRoles: true });
    // 角色列表后端采用 cursor 分页；页面不直接关心分页细节，由 VM 聚合有限数量的角色选项。
    // 如果角色数量超过前端安全上限，保留已加载部分并提示用户，避免一次渲染过多复选框导致页面卡顿。
    HGAdminRoleAssignVM.fetchAllRoleList()
      .then((res) => {
        const roleOptions = HGAdminRoleAssignVM.toRoleOptions(res?.list || []);
        this.setState({ roleOptions });
        if (roleOptions.length === 0) {
          message.warning("暂无可分配角色，请先创建角色");
        } else if (res?.truncated) {
          message.warning("角色数量较多，当前仅加载前 500 个角色，请通过角色管理精简可分配范围");
        }
      })
      .catch(() => {
        message.error("角色列表获取失败，请刷新后重试");
      })
      .finally(() => {
        this.setState({ loadingRoles: false });
      });
  };

  handleAdminSearch = (keyword) => {
    // .trim() 去除首尾空白字符，删除字符串开头、结尾所有空格、制表符、换行符，中间空格保留。
    const searchText = String(keyword || "").trim();
    if (!searchText) {
      this.setState({ adminOptions: [], selectedAdmin: null });
      if (this.formRef.current) {
        this.formRef.current.setFieldsValue({ admin_user_id: undefined, role_ids: [] });
      }
      return;
    }

    this.setState({ searchingAdmins: true });
    HGAdminRoleAssignVM.searchAdminUsers(searchText)
      .then((res) => {
        const admins = res?.list || [];
        const adminOptions = HGAdminRoleAssignVM.toAdminOptions(admins);
        this.setState({ adminOptions, selectedAdmin: null });
        if (adminOptions.length === 0) {
          message.warning("未搜索到匹配管理员");
        }
      })
      .catch(() => {
        message.error("管理员搜索失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ searchingAdmins: false });
      });
  };

  handleAdminChange = (adminUserId) => {
    const { adminOptions } = this.state;
    const selectedAdminOption = adminOptions.find((item) => item.value === String(adminUserId));
    this.setState({ selectedAdmin: selectedAdminOption?.raw || null });
    if (!adminUserId) {
      if (this.formRef.current) {
        this.formRef.current.setFieldsValue({ role_ids: [] });
      }
      return;
    }

    HGAdminRoleAssignVM.fetchUserRoles(adminUserId)
      .then((res) => {
        const roleIds = (res?.roles || []).map((role) => String(role.id));
        if (this.formRef.current) {
          this.formRef.current.setFieldsValue({ role_ids: roleIds });
        }
      })
      .catch(() => {
        message.error("已分配角色获取失败，请手动选择角色");
      });
  };

  /**
   * 表单提交处理：校验通过后调用 VM 层提交逻辑
   * @param {Object} values 表单收集的字段值
   */
  handleFinish = (values) => {
    this.setState({ submitting: true });
    const submitData = HGAdminRoleAssignVM.transformSubmitData(values);
    HGAdminRoleAssignVM.submitAdminRole(submitData)
      .then((res) => {
        message.success(res?.message || "角色分配成功");
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
    this.setState({ selectedAdmin: null, adminOptions: [] });
  };

  renderSearchField = () => {
    const { searchingAdmins } = this.state;
    return (
      <div className={styles.searchBlock}>
        <label className={styles.searchLabel}>搜索管理员</label>
        <HGInputSearch
          allowClear
          enterButton={searchingAdmins ? "搜索中..." : "搜索"}
          disabled={searchingAdmins}
          placeholder="输入管理员ID、用户名、邮箱或手机号，可输入全部或一部分"
          onSearch={this.handleAdminSearch}
          className={styles.searchInput}
        />
        <p className={styles.searchTip}>
          大数据表搜索使用 ID 精确匹配，或用户名、昵称、邮箱、手机号前缀匹配；最多返回 10 条候选，避免后台搜索拖慢千万级管理员表。
        </p>
      </div>
    );
  };

  renderSelectedAdmin = () => {
    const { selectedAdmin } = this.state;
    if (!selectedAdmin) return null;
    return (
      <div className={styles.selectedAdminCard}>
        <div className={styles.selectedAdminTitle}>当前选择管理员</div>
        <div className={styles.selectedAdminGrid}>
          <span>ID：{selectedAdmin.id || "-"}</span>
          <span>姓名：{selectedAdmin.name || "-"}</span>
          <span>昵称：{selectedAdmin.nickName || "-"}</span>
          <span>邮箱：{selectedAdmin.email || "-"}</span>
          <span>手机号：{selectedAdmin.mobile || "-"}</span>
        </div>
      </div>
    );
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
        options={this.state.adminOptions}
        placeholder="请先搜索并选择管理员"
        allowClear
        className={styles.inputField}
        onChange={this.handleAdminChange}
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
      <HGCheckboxGroup options={this.state.roleOptions} />
    </Item>
  );

  /**
   * 渲染提交/取消按钮
   * @returns {React.ReactNode} 按钮组
   */
  renderActions = () => {
    const { submitting, loadingRoles } = this.state;
    return (
      <div className={styles.submitRow}>
        <HGButtonPage
          type="primary"
          htmlType="submit"
          loading={submitting || loadingRoles}
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
          {this.renderSearchField()}
          {this.renderAdminField()}
          {this.renderSelectedAdmin()}
          {this.renderRolesField()}
          {this.renderActions()}
        </Form>
      </div>
    );
  }
}

export default HGAdminRoleAssignPage;
