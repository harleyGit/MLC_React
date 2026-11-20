/** 角色更新通知的可编辑草稿；仅供管理员经模板创建接口提交，不绑定发送事件。 */
export function hgRoleUpdateTemplateDraft(emptyTemplate) {
  return {
    ...emptyTemplate,
    template_code: "iam.role.updated",
    name: "角色更新通知",
    category: "system",
    title_template: "角色信息已更新",
    body_template: "您的角色 {{role_name}} 已更新，请查看最新权限。",
    variables_schema: JSON.stringify({
      role_name: { type: "string", required: true, max_length: 128 },
    }, null, 2),
    action_type: "none",
    action_config: "{}",
    channels: '["in_app"]',
  };
}
