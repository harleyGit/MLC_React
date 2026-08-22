import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGInputPage, {
  HGInputTextArea,
} from "../../../components/hg_input/hg_input_page";
import HGInputNumberPage from "../../../components/hg_input_number/hg_input_number_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGRadioGroup from "../../../components/hg_radio/hg_radio_page";
import HGSelectPage from "../../../components/hg_select/hg_select_page";
import styles from "./hg_task_create_page.module.css";
import HGTaskCreateVM, { HG_TASK_INITIAL_FORM } from "./hg_task_create_vm";
import {
  hgTaskRowsToObject,
  normalizeHGTaskFieldName,
} from "./hg_task_payload";

const HG_TASK_CANONICAL_FIELDS = new Set([
  "contentId",
  "title",
  "authorId",
  "authorName",
  "coverUrl",
  "targetUrl",
  "durationSeconds",
  "viewCount",
  "likeCount",
  "commentCount",
  "publishedAt",
]);

const nextRow = (() => {
  let id = 3;
  return () => ({ id: id++, key: "", value: "" });
})();

class HGTaskCreatePage extends Component {
  constructor(props) {
    super(props);
    const editorState = HGTaskCreateVM.toEditorState(props.pageContext?.task);
    const params = editorState?.params || [
      { id: 1, key: "fresh_type", value: "3" },
      { id: 2, key: "ps", value: "20" },
    ];
    this.state = {
      form: { ...HG_TASK_INITIAL_FORM },
      headers: [
        { id: 1, key: "User-Agent", value: "Mozilla/5.0" },
        { id: 2, key: "Accept", value: "application/json" },
      ],
      params,
      mappings: [
        { id: 1, name: "contentId", path: "$.bvid", attribute: "" },
        { id: 2, name: "title", path: "$.title", attribute: "" },
        { id: 3, name: "authorName", path: "$.owner.name", attribute: "" },
        { id: 4, name: "targetUrl", path: "$.uri", attribute: "" },
        { id: 5, name: "viewCount", path: "$.stat.view", attribute: "" },
        { id: 6, name: "commentCount", path: "$.stat.reply", attribute: "" },
      ],
      ...editorState,
      requestInput:
        (editorState?.form || HG_TASK_INITIAL_FORM).method === "GET"
          ? JSON.stringify(hgTaskRowsToObject(params), null, 2)
          : editorState?.form?.body || HG_TASK_INITIAL_FORM.body,
      testing: false,
      saving: false,
      savingAndRunning: false,
      response: null,
      detectedFields: [],
    };
  }

  setField = (key, value) =>
    this.setState((prev) => ({ form: { ...prev.form, [key]: value } }));

  /** Switches the request editor between GET query JSON and request body text. */
  setMethod = (method) =>
    this.setState((prev) => ({
      form: { ...prev.form, method },
      requestInput:
        method === "GET"
          ? JSON.stringify(hgTaskRowsToObject(prev.params), null, 2)
          : prev.form.body || "",
    }));

  /** Applies parser defaults for each source type without disabling later manual edits. */
  setCollectType = (collectType) =>
    this.setState((prev) => {
      const htmlSource = collectType !== "api";
      return {
        form: {
          ...prev.form,
          collectType,
          method: htmlSource ? "GET" : prev.form.method,
          parserType: htmlSource ? "css" : "restricted_jsonpath",
          itemSelector: htmlSource ? "body" : "$.data.item[*]",
        },
        requestInput: htmlSource ? "{}" : prev.requestInput,
      };
    });

  /** Configures the stable Bilibili detail API mapping when a BV webpage URL is entered. */
  setURL = (url) => {
    const bilibiliVideo =
      /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i.test(
        url.trim(),
      );
    this.setState((prev) => ({
      form: {
        ...prev.form,
        url,
        ...(bilibiliVideo
          ? {
              platform: "bilibili",
              collectType: "page",
              method: "GET",
              parserType: "restricted_jsonpath",
              itemSelector: "$.data",
            }
          : {}),
      },
      ...(bilibiliVideo
        ? {
            requestInput: "{}",
            mappings: [
              { id: 1, name: "contentId", path: "$.bvid", attribute: "" },
              { id: 2, name: "title", path: "$.title", attribute: "" },
              {
                id: 3,
                name: "authorName",
                path: "$.owner.name",
                attribute: "",
              },
              { id: 4, name: "coverUrl", path: "$.pic", attribute: "" },
              { id: 5, name: "viewCount", path: "$.stat.view", attribute: "" },
              { id: 6, name: "likeCount", path: "$.stat.like", attribute: "" },
              {
                id: 7,
                name: "commentCount",
                path: "$.stat.reply",
                attribute: "",
              },
            ],
          }
        : {}),
    }));
  };

