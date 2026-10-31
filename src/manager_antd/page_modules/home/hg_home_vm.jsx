import HGIMAPI from "../../net_handle/hg_im_api";
import { hgIMOwner, hgIMSession } from "../../storage/hg_im_session";
import HGIMRealtime from "./hg_im_realtime";
import { HG_IM_CONNECTION_EVENT } from "./hg_im_connection_events";

/** JSON 数字协议超过 JS 安全整数时拒绝推进游标，避免静默漏消息。 */
export function hgIMSeq(hgValue) {
  if (!Number.isSafeInteger(hgValue) || hgValue < 0) throw new Error("消息序号超出浏览器安全范围");
  return hgValue;
}

/** 只检查协议字段，不从指针推断正文或设备送达。 */
function hgIMMessages(hgResult) {
  const hgList = hgResult?.list; // Go 按 seq 升序返回，单次最多 50 条。
  if (!Array.isArray(hgList) || hgList.length > 50) throw new Error("消息列表协议不合法");
  for (const hgItem of hgList) {
    if (!/^[1-9]\d*$/.test(hgItem.messageId) || !hgItem.content || hgIMSeq(hgItem.seq) < 1) throw new Error("消息内容协议不合法");
  }
  return hgList;
}

/** 首页业务 VM：有限窗口历史、幂等命令、逐设备 ACK 和实时补拉。 */
export default class HGHomeVM {
  hgController = new AbortController(); // 页面卸载/切换账号时取消所有 Go 请求。
  hgOwner = hgIMOwner(); // 固定本次页面账号；每轮异步完成前检查归属。
  hgAPI = new HGIMAPI(this.hgController.signal); // 复用签名、刷新与错误语义。
  hgCredential = null; // 仅当前账号设备凭据；无凭据时 HTTP 聊天仍可用。
  hgRealtime = null; // 可重建的 Centrifugo 连接。
  hgConnecting = null; // 获取 token / 建立 SDK 连接的单飞任务；null 表示可发起新一轮。
  hgConnectionTimer = null; // SDK 自动重试的 20 秒观察窗口，超时才报告不可用。
  hgConnectionState = "idle"; // idle/connecting/connected/failed，供顶栏展示最终连接状态。
  hgTimer = null; // 8 秒补拉兜底；单次请求结束后再调度。
  hgBusy = false; // 单飞同步，合并大量 publication。
  hgAgain = false; // 同步期间有指针到达时安排下一轮。
  hgSelection = 0; // 历史窗口版本，切换会话/翻页使旧响应失效。
  hgClosed = false; // 关闭后禁止发出状态、ACK 或新请求。
  hgListCursor = ""; // 会话主键倒序游标，不按时间猜测。
  hgWindowAfter = null; // 当前连续历史水位；null 表示尚未建立快照。
  hgLoadingSelection = null; // 同一窗口补拉单飞；null 表示当前无请求。
  hgFollow = true; // true 追最新，false 停留历史页不被轮询覆盖。
  hgState = {
    conversations: [], // 最多 300 个已加载会话；更大集合需后续服务器搜索能力。
    activeId: "", // 未选择时为空。
    messages: [], // 当前会话最多 200 条内存窗口，正文不持久化。
    loading: true, // 初始加载/历史切换状态。
    moreConversations: false, // 后端整页返回时才允许继续翻页。
    realtime: "正在连接", // 连接状态与消息送达独立。
    error: "", // 可重试业务错误；不展示原始外部响应或秘密。
    deviceReady: false, // 仅设备注册/凭据恢复成功后置 true。
  };

  constructor(hgOnState, hgOnCallHint) {
    this.hgOnState = hgOnState; // Promise 在 React 状态应用后完成，随后才 ACK。
    this.hgOnCallHint = hgOnCallHint; // callId 指针交给通话状态机鉴权查询。
  }

  hgAlive = () => !this.hgClosed && !!this.hgOwner && hgIMOwner() === this.hgOwner;

  /** 所有响应按固定账号归属提交，跨账号的旧数据不可显示。 */
  async hgEmit(hgPatch) {
    if (!this.hgAlive()) return;
    this.hgState = { ...this.hgState, ...hgPatch };
    await this.hgOnState(this.hgState);
  }

  /** 错误只给固定中文操作语义，鉴权/禁用/忙线单独提示。 */
  hgError(hgError, hgOperation = "同步") {
    if (!this.hgAlive() || hgError?.name === "AbortError") return;
    const hgReason = hgError?.status === 401 ? "登录已失效，请重新登录" : hgError?.status === 403 ? "权限或设备凭据已失效" : hgError?.status === 409 ? "状态冲突或额度不足" : hgError?.status === 503 ? "后端能力未启用或依赖不可用" : "请求失败，可重试";
    void this.hgEmit({ error: `${hgOperation}：${hgReason}` });
  }

