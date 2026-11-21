/**
 * 系统通知模板表单转换层。
 * 职责：在「编辑器结构化表单」与「服务端 JSON 契约」之间做双向转换，并派生真实消息预览所需的示例数据。
 * 边界：本文件只做纯数据转换与本地形态校验，不发起请求；占位符、渠道与权限的最终校验始终在服务端。
 */

/** 占位符正则：匹配 {{var}} 形式，变量名仅允许字母、数字与下划线。 */
const HG_PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** 变量定义中编辑器已建模的字段；其余字段进入 entry.extra 无损回传。 */
const HG_KNOWN_VARIABLE_FIELDS = new Set(["type", "required", "max_length", "description"]);

/**
 * 创建一条空白变量配置条目。
 * @returns {HGTemplateVariableEntry} 全部字段为初始值的条目，供「增加变量」按钮追加。
 */
export function hgCreateVariableEntry() {
  return {
    name: "", // 变量名，对应正文 {{name}} 占位符；空字符串表示该行尚未填写。
    type: "string", // 变量类型，string / number / bool；默认字符串。
    required: true, // 是否必填；新建变量默认必填。
    max_length: "", // 字符串最大长度；空字符串表示不限制，序列化时省略。
    description: "", // 用途说明；空字符串表示不提交给服务端。
    extra: {}, // 服务端已有但编辑器未建模的未知字段，序列化时原样合并回传。
  };
}

/**
 * 编辑详情回填：把服务端 JSON 契约转换为编辑器受控结构。
 * variables_schema 对象转为条目数组，action_config 拆为 route_name + 参数键值对；
 * 未建模字段保留在 extra 中，保证再次保存不丢数据。
 * @param {object} item 服务端模板详情（当前版本）。
 * @returns {object} 结构化表单，字段契约与 HG_EMPTY_TEMPLATE 一致。
 */
export function hgTemplateToForm(item) {
  const variablesSource =
    item.variables_schema && typeof item.variables_schema === "object" && !Array.isArray(item.variables_schema)
      ? item.variables_schema
      : {}; // 非对象视为空；服务端契约异常时回填为空配置。
  const variables_schema = Object.entries(variablesSource).map(([name, def]) => ({
    name,
    type: typeof def?.type === "string" ? def.type : "string",
    required: Boolean(def?.required),
    max_length: typeof def?.max_length === "number" && def.max_length > 0 ? def.max_length : "",
    description: typeof def?.description === "string" ? def.description : "",
    extra: def && typeof def === "object"
      ? Object.fromEntries(Object.entries(def).filter(([key]) => !HG_KNOWN_VARIABLE_FIELDS.has(key)))
      : {},
  }));
  const { route_name, params, ...extra } =
    item.action_config && typeof item.action_config === "object" && !Array.isArray(item.action_config)
      ? item.action_config
      : {};
  return {
    template_code: item.template_code,
    name: item.name,
    category: item.category,
    title_template: item.title_template,
    body_template: item.body_template,
    variables_schema,
    action_config: {
      route_name: typeof route_name === "string" ? route_name : "", // 内部路由名；空字符串表示未配置。
      params: params && typeof params === "object" && !Array.isArray(params)
        ? Object.entries(params).map(([key, value]) => ({ key, value: String(value) })) // 参数值统一按字符串编辑。
        : [],
      extra, // 未建模的点击配置字段，保存时原样合并。
    },
    channels: Array.isArray(item.channels) ? item.channels.filter((channel) => typeof channel === "string") : [],
    priority: item.priority,
    locale: item.locale,
    version: item.version,
  };
}

/**
 * 写入前序列化：把结构化表单还原为服务端 JSON 契约，并做本地形态校验。
 * 更新只提交已读取版本；template_code 仅创建时携带。
 * @param {object} form 结构化表单。
 * @param {boolean} editing true 表示更新现有模板（PUT），false 表示创建（POST）。
 * @returns {object} 服务端请求体。
 * @throws {Error} 变量名/参数名为空或重复、渠道为空时抛出，页面负责展示错误文案。
 */
