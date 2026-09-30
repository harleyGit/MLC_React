import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import styles from "./hg_recharge_sku.module.css";
import HGRechargeSkuVM from "./hg_recharge_sku_vm";
import {
  HG_EMPTY_SKU_FORM,
  HG_RECHARGE_PERMISSIONS,
  hgBuildSkuRequest,
  hgFenToYuan,
  hgSkuToForm,
} from "./hg_recharge_sku_helpers.js";

const hgEmptyForm = () => ({ ...HG_EMPTY_SKU_FORM });

/** 价格充值档位管理页：只管理展示目录，不执行真实下单、支付或资金变更。 */
class HGRechargeSkuPage extends Component {
  state = {
    rows: [], loading: false, error: "", permissions: [], permissionsLoading: true,
    cursor: "", cursorHistory: [""], nextCursor: "", hasMore: false,
    formVisible: false, form: hgEmptyForm(), editingRecord: null, submitting: false,
    deleteRecord: null, deleting: false, mutationError: "", mutationBlocked: false, permissionError: "",
  };

  hgMounted = false;
  hgListRequestId = 0;
  // 同步锁覆盖 setState 尚未提交的同一事件循环，禁止重复写请求。
  hgWriting = false;

  componentDidMount() {
    this.hgMounted = true;
    this.fetchPermissions();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgListRequestId += 1;
  }

  hasPermission = (permission) => this.state.permissions.includes(permission);

  fetchPermissions = () => {
    this.setState({ permissionsLoading: true, permissionError: "" });
    HGRechargeSkuVM.fetchPermissions()
      .then((response) => {
        const permissions = Array.isArray(response?.permissions)
          ? response.permissions.filter((item) => typeof item === "string").map((item) => item.trim())
          : [];
        if (this.hgMounted) this.setState({ permissions }, () => {
          if (permissions.includes(HG_RECHARGE_PERMISSIONS.READ)) this.loadFirstPage();
        });
      })
      .catch((error) => {
        if (this.hgMounted) this.setState({ permissionError: HGRechargeSkuVM.errorMessage(error) });
      })
      .finally(() => {
        if (this.hgMounted) this.setState({ permissionsLoading: false });
      });
  };

  fetchList = (cursor = "", cursorHistory = [""]) => {
    const hgRequestId = ++this.hgListRequestId;
    this.setState({ loading: true, error: "", cursor, rows: [], hasMore: false });
    HGRechargeSkuVM.fetchList(cursor)
      .then((response) => {
        if (!this.hgMounted || hgRequestId !== this.hgListRequestId) return;
        this.setState({ rows: response.list, nextCursor: response.nextCursor, hasMore: response.hasMore, cursorHistory });
      })
      .catch((error) => {
        if (this.hgMounted && hgRequestId === this.hgListRequestId) this.setState({ error: HGRechargeSkuVM.errorMessage(error) });
      })
      .finally(() => {
        if (this.hgMounted && hgRequestId === this.hgListRequestId) this.setState({ loading: false });
      });
  };

  loadFirstPage = () => this.fetchList("", [""]);

  loadNextPage = () => {
    const { nextCursor, cursorHistory } = this.state;
    if (nextCursor) this.fetchList(nextCursor, [...cursorHistory, nextCursor]);
  };

  loadPreviousPage = () => {
    const { cursorHistory } = this.state;
    if (cursorHistory.length > 1) this.fetchList(cursorHistory[cursorHistory.length - 2], cursorHistory.slice(0, -1));
  };

  /** 每次打开重置错误，不自动重试此前未确认结果的创建请求。 */
  openCreate = (amountYuan = "") => this.setState({ formVisible: true, form: { ...hgEmptyForm(), amountYuan }, editingRecord: null, mutationError: "", mutationBlocked: false });

  openEdit = (record) => this.setState({ formVisible: true, form: hgSkuToForm(record), editingRecord: record, mutationError: "", mutationBlocked: false });

  closeForm = () => {
    if (!this.hgWriting) this.setState({ formVisible: false, form: hgEmptyForm(), editingRecord: null });
  };

  changeForm = (field, value) => this.setState((state) => ({ form: { ...state.form, [field]: value } }));

