/*
 * @Description: 通知渠道中心运维页面。统一管理站内信/短信/邮件/Push/WebSocket 五个渠道、
 *               Provider 适配器、失败重试队列与死信任务。
 */
import React from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import HGCollectionView from "../../../../components/hg_collection_view/hg_collection_view";
import HGIconPage from "../../../../components/hg_icon/hg_icon_page";
import HGInputNumberPage from "../../../../components/hg_input_number/hg_input_number_page";
import HGInputPage, { HGInputTextArea } from "../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import HGStatCardPage from "../../../../components/hg_stat_card/hg_stat_card_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import { hgEvaluateAccess } from "../../../../modules/iam/hg_access_evaluator";
import { HGIAMContext } from "../../../../modules/iam/hg_iam_provider";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
import { hgCurrentIAMUser } from "../../../../modules/iam/hg_iam_session";
import { hgBuildSendCommand, hgDefaultSendVariables, hgValidateSendInput, hgValidateSendSchedule } from "./hg_notify_send_contract.js";
import HGNotifyChannelVM, {
  CHANNEL_DATA_SOURCE,
  CHANNEL_PRIORITY_OPTIONS,
  RETRY_LADDER,
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
 * 通知管理共用页面组件。
 * 职责：渠道页展示渠道与投递链路；发送页复用任务校验和审批入口；记录页只展示本人任务。
 * 约束：
 * - 密钥只展示环境变量名，页面不允许读取或回填密钥值；
 * - 渠道开关与配置仅做前端可见性控制，最终权限由后端 RBAC 判定；
 * - dataSource 为 local 时不发起请求，所有变更只更新本地 state。
 */
class HGNotifyChannelPage extends React.Component {
  static contextType = HGIAMContext;
  static defaultProps = {
    location: undefined, // 父布局传入的路由位置；本页不依赖路由状态。
    onMenuSelect: undefined, // 父布局菜单回调；本页不主动切换菜单。
    pushPage: undefined, // 父布局导航入口；send 页用于进入本人发送记录，缺省不导航。
    onBack: undefined, // 父布局返回动作；records 页用于回到发送页，缺省不导航。
    selectedKey: undefined, // 当前菜单键；本页不用于请求。
    hgView: "channel", // 默认只显示渠道总览；send/records 由各自页面传入，不加载渠道数据。
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      deliveriesLoading: false, // 投递记录单独加载；失败或慢请求不阻塞渠道卡片。
      channelError: "", // 渠道请求失败提示；空字符串表示当前无错误。
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
      templates: [], // 模板列表快照；进入发送页自动读取一次，之后可点“刷新模板”重读。
      reviewTemplates: [], // 最新草稿快照，单独于已发布版，防止混淆审核和发送内容。
      templateCursor: "", // 下一页发布版游标；空字符串表示无更多记录。
      reviewTemplateCursor: "", // 下一页最新草稿游标；空字符串表示无更多记录。
      templatesLoading: false, // 模板查询请求进行中标记；true 时禁用下拉与刷新，防止重复请求。
      sendForm: {
        templateId: "", // 已选模板 ID；空字符串表示未选择，变量输入区不渲染。
        recipients: [], // 用户目录确认的接收人 {id,name}；仅提交 ID，最多 100 人。
        variables: {}, // 模板变量名到填写值的映射；切换模板时整体重置，避免跨模板串值。
        scheduleType: "immediate", // immediate 或 scheduled；定时必须经另一管理员审批。
        scheduledAt: "", // 本地 datetime-local 值；空值表示未选择定时时刻。
      },
      recipientPickerOpen: false, // 仅点击选择接收人时打开弹窗，关闭不会发送通知。
      recipientRows: [], // 用户目录当前页；仅保留 ID 与展示名，不保留个人联系方式。
      recipientCursor: "", // 下一页游标；空字符串表示已加载全部用户。
      recipientLoading: false, // 用户目录请求进行中，禁用重复翻页。
      recipientError: "", // 目录请求失败提示；空字符串表示无错误。
      recipientDraft: [], // 弹窗中跨页暂存的选择；确认前不改变发送表单。
      sending: false, // 发送任务提交中标记；true 时预览弹窗按钮 loading 且禁止关闭。
      previewOpen: false, // 发送预览弹窗开关；确认后才持久化任务。
      lastTaskResult: "", // 最近一次任务创建结果文案；空字符串表示尚未提交过任务。
      taskIdInput: "", // 手动查询任务 ID；空字符串表示未输入。
      task: null, // 本人任务的服务端进度；null 表示未查询成功。
      taskLoading: false, // 任务详情查询中。
      taskCancelling: false, // 取消请求中，禁止重复操作。
      tasks: [], // 本人最近发送任务页；空数组表示尚未查询或没有记录。
      taskCursor: "", // 下一页主键游标；空字符串表示没有下一页。
      tasksLoaded: false, // 已完成过一次任务列表查询；区分未加载与空列表。
      tasksLoading: false, // 本人任务列表查询中。
      reviews: [], // 待审任务列表仅含他人任务摘要。
      reviewCursor: "", // 待审任务下一页主键；空值表示没有更多记录。
      reviewsLoading: false, // 待审列表请求标记。
      reviewDetail: null, // 服务端已渲染的待审文案；null 表示尚未查询。
      reviewDetailLoading: false, // 读取审核详情时禁止确认。
      approving: false, // 审批请求进行中禁止重复提交。
      publishingId: "", // 正在复核发布的模板 ID；空字符串表示无发布请求。
    };
    this.hgMounted = false; // 卸载后丢弃异步请求结果。
    this.hgTemplateSequence = 0; // 模板请求代数，旧列表不得覆盖新选择。
    this.hgTaskSequence = 0; // 任务详情请求代数，避免旧 ID 的响应覆盖新任务。
    this.hgTasksSequence = 0; // 任务列表请求代数，刷新与翻页不互相覆盖。
    this.hgReviewSequence = 0; // 审批列表与详情请求代数，账号切换清理。
    this.hgChannelSequence = 0; // 渠道与投递记录的请求代数；刷新或换账号后丢弃旧响应。
    this.hgRecipientSequence = 0; // 用户目录请求代数；关窗、换账号、卸载后忽略过期响应。
    this.hgRequest = null; // 待确认提交的幂等键与请求内容；失败时保留以安全重试。
    this.hgSending = false; // 同步提交锁，阻止 setState 生效前的双击。
    this.hgOwner = ""; // 当前 JWT 账号；切换时清除任务进度与发送表单。
    this.hgTemplateAutoLoaded = false; // 发送页已自动读取过模板的标记；账号切换后重置以便重读。
  }

  componentDidMount() {
    this.hgMounted = true;
    this.hgOwner = hgCurrentIAMUser();
    window.addEventListener("hg:auth-changed", this.hgOnAuthChanged);
    window.addEventListener("storage", this.hgOnAuthChanged);
    if (this.props.hgView !== "channel") {
      if (!HGNotifyChannelVM.isRemote()) this.setState({ ...HGNotifyChannelVM.buildDemoState(), loading: false });
      this.hgTryAutoLoadTemplates();
      return;
    }
    if (HGNotifyChannelVM.isRemote()) {
      this.loadRemoteData();
      return;
    }
    this.setState({ ...HGNotifyChannelVM.buildDemoState(), loading: false });
  }

  /** IAM 快照就绪后自动读取发送页模板；每次挂载或账号切换最多自动尝试一次。 */
  componentDidUpdate() {
    this.hgTryAutoLoadTemplates();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    window.removeEventListener("hg:auth-changed", this.hgOnAuthChanged);
    window.removeEventListener("storage", this.hgOnAuthChanged);
    this.hgTemplateSequence += 1;
    this.hgTaskSequence += 1;
    this.hgTasksSequence += 1;
    this.hgReviewSequence += 1;
    this.hgChannelSequence += 1;
    this.hgRecipientSequence += 1;
  }

  hgOnAuthChanged = () => {
    const owner = hgCurrentIAMUser(); // 登录用户变化时不得展示上一个管理员的任务数据。
    if (owner === this.hgOwner) return;
    this.hgOwner = owner;
    this.hgTemplateAutoLoaded = false;
    this.hgTemplateSequence += 1;
    this.hgTaskSequence += 1;
    this.hgTasksSequence += 1;
    this.hgReviewSequence += 1;
    this.hgChannelSequence += 1;
    this.hgRecipientSequence += 1;
    this.hgRequest = null;
    this.setState((state) => ({
      channels: [], providers: [], deliveries: [], channelError: "", loading: false,
      deliveriesLoading: false, refreshing: false,
      templates: [], reviewTemplates: [], templateCursor: "", reviewTemplateCursor: "",
      templatesLoading: false, task: null, taskIdInput: "", lastTaskResult: "",
      tasks: [], taskCursor: "", tasksLoaded: false, tasksLoading: false,
      reviews: [], reviewCursor: "", reviewsLoading: false, reviewDetail: null, reviewDetailLoading: false, approving: false,
      previewOpen: false, sending: false, taskLoading: false, publishingId: "", taskCancelling: false,
      recipientPickerOpen: false, recipientRows: [], recipientCursor: "", recipientLoading: false,
      recipientError: "", recipientDraft: [],
      sendForm: { ...state.sendForm, templateId: "", recipients: [], variables: {}, scheduleType: "immediate", scheduledAt: "" },
    }), () => {
      if (this.hgMounted && this.props.hgView === "channel" && HGNotifyChannelVM.isRemote()) this.loadRemoteData();
      if (this.hgMounted && this.props.hgView === "send") this.hgTryAutoLoadTemplates();
    });
  };

  /** 发送页进入或账号切换后自动读取一次模板；IAM 未就绪时等就绪后由 componentDidUpdate 触发。 */
  hgTryAutoLoadTemplates = () => {
    if (this.hgTemplateAutoLoaded || this.props.hgView !== "send" || this.context?.status !== "ready") return;
    // 无论有无读取权限都只自动尝试一次；无权限时静默跳过，由“刷新模板”给出明确提示。
    this.hgTemplateAutoLoaded = true;
    this.handleQueryTemplates({ silent: true });
  };

  /** 本地 IAM 快照仅用于显示和按钮状态，真正授权由 Go 服务端再核验。 */
  hgCan = (permission) =>
    this.context?.status === "ready" &&
    hgEvaluateAccess(this.context?.snapshot, { permission }).allowed;

  hgRequire = (permission) => {
    if (this.hgCan(permission)) return true;
    message.warning(`当前账号没有 ${permission} 权限`);
    return false;
  };

  /** 渠道与投递记录独立结算；投递接口失败不能隐藏已成功获取的渠道。 */
  loadRemoteData = () => {
    const owner = this.hgOwner; // 当前登录管理员；账号切换后忽略旧请求结果。
    const sequence = ++this.hgChannelSequence; // 连续刷新只接纳最新一次结果。
    this.setState({ loading: true, deliveriesLoading: true, channelError: "" });
    const channelRequest = HGNotifyChannelVM.fetchChannels()
      .then((channelResult) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgChannelSequence) return;
        const channels = (channelResult?.channels || channelResult?.list || []).map((item) => ({
          ...item,
          config: item.config || {},
        }));
        const providers = channelResult?.providers || [];
        this.setState({
          channels,
          providers,
          loading: false,
        });
      })
      .catch((error) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgChannelSequence) return;
        this.setState({ loading: false, channelError: error?.message || "通知渠道数据加载失败" });
        message.error(error?.message || "通知渠道数据加载失败");
      });
    const deliveryRequest = HGNotifyChannelVM.fetchDeliveries()
      .then((deliveryResult) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgChannelSequence) return;
        this.setState({ deliveries: deliveryResult?.list || deliveryResult?.deliveries || [], deliveriesLoading: false });
      })
      .catch((error) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgChannelSequence) return;
        this.setState({ deliveriesLoading: false });
        message.error(error?.message || "投递记录加载失败");
      });
    return Promise.allSettled([channelRequest, deliveryRequest]).then(() => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgChannelSequence) this.setState({ refreshing: false });
    });
  };

  /** 刷新：local 模式提示数据来源，remote 模式分别重新拉取渠道与投递记录。 */
  handleRefresh = () => {
    if (!HGNotifyChannelVM.isRemote()) {
      message.info("当前展示本地示例数据，接入 /admin/v1/notification 接口后刷新会读取真实链路");
      return;
    }
    this.setState({ refreshing: true });
    this.loadRemoteData();
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

  /**
   * 查询模板列表：local 返回示例模板，remote 请求 /admin/templates。
   * options.silent 为 true 时（页面进入自动读取）不弹权限警告与成功提示，加载失败仍如实提示。
   */
  handleQueryTemplates = (options = {}) => {
    const silent = options.silent === true;
    if (this.state.templatesLoading || this.state.sending || this.state.previewOpen) return;
    if (silent ? !this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_READ)
      : !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_READ)) return;
    if (!HGNotifyChannelVM.isRemote()) {
      const templates = HGNotifyChannelVM.buildDemoTemplates();
      this.setState({ templates });
      if (!silent) message.success(`已加载 ${templates.length} 个示例模板（本地数据）`);
      return;
    }
    const sequence = ++this.hgTemplateSequence;
    const owner = this.hgOwner;
    this.setState({ templatesLoading: true });
    Promise.all([HGNotifyChannelVM.fetchPublishedTemplates(), HGNotifyChannelVM.fetchTemplates()])
      .then(([response, reviewResponse]) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgTemplateSequence) return;
        const templates = response.list;
        const selected = this.state.sendForm.templateId; // 同一发布版刷新不能丢失结果未知请求的幂等键。
        const previous = this.state.templates.find((item) => item.templateId === selected);
        const current = templates.find((item) => item.templateId === selected);
        if (!previous || !current || previous.version !== current.version ||
            JSON.stringify(previous) !== JSON.stringify(current)) this.hgRequest = null;
        this.setState((state) => ({
          templates,
          reviewTemplates: reviewResponse.list,
          templateCursor: response.nextCursor || "",
          reviewTemplateCursor: reviewResponse.nextCursor || "",
          templatesLoading: false,
          sendForm: HGNotifyChannelVM.isSendable(templates.find((item) =>
            item.templateId === state.sendForm.templateId &&
            item.version === state.templates.find((old) => old.templateId === state.sendForm.templateId)?.version))
            ? state.sendForm : { ...state.sendForm, templateId: "", variables: {} },
        }));
        if (!silent) message.success(`已读取 ${templates.length} 个发布版${response.nextCursor || reviewResponse.nextCursor ? "；可按需加载更多" : ""}`);
      })
      .catch((error) => {
        if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgTemplateSequence) return;
        this.setState({ templatesLoading: false });
        message.error(error?.message || "模板列表加载失败");
      });
  };

  /** 两个列表各自按游标加载，不会将最新草稿混入发布版选择器。 */
  hgLoadMoreTemplates = (published) => {
    if (this.state.templatesLoading || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_READ)) return;
    const cursor = published ? this.state.templateCursor : this.state.reviewTemplateCursor;
    if (!cursor) return;
    const owner = this.hgOwner;
    const sequence = ++this.hgTemplateSequence;
    this.setState({ templatesLoading: true });
    const request = published ? HGNotifyChannelVM.fetchPublishedTemplates(cursor) : HGNotifyChannelVM.fetchTemplates(undefined, cursor);
    request.then((page) => {
      if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgTemplateSequence) return;
      this.setState((state) => published
        ? { templates: [...state.templates, ...page.list], templateCursor: page.nextCursor, templatesLoading: false }
        : { reviewTemplates: [...state.reviewTemplates, ...page.list], reviewTemplateCursor: page.nextCursor, templatesLoading: false });
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgTemplateSequence) {
        this.setState({ templatesLoading: false });
        message.error(error?.message || "加载更多模板失败");
      }
    });
  };

  /** 选择模板时仅填入规则明确声明的合法默认变量，避免跨模板串值或误发示例内容。 */
  handleSelectTemplate = (templateId) => {
    if (templateId === this.state.sendForm.templateId) return;
    this.hgRequest = null;
    this.setState((state) => ({
      sendForm: {
        ...state.sendForm, templateId: templateId || "",
        variables: hgDefaultSendVariables(state.templates.find((item) => item.templateId === templateId)),
      },
    }));
  };

  /** 发送表单基础字段变更。 */
  changeSendForm = (field, value) => {
    this.hgRequest = null;
    this.setState((state) => ({ sendForm: { ...state.sendForm, [field]: value } }));
  };

  /** 模板变量字段变更：仅更新对应变量名，不影响其他已填变量。 */
  changeVariable = (name, value) => {
    this.hgRequest = null;
    this.setState((state) => ({
      sendForm: { ...state.sendForm, variables: { ...state.sendForm.variables, [name]: value } },
    }));
  };

  /** 点击选择按钮后才读取用户目录；发送表单只接受经用户目录确认的 ID。 */
  hgOpenRecipientPicker = () => {
    if (this.state.sending || this.state.previewOpen || !this.hgRequire(HG_PERMISSIONS.USER_READ)) return;
    this.setState((state) => ({
      recipientPickerOpen: true,
      recipientDraft: [...state.sendForm.recipients],
      recipientRows: [], recipientCursor: "", recipientError: "",
    }), () => this.hgLoadRecipients(true));
  };

  /** 游标分页只读取当前页，避免全量用户扫描及选人弹窗无限加载。 */
  hgLoadRecipients = (refresh = false) => {
    if (!this.state.recipientPickerOpen || this.state.recipientLoading ||
        (!refresh && !this.state.recipientCursor)) return;
    const sequence = ++this.hgRecipientSequence; // 关闭、刷新或账号切换后不允许旧数据回填。
    const owner = this.hgOwner; // 请求所属的管理员账号。
    const cursor = refresh ? "" : this.state.recipientCursor; // 首次查询不传游标。
    this.setState({ recipientLoading: true, recipientError: "" });
    return HGNotifyChannelVM.fetchRecipientUsers(cursor).then((page) => {
      if (!this.hgMounted || !this.state.recipientPickerOpen ||
          owner !== this.hgOwner || sequence !== this.hgRecipientSequence) return;
      this.setState((state) => ({
        recipientRows: refresh ? page.list : [...state.recipientRows, ...page.list],
        recipientCursor: page.nextCursor,
        recipientLoading: false,
      }));
    }).catch((error) => {
      if (this.hgMounted && this.state.recipientPickerOpen &&
          owner === this.hgOwner && sequence === this.hgRecipientSequence)
        this.setState({ recipientLoading: false, recipientError: error?.message || "用户列表加载失败" });
    });
  };

  /** 表格跨页多选只保存 ID 与展示名，最多 100 人；取消弹窗不提交草稿。 */
  hgChangeRecipientDraft = (keys, rows) => {
    if (keys.length > 100) { message.warning("一次最多选择 100 位接收用户"); return; }
    this.setState((state) => ({
      recipientDraft: keys.map((id) =>
        rows.find((item) => item.id === id) || state.recipientDraft.find((item) => item.id === id)).filter(Boolean),
    }));
  };

  /** 确认所选用户才写入发送表单；请求结果未知时不因无变化重置幂等键。 */
  hgConfirmRecipients = () => {
    const recipients = this.state.recipientDraft;
    if (JSON.stringify(recipients) !== JSON.stringify(this.state.sendForm.recipients)) this.hgRequest = null;
    this.setState((state) => ({ sendForm: { ...state.sendForm, recipients } }));
    this.hgCloseRecipientPicker();
  };

  /** 关闭弹窗并丢弃待选列表和过期请求，不影响已确认的收件人。 */
  hgCloseRecipientPicker = () => {
    this.hgRecipientSequence += 1;
    this.setState({ recipientPickerOpen: false, recipientRows: [], recipientCursor: "",
      recipientError: "", recipientDraft: [], recipientLoading: false });
  };

  /** 删除已确认的接收人；后续预览和提交都只读取剩余 ID。 */
  hgRemoveRecipient = (id) => {
    this.hgRequest = null;
    this.setState((state) => ({
      sendForm: { ...state.sendForm, recipients: state.sendForm.recipients.filter((item) => item.id !== id) },
    }));
  };

  /** 当前选中的模板对象；未选择或列表中不存在时返回 null。 */
  getSelectedTemplate = () => {
    const { templates, sendForm } = this.state;
    return templates.find((item) => item.templateId === sendForm.templateId && HGNotifyChannelVM.isSendable(item)) || null;
  };

  /**
   * 提交前校验发送表单。
   * 返回首个错误文案；空字符串表示校验通过。规则与后端 variablesSchema 白名单保持一致。
   */
  validateSendForm = () => {
    const { sendForm } = this.state;
    const template = this.getSelectedTemplate();
    return hgValidateSendInput(template, sendForm.recipients.map((item) => item.id), sendForm.variables) ||
      hgValidateSendSchedule(sendForm.scheduleType, sendForm.scheduledAt);
  };

  /** 打开预览弹窗；校验失败仅提示，不产生任何请求。 */
  handlePreviewSend = () => {
    if (!this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_CREATE)) return;
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

  /** 按当前服务端 HGCommand 协议构造请求；不发送原型中的 audience/schedule 字段。 */
  buildSendPayload = () => {
    const { sendForm } = this.state;
    const template = this.getSelectedTemplate();
    return hgBuildSendCommand(template, sendForm.recipients.map((item) => item.id),
      sendForm.variables, sendForm.scheduleType, sendForm.scheduledAt);
  };

  /** 确认发送：local 模式生成模拟任务，remote 模式调用发送任务接口并展示任务 ID。 */
  submitSendTask = () => {
    if (this.hgSending || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_CREATE)) return;
    const validation = this.validateSendForm();
    if (validation) { message.warning(validation); return; }
    const payload = this.buildSendPayload();
    if (!HGNotifyChannelVM.isRemote()) {
      const result = HGNotifyChannelVM.buildSendDemoResult(payload);
      this.setState({
        previewOpen: false,
        lastTaskResult: `任务 ${result.taskId} 已创建（示例数据）：状态 ${result.status}，预计接收 ${result.estimatedRecipients} 人`,
      });
      message.success("发送任务已提交（示例数据），Worker 将在后台异步投递");
      return;
    }
    this.hgSending = true;
    this.setState({ sending: true });
    const owner = this.hgOwner;
    const fingerprint = JSON.stringify(payload);
    if (!this.hgRequest || this.hgRequest.fingerprint !== fingerprint) {
      this.hgRequest = { fingerprint, requestId: `send-${crypto.randomUUID()}` };
    }
    HGNotifyChannelVM.createSendTask({ ...payload, requestId: this.hgRequest.requestId })
      .then((response) => {
        if (!this.hgMounted || owner !== this.hgOwner) return;
        const result = response || {};
        this.setState({
          sending: false,
          previewOpen: false,
          taskIdInput: result.taskId || "",
          lastTaskResult: `任务 ${result.taskId || "--"} 已受理：${result.status || "pending"}，共 ${result.estimatedRecipients ?? payload.userIds.length} 人`,
        });
        this.hgRequest = null;
        if (result.taskId) this.hgLoadTask(result.taskId);
        message.success(result.status === "pending_approval"
          ? "任务已保存，须由另一名授权管理员审批后才能投递"
          : "任务已持久化；pending 不代表通知已送达");
      })
      .catch((error) => {
        if (!this.hgMounted || owner !== this.hgOwner) return;
        this.setState({ sending: false });
        message.error(error?.message || "请求结果未知，请保持当前内容重试（复用同一幂等键）");
      })
      .finally(() => { this.hgSending = false; });
  };

  /** 待审列表只读取另一管理员创建的任务；失败或账号切换丢弃旧响应。 */
  hgLoadReviews = (refresh = false) => {
    if (!HGNotifyChannelVM.isRemote() || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE)) return;
    if (this.state.approving) return; // 审批结果未确定前不清空正在复核的文案。
    if (!refresh && (this.state.reviewsLoading || !this.state.reviewCursor)) return;
    const owner = this.hgOwner;
    const sequence = ++this.hgReviewSequence;
    const cursor = refresh ? "" : this.state.reviewCursor;
    this.setState({ reviewsLoading: true, reviewDetail: null, reviewDetailLoading: false });
    HGNotifyChannelVM.reviewPage(cursor).then((page) => {
      if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgReviewSequence) return;
      if (!Array.isArray(page?.list) || page.list.length > 20) throw new Error("待审记录格式错误");
      this.setState((state) => ({
        reviews: refresh ? page.list : [...state.reviews, ...page.list],
        reviewCursor: page.nextCursor || "", reviewsLoading: false,
      }));
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgReviewSequence) {
        this.setState({ reviewsLoading: false });
        message.error(error?.message || "待审记录查询失败");
      }
    });
  };

  /** 审核前单独读取服务端最终渲染文案，不从本地模板缓存推导任务内容。 */
  hgOpenReview = (id) => {
    if (!HGNotifyChannelVM.isRemote() || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE) || this.state.approving) return;
    const owner = this.hgOwner;
    const sequence = ++this.hgReviewSequence;
    this.setState({ reviewDetail: null, reviewDetailLoading: true, reviewsLoading: false });
    HGNotifyChannelVM.reviewDetail(id).then((item) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgReviewSequence)
        this.setState({ reviewDetail: item, reviewDetailLoading: false });
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgReviewSequence) {
        this.setState({ reviewDetailLoading: false });
        message.error(error?.message || "复核文案读取失败");
      }
    });
  };

  /** 审批人只确认当前待审任务；服务端再次校验创建人不同、模板仍已发布。 */
  hgApproveTask = () => {
    const item = this.state.reviewDetail;
    if (!HGNotifyChannelVM.isRemote() || !item || this.state.approving || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE)) return;
    const owner = this.hgOwner;
    this.setState({ approving: true });
    HGNotifyChannelVM.approveTask(item.taskId).then(() => {
      if (!this.hgMounted || owner !== this.hgOwner) return;
      this.setState({ reviewDetail: null, approving: false }, () => this.hgLoadReviews(true));
      message.success("审批完成，任务将在计划时间后由后台处理");
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner)
        message.error(error?.message || "审批结果不明，请刷新待审记录核对，不要重复提交");
    }).finally(() => {
      if (this.hgMounted && owner === this.hgOwner) this.setState({ approving: false });
    });
  };

  /** 待审任务只展示人数、服务端渲染文案及时间；不暴露接收人列表。 */
  renderApprovalSection = () => HGNotifyChannelVM.isRemote() && this.hgCan(HG_PERMISSIONS.NOTIFICATION_SEND_APPROVE) ? (
    <HGCardPage title="双人审批" extra={<HGButtonPage loading={this.state.reviewsLoading}
      onClick={() => this.hgLoadReviews(true)}>查询待审任务</HGButtonPage>}>
      <HGTablePage rowKey="taskId" pagination={false} loading={this.state.reviewsLoading}
        columns={[
          { title: "任务 ID", dataIndex: "taskId" },
          { title: "模板版本", dataIndex: "templateVersion", render: (version, row) => `${row.templateId} v${version}` },
          { title: "接收人数", dataIndex: "total" },
          { title: "操作", dataIndex: "taskId", render: (id) =>
            <HGButtonPage size="small" onClick={() => this.hgOpenReview(id)}>复核文案</HGButtonPage> },
        ]} dataSource={this.state.reviews} />
      {this.state.reviewCursor ? <HGButtonPage loading={this.state.reviewsLoading}
        onClick={() => this.hgLoadReviews()}>加载更多待审</HGButtonPage> : null}
      {this.state.reviewDetailLoading ? <p>正在读取服务端文案…</p> : null}
      {this.state.reviewDetail ? (
        <div className={styles.taskDetail}>
          <strong>任务 {this.state.reviewDetail.taskId} · {this.state.reviewDetail.category}</strong>
          <span>接收人数：{this.state.reviewDetail.total}；计划时间：{this.state.reviewDetail.scheduledAt
            ? new Date(this.state.reviewDetail.scheduledAt).toLocaleString("zh-CN") : "审批后立即"}</span>
          <strong>{this.state.reviewDetail.title}</strong>
          <p className={styles.reviewCopy}>{this.state.reviewDetail.body}</p>
          <span className={styles.fieldHint}>文案已按任务变量由服务端渲染；接收用户 ID 不在此页展示。</span>
          <HGButtonPage type="primary" loading={this.state.approving}
            onClick={() => { if (window.confirm("确认放行该任务？已入箱通知不可撤回。")) this.hgApproveTask(); }}>
            确认审批并调度
          </HGButtonPage>
        </div>
      ) : null}
    </HGCardPage>
  ) : null;

  /** 仅按本人已知任务 ID 查询；不枚举其他管理员任务。 */
  hgLoadTask = (id = this.state.taskIdInput) => {
    if (!this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_READ)) return;
    if (!/^[1-9]\d*$/.test(id)) { message.warning("请输入有效的任务 ID"); return; }
    const sequence = ++this.hgTaskSequence;
    const owner = this.hgOwner;
    this.setState({ taskLoading: true, task: null, taskIdInput: id });
    HGNotifyChannelVM.taskDetail(id).then((task) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgTaskSequence) this.setState({ task, taskLoading: false });
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgTaskSequence) {
        this.setState({ taskLoading: false });
        message.error(error?.message || "查询任务失败");
      }
    });
  };

  /** 取消只阻止剩余用户的投递，成功后重新读取权威任务状态。 */
  hgCancelTask = () => {
    const { task, taskCancelling } = this.state;
    if (!task || taskCancelling || !this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_CANCEL)) return;
    if (!window.confirm(`确认取消任务 ${task.taskId}？已投递的通知无法撤回。`)) return;
    const owner = this.hgOwner;
    this.setState({ taskCancelling: true });
    HGNotifyChannelVM.cancelTask(task.taskId).then(() => {
      if (this.hgMounted && owner === this.hgOwner) {
        this.hgLoadTask(task.taskId);
        this.hgLoadTasks(true);
      }
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner) message.error(error?.message || "取消失败，请刷新任务状态");
    }).finally(() => { if (this.hgMounted && owner === this.hgOwner) this.setState({ taskCancelling: false }); });
  };

  /** 主键游标分页读取本人任务；刷新时递增代数，防止上一页过期响应混入。 */
  hgLoadTasks = (refresh = false) => {
    if (!this.hgRequire(HG_PERMISSIONS.NOTIFICATION_SEND_READ)) return;
    if (!refresh && (this.state.tasksLoading || !this.state.taskCursor)) return;
    const sequence = refresh ? ++this.hgTasksSequence : this.hgTasksSequence;
    const owner = this.hgOwner;
    const cursor = refresh ? "" : this.state.taskCursor;
    this.setState({ tasksLoading: true });
    HGNotifyChannelVM.taskPage(cursor).then((page) => {
      if (!this.hgMounted || owner !== this.hgOwner || sequence !== this.hgTasksSequence) return;
      if (!Array.isArray(page?.list)) throw new Error("发送记录响应格式错误");
      this.setState((state) => ({
        tasksLoading: false, tasksLoaded: true,
        tasks: refresh ? page.list : [...state.tasks, ...page.list],
        taskCursor: page.nextCursor || "",
      }));
    }).catch((error) => {
      if (this.hgMounted && owner === this.hgOwner && sequence === this.hgTasksSequence) {
        this.setState({ tasksLoading: false });
        message.error(error?.message || "查询发送记录失败");
      }
    });
  };

  /** 双人复核以最新版本号发布；失败后保留列表让审核者自行刷新核对。 */
  hgPublishTemplate = (template) => {
    if (!this.hgRequire(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_PUBLISH) || this.state.publishingId) return;
    if (!window.confirm(`确认复核并发布模板 ${template.templateName} v${template.version}？创建人不可自行发布。`)) return;
    const owner = this.hgOwner;
    this.setState({ publishingId: template.templateId });
    HGNotifyChannelVM.publishTemplate(template.templateId, template.version)
      .then(() => { if (this.hgMounted && owner === this.hgOwner) { message.success("模板已发布，请刷新模板列表"); this.handleQueryTemplates(); } })
      .catch((error) => { if (this.hgMounted && owner === this.hgOwner) message.error(error?.message || "发布失败，请核对模板版本和创建人"); })
      .finally(() => { if (this.hgMounted && owner === this.hgOwner) this.setState({ publishingId: "" }); });
  };

  /** 模板创建/编辑仍在现有模板页面完成；此处只复核可发送的站内草稿。 */
  renderPublishSection = () => {
    const drafts = this.state.reviewTemplates.filter((item) =>
      item.status !== "deleted" && item.publishedVersion !== item.version &&
      item.templateCode !== "iam.role.updated" && ["system", "marketing"].includes(item.category) &&
      item.actionType === "none" && Object.keys(item.actionConfig || {}).length === 0 &&
      item.channels?.length === 1 && item.channels[0] === "in_app" &&
      Object.values(item.variablesSchema || {}).every((rule) => rule?.type === "string"));
    return (
      <HGCardPage title="模板复核发布" extra={<span className={styles.cardExtraText}>创建人不可自行发布；仅可复核最新站内纯文本版本</span>}>
        {drafts.length ? drafts.map((item) => (
          <div className={styles.reviewRow} key={item.templateId}>
            <span>{item.templateName} · {item.templateCode} · v{item.version}</span>
            <div className={styles.reviewCopy}>
              <strong>{item.titleTemplate}</strong>
              <span>{item.bodyTemplate}</span>
              <span className={styles.fieldHint}>变量声明：{Object.keys(item.variablesSchema || {}).join("、") || "无"}</span>
            </div>
            <HGButtonPage disabled={!!this.state.publishingId}
              loading={this.state.publishingId === item.templateId} onClick={() => this.hgPublishTemplate(item)}>
              复核并发布
            </HGButtonPage>
          </div>
        )) : <p className={styles.fieldHint}>当前列表中没有待发布的站内模板；可刷新或加载更多。</p>}
        {this.state.reviewTemplateCursor ? <HGButtonPage loading={this.state.templatesLoading}
          onClick={() => this.hgLoadMoreTemplates(false)}>加载更多草稿</HGButtonPage> : null}
      </HGCardPage>
    );
  };

  /** 本人任务按主键游标追加卡片；只显示模板、状态与处理进度，不展示接收人或变量。 */
  renderTaskList = () => (
    <HGCardPage title="本人发送记录" extra={<HGButtonPage loading={this.state.tasksLoading}
      onClick={() => this.hgLoadTasks(true)}>查询/刷新记录</HGButtonPage>}>
      <HGCollectionView items={this.state.tasks} fillHeight={false} align="left"
        ariaLabel="本人发送记录" loading={this.state.tasksLoading}
        hasMore={Boolean(this.state.taskCursor)} onLoadMore={() => this.hgLoadTasks()}
        onRefresh={() => this.hgLoadTasks(true)} getKey={(item) => item.taskId}
        emptyText={this.state.tasksLoaded ? "暂无本人发送记录" : "正在查询本人发送记录"}
        loadedText="已加载全部本人发送记录"
        renderCell={(item) => (
          <article className={styles.taskCard}>
            <strong>任务 {item.taskId} · {item.status}</strong>
            <span>模板 {item.templateId} v{item.templateVersion} · 已处理 {item.processed}/{item.total}</span>
            <span>创建于 {item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "--"}</span>
            <HGButtonPage size="small" onClick={() => this.hgLoadTask(item.taskId)}>查看进度</HGButtonPage>
          </article>
        )} />
      <p className={styles.fieldHint}>processed 包含营销偏好拒收，不代表实际送达；失败任务需人工排查。</p>
    </HGCardPage>
  );

  /** 仅回显本人任务的计数；processed 包含偏好拒收，不等于实际送达人数。 */
  renderTaskSection = () => {
    const { task, taskIdInput, taskLoading, taskCancelling } = this.state;
    return (
      <HGCardPage title="发送任务进度" extra={<span className={styles.cardExtraText}>仅可按本人任务 ID 查询；请保存任务 ID</span>}>
        <div className={styles.sendToolbar}>
          <HGInputPage value={taskIdInput} maxLength={20} placeholder="输入本人任务 ID"
            onChange={(event) => { this.hgTaskSequence += 1; this.setState({ taskIdInput: event.target.value, task: null }); }} />
          <HGButtonPage loading={taskLoading}
            onClick={() => this.hgLoadTask()}>查询进度</HGButtonPage>
        </div>
        {task ? (
          <div className={styles.taskDetail}>
            <span>任务 {task.taskId} · 模板 {task.templateId} v{task.templateVersion}</span>
            <span>状态：{task.status} · 已处理 {task.processed}/{task.total} · 当前连续失败 {task.attempts} 次
              {task.scheduledAt ? ` · 计划时间 ${new Date(task.scheduledAt).toLocaleString("zh-CN")}` : ""}
            </span>
            <span className={styles.fieldHint}>已处理包含营销偏好拒收，不代表已送达或已读；failed 须人工排查，暂不支持自动重试。</span>
            {this.hgCan(HG_PERMISSIONS.NOTIFICATION_SEND_CANCEL) &&
              ["pending", "queued", "leased", "pending_approval"].includes(task.status) && (
              <HGButtonPage danger loading={taskCancelling}
                onClick={this.hgCancelTask}>取消剩余投递</HGButtonPage>
            )}
          </div>
        ) : null}
      </HGCardPage>
    );
  };

  /* ================= 渲染 ================= */

  /** 顶部 hero：模块说明与数据来源标记。 */
  renderHero = () => (
    <div className={styles.hero}>
      <div className={styles.heroMain}>
        <span className={styles.heroTag}>NOTIFICATION / CHANNEL CENTER</span>
        <h2 className={styles.heroTitle}>通知渠道中心</h2>
        <p className={styles.heroDesc}>
          查看站内信、短信、邮件、移动推送和实时提醒渠道的当前可用状态；未接入渠道不能启用。
          投递量、成功率与延迟监控尚未接入；发送通知请使用独立的「发送通知」页面。
        </p>
      </div>
      <div className={styles.heroSide}>
        <span className={styles.heroSource}>{HGNotifyChannelVM.isRemote() ? "服务端渠道状态" : "示例数据"}</span>
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
      ) : this.state.channelError ? (
        <p role="alert">{this.state.channelError}</p>
      ) : !this.state.channels.length ? (
        <p>暂无渠道数据</p>
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
        <HGTablePage rowKey="deliveryId" columns={columns} dataSource={this.state.deliveries} loading={this.state.deliveriesLoading} pagination={false} />
      </HGCardPage>
    );
  };

  /* ================= 发送通知任务渲染 ================= */

  /** 已确认的接收人按所选用户逐行展示；未选择时只保留一行入口，不渲染空表格留白。 */
  renderAudienceFields = () => {
    const { sendForm, sending, previewOpen } = this.state;
    const hasRecipients = sendForm.recipients.length > 0;
    return (
      <div className={styles.fullField}>
        <div className={styles.sendToolbar}>
          <strong>{hasRecipients ? `接收用户（${sendForm.recipients.length}/100）` : "接收用户"}</strong>
          <HGButtonPage disabled={sending || previewOpen} onClick={this.hgOpenRecipientPicker}>
            {hasRecipients ? "追加接收用户" : "选择接收用户"}
          </HGButtonPage>
          {!hasRecipients ? (
            <span className={styles.fieldHint}>尚未选择接收用户；仅可选择目录中 1–100 位明确用户。</span>
          ) : null}
        </div>
        {hasRecipients ? (
          <>
            <HGTablePage rowKey="id" pagination={false} dataSource={sendForm.recipients}
              columns={[
                { title: "接收用户（用户名 + 用户 ID）", dataIndex: "name",
                  render: (name, row) => `${name}（${row.id}）` },
                { title: "操作", dataIndex: "id", render: (id) =>
                  <HGButtonPage size="small" disabled={sending || previewOpen}
                    onClick={() => this.hgRemoveRecipient(id)}>移除</HGButtonPage> },
              ]} />
            <span className={styles.fieldHint}>仅选择用户目录中的现有用户；不会按角色、分群或全站发送。</span>
          </>
        ) : null}
      </div>
    );
  };

  /** 目录弹窗只展示公开用户名和业务 user_id，跨页选择须明确确认后才写入发送表单。 */
  renderRecipientPicker = () => {
    if (!this.state.recipientPickerOpen) return null;
    const { recipientRows, recipientDraft, recipientLoading, recipientError, recipientCursor } = this.state;
    return (
      <HGModalPage visible title="选择接收用户" size="large" onClose={this.hgCloseRecipientPicker}
        footer={<>
          <HGButtonPage onClick={this.hgCloseRecipientPicker}>取消</HGButtonPage>
          <HGButtonPage type="primary" onClick={this.hgConfirmRecipients}>确认选择（{recipientDraft.length}/100）</HGButtonPage>
        </>}>
        <p className={styles.fieldHint}>多选后确认；跨页已选用户会保留。此操作不会发送通知。</p>
        {recipientError ? <p role="alert">{recipientError} <HGButtonPage onClick={() => this.hgLoadRecipients(true)}>重试</HGButtonPage></p> : null}
        <HGTablePage rowKey="id" pagination={false} loading={recipientLoading} dataSource={recipientRows}
          rowSelection={{
            type: "checkbox",
            selectedRowKeys: recipientDraft.map((item) => item.id),
            onChange: this.hgChangeRecipientDraft,
          }}
          columns={[{ title: "用户名", dataIndex: "name" }, { title: "用户 ID", dataIndex: "id" }]} />
        {recipientCursor ? <HGButtonPage loading={recipientLoading}
          onClick={() => this.hgLoadRecipients()}>加载更多用户</HGButtonPage> : null}
        {recipientDraft.length ? (
          <p className={styles.fieldHint}>已选择：{recipientDraft.map((item) => `${item.name}（${item.id}）`).join("、")}</p>
        ) : null}
      </HGModalPage>
    );
  };

  /** 选择模板后展示全部静态内容和当前变量渲染结果；未声明默认值时保留占位而不伪造发送内容。 */
  renderSelectedTemplate = (template) => {
    const rendered = HGNotifyChannelVM.renderTemplate(template, this.state.sendForm.variables);
    return (
      <section className={styles.templateSummary} aria-label="已选择模板内容">
        <strong>{template.templateName} · {template.templateCode} · v{template.version}</strong>
        <span>标题模板：{template.titleTemplate}</span>
        <span>正文模板：{template.bodyTemplate}</span>
        <span>发送标题：{this.renderPreviewText(rendered.title)}</span>
        <span>发送正文：{this.renderPreviewText(rendered.content)}</span>
        <span className={styles.fieldHint}>变量未声明默认值时请填写后再预览；最终内容仍由服务端校验和渲染。</span>
      </section>
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
              <HGInputPage value={sendForm.variables[name] ?? ""} maxLength={rule.max_length || 256}
                onChange={(event) => this.changeVariable(name, event.target.value)} />
              <span className={styles.fieldHint}>
                纯文本 · 最长 {rule.max_length || 256} 字符
              </span>
            </label>
          ))}
        </div>
        <span className={styles.fieldHint}>
          变量值对所有接收人相同；目前不读取或合并用户昵称等个人资料。请勿填写密码、验证码或令牌。
        </span>
      </div>
    );
  };

  /** 发送通知任务卡片：模板下拉单选、接收范围、变量填写与发送时间；模板进入页面时自动读取。 */
  renderSendSection = () => {
    const { templates, templatesLoading, sendForm, lastTaskResult, sending, previewOpen, templateCursor } = this.state;
    const template = this.getSelectedTemplate();
    const templateOptions = templates.filter(HGNotifyChannelVM.isSendable).map((item) => ({
      value: item.templateId,
      label: `${item.titleTemplate}（${item.templateCode} · v${item.version}）`,
    }));
    const templatePlaceholder = templatesLoading
      ? "正在读取模板…"
      : templateOptions.length
        ? "选择已发布站内模板"
        : "暂无可发送模板，可刷新重试或由另一位管理员发布";
    return (
      <HGCardPage
        title="发送通知任务"
        extra={
          <span className={styles.cardExtraText}>
             仅选择当前已发布的纯站内模板，投递 1–100 位明确用户；营销与定时任务需另一人审批
          </span>
        }
      >
        {template ? this.renderSelectedTemplate(template) : null}
        <div className={styles.sendGrid}>
          <label className={styles.fullField}>
            通知模板（单选）
            <div className={styles.templatePickerRow}>
              <HGSelectPage
                className={styles.templateSelect}
                value={sendForm.templateId || undefined}
                options={templateOptions}
                disabled={templatesLoading || sending || previewOpen}
                placeholder={templatePlaceholder}
                onChange={(value) => this.handleSelectTemplate(value)}
              />
              <HGButtonPage size="small" loading={templatesLoading} disabled={sending || previewOpen}
                onClick={() => this.handleQueryTemplates()}>
                刷新模板
              </HGButtonPage>
              {templateCursor ? <HGButtonPage size="small" loading={templatesLoading}
                onClick={() => this.hgLoadMoreTemplates(true)}>加载更多</HGButtonPage> : null}
            </div>
            <span className={styles.fieldHint}>
              {templatesLoading
                ? "正在读取服务端模板…"
                : templates.length
                  ? `已读取 ${templates.length} 个模板，符合发送要求 ${templateOptions.length} 个；仅已发布纯站内模板可选。`
                  : "尚未读取到模板，可点击“刷新模板”重试。"}
            </span>
          </label>
          <label>
            发送时间
            <HGSelectPage value={sendForm.scheduleType}
              options={[{ value: "immediate", label: "立即发送" }, { value: "scheduled", label: "定时发送（需审批）" }]}
              onChange={(value) => this.changeSendForm("scheduleType", value)} />
          </label>
          {sendForm.scheduleType === "scheduled" ? (
            <label>
              定时发送时间（本地时间，未来 30 天内）
              <input className={styles.datetimeInput} type="datetime-local" value={sendForm.scheduledAt}
                onChange={(event) => this.changeSendForm("scheduledAt", event.target.value)} />
            </label>
          ) : null}
          {this.renderAudienceFields()}
          {template ? this.renderVariableFields(template) : null}
        </div>

        <div className={styles.sendActions}>
          <HGButtonPage type="primary" disabled={!template}
            onClick={this.handlePreviewSend}>
            预览并确认发送
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
        <div className={styles.warningBar}>发送后无法撤回已入箱的通知；请确认接收人和文案均已审核。</div>
        <div className={styles.previewCard}>
          <div className={styles.previewHead}>
            <span className={styles.previewCategory}>
              {TEMPLATE_CATEGORY_LABELS[template.category] || template.category}
            </span>
            <span className={styles.previewTime}>
              {sendForm.scheduleType === "scheduled" ? sendForm.scheduledAt.replace("T", " ") : "立即发送"}
            </span>
          </div>
          <h4 className={styles.previewTitle}>{this.renderPreviewText(rendered.title)}</h4>
          <p className={styles.previewBody}>{this.renderPreviewText(rendered.content)}</p>
          <span className={styles.previewFoot}>MLC 平台官方通知</span>
        </div>
        <ul className={styles.previewMeta}>
          <li>模板：{template.templateName}（{template.templateCode} · v{template.version}）</li>
          <li>投递渠道：{template.channels.join(" + ") || "未声明"}</li>
          <li>接收范围：指定用户（{payload.userIds.length} 人）</li>
          <li>发送方式：{sendForm.scheduleType === "scheduled"
            ? `定时 ${sendForm.scheduledAt.replace("T", " ")}（本地时间）` : "立即投递"}；仅站内信</li>
          <li>审批：{template.category === "marketing" || sendForm.scheduleType === "scheduled"
            ? "需另一名管理员批准后才会调度" : "模板已双人发布，系统类任务创建后直接调度"}</li>
        </ul>
        <p className={styles.formFooter}>
          预览由浏览器本地渲染，正式内容以服务端为准；网络结果不明时保留本次幂等键重试。
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
    if (this.props.hgView === "send") {
      return (
        <div className={styles.container}>
          <div className={styles.hero}>
            <div className={styles.heroMain}>
              <span className={styles.heroTag}>NOTIFICATION / SEND TASKS</span>
              <h2 className={styles.heroTitle}>发送通知</h2>
              <p className={styles.heroDesc}>选择已发布的站内模板，预览后向明确指定的用户创建发送任务；营销和定时任务须由另一名管理员审批。</p>
            </div>
            {this.hgCan(HG_PERMISSIONS.NOTIFICATION_SEND_READ) ? (
              <div className={styles.heroSide}>
                <HGButtonPage onClick={() => this.props.pushPage?.("system_notify_send_records")}>本人发送记录</HGButtonPage>
              </div>
            ) : null}
          </div>
          {this.renderSendSection()}
          {this.renderPublishSection()}
          {this.renderApprovalSection()}
          {this.renderRecipientPicker()}
          {this.renderSendPreviewModal()}
        </div>
      );
    }
    if (this.props.hgView === "records") {
      return (
        <div className={styles.container}>
          <div className={styles.hero}>
            <div className={styles.heroMain}>
              <span className={styles.heroTag}>NOTIFICATION / MY TASKS</span>
              <h2 className={styles.heroTitle}>本人发送记录</h2>
              <p className={styles.heroDesc}>仅展示当前管理员创建的任务；已处理数量不等于实际送达或阅读。</p>
            </div>
            <div className={styles.heroSide}>
              <HGButtonPage onClick={() => this.props.onBack?.()}>返回发送通知</HGButtonPage>
            </div>
          </div>
          {this.renderTaskList()}
          {this.renderTaskSection()}
        </div>
      );
    }
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