  /** 首页仅恢复登录时注册的设备；缺失时仍保留 HTTP 会话，不在页面额外注册。 */
  async hgStart() {
    if (!this.hgAlive()) { await this.hgOnState({ ...this.hgState, loading: false, error: "请重新登录后打开聊天" }); return; }
    const hgStored = hgIMSession(this.hgOwner).credential; // 与账号绑定的标签页凭据。
    if (/^[a-f0-9]{32}$/.test(hgStored?.deviceId) && /^[a-f0-9]{64}$/.test(hgStored?.secret)) {
      this.hgCredential = hgStored;
      await this.hgEmit({ deviceReady: true });
      void this.hgReconnect();
    } else {
      await this.hgEmit({ realtime: "未绑定聊天设备，请退出后重新登录 · HTTP 补拉中", error: "无本设备凭据，请退出后重新登录以注册聊天设备" });
      this.hgPublishConnection("failed", "无本设备凭据，请退出后重新登录以注册聊天设备");
    }
    await this.hgSync();
  }

  /** 只向顶栏发布当前账号的安全状态，不传递 token/设备 secret 或原始异常。 */
  hgPublishConnection(hgState, hgReason = "") {
    if (!this.hgAlive()) return;
    this.hgConnectionState = hgState;
    window.dispatchEvent(new CustomEvent(HG_IM_CONNECTION_EVENT, {
      detail: { owner: this.hgOwner, state: hgState, reason: hgReason },
    }));
  }

  /** SDK 自行重试，连续 20 秒未连上才标红；订阅恢复立即清除失败状态。 */
  hgOnRealtimeStatus = (hgStatus) => {
    if (!this.hgAlive()) return;
    void this.hgEmit({ realtime: hgStatus });
    if (hgStatus === "实时已连接") {
      clearTimeout(this.hgConnectionTimer);
      this.hgConnectionTimer = null;
      this.hgPublishConnection("connected");
      return;
    }
    if (this.hgConnectionState === "connected") this.hgPublishConnection("connecting");
    if (!this.hgConnectionTimer && this.hgConnectionState !== "failed") {
      this.hgConnectionTimer = setTimeout(() => {
        this.hgConnectionTimer = null;
        if (!this.hgAlive() || this.hgConnectionState === "connected") return;
        const hgReason = typeof navigator !== "undefined" && navigator.onLine === false ? "网络已断开，聊天实时连接失败；HTTP 补拉将在网络恢复后继续" : "聊天实时连接超时，消息仍通过 HTTP 补拉；请检查网络或稍后点击 Chat 重试";
        void this.hgEmit({ realtime: "实时不可用 · HTTP 补拉中" });
        this.hgPublishConnection("failed", hgReason);
      }, 20000);
    }
  };

  /** 重建网关连接，token 获取瞬态失败仅再试一次；不重复注册设备。 */
  hgReconnect() {
    if (!this.hgAlive() || !this.hgCredential) return Promise.resolve();
    if (this.hgConnecting) return this.hgConnecting;
    this.hgConnecting = (async () => {
      clearTimeout(this.hgConnectionTimer);
      this.hgConnectionTimer = null;
      this.hgRealtime?.hgClose();
      this.hgPublishConnection("connecting");
      this.hgOnRealtimeStatus("实时重连中 · HTTP 补拉可用");
      for (let hgAttempt = 0; hgAttempt < 2 && this.hgAlive(); hgAttempt++) {
        const hgRealtime = new HGIMRealtime(this.hgAPI, this.hgCredential, this.hgHint,
          this.hgOnRealtimeStatus, this.hgSchedule);
        this.hgRealtime = hgRealtime;
        try {
          await hgRealtime.hgStart();
          return; // 已启动 SDK；后续短暂断线交由 SDK 自动重试和超时观察。
        } catch (hgError) {
          hgRealtime.hgClose();
          if (!this.hgAlive()) return;
          if (hgAttempt === 0 && ![401, 403].includes(hgError?.status)) continue;
          clearTimeout(this.hgConnectionTimer);
          this.hgConnectionTimer = null;
          const hgReason = hgError?.status === 401 ? "登录已失效，请重新登录" : hgError?.status === 403 ? "设备凭据已失效，请退出后重新登录" : hgError?.status === 503 ? "实时服务暂不可用，HTTP 补拉中" : "实时连接失败，请检查网络或稍后点击 Chat 重试；HTTP 补拉中";
          await this.hgEmit({ realtime: "实时不可用 · HTTP 补拉中" });
          this.hgPublishConnection("failed", hgReason);
        }
      }
    })().finally(() => { this.hgConnecting = null; });
    return this.hgConnecting;
  }

