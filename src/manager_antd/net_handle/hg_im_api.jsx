import HGNet from "./hg_net_manager_vm";
import { HGMANAGER_API as HGAPI } from "../api/hg_api_constants";
import { hgIMOwner } from "../storage/hg_im_session";

/** IM API 只通过既有请求链访问 Go；设备 secret 只进入 POST body。signal 由页面生命周期提供。 */
export default class HGIMAPI {
  constructor(hgSignal) {
    const hgOwner = hgIMOwner(); // 固定 API 实例账号，禁止异步任务借用新登录账号发送。
    this.hgOptions = { signal: hgSignal, validateRequest: () => {
      hgSignal.throwIfAborted();
      if (!hgOwner || hgIMOwner() !== hgOwner) throw { type: "AUTH_ERROR", status: 401, message: "聊天账号已变化" };
    } }; // 本页全部请求取消/归属检查；刷新重试仍执行同一检查。
  }

  hgConversations = (cursor = "") => HGNet.get(HGAPI.IM_CONVERSATIONS, cursor ? { cursor } : {}, this.hgOptions);
  hgCreateConversation = (peerId) => HGNet.post(HGAPI.IM_CONVERSATIONS, { peerId }, this.hgOptions);
  hgMessages = (conversationId, afterSeq = 0) => HGNet.get(HGAPI.IM_CONVERSATION_MESSAGES, { conversationId, afterSeq }, this.hgOptions);
  hgSend = (body) => HGNet.post(HGAPI.IM_SEND, body, this.hgOptions);
  hgRead = (conversationId, lastReadSeq) => HGNet.post(HGAPI.IM_CONVERSATION_READ, { conversationId, lastReadSeq }, this.hgOptions);
  hgRegister = () => HGNet.post(HGAPI.IM_DEVICE_REGISTER, {}, this.hgOptions);
  hgPending = (credential, after = 0) => HGNet.post(HGAPI.IM_DEVICE_PENDING, { ...credential, after }, this.hgOptions);
  hgAck = (credential, messageId) => HGNet.post(HGAPI.IM_DEVICE_ACK, { ...credential, messageId }, this.hgOptions);
  hgRevoke = (credential) => HGNet.post(HGAPI.IM_DEVICE_REVOKE, credential, this.hgOptions);
  hgRealtimeToken = (credential) => HGNet.post(HGAPI.IM_REALTIME_TOKEN, credential, this.hgOptions);
  hgUploadInit = (body) => HGNet.post(HGAPI.IM_MEDIA_INIT, body, this.hgOptions);
  hgUploadComplete = (mediaId) => HGNet.post(HGAPI.IM_MEDIA_COMPLETE, { mediaId }, this.hgOptions);
  hgMediaStatus = (mediaId) => HGNet.get(HGAPI.IM_MEDIA_STATUS, { mediaId }, this.hgOptions);
  hgMediaDelete = (mediaId) => HGNet.post(HGAPI.IM_MEDIA_DELETE, { mediaId }, this.hgOptions);
  hgMediaRange = (mediaId, start, end, signal) => HGNet.get(HGAPI.IM_MEDIA_READ, { mediaId }, {
    ...this.hgOptions, signal: signal || this.hgOptions.signal, headers: { Range: `bytes=${start}-${end}` },
    responseType: "bytes", maxResponseBytes: 4 * 1024 * 1024, timeout: 30000,
  });
  hgCallCreate = (body) => HGNet.post(HGAPI.IM_CALLS, body, this.hgOptions);
  hgCallGet = (callId) => HGNet.get(HGAPI.IM_CALLS, { callId }, this.hgOptions);
  hgCallAction = (credential, callId, action) => HGNet.post(HGAPI.IM_CALL_ACTION, { ...credential, callId, action }, this.hgOptions);
  hgCallToken = (credential, callId) => HGNet.post(HGAPI.IM_CALL_TOKEN, { ...credential, callId }, { ...this.hgOptions, timeout: 15000 });
}
