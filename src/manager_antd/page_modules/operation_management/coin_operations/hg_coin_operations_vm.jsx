import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

export const HG_COIN_TRANSACTION_PAGE_SIZE = 20;
export const HG_COIN_MAX_MUTATION_AMOUNT = 1000;

/** 硬币资产运维 ViewModel，集中处理接口调用、游标分页、校验和低基数状态转换。 */
export default class HGCoinOperationsVM {
  static fetchAccount = (userId) =>
    HGNet.get(HGMANAGER_API.OPS_COIN_ACCOUNT_DETAIL, { userId: String(userId || "").trim() });

  static fetchTransactions = ({ userId, cursor = "", pageSize = HG_COIN_TRANSACTION_PAGE_SIZE }) =>
    HGNet.get(HGMANAGER_API.OPS_COIN_TRANSACTION_LIST, {
      userId: String(userId || "").trim(),
      cursor,
      pageSize,
    });

  static fetchPipelineStatus = () => HGNet.get(HGMANAGER_API.OPS_ASSET_PIPELINE_STATUS);

  static grantCoin = (form) => HGNet.post(HGMANAGER_API.OPS_COIN_GRANT, {
    userId: form.userId.trim(),
    requestId: form.requestId,
    amount: String(form.amount),
    reason: form.reason.trim(),
    businessKey: form.businessKey.trim(),
  });

  static refundCoin = (form) => HGNet.post(HGMANAGER_API.OPS_COIN_REFUND, {
    userId: form.userId.trim(),
    requestId: form.requestId,
    amount: String(form.amount),
    reason: form.reason.trim(),
    referenceTransactionId: form.referenceTransactionId.trim(),
  });

  static correctCoin = (form) => HGNet.post(HGMANAGER_API.OPS_COIN_CORRECT, {
    userId: form.userId.trim(),
    requestId: form.requestId,
    delta: String(form.delta),
    reason: form.reason.trim(),
  });

  /** requestId 在弹窗生命周期内保持稳定，网络失败后的重试不会产生第二笔资产命令。 */
  static createRequestId = (operation) => {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `ops-${operation}-${random}`;
  };

  static validateMutation = (operation, form) => {
    if (!String(form.userId || "").trim()) return "请先查询目标用户";
    if (!String(form.requestId || "").trim()) return "缺少幂等 requestId";
    if (!String(form.reason || "").trim()) return "必须填写可审计的操作原因或工单号";
    const value = Number(operation === "correct" ? form.delta : form.amount);
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > HG_COIN_MAX_MUTATION_AMOUNT)
      return `单次资产变更必须为 1 到 ${HG_COIN_MAX_MUTATION_AMOUNT} 的整数`;
    if (operation !== "correct" && value < 0) return "赠币或退款数量必须为正整数";
    if (operation === "grant" && !String(form.businessKey || "").trim()) return "赠币必须关联活动或工单编号";
    if (operation === "refund" && !/^\d+$/.test(String(form.referenceTransactionId || "").trim()))
      return "退款必须填写原扣款流水 ID";
    return "";
  };

  static getLagLevel = (lag) => {
    const value = Number(lag || 0);
    if (value >= 10000) return "critical";
    if (value >= 1000) return "warning";
    return "healthy";
  };

  static formatInteger = (value) => {
    const text = String(value ?? "0");
    return /^-?\d+$/.test(text) ? text.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : text;
  };

  static formatTime = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
  };

  static toTransactionRows = (list = []) => list.map((item) => ({
    ...item,
    key: item.transactionId,
    operationLabel: {
      initialize: "初始化", recharge: "充值", grant: "赠币", debit: "扣款", refund: "退款", expire: "过期", correction: "修正",
    }[item.operation] || item.operation,
  }));

  static toKafkaRows = (items = []) => items
    .map((item) => ({ ...item, key: `${item.group}:${item.topic}`, level: HGCoinOperationsVM.getLagLevel(item.lagRecords) }))
    .sort((left, right) => Number(right.lagRecords) - Number(left.lagRecords));
}