  /** 只接受有界指针；重复或乱序消息统一触发权威同步。 */
  hgHint = (hgHint) => {
    if (!this.hgAlive() || !hgHint || typeof hgHint !== "object") return;
    if (typeof hgHint.callId === "string" && /^[a-f0-9]{32}$/.test(hgHint.callId)) this.hgOnCallHint(hgHint.callId);
    this.hgSchedule();
  };

  hgSchedule = () => {
    if (!this.hgAlive()) return;
    if (this.hgBusy) { this.hgAgain = true; return; }
    clearTimeout(this.hgTimer);
    this.hgTimer = setTimeout(() => void this.hgSync(), 250);
  };

  /** 有界同步：一页会话、两页活跃消息、最多四个 pending 会话；不会并发风暴。 */
  async hgSync() {
    if (!this.hgAlive() || this.hgBusy) return;
    this.hgBusy = true;
    clearTimeout(this.hgTimer);
    try {
      await this.hgLoadConversations(false);
      if (!this.hgAlive()) return;
      if (!this.hgState.activeId && this.hgState.conversations[0]) await this.hgSelect(this.hgState.conversations[0].conversationId);
      else if (this.hgFollow) await this.hgLatest(false);
      if (this.hgAlive() && this.hgCredential) {
        try { await this.hgDrainPending(); }
        catch (hgError) {
          if (hgError?.status === 403) {
            this.hgCredential = null;
            hgIMSession(this.hgOwner, { credential: null });
            this.hgRealtime?.hgClose();
            await this.hgEmit({ deviceReady: false, realtime: "设备已失效，请退出后重新登录" });
            clearTimeout(this.hgConnectionTimer);
            this.hgConnectionTimer = null;
            this.hgPublishConnection("failed", "设备已失效，请退出后重新登录");
          }
          throw hgError;
        }
      }
    } catch (hgError) { this.hgError(hgError); }
    finally {
      this.hgBusy = false;
      await this.hgEmit({ loading: false });
      if (this.hgAlive()) this.hgTimer = setTimeout(() => void this.hgSync(), this.hgAgain ? 1000 : 8000);
      this.hgAgain = false;
    }
  }

  async hgLoadConversations(hgMore) {
    if (hgMore && (!this.hgState.moreConversations || this.hgState.conversations.length >= 300)) return;
    const hgResult = await this.hgAPI.hgConversations(hgMore ? this.hgListCursor : ""); // 一页 30 条。
    if (!this.hgAlive()) return;
    if (!Array.isArray(hgResult?.list)) throw new Error("会话列表协议不合法");
    const hgMap = new Map(this.hgState.conversations.map((hgItem) => [hgItem.conversationId, hgItem])); // 保留已加载旧页。
    for (const hgItem of hgResult.list) {
      hgIMSeq(hgItem.lastSeq); hgIMSeq(hgItem.lastReadSeq);
      if (!/^[1-9]\d*$/.test(hgItem.conversationId)) throw new Error("会话 ID 不合法");
      hgMap.set(hgItem.conversationId, hgItem);
    }
    if (hgMore || !this.hgListCursor) this.hgListCursor = hgResult.list.at(-1)?.conversationId || this.hgListCursor;
    await this.hgEmit({ conversations: [...hgMap.values()].sort((hgLeft, hgRight) => BigInt(hgLeft.conversationId) > BigInt(hgRight.conversationId) ? -1 : 1).slice(0, 300),
      moreConversations: hgMore || hgMap.size <= 30 ? hgResult.list.length === 30 : this.hgState.moreConversations });
  }

  /** 新建单聊与用户输入绑定；创建返回的旧会话可能不在列表第一页。 */
  async hgCreateConversation(hgPeer) {
    if (!hgPeer.trim() || new TextEncoder().encode(hgPeer.trim()).length > 128) throw new Error("请输入有效用户 ID");
    const hgResult = await this.hgAPI.hgCreateConversation(hgPeer.trim()); // 服务端验证双方身份与唯一会话。
    if (!this.hgAlive()) return;
    if (!this.hgState.conversations.some((hgItem) => hgItem.conversationId === hgResult.conversationId)) {
      await this.hgEmit({ conversations: [...this.hgState.conversations.slice(0, 299), { conversationId: hgResult.conversationId, peer: { userId: hgPeer.trim(), name: hgPeer.trim() }, lastSeq: 0, lastReadSeq: 0 }] });
    }
    await this.hgSelect(hgResult.conversationId);
  }

