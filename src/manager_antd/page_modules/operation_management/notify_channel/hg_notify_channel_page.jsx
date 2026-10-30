/*
 * @Description: 通知渠道中心运维页面。统一管理站内信/短信/邮件/Push/WebSocket 五个渠道、
 *               Provider 适配器、失败重试队列与死信任务。
 */
import React from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGIconPage from "../../../../components/hg_icon/hg_icon_page";
import HGInputNumberPage from "../../../../components/hg_input_number/hg_input_number_page";
import HGInputPage, { HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGNotifyChannelVM, {
  CHANNEL_PRIORITY_OPTIONS,
  CHANNEL_DATA_SOURCE,
  RETRY_LADDER,
} from "./hg_notify_channel_vm";
import styles from "./hg_notify_channel.module.css";

/** 渠道 code 到公共图标类型的映射，避免为该页面扩展公共图标表。 */
const CHANNEL_ICON_MAP = {
  in_app: "file",
  sms: "mobile",
  email: "mail",
  push: "dashboard",
  realtime: "tree",
};

/** Provider 状态到语义标签的映射。 */
const PROVIDER_STATUS_MAP = {
  healthy: { tone: "success", label: "正常" },
  standby: { tone: "neutral", label: "备用" },
  warning: { tone: "warning", label: "降级" },
  error: { tone: "error", label: "异常" },
};

/** 投递状态样式类映射。 */
const DELIVERY_STATUS_CLASS_MAP = {
  pending: "statusPending",
  sent: "statusSent",
  retrying: "statusRetrying",
  failed: "statusFailed",
  dead_letter: "statusDeadLetter",
};

/**
 * 通知渠道中心页面组件。
 * 职责：展示渠道健康与投递链路，提供渠道启用/停用、配置编辑与试发送入口。
 * 约束：
 * - 密钥只展示环境变量名，页面不允许读取或回填密钥值；
 * - 渠道开关与配置仅做前端可见性控制，最终权限由后端 RBAC 判定；
 * - dataSource 为 local 时不发起请求，所有变更只更新本地 state。
 */
class HGNotifyChannelPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      refreshing: false,
      channels: [],
      providers: [],
      deliveries: [],
      summary: { totalSent: 0, successRate: 0, retrying: 0, deadLetter: 0 },
      togglingCode: "",
      configCode: "",
      form: null,
      saving: false,
    };
  }

  componentDidMount() {
    if (HGNotifyChannelVM.isRemote()) {
      this.loadRemoteData();
      return;
    }
    this.setState({ ...HGNotifyChannelVM.buildDemoState(), loading: false });
  }

  /** remote 模式并行加载渠道与异常投递列表。 */
  loadRemoteData = () => {
    this.setState({ loading: true });
    Promise.all([HGNotifyChannelVM.fetchChannels(), HGNotifyChannelVM.fetchDeliveries()])
      .then(([channelResult, deliveryResult]) => {
        const channels = (channelResult?.channels || channelResult?.list || []).map((item) => ({
          ...item,
          config: item.config || {},
        }));
        const providers = channelResult?.providers || [];
        const deliveries = deliveryResult?.list || deliveryResult?.deliveries || [];
        this.setState({
          channels,
          providers,
          deliveries,
          summary: HGNotifyChannelVM.summarize(channels, deliveries),
          loading: false,
        });
      })
      .catch((error) => {
        this.setState({ loading: false });
        message.error(error?.message || "通知渠道数据加载失败");
      });
  };

  /** 刷新：local 模式提示数据来源，remote 模式重新拉取。 */
  handleRefresh = () => {
    if (!HGNotifyChannelVM.isRemote()) {
      message.info("当前展示本地示例数据，接入 /admin/v1/notification 接口后刷新会读取真实链路");
      return;
    }
    this.setState({ refreshing: true });
    Promise.all([HGNotifyChannelVM.fetchChannels(), HGNotifyChannelVM.fetchDeliveries()])
      .then(([channelResult, deliveryResult]) => {
        const channels = (channelResult?.channels || channelResult?.list || []).map((item) => ({
          ...item,
          config: item.config || {},
        }));
        const deliveries = deliveryResult?.list || deliveryResult?.deliveries || [];
        this.setState({
          channels,
          providers: channelResult?.providers || [],
          deliveries,
          summary: HGNotifyChannelVM.summarize(channels, deliveries),
          refreshing: false,
        });
      })
      .catch((error) => {
        this.setState({ refreshing: false });
        message.error(error?.message || "刷新失败");
      });
  };

  /** 渠道启用/停用：安全类通知禁止整体关闭，后端会再次拦截。 */
  handleToggleChannel = (channel) => {
    const nextEnabled = !channel.enabled;
    this.setState(
      (state) => ({
        channels: state.channels.map((item) => (item.code === channel.code ? { ...item, enabled: nextEnabled } : item)),
      }),
      () => {
        if (!HGNotifyChannelVM.isRemote()) {
          message.success(`${channel.name}已${nextEnabled ? "启用" : "停用"}（示例数据，未同步服务端）`);
          return;
        }
        this.setState({ togglingCode: channel.code });
        HGNotifyChannelVM.updateChannel({ code: channel.code, enabled: nextEnabled, config: channel.config })
          .then(() => message.success(`${channel.name}已${nextEnabled ? "启用" : "停用"}`))
          .catch((error) => {
            // 失败回滚本地开关，避免界面与实际投递行为不一致。
            this.setState((state) => ({
              channels: state.channels.map((item) => (item.code === channel.code ? { ...item, enabled: !nextEnabled } : item)),
            }));
            message.error(error?.message || "渠道状态更新失败");
          })
          .finally(() => this.setState({ togglingCode: "" }));
      }
    );
  };

  /** 打开渠道配置弹窗，表单取自当前渠道快照。 */
  openConfig = (channel) => {
    this.setState({ configCode: channel.code, form: { ...channel.config } });
  };

  /** 关闭弹窗。 */
  closeConfig = () => {
    if (!this.state.saving) this.setState({ configCode: "", form: null });
  };

  /** 配置表单字段变更。 */
  changeForm = (field, value) => {
    this.setState((state) => ({ form: { ...state.form, [field]: value } }));
  };

  /** 保存渠道配置；DailyQuota 为 0 表示不限制。 */
  saveConfig = () => {
    const { configCode, form } = this.state;
    const channel = this.state.channels.find((item) => item.code === configCode);
    if (!channel || !form) return;
    if (Number(form.rateLimitQps) <= 0) {
      message.error("限流 QPS 必须大于 0");
      return;
    }
    if (!HGNotifyChannelVM.isRemote()) {
      this.setState(
        (state) => ({
          channels: state.channels.map((item) => (item.code === configCode ? { ...item, config: { ...form } } : item)),
          configCode: "",
          form: null,
        }),
        () => message.success(`${channel.name}配置已保存到本地（示例数据）`)
      );
      return;
    }
    this.setState({ saving: true });
    HGNotifyChannelVM.updateChannel({ code: configCode, enabled: channel.enabled, config: form })
      .then(() => {
        this.setState(
          (state) => ({
            channels: state.channels.map((item) => (item.code === configCode ? { ...item, config: { ...form } } : item)),
            configCode: "",
            form: null,
            saving: false,
          }),
          () => message.success(`${channel.name}配置已更新，下一批投递立即生效`)
        );
      })
      .catch((error) => {
        this.setState({ saving: false });
        message.error(error?.message || "渠道配置保存失败");
      });
  };

  /** 试发送：提示将向当前运营账号发出一条测试投递。 */
  handleTestSend = (channel) => {
    if (!channel.enabled) {
      message.warning(`${channel.name}当前处于停用状态，请先启用`);
      return;
    }
    message.info(`${channel.name}试发送已提交（示例数据）：将向当前运营账号发送一条测试投递`);
  };

  /* ================= 渲染 ================= */

  /** 顶部 hero：模块说明与数据来源标记。 */
  renderHero = () => (
    <div className={styles.hero}>
      <div className={styles.heroMain}>
        <span className={styles.heroTag}>NOTIFICATION / CHANNEL CENTER</span>
        <h2 className={styles.heroTitle}>通知渠道中心</h2>
        <p className={styles.heroDesc}>
          事件与模板解耦后，由渠道中心决定“发给谁、走哪个渠道、失败如何退避”。渠道 Provider 采用策略模式，
          主备供应商可切换，密钥统一由环境变量或密钥服务管理。
        </p>
      </div>
      <div className={styles.heroSide}>
        <span className={styles.heroSource}>{HGNotifyChannelVM.isRemote() ? "实时数据" : "示例数据"}</span>
        <HGButtonPage onClick={this.handleRefresh} loading={this.state.refreshing}>
          刷新链路
        </HGButtonPage>
      </div>
    </div>
  );

  /** KPI 指标卡：总量、成功率、重试队列与死信。 */
  renderSummary = () => {
    const { summary } = this.state;
    const serviceLevel = summary.successRate >= 99.5 ? "达标" : summary.successRate >= 98 ? "预警" : "劣化";
    return (
      <HGStatCardPage
        items={[
          {
            label: "今日投递总量",
            value: HGNotifyChannelVM.formatNumber(summary.totalSent),
            tone: "blue",
            icon: <HGIconPage type="upload" />,
          },
          {
            label: "整体成功率",
            value: HGNotifyChannelVM.formatPercent(summary.successRate),
            suffix: serviceLevel,
            tone: HGNotifyChannelVM.getHealthTone(summary.successRate),
            icon: <HGIconPage type="dashboard" />,
          },
          {
            label: "重试队列",
            value: HGNotifyChannelVM.formatNumber(summary.retrying),
            tone: "orange",
            icon: <HGIconPage type="loading" />,
          },
          {
            label: "死信待处理",
            value: HGNotifyChannelVM.formatNumber(summary.deadLetter),
            tone: "purple",
            icon: <HGIconPage type="shield" />,
          },
        ]}
        columns={4}
      />
    );
  };

  /** 单个渠道卡片：图标、状态、Provider 列表、今日指标与操作。 */
  renderChannelCard = (channel) => {
    const toneClass = styles[`tone${channel.tone?.charAt(0).toUpperCase()}${channel.tone?.slice(1)}`] || styles.toneBlue;
    const healthTone = HGNotifyChannelVM.getHealthTone(channel.successRate);

    return (
      <div className={styles.channelCard} key={channel.code}>
        <div className={styles.channelHead}>
          <span className={`${styles.channelIcon} ${toneClass}`}>
            <HGIconPage type={CHANNEL_ICON_MAP[channel.code] || "config"} />
          </span>
          <div className={styles.channelTitle}>
            <div className={styles.channelNameRow}>
              <strong>{channel.name}</strong>
              <span className={styles.channelCode}>{channel.code}</span>
            </div>
            <span className={channel.enabled ? styles.channelOn : styles.channelOff}>
              {channel.enabled ? "已启用" : "已停用"}
            </span>
          </div>
          <HGButtonPage
            size="small"
            danger={channel.enabled}
            loading={this.state.togglingCode === channel.code}
            onClick={() => this.handleToggleChannel(channel)}
          >
            {channel.enabled ? "停用" : "启用"}
          </HGButtonPage>
        </div>

        <p className={styles.channelDesc}>{channel.desc}</p>

        <div className={styles.providerChips}>
          {channel.providers.map((provider) => (
            <span className={styles.providerChip} key={provider}>
              {provider}
            </span>
          ))}
        </div>

        <div className={styles.channelMetrics}>
          <div>
            <span>{channel.primaryMetricLabel}</span>
            <strong>{HGNotifyChannelVM.formatNumber(channel.dailySent)}</strong>
          </div>
          <div>
            <span>成功率</span>
            <strong className={styles[`health${healthTone.charAt(0).toUpperCase()}${healthTone.slice(1)}`]}>
              {HGNotifyChannelVM.formatPercent(channel.successRate)}
            </strong>
          </div>
          <div>
            <span>P95 延迟</span>
            <strong>{channel.p95}</strong>
          </div>
        </div>

        <div className={styles.channelActions}>
          <HGButtonPage size="small" type="primary" onClick={() => this.openConfig(channel)}>
            渠道配置
          </HGButtonPage>
          <HGButtonPage size="small" onClick={() => this.handleTestSend(channel)}>
            试发送
          </HGButtonPage>
        </div>
      </div>
    );
  };

  /** 渠道卡片网格。 */
  renderChannelSection = () => (
    <HGCardPage title="渠道总览" extra={<span className={styles.cardExtraText}>同一事件可落到多个渠道，由通知规则决定组合方式</span>}>
      {this.state.loading ? (
        <p className={styles.loadingText}>正在加载渠道数据...</p>
      ) : (
        <div className={styles.channelGrid}>{this.state.channels.map((channel) => this.renderChannelCard(channel))}</div>
      )}
    </HGCardPage>
  );

  /** Provider 适配器表格。 */
  renderProviderSection = () => {
    const columns = [
      { title: "Provider", dataIndex: "provider", width: 170 },
      { title: "渠道", dataIndex: "channel", width: 110 },
      { title: "角色", dataIndex: "role", width: 80, render: (role) => <span className={role === "主" ? styles.rolePrimary : styles.roleStandby}>{role}</span> },
      { title: "区域", dataIndex: "region", width: 100 },
      { title: "今日量", dataIndex: "todayCount", width: 110, render: HGNotifyChannelVM.formatNumber },
      { title: "成功率", dataIndex: "successRate", width: 100, render: HGNotifyChannelVM.formatPercent },
      {
        title: "状态",
        dataIndex: "status",
        width: 100,
        render: (status) => {
          const meta = PROVIDER_STATUS_MAP[status] || PROVIDER_STATUS_MAP.standby;
          return <span className={`${styles.statusPill} ${styles[`pill${meta.tone.charAt(0).toUpperCase()}${meta.tone.slice(1)}`]}`}>{meta.label}</span>;
        },
      },
      { title: "最近错误", dataIndex: "lastError", width: 240 },
      { title: "观测时间", dataIndex: "updatedAt", width: 120, render: (value) => value || "--" },
    ];
    return (
      <HGCardPage title="Provider 适配器" extra={<span className={styles.cardExtraText}>主备切换与降级由Adapter 内部完成，业务服务无感知</span>}>
        <HGTablePage rowKey="id" columns={columns} dataSource={this.state.providers} loading={this.state.loading} pagination={false} scroll={{ y: 320 }} />
      </HGCardPage>
    );
  };

  /** 失败重试与死信任务表格。 */
  renderDeliverySection = () => {
    const columns = [
      { title: "投递 ID", dataIndex: "deliveryId", width: 180 },
      { title: "来源事件", dataIndex: "eventId", width: 190 },
      { title: "渠道 / 模板", dataIndex: "channel", width: 170, render: (value, record) => `${value} · ${record.templateCode} v${record.templateVersion}` },
      { title: "接收人", dataIndex: "receiverId", width: 120 },
      { title: "重试", dataIndex: "retryCount", width: 80 },
      {
        title: "状态",
        dataIndex: "status",
        width: 110,
        render: (status) => (
          <span className={`${styles.statusPill} ${styles[DELIVERY_STATUS_CLASS_MAP[status] || "statusPending"]}`}>
            {HGNotifyChannelVM.getDeliveryStatusLabel(status)}
          </span>
        ),
      },
      { title: "下次重试", dataIndex: "nextRetryAt", width: 110, render: HGNotifyChannelVM.formatNextRetry },
      { title: "最后一次错误", dataIndex: "lastError", width: 300 },
    ];
    return (
      <HGCardPage title="失败重试与死信" extra={<span className={styles.cardExtraText}>超过退避上限的任务进入死信，需要人工确认后重放</span>}>
        <HGTablePage rowKey="deliveryId" columns={columns} dataSource={this.state.deliveries} loading={this.state.loading} pagination={false} scroll={{ y: 300 }} />
      </HGCardPage>
    );
  };

  /** 重试策略说明卡：指数退避 + 抖动 + 幂等约束。 */
  renderRetrySection = () => (
    <HGCardPage title="重试策略">
      <div className={styles.retryGrid}>
        <div>
          <h4>退避阶梯</h4>
          <div className={styles.retryLadder}>
            {RETRY_LADDER.map((step, index) => (
              <span key={step}>
                <i>{index + 1}</i>
                {step}
              </span>
            ))}
          </div>
          <p>超过上限后进入死信队列，等待人工处理或 Kafka 重放。</p>
        </div>
        <div>
          <h4>抖动与幂等</h4>
          <ul className={styles.retryList}>
            <li>每次重试叠加随机抖动，避免供应商恢复后被重试洪峰再次打垮。</li>
            <li>超时不等于失败：优先使用供应商幂等键或状态查询，禁止盲目重发短信。</li>
            <li>(eventId, receiverId, channel) 唯一约束保证同一事件不会重复投递。</li>
          </ul>
        </div>
        <div>
          <h4>职责边界</h4>
          <ul className={styles.retryList}>
            <li>业务服务只产出事件，不直接调用短信或推送接口。</li>
            <li>通知服务负责模板渲染、渠道选择与失败重试。</li>
            <li>IM 与运营群发的发送路径隔离，避免营销绕过私信权限。</li>
          </ul>
        </div>
      </div>
    </HGCardPage>
  );

  /** 渠道配置弹窗：限流、优先级、密钥引用与备注。 */
  renderConfigModal = () => {
    const { configCode, form, saving } = this.state;
    if (!configCode || !form) return null;
    const channel = this.state.channels.find((item) => item.code === configCode);
    if (!channel) return null;

    return (
      <HGModalPage
        visible
        title={`渠道配置 · ${channel.name}`}
        size="large"
        closable={!saving}
        onClose={this.closeConfig}
        footer={
          <>
            <HGButtonPage disabled={saving} onClick={this.closeConfig}>
              取消
            </HGButtonPage>
            <HGButtonPage type="primary" loading={saving} onClick={this.saveConfig}>
              保存配置
            </HGButtonPage>
          </>
        }
      >
        <div className={styles.noticeBar}>
          渠道开关与限流只调整投递行为；密钥值不会回填到页面，任何修改仍会经过后端 RBAC 鉴权。
        </div>
        <div className={styles.formGrid}>
          <label>
            投递优先级
            <HGSelectPage value={form.priority} options={CHANNEL_PRIORITY_OPTIONS} onChange={(value) => this.changeForm("priority", value)} />
          </label>
          <label>
            限流 QPS
            <HGInputNumberPage value={form.rateLimitQps} min={1} max={100000} step={10} onChange={(value) => this.changeForm("rateLimitQps", value)} />
          </label>
          <label>
            每日配额（0 表示不限）
            <HGInputNumberPage value={form.dailyQuota} min={0} max={10000000} step={1000} onChange={(value) => this.changeForm("dailyQuota", value)} />
          </label>
          <label>
            供应商模板 / 签名
            <HGInputPage value={form.signName || ""} maxLength={64} onChange={(event) => this.changeForm("signName", event.target.value)} />
          </label>
          <label className={styles.fullField}>
            密钥引用（环境变量名）
            <HGInputPage value={form.keyRef || ""} maxLength={128} onChange={(event) => this.changeForm("keyRef", event.target.value)} />
          </label>
          <label className={styles.fullField}>
            备注与合规约束
            <HGInputTextArea value={form.remark || ""} rows={4} maxLength={200} onChange={(event) => this.changeForm("remark", event.target.value)} />
          </label>
        </div>
        <p className={styles.formFooter}>
          当前数据源：{CHANNEL_DATA_SOURCE === "remote" ? "实时数据，保存后立即生效" : "示例数据，保存只更新本地表格"}
        </p>
      </HGModalPage>
    );
  };

  render() {
    return (
      <div className={styles.container}>
        {this.renderHero()}
        {this.renderSummary()}
        {this.renderChannelSection()}
        {this.renderProviderSection()}
        {this.renderDeliverySection()}
        {this.renderRetrySection()}
        {this.renderConfigModal()}
      </div>
    );
  }
}

export default HGNotifyChannelPage;
