import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGInputPage, { HGInputTextArea } from "../../../components/hg_input/hg_input_page";
import HGInputNumberPage from "../../../components/hg_input_number/hg_input_number_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGRadioGroup from "../../../components/hg_radio/hg_radio_page";
import HGSelectPage from "../../../components/hg_select/hg_select_page";
import HGTaskCreateVM, { HG_TASK_INITIAL_FORM } from "./hg_task_create_vm";
import { normalizeHGTaskFieldName } from "./hg_task_payload";
import styles from "./hg_task_create_page.module.css";

const nextRow = (() => { let id = 3; return () => ({ id: id++, key: "", value: "" }); })();

class HGTaskCreatePage extends Component {
  state = {
    form: { ...HG_TASK_INITIAL_FORM },
    headers: [
      { id: 1, key: "User-Agent", value: "Mozilla/5.0" },
      { id: 2, key: "Accept", value: "application/json" },
    ],
    params: [{ id: 1, key: "fresh_type", value: "3" }, { id: 2, key: "ps", value: "20" }],
    mappings: [
      { id: 1, name: "contentId", path: "$.bvid", attribute: "" },
      { id: 2, name: "title", path: "$.title", attribute: "" },
      { id: 3, name: "authorName", path: "$.owner.name", attribute: "" },
      { id: 4, name: "targetUrl", path: "$.uri", attribute: "" },
      { id: 5, name: "viewCount", path: "$.stat.view", attribute: "" },
      { id: 6, name: "commentCount", path: "$.stat.reply", attribute: "" },
    ],
    testing: false,
    saving: false,
    savingAndRunning: false,
    response: null,
    detectedFields: [],
  };

  setField = (key, value) => this.setState((prev) => ({ form: { ...prev.form, [key]: value } }));

  updateRow = (group, id, key, value) => this.setState((prev) => ({
    [group]: prev[group].map((row) => row.id === id ? { ...row, [key]: value } : row),
  }));

  addRow = (group) => this.setState((prev) => ({ [group]: [...prev[group], nextRow()] }));

  removeRow = (group, id) => this.setState((prev) => ({ [group]: prev[group].filter((row) => row.id !== id) }));

