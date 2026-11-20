/**
 * hg_local_db_test_page.jsx
 * 测试模块「数据 > 本地数据库测试」页面。
 * 职责：
 * 1. 数据管理：录入用户数据（用户 ID / 用户名 / 昵称 / 密码）存入 IndexedDB，
 *    并提供列表展示、编辑、删除等手动 CRUD 操作；
 * 2. 自动化测试：在真实浏览器 IndexedDB 环境中逐项运行本地数据库存储系统的
 *    测试用例，以 UI 展示每个用例的执行状态、耗时与失败原因。
 * 边界：测试用例定义见 hg_local_db_test_cases.js；页面只负责运行调度与结果渲染。
 */

import React, { Component } from "react";
import styles from "./hg_local_db_test.module.css";
import {
  HG_LOCAL_DB_TEST_CASES,
  hgGroupTestCases,
  hgDeleteTestDatabase
} from "./hg_local_db_test_cases";
import { hgCloseDatabase, hgIsDatabaseSupported } from "../../../infrastructure/database/HGDatabase";
import { hgEstimateStorageUsage } from "../../../infrastructure/storage/HGStorageCleanup";
import { hgUserRepository } from "../../../modules/user/HGUserRepository";

// 用例执行状态常量
const HG_CASE_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  PASSED: "passed",
  FAILED: "failed"
};

const HG_STATUS_LABELS = {
  [HG_CASE_STATUS.PENDING]: "待执行",
  [HG_CASE_STATUS.RUNNING]: "执行中",
  [HG_CASE_STATUS.PASSED]: "通过",
  [HG_CASE_STATUS.FAILED]: "失败"
};

const HG_STATUS_CLASSES = {
  [HG_CASE_STATUS.PENDING]: styles.chipPending,
  [HG_CASE_STATUS.RUNNING]: styles.chipRunning,
  [HG_CASE_STATUS.PASSED]: styles.chipPassed,
  [HG_CASE_STATUS.FAILED]: styles.chipFailed
};

// 初始化全部用例为待执行状态
function hgBuildInitialStates() {
  return HG_LOCAL_DB_TEST_CASES.map(() => ({
    status: HG_CASE_STATUS.PENDING,
    durationMs: null,
    error: null
  }));
}

// 数据管理表单的初始空表单
function hgBuildEmptyForm() {
  return { userId: "", username: "", nickname: "", password: "" };
}

// 数据管理操作反馈的统一包装
function hgBuildListMessage(text, isError = false) {
  return { text, isError };
}

