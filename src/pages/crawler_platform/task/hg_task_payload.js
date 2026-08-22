const HG_CANONICAL_FIELD_NAMES = new Set([
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

const HG_FIELD_NAME_ALIASES = {
  video_id: "contentId",
  author: "authorName",
  author_id: "authorId",
  cover_url: "coverUrl",
  target_url: "targetUrl",
  duration_seconds: "durationSeconds",
  view_count: "viewCount",
  like_count: "likeCount",
  comment_count: "commentCount",
  published_at: "publishedAt",
};

/** Converts one editable field name to the canonical backend recommendation field. */
export function normalizeHGTaskFieldName(name) {
  const trimmed = String(name || "").trim();
  if (HG_CANONICAL_FIELD_NAMES.has(trimmed)) return trimmed;
  return HG_FIELD_NAME_ALIASES[trimmed] || trimmed;
}

/** Converts key/value editor rows into the request object used by the backend DTO. */
export function hgTaskRowsToObject(rows = []) {
  return rows.reduce((result, row) => {
    const key = String(row.key || "").trim();
    if (key) result[key] = String(row.value || "");
    return result;
  }, {});
}

/** Parses the method-specific request editor while keeping invalid JSON out of API payloads. */
export function parseHGTaskRequestInput(method, input) {
  const value = String(input || "");
  if (String(method || "GET").toUpperCase() !== "GET") {
    return { body: value, params: {} };
  }
  if (!value.trim()) return { body: "", params: {} };
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("GET 参数必须是 JSON 对象");
  }
  return {
    body: "",
    params: Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")]),
    ),
  };
}

/** Builds the persisted crawler task payload without retaining unsupported UI-only options. */
export function buildHGTaskSavePayload({
  form,
  headers = [],
  params = [],
  mappings = [],
  requestInput,
}) {
  const parserType = String(form.parserType || "restricted_jsonpath").trim();
  const itemSelector = String(form.itemSelector || "").trim();
  const fields = mappings.reduce((result, row) => {
    const canonicalName = normalizeHGTaskFieldName(row.name);
    const selector = String(row.path || "").trim();
    if (!canonicalName || !selector) return result;
    const attribute = String(row.attribute || "").trim();
    result[canonicalName] = {
      selector,
      ...(parserType !== "restricted_jsonpath" && attribute
        ? { attribute }
        : {}),
    };
    return result;
  }, {});
  const enabled = form.executionMode === "cron";
  const request =
    requestInput === undefined
      ? { body: String(form.body || ""), params: hgTaskRowsToObject(params) }
      : parseHGTaskRequestInput(form.method, requestInput);
  const urls = String(form.sourceUrls || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    id: Number(form.id || 0),
    name: String(form.name || "").trim(),
    platform: String(form.platform || "").trim(),
    enabled,
    cron: enabled ? String(form.cron || "").trim() : "",
    parserType,
    itemPath: itemSelector,
    maxItems: Number(form.maxItems || 0),
    configuration: {
      request: {
        url: String(form.url || "").trim(),
        method: String(form.method || "GET")
          .trim()
          .toUpperCase(),
        headers: hgTaskRowsToObject(headers),
        params: request.params,
        body: request.body,
        timeoutMs: Number(form.timeoutSeconds || 10) * 1000,
      },
      collectType: String(form.collectType || "api").trim(),
      urls,
      parser: {
        type: parserType,
        platform: String(form.platform || "").trim(),
        itemSelector,
        fields,
      },
    },
    version: Number(form.version || 0),
  };
}