  validate = () => {
    const { name, platform, url, method, parserType, itemSelector, maxItems, executionMode, cron } = this.state.form;
    const fieldNames = new Set(this.state.mappings.map((row) => normalizeHGTaskFieldName(row.name)));
    if (!name.trim() || !platform.trim() || !url.trim() || !method || !parserType || !itemSelector.trim()) {
      message.error("请填写任务名称、平台、URL、Method、解析类型和 Item Selector");
      return false;
    }
    if (executionMode === "cron" && !cron.trim()) {
      message.error("定时任务必须填写 Cron 表达式");
      return false;
    }
    if (Number(maxItems) < 1 || Number(maxItems) > 50) {
      message.error("最大采集条数必须在 1 到 50 之间");
      return false;
    }
    if (!["contentId", "title", "targetUrl"].every((name) => fieldNames.has(name))) {
      message.error("字段映射必须包含 contentId、title 和 targetUrl");
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
        this.setState({ response, detectedFields, mappings: this.toMappings(detectedFields) || this.state.mappings });
      })
      .then(() => message.success("测试请求完成，已自动识别 JSON 字段"))
      .catch((error) => message.error(getRequestErrorMessage(error, "测试请求失败")))
      .finally(() => this.setState({ testing: false }));
  };

  toMappings = (fields) => fields.length ? fields.slice(0, 20).map((field, index) => ({ id: index + 1, name: field.name, path: field.path, attribute: "" })) : null;

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
    const loadingKey = runNow ? "savingAndRunning" : "saving";
    this.setState({ [loadingKey]: true });
    HGTaskCreateVM.saveTask(this.state, runNow)
      .then((result) => {
        const task = result?.task || result?.definition || result;
        const run = result?.run;
        if (runNow && run && String(run.status || run.Status).toLowerCase() === "failed") {
          message.error(`任务已保存，但运行失败：${run.errorMessage || run.ErrorMessage || "未知错误"}`);
        } else {
          message.success(runNow ? "任务已保存并运行完成" : "任务已保存");
        }
        if (task?.id || task?.ID || result?.task || result?.definition) this.props.onNavigate?.("crawler_tasks");
      })
      .catch((error) => message.error(getRequestErrorMessage(error, runNow ? "保存并运行失败" : "保存任务失败")))
      .finally(() => this.setState({ [loadingKey]: false }));
  };

  renderRows = (group, rows, keyPlaceholder, valuePlaceholder) => <div className={styles.rows}>
    {rows.map((row) => <div className={styles.row} key={row.id}>
      <HGInputPage value={row.key} placeholder={keyPlaceholder} onChange={(event) => this.updateRow(group, row.id, "key", event.target.value)} />
      <HGInputPage value={row.value} placeholder={valuePlaceholder} onChange={(event) => this.updateRow(group, row.id, "value", event.target.value)} />
      <HGButtonPage type="text" danger onClick={() => this.removeRow(group, row.id)}>删除</HGButtonPage>
    </div>)}
    <HGButtonPage type="default" onClick={() => this.addRow(group)}>添加一行</HGButtonPage>
  </div>;

  renderField = (label, child, hint) => <label className={styles.field}><span>{label}</span>{child}{hint ? <small>{hint}</small> : null}</label>;

  render() {
    const { form, headers, params, mappings, testing, saving, savingAndRunning, response, detectedFields } = this.state;
    return <div className={styles.page}>
      <div className={styles.header}><div><p>CRAWLER BUILDER</p><h1>创建采集任务</h1><span>先验证目标响应，再配置解析、调度和存储策略</span></div><HGButtonPage onClick={() => this.props.onNavigate?.("crawler_tasks")}>返回任务管理</HGButtonPage></div>

      <HGCardPage title="① 基础信息"><div className={styles.grid}>
        {this.renderField("任务名称", <HGInputPage value={form.name} onChange={(event) => this.setField("name", event.target.value)} />)}
        {this.renderField("数据源", <HGSelectPage value={form.platform} options={[{ value: "bilibili", label: "Bilibili" }, { value: "custom", label: "自定义 HTTP" }]} onChange={(value) => this.setField("platform", value)} />)}
      </div>{this.renderField("采集类型", <HGRadioGroup value={form.collectType} options={[{ value: "page", label: "页面", disabled: true }, { value: "api", label: "HTTP 请求" }, { value: "sitemap", label: "Sitemap", disabled: true }, { value: "url_list", label: "URL 列表", disabled: true }]} onChange={(value) => this.setField("collectType", value)} />, "当前持久化任务仅支持单个 HTTP 请求")}</HGCardPage>

      <HGCardPage title="② 请求配置"><div className={styles.gridWide}>
        {this.renderField("URL", <HGInputPage value={form.url} onChange={(event) => this.setField("url", event.target.value)} />)}
        {this.renderField("Method", <HGSelectPage value={form.method} options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} onChange={(value) => this.setField("method", value)} />)}
      </div><h3>Headers</h3>{this.renderRows("headers", headers, "Header", "Value")}<h3>Query Parameters</h3>{this.renderRows("params", params, "参数名", "参数值")}{this.renderField("Body", <HGInputTextArea value={form.body} placeholder="POST 请求体，可填写 JSON 或文本" rows={6} onChange={(event) => this.setField("body", event.target.value)} />)}</HGCardPage>

      <HGCardPage title="③ 调度配置">{this.renderField("执行方式", <HGRadioGroup value={form.executionMode} options={[{ value: "manual", label: "手动" }, { value: "once", label: "一次性", disabled: true }, { value: "cron", label: "定时" }]} onChange={(value) => this.setField("executionMode", value)} />)}{this.renderField("Cron", <HGInputPage value={form.cron} disabled={form.executionMode !== "cron"} onChange={(event) => this.setField("cron", event.target.value)} />, "启用定时任务时必填 6 段 Cron 表达式")}</HGCardPage>

      <HGCardPage title="④ 执行限制"><div className={styles.gridThree}>
        {this.renderField("Timeout (s)", <HGInputNumberPage value={form.timeoutSeconds} min={1} max={10} onChange={(value) => this.setField("timeoutSeconds", value)} />)}
        {this.renderField("最大采集条数", <HGInputNumberPage value={form.maxItems} min={1} max={50} onChange={(value) => this.setField("maxItems", value)} />)}
      </div></HGCardPage>

      <HGCardPage title="⑤ 数据解析"><div className={styles.grid}>
        {this.renderField("解析类型", <HGSelectPage value={form.parserType} options={[{ value: "restricted_jsonpath", label: "Restricted JSONPath" }, { value: "css", label: "CSS Selector" }, { value: "xpath", label: "XPath" }]} onChange={(value) => this.setField("parserType", value)} />)}
        {this.renderField("Item Selector", <HGInputPage value={form.itemSelector} onChange={(event) => this.setField("itemSelector", event.target.value)} />, "从响应根节点选取重复数据项")}
      </div>
        <div className={styles.mappingTitle}><h3>字段映射</h3><HGButtonPage type="link" disabled={!detectedFields.length || form.parserType !== "restricted_jsonpath"} onClick={this.applyDetectedFields}>自动识别字段</HGButtonPage></div><div className={styles.mappingTable}>{mappings.map((row) => <div className={styles.mappingRow} key={row.id}><HGInputPage value={row.name} placeholder="canonicalName" onChange={(event) => this.updateRow("mappings", row.id, "name", event.target.value)} /><HGInputPage value={row.path} placeholder="selector" onChange={(event) => this.updateRow("mappings", row.id, "path", event.target.value)} /><HGInputPage value={row.attribute} placeholder="attribute（可选）" disabled={form.parserType === "restricted_jsonpath"} onChange={(event) => this.updateRow("mappings", row.id, "attribute", event.target.value)} /></div>)}</div>
        {response ? <div className={styles.responsePanel}><div className={styles.responseMeta}><strong>HTTP {response.statusCode}</strong><span>{response.contentType || "unknown"}</span><span>{response.costMillis} ms</span><span>{response.responseBytes} bytes</span></div><h4>Response Headers</h4><pre>{JSON.stringify(response.headers, null, 2)}</pre><h4>Response Body</h4><pre>{JSON.stringify(response.body ?? response.bodyText, null, 2)}</pre></div> : null}
      </HGCardPage>

      <HGCardPage title="⑥ 数据存储">{this.renderField("存储目标", <HGRadioGroup value={form.storage} options={[{ value: "mysql", label: "MySQL" }, { value: "clickhouse", label: "ClickHouse", disabled: true }, { value: "kafka", label: "Kafka", disabled: true }, { value: "json", label: "JSON", disabled: true }]} onChange={(value) => this.setField("storage", value)} />, "当前服务固定写入推荐内容 MySQL 表")}</HGCardPage>

      <div className={styles.actions}><HGButtonPage loading={testing} disabled={saving || savingAndRunning} onClick={this.testRequest}>测试请求</HGButtonPage><HGButtonPage loading={saving} disabled={testing || savingAndRunning} onClick={() => this.saveTask(false)}>保存任务</HGButtonPage><HGButtonPage type="primary" loading={savingAndRunning} disabled={testing || saving} onClick={() => this.saveTask(true)}>保存并运行</HGButtonPage></div>
    </div>;
  }
}

export default HGTaskCreatePage;
