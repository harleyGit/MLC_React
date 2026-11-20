import test from "node:test";
import assert from "node:assert/strict";
import { hgTemplateToForm, hgTemplatePayload } from "./hg_template_form.js";

test("编辑详情回填并按原版本更新，不创建新模板", () => {
  const detail = {
    id: "9007199254740993", template_code: "order.paid", version: 7, name: "支付成功",
    category: "transaction", title_template: "已支付", body_template: "订单 {{order_no}} 已支付",
    variables_schema: { order_no: { type: "string", required: true } },
    action_type: "none", action_config: {}, channels: ["in_app"], priority: 2, locale: "zh-CN",
  };
  const form = hgTemplateToForm(detail);
  assert.equal(form.body_template, detail.body_template);
  assert.equal(form.version, 7);
  const update = hgTemplatePayload({ ...form, name: "支付完成" }, true);
  assert.equal(update.version, 7);
  assert.equal(update.name, "支付完成");
  assert.equal(Object.hasOwn(update, "template_code"), false);
  assert.deepEqual(update.variables_schema, detail.variables_schema);
  assert.equal(hgTemplatePayload(form, false).template_code, "order.paid");
});

test("无效 JSON 形态不会提交模板", () => {
  const form = {
    template_code: "demo", variables_schema: "[]", action_config: "{}", channels: '["in_app"]',
  };
  assert.throws(() => hgTemplatePayload(form, false));
  assert.throws(() => hgTemplatePayload({ ...form, variables_schema: "{" }, false));
});
