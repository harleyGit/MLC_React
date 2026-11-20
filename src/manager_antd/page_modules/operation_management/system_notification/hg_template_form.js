/** 编辑回填从详情取得最新版本；JSON 保留完整对象供受控输入编辑。 */
export function hgTemplateToForm(item) {
  return {
    template_code: item.template_code,
    name: item.name,
    category: item.category,
    title_template: item.title_template,
    body_template: item.body_template,
    variables_schema: JSON.stringify(item.variables_schema ?? {}, null, 2),
    action_type: item.action_type,
    action_config: JSON.stringify(item.action_config ?? {}, null, 2),
    channels: JSON.stringify(item.channels ?? ["in_app"]),
    priority: item.priority,
    locale: item.locale,
    version: item.version,
  };
}

/** 写入前校验 JSON 形态；更新只提交已读取版本，不把不可变编码当作创建请求。 */
export function hgTemplatePayload(form, editing) {
  const variables_schema = JSON.parse(form.variables_schema);
  const action_config = JSON.parse(form.action_config);
  const channels = JSON.parse(form.channels);
  if (!variables_schema || Array.isArray(variables_schema) || typeof variables_schema !== "object" ||
    !action_config || Array.isArray(action_config) || typeof action_config !== "object" ||
    !Array.isArray(channels)) throw new Error("变量、点击配置需为 JSON 对象，渠道需为 JSON 数组");
  const { template_code, ...fields } = form;
  return { ...fields, variables_schema, action_config, channels, ...(editing ? {} : { template_code }) };
}
