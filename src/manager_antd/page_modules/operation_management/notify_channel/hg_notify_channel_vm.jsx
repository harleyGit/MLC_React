/*
 * @Description: 通知渠道中心 ViewModel。集中处理渠道/Provider/投递任务的接口契约、格式化与示例数据装配。
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
import { hgNormalizeSendTemplate, hgSendableTemplate } from "./hg_notify_send_contract.js";
import {
  CHANNEL_PRIORITY_OPTIONS,
  HG_DEMO_CHANNELS,
  HG_DEMO_DELIVERIES,
  HG_DEMO_PROVIDERS,
  HG_DEMO_TEMPLATES,
  RETRY_LADDER,
} from "./hg_notify_channel_fixtures.js";

/**
 * 数据源开关。
 * local：使用示例数据评审 UI，所有配置变更只影响本地 state；
 * remote：读取 /admin/v1/notification 下的真实渠道与投递数据。
 */
export const CHANNEL_DATA_SOURCE = "remote";

export { RETRY_LADDER, CHANNEL_PRIORITY_OPTIONS };

/** 当前仅支持显式用户；其它范围不可通过本页面请求。 */
export const AUDIENCE_TYPE_OPTIONS = [
  { value: "user_ids", label: "指定用户（逗号分隔 ID）" },
];

/** 当前后端仅支持即时任务。 */
export const SCHEDULE_TYPE_OPTIONS = [
  { value: "immediate", label: "立即发送" },
];

/** 模板分类中文标签（技术文档 3.1 模板类型）。 */
export const TEMPLATE_CATEGORY_LABELS = {
  system: "系统通知",
  marketing: "营销通知",
  security: "安全通知",
  transaction: "交易通知",
  interaction: "互动消息",
  merchant: "商家通知",
  operation: "活动通知",
  creator: "创作者通知",
};

/** 投递状态中文标签，避免各处重复硬编码。 */
export const DELIVERY_STATUS_LABELS = {
  pending: "待投递",
  sent: "已发送",
  retrying: "重试中",
  failed: "永久失败",
  dead_letter: "死信",
};

/** 通知渠道中心 ViewModel：接口、格式化与示例数据。 */
export default class HGNotifyChannelVM {
  static isRemote = () => CHANNEL_DATA_SOURCE === "remote";

  /* ===== 接口契约（与运维后台 /admin/v1 对齐） ===== */

