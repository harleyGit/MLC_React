import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";
import {
  buildHGTaskSavePayload,
  hgTaskRowsToObject,
  parseHGTaskRequestInput,
} from "./hg_task_payload";

export const HG_TASK_INITIAL_FORM = {
  name: "B站视频采集",
  platform: "bilibili",
  collectType: "api",
  url: "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd",
  method: "GET",
  body: "",
  executionMode: "cron",
  cron: "0 */10 * * * *",
  timeoutSeconds: 10,
  parserType: "restricted_jsonpath",
  itemSelector: "$.data.item[*]",
  maxItems: 20,
  storage: "mysql",
  sourceUrls: "",
  id: 0,
  version: 0,
};

export default class HGTaskCreateVM {
  /** Converts one persisted definition into the editable create-page state. */
  static toEditorState = (definition) => {
    if (!definition?.id) return null;
    const configuration = definition.configuration || {};
    const request = configuration.request || {};
    const parser = configuration.parser || {};
    const toRows = (values = {}) =>
      Object.entries(values).map(([key, value], index) => ({
        id: index + 1,
        key,
        value: String(value ?? ""),
      }));
    const mappings = Object.entries(parser.fields || {}).map(
      ([name, field], index) => ({
        id: index + 1,
        name,
        path: field?.selector || "",
        attribute: field?.attribute || "",
      }),
    );
    return {
      form: {
        ...HG_TASK_INITIAL_FORM,
        id: definition.id,
        version: definition.version,
        name: definition.name || "",
        platform: definition.platform || "custom",
        collectType: configuration.collectType || "api",
        sourceUrls: (configuration.urls || []).join("\n"),
        url: request.url || "",
        method: request.method || "GET",
        body: request.body || "",
        executionMode: definition.enabled ? "cron" : "manual",
        cron: definition.cron || "",
        timeoutSeconds: Math.max(1, Number(request.timeoutMs || 10000) / 1000),
        parserType:
          definition.parserType || parser.type || "restricted_jsonpath",
        itemSelector: definition.itemPath || parser.itemSelector || "",
        maxItems: definition.maxItems || 20,
      },
      headers: toRows(request.headers),
      params: toRows(request.params),
      mappings,
    };
  };

  static testRequest = ({ form, headers, params, requestInput }) => {
    const request =
      requestInput === undefined
        ? { body: form.body, params: hgTaskRowsToObject(params) }
        : parseHGTaskRequestInput(form.method, requestInput);
    return HGNet.post(
      HGMANAGER_API.OPS_CRAWLER_TASK_DEBUG,
      {
        url:
          form.collectType === "url_list"
            ? String(form.sourceUrls || "")
                .split(/\r?\n/)
                .find(Boolean) || form.url
            : form.url,
        method: form.method,
        headers: hgTaskRowsToObject(headers),
        params: request.params,
        body: request.body,
        timeoutMs: Number(form.timeoutSeconds || 10) * 1000,
      },
      { timeout: 15000 },
    );
  };

  /** Persists a definition, optionally executing the saved snapshot immediately. */
  static saveTask = (state, runNow = false) =>
    HGNet.post(
      runNow
        ? HGMANAGER_API.OPS_CRAWLER_TASK_SAVE_AND_RUN
        : HGMANAGER_API.OPS_CRAWLER_TASK_SAVE,
      buildHGTaskSavePayload(state),
      { timeout: runNow ? 15000 : 5000 },
    );
}
