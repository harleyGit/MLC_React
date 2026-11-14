/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-14 21:42:19
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_add/hg_admin_add_page.jsx
 * @Description: 添加管理员页面，搜索注册用户候选并确认添加为管理员
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import styles from "./hg_admin_add.module.css";
import HGAdminAddVM from "./hg_admin_add_vm";

/**
 * 添加管理员页面。
 * 职责：搜索注册用户、单选候选项并提交添加管理员确认。
 */
class HGAdminAddPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      searching: false, // 搜索请求是否进行中；初始 false，用于禁用重复搜索。
      submitting: false, // 添加请求是否进行中；初始 false，用于防止重复提交。
      candidates: [], // 当前搜索返回的候选行；空数组表示无结果或尚未搜索。
      selectedCandidate: null, // 当前单选用户；null 表示未选中或已清空。
      hasSearched: false, // 是否已发起有效搜索；初始 false 时不展示候选表格。
    };
  }

  /**
   * 搜索注册用户候选。
   * @param {string} keyword 搜索关键词
   */
  handleSearch = (keyword) => {
    const searchText = String(keyword || "").trim();
    if (!searchText) {
      this.setState({
        candidates: [],
        selectedCandidate: null,
        hasSearched: false,
      });
      return;
    }

    this.setState({
      searching: true,
      selectedCandidate: null,
      hasSearched: true,
    });
    HGAdminAddVM.searchAdminCandidates(searchText)
      .then((res) => {
        const candidates = HGAdminAddVM.toCandidateRows(res?.list || []);
        this.setState({ candidates });
        if (candidates.length === 0) {
          message.warning("未搜索到可添加的用户");
        }
      })
      .catch(() => {
        message.error("候选用户搜索失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ searching: false });
      });
  };

  /**
   * 接收表格单选结果，未选择时清空当前候选用户。
   * @param {Array} _keys 选中的行 key；当前页面从行记录获取提交所需的 ID。
   * @param {Array} rows 表格返回的已选候选行；单选时最多一条。
   */
  handleSelectCandidate = (_keys, rows) => {
    this.setState({ selectedCandidate: rows[0] || null });
  };

  /**
   * 确认添加管理员。
   */
  handleConfirm = () => {
    const { selectedCandidate } = this.state;
    if (!selectedCandidate) {
      message.warning("请先选择一个用户");
      return;
    }

    this.setState({ submitting: true });
    HGAdminAddVM.addAdmin(selectedCandidate.id)
      .then(() => {
        message.success("管理员添加成功");
        this.setState({ selectedCandidate: null });
      })
      .catch((err) => {
        message.error(err?.message || "管理员添加失败，请稍后重试");
      })
      .finally(() => {
        this.setState({ submitting: false });
      });
  };

  /**
   * 清空当前搜索结果和选择。
   */
  handleReset = () => {
    this.setState({
      candidates: [],
      selectedCandidate: null,
      hasSearched: false,
    });
  };

  renderSearchField = () => {
    const { searching } = this.state;
    return (
      <div className={styles.searchBlock}>
        <label className={styles.searchLabel}>搜索管理员候选用户</label>
        <HGInputSearch
          allowClear
          enterButton={searching ? "搜索中..." : "搜索"}
          disabled={searching}
          placeholder="输入用户ID、用户名、邮箱或手机号，可输入全部或一部分"
          onSearch={this.handleSearch}
          className={styles.searchInput}
        />
        <p className={styles.searchTip}>
          候选搜索使用 users.id 精确匹配，或
          user_id、用户名、邮箱、手机号前缀匹配；最多返回 10
          条候选，避免大表无界搜索。
        </p>
      </div>
    );
  };

  /** 候选用户的全部识别字段统一在表格展示，不再额外渲染选中详情卡。 */
  renderCandidateTable = () => {
    const { candidates, hasSearched, selectedCandidate, searching } = this.state;
    if (!hasSearched) return null;

    const columns = [
      { title: "ID", dataIndex: "id", width: 90 },
      { title: "业务ID", dataIndex: "userId", width: 120 },
      { title: "用户名", dataIndex: "userName", width: 140 },
      { title: "昵称", dataIndex: "nickName", width: 140 },
      { title: "邮箱", dataIndex: "email", width: 220 },
      { title: "手机号", dataIndex: "phone", width: 150 },
    ]; // 列宽允许窄屏横向滚动，保证邮箱和手机号不被隐藏。

    return (
      <HGTablePage
        className={styles.candidateTable}
        rowKey="id"
        columns={columns}
        dataSource={candidates}
        rowSelection={{
          type: "radio",
          selectedRowKeys: selectedCandidate ? [selectedCandidate.id] : [],
          onChange: this.handleSelectCandidate,
        }}
        loading={searching}
        pagination={false}
        scroll={{ y: 360 }}
      />
    );
  };

  renderActions = () => {
    const { submitting, selectedCandidate } = this.state;
    return (
      <div className={styles.submitRow}>
        <HGButtonPage
          type="primary"
          loading={submitting}
          disabled={!selectedCandidate}
          onClick={this.handleConfirm}
          className={styles.submitBtn}
        >
          确认添加
        </HGButtonPage>
        <HGButtonPage onClick={this.handleReset} className={styles.submitBtn}>
          重置
        </HGButtonPage>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.adminAddContainer}>
        <h2 className={styles.formTitle}>添加管理员</h2>
        {this.renderSearchField()}
        {this.renderCandidateTable()}
        {this.renderActions()}
      </div>
    );
  }
}

export default HGAdminAddPage;
