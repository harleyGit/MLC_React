import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGInputPage, { HGInputSearch, HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import HGInputNumberPage from "../../../../components/hg_input_number/hg_input_number_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import styles from "./hg_coin_operations.module.css";
import {
  HG_ASSET_PERMISSIONS,
  canApproveCorrection,
  getCurrentOperatorId,
  normalizeAssetPermissions,
  normalizeCoinUserSearchResponse,
} from "./hg_coin_operations_helpers.js";
import HGCoinOperationsVM, { HG_COIN_CORRECTION_PAGE_SIZE, HG_COIN_TRANSACTION_PAGE_SIZE } from "./hg_coin_operations_vm";

const EMPTY_ACCOUNT = { userId: "", balance: "0", authority: "mysql" };
const USER_SEARCH_FIELDS = [
  { value: "userId", label: "用户 ID" },
  { value: "phone", label: "手机号" },
  { value: "email", label: "邮箱" },
];

/** 权威硬币资产、Interaction 重投影与 Kafka lag 的统一运维页面。 */
class HGCoinOperationsPage extends Component {
  state = {
    userIdInput: "",
    userSearchField: "userId",
    userSearchLoading: false,
    selectedUser: null,
    permissions: [],
    permissionsLoading: true,
    permissionsError: "",
    operatorId: getCurrentOperatorId(HGUserProfileStorage.getUserProfile()),
    account: null,
    accountLoading: false,
    transactions: [],
    transactionLoading: false,
    cursorByPage: { 1: "" },
    pagination: { current: 1, pageSize: HG_COIN_TRANSACTION_PAGE_SIZE, total: 0 },
    corrections: [],
    correctionLoading: false,
    correctionCursorByPage: { 1: "" },
    correctionPagination: { current: 1, pageSize: HG_COIN_CORRECTION_PAGE_SIZE, total: 0 },
    pendingCorrection: null,
    approvingCorrectionId: "",
    pipeline: null,
    pipelineLoading: false,
    lastStatusError: "",
    modal: null,
    form: {},
    submitting: false,
  };

  componentDidMount() {
    this.fetchAssetPermissions();
  }

  componentWillUnmount() {
    // 请求层暂不接收外部 AbortSignal，用递增序列号让已发出的 Promise 回调在卸载后自动失效。
    this.userSearchSequence = (this.userSearchSequence || 0) + 1;
    this.accountRequestSequence = (this.accountRequestSequence || 0) + 1;
    this.transactionRequestSequence = (this.transactionRequestSequence || 0) + 1;
  }

  /** 权限加载完成前不发起受保护的资产数据请求；后端仍执行最终鉴权。 */
  fetchAssetPermissions = () => {
    this.setState({ permissionsLoading: true, permissionsError: "" });
    HGCoinOperationsVM.fetchAssetPermissions()
      .then((response) => {
        const permissions = normalizeAssetPermissions(response);
        this.setState({ permissions }, () => {
          if (this.hasPermission(HG_ASSET_PERMISSIONS.PIPELINE_READ)) this.fetchPipelineStatus();
          if (this.hasPermission(HG_ASSET_PERMISSIONS.CORRECTION_REQUEST)) this.fetchCorrections(1, HG_COIN_CORRECTION_PAGE_SIZE);
        });
      })
      .catch((error) => this.setState({ permissions: [], permissionsError: error?.message || "资产权限加载失败" }))
      .finally(() => this.setState({ permissionsLoading: false }));
  };

  /** 页面权限仅控制可见性和交互，不能替代后端授权。 */
  hasPermission = (permission) => this.state.permissions.includes(permission);

  /** 判断当前操作人是否需要目标用户选择器，不据此放宽任何接口权限。 */
  canSelectTargetUser = () => [
    HG_ASSET_PERMISSIONS.BALANCE_READ,
    HG_ASSET_PERMISSIONS.TRANSACTION_READ,
    HG_ASSET_PERMISSIONS.GRANT,
    HG_ASSET_PERMISSIONS.REFUND,
    HG_ASSET_PERMISSIONS.CORRECTION_REQUEST,
  ].some((permission) => this.hasPermission(permission));

  /** 加载链路状态；失败时保留上一份成功快照并标记陈旧状态。 */
  fetchPipelineStatus = () => {
    this.setState({ pipelineLoading: true });
    HGCoinOperationsVM.fetchPipelineStatus()
      .then((pipeline) => this.setState({ pipeline, lastStatusError: "" }))
      .catch((error) => this.setState({ lastStatusError: error?.message || "状态加载失败" }))
      .finally(() => this.setState({ pipelineLoading: false }));
  };

  /** 使用明确身份类型精确定位用户，避免亿级 users 表模糊扫描和跨字段误选。 */
  searchTargetUser = (rawKeyword) => {
    const { userSearchField } = this.state;
    const keyword = String(rawKeyword || "").trim();
    if (!keyword) {
      this.setState({ account: null, selectedUser: null, transactions: [], cursorByPage: { 1: "" } });
      return;
    }
    const sequence = (this.userSearchSequence || 0) + 1;
    this.userSearchSequence = sequence;
    this.setState({ userSearchLoading: true, userIdInput: keyword, selectedUser: null });
    HGCoinOperationsVM.searchUser(userSearchField, keyword)
      .then((response) => {
        if (sequence !== this.userSearchSequence) return;
        const selectedUser = normalizeCoinUserSearchResponse(response);
        if (!selectedUser) {
          this.setState({ account: null, selectedUser: null, transactions: [], cursorByPage: { 1: "" } });
          message.warning("未找到匹配用户，请确认搜索类型和完整内容");
          return;
        }
        this.setState({ selectedUser, userIdInput: selectedUser.userId }, () => this.searchAccount(selectedUser.userId));
      })
      .catch((error) => {
        if (sequence === this.userSearchSequence) message.error(error?.message || "用户搜索失败");
      })
      .finally(() => {
        if (sequence === this.userSearchSequence) this.setState({ userSearchLoading: false });
      });
  };

  handleUserSearchFieldChange = (userSearchField) => {
    this.userSearchSequence = (this.userSearchSequence || 0) + 1;
    this.setState({ userSearchField, userIdInput: "", selectedUser: null, account: null, transactions: [], cursorByPage: { 1: "" } });
  };

  handleUserSearchInputChange = (event) => {
    // 输入与已确认 userId 不再一致时立即失效旧请求和账户，防止对上一个用户执行资产操作。
    this.userSearchSequence = (this.userSearchSequence || 0) + 1;
    this.accountRequestSequence = (this.accountRequestSequence || 0) + 1;
    this.transactionRequestSequence = (this.transactionRequestSequence || 0) + 1;
    this.setState({ userIdInput: event.target.value, selectedUser: null, account: null, transactions: [], cursorByPage: { 1: "" } });
  };

  /** 查询权威余额后从流水第一页重建 cursor 链，并忽略快速切换用户产生的陈旧响应。 */
  searchAccount = (rawUserId) => {
    const userId = String(rawUserId || "").trim();
    if (!userId) {
      this.setState({ account: null, transactions: [], cursorByPage: { 1: "" } });
      return;
    }
    const sequence = (this.accountRequestSequence || 0) + 1;
    this.accountRequestSequence = sequence;
    this.transactionRequestSequence = (this.transactionRequestSequence || 0) + 1;
    this.setState({ accountLoading: true, userIdInput: userId });
    if (!this.hasPermission(HG_ASSET_PERMISSIONS.BALANCE_READ)) {
      this.setState({ account: { ...EMPTY_ACCOUNT, userId }, cursorByPage: { 1: "" }, accountLoading: false }, () => {
        if (this.hasPermission(HG_ASSET_PERMISSIONS.TRANSACTION_READ)) this.fetchTransactions(1, HG_COIN_TRANSACTION_PAGE_SIZE);
      });
      return;
    }
    HGCoinOperationsVM.fetchAccount(userId)
      .then((account) => {
        if (sequence !== this.accountRequestSequence) return;
        this.setState({ account: account || { ...EMPTY_ACCOUNT, userId }, cursorByPage: { 1: "" } }, () => {
          if (this.hasPermission(HG_ASSET_PERMISSIONS.TRANSACTION_READ)) this.fetchTransactions(1, HG_COIN_TRANSACTION_PAGE_SIZE);
        });
      })
      .catch((error) => {
        if (sequence === this.accountRequestSequence) message.error(error?.message || "权威余额查询失败");
      })
      .finally(() => {
        if (sequence === this.accountRequestSequence) this.setState({ accountLoading: false });
      });
  };

  /** 使用后端不透明 cursor 翻页，前端不推导数据库主键或时间边界。 */
  fetchTransactions = (pageNum, pageSize) => {
    if (!this.hasPermission(HG_ASSET_PERMISSIONS.TRANSACTION_READ)) return;
    const userId = this.state.account?.userId;
    if (!userId) return;
    const cursor = this.state.cursorByPage[pageNum] || "";
    const sequence = (this.transactionRequestSequence || 0) + 1;
    this.transactionRequestSequence = sequence;
    this.setState({ transactionLoading: true });
    HGCoinOperationsVM.fetchTransactions({ userId, cursor, pageSize })
      .then((result) => {
        if (sequence !== this.transactionRequestSequence || this.state.account?.userId !== userId) return;
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
      .catch((error) => {
        if (sequence === this.transactionRequestSequence) message.error(error?.message || "资产流水查询失败");
      })
      .finally(() => {
        if (sequence === this.transactionRequestSequence) this.setState({ transactionLoading: false });
      });
  };

  handleTableChange = (pagination) => {
    if (pagination.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: "" } }, () => this.fetchTransactions(1, pagination.pageSize));
      return;
    }
    this.fetchTransactions(pagination.current, pagination.pageSize);
  };

  /** 使用后端 correction ID cursor 有界加载双人复核记录。 */
  fetchCorrections = (pageNum, pageSize) => {
    if (!this.hasPermission(HG_ASSET_PERMISSIONS.CORRECTION_REQUEST)) return;
    const cursor = this.state.correctionCursorByPage[pageNum] || "";
    this.setState({ correctionLoading: true });
    HGCoinOperationsVM.fetchCorrections({ cursor, pageSize })
      .then((result) => {
        const rows = HGCoinOperationsVM.toCorrectionRows(result?.list || []);
        this.setState((state) => {
          const correctionCursorByPage = { ...state.correctionCursorByPage };
          if (result?.hasMore && result.nextCursor) correctionCursorByPage[pageNum + 1] = String(result.nextCursor);
          return {
            corrections: rows,
            correctionCursorByPage,
            correctionPagination: {
              current: pageNum,
              pageSize,
              total: (pageNum - 1) * pageSize + rows.length + (result?.hasMore ? 1 : 0),
            },
          };
        });
      })
      .catch((error) => message.error(error?.message || "修正申请列表加载失败"))
      .finally(() => this.setState({ correctionLoading: false }));
  };

  handleCorrectionTableChange = (pagination) => {
    if (pagination.pageSize !== this.state.correctionPagination.pageSize) {
      this.setState({ correctionCursorByPage: { 1: "" } }, () => this.fetchCorrections(1, pagination.pageSize));
      return;
    }
    this.fetchCorrections(pagination.current, pagination.pageSize);
  };

  /** 打开写操作弹窗时生成一次 requestId，失败重试继续复用。 */
  openMutation = (operation, record = null, initialDelta = 1) => {
    const requiredPermission = {
      grant: HG_ASSET_PERMISSIONS.GRANT,
      refund: HG_ASSET_PERMISSIONS.REFUND,
      correct: HG_ASSET_PERMISSIONS.CORRECTION_REQUEST,
    }[operation];
    if (!this.hasPermission(requiredPermission)) return;
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
        delta: initialDelta,
        reason: "",
        businessKey: "",
        ticketId: "",
        workOrderId: "",
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
        if (modal === "correct") {
          message.success(`修正申请已提交，状态 ${result?.status || "pending"}`);
          this.setState({ modal: null, form: {}, pendingCorrection: result || null });
          this.fetchCorrections(1, this.state.correctionPagination.pageSize);
          return;
        }
        message.success(result?.idempotentReplay ? "幂等请求已确认，无重复资产变化" : `资产操作成功，流水 ${result?.transactionId || "--"}`);
        this.setState({ modal: null, form: {} });
        this.searchAccount(form.userId);
        if (this.hasPermission(HG_ASSET_PERMISSIONS.PIPELINE_READ)) this.fetchPipelineStatus();
      })
      .catch((error) => message.error(error?.message || "资产操作失败，requestId 已保留，可安全重试"))
      .finally(() => this.setState({ submitting: false }));
  };

  /** 审批操作只提交 correctionId；申请人与审批人分离由前后端共同提示、后端强制。 */
  approveCorrection = (record) => {
    const { permissions, operatorId } = this.state;
    if (!canApproveCorrection(permissions, record, operatorId)) return;
    this.setState({ approvingCorrectionId: record.correctionId });
    HGCoinOperationsVM.approveCorrection(record.correctionId)
      .then((result) => {
        message.success(`修正已审批并应用，流水 ${result?.transactionId || "--"}`);
        this.setState({ pendingCorrection: result || null });
        this.fetchCorrections(this.state.correctionPagination.current, this.state.correctionPagination.pageSize);
        if (this.state.account?.userId === result?.userId && this.hasPermission(HG_ASSET_PERMISSIONS.BALANCE_READ)) this.searchAccount(result.userId);
      })
      .catch((error) => message.error(error?.message || "修正审批失败"))
      .finally(() => this.setState({ approvingCorrectionId: "" }));
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
    { title: "操作", dataIndex: "action", width: 90, render: (_, record) => record.operation === "debit" && this.hasPermission(HG_ASSET_PERMISSIONS.REFUND) ? <a className={styles.action} onClick={() => this.openMutation("refund", record)}>退款</a> : "--" },
  ];

  getCorrectionColumns = () => [
    { title: "修正 ID", dataIndex: "correctionId", width: 130 },
    { title: "目标用户", dataIndex: "userId", width: 120 },
    { title: "修正值", dataIndex: "delta", width: 85, render: (value) => <strong className={Number(value) >= 0 ? styles.positive : styles.negative}>{Number(value) >= 0 ? "+" : ""}{value}</strong> },
    { title: "Ticket / Work Order", dataIndex: "ticketId", width: 190, render: (value, record) => [value, record.workOrderId].filter(Boolean).join(" / ") || "--" },
    { title: "申请人", dataIndex: "applicantId", width: 120 },
    { title: "审批人", dataIndex: "approverId", width: 120, render: (value) => value || "--" },
    { title: "状态", dataIndex: "status", width: 100, render: (status) => <span className={`${styles.correctionStatus} ${styles[`correction_${status}`] || ""}`}>{HGCoinOperationsVM.getCorrectionStatusLabel(status)}</span> },
    { title: "原因", dataIndex: "reason", width: 220 },
    { title: "申请时间", dataIndex: "createdAt", width: 180, render: HGCoinOperationsVM.formatTime },
    { title: "操作", dataIndex: "action", width: 110, render: (_, record) => this.renderCorrectionAction(record) },
  ];

  renderCorrectionAction = (record) => {
    const { permissions, operatorId, approvingCorrectionId } = this.state;
    const hasApprovalPermissions = permissions.includes(HG_ASSET_PERMISSIONS.CORRECTION_APPROVE)
      && permissions.includes(HG_ASSET_PERMISSIONS.CORRECTION_APPLY);
    if (!hasApprovalPermissions || record.status !== "pending") return "--";
    if (operatorId && String(record.applicantId) === operatorId) return <span className={styles.disabledAction}>本人申请，不可审批</span>;
    return <HGButtonPage type="link" loading={approvingCorrectionId === record.correctionId} onClick={() => this.approveCorrection(record)}>审批并应用</HGButtonPage>;
  };

  getKafkaColumns = () => [
    { title: "Consumer Group", dataIndex: "group", width: 220 },
    { title: "Topic", dataIndex: "topic", width: 220 },
    { title: "Lag", dataIndex: "lagRecords", width: 120, render: HGCoinOperationsVM.formatInteger },
    { title: "状态", dataIndex: "level", width: 110, render: (level) => <span className={`${styles.statusPill} ${styles[level]}`}>{level === "critical" ? "严重" : level === "warning" ? "预警" : "正常"}</span> },
    { title: "口径", dataIndex: "measurement", render: () => "应用已观察处理 lag（非 committed-offset lag）" },
  ];

  renderAccountCard = () => {
    const { account, accountLoading, userIdInput, userSearchField, userSearchLoading, selectedUser } = this.state;
    const canReadBalance = this.hasPermission(HG_ASSET_PERMISSIONS.BALANCE_READ);
    return (
      <HGCardPage title={canReadBalance ? "权威资产查询" : "目标用户选择"} extra={<HGButtonPage disabled={!account} onClick={() => account && this.searchAccount(account.userId)}>刷新数据</HGButtonPage>}>
        <div className={styles.searchRow}>
          <div className={styles.userSearchControl}>
            <HGSelectPage value={userSearchField} options={USER_SEARCH_FIELDS} disabled={userSearchLoading || accountLoading} onChange={this.handleUserSearchFieldChange} />
            <HGInputSearch value={userIdInput} allowClear enterButton={userSearchLoading || accountLoading ? "查询中..." : "精确查询"} disabled={userSearchLoading || accountLoading} placeholder={`输入完整${USER_SEARCH_FIELDS.find((item) => item.value === userSearchField)?.label || "用户信息"}`} onChange={this.handleUserSearchInputChange} onSearch={this.searchTargetUser} />
          </div>
          <p>按所选字段唯一索引精确查询，不支持模糊匹配。{canReadBalance ? "余额以 MySQL 为权威，Redis 不作为资产权威。" : "当前权限不读取余额。"}</p>
        </div>
        {selectedUser && <div className={styles.identityNotice}><span>已确认目标</span><strong>{selectedUser.userId}</strong><span>{[selectedUser.userName, selectedUser.nickName].filter(Boolean).join(" / ") || "未设置名称"}</span><span>{[selectedUser.maskedPhone, selectedUser.maskedEmail].filter(Boolean).join(" · ") || "未设置联系方式"}</span></div>}
        {account ? (
          <div className={styles.accountSummary}>
            <div><span>用户</span><strong>{account.userId}</strong></div>
            {canReadBalance && <div><span>权威余额</span><strong className={styles.balance}>{HGCoinOperationsVM.formatInteger(account.balance)}</strong></div>}
            {canReadBalance && <div><span>数据源</span><strong>{String(account.authority || "mysql").toUpperCase()}</strong></div>}
            <div className={styles.operationButtons}>
              {this.hasPermission(HG_ASSET_PERMISSIONS.GRANT) && <HGButtonPage type="primary" onClick={() => this.openMutation("grant")}>赠币</HGButtonPage>}
              {this.hasPermission(HG_ASSET_PERMISSIONS.CORRECTION_REQUEST) && <HGButtonPage danger onClick={() => this.openMutation("correct", null, -1)}>减少币（需复核）</HGButtonPage>}
              {this.hasPermission(HG_ASSET_PERMISSIONS.CORRECTION_REQUEST) && <HGButtonPage onClick={() => this.openMutation("correct")}>其他资产修正</HGButtonPage>}
            </div>
          </div>
        ) : <div className={styles.empty}>选择搜索类型并输入完整用户 ID、手机号或邮箱，确认目标后加载资产数据与操作</div>}
      </HGCardPage>
    );
  };

  renderCorrectionCard = () => {
    const { corrections, correctionLoading, correctionPagination, pendingCorrection } = this.state;
    return (
      <HGCardPage title="资产修正双人复核" extra={<HGButtonPage loading={correctionLoading} onClick={() => this.fetchCorrections(1, correctionPagination.pageSize)}>刷新申请</HGButtonPage>}>
        <div className={styles.auditNotice}>修正申请先写入不可变审计记录，不会立即改动余额；必须由另一名同时具备审批与应用权限的操作人复核后才会应用。</div>
        {pendingCorrection && <div className={styles.pendingNotice}><span>最近修正</span><strong>{pendingCorrection.correctionId || "--"}</strong><span>状态</span><strong>{HGCoinOperationsVM.getCorrectionStatusLabel(pendingCorrection.status)}</strong></div>}
        <HGTablePage rowKey="key" columns={this.getCorrectionColumns()} dataSource={corrections} loading={correctionLoading} pagination={{ ...correctionPagination, showSizeChanger: true }} onChange={this.handleCorrectionTableChange} scroll={{ y: 360 }} />
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
    const riskCopy = modal === "correct"
      ? "提交后只创建不可变修正申请，不会立即修改余额；必须由另一名具备审批与应用权限的操作人复核。"
      : "该操作将写入 MySQL 不可变资产流水与 Outbox。不要刷新 requestId 后重复提交同一业务。";
    return (
      <HGModalPage visible title={title} size="large" closable={!submitting} onClose={this.closeMutation} footer={<><HGButtonPage disabled={submitting} onClick={this.closeMutation}>取消</HGButtonPage><HGButtonPage type="primary" danger={modal === "correct"} loading={submitting} onClick={this.submitMutation}>确认提交</HGButtonPage></>}>
        <div className={styles.riskNotice}>{riskCopy}</div>
        <div className={styles.formGrid}>
          <label>目标用户<HGInputPage value={form.userId || ""} disabled /></label>
          <label>Request ID<HGInputPage value={form.requestId || ""} disabled /></label>
          {modal === "correct" ? <label>修正值（-1000 至 1000）<HGInputNumberPage value={form.delta} min={-1000} max={1000} step={1} onChange={(value) => this.changeForm("delta", value)} /></label> : <label>数量（1 至 1000）<HGInputNumberPage value={form.amount} min={1} max={1000} step={1} onChange={(value) => this.changeForm("amount", value)} /></label>}
          {modal === "grant" && <label>活动/工单编号<HGInputPage value={form.businessKey || ""} maxLength={255} onChange={(event) => this.changeForm("businessKey", event.target.value)} /></label>}
          {modal === "refund" && <label>原扣款流水 ID<HGInputPage value={form.referenceTransactionId || ""} onChange={(event) => this.changeForm("referenceTransactionId", event.target.value)} /></label>}
          {modal === "correct" && <label>Ticket ID<HGInputPage value={form.ticketId || ""} maxLength={128} onChange={(event) => this.changeForm("ticketId", event.target.value)} /></label>}
          {modal === "correct" && <label>Work Order ID<HGInputPage value={form.workOrderId || ""} maxLength={128} onChange={(event) => this.changeForm("workOrderId", event.target.value)} /></label>}
          <label className={styles.fullField}>审计原因<HGInputTextArea value={form.reason || ""} rows={4} maxLength={200} placeholder="填写工单、活动或已确认漂移原因" onChange={(event) => this.changeForm("reason", event.target.value)} /></label>
        </div>
      </HGModalPage>
    );
  };

  render() {
    const { account, transactions, transactionLoading, pagination, pipeline, permissionsLoading, permissionsError } = this.state;
    const kafkaRows = HGCoinOperationsVM.toKafkaRows(pipeline?.kafka?.items || []);
    return (
      <div className={styles.container}>
        <div className={styles.hero}><div><span>CONTROL PLANE / COIN ASSET</span><h2>硬币资产与异步链路</h2><p>资产变更保留不可变审计；高风险修正采用申请与审批分离的双人复核。</p></div><div className={styles.heroMark}>COIN<br />OPS</div></div>
        {permissionsLoading && <div className={styles.permissionBanner}>正在加载当前操作人的资产权限...</div>}
        {permissionsError && <div className={styles.permissionError}>资产权限加载失败，受保护操作已隐藏：{permissionsError} <HGButtonPage type="link" onClick={this.fetchAssetPermissions}>重试</HGButtonPage></div>}
        {!permissionsLoading && this.canSelectTargetUser() && this.renderAccountCard()}
        {!permissionsLoading && this.hasPermission(HG_ASSET_PERMISSIONS.TRANSACTION_READ) && <HGCardPage title="不可变资产流水"><HGTablePage rowKey="key" columns={this.getTransactionColumns()} dataSource={transactions} loading={transactionLoading} pagination={account ? { ...pagination, showSizeChanger: true } : false} onChange={this.handleTableChange} scroll={{ y: 400 }} /></HGCardPage>}
        {!permissionsLoading && this.hasPermission(HG_ASSET_PERMISSIONS.CORRECTION_REQUEST) && this.renderCorrectionCard()}
        {!permissionsLoading && this.hasPermission(HG_ASSET_PERMISSIONS.PIPELINE_READ) && this.renderPipelineCards()}
        {!permissionsLoading && this.hasPermission(HG_ASSET_PERMISSIONS.PIPELINE_READ) && <HGCardPage title="Kafka Consumer Lag"><HGTablePage rowKey="key" columns={this.getKafkaColumns()} dataSource={kafkaRows} pagination={false} scroll={{ y: 320 }} /></HGCardPage>}
        {this.renderMutationModal()}
      </div>
    );
  }
}

export default HGCoinOperationsPage;
