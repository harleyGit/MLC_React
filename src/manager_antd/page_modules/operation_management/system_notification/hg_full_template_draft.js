/**
 * 最全默认模板草稿。
 * 职责：「新建模板」入口预填一个字段最全、可直接创建的示例模板，创建者在其基础上删改；
 *       预设仅是表单初始值，绝不当作服务端已有数据，仍须管理员显式点击创建才会提交。
 */

/**
 * 生成最全默认模板草稿。
 * @param {object} emptyTemplate HG_EMPTY_TEMPLATE 空模板，提供未覆盖字段的初始值。
 * @returns {object} 结构化表单草稿；变量、点击参数与渠道均使用按钮式配置结构。
 */
export function hgFullTemplateDraft(emptyTemplate) {
  return {
    ...emptyTemplate,
    template_code: "example.full_notification", // 示例编码，创建者按业务修改；重复创建会由服务端 409 拦截。
    name: "支付成功通知",
    category: "transaction",
    title_template: "支付成功",
    body_template:
      "{{user_name}}，您的订单 {{order_no}} 已于 {{pay_time}} 完成支付，实付 {{amount}} 元。{{remark}}",
    variables_schema: [
      { name: "user_name", type: "string", required: true, max_length: 64, description: "接收通知的用户昵称", extra: {} },
      { name: "order_no", type: "string", required: true, max_length: 64, description: "业务订单号", extra: {} },
      { name: "pay_time", type: "string", required: true, max_length: 32, description: "支付完成时间", extra: {} },
      { name: "amount", type: "number", required: true, max_length: "", description: "实付金额（元）", extra: {} },
      { name: "remark", type: "string", required: false, max_length: 200, description: "附加说明，可为空", extra: {} },
    ],
    action_type: "order_detail",
    action_config: {
      route_name: "order_detail", // 点击通知后进入订单详情页。
      params: [{ key: "order_no", value: "{{order_no}}" }], // 路由参数引用模板变量，服务端投递时填充。
      extra: {},
    },
    channels: ["in_app", "realtime"],
    priority: 2,
  };
}
