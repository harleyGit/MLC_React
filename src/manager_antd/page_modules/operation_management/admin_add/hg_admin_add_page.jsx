/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-06-13
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-14 22:31:56
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/admin_add/hg_admin_add_page.jsx
 * @Description: 添加管理员页面，搜索注册用户候选并逐行添加管理员
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import { HGInputSearch } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGTooltipPage from "../../../../components/hg_tooltip/hg_tooltip_page";
import styles from "./hg_admin_add.module.css";
import HGAdminAddVM from "./hg_admin_add_vm";

/**
 * 添加管理员页面。
 * 职责：搜索注册用户，在候选行中按用户主键添加管理员。
 */
class HGAdminAddPage extends Component {
  constructor(props) {
    super(props);
    this.hgMounted = false; // 页面挂载状态；卸载后丢弃查询及添加请求的结果。
    this.hgSearchRequest = 0; // 搜索序号；清空或连续搜索时忽略旧响应。
    this.state = {
      searching: false, // 搜索请求是否进行中；初始 false，旧请求由序号丢弃。
      submittingId: "", // 正在添加的候选 users.id；空字符串表示没有提交中的行。
      candidates: [], // 当前搜索返回的候选行；空数组表示无结果或尚未搜索。
      searchKeyword: "", // 搜索框当前文本；空字符串表示尚未输入或已重置。
      hasSearched: false, // 是否已发起有效查询；初始 false，挂载后自动读取默认候选。
      nextCursor: "", // 无关键词的下一页 users.id；空字符串表示没有续页。
      hasMore: false, // 无关键词列表是否还有下一页；初始 false。
    };
  }

  componentDidMount() {
    this.hgMounted = true;
    this.handleSearch("");
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSearchRequest += 1;
  }

