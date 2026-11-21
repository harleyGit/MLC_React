import React from "react";
import HGCollectionView from "../../../../components/hg_collection_view/hg_collection_view";
import { hgMessage } from "../../../../components/hg_message/hg_message_page";
import { hgEvaluateAccess } from "../../../../modules/iam/hg_access_evaluator";
import { HGIAMContext } from "../../../../modules/iam/hg_iam_provider";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
import styles from "./hg_system_notify_template.module.css";
import HGSystemNotifyTemplateVM, { HG_EMPTY_TEMPLATE } from "./hg_system_notify_template_vm";
import {
  hgCreateVariableEntry,
  hgPreviewSampleValues,
  hgPreviewText,
  hgTemplatePayload,
  hgTemplateToForm,
  hgUnknownPlaceholders,
} from "./hg_template_form.js";
import { hgFullTemplateDraft } from "./hg_full_template_draft.js";
import { hgRoleUpdateTemplateDraft } from "./hg_role_update_template.js";

const HG_CATEGORIES = Object.freeze([
  ["system", "系统"],
  ["security", "安全"],
  ["transaction", "交易"],
  ["content", "内容"],
  ["social", "社交"],
  ["announcement", "公告"],
  ["marketing", "营销"],
]); // 模板分类枚举与服务端一致，列表仅展示服务端已有模板。

const HG_ACTION_TYPES = Object.freeze([
  ["none", "无跳转"],
  ["order_detail", "订单详情"],
  ["security_center", "安全中心"],
  ["announcement_detail", "公告详情"],
  ["video_detail", "视频详情"],
  ["product_detail", "商品详情"],
]); // 点击行为枚举与服务端一致；除 none 外可搭配点击配置跳转。

const HG_VARIABLE_TYPES = Object.freeze([
  ["string", "字符串"],
  ["number", "数字"],
  ["bool", "布尔"],
]); // 变量类型枚举；仅前端展示文案不同，最终校验在服务端。

const HG_CHANNEL_OPTIONS = Object.freeze([
  ["in_app", "站内信（消息中心）"],
  ["realtime", "实时推送"],
]); // 已知投递渠道；服务端返回的其他渠道以可移除标签展示。

/** 真实消息预览的铃铛图标路径，与消息中心通知图标同形，仅用于本页预览。 */
const HG_PREVIEW_BELL_PATH =
  "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z";

/** 系统通知模板管理页：角色更新模板由管理员显式发布，实际通知发送由服务端完成。 */
export default class HGSystemNotifyTemplatePage extends React.Component {
  static contextType = HGIAMContext;
  static defaultProps = {
    // 运维布局传入的路由位置；当前页不依赖路由状态，缺省不作导航。
    location: undefined,
    // 父页面菜单切换回调；此页不主动切换，缺省不调用。
    onMenuSelect: undefined,
    // 父布局的隐藏子页入口；此页使用本地表单，缺省不调用。
    pushPage: undefined,
    // 父布局返回动作；本地编辑关闭无需触发路由后退。
    onBack: undefined,
    // 当前菜单标识；缺省不用于模板查询。
    selectedKey: undefined,
  };

  state = {
    hgItems: [], // 已读取的模板卡片；初始空数组，刷新时替换而非混入其他分页。
    hgCursor: "", // 下一页数据库主键游标；空字符串表示没有更多记录。
    hgLoading: false, // 列表请求中为 true，避免重复翻页。
    hgLoaded: false, // 是否完成首次列表请求；用于区分加载和空列表。
    hgError: "", // 当前列表/详情/保存失败提示；空字符串表示无错误。
    hgEditing: false, // 是否展示编辑器；false 时展示 HGCollectionView。
    hgEditingID: "", // 当前编辑的服务端模板 ID；空字符串表示创建。
    hgForm: { ...HG_EMPTY_TEMPLATE }, // 当前受控表单，编辑时必须先从详情回填。
    hgOriginal: "", // 最近一次加载的表单序列化结果；空字符串仅表示未开始编辑。
    hgSaving: false, // 保存请求进行中，阻止重复提交和关闭。
    hgOpening: false, // 正在拉取详情；成功前不能编辑或覆盖当前表单。
  };

