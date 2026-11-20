import React from "react";
import HGCollectionView from "../../../../components/hg_collection_view/hg_collection_view";
import { hgMessage } from "../../../../components/hg_message/hg_message_page";
import { hgEvaluateAccess } from "../../../../modules/iam/hg_access_evaluator";
import { HGIAMContext } from "../../../../modules/iam/hg_iam_provider";
import { HG_PERMISSIONS } from "../../../../modules/iam/hg_permission_codes";
import styles from "./hg_system_notify_template.module.css";
import HGSystemNotifyTemplateVM, { HG_EMPTY_TEMPLATE } from "./hg_system_notify_template_vm";
import { hgTemplatePayload, hgTemplateToForm } from "./hg_template_form.js";

const HG_CATEGORIES = Object.freeze([
  ["system", "系统"],
  ["security", "安全"],
  ["transaction", "交易"],
  ["content", "内容"],
  ["social", "社交"],
  ["announcement", "公告"],
  ["marketing", "营销"],
]); // 模板分类枚举与服务端一致，列表仅展示服务端已有模板。

/** 系统通知模板管理页：管理草稿，不负责通知发送及线上发布。 */
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

  /** 创建表单只设置空模板；没有从示例数据填充或写入数据库。 */
  hgCreate = () => {
    const form = { ...HG_EMPTY_TEMPLATE }; // 新建默认仅选枚举与空 JSON，无业务正文。
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

  /** 保存时对 JSON 作本地形态校验；后端重新验证占位符、渠道及权限。 */
  hgSave = async (event) => {
    event.preventDefault();
    if (this.state.hgSaving) return;
    const { hgForm, hgEditingID } = this.state;
    let body;
    try {
      body = hgTemplatePayload(hgForm, Boolean(hgEditingID));
    } catch (error) {
      this.setState({
        hgError:
          error instanceof SyntaxError
            ? "JSON 格式错误，请核对变量、点击配置和渠道"
            : error.message,
      });
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
      this.hgLoad(true);
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
          <p>管理纯文本模板草稿；发送、审核和发布尚未开放。</p>
        </div>
        {this.hgCan(HG_PERMISSIONS.NOTIFICATION_TEMPLATE_CREATE) && (
          <button
            type="button"
            className={styles.primary}
            onClick={this.hgCreate}
          >
            新建模板
          </button>
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

  /** 编辑字段为受控输入；JSON 采用文本编辑以保持变量与跳转协议完整可回填。 */
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

  hgRenderEditor = () => {
    const editing = Boolean(this.state.hgEditingID); // 有 ID 时 PUT 对现有模板追加版本，绝不 POST 新建。
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
        <p>仅保存草稿。编辑会创建新版本，模板编码不可更改；不发送通知。</p>
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
          {this.hgRenderField(
            "变量定义 JSON（占位符须声明）",
            "variables_schema",
            { multiline: true, rows: 5 }
          )}
          {this.hgRenderField("点击行为", "action_type", {
            select: Object.keys({
              none: 1,
              order_detail: 1,
              security_center: 1,
              announcement_detail: 1,
              video_detail: 1,
              product_detail: 1,
            }).map((key) => [key, key]),
          })}
          {this.hgRenderField(
            "点击配置 JSON（内部 route_name / params）",
            "action_config",
            { multiline: true }
          )}
          {this.hgRenderField("渠道 JSON（in_app、realtime）", "channels")}
          {this.hgRenderField("优先级（1-3）", "priority", { number: true })}
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