  /**
   * 搜索注册用户候选；空输入时读取未加入管理员的第一页。
   * @param {string} keyword 搜索关键词；空字符串表示默认候选列表。
   */
  handleSearch = (keyword) => {
    const searchText = String(keyword || "").trim();
    const request = ++this.hgSearchRequest;
    this.setState({
      searching: true,
      hasSearched: true,
      candidates: [],
      nextCursor: "",
      hasMore: false,
    });
    HGAdminAddVM.searchAdminCandidates(searchText)
      .then((res) => {
        if (!this.hgMounted || request !== this.hgSearchRequest) return;
        const candidates = HGAdminAddVM.toCandidateRows(res?.list || []);
        this.setState({
          candidates,
          nextCursor: res?.nextCursor || "",
          hasMore: Boolean(res?.hasMore),
        });
        if (candidates.length === 0 && !res?.hasMore) {
          message.warning(searchText ? "未搜索到可添加的用户" : "暂无可添加的用户");
        }
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgSearchRequest)
          message.error("候选用户搜索失败，请稍后重试");
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgSearchRequest)
          this.setState({ searching: false });
      });
  };

  /** 按上一页返回的 users.id 继续加载默认候选，丢弃被新搜索或重置取代的响应。 */
  handleLoadMore = () => {
    const { nextCursor, hasMore, searching } = this.state;
    if (!hasMore || !nextCursor || searching) return;
    const request = ++this.hgSearchRequest;
    this.setState({ searching: true });
    HGAdminAddVM.searchAdminCandidates("", nextCursor)
      .then((res) => {
        if (!this.hgMounted || request !== this.hgSearchRequest) return;
        const candidates = HGAdminAddVM.toCandidateRows(res?.list || []);
        this.setState((previous) => ({
          candidates: [...previous.candidates, ...candidates],
          nextCursor: res?.nextCursor || "",
          hasMore: Boolean(res?.hasMore),
        }));
      })
      .catch(() => {
        if (this.hgMounted && request === this.hgSearchRequest)
          message.error("加载候选用户失败，请重试");
      })
      .finally(() => {
        if (this.hgMounted && request === this.hgSearchRequest)
          this.setState({ searching: false });
      });
  };

  /**
   * 按当前行的 users.id 提交管理员添加；成功后移除该候选，避免重复点击。
   * @param {Object} candidate 候选行；id 是 users.id，不是业务 user_id。
   */
  handleConfirm = (candidate) => {
    if (this.state.submittingId || !candidate?.id) return;
    this.setState({ submittingId: candidate.id });
    HGAdminAddVM.addAdmin(candidate.id)
      .then(() => {
        if (!this.hgMounted) return;
        message.success("管理员添加成功");
        this.setState((previous) => ({
          candidates: previous.candidates.filter(
            (item) => item.id !== candidate.id
          ),
        }));
      })
      .catch((err) => {
        if (this.hgMounted)
          message.error(err?.message || "管理员添加失败，请稍后重试");
      })
      .finally(() => {
        if (this.hgMounted) this.setState({ submittingId: "" });
      });
  };

  /**
   * 清空搜索框并重新加载默认候选，废弃尚未返回的旧响应。
   */
  handleReset = () => {
    this.hgSearchRequest += 1;
    this.setState({ searchKeyword: "" }, () => this.handleSearch(""));
  };

  /** 标题右侧展示紧凑搜索框，完整搜索约束只在提示图标悬停时展示。 */
  renderSearchField = () => {
    const { searching, searchKeyword } = this.state;
    const searchTip =
      "不输入关键词时按页展示可添加的用户；输入后使用 users.id 精确匹配，或 user_id、用户名、邮箱、手机号前缀匹配；每次最多返回 10 条。"; // 搜索规则提示；仅呈现，不参与请求。
    return (
      <div className={styles.searchBlock}>
        <HGButtonPage onClick={this.handleReset}>重置</HGButtonPage>
        <HGInputSearch
          allowClear
          value={searchKeyword}
          onChange={(event) =>
            this.setState({ searchKeyword: event.target.value })
          }
          enterButton={searching ? "搜索中..." : "搜索"}
          disabled={searching}
          placeholder="用户 ID / 用户名 / 邮箱 / 手机号"
          onSearch={this.handleSearch}
          className={styles.searchInput}
        />
        <HGTooltipPage
          content={searchTip}
          placement="left"
          tooltipClassName={styles.searchTooltip}
          contentClassName={styles.searchTip}
        >
          <button
            type="button"
            className={styles.helpIcon}
            aria-label={searchTip}
            title="搜索规则提示"
          >
            ⓘ
          </button>
        </HGTooltipPage>
      </div>
    );
  };

  /** 候选用户信息与逐行添加操作统一在表格展示；请求中禁用所有行操作。 */
  renderCandidateTable = () => {
    const { candidates, hasSearched, hasMore, submittingId, searching } = this.state;

    const columns = [
      { title: "ID", dataIndex: "id", width: 90 },
      { title: "业务ID", dataIndex: "userId", width: 120 },
      { title: "用户名", dataIndex: "userName", width: 140 },
      { title: "昵称", dataIndex: "nickName", width: 140 },
      { title: "邮箱", dataIndex: "email", width: 220 },
      { title: "手机号", dataIndex: "phone", width: 150 },
      {
        title: "操作",
        dataIndex: "action",
        width: 130,
        render: (_, candidate) => (
          <HGButtonPage
            type="primary"
            loading={submittingId === candidate.id}
            disabled={Boolean(submittingId) || searching}
            onClick={() => this.handleConfirm(candidate)}
          >
            添加管理员
          </HGButtonPage>
        ),
      },
    ]; // 列宽允许窄屏横向滚动，保证邮箱和手机号不被隐藏。

    return (
      <div>
        {!hasSearched && <p className={styles.emptyText}>正在加载候选用户</p>}
        {hasSearched && !searching && candidates.length === 0 && hasMore && (
          <p className={styles.emptyText}>当前批次无可添加的用户，请继续加载</p>
        )}
        <HGTablePage
          className={styles.candidateTable}
          rowKey="id"
          columns={columns}
          dataSource={candidates}
          loading={searching}
          pagination={false}
        />
        {hasMore && (
          <HGButtonPage onClick={this.handleLoadMore} disabled={searching}>
            {searching ? "加载中..." : "加载更多"}
          </HGButtonPage>
        )}
      </div>
    );
  };

  render() {
    return (
      <div className={styles.adminAddContainer}>
        <div className={styles.toolbar}>
          <h2 className={styles.formTitle}>添加管理员</h2>
          {this.renderSearchField()}
        </div>
        {this.renderCandidateTable()}
      </div>
    );
  }
}

export default HGAdminAddPage;