  static fetchChannels = () => HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_CHANNELS);

  static fetchDeliveries = ({ cursor = "", pageSize = 20 } = {}) =>
    HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_DELIVERIES, { cursor, pageSize });

  /** 仅站内信支持向当前管理员本人试发送；不向短信/邮件/推送发出请求。 */
  static testSend = (code) => HGNet.post(HGMANAGER_API.ADMIN_NOTIFY_TEST_SEND, { code });

  /** 渠道配置变更：启用开关、优先级、限流与密钥引用。密钥值不落到本页面的任何请求体。 */
  static updateChannel = ({ code, enabled, config }) =>
    HGNet.post(HGMANAGER_API.ADMIN_NOTIFY_CHANNEL_UPDATE, { code, enabled, config });

  /** 一次只读 20 条，保持服务端倒序主键游标以便按需加载更多。 */
  static fetchTemplates = async (path = HGMANAGER_API.ADMIN_NOTIFY_TEMPLATE_LIST, cursor = "") => {
    const page = await HGNet.get(path, cursor ? { cursor } : {});
    if (!Array.isArray(page?.list) || page.list.length > 20 || (page.nextCursor && (
      page.nextCursor === cursor || page.list.length === 0))) throw new Error("模板列表响应格式错误");
    return { list: page.list.map(hgNormalizeSendTemplate), nextCursor: page.nextCursor || "" };
  };

  static fetchPublishedTemplates = (cursor = "") =>
    HGNotifyChannelVM.fetchTemplates(HGMANAGER_API.ADMIN_NOTIFY_TEMPLATE_PUBLISHED, cursor);

  /** 复核必须由非创建者执行；发布状态以服务端版本锁和权限校验为准。 */
  static publishTemplate = (id, version) =>
    HGNet.post(`${HGMANAGER_API.ADMIN_NOTIFY_TEMPLATE_PUBLISH_SEND}?id=${encodeURIComponent(id)}`, { version }, { _hasRetried: true });

  /**
   * 创建发送任务（技术文档 5.4 POST /admin/send-tasks）。
   * requestId 同时放入 Idempotency-Key 请求头，后端以 request_id + request_hash 做幂等冲突判定。
   * 注意：pending 只表示任务已创建，不代表通知已送达。
   */
  static createSendTask = ({ requestId, ...payload }) =>
    HGNet.post(HGMANAGER_API.ADMIN_NOTIFY_SEND_TASK, payload, {
      headers: { "Idempotency-Key": requestId }, _hasRetried: true,
    }).then((result) => {
      if (!/^[1-9]\d*$/.test(result?.taskId) || !["pending", "leased", "done", "failed", "cancelled"].includes(result?.status))
        throw new Error("发送任务响应格式错误，请保持原请求并查询或重试");
      return result;
    });

  static taskDetail = (id) => HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_SEND_TASK_DETAIL, { id });

  static taskPage = (cursor = "") =>
    HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_SEND_TASK, cursor ? { cursor } : {});

  static cancelTask = (id) =>
    HGNet.post(`${HGMANAGER_API.ADMIN_NOTIFY_SEND_TASK_CANCEL}?id=${encodeURIComponent(id)}`, {}, { _hasRetried: true });

  static reviewPage = (cursor = "") =>
    HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_SEND_REVIEW, cursor ? { cursor } : {});

  static reviewDetail = (id) => HGNet.get(HGMANAGER_API.ADMIN_NOTIFY_SEND_REVIEW_DETAIL, { id });

  static approveTask = (id) =>
    HGNet.post(`${HGMANAGER_API.ADMIN_NOTIFY_SEND_APPROVE}?id=${encodeURIComponent(id)}`, {}, { _hasRetried: true });

  static isSendable = hgSendableTemplate;

  /* ===== 格式化 ===== */

  /** 千分位整数，异常值回落 0。 */
  static formatNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("zh-CN") : "0";
  };

  /** 百分比展示，保留两位小数。 */
  static formatPercent = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2)}%` : "--";
  };

  /** 按成功率返回语义色调，取值限定在 HGStatCard 支持的色板内。 */
  static getHealthTone = (successRate) => {
    if (successRate >= 99.5) return "green";
    if (successRate >= 98) return "orange";
    return "gray";
  };

  /** Provider / 投递表行状态标签。 */
  static getDeliveryStatusLabel = (status) => DELIVERY_STATUS_LABELS[status] || status;

  /** 下次重试时间；无值（已进死信或永久失败）返回占位。 */
  static formatNextRetry = (iso) => {
    if (!iso) return "--";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  /** 按渠道 code 取渠道定义。 */
  static getChannelMeta = (code) => HG_DEMO_CHANNELS.find((item) => item.code === code) || null;

  /**
   * 受限变量渲染（技术文档 6.1）：仅替换 {{name}} 形式的白名单变量，
   * 不支持函数、循环或表达式；未填写的变量保留原占位符，由调用方决定展示与拦截。
   */
  static renderTemplate = (template, variables = {}) => {
    const replace = (text) =>
      String(text || "").replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (raw, name) => {
        const value = variables[name];
        if (value === undefined || value === null || String(value).trim() === "") return raw;
        return String(value).trim();
      });
    return { title: replace(template.titleTemplate), content: replace(template.bodyTemplate) };
  };

  /** 拆分用户 ID 输入：兼容中英文逗号、分号与空白分隔，去重后返回字符串数组。 */
  static parseUserIds = (input) => {
    const list = String(input || "")
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  };

  /** local 模式模板查询：返回示例模板的深拷贝快照，字段结构与远端接口保持一致。 */
  static buildDemoTemplates = () =>
    HG_DEMO_TEMPLATES.map((item) => ({
      ...item,
      channels: [...item.channels],
      variablesSchema: Object.fromEntries(
        Object.entries(item.variablesSchema).map(([name, rule]) => [name, { ...rule }]),
      ),
    }));

  /** local 模式模拟创建任务返回：taskId 即时生成，接收人数按 audience 类型推导，仅用于评审 UI。 */
  static buildSendDemoResult = (payload) => {
    return { taskId: `task_demo_${Date.now()}`, status: "pending", estimatedRecipients: (payload?.userIds || []).length };
  };


  /** 汇总指标：总投递量、加权成功率、重试中的任务数与死信数。 */
  static summarize = (channels, deliveries) => {
    const totalSent = channels.reduce((sum, item) => sum + Number(item.dailySent || 0), 0);
    const totalAttempt = channels.reduce(
      (sum, item) => sum + Number(item.dailySent || 0) * (Number(item.successRate || 0) / 100),
      0
    );
    const successRate = totalSent > 0 ? (totalAttempt / totalSent) * 100 : 0;
    return {
      totalSent,
      successRate,
      retrying: deliveries.filter((item) => item.status === "retrying").length,
      deadLetter: deliveries.filter((item) => item.status === "dead_letter").length,
    };
  };

  /** 装配本地示例态：渠道、Provider、失败投递与统计一次返回。 */
  static buildDemoState = () => {
    const channels = HG_DEMO_CHANNELS.map((item) => ({ ...item, config: { ...item.config } }));
    const deliveries = HG_DEMO_DELIVERIES.map((item) => ({ ...item }));
    return {
      channels,
      providers: HG_DEMO_PROVIDERS.map((item) => ({ ...item })),
      deliveries,
      summary: HGNotifyChannelVM.summarize(channels, deliveries),
    };
  };
}