export default class HGLocalDbTestPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      caseStates: hgBuildInitialStates(),
      running: false,
      finished: false,
      // 环境信息：IndexedDB 支持状态与存储用量摘要
      envSupported: hgIsDatabaseSupported(),
      envUsage: null,
      envLoadError: null,
      // 整库删除操作的反馈信息
      clearMessage: null,
      // 数据管理：表单、编辑目标、用户列表与操作反馈
      // 交互约定：增删改查全部由按钮点击触发执行，不做自动加载与自动刷新
      form: hgBuildEmptyForm(),
      editingUserId: null,
      userList: [],
      listLoading: false,
      listMessage: null,
      saving: false
    };
    // 卸载标记：异步用例结束后不再 setState
    this.unmounted = false;
    this.groups = hgGroupTestCases(HG_LOCAL_DB_TEST_CASES);
  }

  componentDidMount() {
    this.refreshEnvInfo();
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  // ---- 数据管理：手动 CRUD（全部操作均由按钮点击触发） ----

  /**
   * 查询列表：点击「查询列表」按钮后从 IndexedDB 读取 user_profiles 全表。
   * 边界：查询不自动执行；结果数量通过文案反馈。
   */
  handleQueryUserList = async () => {
    if (this.state.listLoading) return;

    this.setState({ listLoading: true });
    try {
      const records = await hgUserRepository.getAll();
      if (this.unmounted) return;

      // 按缓存时间倒序展示，最近操作的用户排在最前
      records.sort((a, b) => (b.cached_at || 0) - (a.cached_at || 0));
      this.setState({
        userList: records,
        listMessage: hgBuildListMessage(`查询完成：共 ${records.length} 条记录`)
      });
    } catch (error) {
      if (!this.unmounted) {
        this.setState({ listMessage: hgBuildListMessage(`查询失败：${error?.message || error}`, true) });
      }
    } finally {
      if (!this.unmounted) {
        this.setState({ listLoading: false });
      }
    }
  };

  /** 表单输入统一回调：按 input 的 name 更新对应表单字段。 */
  handleFormInput = (event) => {
    const { name, value } = event.target;
    this.setState((prev) => ({ form: { ...prev.form, [name]: value } }));
  };

  /**
   * 存储数据：新增或保存编辑。
   * 边界：user_id 为主键必填；保存走 saveProfile 覆盖式更新（upsert），
   *       成功后由数据服务通知自动刷新列表。
   */
  handleSaveUser = async () => {
    if (this.state.saving) return;

    const { form, editingUserId } = this.state;
    const userId = editingUserId || form.userId.trim();

    if (!userId) {
      this.setState({ listMessage: hgBuildListMessage("请输入用户 ID（主键）", true) });
      return;
    }
    if (!form.nickname.trim()) {
      this.setState({ listMessage: hgBuildListMessage("请输入昵称", true) });
      return;
    }

    this.setState({ saving: true });
    try {
      // 注意：password 仅用于演示本地存储能力，真实业务禁止明文入库
      await hgUserRepository.saveProfile({
        user_id: userId,
        username: form.username.trim(),
        nickname: form.nickname.trim(),
        password: form.password,
        avatar_url: "",
        updated_at: Date.now()
      });

      if (this.unmounted) return;

      this.setState({
        form: hgBuildEmptyForm(),
        editingUserId: null,
        listMessage: hgBuildListMessage(
          editingUserId
            ? `已保存修改：${userId}，点击「查询列表」刷新数据`
            : `已存储：${userId}，点击「查询列表」查看数据`
        )
      });
    } catch (error) {
      if (!this.unmounted) {
        this.setState({ listMessage: hgBuildListMessage(`存储失败：${error?.message || error}`, true) });
      }
    } finally {
      if (!this.unmounted) {
        this.setState({ saving: false });
      }
    }
  };

  /** 进入编辑态：表单回填记录内容，主键不可修改。 */
  handleEditUser = (record) => {
    this.setState({
      editingUserId: record.user_id,
      form: {
        userId: record.user_id,
        username: record.username || "",
        nickname: record.nickname || "",
        password: record.password || ""
      },
      listMessage: hgBuildListMessage(`正在编辑：${record.user_id}，修改后点击「保存修改」`)
    });
  };

  /** 取消编辑：清空表单回到新增态。 */
  handleCancelEdit = () => {
    this.setState({
      editingUserId: null,
      form: hgBuildEmptyForm(),
      listMessage: null
    });
  };

  /**
   * 删除用户记录。
   * 边界：删除前弹确认框；删除后由数据服务通知自动刷新列表。
   */
  handleDeleteUser = async (record) => {
    if (!window.confirm(`确认删除用户「${record.nickname || record.user_id}」的本地数据？`)) {
      return;
    }

    try {
      await hgUserRepository.removeProfile(record.user_id);
      if (!this.unmounted) {
        // 正在编辑被删用户时退出编辑态
        if (this.state.editingUserId === record.user_id) {
          this.setState({ editingUserId: null, form: hgBuildEmptyForm() });
        }
        this.setState({
          listMessage: hgBuildListMessage(`已删除：${record.user_id}，点击「查询列表」刷新数据`)
        });
      }
    } catch (error) {
      if (!this.unmounted) {
        this.setState({ listMessage: hgBuildListMessage(`删除失败：${error?.message || error}`, true) });
      }
    }
  };

  /** 刷新环境信息：IndexedDB 支持状态与 navigator.storage.estimate 摘要。 */
  refreshEnvInfo = async () => {
    this.setState({
      envSupported: hgIsDatabaseSupported(),
      envLoadError: null
    });

    try {
      const usage = await hgEstimateStorageUsage();
      if (!this.unmounted) {
        this.setState({ envUsage: usage });
      }
    } catch (error) {
      if (!this.unmounted) {
        this.setState({ envLoadError: error?.message || "存储用量查询失败" });
      }
    }
  };

  /** 更新单个用例的状态切片，其余切片保持不变。 */
  updateCaseState = (index, patch) => {
    this.setState((prev) => {
      const caseStates = prev.caseStates.slice();
      caseStates[index] = { ...caseStates[index], ...patch };
      return { caseStates };
    });
  };

  /**
   * 运行全部测试用例。
   * 边界：串行执行保证用例间前置数据成立；每个用例独立捕获异常，
   *       单个失败不阻断后续用例；每项之间让出主线程以便 UI 渲染进度。
   */
  handleRunAll = async () => {
    if (this.state.running) return;

    this.setState({ running: true, finished: false, caseStates: hgBuildInitialStates(), clearMessage: null });

    for (let index = 0; index < HG_LOCAL_DB_TEST_CASES.length; index += 1) {
      const testCase = HG_LOCAL_DB_TEST_CASES[index];
      this.updateCaseState(index, { status: HG_CASE_STATUS.RUNNING, durationMs: null, error: null });

      const started = performance.now();
      try {
        await testCase.run();
        this.updateCaseState(index, {
          status: HG_CASE_STATUS.PASSED,
          durationMs: Math.round(performance.now() - started)
        });
      } catch (error) {
        this.updateCaseState(index, {
          status: HG_CASE_STATUS.FAILED,
          durationMs: Math.round(performance.now() - started),
          error: error?.message || String(error)
        });
      }

      // 让出主线程，确保进度可见
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (this.unmounted) return;
    }

    if (!this.unmounted) {
      this.setState({ running: false, finished: true });
      this.refreshEnvInfo();
    }
  };

  /**
   * 清空本地数据库：关闭连接并整库删除，供重新测试全新建库流程。
   * 边界：删除后所有本地业务数据丢失；测试用例第 2 项会自动重建库。
   */
  handleClearDatabase = async () => {
    if (this.state.running) return;

    try {
      await hgCloseDatabase();
      await hgDeleteTestDatabase();
      this.setState({
        caseStates: hgBuildInitialStates(),
        finished: false,
        clearMessage: "本地数据库已删除，运行测试将自动全新建库。"
      });
      this.refreshEnvInfo();
    } catch (error) {
      this.setState({ clearMessage: `删除失败：${error?.message || error}` });
    }
  };

  /** 汇总各状态用例数量。 */
  getSummary = () => {
    const { caseStates } = this.state;
    const count = (status) => caseStates.filter((item) => item.status === status).length;
    return {
      total: caseStates.length,
      passed: count(HG_CASE_STATUS.PASSED),
      failed: count(HG_CASE_STATUS.FAILED),
      running: count(HG_CASE_STATUS.RUNNING),
      pending: count(HG_CASE_STATUS.PENDING)
    };
  };

  /** 渲染页头：标题、说明与环境信息。 */
  renderHeader = () => {
    const { envSupported, envUsage, envLoadError } = this.state;
    const usageText = envUsage
      ? `已用 ${(envUsage.usage / 1024 / 1024).toFixed(2)} MB / 配额 ${(envUsage.quota / 1024 / 1024).toFixed(0)} MB`
      : "存储用量不可用";

    return (
      <header className={styles.header}>
        <h1 className={styles.title}>本地数据库测试</h1>
        <p className={styles.subtitle}>
          在真实浏览器 IndexedDB 环境中运行本地存储系统全链路测试（建库、读写、分页、同步、实时分发、清理隔离）。
        </p>
        <div className={styles.envBar}>
          <span className={envSupported ? styles.envOk : styles.envBad}>
            IndexedDB {envSupported ? "可用" : "不可用"}
          </span>
          <span className={styles.envItem}>{usageText}</span>
          {envLoadError ? <span className={styles.envBad}>{envLoadError}</span> : null}
        </div>
      </header>
    );
  };

  /** 渲染数据管理表单：新增与编辑共用，编辑态主键只读。 */
  renderUserForm = () => {
    const { form, editingUserId, saving } = this.state;
    const isEditing = editingUserId !== null;

    return (
      <div className={styles.userForm}>
        <div className={styles.formGrid}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>用户 ID（主键）</span>
            <input
              type="text"
              name="userId"
              className={styles.formInput}
              value={form.userId}
              onChange={this.handleFormInput}
              placeholder="如 hgid_10001"
              disabled={isEditing}
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>用户名</span>
            <input
              type="text"
              name="username"
              className={styles.formInput}
              value={form.username}
              onChange={this.handleFormInput}
              placeholder="登录账号名"
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>昵称</span>
            <input
              type="text"
              name="nickname"
              className={styles.formInput}
              value={form.nickname}
              onChange={this.handleFormInput}
              placeholder="展示昵称"
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>密码</span>
            <input
              type="password"
              name="password"
              className={styles.formInput}
              value={form.password}
              onChange={this.handleFormInput}
              placeholder="仅演示本地存储，真实业务禁止明文入库"
            />
          </label>
        </div>
        <div className={styles.formActions}>
          <button
            type="button"
            className={`${styles.saveButton} ${saving ? styles.runButtonDisabled : ""}`}
            onClick={this.handleSaveUser}
            disabled={saving}
          >
            {saving ? "存储中…" : isEditing ? "保存修改" : "存储数据"}
          </button>
          {isEditing ? (
            <button type="button" className={styles.cancelButton} onClick={this.handleCancelEdit}>
              取消编辑
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  /** 渲染单条用户记录行：字段摘要 + 编辑 / 删除操作。 */
  renderUserRow = (record) => {
    const isEditing = this.state.editingUserId === record.user_id;

    return (
      <li key={record.user_id} className={`${styles.userRow} ${isEditing ? styles.userRowEditing : ""}`}>
        <div className={styles.userCellMain}>
          <span className={styles.userNickname}>{record.nickname || "（无昵称）"}</span>
          <span className={styles.userMeta}>
            ID：{record.user_id} · 用户名：{record.username || "-"}
          </span>
        </div>
        <span className={styles.userCellPassword} title="密码已本地存储（演示数据）">
          密码：{record.password ? "••••••" : "-"}
        </span>
        <span className={styles.userCellTime}>
          {record.cached_at ? new Date(record.cached_at).toLocaleString() : "-"}
        </span>
        <div className={styles.userActions}>
          <button type="button" className={styles.rowEditButton} onClick={() => this.handleEditUser(record)}>
            编辑
          </button>
          <button type="button" className={styles.rowDeleteButton} onClick={() => this.handleDeleteUser(record)}>
            删除
          </button>
        </div>
      </li>
    );
  };

  /** 渲染数据管理面板：录入表单 + 查询工具栏 + 用户列表。 */
  renderUserManager = () => {
    const { userList, listMessage, listLoading } = this.state;

    return (
      <section className={styles.group}>
        <h2 className={styles.groupTitle}>数据管理（IndexedDB 增删改查）</h2>
        {this.renderUserForm()}
        {listMessage ? (
          <p className={listMessage.isError ? styles.actionMessageError : styles.actionMessage}>
            {listMessage.text}
          </p>
        ) : null}
        <div className={styles.listToolbar}>
          <button
            type="button"
            className={`${styles.queryButton} ${listLoading ? styles.runButtonDisabled : ""}`}
            onClick={this.handleQueryUserList}
            disabled={listLoading}
          >
            {listLoading ? "查询中…" : "查询列表"}
          </button>
          <span className={styles.listCount}>当前展示 {userList.length} 条（查询结果为点击时刻的数据快照）</span>
        </div>
        {userList.length === 0 ? (
          <p className={styles.listEmpty}>暂无数据，点击「查询列表」从 IndexedDB 读取，或填写表单后点击「存储数据」。</p>
        ) : (
          <ul className={styles.userList}>{userList.map((record) => this.renderUserRow(record))}</ul>
        )}
        <p className={styles.userHint}>
          交互约定：增、删、改、查全部由按钮点击触发执行——存储/保存修改/删除/查询均需手动点击，
          页面不做自动加载与自动刷新；每次操作结果通过提示文案反馈。
          数据持久化在浏览器 IndexedDB（user_profiles 表），刷新页面后仍在；
          「运行全部测试」与「清空本地数据库」会重建数据库，将清除这里录入的数据。
        </p>
      </section>
    );
  };

  /** 渲染工具栏：运行/清库按钮与汇总统计。 */
  renderToolbar = () => {
    const { running, finished } = this.state;
    const summary = this.getSummary();

    return (
      <div className={styles.toolbar}>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={`${styles.runButton} ${running ? styles.runButtonDisabled : ""}`}
            onClick={this.handleRunAll}
            disabled={running}
          >
            {running ? "测试执行中…" : finished ? "重新运行全部测试" : "运行全部测试"}
          </button>
          <button
            type="button"
            className={`${styles.clearButton} ${running ? styles.runButtonDisabled : ""}`}
            onClick={this.handleClearDatabase}
            disabled={running}
          >
            清空本地数据库
          </button>
        </div>
        <div className={styles.summary}>
          <span>共 {summary.total} 项</span>
          <span className={styles.summaryPassed}>通过 {summary.passed}</span>
          <span className={summary.failed > 0 ? styles.summaryFailed : styles.summaryPlain}>失败 {summary.failed}</span>
          {(summary.pending > 0 || summary.running > 0) && (
            <span className={styles.summaryPlain}>待执行 {summary.pending + summary.running}</span>
          )}
        </div>
      </div>
    );
  };

  /** 渲染单个用例行：状态徽标、名称、耗时与失败原因。 */
  renderResultItem = (testCase, state) => {
    const isFailed = state.status === HG_CASE_STATUS.FAILED;

    return (
      <li key={testCase.key} className={`${styles.caseItem} ${isFailed ? styles.caseItemFailed : ""}`}>
        <div className={styles.caseRow}>
          <span className={`${styles.statusChip} ${HG_STATUS_CLASSES[state.status]}`}>
            {HG_STATUS_LABELS[state.status]}
          </span>
          <span className={styles.caseName}>{testCase.name}</span>
          {state.durationMs !== null ? (
            <span className={styles.caseDuration}>{state.durationMs} ms</span>
          ) : null}
        </div>
        {isFailed && state.error ? (
          <pre className={styles.caseError}>{state.error}</pre>
        ) : null}
      </li>
    );
  };

  /** 渲染分组结果列表。 */
  renderResultGroups = () => {
    const { caseStates } = this.state;
    let caseIndex = 0;

    return this.groups.map((group) => (
      <section key={group.name} className={styles.group}>
        <h2 className={styles.groupTitle}>{group.name}</h2>
        <ul className={styles.caseList}>
          {group.cases.map((testCase) => {
            const state = caseStates[caseIndex];
            const item = this.renderResultItem(testCase, state);
            caseIndex += 1;
            return item;
          })}
        </ul>
      </section>
    ));
  };

  render() {
    const { clearMessage } = this.state;

    return (
      <div className={styles.page}>
        {this.renderHeader()}
        {this.renderUserManager()}
        {this.renderToolbar()}
        {clearMessage ? <p className={styles.clearMessage}>{clearMessage}</p> : null}
        {this.renderResultGroups()}
      </div>
    );
  }
}