  updateRow = (group, id, key, value) =>
    this.setState((prev) => ({
      [group]: prev[group].map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      ),
    }));

  addRow = (group) =>
    this.setState((prev) => ({ [group]: [...prev[group], nextRow()] }));

  removeRow = (group, id) =>
    this.setState((prev) => ({
      [group]: prev[group].filter((row) => row.id !== id),
    }));

  validate = () => {
    const {
      name,
      platform,
      url,
      method,
      parserType,
      itemSelector,
      maxItems,
      executionMode,
      cron,
    } = this.state.form;
    if (
      !name.trim() ||
      !platform.trim() ||
      (this.state.form.collectType !== "url_list" && !url.trim()) ||
      !method ||
      !parserType ||
      !itemSelector.trim()
    ) {
      message.error(
        "请填写任务名称、平台、URL、Method、解析类型和 Item Selector",
      );
      return false;
    }
    if (executionMode === "cron" && !cron.trim()) {
      message.error("定时任务必须填写 Cron 表达式");
      return false;
    }
    if (
      this.state.form.collectType === "url_list" &&
      !this.state.form.sourceUrls.trim()
    ) {
      message.error("URL 列表至少填写一个地址，每行一个");
      return false;
    }
    if (method === "GET") {
      try {
        const parsed = JSON.parse(this.state.requestInput || "{}");
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new Error();
        }
      } catch {
        message.error('GET 请求参数必须填写为 JSON 对象，例如 {"page":1}');
        return false;
      }
    }
    if (Number(maxItems) < 1 || Number(maxItems) > 50) {
      message.error("最大采集条数必须在 1 到 50 之间");
      return false;
    }
    return true;
  };

  testRequest = () => {
    if (!this.validate()) return;
    this.setState({ testing: true });
    HGTaskCreateVM.testRequest(this.state)
      .then((response) => {
        const detectedFields = response?.detectedFields || [];
        this.setState({
          response,
          detectedFields,
        });
      })
      .then(() => message.success("测试请求完成，已自动识别 JSON 字段"))
      .catch((error) =>
        message.error(getRequestErrorMessage(error, "测试请求失败")),
      )
      .finally(() => this.setState({ testing: false }));
  };

  toMappings = (fields) =>
    fields.length
      ? fields
          .map((field) => ({
            ...field,
            name: normalizeHGTaskFieldName(field.name),
          }))
          .filter((field) => HG_TASK_CANONICAL_FIELDS.has(field.name))
          .slice(0, 20)
          .map((field, index) => ({
            id: index + 1,
            name: field.name,
            path: field.path,
            attribute: "",
          }))
      : null;

  applyDetectedFields = () => {
    const mappings = this.toMappings(this.state.detectedFields);
    if (!mappings) {
      message.info("当前响应没有可识别的 JSON 叶子字段");
      return;
    }
    this.setState({ mappings });
  };

  saveTask = (runNow) => {
    if (!this.validate()) return;
    const shouldRun = runNow || this.state.form.executionMode === "once";
    const loadingKey = shouldRun ? "savingAndRunning" : "saving";
    this.setState({ [loadingKey]: true });
    HGTaskCreateVM.saveTask(this.state, shouldRun)
      .then((result) => {
        const run = result?.run;
        if (
          shouldRun &&
          run &&
          String(run.status || run.Status).toLowerCase() === "failed"
        ) {
          message.error(
            `任务已保存，但运行失败：${
              run.errorMessage || run.ErrorMessage || "未知错误"
            }`,
          );
        } else {
          message.success(shouldRun ? "任务已保存并运行完成" : "任务已保存");
        }
        this.props.onNavigate?.("crawler_tasks");
      })
      .catch((error) =>
        message.error(
          getRequestErrorMessage(
            error,
            shouldRun ? "保存并运行失败" : "保存任务失败",
          ),
        ),
      )
      .finally(() => this.setState({ [loadingKey]: false }));
  };

  renderRows = (group, rows, keyPlaceholder, valuePlaceholder) => (
    <div className={styles.rows}>
      {rows.map((row) => (
        <div className={styles.row} key={row.id}>
          <HGInputPage
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(event) =>
              this.updateRow(group, row.id, "key", event.target.value)
            }
          />
          <HGInputPage
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(event) =>
              this.updateRow(group, row.id, "value", event.target.value)
            }
          />
          <HGButtonPage
            type="text"
            danger
            onClick={() => this.removeRow(group, row.id)}
          >
            删除
          </HGButtonPage>
        </div>
      ))}
      <HGButtonPage type="default" onClick={() => this.addRow(group)}>
        添加一行
      </HGButtonPage>
    </div>
  );

  renderField = (label, child, hint) => (
    <label className={styles.field}>
      <span>{label}</span>
      {child}
      {hint ? <small>{hint}</small> : null}
    </label>
  );

  render() {
    const {
      form,
      headers,
      mappings,
      testing,
      saving,
      savingAndRunning,
      response,
      detectedFields,
    } = this.state;
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <p>CRAWLER BUILDER</p>
            <h1>{form.id ? "编辑采集任务" : "创建采集任务"}</h1>
            <span>先验证目标响应，再配置解析、调度和存储策略</span>
          </div>
          <HGButtonPage
            onClick={() => this.props.onNavigate?.("crawler_tasks")}
          >
            返回任务管理
          </HGButtonPage>
        </div>

        <HGCardPage title="① 基础信息">
          <div className={styles.grid}>
            {this.renderField(
              "任务名称",
              <HGInputPage
                value={form.name}
                onChange={(event) => this.setField("name", event.target.value)}
              />,
            )}
            {this.renderField(
              "数据源",
              <HGSelectPage
                value={form.platform}
                options={[
                  { value: "bilibili", label: "Bilibili" },
                  { value: "custom", label: "自定义 HTTP" },
                ]}
                onChange={(value) => this.setField("platform", value)}
              />,
            )}
          </div>
          {this.renderField(
            "采集类型",
            <HGRadioGroup
              value={form.collectType}
              options={[
                { value: "page", label: "页面" },
                { value: "api", label: "HTTP 请求" },
                { value: "sitemap", label: "Sitemap" },
                { value: "url_list", label: "URL 列表" },
              ]}
              onChange={this.setCollectType}
            />,
            "页面解析 HTML，HTTP 请求解析接口响应，Sitemap 展开 loc，URL 列表逐行采集",
          )}
        </HGCardPage>

        <HGCardPage title="② 请求配置">
          <div className={styles.gridWide}>
            {this.renderField(
              "URL",
              <HGInputPage
                value={form.url}
                disabled={form.collectType === "url_list"}
                onChange={(event) => this.setURL(event.target.value)}
              />,
            )}
            {this.renderField(
              "Method",
              <HGSelectPage
                value={form.method}
                options={[
                  { value: "GET", label: "GET" },
                  { value: "POST", label: "POST" },
                ]}
                disabled={form.collectType !== "api"}
                onChange={this.setMethod}
              />,
            )}
          </div>
          <h3>Headers</h3>
          {this.renderRows("headers", headers, "Header", "Value")}
          {this.renderField(
            form.collectType === "url_list"
              ? "URL 列表"
              : form.method === "GET"
                ? "Query Parameters (JSON)"
                : "Body",
            <HGInputTextArea
              value={
                form.collectType === "url_list"
                  ? form.sourceUrls
                  : this.state.requestInput
              }
              placeholder={
                form.collectType === "url_list"
                  ? "每行一个完整 URL，最多 50 个"
                  : form.method === "GET"
                    ? '{\n  "page": 1,\n  "pageSize": 20\n}'
                    : "POST 请求体，可填写 JSON 或文本"
              }
              rows={6}
              onChange={(event) =>
                form.collectType === "url_list"
                  ? this.setField("sourceUrls", event.target.value)
                  : this.setState({ requestInput: event.target.value })
              }
            />,
            form.method === "GET" && form.collectType !== "url_list"
              ? "GET 参数将自动映射到 URL Query；POST 输入将作为请求 Body"
              : undefined,
          )}
        </HGCardPage>

        <HGCardPage title="③ 调度配置">
          {this.renderField(
            "执行方式",
            <HGRadioGroup
              value={form.executionMode}
              options={[
                { value: "manual", label: "手动" },
                { value: "once", label: "一次性" },
                { value: "cron", label: "定时" },
              ]}
              onChange={(value) => this.setField("executionMode", value)}
            />,
          )}
          {this.renderField(
            "Cron",
            <HGInputPage
              value={form.cron}
              disabled={form.executionMode !== "cron"}
              onChange={(event) => this.setField("cron", event.target.value)}
            />,
            "格式：秒 分 时 日 月 周。例如 0 */10 * * * * 表示每 10 分钟的第 0 秒执行一次",
          )}
        </HGCardPage>

        <HGCardPage title="④ 执行限制">
          <div className={styles.gridThree}>
            {this.renderField(
              "Timeout (s)",
              <HGInputNumberPage
                value={form.timeoutSeconds}
                min={1}
                max={10}
                onChange={(value) => this.setField("timeoutSeconds", value)}
              />,
            )}
            {this.renderField(
              "最大采集条数",
              <HGInputNumberPage
                value={form.maxItems}
                min={1}
                max={50}
                onChange={(value) => this.setField("maxItems", value)}
              />,
            )}
          </div>
        </HGCardPage>

        <HGCardPage title="⑤ 数据解析">
          <div className={styles.grid}>
            {this.renderField(
              "解析类型",
              <HGSelectPage
                value={form.parserType}
                options={[
                  {
                    value: "restricted_jsonpath",
                    label: "Restricted JSONPath",
                  },
                  { value: "css", label: "CSS Selector" },
                  { value: "xpath", label: "XPath" },
                ]}
                onChange={(value) => this.setField("parserType", value)}
              />,
            )}
            {this.renderField(
              "Item Selector",
              <HGInputPage
                value={form.itemSelector}
                onChange={(event) =>
                  this.setField("itemSelector", event.target.value)
                }
              />,
              "从响应根节点选取重复数据项",
            )}
          </div>
          <div className={styles.mappingTitle}>
            <h3>字段映射</h3>
            <div className={styles.mappingActions}>
              <HGButtonPage
                type="link"
                onClick={() => this.setState({ mappings: [] })}
              >
                清空映射
              </HGButtonPage>
              <HGButtonPage type="link" onClick={() => this.addRow("mappings")}>
                添加字段
              </HGButtonPage>
              <HGButtonPage
                type="link"
                disabled={
                  !detectedFields.length ||
                  form.parserType !== "restricted_jsonpath"
                }
                onClick={this.applyDetectedFields}
              >
                自动识别字段
              </HGButtonPage>
            </div>
          </div>
          <div className={styles.mappingTable}>
            {mappings.map((row) => (
              <div className={styles.mappingRow} key={row.id}>
                <HGInputPage
                  value={row.name}
                  placeholder="canonicalName"
                  onChange={(event) =>
                    this.updateRow(
                      "mappings",
                      row.id,
                      "name",
                      event.target.value,
                    )
                  }
                />
                <HGInputPage
                  value={row.path}
                  placeholder="selector"
                  onChange={(event) =>
                    this.updateRow(
                      "mappings",
                      row.id,
                      "path",
                      event.target.value,
                    )
                  }
                />
                <HGInputPage
                  value={row.attribute}
                  placeholder="attribute（可选）"
                  disabled={form.parserType === "restricted_jsonpath"}
                  onChange={(event) =>
                    this.updateRow(
                      "mappings",
                      row.id,
                      "attribute",
                      event.target.value,
                    )
                  }
                />
                <HGButtonPage
                  type="text"
                  danger
                  onClick={() => this.removeRow("mappings", row.id)}
                >
                  删除
                </HGButtonPage>
              </div>
            ))}
          </div>
          <small className={styles.mappingHint}>
            字段映射可留空；JSON 响应会按每个数据项的 JSON
            字符串生成标题和稳定内容 ID，目标地址使用采集 URL。
          </small>
          {response ? (
            <div className={styles.responsePanel}>
              <div className={styles.responseMeta}>
                <strong>HTTP {response.statusCode}</strong>
                <span>{response.contentType || "unknown"}</span>
                <span>{response.costMillis} ms</span>
                <span>{response.responseBytes} bytes</span>
              </div>
              <h4>Response Headers</h4>
              <pre>{JSON.stringify(response.headers, null, 2)}</pre>
              <h4>Response Body</h4>
              <pre>
                {JSON.stringify(response.body ?? response.bodyText, null, 2)}
              </pre>
            </div>
          ) : null}
        </HGCardPage>

        <HGCardPage title="⑥ 数据存储">
          {this.renderField(
            "存储目标",
            <HGRadioGroup
              value={form.storage}
              options={[
                { value: "mysql", label: "MySQL" },
                { value: "clickhouse", label: "ClickHouse", disabled: true },
                { value: "kafka", label: "Kafka", disabled: true },
                { value: "json", label: "JSON", disabled: true },
              ]}
              onChange={(value) => this.setField("storage", value)}
            />,
            "当前服务固定写入推荐内容 MySQL 表",
          )}
        </HGCardPage>

        <div className={styles.actions}>
          <HGButtonPage
            loading={testing}
            disabled={saving || savingAndRunning}
            onClick={this.testRequest}
          >
            测试请求
          </HGButtonPage>
          <HGButtonPage
            loading={saving}
            disabled={testing || savingAndRunning}
            onClick={() => this.saveTask(false)}
          >
            保存任务
          </HGButtonPage>
          <HGButtonPage
            type="primary"
            loading={savingAndRunning}
            disabled={testing || saving}
            onClick={() => this.saveTask(true)}
          >
            保存并运行
          </HGButtonPage>
        </div>
      </div>
    );
  }
}

export default HGTaskCreatePage;
