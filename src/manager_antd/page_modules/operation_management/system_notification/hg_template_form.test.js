import test from "node:test";
import assert from "node:assert/strict";
import {
  hgPreviewSampleValues,
  hgPreviewText,
  hgTemplateToForm,
  hgTemplatePayload,
  hgUnknownPlaceholders,
} from "./hg_template_form.js";

test("编辑详情回填结构化表单并按原版本更新，未知字段无损回传", () => {
  const detail = {
    id: "9007199254740993", template_code: "order.paid", version: 7, name: "支付成功",
    category: "transaction", title_template: "已支付", body_template: "订单 {{order_no}} 已支付",
    variables_schema: { order_no: { type: "string", required: true, enum: ["A", "B"] } },
    action_config: { route_name: "order_detail", params: { order_id: "{{order_no}}" }, fallback: "home" },
    channels: ["in_app", "realtime"], priority: 2, locale: "zh-CN",
  };
  const form = hgTemplateToForm(detail);
  assert.equal(form.body_template, detail.body_template);
  assert.equal(form.version, 7);
  assert.deepEqual(form.variables_schema, [
    { name: "order_no", type: "string", required: true, max_length: "", description: "", extra: { enum: ["A", "B"] } },
  ]);
  assert.deepEqual(form.action_config.params, [{ key: "order_id", value: "{{order_no}}" }]);
  const update = hgTemplatePayload({ ...form, name: "支付完成" }, true);
  assert.equal(update.version, 7);
  assert.equal(update.name, "支付完成");
  assert.equal(Object.hasOwn(update, "template_code"), false);
  assert.deepEqual(update.variables_schema, detail.variables_schema);
  assert.deepEqual(update.action_config, detail.action_config);
  assert.deepEqual(update.channels, detail.channels);
  assert.equal(hgTemplatePayload(form, false).template_code, "order.paid");
});

test("非法配置形态不会提交模板", () => {
  const base = {
    template_code: "demo",
    variables_schema: [],
    action_config: { route_name: "", params: [], extra: {} },
    channels: ["in_app"],
  };
  assert.throws(() => hgTemplatePayload({ ...base, channels: [] }, false), /至少选择一个投递渠道/);
  assert.throws(
    () => hgTemplatePayload({ ...base, variables_schema: [{ name: "", type: "string", required: true, max_length: "", description: "", extra: {} }] }, false),
    /未填写变量名/
  );
  assert.throws(
    () => hgTemplatePayload({ ...base, variables_schema: [
      { name: "a", type: "string", required: true, max_length: "", description: "", extra: {} },
      { name: "a", type: "string", required: true, max_length: "", description: "", extra: {} },
    ] }, false),
    /变量名重复/
  );
  assert.throws(
    () => hgTemplatePayload({ ...base, action_config: { route_name: "", params: [{ key: "", value: "1" }], extra: {} } }, false),
    /未填写的参数名/
  );
  assert.throws(() => hgTemplatePayload({ ...base, variables_schema: "{}" }, false), /变量配置格式错误/);
});

test("预览辅助函数：示例值填充与未声明占位符检测", () => {
  const form = {
    title_template: "{{user_name}}的订单",
    body_template: "订单 {{order_no}} 实付 {{amount}} 元，备注 {{remark}}。",
    variables_schema: [
      { name: "user_name", type: "string", required: true, max_length: "", description: "", extra: {} },
      { name: "order_no", type: "string", required: true, max_length: "", description: "", extra: {} },
      { name: "amount", type: "number", required: true, max_length: "", description: "", extra: {} },
    ],
  };
  const samples = hgPreviewSampleValues(form);
  assert.equal(samples.user_name, "张三");
  assert.equal(samples.order_no, "SO20261121001");
  assert.equal(samples.amount, "99.90");
  assert.equal(
    hgPreviewText(form.body_template, samples),
    "订单 SO20261121001 实付 99.90 元，备注 {{remark}}。"
  );
  assert.deepEqual(hgUnknownPlaceholders(form), ["remark"]);
});
