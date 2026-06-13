/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-06-13
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_add/hg_admin_add_page.jsx
 * @Description: 添加管理员页面，搜索注册用户候选并确认添加为管理员
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGDetailGridPage from "../../../../components/hg_detail_grid/hg_detail_grid_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGAdminAddVM from "./hg_admin_add_vm";
import styles from "./hg_admin_add.module.css";

/**
 * 添加管理员页面。
 * 职责：搜索注册用户、单选候选项并提交添加管理员确认。
 */
class HGAdminAddPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      searching: false,
      submitting: false,
      candidates: [],
      selectedCandidate: null,
      hasSearched: false,
    };
  }

  /**
   * 搜索注册用户候选。
   * @param {string} keyword 搜索关键词
   */
  handleSearch = (keyword) => {
    const searchText = String(keyword || "").trim();
    if (!searchText) {
      this.setState({ candidates: [], selectedCandidate: null, hasSearched: false });
      return;
    }

    this.setState({ searching: true, selectedCandidate: null, hasSearched: true });
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
   * 选择一个候选用户。
   * @param {Object} candidate 候选用户
   */
  handleSelectCandidate = (candidate) => {
    this.setState({ selectedCandidate: candidate });
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
    this.setState({ candidates: [], selectedCandidate: null, hasSearched: false });
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
          候选搜索使用 users.id 精确匹配，或 user_id、用户名、邮箱、手机号前缀匹配；最多返回 10 条候选，避免大表无界搜索。
        </p>
      </div>
    );
  };

  renderCandidateHeader = () => (
    <div className={styles.candidateHeader}>
      <span>选择</span>
      <span>ID</span>
      <span>用户名</span>
      <span>昵称</span>
      <span className={styles.optionalColumn}>邮箱</span>
      <span className={styles.optionalColumn}>手机号</span>
    </div>
  );

  renderCandidateRow = (candidate) => {
    const { selectedCandidate } = this.state;
    const selected = selectedCandidate?.id === candidate.id;
    const rowClassName = [styles.candidateRow, selected ? styles.candidateRowSelected : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={candidate.id}
        className={rowClassName}
        onClick={() => this.handleSelectCandidate(candidate)}
      >
        <input
          type="radio"
          className={styles.radioInput}
          checked={selected}
          onChange={() => this.handleSelectCandidate(candidate)}
        />
        <span className={styles.cellText}>{candidate.id}</span>
        <span className={styles.cellText}>{candidate.userName}</span>
        <span className={styles.cellText}>{candidate.nickName}</span>
        <span className={`${styles.cellText} ${styles.optionalColumn}`}>{candidate.email}</span>
        <span className={`${styles.cellText} ${styles.optionalColumn}`}>{candidate.phone}</span>
      </div>
    );
  };

  renderCandidateList = () => {
    const { candidates, hasSearched } = this.state;
    if (!hasSearched) return null;
    if (candidates.length === 0) {
      return <div className={styles.emptyText}>暂无候选用户，请更换关键词搜索</div>;
    }

    return (
      <div className={styles.candidateList}>
        {this.renderCandidateHeader()}
        {candidates.map(this.renderCandidateRow)}
      </div>
    );
  };

  renderSelectedCandidate = () => {
    const { selectedCandidate } = this.state;
    if (!selectedCandidate) return null;

    const detailItems = [
      { label: "ID", value: selectedCandidate.id },
      { label: "业务ID", value: selectedCandidate.userId },
      { label: "用户名", value: selectedCandidate.userName },
      { label: "昵称", value: selectedCandidate.nickName },
      { label: "邮箱", value: selectedCandidate.email },
      { label: "手机号", value: selectedCandidate.phone },
    ];

    return (
      <HGDetailGridPage
        title="当前选择用户"
        items={detailItems}
        columns={3}
        maxValueLines={1}
        className={styles.selectedCard}
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
        {this.renderCandidateList()}
        {this.renderSelectedCandidate()}
        {this.renderActions()}
      </div>
    );
  }
}

export default HGAdminAddPage;
