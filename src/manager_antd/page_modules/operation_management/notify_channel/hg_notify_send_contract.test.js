import assert from "node:assert/strict";
import test from "node:test";
import { hgAcceptedSendStatus, hgBuildSendCommand, hgDefaultSendVariables, hgNormalizeSendTemplate, hgPublishableSendTemplate, hgSendableTemplate, hgValidateSendInput, hgValidateSendSchedule } from "./hg_notify_send_contract.js";

const hgRaw = {
  id: "9007199254740993", template_code: "system.maintenance", name: "维护通知",
  category: "system", status: "published", version: 2, published_version: 2, publication_status: "published",
  title_template: "维护 {{name}}", body_template: "请阅读 {{name}}",
  variables_schema: { name: { type: "string", required: true, max_length: 16 } },
  action_type: "none", action_config: {}, channels: ["in_app"],
};

test("仅允许当前已发布且纯站内的版本，模板 ID 保留字符串精度", () => {
  const template = hgNormalizeSendTemplate(hgRaw);
  assert.equal(template.templateId, hgRaw.id);
  assert.equal(hgSendableTemplate(template), true);
  assert.equal(hgSendableTemplate({ ...template, publicationStatus: "published_general" }), false);
  assert.equal(hgSendableTemplate({ ...template, publicationStatus: undefined }), false);
  assert.equal(hgSendableTemplate({ ...template, publishedVersion: 1 }), false);
  // 同一模板存在 v3 草稿时，发布版接口应返回 v2 快照，不以 v3 覆盖可发送内容。
  assert.equal(hgSendableTemplate(hgNormalizeSendTemplate({ ...hgRaw, version: 3 })), false);
  assert.equal(hgSendableTemplate(hgNormalizeSendTemplate(hgRaw)), true);
  assert.equal(hgSendableTemplate({ ...template, channels: ["in_app", "realtime"] }), false);
  assert.equal(hgSendableTemplate({ ...template, category: "security" }), false);
  assert.equal(hgSendableTemplate({ ...template, actionType: "order_detail" }), false);
});

test("最新草稿发布入口只面向符合站内发送契约的普通模板", () => {
  const draft = hgNormalizeSendTemplate({ ...hgRaw, status: "draft", version: 3, publication_status: "draft" });
  assert.equal(hgPublishableSendTemplate(draft), true);
  assert.equal(hgPublishableSendTemplate({ ...draft, templateCode: "iam.role.updated" }), false);
  assert.equal(hgPublishableSendTemplate({ ...draft, channels: ["in_app", "realtime"] }), false);
  assert.equal(hgPublishableSendTemplate({ ...draft, category: "security" }), false);
});

test("定时仅接受未来 30 天，并传输 UTC 时间；立即发送保持原协议", () => {
  const template = hgNormalizeSendTemplate(hgRaw);
  const now = Date.parse("2026-11-22T00:00:00.000Z");
  assert.equal(hgValidateSendSchedule("immediate", "", now), "");
  assert.match(hgValidateSendSchedule("scheduled", "", now), /请选择/);
  assert.match(hgValidateSendSchedule("scheduled", "2026-11-21T23:59:00.000Z", now), /未来 30 天/);
  assert.equal(hgValidateSendSchedule("scheduled", "2026-11-23T00:00:00.000Z", now), "");
  assert.equal(hgBuildSendCommand(template, ["u1"], { name: "用户" }).scheduledAt, undefined);
  assert.equal(hgBuildSendCommand(template, ["u1"], { name: "用户" }, "scheduled", "2026-11-23T00:00:00.000Z").scheduledAt, "2026-11-23T00:00:00.000Z");
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

test("只填充模板声明的合法默认变量，未填写占位符不能发送", () => {
  const template = hgNormalizeSendTemplate(hgRaw);
  assert.deepEqual(hgDefaultSendVariables(template), { name: "" });
  assert.match(hgValidateSendInput(template, ["u1"], { name: " " }), /必填/);
  const defaults = hgDefaultSendVariables({ variablesSchema: {
    name: { type: "string", default: "小明", max_length: 16 },
    note: { type: "string", default_value: "提醒" },
    secret: { type: "string", default: "<script>" },
  } });
  assert.deepEqual(defaults, { name: "小明", note: "提醒", secret: "" });
});

test("新任务的审批中和 Kafka 排队中状态都属于成功受理，而不是已送达", () => {
  assert.equal(hgAcceptedSendStatus("pending_approval"), true);
  assert.equal(hgAcceptedSendStatus("queued"), true);
  assert.equal(hgAcceptedSendStatus("done"), true);
  assert.equal(hgAcceptedSendStatus("sent"), false);
  assert.equal(hgAcceptedSendStatus(undefined), false);
});