  hgMounted = false; // 挂载生命周期标记；卸载后不再写入状态。
  hgSequence = 0; // 列表/详情请求代数，刷新及离开时丢弃过期响应。

  componentDidMount() {
    this.hgMounted = true;
    window.addEventListener("beforeunload", this.hgBeforeUnload);
    this.hgLoad(true);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.hgBeforeUnload);
    this.hgMounted = false;
    this.hgSequence += 1;
  }

  /** 浏览器刷新或关闭时保护未保存表单；父布局 SPA 导航另行处理。 */
  hgBeforeUnload = (event) => {
    if (
      !this.state.hgEditing ||
      JSON.stringify(this.state.hgForm) === this.state.hgOriginal
    )
      return;
    event.preventDefault();
    event.returnValue = "";
  };

  /** 以 IAM 快照仅控制按钮可见性；真正授权始终由服务端执行。 */
  hgCan = (permission) =>
    hgEvaluateAccess(this.context?.snapshot, { permission }).allowed;

  /** 按主键游标加载；刷新重置请求代数，旧响应不能覆盖新列表。 */
  hgLoad = async (refresh = false) => {
    if (!refresh && (this.state.hgLoading || !this.state.hgCursor)) return;
    const sequence = refresh ? ++this.hgSequence : this.hgSequence; // 同一页流使用同一个代数。
    const cursor = refresh ? "" : this.state.hgCursor; // 首页无游标，下一页保持原样。
    this.setState({ hgLoading: true, hgError: "" });
    try {
      const result = await HGSystemNotifyTemplateVM.list(cursor);
      if (!this.hgMounted || sequence !== this.hgSequence) return;
      this.setState((state) => ({
        hgItems: refresh ? result.list : [...state.hgItems, ...result.list],
        hgCursor: result.nextCursor || "",
        hgLoaded: true,
        hgLoading: false,
      }));
    } catch (error) {
      if (this.hgMounted && sequence === this.hgSequence) {
        this.setState({
          hgLoading: false,
          hgLoaded: true,
          hgError: HGSystemNotifyTemplateVM.errorMessage(error),
        });
      }
    }
  };

  /**
   * 创建页仅准备草稿；预设须由管理员确认并点击创建才会调用后端。
   * 普通新建默认预填最全示例模板供创建者删改；角色更新模板保留专用预设。
   */
  hgCreate = (roleUpdate = false) => {
    const form = roleUpdate
      ? hgRoleUpdateTemplateDraft(HG_EMPTY_TEMPLATE)
      : hgFullTemplateDraft(HG_EMPTY_TEMPLATE); // 预设仅是表单初始值，绝不当作服务端已有数据。
    this.setState({
      hgEditing: true,
      hgEditingID: "",
      hgForm: form,
      hgOriginal: JSON.stringify(form),
      hgError: "",
    });
  };

  /** 编辑必须重新读取详情及当前版本，不能使用卡片快照回填或把旧记录当新建。 */
  hgOpen = async (item) => {
    const sequence = ++this.hgSequence; // 打开另一条记录时淘汰旧详情请求。
    this.setState({ hgOpening: true, hgError: "" });
    try {
      const detail = await HGSystemNotifyTemplateVM.detail(item.id);
      if (!this.hgMounted || sequence !== this.hgSequence) return;
      const form = hgTemplateToForm(detail); // 与服务端当前版本一一对应的受控数据。
      this.setState({
        hgOpening: false,
        hgEditing: true,
        hgEditingID: detail.id,
        hgForm: form,
        hgOriginal: JSON.stringify(form),
      });
    } catch (error) {
      if (this.hgMounted && sequence === this.hgSequence) {
        this.setState({
          hgOpening: false,
          hgError: HGSystemNotifyTemplateVM.errorMessage(error),
        });
      }
    }
  };

  /** 未保存的表单离开前确认；请求中禁止退出以免用户误判保存结果。 */
  hgClose = () => {
    if (this.state.hgSaving) return;
    if (
      JSON.stringify(this.state.hgForm) !== this.state.hgOriginal &&
      !window.confirm("修改尚未保存，确定返回列表吗？")
    )
      return;
    this.hgSequence += 1;
    this.setState({ hgEditing: false, hgEditingID: "", hgError: "" });
    this.hgLoad(true);
  };

  /** 受控输入始终保留尚未提交的用户编辑，不在异步返回时局部覆盖。 */
  hgChange = (field, value) =>
    this.setState((state) => ({
      hgForm: { ...state.hgForm, [field]: value },
      hgError: "",
    }));

  /** 修改变量配置某一行的字段；index 对应当前行，保持其余行引用不变。 */
  hgChangeVariable = (index, field, value) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        variables_schema: state.hgForm.variables_schema.map((entry, i) =>
          i === index ? { ...entry, [field]: value } : entry
        ),
      },
      hgError: "",
    }));

  /** 「增加变量」追加一条空白配置行；真正写入服务端仍由保存动作触发。 */
  hgAddVariable = () =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        variables_schema: [...state.hgForm.variables_schema, hgCreateVariableEntry()],
      },
      hgError: "",
    }));

  /** 删除变量配置行；仅影响本地草稿，未保存前可关闭编辑器放弃。 */
  hgRemoveVariable = (index) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        variables_schema: state.hgForm.variables_schema.filter((_, i) => i !== index),
      },
      hgError: "",
    }));

  /** 修改点击配置的顶层字段（当前为 route_name）；params 单独按行维护。 */
  hgChangeActionConfig = (patch) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        action_config: { ...state.hgForm.action_config, ...patch },
      },
      hgError: "",
    }));

  /** 修改某个路由参数的键或值；index 对应当前行。 */
  hgChangeActionParam = (index, field, value) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        action_config: {
          ...state.hgForm.action_config,
          params: state.hgForm.action_config.params.map((param, i) =>
            i === index ? { ...param, [field]: value } : param
          ),
        },
      },
      hgError: "",
    }));

  /** 「增加参数」追加一条空白路由参数行。 */
  hgAddActionParam = () =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        action_config: {
          ...state.hgForm.action_config,
          params: [...state.hgForm.action_config.params, { key: "", value: "" }],
        },
      },
      hgError: "",
    }));

  /** 删除某条路由参数行。 */
  hgRemoveActionParam = (index) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        action_config: {
          ...state.hgForm.action_config,
          params: state.hgForm.action_config.params.filter((_, i) => i !== index),
        },
      },
      hgError: "",
    }));

  /** 勾选或取消投递渠道；全部取消时由保存动作的本地校验拦截。 */
  hgToggleChannel = (key) =>
    this.setState((state) => ({
      hgForm: {
        ...state.hgForm,
        channels: state.hgForm.channels.includes(key)
          ? state.hgForm.channels.filter((channel) => channel !== key)
          : [...state.hgForm.channels, key],
      },
      hgError: "",
    }));

  /** 保存时对结构化配置做本地形态校验；后端重新验证占位符、渠道及权限。 */
  hgSave = async (event) => {
    event.preventDefault();
    if (this.state.hgSaving) return;
    const { hgForm, hgEditingID } = this.state;
    let body;
    try {
      body = hgTemplatePayload(hgForm, Boolean(hgEditingID));
    } catch (error) {
      this.setState({ hgError: error.message });
      return;
    }
    this.setState({ hgSaving: true, hgError: "" });
    try {
      if (hgEditingID) await HGSystemNotifyTemplateVM.update(hgEditingID, body);
      else await HGSystemNotifyTemplateVM.create(body);
      if (!this.hgMounted) return;
      hgMessage.success(hgEditingID ? "已生成新草稿版本" : "已创建模板草稿");
      this.setState({
        hgEditing: false,
        hgEditingID: "",
        hgSaving: false,
        hgError: "",
      });
      await this.hgLoad(true);
    } catch (error) {
      if (this.hgMounted)
        this.setState({
          hgSaving: false,
          hgError: HGSystemNotifyTemplateVM.errorMessage(error),
        });
    }
  };

  /** 删除只作用于当前版本的未发布草稿；冲突时提醒刷新，不自动重试。 */
  hgDelete = async (item) => {
    if (!window.confirm(`确定删除模板「${item.name}」？历史版本会保留。`))
      return;
    try {
      await HGSystemNotifyTemplateVM.delete(item.id, item.version);
      if (!this.hgMounted) return;
      hgMessage.success("模板草稿已删除");
      this.hgLoad(true);
    } catch (error) {
      if (this.hgMounted)
        this.setState({
          hgError: HGSystemNotifyTemplateVM.errorMessage(error),
        });
    }
  };

  /** 发布前读取最新版本，避免把已变更的草稿误发布为另一版本。 */
  hgPublish = async (item) => {
    if (!window.confirm(`发布角色更新模板「${item.name}」的 v${item.version}？`)) return;
    try {
      await HGSystemNotifyTemplateVM.publish(item.id, item.version);
      if (!this.hgMounted) return;
      hgMessage.success("角色更新模板已发布");
      this.hgLoad(true);
    } catch (error) {
      if (this.hgMounted) this.setState({ hgError: HGSystemNotifyTemplateVM.errorMessage(error) });
    }
  };

  /** 使用稳定模板 ID 渲染卡片；从未发布版本才可显示删除入口。 */
  hgRenderCard = (item) => (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <strong>{item.name}</strong>
        <span>
          {item.category} · {item.status} · v{item.version}
        </span>
      </div>
      <p className={styles.code}>{item.template_code}</p>
      <p>{item.title_template}</p>
      <p className={styles.body}>{item.body_template}</p>
        <div className={styles.actions}>
        {item.template_code === "iam.role.updated" &&
          item.published_version !== item.version &&
          this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE) && (
            <button type="button" onClick={() => this.hgPublish(item)}>发布当前版本</button>
          )}
        {!this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE) && (
          <button
            type="button"
            onClick={() => this.hgOpen(item)}
            disabled={this.state.hgOpening}
          >
            查看详情
          </button>
        )}
        {this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE) && (
          <button
            type="button"
            onClick={() => this.hgOpen(item)}
            disabled={this.state.hgOpening}
          >
            编辑
          </button>
        )}
        {item.status === "draft" &&
          item.published_version == null &&
          this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_DELETE) && (
            <button
              type="button"
              className={styles.danger}
              onClick={() => this.hgDelete(item)}
            >
              删除草稿
            </button>
          )}
      </div>
    </article>
  );

  /** 列表由 HGCollectionView 承载，所有分页、错误及刷新由页面维护。 */
  hgRenderList = () => (
    <>
      <div className={styles.header}>
        <div>
          <h2>系统通知模板</h2>
          <p>角色更新通知可显式发布；发布后服务端按已发布版本生成系统消息。</p>
        </div>
        {this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_CREATE) && (
          <div className={styles.actions}>
            <button type="button" onClick={() => this.hgCreate(true)}>
              创建角色更新模板
            </button>
            <button type="button" className={styles.primary} onClick={() => this.hgCreate()}>
              新建模板
            </button>
          </div>
        )}
      </div>
      {this.state.hgError && (
        <p role="alert" className={styles.error}>
          {this.state.hgError}
        </p>
      )}
      {this.state.hgError && (
        <button type="button" onClick={() => this.hgLoad(true)}>
          重试加载
        </button>
      )}
      {!this.state.hgLoaded && this.state.hgLoading ? (
        <p>正在加载模板...</p>
      ) : (
        <HGCollectionView
          items={this.state.hgItems}
          getKey={(item) => item.id}
          renderCell={this.hgRenderCard}
          fillHeight={false}
          align="left"
          ariaLabel="系统通知模板列表"
          emptyText="暂无模板"
          loadedText="已加载全部模板"
          loading={this.state.hgLoading}
          hasMore={Boolean(this.state.hgCursor && !this.state.hgError)}
          onLoadMore={() => this.hgLoad()}
          onRefresh={() => this.hgLoad(true)}
        />
      )}
    </>
  );

  /** 编辑字段为受控输入；基础字段用文本/下拉输入，结构化配置由专属编辑器维护。 */
  hgRenderField = (label, field, options = {}) => {
    const value = this.state.hgForm[field]; // 当前编辑值；空字符串为未填写。
    const id = `hg-template-${field}`; // 表单 label 可访问锚点，字段名固定。
    return (
      <div className={styles.field} key={field}>
        <label htmlFor={id}>{label}</label>
        {options.select ? (
          <select
            id={id}
            value={value}
            onChange={(e) => this.hgChange(field, e.target.value)}
          >
            {options.select.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        ) : options.multiline ? (
          <textarea
            id={id}
            rows={options.rows || 3}
            value={value}
            onChange={(e) => this.hgChange(field, e.target.value)}
          />
        ) : (
          <input
            id={id}
            type={options.number ? "number" : "text"}
            min={options.number ? 1 : undefined}
            max={options.number ? 3 : undefined}
            maxLength={options.maxLength}
            readOnly={
              (!this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE) &&
                Boolean(this.state.hgEditingID)) ||
              (field === "template_code" && Boolean(this.state.hgEditingID))
            }
            value={value}
            onChange={(e) =>
              this.hgChange(
                field,
                options.number ? Number(e.target.value) : e.target.value
              )
            }
          />
        )}
      </div>
    );
  };

  /**
   * 变量配置编辑器：每条变量一行，全部通过「增加变量」按钮追加、逐行删除，
   * 不再以 JSON 文本编辑；行内容完全受控，行索引即可作为渲染 key。
   * @param {boolean} locked 无更新权限查看既有模板时禁用全部控件。
   */
  hgRenderVariablesEditor = (locked) => {
    const { variables_schema } = this.state.hgForm;
    return (
      <div className={styles.configBlock}>
        <div className={styles.configHead}>
          <div>
            <strong>变量配置</strong>
            <p>标题与正文中的 {"{{占位符}}"} 必须在此声明；点击「增加变量」逐条配置。</p>
          </div>
          <button type="button" onClick={this.hgAddVariable} disabled={locked}>
            增加变量
          </button>
        </div>
        {variables_schema.length === 0 ? (
          <p className={styles.configEmpty}>暂无变量配置；模板未使用占位符时可不配置。</p>
        ) : (
          variables_schema.map((entry, index) => (
            <div className={styles.configRow} key={index}>
              <label className={styles.configCell}>
                <span>变量名</span>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="如 user_name"
                  value={entry.name}
                  disabled={locked}
                  onChange={(e) => this.hgChangeVariable(index, "name", e.target.value)}
                />
              </label>
              <label className={styles.configCell}>
                <span>类型</span>
                <select
                  value={entry.type}
                  disabled={locked}
                  onChange={(e) => this.hgChangeVariable(index, "type", e.target.value)}
                >
                  {HG_VARIABLE_TYPES.map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.configCellCheck}>
                <input
                  type="checkbox"
                  checked={entry.required}
                  disabled={locked}
                  onChange={(e) => this.hgChangeVariable(index, "required", e.target.checked)}
                />
                <span>必填</span>
              </label>
              <label className={styles.configCell}>
                <span>最大长度</span>
                <input
                  type="number"
                  min={1}
                  value={entry.max_length}
                  disabled={locked}
                  onChange={(e) =>
                    this.hgChangeVariable(
                      index,
                      "max_length",
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                />
              </label>
              <label className={styles.configCell}>
                <span>说明</span>
                <input
                  type="text"
                  maxLength={128}
                  placeholder="用途说明，可留空"
                  value={entry.description}
                  disabled={locked}
                  onChange={(e) => this.hgChangeVariable(index, "description", e.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.danger}
                disabled={locked}
                onClick={() => this.hgRemoveVariable(index)}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    );
  };

  /**
   * 点击配置编辑器：route_name 输入框 + 路由参数键值对逐行增删，
   * 不再以 JSON 文本编辑；action_type 为「无跳转」时可不配置。
   * @param {boolean} locked 无更新权限查看既有模板时禁用全部控件。
   */
  hgRenderActionConfigEditor = (locked) => {
    const { action_type, action_config } = this.state.hgForm;
    return (
      <div className={styles.configBlock}>
        <div className={styles.configHead}>
          <div>
            <strong>点击配置</strong>
            <p>
              {action_type === "none"
                ? "点击行为为「无跳转」时无需配置。"
                : "route_name 为内部路由名；参数值可引用已声明的变量，投递时由服务端填充。"}
            </p>
          </div>
          <button type="button" onClick={this.hgAddActionParam} disabled={locked}>
            增加参数
          </button>
        </div>
        <div className={styles.configRouteRow}>
          <label className={styles.configCell}>
            <span>route_name（内部路由名）</span>
            <input
              type="text"
              maxLength={100}
              placeholder="如 order_detail"
              value={action_config.route_name}
              disabled={locked}
              onChange={(e) => this.hgChangeActionConfig({ route_name: e.target.value })}
            />
          </label>
        </div>
        {action_config.params.length === 0 ? (
          <p className={styles.configEmpty}>暂无路由参数；目标页无需参数时可不配置。</p>
        ) : (
          action_config.params.map((param, index) => (
            <div className={styles.configRow} key={index}>
              <label className={styles.configCell}>
                <span>参数名</span>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="如 order_no"
                  value={param.key}
                  disabled={locked}
                  onChange={(e) => this.hgChangeActionParam(index, "key", e.target.value)}
                />
              </label>
              <label className={styles.configCell}>
                <span>参数值（可含 {"{{变量}}"}）</span>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="如 {{order_no}}"
                  value={param.value}
                  disabled={locked}
                  onChange={(e) => this.hgChangeActionParam(index, "value", e.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.danger}
                disabled={locked}
                onClick={() => this.hgRemoveActionParam(index)}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    );
  };

  /**
   * 投递渠道编辑器：已知渠道以复选标签勾选；
   * 服务端返回的其他渠道以可移除标签展示，不再以 JSON 文本编辑。
   * @param {boolean} locked 无更新权限查看既有模板时禁用全部控件。
   */
  hgRenderChannelsEditor = (locked) => {
    const { channels } = this.state.hgForm;
    const extraChannels = channels.filter(
      (channel) => !HG_CHANNEL_OPTIONS.some(([key]) => key === channel)
    );
    return (
      <div className={styles.configBlock}>
        <div className={styles.configHead}>
          <div>
            <strong>投递渠道</strong>
            <p>至少选择一个渠道；站内信持久化到消息中心，实时推送经实时通道下发。</p>
          </div>
        </div>
        <div className={styles.channelRow}>
          {HG_CHANNEL_OPTIONS.map(([key, label]) => (
            <label key={key} className={styles.channelOption}>
              <input
                type="checkbox"
                checked={channels.includes(key)}
                disabled={locked}
                onChange={() => this.hgToggleChannel(key)}
              />
              <span>{label}</span>
            </label>
          ))}
          {extraChannels.map((channel) => (
            <span key={channel} className={styles.channelExtra}>
              {channel}
              <button
                type="button"
                disabled={locked}
                onClick={() => this.hgToggleChannel(channel)}
              >
                移除
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 真实消息预览：按消息中心通知卡片的实际形态渲染当前草稿，
   * 变量以示例值填充、未声明占位符高亮提示；预览不发起请求，最终内容以服务端投递为准。
   */
  hgRenderPreview = () => {
    const { hgForm } = this.state;
    const samples = hgPreviewSampleValues(hgForm); // 已声明变量的名称 → 示例值。
    const title = hgPreviewText(hgForm.title_template, samples); // 标题预览文本；未声明占位符原样保留。
    const body = hgPreviewText(hgForm.body_template, samples); // 正文预览文本。
    const unknown = hgUnknownPlaceholders(hgForm); // 标题/正文中未声明的占位符，用于告警。
    const categoryLabel =
      HG_CATEGORIES.find(([key]) => key === hgForm.category)?.[1] || hgForm.category;
    const actionLabel =
      HG_ACTION_TYPES.find(([key]) => key === hgForm.action_type)?.[1] || hgForm.action_type;
    const routeName = String(hgForm.action_config?.route_name || "").trim();
    return (
      <section className={styles.preview} aria-label="真实消息预览">
        <div className={styles.previewHead}>
          <h3>真实消息预览</h3>
          <p>
            按消息中心通知卡片的实际形态展示当前草稿；变量使用示例值填充，最终内容以服务端投递为准。
          </p>
        </div>
        <article className={styles.previewCard}>
          <span className={styles.previewAvatar} aria-hidden="true">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" focusable="false">
              <path d={HG_PREVIEW_BELL_PATH} />
            </svg>
          </span>
          <div className={styles.previewMain}>
            <div className={styles.previewTitleRow}>
              <strong>{title || "（未填写标题模板）"}</strong>
              <i className={styles.previewUnread} title="未读标记" />
            </div>
            <p className={styles.previewBody}>{body || "（未填写正文模板）"}</p>
            <div className={styles.previewMeta}>
              <span>刚刚</span>
              <span className={styles.previewTag}>{categoryLabel}</span>
              {hgForm.channels.map((channel) => (
                <span className={styles.previewTag} key={channel}>
                  {HG_CHANNEL_OPTIONS.find(([key]) => key === channel)?.[1] || channel}
                </span>
              ))}
              <span className={styles.previewTag}>优先级 P{hgForm.priority}</span>
            </div>
            {hgForm.action_type !== "none" && (
              <p className={styles.previewAction}>
                点击查看{actionLabel}
                {routeName ? `（route: ${routeName}）` : ""}
              </p>
            )}
          </div>
        </article>
        {unknown.length > 0 && (
          <p role="alert" className={styles.previewWarn}>
            标题或正文使用了未声明的变量：{unknown.join("、")}，请在变量配置中补齐后再保存。
          </p>
        )}
      </section>
    );
  };

  hgRenderEditor = () => {
    const editing = Boolean(this.state.hgEditingID); // 有 ID 时 PUT 对现有模板追加版本，绝不 POST 新建。
    const locked =
      !this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE) && editing; // 查看者只能读既有模板，不可改配置。
    return (
      <form onSubmit={this.hgSave} className={styles.editor}>
        <div className={styles.header}>
          <h2>{editing ? "编辑系统通知模板" : "新建系统通知模板"}</h2>
          <button
            type="button"
            onClick={this.hgClose}
            disabled={this.state.hgSaving}
          >
            返回列表
          </button>
        </div>
        <p>
          保存仅生成草稿；角色更新模板需单独发布，发送时只使用已发布版本。
          {!editing && " 新建已预填最全示例模板，请按业务修改编码、变量与正文。"}
        </p>
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}
          </p>
        )}
        <div className={styles.grid}>
          {this.hgRenderField("模板编码", "template_code", { maxLength: 100 })}
          {this.hgRenderField("模板名称", "name", { maxLength: 128 })}
          {this.hgRenderField("通知分类", "category", {
            select: HG_CATEGORIES,
          })}
          {this.hgRenderField("标题模板", "title_template", { maxLength: 200 })}
          {this.hgRenderField("正文模板（纯文本）", "body_template", {
            multiline: true,
            rows: 5,
          })}
          {this.hgRenderField("点击行为", "action_type", {
            select: HG_ACTION_TYPES,
          })}
          {this.hgRenderField("优先级（1-3）", "priority", { number: true })}
          <div className={styles.gridFull}>{this.hgRenderVariablesEditor(locked)}</div>
          <div className={styles.gridFull}>{this.hgRenderActionConfigEditor(locked)}</div>
          <div className={styles.gridFull}>{this.hgRenderChannelsEditor(locked)}</div>
        </div>
        {(!editing ||
          this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_UPDATE)) && (
          <button
            type="submit"
            className={styles.primary}
            disabled={this.state.hgSaving}
          >
            {this.state.hgSaving
              ? "保存中..."
              : editing
              ? "保存为新草稿版本"
              : "创建草稿"}
          </button>
        )}
        {this.hgRenderPreview()}
      </form>
    );
  };

  render() {
    return (
      <section className={styles.page}>
        {this.state.hgEditing ? this.hgRenderEditor() : this.hgRenderList()}
      </section>
    );
  }
}