  submitForm = () => {
    const { form, editingRecord, submitting } = this.state;
    if (submitting || this.hgWriting || this.state.mutationBlocked || !this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE)) return;
    let body;
    try {
      body = hgBuildSkuRequest(form, editingRecord);
    } catch (error) {
      message.error(error.message);
      return;
    }
    this.hgWriting = true;
    this.setState({ submitting: true, mutationError: "" });
    HGRechargeSkuVM.save(body, Boolean(editingRecord))
      .then(() => {
        this.hgWriting = false;
        if (!this.hgMounted) return;
        message.success(editingRecord ? "充值档位更新成功" : "充值档位创建成功");
        this.setState({ formVisible: false, form: hgEmptyForm(), editingRecord: null, submitting: false });
        this.loadFirstPage();
      })
      .catch((error) => {
        this.hgWriting = false;
        if (this.hgMounted) {
          this.setState({ submitting: false, mutationBlocked: !editingRecord || HGRechargeSkuVM.isConflict(error), mutationError: `${HGRechargeSkuVM.errorMessage(error)}${!editingRecord ? " 创建结果请先关闭并刷新列表核对，勿重复创建。" : ""}` });
        }
      });
  };

  confirmDelete = () => {
    const { deleteRecord, deleting } = this.state;
    if (!deleteRecord || deleting || this.hgWriting || this.state.mutationBlocked || !this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE)) return;
    this.hgWriting = true;
    this.setState({ deleting: true });
    HGRechargeSkuVM.delete(deleteRecord)
      .then(() => {
        this.hgWriting = false;
        if (!this.hgMounted) return;
        message.success("充值档位已删除");
        this.setState({ deleteRecord: null, deleting: false });
        this.loadFirstPage();
      })
      .catch((error) => {
        this.hgWriting = false;
        if (this.hgMounted) {
          this.setState({ deleting: false, mutationBlocked: HGRechargeSkuVM.isConflict(error), mutationError: HGRechargeSkuVM.errorMessage(error) });
        }
      });
  };

  formatTime = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--";

  getColumns = () => [
    { title: "SKU code", dataIndex: "skuCode", width: 150 },
    { title: "标题", dataIndex: "title", width: 150 },
    { title: "金额（元）", dataIndex: "payAmount", width: 100, render: (value) => hgFenToYuan(value) },
    { title: "基础币", dataIndex: "coinAmount", width: 100 },
    { title: "赠币", dataIndex: "bonusCoin", width: 90 },
    { title: "总币", dataIndex: "totalCoin", width: 100 },
    { title: "状态", dataIndex: "status", width: 80, render: (value) => <span className={value === 1 ? styles.active : styles.disabled}>{value === 1 ? "启用" : "停用"}</span> },
    { title: "排序", dataIndex: "sortOrder", width: 70 },
    { title: "开始时间", dataIndex: "startTime", width: 175, render: this.formatTime },
    { title: "结束时间", dataIndex: "endTime", width: 175, render: this.formatTime },
    { title: "操作", dataIndex: "action", width: 140, render: (_, record) => (
      <span>
        {this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE) && <button type="button" className={styles.action} onClick={() => this.openEdit(record)}>编辑</button>}
        {this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE) && <button type="button" className={styles.dangerAction} onClick={() => this.setState({ deleteRecord: record, mutationError: "", mutationBlocked: false })}>删除</button>}
      </span>
    ) },
  ];

  renderForm = () => {
    const { form, editingRecord } = this.state;
    const hgField = (field, label, props = {}) => <label className={styles.field}>{label}<input disabled={this.state.submitting} value={form[field]} onChange={(event) => this.changeForm(field, event.target.value)} {...props} /></label>;
    return <div className={styles.form}>
      {hgField("skuCode", "SKU code", { maxLength: 64, placeholder: "例如 recharge_6" })}
      {hgField("title", "标题", { placeholder: "例如 6元档" })}
      {hgField("amountYuan", "支付金额（元）", { inputMode: "decimal", placeholder: "例如 6 或 6.00" })}
      {hgField("coinAmount", "基础币", { inputMode: "numeric", placeholder: "独立配置" })}
      {hgField("bonusCoin", "赠币", { inputMode: "numeric", placeholder: "可填 0" })}
      {hgField("sortOrder", "排序", { inputMode: "numeric" })}
      <label className={styles.field}>状态<select value={form.status} onChange={(event) => this.changeForm("status", event.target.value)}><option value="1">启用</option><option value="0">停用</option></select></label>
      {hgField("startTime", "开始时间（RFC3339，可选）", { placeholder: "创建留空使用服务端当前时间" })}
      {hgField("endTime", "结束时间（RFC3339，可选）", { placeholder: "留空表示无结束时间" })}
      {editingRecord && <p className={styles.versionTip}>编辑版本：{editingRecord.version}。冲突时不会自动覆盖，请刷新后重试。</p>}
    </div>;
  };

  /** 自定义底部使用原生 disabled，既有弹窗默认按钮不支持禁用。 */
  renderFooter = (deleting = false) => {
    const hgBusy = this.state.submitting || this.state.deleting;
    return <div className={styles.toolbar}>
      <button type="button" disabled={hgBusy} onClick={deleting ? () => this.setState({ deleteRecord: null }) : this.closeForm}>取消</button>
      <button type="button" disabled={hgBusy || this.state.mutationBlocked} onClick={deleting ? this.confirmDelete : this.submitForm}>{hgBusy ? "处理中..." : deleting ? "确认删除" : "保存"}</button>
    </div>;
  };

  render() {
    const { rows, loading, error, permissionsLoading, permissions, formVisible, submitting, deleteRecord, deleting, hasMore, cursorHistory, permissionError, mutationError } = this.state;
    if (permissionsLoading) return <div className={styles.state}>正在加载充值档位权限...</div>;
    if (permissionError) return <div role="alert" className={styles.error}>{permissionError}<HGButtonPage onClick={this.fetchPermissions}>重试权限加载</HGButtonPage></div>;
    if (!permissions.includes(HG_RECHARGE_PERMISSIONS.READ)) return <div className={styles.state}>当前账号没有 payment.recharge_sku.read 权限。</div>;
    return <div className={styles.container}>
      <HGCardPage title="价格充值档位" extra={<div className={styles.toolbar}><HGButtonPage onClick={this.loadFirstPage} loading={loading}>刷新</HGButtonPage>{this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE) && <><HGButtonPage type="primary" onClick={() => this.openCreate()}>新增档位</HGButtonPage><HGButtonPage type="primary" onClick={() => this.openCreate("6")}>新增 6 元</HGButtonPage><HGButtonPage type="primary" onClick={() => this.openCreate("18")}>新增 18 元</HGButtonPage><HGButtonPage type="primary" onClick={() => this.openCreate("68")}>新增 68 元</HGButtonPage><HGButtonPage type="primary" onClick={() => this.openCreate("233")}>新增 233 元</HGButtonPage></>}</div>}>
        <p className={styles.tip}>金额输入为元，提交时精确转换为分；基础币与赠币独立配置。该页面仅维护充值目录，不执行真实支付。</p>
        {error && <div className={styles.error}>{error}<HGButtonPage type="link" onClick={this.loadFirstPage}>重试</HGButtonPage></div>}
        {!error && !loading && rows.length === 0 && <div className={styles.empty}>暂无充值档位{this.hasPermission(HG_RECHARGE_PERMISSIONS.WRITE) ? "，可从上方快捷档位开始创建。" : "。"}</div>}
        <HGTablePage rowKey={(record) => String(record.skuId)} columns={this.getColumns()} dataSource={rows} loading={loading} pagination={false} scroll={{ y: 430 }} />
        <div className={styles.pager}><HGButtonPage disabled={cursorHistory.length <= 1 || loading} onClick={this.loadPreviousPage}>上一页</HGButtonPage><span>第 {cursorHistory.length} 页{hasMore ? "，还有更多" : ""}</span><HGButtonPage disabled={!hasMore || loading} onClick={this.loadNextPage}>下一页</HGButtonPage></div>
      </HGCardPage>
      <HGModalPage visible={formVisible} size="large" closable={!submitting} footer={this.renderFooter()} title={this.state.editingRecord ? "编辑充值档位" : "新增充值档位"} onClose={this.closeForm}>
        {mutationError && <p role="alert" className={styles.error}>{mutationError}</p>}
        {this.renderForm()}
      </HGModalPage>
      <HGModalPage visible={Boolean(deleteRecord)} closable={!deleting} footer={this.renderFooter(true)} title="确认删除充值档位" onClose={() => !this.hgWriting && this.setState({ deleteRecord: null })}>
        {mutationError && <p role="alert" className={styles.error}>{mutationError}</p>}
        <p>确定软删除“{deleteRecord?.title || deleteRecord?.skuCode}”吗？历史数据会保留。</p>
      </HGModalPage>
    </div>;
  }
}

export default HGRechargeSkuPage;