  async hgSelect(hgID) {
    const hgVersion = ++this.hgSelection; // 同步等待 React 提交期间可能已切换到另一个会话。
    this.hgWindowAfter = null;
    this.hgFollow = true;
    await this.hgEmit({ activeId: hgID, messages: [], loading: true, error: "" });
    if (hgVersion !== this.hgSelection || !this.hgAlive()) return;
    try { await this.hgLatest(true); }
    finally { if (hgVersion === this.hgSelection) await this.hgEmit({ loading: false }); }
  }

  /** 从明确 afterSeq 连续读取，序号有洞时不越过；初始窗口允许从服务器最新值向前取 50 条。 */
  async hgLatest(hgReset) {
    const hgID = this.hgState.activeId; // 捕获会话，避免切换后响应污染。
    const hgSelection = this.hgSelection; // 捕获窗口版本。
    if (!hgID) return;
    if (this.hgLoadingSelection === hgSelection) return;
    this.hgLoadingSelection = hgSelection;
    try {
      const hgConversation = this.hgState.conversations.find((hgItem) => hgItem.conversationId === hgID); // 最新列表快照。
      let hgAfter = hgReset || this.hgWindowAfter === null ? Math.max(0, (hgConversation?.lastSeq || 0) - 50) : this.hgWindowAfter;
      for (let hgPage = 0; hgPage < 2 && this.hgAlive(); hgPage++) {
        const hgList = hgIMMessages(await this.hgAPI.hgMessages(hgID, hgAfter)); // 每轮最多两页；剩余由下一轮继续。
        if (!this.hgAlive() || hgSelection !== this.hgSelection || !this.hgFollow) return;
        for (const hgItem of hgList) {
          if (hgItem.seq !== hgAfter + 1) throw new Error("消息序号不连续，请重新同步");
          hgAfter = hgItem.seq;
        }
        const hgMap = new Map((hgReset && hgPage === 0 ? [] : this.hgState.messages).map((hgItem) => [hgItem.messageId, hgItem]));
        hgList.forEach((hgItem) => hgMap.set(hgItem.messageId, hgItem));
        this.hgWindowAfter = hgAfter;
        await this.hgEmit({ messages: [...hgMap.values()].sort((hgLeft, hgRight) => hgLeft.seq - hgRight.seq).slice(-200) });
        if (hgList.length < 50) break;
      }
    } finally { if (this.hgLoadingSelection === hgSelection) this.hgLoadingSelection = null; }
  }

  /** 按 seq 连续拼接历史页，裁剪另一端保持 200 条内存窗口；历史浏览不自动上报已读。 */
  async hgHistory(hgDirection) {
    if (this.hgState.loading || !this.hgState.activeId) return 0;
    if (hgDirection === "latest") return this.hgSelect(this.hgState.activeId);
    const hgID = this.hgState.activeId; // 固定此次翻页目标。
    const hgVersion = ++this.hgSelection; // 使正在轮询的响应失效。
    const hgAfter = hgDirection === "older" ? Math.max(0, (this.hgState.messages[0]?.seq || 1) - 51) : this.hgState.messages.at(-1)?.seq || 0;
    this.hgFollow = false;
    await this.hgEmit({ loading: true });
    try {
      const hgList = hgIMMessages(await this.hgAPI.hgMessages(hgID, hgAfter));
      if (hgVersion !== this.hgSelection || !this.hgAlive()) return 0;
      let hgExpected = hgAfter; // 翻页仍按连续 seq 验证，不能因服务端缺页跳过未展示消息。
      for (const hgItem of hgList) {
        if (hgItem.seq !== ++hgExpected) throw new Error("消息序号不连续，请重新同步");
      }
      const hgCurrent = this.hgState.messages; // 可能已有实时响应；只接受同会话同版本数据。
      const hgEdge = hgDirection === "older" ? hgCurrent[0]?.seq : hgCurrent.at(-1)?.seq; // 本次需要紧邻的序号。
      const hgAdjacent = hgDirection === "older" ? hgList.filter((hgItem) => hgItem.seq < hgEdge) : hgList.filter((hgItem) => hgItem.seq > hgEdge);
      if (hgAdjacent.length && (hgDirection === "older" ? hgAdjacent.at(-1).seq !== hgEdge - 1 : hgAdjacent[0].seq !== hgEdge + 1)) throw new Error("消息序号不连续，请重新同步");
      if (hgAdjacent.length) {
        const hgMessages = (hgDirection === "older" ? [...hgAdjacent, ...hgCurrent].slice(0, 200) : [...hgCurrent, ...hgAdjacent].slice(-200)); // 有界窗口。
        const hgLastSeq = this.hgState.conversations.find((hgItem) => hgItem.conversationId === hgID)?.lastSeq || 0;
        this.hgFollow = hgDirection === "newer" && hgMessages.at(-1)?.seq >= hgLastSeq;
        if (this.hgFollow) this.hgWindowAfter = hgMessages.at(-1).seq;
        await this.hgEmit({ messages: hgMessages });
      }
      return hgAdjacent.length;
    } finally { if (hgVersion === this.hgSelection) await this.hgEmit({ loading: false }); }
  }

