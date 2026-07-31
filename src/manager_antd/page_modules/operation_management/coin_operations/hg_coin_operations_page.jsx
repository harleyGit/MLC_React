import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGInputPage, { HGInputSearch, HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import HGInputNumberPage from "../../../../components/hg_input_number/hg_input_number_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import styles from "./hg_coin_operations.module.css";
import HGCoinOperationsVM, { HG_COIN_TRANSACTION_PAGE_SIZE } from "./hg_coin_operations_vm";

const EMPTY_ACCOUNT = { userId: "", balance: "0", authority: "mysql" };

/** 权威硬币资产、Interaction 重投影与 Kafka lag 的统一运维页面。 */
class HGCoinOperationsPage extends Component {
  state = {
    userIdInput: "",
    account: null,
    accountLoading: false,
    transactions: [],
    transactionLoading: false,
    cursorByPage: { 1: "" },
    pagination: { current: 1, pageSize: HG_COIN_TRANSACTION_PAGE_SIZE, total: 0 },
    pipeline: null,
    pipelineLoading: false,
    lastStatusError: "",
    modal: null,
    form: {},
    submitting: false,
  };

  componentDidMount() {
    this.fetchPipelineStatus();
  }

  /** 加载链路状态；失败时保留上一份成功快照并标记陈旧状态。 */
  fetchPipelineStatus = () => {
    this.setState({ pipelineLoading: true });
    HGCoinOperationsVM.fetchPipelineStatus()
      .then((pipeline) => this.setState({ pipeline, lastStatusError: "" }))
      .catch((error) => this.setState({ lastStatusError: error?.message || "状态加载失败" }))
      .finally(() => this.setState({ pipelineLoading: false }));
  };

  /** 查询权威余额后从流水第一页重建 cursor 链。 */
  searchAccount = (rawUserId) => {
    const userId = String(rawUserId || "").trim();
    if (!userId) {
      this.setState({ account: null, transactions: [], cursorByPage: { 1: "" } });
      return;
    }
    this.setState({ accountLoading: true, userIdInput: userId });
    HGCoinOperationsVM.fetchAccount(userId)
      .then((account) => this.setState({ account: account || { ...EMPTY_ACCOUNT, userId }, cursorByPage: { 1: "" } }, () => this.fetchTransactions(1, HG_COIN_TRANSACTION_PAGE_SIZE)))
      .catch((error) => message.error(error?.message || "权威余额查询失败"))
      .finally(() => this.setState({ accountLoading: false }));
  };

  /** 使用后端不透明 cursor 翻页，前端不推导数据库主键或时间边界。 */
  fetchTransactions = (pageNum, pageSize) => {
    const userId = this.state.account?.userId;
    if (!userId) return;
    const cursor = this.state.cursorByPage[pageNum] || "";
    this.setState({ transactionLoading: true });
    HGCoinOperationsVM.fetchTransactions({ userId, cursor, pageSize })
      .then((result) => {
        const rows = HGCoinOperationsVM.toTransactionRows(result?.list || []);
        this.setState((state) => {
          const cursorByPage = { ...state.cursorByPage };
          if (result?.hasMore && result.nextCursor) cursorByPage[pageNum + 1] = result.nextCursor;
          return {
            transactions: rows,
            cursorByPage,
            pagination: {
              current: pageNum,
              pageSize,
              total: (pageNum - 1) * pageSize + rows.length + (result?.hasMore ? 1 : 0),
            },
          };
        });
      })
      .catch((error) => message.error(error?.message || "资产流水查询失败"))
      .finally(() => this.setState({ transactionLoading: false }));
  };

  handleTableChange = (pagination) => {
    if (pagination.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: "" } }, () => this.fetchTransactions(1, pagination.pageSize));
      return;
    }
    this.fetchTransactions(pagination.current, pagination.pageSize);
  };

  /** 打开写操作弹窗时生成一次 requestId，失败重试继续复用。 */
  openMutation = (operation, record = null) => {
    const userId = this.state.account?.userId;
    if (!userId) {
      message.warning("请先查询目标用户");
      return;
    }
    this.setState({
      modal: operation,
      form: {
        userId,
        requestId: HGCoinOperationsVM.createRequestId(operation),
        amount: 1,
        delta: 1,
        reason: "",
        businessKey: "",
        referenceTransactionId: record?.transactionId || "",
      },
    });
  };

  closeMutation = () => {
    if (!this.state.submitting) this.setState({ modal: null, form: {} });
  };

  changeForm = (field, value) => this.setState((state) => ({ form: { ...state.form, [field]: value } }));

  submitMutation = () => {
    const { modal, form } = this.state;
    const validationError = HGCoinOperationsVM.validateMutation(modal, form);
    if (validationError) {
      message.error(validationError);
      return;
    }
    const request = modal === "grant"
      ? HGCoinOperationsVM.grantCoin(form)
      : modal === "refund"
        ? HGCoinOperationsVM.refundCoin(form)
        : HGCoinOperationsVM.correctCoin(form);
    this.setState({ submitting: true });
    request
      .then((result) => {
        message.success(result?.idempotentReplay ? "幂等请求已确认，无重复资产变化" : `资产操作成功，流水 ${result?.transactionId || "--"}`);
        this.setState({ modal: null, form: {} });
        this.searchAccount(form.userId);
        this.fetchPipelineStatus();
      })
      .catch((error) => message.error(error?.message || "资产操作失败，requestId 已保留，可安全重试"))
      .finally(() => this.setState({ submitting: false }));
  };

  getTransactionColumns = () => [
    { title: "流水 ID", dataIndex: "transactionId", width: 120 },
    { title: "类型", dataIndex: "operationLabel", width: 90 },
    { title: "变更", dataIndex: "signedDelta", width: 90, render: (value) => <strong className={Number(value) >= 0 ? styles.positive : styles.negative}>{Number(value) >= 0 ? "+" : ""}{value}</strong> },
    { title: "变更后余额", dataIndex: "balanceAfter", width: 120 },
    { title: "业务", dataIndex: "businessType", width: 120, render: (value, record) => value ? `${value} / ${record.businessKey}` : "--" },
    { title: "关联流水", dataIndex: "referenceTransactionId", width: 110, render: (value) => value || "--" },
    { title: "审计原因", dataIndex: "reason", width: 260 },
    { title: "时间", dataIndex: "createdAt", width: 180, render: HGCoinOperationsVM.formatTime },
    { title: "操作", dataIndex: "action", width: 90, render: (_, record) => record.operation === "debit" ? <a className={styles.action} onClick={() => this.openMutation("refund", record)}>退款</a> : "--" },
  ];

  getKafkaColumns = () => [
    { title: "Consumer Group", dataIndex: "group", width: 220 },
    { title: "Topic", dataIndex: "topic", width: 220 },
    { title: "Lag", dataIndex: "lagRecords", width: 120, render: HGCoinOperationsVM.formatInteger },
    { title: "状态", dataIndex: "level", width: 110, render: (level) => <span className={`${styles.statusPill} ${styles[level]}`}>{level === "critical" ? "严重" : level === "warning" ? "预警" : "正常"}</span> },
    { title: "口径", dataIndex: "measurement", render: () => "应用已观察处理 lag（非 committed-offset lag）" },
  ];

  renderAccountCard = () => {
    const { account, accountLoading, userIdInput } = this.state;
    return (
      <HGCardPage title="权威资产查询" extra={<HGButtonPage disabled={!account} onClick={() => account && this.searchAccount(account.userId)}>刷新账户</HGButtonPage>}>
        <div className={styles.searchRow}>
          <HGInputSearch value={userIdInput} allowClear enterButton={accountLoading ? "查询中..." : "查询"} disabled={accountLoading} placeholder="输入业务 userId" onChange={(event) => this.setState({ userIdInput: event.target.value })} onSearch={this.searchAccount} />
          <p>查询直接读取 MySQL `user_coin_wallets`，Redis 不作为资产权威。</p>
        </div>
        {account ? (
          <div className={styles.accountSummary}>
            <div><span>用户</span><strong>{account.userId}</strong></div>
            <div><span>权威余额</span><strong className={styles.balance}>{HGCoinOperationsVM.formatInteger(account.balance)}</strong></div>
            <div><span>数据源</span><strong>{String(account.authority || "mysql").toUpperCase()}</strong></div>
            <div className={styles.operationButtons}>
              <HGButtonPage type="primary" onClick={() => this.openMutation("grant")}>赠币</HGButtonPage>
              <HGButtonPage danger onClick={() => this.openMutation("correct")}>资产修正</HGButtonPage>
            </div>
          </div>
        ) : <div className={styles.empty}>输入用户 ID 后查询权威余额与不可变流水</div>}
      </HGCardPage>
    );
  };

  renderPipelineCards = () => {
    const { pipeline, pipelineLoading, lastStatusError } = this.state;
    const streams = pipeline?.interactionStreams || [];
    const totalFailures = streams.reduce((sum, item) => sum + Number(item.failures || 0), 0);
    const maxLag = Math.max(0, ...(pipeline?.kafka?.items || []).map((item) => Number(item.lagRecords || 0)));
    return (
      <HGCardPage title="链路健康" extra={<HGButtonPage loading={pipelineLoading} onClick={this.fetchPipelineStatus}>刷新状态</HGButtonPage>}>
        {lastStatusError && <div className={styles.staleBanner}>状态刷新失败，当前展示上一次成功快照：{lastStatusError}</div>}
        <div className={styles.statusGrid}>
          <div className={styles.metricCard}><span>钱包初始化游标</span><strong>{HGCoinOperationsVM.formatInteger(pipeline?.coinInitializerCursor || "0")}</strong><small>users.id keyset checkpoint</small></div>
          <div className={styles.metricCard}><span>累计资产漂移</span><strong className={Number(pipeline?.coinReconciliationDrifts || 0) > 0 ? styles.warningText : ""}>{HGCoinOperationsVM.formatInteger(pipeline?.coinReconciliationDrifts || "0")}</strong><small>仅检测，不自动覆盖余额</small></div>
          <div className={styles.metricCard}><span>重投影失败</span><strong className={totalFailures > 0 ? styles.criticalText : ""}>{HGCoinOperationsVM.formatInteger(totalFailures)}</strong><small>四条固定 MySQL → Redis 流</small></div>
          <div className={styles.metricCard}><span>最大 Kafka Lag</span><strong className={maxLag >= 10000 ? styles.criticalText : maxLag >= 1000 ? styles.warningText : ""}>{HGCoinOperationsVM.formatInteger(maxLag)}</strong><small>Warning 1000 / Critical 10000</small></div>
        </div>
        <div className={styles.streamGrid}>
          {streams.map((stream) => (
            <div className={styles.streamCard} key={stream.stream}>
              <div><strong>{stream.stream}</strong><span>{Number(stream.failures || 0) > 0 ? "需关注" : "运行正常"}</span></div>
              <p>Rows {HGCoinOperationsVM.formatInteger(stream.rows)} · Runs {HGCoinOperationsVM.formatInteger(stream.runs)} · Lease skips {HGCoinOperationsVM.formatInteger(stream.leaseSkips)}</p>
              <code title={stream.checkpoint}>{stream.checkpoint || "尚无 checkpoint"}</code>
            </div>
          ))}
        </div>
        <p className={styles.observedAt}>观测时间：{HGCoinOperationsVM.formatTime(pipeline?.observedAt)}</p>
      </HGCardPage>
    );
  };

  renderMutationModal = () => {
    const { modal, form, submitting } = this.state;
    if (!modal) return null;
    const title = modal === "grant" ? "人工赠币" : modal === "refund" ? "原扣款退款" : "资产修正";
    return (
      <HGModalPage visible title={title} size="large" closable={!submitting} onClose={this.closeMutation} footer={<><HGButtonPage disabled={submitting} onClick={this.closeMutation}>取消</HGButtonPage><HGButtonPage type="primary" danger={modal === "correct"} loading={submitting} onClick={this.submitMutation}>确认提交</HGButtonPage></>}>
        <div className={styles.riskNotice}>该操作将写入 MySQL 不可变资产流水与 Outbox。不要刷新 requestId 后重复提交同一业务。</div>
        <div className={styles.formGrid}>
          <label>目标用户<HGInputPage value={form.userId || ""} disabled /></label>
          <label>Request ID<HGInputPage value={form.requestId || ""} disabled /></label>
          {modal === "correct" ? <label>修正值（-1000 至 1000）<HGInputNumberPage value={form.delta} min={-1000} max={1000} step={1} onChange={(value) => this.changeForm("delta", value)} /></label> : <label>数量（1 至 1000）<HGInputNumberPage value={form.amount} min={1} max={1000} step={1} onChange={(value) => this.changeForm("amount", value)} /></label>}
          {modal === "grant" && <label>活动/工单编号<HGInputPage value={form.businessKey || ""} maxLength={255} onChange={(event) => this.changeForm("businessKey", event.target.value)} /></label>}
          {modal === "refund" && <label>原扣款流水 ID<HGInputPage value={form.referenceTransactionId || ""} onChange={(event) => this.changeForm("referenceTransactionId", event.target.value)} /></label>}
          <label className={styles.fullField}>审计原因<HGInputTextArea value={form.reason || ""} rows={4} maxLength={200} placeholder="填写工单、活动或已确认漂移原因" onChange={(event) => this.changeForm("reason", event.target.value)} /></label>
        </div>
      </HGModalPage>
    );
  };

  render() {
    const { account, transactions, transactionLoading, pagination, pipeline } = this.state;
    const kafkaRows = HGCoinOperationsVM.toKafkaRows(pipeline?.kafka?.items || []);
    return (
      <div className={styles.container}>
        <div className={styles.hero}><div><span>CONTROL PLANE / COIN ASSET</span><h2>硬币资产与异步链路</h2><p>所有写操作进入同一权威事务，展示投影可随时从 MySQL 重建。</p></div><div className={styles.heroMark}>COIN<br />OPS</div></div>
        {this.renderAccountCard()}
        <HGCardPage title="不可变资产流水"><HGTablePage rowKey="key" columns={this.getTransactionColumns()} dataSource={transactions} loading={transactionLoading} pagination={account ? { ...pagination, showSizeChanger: true } : false} onChange={this.handleTableChange} scroll={{ y: 400 }} /></HGCardPage>
        {this.renderPipelineCards()}
        <HGCardPage title="Kafka Consumer Lag"><HGTablePage rowKey="key" columns={this.getKafkaColumns()} dataSource={kafkaRows} pagination={false} scroll={{ y: 320 }} /></HGCardPage>
        {this.renderMutationModal()}
      </div>
    );
  }
}

export default HGCoinOperationsPage;
