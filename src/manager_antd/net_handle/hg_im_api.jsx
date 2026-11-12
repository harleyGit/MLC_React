import HGNet from "./hg_net_manager_vm";
import { HGMANAGER_API as HGAPI } from "../api/hg_api_constants";
import { hgIMOwner } from "../storage/hg_im_session";

/** IM 控制接口沿用请求链；消息发送/补拉走绑定设备的 Centrifugo RPC。 */
export default class HGIMAPI {
  hgRealtime = null; // 页面当前设备的实时连接；null 时消息操作失败关闭。
  constructor(hgSignal) {
    const hgOwner = hgIMOwner(); // 固定 API 实例账号，禁止异步任务借用新登录账号发送。
    this.hgOptions = { signal: hgSignal, validateRequest: () => {
      hgSignal.throwIfAborted();
      if (!hgOwner || hgIMOwner() !== hgOwner) throw { type: "AUTH_ERROR", status: 401, message: "聊天账号已变化" };
    } }; // 本页全部请求取消/归属检查；刷新重试仍执行同一检查。
  }

  hgConversations = (cursor = "") => HGNet.get(HGAPI.IM_CONVERSATIONS, cursor ? { cursor } : {}, this.hgOptions);
  hgSelfProfile = () => HGNet.get(HGAPI.PROFILE, {}, this.hgOptions);
  hgPeerProfile = (userId) => HGNet.get(HGAPI.IM_CONTACT_PROFILE, { userId }, this.hgOptions);
  hgCreateConversation = (peerId) => HGNet.post(HGAPI.IM_CONVERSATIONS, { peerId }, this.hgOptions);
  hgSetMuted = (conversationId, muted) => HGNet.post(HGAPI.IM_CONVERSATION_MUTED, { conversationId, muted }, this.hgOptions);
  hgDeleteConversation = (conversationId, baseSeq) => HGNet.post(HGAPI.IM_CONVERSATION_DELETE, { conversationId, baseSeq }, this.hgOptions);
  hgRPC = (hgMethod, hgData) => {
    this.hgOptions.validateRequest();
    if (!this.hgRealtime) throw new Error("聊天实时连接尚未建立");
    return this.hgRealtime.hgRPC(hgMethod, hgData);
  };
  hgMessages = (conversationId, afterSeq = 0) => this.hgRPC("history", { conversationId, afterSeq });
  hgSend = (body) => this.hgRPC("send", body);
  hgRead = (conversationId, lastReadSeq) => HGNet.post(HGAPI.IM_CONVERSATION_READ, { conversationId, lastReadSeq }, this.hgOptions);
  hgRegister = () => HGNet.post(HGAPI.IM_DEVICE_REGISTER, {}, this.hgOptions);
  hgPending = (_credential, after = 0) => this.hgRPC("pending", { after });
  hgAck = (_credential, messageId) => this.hgRPC("ack", { messageId });
  hgRevoke = (credential) => HGNet.post(HGAPI.IM_DEVICE_REVOKE, credential, this.hgOptions);
  hgRealtimeToken = (credential) => HGNet.post(HGAPI.IM_REALTIME_TOKEN, credential, this.hgOptions);
  hgUploadInit = (body) => HGNet.post(HGAPI.IM_MEDIA_INIT, body, this.hgOptions);
  hgUploadComplete = (mediaId) => HGNet.post(HGAPI.IM_MEDIA_COMPLETE, { mediaId }, this.hgOptions);
  hgMediaStatus = (mediaId) => HGNet.get(HGAPI.IM_MEDIA_STATUS, { mediaId }, this.hgOptions);
  hgMediaDelete = (mediaId) => HGNet.post(HGAPI.IM_MEDIA_DELETE, { mediaId }, this.hgOptions);
  /** 每段通过 RPC 重新授权，再用短时签名直接读私有 SeaweedFS；不经 Go HTTP 传文件字节。 */
  hgMediaRange = async (mediaId, start, end, signal) => {
    const hgGrant = await this.hgRPC("media_read", { mediaId }); // URL 仅内存使用，不记录或写入 DOM。
    const hgURL = new URL(hgGrant?.url);
    if (hgURL.protocol !== "https:" && !(hgURL.protocol === "http:" && ["localhost", "127.0.0.1"].includes(hgURL.hostname))) throw new Error("私有媒体地址不安全");
    const hgResponse = await fetch(hgURL, { headers: { Range: `bytes=${start}-${end}` }, signal: signal || this.hgOptions.signal, redirect: "error", cache: "no-store" });
    if (![200, 206].includes(hgResponse.status) || !hgResponse.body) throw new Error("私有媒体读取失败");
    const hgReader = hgResponse.body.getReader();
    const hgParts = []; // 单段最大 4MiB；超过立即取消，避免对象存储异常响应耗尽内存。
    let hgBytes = 0;
    try {
      while (true) {
        const { done, value } = await hgReader.read();
        if (done) break;
        hgBytes += value.byteLength;
        if (hgBytes > 4 * 1024 * 1024) throw new Error("媒体分段超限");
        hgParts.push(value);
      }
    } catch (hgError) {
      await hgReader.cancel().catch(() => {});
      throw hgError;
    }
    return { status: hgResponse.status, headers: hgResponse.headers, blob: new Blob(hgParts, { type: hgResponse.headers.get("Content-Type") || "" }) };
  };
  hgCallCreate = (body) => HGNet.post(HGAPI.IM_CALLS, body, this.hgOptions);
  hgCallGet = (callId) => HGNet.get(HGAPI.IM_CALLS, { callId }, this.hgOptions);
  hgCallAction = (credential, callId, action) => HGNet.post(HGAPI.IM_CALL_ACTION, { ...credential, callId, action }, this.hgOptions);
  hgCallToken = (credential, callId) => HGNet.post(HGAPI.IM_CALL_TOKEN, { ...credential, callId }, { ...this.hgOptions, timeout: 15000 });
}
