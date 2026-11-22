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
  AUDIENCE_TYPE_OPTIONS,
  CHANNEL_DATA_SOURCE,
  CHANNEL_PRIORITY_OPTIONS,
  RETRY_LADDER,
  SCHEDULE_TYPE_OPTIONS,
  TEMPLATE_CATEGORY_LABELS,
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
      // ===== 发送通知任务（模板渲染 + 异步投递） =====
      templates: [], // 模板列表快照；空数组表示尚未点击“查询模板”，不自动加载（查询须按钮触发）。
      templatesLoading: false, // 模板查询请求进行中标记；true 时按钮显示 loading，防止重复请求。
      sendForm: {
        templateId: "", // 已选模板 ID；空字符串表示未选择，变量输入区不渲染。
        audienceType: "user_ids", // 发送范围类型：user_ids / role / all，与后端 audience.type 枚举对齐。
        userIdsText: "", // 指定用户模式的原始输入；兼容逗号/空白分隔，提交时解析去重。
        roleCode: "", // 角色用户模式的 IAM 角色编码；仅 audienceType 为 role 时使用。
        variables: {}, // 模板变量名到填写值的映射；切换模板时整体重置，避免跨模板串值。
        scheduleType: "immediate", // 发送时间类型：immediate 立即 / scheduled 定时。
        scheduledAt: "", // 定时发送的本地 datetime-local 字符串；空字符串表示未选择时间。
      },
      sending: false, // 发送任务提交中标记；true 时预览弹窗按钮 loading 且禁止关闭。
      previewOpen: false, // 发送预览弹窗开关；预览即二次确认入口，全站广播在此再次警示。
      lastTaskResult: "", // 最近一次任务创建结果文案；空字符串表示尚未提交过任务。
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
    if (HGNotifyChannelVM.isRemote()) {
      message.info("渠道启停尚未接入投递策略，不支持在此修改");
      return;
    }
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
    if (HGNotifyChannelVM.isRemote()) {
      message.info("渠道限流和配额未接入服务端，暂不开放配置");
      return;
    }
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
    if (HGNotifyChannelVM.isRemote()) {
      if (channel.code !== "in_app" || !channel.available) {
        message.warning("该渠道未接入，不会向供应商发送请求");
        return;
      }
      HGNotifyChannelVM.testSend(channel.code)
        .then(() => { message.success("站内试通知已写入当前管理员的消息中心"); this.handleRefresh(); })
        .catch((error) => message.error(error?.message || "站内通知试发送失败"));
      return;
    }
    if (!channel.enabled) {
      message.warning(`${channel.name}当前处于停用状态，请先启用`);
      return;
    }
    message.info(`${channel.name}试发送已提交（示例数据）：将向当前运营账号发送一条测试投递`);
  };

  /* ================= 发送通知任务 ================= */

  /** 查询模板列表：local 返回示例模板，remote 请求 /admin/templates；仅在按钮点击时执行。 */
  handleQueryTemplates = () => {
    if (this.state.templatesLoading) return;
    if (!HGNotifyChannelVM.isRemote()) {
      const templates = HGNotifyChannelVM.buildDemoTemplates();
      this.setState({ templates });
      message.success(`已加载 ${templates.length} 个示例模板（本地数据）`);
      return;
    }
    this.setState({ templatesLoading: true });
    HGNotifyChannelVM.fetchTemplates()
      .then((response) => {
        const rawList =
          response?.result?.list || response?.list || response?.result || (Array.isArray(response) ? response : []);
        const templates = (Array.isArray(rawList) ? rawList : []).map((item) => ({
          ...item,
          channels: Array.isArray(item.channels) ? item.channels : [],
          variablesSchema: item.variablesSchema || {},
        }));
        this.setState({ templates, templatesLoading: false });
        message.success(`已加载 ${templates.length} 个模板`);
      })
      .catch((error) => {
        this.setState({ templatesLoading: false });
        message.error(error?.message || "模板列表加载失败，请确认通知服务已部署模板接口");
      });
  };

  /** 选择模板：同时清空变量表并重置变量字段挂载，避免旧变量值残留到新模板。 */
  handleSelectTemplate = (templateId) => {
    this.setState((state) => ({
      sendForm: { ...state.sendForm, templateId, variables: {} },
    }));
  };

  /** 发送表单基础字段变更。 */
  changeSendForm = (field, value) => {
    this.setState((state) => ({ sendForm: { ...state.sendForm, [field]: value } }));
  };

  /** 模板变量字段变更：仅更新对应变量名，不影响其他已填变量。 */
  changeVariable = (name, value) => {
    this.setState((state) => ({
      sendForm: { ...state.sendForm, variables: { ...state.sendForm.variables, [name]: value } },
    }));
  };

  /** 当前选中的模板对象；未选择或列表中不存在时返回 null。 */
  getSelectedTemplate = () => {
    const { templates, sendForm } = this.state;
    return templates.find((item) => item.templateId === sendForm.templateId) || null;
  };

  /**
   * 提交前校验发送表单。
   * 返回首个错误文案；空字符串表示校验通过。规则与后端 variablesSchema 白名单保持一致。
   */
  validateSendForm = () => {
    const { sendForm } = this.state;
    const template = this.getSelectedTemplate();
    if (!template) return "请先选择通知模板";
    if (sendForm.audienceType === "user_ids") {
      const userIds = HGNotifyChannelVM.parseUserIds(sendForm.userIdsText);
      if (userIds.length === 0) return "请填写至少一个接收用户 ID";
      if (userIds.length > 500) return "单次任务最多 500 个用户 ID，更大范围请使用角色用户或全站公告";
    }
    if (sendForm.audienceType === "role" && !String(sendForm.roleCode).trim()) {
      return "请填写接收角色编码";
    }
    const schemaEntries = Object.entries(template.variablesSchema || {});
    for (const [name, rule] of schemaEntries) {
      const raw = sendForm.variables[name];
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      if (rule.required && !text) return `变量 ${name} 为必填项`;
      if (!text) continue;
      if (rule.type === "integer" && !/^\d+$/.test(text)) return `变量 ${name} 必须是整数`;
      if (rule.type === "integer" && Number(text) < Number(rule.minimum || 0)) {
        return `变量 ${name} 不能小于 ${rule.minimum}`;
      }
      if (rule.maxLength && text.length > rule.maxLength) {
        return `变量 ${name} 长度不能超过 ${rule.maxLength} 个字符`;
      }
    }
    if (sendForm.scheduleType === "scheduled") {
      if (!sendForm.scheduledAt) return "请选择定时发送时间";
      if (new Date(sendForm.scheduledAt).getTime() <= Date.now()) return "定时发送时间必须晚于当前时间";
    }
    return "";
  };

  /** 打开预览弹窗；校验失败仅提示，不产生任何请求。 */
  handlePreviewSend = () => {
    const error = this.validateSendForm();
    if (error) {
      message.warning(error);
      return;
    }
    this.setState({ previewOpen: true });
  };

  /** 关闭预览弹窗；提交中禁止关闭，避免任务创建状态与界面不一致。 */
  closePreview = () => {
    if (!this.state.sending) this.setState({ previewOpen: false });
  };

  /**
   * 组装发送任务请求体（技术文档 5.4）。
   * variables 按 schema 类型转换；audience 仅携带当前范围类型的字段，避免提交无关数据。
   */
  buildSendPayload = () => {
    const { sendForm } = this.state;
    const template = this.getSelectedTemplate();
    const variables = {};
    Object.entries(template.variablesSchema || {}).forEach(([name, rule]) => {
      const raw = sendForm.variables[name];
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      if (!text) return;
      variables[name] = rule.type === "integer" ? Number(text) : text;
    });
    const audience = { type: sendForm.audienceType };
    if (sendForm.audienceType === "user_ids") {
      audience.userIds = HGNotifyChannelVM.parseUserIds(sendForm.userIdsText);
    }
    if (sendForm.audienceType === "role") {
      audience.roleCode = String(sendForm.roleCode).trim();
    }
    const schedule = { type: sendForm.scheduleType };
    if (sendForm.scheduleType === "scheduled") {
      schedule.scheduledAt = new Date(sendForm.scheduledAt).toISOString();
    }
    return { templateId: template.templateId, templateVersion: template.version, audience, variables, schedule };
  };

  /** 确认发送：local 模式生成模拟任务，remote 模式调用发送任务接口并展示任务 ID。 */
  submitSendTask = () => {
    if (this.state.sending) return;
    const payload = this.buildSendPayload();
    const template = this.getSelectedTemplate();
    if (!HGNotifyChannelVM.isRemote()) {
      const result = HGNotifyChannelVM.buildSendDemoResult(payload);
      this.setState({
        previewOpen: false,
        lastTaskResult: `任务 ${result.taskId} 已创建（示例数据）：状态 ${result.status}，预计接收 ${result.estimatedRecipients} 人`,
      });
      message.success("发送任务已提交（示例数据），Worker 将在后台异步投递");
      return;
    }
    this.setState({ sending: true });
    const requestId = `send-${template.templateCode}-${Date.now()}`;
    HGNotifyChannelVM.createSendTask({ ...payload, requestId })
      .then((response) => {
        const result = response?.result || response || {};
        const estimated =
          result.estimatedRecipients ?? (payload.audience.type === "user_ids" ? payload.audience.userIds.length : "服务端估算");
        this.setState({
          sending: false,
          previewOpen: false,
          lastTaskResult: `任务 ${result.taskId || "--"} 已创建：状态 ${result.status || "pending"}，预计接收 ${estimated} 人`,
        });
        message.success("发送任务已创建，pending 表示已受理，投递结果请在发送记录中查看");
      })
      .catch((error) => {
        this.setState({ sending: false });
        message.error(error?.message || "发送任务创建失败");
      });
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
          当前仅站内信已接入 MySQL；短信、邮件、Push 和实时网关尚未接入。可基于已发布模板创建发送任务，
          填写白名单变量后由 Worker 异步渲染并投递。
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
    if (HGNotifyChannelVM.isRemote()) {
      return <HGCardPage title="指标暂不可用">尚未接入投递计数、P95 延迟与死信监控；此处不展示示例成功率。</HGCardPage>;
    }
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
            disabled={HGNotifyChannelVM.isRemote()}
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
            <strong>{HGNotifyChannelVM.isRemote() ? "--" : HGNotifyChannelVM.formatNumber(channel.dailySent)}</strong>
          </div>
          <div>
            <span>成功率</span>
            <strong className={styles[`health${healthTone.charAt(0).toUpperCase()}${healthTone.slice(1)}`]}>
              {HGNotifyChannelVM.isRemote() ? "--" : HGNotifyChannelVM.formatPercent(channel.successRate)}
            </strong>
          </div>
          <div>
            <span>P95 延迟</span>
            <strong>{channel.p95}</strong>
          </div>
        </div>

        <div className={styles.channelActions}>
          <HGButtonPage size="small" type="primary" disabled={HGNotifyChannelVM.isRemote()} onClick={() => this.openConfig(channel)}>
            渠道配置
          </HGButtonPage>
          <HGButtonPage size="small" disabled={HGNotifyChannelVM.isRemote() && channel.code !== "in_app"} onClick={() => this.handleTestSend(channel)}>
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
        <HGTablePage rowKey="id" columns={columns} dataSource={this.state.providers} loading={this.state.loading} pagination={false} />
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
    <HGCardPage title={HGNotifyChannelVM.isRemote() ? "最近站内通知记录" : "失败重试与死信"} extra={<span className={styles.cardExtraText}>{HGNotifyChannelVM.isRemote() ? "仅展示最近 20 条已落库记录；外部渠道和重试队列尚未接入" : "超过退避上限的任务进入死信，需要人工确认后重放"}</span>}>
        <HGTablePage rowKey="deliveryId" columns={columns} dataSource={this.state.deliveries} loading={this.state.loading} pagination={false} />
      </HGCardPage>
    );
  };

  /* ================= 发送通知任务渲染 ================= */

  /** 发送范围字段：按 audienceType 切换用户 ID 输入、角色编码或全站广播警示。 */
  renderAudienceFields = () => {
    const { sendForm } = this.state;
    if (sendForm.audienceType === "user_ids") {
      return (
        <label className={styles.fullField}>
          接收用户 ID（逗号分隔，最多 500 个）
          <HGInputTextArea
            value={sendForm.userIdsText}
            rows={3}
            maxLength={6000}
            placeholder="user_1001, user_1002, user_1003"
            onChange={(event) => this.changeSendForm("userIdsText", event.target.value)}
          />
          <span className={styles.fieldHint}>
            已识别 {HGNotifyChannelVM.parseUserIds(sendForm.userIdsText).length} 个用户 ID；同名任务对每个接收人只投递一条。
          </span>
        </label>
      );
    }
    if (sendForm.audienceType === "role") {
      return (
        <label className={styles.fullField}>
          接收角色编码（IAM 角色）
          <HGInputPage
            value={sendForm.roleCode}
            maxLength={64}
            placeholder="例如 reviewer，服务端按角色作用域展开接收人"
            onChange={(event) => this.changeSendForm("roleCode", event.target.value)}
          />
          <span className={styles.fieldHint}>角色展开在投递阶段执行，并再次校验 IAM Scope。</span>
        </label>
      );
    }
    return (
      <div className={styles.fullField}>
        <div className={styles.warningBar}>
          全站广播面向全体用户，需更高权限与审批策略；采用公告主体单条存储 + 用户已读状态，不逐用户复制通知。
        </div>
      </div>
    );
  };

  /** 模板变量输入区：按 variablesSchema 动态生成，切换模板时通过 key 重挂载避免旧值残留。 */
  renderVariableFields = (template) => {
    const schemaEntries = Object.entries(template.variablesSchema || {});
    if (!schemaEntries.length) return null;
    const { sendForm } = this.state;
    return (
      <div key={`variables-${template.templateId}`} className={styles.fullField}>
        <span className={styles.fieldGroupTitle}>模板变量（按白名单声明填写）</span>
        <div className={styles.variableGrid}>
          {schemaEntries.map(([name, rule]) => (
            <label key={name}>
              {name}
              {rule.required ? "（必填）" : "（可选）"}
              {rule.type === "integer" ? (
                <HGInputNumberPage
                  value={sendForm.variables[name]}
                  min={rule.minimum ?? 1}
                  step={1}
                  onChange={(value) => this.changeVariable(name, value)}
                />
              ) : (
                <HGInputPage
                  value={sendForm.variables[name]}
                  maxLength={rule.maxLength}
                  onChange={(event) => this.changeVariable(name, event.target.value)}
                />
              )}
              <span className={styles.fieldHint}>
                {rule.type === "integer" ? "整数" : "文本"}
                {rule.minimum !== undefined ? ` · 最小 ${rule.minimum}` : ""}
                {rule.maxLength !== undefined ? ` · 最长 ${rule.maxLength}` : ""}
              </span>
            </label>
          ))}
        </div>
        <span className={styles.fieldHint}>
          变量值对所有接收人生效；昵称、语言等用户级变量由服务端 Worker 渲染时合并，不需要在前端逐用户填写。
        </span>
      </div>
    );
  };

  /** 发送通知任务卡片：模板选择、接收范围、变量填写与发送时间，全部操作由按钮触发。 */
  renderSendSection = () => {
    const { templates, templatesLoading, sendForm, lastTaskResult } = this.state;
    const template = this.getSelectedTemplate();
    const templateOptions = templates.map((item) => ({
      value: item.templateId,
      label: `${item.templateName}（${TEMPLATE_CATEGORY_LABELS[item.category] || item.category} · v${item.version}）`,
    }));
    return (
      <HGCardPage
        title="发送通知任务"
        extra={
          <span className={styles.cardExtraText}>
            选择已发布模板并填写变量，任务提交后由 Worker 异步投递；页面不直接调用短信或推送接口
          </span>
        }
      >
        <div className={styles.sendToolbar}>
          <HGButtonPage loading={templatesLoading} onClick={this.handleQueryTemplates}>
            查询模板
          </HGButtonPage>
          <HGSelectPage
            value={sendForm.templateId || undefined}
            options={templateOptions}
            placeholder={templates.length ? "选择已发布模板" : "尚未查询模板，请先点击“查询模板”"}
            onChange={(value) => this.handleSelectTemplate(value)}
          />
          <span className={styles.cardExtraText}>
            {templates.length ? `列表快照：${templates.length} 个模板` : "模板列表为空：点击“查询模板”后展示点击时刻的数据"}
          </span>
        </div>

        <div className={styles.sendGrid}>
          <label>
            发送范围
            <HGSelectPage
              value={sendForm.audienceType}
              options={AUDIENCE_TYPE_OPTIONS}
              onChange={(value) => this.changeSendForm("audienceType", value)}
            />
          </label>
          <label>
            发送时间
            <HGSelectPage
              value={sendForm.scheduleType}
              options={SCHEDULE_TYPE_OPTIONS}
              onChange={(value) => this.changeSendForm("scheduleType", value)}
            />
          </label>
          {sendForm.scheduleType === "scheduled" ? (
            <label>
              定时发送时刻
              <input
                type="datetime-local"
                className={styles.datetimeInput}
                value={sendForm.scheduledAt}
                onChange={(event) => this.changeSendForm("scheduledAt", event.target.value)}
              />
            </label>
          ) : null}
          {this.renderAudienceFields()}
          {template ? this.renderVariableFields(template) : null}
        </div>

        <div className={styles.sendActions}>
          <HGButtonPage disabled={!template} onClick={this.handlePreviewSend}>
            预览通知
          </HGButtonPage>
          <HGButtonPage type="primary" disabled={!template} onClick={this.handlePreviewSend}>
            提交发送
          </HGButtonPage>
          {lastTaskResult ? <span className={styles.taskResult}>{lastTaskResult}</span> : null}
        </div>
      </HGCardPage>
    );
  };

  /** 预览正文：未填写的变量保留 {{name}} 占位并用高亮样式提示，实际提交前校验已拦截必填项。 */
  renderPreviewText = (text) =>
    String(text)
      .split(/(\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\})/g)
      .map((part, index) =>
        /^\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}$/.test(part) ? (
          <mark key={index} className={styles.previewVar}>
            {part}
          </mark>
        ) : (
          part
        ),
      );

  /** 发送预览与确认弹窗：模拟消息中心卡片展示渲染结果，确认后才真正创建任务。 */
  renderSendPreviewModal = () => {
    const { previewOpen, sendForm, sending } = this.state;
    if (!previewOpen) return null;
    const template = this.getSelectedTemplate();
    if (!template) return null;
    const payload = this.buildSendPayload();
    const rendered = HGNotifyChannelVM.renderTemplate(template, sendForm.variables);
    const audienceLabels = {
      user_ids: `指定用户（${payload.audience.userIds.length} 人）`,
      role: `角色用户（${payload.audience.roleCode}，服务端展开）`,
      all: "全站广播（公告共享存储）",
    };
    const scheduleText =
      payload.schedule.type === "immediate" ? "立即发送" : `定时发送 ${sendForm.scheduledAt.replace("T", " ")}`;
    return (
      <HGModalPage
        visible
        title="发送预览与确认"
        size="large"
        closable={!sending}
        onClose={this.closePreview}
        footer={
          <>
            <HGButtonPage disabled={sending} onClick={this.closePreview}>
              取消
            </HGButtonPage>
            <HGButtonPage type="primary" loading={sending} onClick={this.submitSendTask}>
              确认发送
            </HGButtonPage>
          </>
        }
      >
        {sendForm.audienceType === "all" ? (
          <div className={styles.dangerBar}>
            二次确认：该任务将面向全站用户广播，提交后进入审批与调度队列；已投递的通知无法撤回。
          </div>
        ) : null}
        <div className={styles.previewCard}>
          <div className={styles.previewHead}>
            <span className={styles.previewCategory}>
              {TEMPLATE_CATEGORY_LABELS[template.category] || template.category}
            </span>
            <span className={styles.previewTime}>
              {payload.schedule.type === "immediate" ? "现在" : sendForm.scheduledAt.replace("T", " ")}
            </span>
          </div>
          <h4 className={styles.previewTitle}>{this.renderPreviewText(rendered.title)}</h4>
          <p className={styles.previewBody}>{this.renderPreviewText(rendered.content)}</p>
          <span className={styles.previewFoot}>MLC 平台官方通知</span>
        </div>
        <ul className={styles.previewMeta}>
          <li>模板：{template.templateName}（{template.templateCode} · v{template.version}）</li>
          <li>投递渠道：{template.channels.join(" + ") || "未声明"}</li>
          <li>接收范围：{audienceLabels[sendForm.audienceType]}</li>
          <li>发送方式：{scheduleText}</li>
        </ul>
        <p className={styles.formFooter}>
          预览由浏览器本地渲染，正式内容以服务端模板渲染为准；相同 requestId 的请求只会创建一个任务（幂等）。
        </p>
      </HGModalPage>
    );
  };

  /** 重试策略说明卡：指数退避 + 抖动 + 幂等约束。 */
  renderRetrySection = () => (
    HGNotifyChannelVM.isRemote() ? null :
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
        {this.renderSendSection()}
        {this.renderChannelSection()}
        {this.renderProviderSection()}
        {this.renderDeliverySection()}
        {this.renderRetrySection()}
        {this.renderConfigModal()}
        {this.renderSendPreviewModal()}
      </div>
    );
  }
}

export default HGNotifyChannelPage;