export function hgTemplatePayload(form, editing) {
  if (!Array.isArray(form.variables_schema)) throw new Error("变量配置格式错误，请通过“增加变量”按钮配置");
  if (!form.action_config || typeof form.action_config !== "object") throw new Error("点击配置格式错误");
  if (!Array.isArray(form.channels)) throw new Error("投递渠道格式错误");
  const variables_schema = {};
  for (const entry of form.variables_schema) {
    const name = String(entry.name || "").trim();
    if (!name) throw new Error("存在未填写变量名的变量配置，请补齐或删除对应行");
    if (name in variables_schema) throw new Error(`变量名重复：${name}`);
    const def = { type: entry.type, required: Boolean(entry.required) };
    if (typeof entry.max_length === "number" && entry.max_length > 0) def.max_length = entry.max_length;
    const description = String(entry.description || "").trim();
    if (description) def.description = description;
    variables_schema[name] = { ...def, ...entry.extra }; // extra 中的未知字段优先保留服务端原值。
  }
  const { route_name, params, extra } = form.action_config;
  const action_config = {};
  const route = String(route_name || "").trim();
  if (route) action_config.route_name = route;
  if (Array.isArray(params) && params.length) {
    const paramObject = {};
    for (const param of params) {
      const key = String(param.key || "").trim();
      if (!key) throw new Error("点击配置存在未填写的参数名，请补齐或删除对应行");
      if (key in paramObject) throw new Error(`点击配置参数名重复：${key}`);
      paramObject[key] = param.value;
    }
    action_config.params = paramObject;
  }
  Object.assign(action_config, extra || {});
  const channels = [...new Set(form.channels.map((channel) => String(channel).trim()).filter(Boolean))];
  if (!channels.length) throw new Error("至少选择一个投递渠道");
  const { template_code, ...fields } = form;
  return { ...fields, variables_schema, action_config, channels, ...(editing ? {} : { template_code }) };
}

/**
 * 按变量名与类型生成预览示例值；命中最靠前的启发式规则即返回。
 * @param {string} name 变量名。
 * @param {string} type 变量类型（string / number / bool）。
 * @returns {string} 预览用示例值，不参与真实业务计算。
 */
function hgSampleValue(name, type) {
  const lower = name.toLowerCase();
  if (/name|user|nick/.test(lower)) return "张三";
  if (/time|date|_at|created|updated/.test(lower)) return "11-21 10:00";
  if (/amount|money|price|fee|coin/.test(lower)) return "99.90";
  if (/order|_no|no$|code|sn/.test(lower)) return "SO20261121001";
  if (/url|link/.test(lower)) return "https://example.com";
  if (/count|num|qty/.test(lower)) return "3";
  if (type === "number") return "100";
  if (type === "bool") return "是";
  return "示例值";
}

/**
 * 汇总预览样本值：为已声明变量生成名称 → 示例值映射。
 * @param {object} form 结构化表单。
 * @returns {Object<string, string>} 变量名到示例值的映射；未声明变量不在其中。
 */
export function hgPreviewSampleValues(form) {
  const samples = {};
  const entries = Array.isArray(form?.variables_schema) ? form.variables_schema : [];
  for (const entry of entries) {
    const name = String(entry?.name || "").trim();
    if (name) samples[name] = hgSampleValue(name, entry.type);
  }
  return samples;
}

/**
 * 把模板文本中的 {{var}} 占位符替换为样本值；未声明的占位符原样保留，供页面高亮提示。
 * @param {string} text 标题或正文模板原文。
 * @param {Object<string, string>} samples hgPreviewSampleValues 的结果。
 * @returns {string} 替换后的预览文本。
 */
export function hgPreviewText(text, samples) {
  return String(text || "").replace(HG_PLACEHOLDER_RE, (raw, name) => samples[name] ?? raw);
}

/**
 * 找出标题与正文中使用但未在变量配置里声明的占位符。
 * @param {object} form 结构化表单。
 * @returns {string[]} 未声明变量名列表（按出现顺序去重）；为空表示占位符全部已声明。
 */
export function hgUnknownPlaceholders(form) {
  const declared = new Set(
    (Array.isArray(form?.variables_schema) ? form.variables_schema : [])
      .map((entry) => String(entry?.name || "").trim())
      .filter(Boolean)
  );
  const unknown = [];
  const text = `${form?.title_template || ""}\n${form?.body_template || ""}`;
  for (const match of text.matchAll(HG_PLACEHOLDER_RE)) {
    if (!declared.has(match[1]) && !unknown.includes(match[1])) unknown.push(match[1]);
  }
  return unknown;
}
