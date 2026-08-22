import assert from "node:assert/strict";
import test from "node:test";
import { buildHGTaskSavePayload } from "./hg_task_payload.js";

test("buildHGTaskSavePayload maps aliases and emits the persisted backend contract", () => {
  assert.deepEqual(buildHGTaskSavePayload({
    form: {
      name: " Demo ", platform: "custom", executionMode: "cron", cron: "0 */10 * * * *",
      url: " https://example.com/items ", method: "get", body: "", timeoutSeconds: 5,
      parserType: "css", itemSelector: "article", maxItems: 20,
    },
    headers: [{ key: "Accept", value: "application/json" }],
    params: [{ key: "page", value: "1" }],
    mappings: [
      { name: "video_id", path: "$.id" },
      { name: "author", path: "$.owner.name" },
      { name: "target_url", path: "$.url", attribute: "href" },
    ],
  }), {
    id: 0,
    name: "Demo",
    platform: "custom",
    enabled: true,
    cron: "0 */10 * * * *",
    parserType: "css",
    itemPath: "article",
    maxItems: 20,
    configuration: {
      request: {
        url: "https://example.com/items",
        method: "GET",
        headers: { Accept: "application/json" },
        params: { page: "1" },
        body: "",
        timeoutMs: 5000,
      },
      parser: {
        type: "css",
        platform: "custom",
        itemSelector: "article",
        fields: {
          contentId: { selector: "$.id" },
          authorName: { selector: "$.owner.name" },
          targetUrl: { selector: "$.url", attribute: "href" },
        },
      },
    },
    version: 0,
  });
});