  /** pending 只确认已呈现的当前连续窗口；跳过未展示的旧指针但不 ACK，避免阻塞其他会话。 */
  async hgDrainPending() {
    const hgActive = this.hgState.activeId; // 未切换时同一会话的已呈现消息。
    const hgPresented = new Map(this.hgState.messages.map((hgItem) => [hgItem.messageId, hgItem.seq])); // 保留已上屏的正文身份。
    let hgAfter = 0; // messageId 游标；每次最多四页，旧指针不会永久挡住新指针。
    for (let hgPage = 0; hgPage < 4 && this.hgAlive(); hgPage++) {
      const hgResult = await this.hgAPI.hgPending(this.hgCredential, hgAfter);
      if (!this.hgAlive() || !Array.isArray(hgResult?.list) || hgResult.list.length > 100) throw new Error("待确认指针协议不合法");
      const hgAckable = []; // 本页已呈现且正文和 ID/seq 匹配的记录。
      for (const hgItem of hgResult.list) {
        hgIMSeq(hgItem.seq);
        const hgID = Number(hgItem.messageId); // JSON 响应 ID 是十进制字符串，游标仅在安全整数范围使用。
        if (!Number.isSafeInteger(hgID) || hgID <= hgAfter) throw new Error("待确认游标不连续");
        hgAfter = hgID;
        if (hgItem.conversationId === hgActive && hgPresented.get(hgItem.messageId) === hgItem.seq) hgAckable.push(hgItem);
      }
      for (let hgIndex = 0; hgIndex < hgAckable.length && this.hgAlive(); hgIndex += 4) {
        if (this.hgState.activeId !== hgActive) return; // 切换会话后不再确认已离开页面的消息。
        await Promise.all(hgAckable.slice(hgIndex, hgIndex + 4).map((hgItem) => this.hgAPI.hgAck(this.hgCredential, hgItem.messageId)));
      }
      if (hgResult.list.length < 100) break;
    }
  }

  /** 只接受显式用户已读操作，不把补拉/后台 ACK 解释为阅读。 */
  async hgMarkRead() {
    const hgID = this.hgState.activeId; // 本次展示的会话。
    const hgSeq = this.hgState.messages.at(-1)?.seq || 0; // 只到当前展示窗口末尾。
    if (!hgID || !hgSeq || document.visibilityState !== "visible") return;
    await this.hgAPI.hgRead(hgID, hgSeq);
    await this.hgEmit({ conversations: this.hgState.conversations.map((hgItem) => hgItem.conversationId === hgID ? { ...hgItem, lastReadSeq: Math.max(hgItem.lastReadSeq, hgSeq) } : hgItem) });
  }

  /** 发送只返回持久化回执；重新补拉而非将 receipt.seq 作为连续水位。 */
  async hgSend(hgCommand) {
    const hgResult = await this.hgAPI.hgSend(hgCommand);
    if (!this.hgAlive()) return;
    if (!hgResult?.message?.messageId) throw new Error("服务端未确认发送");
    this.hgSchedule();
    return hgResult.message;
  }

  /** 退出显式撤销；失败由页面提示，避免声称已吊销。 */
  async hgRevoke() {
    if (this.hgCredential) await this.hgAPI.hgRevoke(this.hgCredential);
    hgIMSession(this.hgOwner, { credential: null, callId: "" });
    this.hgCredential = null;
    this.hgRealtime?.hgClose();
    clearTimeout(this.hgConnectionTimer);
    this.hgConnectionTimer = null;
    this.hgPublishConnection("idle"); // 用户主动撤销并非连接故障，不弹失败 toast。
    await this.hgEmit({ deviceReady: false, realtime: "当前设备已撤销" });
  }

  hgClose() {
    if (this.hgAlive()) this.hgPublishConnection("idle");
    this.hgClosed = true;
    clearTimeout(this.hgTimer);
    clearTimeout(this.hgConnectionTimer);
    this.hgController.abort();
    this.hgRealtime?.hgClose();
    this.hgCredential = null;
  }
}
