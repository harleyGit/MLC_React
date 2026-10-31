import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

/** 将类组件状态同步提交，测试调用路径而不启动浏览器或外部 IM 服务。 */
function hgSyncState(hgComponent) {
  hgComponent.setState = (hgPatch, hgCallback) => {
    Object.assign(hgComponent.state, typeof hgPatch === "function" ? hgPatch(hgComponent.state) : hgPatch);
    hgCallback?.();
  };
}

test("聊天通话入口与请求幂等边界", async (hgTest) => {
  const hgVite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, preTransformRequests: false }, appType: "custom" });
  hgTest.after(() => hgVite.close());
  const [{ default: HGIMCallPanel }, { default: HGChatInput }] = await Promise.all([
    hgVite.ssrLoadModule("/src/components/hg_im_call/hg_im_call_panel.jsx"),
    hgVite.ssrLoadModule("/src/components/hg_chat_input/hg_chat_input.jsx"),
  ]);

  await hgTest.test("更多面板可点击通话入口，缺少设备时显示原因", () => {
    const hgCalls = []; // 用户触发的通话类型；缺少凭据时必须为空。
    const hgInput = new HGChatInput({ disabled: false, callReady: false, onCall: (hgType) => hgCalls.push(hgType) });
    hgSyncState(hgInput);
    hgInput.hgMounted = true;
    hgInput.state.hgPanel = "plus";
    const hgMarkup = renderToStaticMarkup(hgInput.renderPanel());
    assert.match(hgMarkup, /语音通话/);
    assert.match(hgMarkup, /视频通话/);
    assert.equal((hgMarkup.match(/<button /g) || []).length, 6);
    const hgActions = hgInput.renderPanel().props.children.props.children; // 实际 JSX 按钮回调，不跳过 PLUS_ACTIONS 分流。
    hgActions.find((hgAction) => hgAction.key === "call-audio").props.onClick();
    assert.deepEqual(hgCalls, []);
    assert.match(hgInput.state.hgError, /重新登录/);
    hgInput.props.callReady = true;
    hgActions.find((hgAction) => hgAction.key === "call-video").props.onClick();
    assert.deepEqual(hgCalls, ["video"]);
    assert.equal(hgInput.state.hgPanel, "none");
  });

  await hgTest.test("发起失败重试保留原会话、媒体类型和 requestId", async () => {
    const hgCommands = []; // 模拟 Go 调用参数，不发送真实消息或占用设备名额。
    const hgVM = { hgOwner: "user-1", hgAlive: () => true, hgCredential: { deviceId: "a".repeat(32), secret: "b".repeat(64) }, hgAPI: {
      hgCallCreate: async (hgCommand) => { hgCommands.push(hgCommand); if (hgCommands.length === 1) throw new Error("结果未知"); return { callId: "c".repeat(32), version: 1, state: "ringing", callerId: "user-1", conversationId: hgCommand.conversationId }; },
    } };
    const hgPanel = new HGIMCallPanel({ vm: hgVM, deviceReady: true, conversationId: "12" });
    hgSyncState(hgPanel);
    hgPanel.hgMounted = true;
    hgPanel.hgRefresh = () => {}; // 不启动状态轮询；仅测试创建请求。
    assert.doesNotMatch(renderToStaticMarkup(hgPanel.render()), /语音通话|视频通话/);
    await hgPanel.hgCreate("audio");
    assert.equal(hgCommands.length, 1);
    assert.equal(hgCommands[0].mediaType, "audio");
    assert.equal(hgCommands[0].conversationId, "12");
    assert.ok(hgCommands[0].requestId);
    hgPanel.props.conversationId = "13";
    await hgPanel.hgCreate("audio");
    assert.equal(hgCommands.length, 1);
    assert.match(hgPanel.state.hgError, /原会话/);
    hgPanel.props.conversationId = "12";
    await hgPanel.hgCreate("video");
    assert.equal(hgCommands.length, 1);
    await hgPanel.hgCreate("audio");
    assert.equal(hgCommands.length, 2);
    assert.strictEqual(hgCommands[1], hgCommands[0]);
    assert.equal(hgPanel.state.hgCall.state, "ringing");
  });

  await hgTest.test("视频入口发起本人会话的 video 呼叫，无设备时不请求", async () => {
    const hgCommands = []; // 模拟视频呼叫请求，不连接 LiveKit 或访问摄像头。
    const hgVM = { hgOwner: "user-1", hgAlive: () => true, hgCredential: { deviceId: "a".repeat(32), secret: "b".repeat(64) }, hgAPI: {
      hgCallCreate: async (hgCommand) => { hgCommands.push(hgCommand); return { callId: "d".repeat(32), version: 1, state: "ringing", callerId: "user-1", conversationId: hgCommand.conversationId }; },
    } };
    const hgPanel = new HGIMCallPanel({ vm: hgVM, deviceReady: false, conversationId: "42" });
    hgSyncState(hgPanel);
    hgPanel.hgMounted = true;
    hgPanel.hgRefresh = () => {};
    await hgPanel.hgCreate("video");
    assert.equal(hgCommands.length, 0);
    assert.match(hgPanel.state.hgError, /重新登录/);
    hgPanel.props.deviceReady = true;
    await hgPanel.hgCreate("video");
    assert.equal(hgCommands.length, 1);
    assert.equal(hgCommands[0].mediaType, "video");
    assert.equal(hgCommands[0].conversationId, "42");
  });
});
