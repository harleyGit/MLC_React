/*
 * @Description: 通知渠道中心 ViewModel。集中处理渠道/Provider/投递任务的接口契约、格式化与示例数据装配。
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
import {
  CHANNEL_PRIORITY_OPTIONS,
  HG_DEMO_CHANNELS,
  HG_DEMO_DELIVERIES,
  HG_DEMO_PROVIDERS,
  RETRY_LADDER,
} from "./hg_notify_channel_fixtures.js";

/**
 * 数据源开关。
 * local：使用示例数据评审 UI，所有配置变更只影响本地 state；
 * remote：读取 /admin/v1/notification 下的真实渠道与投递数据。
 */
export const CHANNEL_DATA_SOURCE = "remote";

export { RETRY_LADDER, CHANNEL_PRIORITY_OPTIONS };

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
