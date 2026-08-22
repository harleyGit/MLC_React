import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";
import { buildHGTaskSavePayload, hgTaskRowsToObject } from "./hg_task_payload";

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
  id: 0,
  version: 0,
};

export default class HGTaskCreateVM {
  static testRequest = ({ form, headers, params }) => HGNet.post(
    HGMANAGER_API.OPS_CRAWLER_TASK_DEBUG,
    {
      url: form.url,
      method: form.method,
      headers: hgTaskRowsToObject(headers),
      params: hgTaskRowsToObject(params),
      body: form.body,
      timeoutMs: Number(form.timeoutSeconds || 10) * 1000,
    },
    { timeout: 15000 }
  );

  /** Persists a definition, optionally executing the saved snapshot immediately. */
  static saveTask = (state, runNow = false) => HGNet.post(
    runNow ? HGMANAGER_API.OPS_CRAWLER_TASK_SAVE_AND_RUN : HGMANAGER_API.OPS_CRAWLER_TASK_SAVE,
    buildHGTaskSavePayload(state),
    { timeout: runNow ? 15000 : 5000 }
  );
}
