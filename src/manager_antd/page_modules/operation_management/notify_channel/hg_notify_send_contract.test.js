import assert from "node:assert/strict";
import test from "node:test";
import { hgBuildSendCommand, hgNormalizeSendTemplate, hgSendableTemplate, hgValidateSendInput } from "./hg_notify_send_contract.js";

const hgRaw = {
  id: "9007199254740993", template_code: "system.maintenance", name: "维护通知",
  category: "system", status: "published", version: 2, published_version: 2,
  title_template: "维护 {{name}}", body_template: "请阅读 {{name}}",
  variables_schema: { name: { type: "string", required: true, max_length: 16 } },
  action_type: "none", action_config: {}, channels: ["in_app"],
};

test("仅允许当前已发布且纯站内的版本，模板 ID 保留字符串精度", () => {
  const template = hgNormalizeSendTemplate(hgRaw);
  assert.equal(template.templateId, hgRaw.id);
  assert.equal(hgSendableTemplate(template), true);
  assert.equal(hgSendableTemplate({ ...template, publishedVersion: 1 }), false);
  // 同一模板存在 v3 草稿时，发布版接口应返回 v2 快照，不以 v3 覆盖可发送内容。
  assert.equal(hgSendableTemplate(hgNormalizeSendTemplate({ ...hgRaw, version: 3 })), false);
  assert.equal(hgSendableTemplate(hgNormalizeSendTemplate(hgRaw)), true);
  assert.equal(hgSendableTemplate({ ...template, channels: ["in_app", "realtime"] }), false);
  assert.equal(hgSendableTemplate({ ...template, category: "security" }), false);
  assert.equal(hgSendableTemplate({ ...template, actionType: "order_detail" }), false);
});

test("显式用户数量、格式和受控变量与发送协议一致", () => {
  const template = hgNormalizeSendTemplate(hgRaw);
  assert.match(hgValidateSendInput(template, [], { name: "小明" }), /1–100/);
  assert.match(hgValidateSendInput(template, Array.from({ length: 101 }, (_, i) => `u${i}`), { name: "小明" }), /1–100/);
  assert.match(hgValidateSendInput(template, ["not valid"], { name: "小明" }), /用户 ID/);
  assert.match(hgValidateSendInput(template, ["u1"], { name: "<script>" }), /不支持/);
  assert.match(hgValidateSendInput(template, ["u1"], {}), /必填/);
  assert.equal(hgValidateSendInput(template, ["u1"], { name: "小明" }), "");
  assert.deepEqual(hgBuildSendCommand(template, ["u1"], { name: "小明", extra: "丢弃" }), {
    templateId: hgRaw.id, templateVersion: 2, userIds: ["u1"], variables: { name: "小明" },
  });
});
