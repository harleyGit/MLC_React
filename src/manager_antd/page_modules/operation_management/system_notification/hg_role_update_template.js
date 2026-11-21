/** 角色更新通知的可编辑草稿；发布后由服务端事件消费者填充并投递。 */
export function hgRoleUpdateTemplateDraft(emptyTemplate) {
  return {
    ...emptyTemplate,
    template_code: "iam.role.updated",
    name: "角色更新通知",
    category: "system",
    title_template: "角色信息已更新",
    body_template: "您的角色 {{role_name}} 已更新，请查看最新权限。",
    variables_schema: [
      {
        name: "role_name", // 更新后的角色名称，由服务端事件填充。
        type: "string",
        required: true,
        max_length: 128,
        description: "",
        extra: {},
      },
    ],
    action_type: "none",
    action_config: { route_name: "", params: [], extra: {} },
    channels: ["in_app", "realtime"],
  };
}
