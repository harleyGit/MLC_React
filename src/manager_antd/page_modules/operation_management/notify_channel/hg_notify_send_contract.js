/** 当前仅有界站内通知；不把模板接口允许的 realtime 或其它类型当作发送已接入。 */
export function hgSendableTemplate(item) {
  return item?.status === "published" &&
    item.publishedVersion === item.version &&
    ["system", "marketing"].includes(item.category) &&
    item.actionType === "none" &&
    Array.isArray(item.channels) && item.channels.length === 1 && item.channels[0] === "in_app" &&
    Object.keys(item.actionConfig || {}).length === 0 &&
    Object.values(item.variablesSchema || {}).every((rule) => rule?.type === "string");
}

/** 将后端 snake_case 的最新版本快照映射为页面只读发送选项。 */
export function hgNormalizeSendTemplate(item) {
  return {
    templateId: item.id,
    templateCode: item.template_code,
    templateName: item.name,
    category: item.category,
    actionType: item.action_type,
    actionConfig: item.action_config,
    version: item.version,
    status: item.status,
    publishedVersion: item.published_version,
    titleTemplate: item.title_template,
    bodyTemplate: item.body_template,
    variablesSchema: item.variables_schema,
    channels: item.channels,
  };
}

/** 校验单任务显式接收人与纯文本变量；服务端仍须独立校验存在性、权限与字节长度。 */
export function hgValidateSendInput(template, userIds, variables) {
  if (!template) return "请先选择当前已发布的站内模板";
  if (userIds.length < 1 || userIds.length > 100) return "单次任务须填写 1–100 个接收用户 ID";
  if (userIds.some((id) => !/^[A-Za-z0-9_.-]{1,128}$/.test(id))) return "用户 ID 仅允许 1–128 位字母、数字、下划线、点或连字符";
  const schema = template.variablesSchema || {};
  for (const [name, rule] of Object.entries(schema)) {
    const value = variables[name];
    if (rule.required && (!value || !String(value).trim())) return `变量 ${name} 为必填项`;
    if (value === undefined || value === "") continue;
    const limit = rule.max_length || 256;
    if ([...String(value)].length > limit || /[<>]/.test(value)) return `变量 ${name} 含不支持的字符或超过 ${limit} 字符`;
  }
  // Go 用 RE2 检查 pattern；客户端不执行来自模板的 JavaScript 正则。
  const used = `${template.titleTemplate}${template.bodyTemplate}`.match(/\{\{([a-z][a-z0-9_]*)\}\}/g) || [];
  if (used.some((token) => variables[token.slice(2, -2)] === undefined))
    return "请填写标题和正文中引用的全部变量";
  return "";
}

/** 定时仅允许未来 30 天 UTC 毫秒精度；合法本地时间由浏览器序列化为 Z 时区。 */
export function hgValidateSendSchedule(type, localTime, now = Date.now()) {
  if (type === "immediate") return "";
  if (type !== "scheduled" || !localTime) return "请选择定时发送时间";
  const at = new Date(localTime).getTime();
  if (!Number.isFinite(at) || at <= now || at > now + 30 * 24 * 60 * 60 * 1000)
    return "定时发送须在未来 30 天内";
  return "";
}

/** 创建任务返回的状态兼容审批队列与 Kafka 排队，不将异步受理误判为发送失败。 */
export function hgAcceptedSendStatus(status) {
  return ["pending_approval", "pending", "queued", "leased", "done", "failed", "cancelled"].includes(status);
}

/** 将页面输入收敛为后端 HGCommand，不发送未接入的分群、全站或渠道字段。 */
export function hgBuildSendCommand(template, userIds, variables, scheduleType = "immediate", scheduledAt = "") {
  const values = {};
  for (const name of Object.keys(template.variablesSchema || {})) {
    if (variables[name] !== undefined && variables[name] !== "") values[name] = String(variables[name]);
  }
  const command = { templateId: template.templateId, templateVersion: template.version, userIds, variables: values };
  if (scheduleType === "scheduled") command.scheduledAt = new Date(scheduledAt).toISOString();
  return command;
}
