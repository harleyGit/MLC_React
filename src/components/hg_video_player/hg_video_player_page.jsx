import React from "react";
import HGTooltipPage from "../hg_tooltip/hg_tooltip_page";
import {
  buildVideoDanmakuWebSocketURL,
  createVideoDanmaku,
  getVideoDanmaku,
  getVideoDanmakuTicket,
} from "../../pages/bilibili/hg_bili_danmaku_api";
import {
  buildVideoDanmakuCreateBody,
  buildVideoDanmakuSocketCommand,
  HG_VIDEO_DANMAKU_MAX_LENGTH,
} from "../../pages/bilibili/hg_bili_danmaku_request";
import styles from "./hg_video_player.module.css";

/**
 * SVG 图标组件（双状态：正常/激活）。
 */
const Icon = {
  Play: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 5.14v13.72a1 1 0 001.5.86l11.04-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"
        fill="currentColor"
      />
    </svg>
  ),
  Pause: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  ),
  VolumeHigh: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
      <path
        d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  VolumeLow: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
      <path
        d="M15.54 8.46a5 5 0 010 7.07"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  VolumeMute: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
      <line
        x1="23"
        y1="9"
        x2="17"
        y2="15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="17"
        y1="9"
        x2="23"
        y2="15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** 全屏（正常状态） */
  Fullscreen: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** 退出全屏（激活状态） */
  FullscreenExit: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** 网页全屏（正常状态） */
  WebFullscreen: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 8h20" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  /** 退出网页全屏（激活状态） */
  WebFullscreenExit: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 8h20" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 4v4M15 4v4M9 16v4M15 16v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** 宽屏（正常状态） */
  Widescreen: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="1"
        y="7"
        width="22"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  /** 宽屏（激活状态 - 更宽） */
  WidescreenActive: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="1"
        y="8"
        width="22"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M1 12h22" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  ),
  /** 弹幕（正常状态） */
  Danmaku: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6 9h8M6 13h12M6 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** 弹幕关闭（激活状态） */
  DanmakuOff: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6 9h8M6 13h12M6 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="20"
        x2="22"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  Close: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** 画中画 */
  PictureInPicture: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="3"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="11"
        y="9"
        width="9"
        height="6"
        rx="1"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  ),
  /** 截图 */
  Screenshot: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 9h2M19 9h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

/**
 * 格式化时长（秒 -> mm:ss）。
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
}

/**
 * 清晰度选项。
 */
const QUALITY_OPTIONS = [
  { key: "4k", label: "4K 超清", available: false },
  { key: "1080p60", label: "1080P 60帧", available: false },
  { key: "1080p", label: "1080P 高清", available: true },
  { key: "720p", label: "720P 高清", available: true },
  { key: "480p", label: "480P 清晰", available: true },
  { key: "360p", label: "360P 流畅", available: true },
];

/**
 * 播放模式枚举。
 */
const PLAY_MODE = {
  NORMAL: "normal",
  WIDE: "wide",
  WEB_FULLSCREEN: "web",
  FULLSCREEN: "full",
};

/**
 * 长按倍速值。
 */
const LONG_PRESS_RATE = 3;

/**
 * 视频播放组件，模仿 B 站播放器风格。
 */
class HGVideoPlayerPage extends React.Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.progressBarRef = React.createRef();
    this.playerContainerRef = React.createRef();
    this.clickTimer = null;
    this.longPressTimer = null;
    this.isLongPressing = false;
    this.lastClickTime = 0;
    this.danmakuSocket = null;
    this.danmakuReconnectTimer = null;
    this.danmakuLoadSequence = 0;
    this.loadedDanmakuWindows = new Set();
    this.launchedDanmakuIds = new Set();
    this.danmakuMounted = false;
    this.pendingDanmakuRequest = null;
    // 每个 gnet 创建命令以 requestId 等待独立 ack；断线、切换视频和卸载时必须全部 reject，避免 Promise/定时器泄漏。
    this.pendingDanmakuSocketCommands = new Map();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      playMode: PLAY_MODE.NORMAL,
      showControls: true,
      playbackRate: 1,
      showRateMenu: false,
      showDanmaku: true,
      danmakuList: [],
      activeDanmaku: [],
      danmakuContent: "",
      showDanmakuComposer: false,
      danmakuSubmitting: false,
      danmakuFeedback: "",
      danmakuTotalCount: 0,
      quality: "1080p",
      showQualityMenu: false,
      buffered: 0,
      isLongPressSpeed: false,
      screenshotUrl: null,
      showScreenshot: false,
      isPiP: false,
    };
    this.controlsTimer = null;
  }

  componentDidMount() {
    this.danmakuMounted = true;
    this.initializeDanmaku();
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      this.handleFullscreenChange
    );
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
  }

  componentDidUpdate(prevProps) {
    if (String(prevProps.video?.id || "") !== String(this.props.video?.id || "")) {
      this.initializeDanmaku();
    }
  }

  componentWillUnmount() {
    this.danmakuMounted = false;
    this.danmakuLoadSequence += 1;
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this.clickTimer) clearTimeout(this.clickTimer);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.danmakuReconnectTimer) clearTimeout(this.danmakuReconnectTimer);
    this.closeDanmakuSocket();
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange
    );
    document.removeEventListener(
      "webkitfullscreenchange",
      this.handleFullscreenChange
    );
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.exitPiP();
  }

  /**
   * 监听键盘按下事件。
   */
  handleKeyDown = (e) => {
    const { playMode } = this.state;
    if (e.key === "Escape") {
      if (playMode === PLAY_MODE.WEB_FULLSCREEN) {
        this.setPlayMode(PLAY_MODE.WEB_FULLSCREEN);
      } else if (playMode === PLAY_MODE.WIDE) {
        this.setPlayMode(PLAY_MODE.WIDE);
      }
      return;
    }
    if (e.key === " " && e.target.tagName !== "INPUT") {
      e.preventDefault();
      this.togglePlay();
    }
    if (e.key === "ArrowLeft") this.skipTime(-5);
    if (e.key === "ArrowRight") this.skipTime(5);
    if (e.key === "ArrowUp") this.adjustVolume(0.1);
    if (e.key === "ArrowDown") this.adjustVolume(-0.1);
    if (e.key === "f" || e.key === "F") this.setPlayMode(PLAY_MODE.FULLSCREEN);
    if (e.key === "m" || e.key === "M") this.toggleMute();
  };

  /**
   * 监听键盘松开事件。
   */
  handleKeyUp = (e) => {
    if (e.key === "Shift" && this.state.isLongPressSpeed) {
      this.endLongPressSpeed();
    }
  };

  /**
   * 快进/快退指定秒数。
   */
  skipTime = (seconds) => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    videoEl.currentTime = Math.max(
      0,
      Math.min(videoEl.duration, videoEl.currentTime + seconds)
    );
    this.resetControlsTimer();
  };

  /**
   * 调整音量。
   */
  adjustVolume = (delta) => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    const newVolume = Math.max(0, Math.min(1, videoEl.volume + delta));
    videoEl.volume = newVolume;
    this.setState({ volume: newVolume, isMuted: newVolume === 0 });
  };

  /**
   * 监听全屏状态变化。
   */
  handleFullscreenChange = () => {
    const isFullscreen = !!(
      document.fullscreenElement || document.webkitFullscreenElement
    );
    if (!isFullscreen && this.state.playMode === PLAY_MODE.FULLSCREEN) {
      this.setState({ playMode: PLAY_MODE.NORMAL });
    }
  };

  /**
   * 视频切换时清空上一个房间、历史窗口和飞行中的 DOM，再加载首个时间窗并连接实时网关。
   * sequence 使旧视频的迟到 HTTP 响应无法污染新视频状态。
   */
  initializeDanmaku = () => {
    this.danmakuLoadSequence += 1;
    this.loadedDanmakuWindows.clear();
    this.launchedDanmakuIds.clear();
    this.pendingDanmakuRequest = null;
    this.closeDanmakuSocket();
    this.setState({ danmakuList: [], activeDanmaku: [], danmakuContent: "", danmakuFeedback: "", danmakuTotalCount: 0 });
    if (!this.props.video?.id) return;
    this.loadDanmakuWindow(0);
    this.connectDanmakuSocket();
  };

  /** 按整分钟窗口去重加载，避免 timeupdate 高频重复请求。 */
  loadDanmakuWindow = async (timeMs) => {
    const videoId = String(this.props.video?.id || "");
    const windowStart = Math.floor(Math.max(0, timeMs) / 60000) * 60000;
    const windowKey = `${videoId}:${windowStart}`;
    if (!videoId || this.loadedDanmakuWindows.has(windowKey)) return;
    this.loadedDanmakuWindows.add(windowKey);
    const sequence = this.danmakuLoadSequence;
    try {
      let cursor = "";
      let pageCount = 0;
      let totalCount = 0;
      do {
        const response = await getVideoDanmaku(videoId, windowStart, cursor);
        if (!this.danmakuMounted || sequence !== this.danmakuLoadSequence) return;
        const items = response?.danmaku || [];
        this.mergeDanmaku(items);
        const currentMs = Math.floor((this.videoRef.current?.currentTime || 0) * 1000);
        items.filter((item) => Math.abs(item.progressMs - currentMs) <= 500).slice(0, 50).forEach(this.launchDanmaku);
        totalCount = Number(response?.totalCount) || totalCount;
        cursor = response?.hasMore ? response?.nextCursor || "" : "";
        pageCount += 1;
      } while (cursor && pageCount < 4);
      this.setState({ danmakuTotalCount: totalCount });
    } catch (error) {
      this.loadedDanmakuWindows.delete(windowKey);
      if (this.danmakuMounted && sequence === this.danmakuLoadSequence) this.setState({ danmakuFeedback: error?.message || "弹幕加载失败" });
    }
  };

  /** 按服务端 danmakuId 去重，HTTP 历史、发送响应和 WebSocket 广播可安全汇合。 */
  mergeDanmaku = (items) => {
    this.setState((state) => {
      const byId = new Map(state.danmakuList.map((item) => [item.danmakuId, item]));
      items.forEach((item) => { if (item?.danmakuId) byId.set(item.danmakuId, item); });
      return { danmakuList: Array.from(byId.values()).sort((a, b) => a.progressMs - b.progressMs) };
    });
  };

  /**
   * 先通过签名 HTTP 获取单次 ticket，再使用浏览器原生 WebSocket；长期 JWT 不进入 URL 或代理日志。
   */
  connectDanmakuSocket = async () => {
    const videoId = String(this.props.video?.id || "");
    if (!videoId) return;
    const sequence = this.danmakuLoadSequence;
    try {
      const ticket = await getVideoDanmakuTicket(videoId);
      if (!this.danmakuMounted || sequence !== this.danmakuLoadSequence) return;
      const socket = new WebSocket(buildVideoDanmakuWebSocketURL(ticket.webSocketPath, ticket.ticket));
      this.danmakuSocket = socket;
      socket.onopen = () => {
        if (this.danmakuMounted && sequence === this.danmakuLoadSequence) this.setState({ danmakuFeedback: "" });
      };
      socket.onmessage = (event) => {
        if (!this.danmakuMounted || sequence !== this.danmakuLoadSequence) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === "danmaku.created" && message.data?.videoId === videoId) {
            this.mergeDanmaku([message.data]);
            const currentMs = Math.floor((this.videoRef.current?.currentTime || 0) * 1000);
            if (Math.abs(message.data.progressMs - currentMs) <= 1500) this.launchDanmaku(message.data);
          } else if (message.type === "danmaku.ack" && message.requestId) {
            this.finishDanmakuSocketCommand(message.requestId, null, message.data);
          } else if (message.type === "error") {
            if (message.requestId) {
              const error = new Error(message.data?.message || "弹幕发送失败");
              // 服务端已给出确定业务结果，不允许再打 HTTP；仅连接级未知结果可使用幂等回退。
              error.allowHTTPFallback = false;
              this.finishDanmakuSocketCommand(message.requestId, error);
            }
            else this.setState({ danmakuFeedback: message.data?.message || "弹幕发送失败" });
          }
        } catch { /* 忽略无法识别的服务端消息，历史接口仍可恢复。 */ }
      };
      socket.onclose = () => {
        if (this.danmakuSocket === socket) {
          this.danmakuSocket = null;
          this.rejectDanmakuSocketCommands(new Error("弹幕实时连接已断开"));
        }
        if (this.danmakuMounted && sequence === this.danmakuLoadSequence) this.danmakuReconnectTimer = setTimeout(this.connectDanmakuSocket, 3000);
      };
    } catch {
      if (this.danmakuMounted && sequence === this.danmakuLoadSequence) this.danmakuReconnectTimer = setTimeout(this.connectDanmakuSocket, 5000);
    }
  };

  closeDanmakuSocket = () => {
    if (this.danmakuReconnectTimer) clearTimeout(this.danmakuReconnectTimer);
    this.danmakuReconnectTimer = null;
    this.rejectDanmakuSocketCommands(new Error("弹幕实时连接已断开"));
    if (this.danmakuSocket) { const socket = this.danmakuSocket; this.danmakuSocket = null; socket.onclose = null; socket.close(); }
  };

  finishDanmakuSocketCommand = (requestId, error, item) => {
    const pending = this.pendingDanmakuSocketCommands.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingDanmakuSocketCommands.delete(requestId);
    if (error) pending.reject(error);
    else pending.resolve(item);
  };

  /** 连接关闭时立即结束所有等待，调用方随后可用相同 requestId 走 HTTP 幂等恢复。 */
  rejectDanmakuSocketCommands = (error) => {
    for (const [requestId] of this.pendingDanmakuSocketCommands) this.finishDanmakuSocketCommand(requestId, error);
  };

  /** 优先经 gnet 发送；5 秒无 ack 时由调用方使用同一 requestId 幂等回退 HTTP。 */
  createDanmakuRealtime = (body) => {
    const socket = this.danmakuSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("弹幕实时连接未就绪"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.finishDanmakuSocketCommand(body.requestId, new Error("弹幕实时发送确认超时")), 5000);
      this.pendingDanmakuSocketCommands.set(body.requestId, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify(buildVideoDanmakuSocketCommand(body)));
      } catch (error) {
        this.finishDanmakuSocketCommand(body.requestId, error);
      }
    });
  };

  /** 将到达播放时间的弹幕放入有上限的活动层，动画结束后立即移除 DOM。 */
  launchDanmaku = (item) => {
    if (!item?.danmakuId || this.launchedDanmakuIds.has(item.danmakuId)) return;
    this.launchedDanmakuIds.add(item.danmakuId);
    const instanceId = `${item.danmakuId}:${Date.now()}:${Math.random()}`;
    const lane = this.state.activeDanmaku.length % 8;
    this.setState((state) => ({ activeDanmaku: [...state.activeDanmaku.slice(-49), { ...item, instanceId, lane }] }));
  };

  handleDanmakuSubmit = async (event) => {
    event?.preventDefault();
    const content = this.state.danmakuContent.trim();
    if (!content || this.state.danmakuSubmitting) return;
    if (!this.pendingDanmakuRequest || this.pendingDanmakuRequest.content !== content) {
      this.pendingDanmakuRequest = { content, requestId: globalThis.crypto?.randomUUID?.() || `dm_${Date.now()}_${Math.random().toString(16).slice(2)}` };
    }
    const input = { videoId: this.props.video?.id, content, progressMs: Math.floor((this.videoRef.current?.currentTime || 0) * 1000), requestId: this.pendingDanmakuRequest.requestId };
    const body = buildVideoDanmakuCreateBody(input);
    this.setState({ danmakuSubmitting: true, danmakuFeedback: "" });
    try {
      let item;
      try {
        item = await this.createDanmakuRealtime(body);
      } catch (error) {
        if (error?.allowHTTPFallback === false) throw error;
        // WebSocket 未就绪、断线或 ack 丢失时复用同一 requestId，数据库唯一键保证不会重复创建和广播。
        item = await createVideoDanmaku(body);
      }
      this.mergeDanmaku([item]);
      this.launchDanmaku(item);
      this.pendingDanmakuRequest = null;
      this.setState((state) => ({ danmakuSubmitting: false, danmakuContent: "", showDanmaku: true, danmakuTotalCount: state.danmakuTotalCount + 1, danmakuFeedback: "发送成功" }));
    } catch (error) {
      this.setState({ danmakuSubmitting: false, danmakuFeedback: error?.message || "弹幕发送失败" });
    }
  };

  /**
   * 处理播放/暂停。
   */
  togglePlay = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      this.setState({ isPlaying: true });
    } else {
      videoEl.pause();
      this.setState({ isPlaying: false });
    }
    this.resetControlsTimer();
  };

  /**
   * 处理视频区域点击（区分单击/双击）。
   */
  handleVideoClick = (e) => {
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;
    this.lastClickTime = now;
    if (timeSinceLastClick < 300) {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }
      this.handleDoubleClick(e);
      return;
    }
    this.clickTimer = setTimeout(() => {
      this.togglePlay();
      this.clickTimer = null;
    }, 300);
  };

  /**
   * 处理双击（切换全屏）。
   */
  handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setPlayMode(PLAY_MODE.FULLSCREEN);
  };

  /**
   * 处理鼠标按下（开始长按倍速）。
   */
  handleMouseDown = (e) => {
    if (e.button !== 0) return;
    this.longPressTimer = setTimeout(() => {
      this.startLongPressSpeed();
    }, 500);
  };

  /**
   * 处理鼠标松开（结束长按倍速）。
   */
  handleMouseUp = () => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.isLongPressing) {
      this.endLongPressSpeed();
    }
  };

  /**
   * 开始长按倍速。
   */
  startLongPressSpeed = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    this.isLongPressing = true;
    videoEl.playbackRate = LONG_PRESS_RATE;
    this.setState({ isLongPressSpeed: true });
  };

  /**
   * 结束长按倍速。
   */
  endLongPressSpeed = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    this.isLongPressing = false;
    videoEl.playbackRate = this.state.playbackRate;
    this.setState({ isLongPressSpeed: false });
  };

  /**
   * 进入/退出画中画模式。
   */
  togglePiP = async () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.setState({ isPiP: false });
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
        this.setState({ isPiP: true });
      }
    } catch (err) {
      console.error("画中画模式不支持:", err);
    }
  };

  /**
   * 退出画中画。
   */
  exitPiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch {
      // 忽略错误
    }
  };

  /**
   * 截取当前视频画面。
   */
  takeScreenshot = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    this.setState({ screenshotUrl: dataUrl, showScreenshot: true });
    setTimeout(() => {
      this.setState({ showScreenshot: false });
    }, 3000);
  };

  /**
   * 下载截图。
   */
  downloadScreenshot = () => {
    const { screenshotUrl } = this.state;
    if (!screenshotUrl) return;
    const link = document.createElement("a");
    link.download = `screenshot_${Date.now()}.png`;
    link.href = screenshotUrl;
    link.click();
  };

  /**
   * 处理时间更新。
   */
  handleTimeUpdate = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    const previousMs = Math.floor(this.state.currentTime * 1000);
    const currentMs = Math.floor(videoEl.currentTime * 1000);
    this.setState({
      currentTime: videoEl.currentTime,
      duration: videoEl.duration || 0,
    });
    this.loadDanmakuWindow(currentMs);
    this.loadDanmakuWindow(currentMs + 30000);
    if (currentMs >= previousMs && currentMs - previousMs < 2000) {
      this.state.danmakuList.filter((item) => item.progressMs > previousMs && item.progressMs <= currentMs).slice(0, 50).forEach(this.launchDanmaku);
    } else if (Math.abs(currentMs - previousMs) >= 2000) {
      // seek 后重新允许目标时间附近的弹幕发射；历史记录仍由已加载时间窗去重保存。
      this.launchedDanmakuIds.clear();
      this.setState({ activeDanmaku: [] });
    }
  };

  /**
   * 处理缓冲进度更新。
   */
  handleProgress = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl || !videoEl.buffered.length) return;
    const buffered = videoEl.buffered.end(videoEl.buffered.length - 1);
    this.setState({ buffered });
  };

  /**
   * 处理进度条点击。
   */
  handleProgressClick = (e) => {
    const progressBar = this.progressBarRef.current;
    const videoEl = this.videoRef.current;
    if (!progressBar || !videoEl) return;
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = pos * videoEl.duration;
  };

  /**
   * 处理音量变化。
   */
  handleVolumeChange = (e) => {
    const volume = parseFloat(e.target.value);
    const videoEl = this.videoRef.current;
    if (videoEl) videoEl.volume = volume;
    this.setState({ volume, isMuted: volume === 0 });
  };

  /**
   * 切换静音。
   */
  toggleMute = () => {
    const videoEl = this.videoRef.current;
    if (!videoEl) return;
    const newMuted = !this.state.isMuted;
    videoEl.muted = newMuted;
    this.setState({ isMuted: newMuted });
  };

  /**
   * 切换播放模式。
   */
  setPlayMode = (mode) => {
    const { playMode } = this.state;
    const targetMode = mode === playMode ? PLAY_MODE.NORMAL : mode;
    switch (targetMode) {
      case PLAY_MODE.FULLSCREEN:
        this.enterFullscreen();
        this.setState({ playMode: PLAY_MODE.FULLSCREEN });
        break;
      case PLAY_MODE.WEB_FULLSCREEN:
        document.body.style.overflow = "hidden";
        this.setState({ playMode: PLAY_MODE.WEB_FULLSCREEN });
        break;
      case PLAY_MODE.WIDE:
        this.setState({ playMode: PLAY_MODE.WIDE });
        break;
      case PLAY_MODE.NORMAL:
      default:
        if (playMode === PLAY_MODE.FULLSCREEN) this.exitFullscreen();
        if (playMode === PLAY_MODE.WEB_FULLSCREEN)
          document.body.style.overflow = "";
        this.setState({ playMode: PLAY_MODE.NORMAL });
        break;
    }
  };

  /**
   * 进入全屏。
   */
  enterFullscreen = () => {
    const el = this.playerContainerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };

  /**
   * 退出全屏。
   */
  exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  };

  /**
   * 设置播放速度。
   */
  setPlaybackRate = (rate) => {
    const videoEl = this.videoRef.current;
    if (videoEl) videoEl.playbackRate = rate;
    this.setState({ playbackRate: rate, showRateMenu: false });
  };

  /**
   * 设置清晰度。
   */
  setQuality = (quality) => {
    this.setState({ quality, showQualityMenu: false });
  };

  /**
   * 切换弹幕显示。
   */
  toggleDanmaku = () => {
    this.setState((state) => ({ showDanmaku: true, showDanmakuComposer: !state.showDanmakuComposer }));
  };

  /** 独立保留弹幕显隐能力，发送入口不会强迫用户永久开启覆盖层。 */
  toggleDanmakuVisibility = () => this.setState((state) => ({ showDanmaku: !state.showDanmaku }));

  /**
   * 重置控件显示计时器。
   */
  resetControlsTimer = () => {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this.setState({ showControls: true });
    this.controlsTimer = setTimeout(() => {
      if (this.state.isPlaying) this.setState({ showControls: false });
    }, 3000);
  };

  /**
   * 处理鼠标移动（显示控件）。
   */
  handleMouseMove = () => {
    this.resetControlsTimer();
  };

  /**
   * 渲染弹幕层。
   */
  renderDanmaku = () => {
    const { showDanmaku, activeDanmaku, isPlaying } = this.state;
    if (!showDanmaku) return null;
    return (
      <div className={styles.danmakuLayer}>
        {activeDanmaku.map((danmaku) => (
          <div
            key={danmaku.instanceId}
            className={styles.danmakuItem}
            style={{
              color: danmaku.color,
              top: `${16 + danmaku.lane * 32}px`,
              fontSize: `${Math.min(36, Math.max(12, danmaku.fontSize || 25))}px`,
              animationPlayState: isPlaying ? "running" : "paused",
            }}
            onAnimationEnd={() => this.setState((state) => ({ activeDanmaku: state.activeDanmaku.filter((item) => item.instanceId !== danmaku.instanceId) }))}
          >
            {danmaku.content}
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染播放控件。
   */
  renderControls = () => {
    const {
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      showRateMenu,
      playbackRate,
      showDanmaku,
      quality,
      showQualityMenu,
      buffered,
      playMode,
      isLongPressSpeed,
      showDanmakuComposer,
      danmakuContent,
      danmakuSubmitting,
      danmakuFeedback,
    } = this.state;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
    const isActive = (mode) => playMode === mode;

    return (
      <div
        className={`${styles.controls} ${
          this.state.showControls ? styles.controlsVisible : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 进度条 */}
        <div
          className={styles.progressBar}
          ref={this.progressBarRef}
          onClick={this.handleProgressClick}
        >
          <div className={styles.progressBg}>
            <div
              className={styles.progressBuffered}
              style={{ width: `${bufferedProgress}%` }}
            />
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
            <div
              className={styles.progressThumb}
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* 底部控件 */}
        {showDanmakuComposer && (
          <form className={styles.danmakuComposer} onSubmit={this.handleDanmakuSubmit}>
            <input
              className={styles.danmakuInput}
              value={danmakuContent}
              maxLength={HG_VIDEO_DANMAKU_MAX_LENGTH}
              onChange={(event) => this.setState({ danmakuContent: event.target.value, danmakuFeedback: "" })}
              placeholder="发个友善的弹幕见证当下"
              aria-label="弹幕内容"
            />
            <span className={styles.danmakuLength}>{Array.from(danmakuContent).length}/{HG_VIDEO_DANMAKU_MAX_LENGTH}</span>
            <button className={styles.danmakuSendButton} type="submit" disabled={!danmakuContent.trim() || danmakuSubmitting}>{danmakuSubmitting ? "发送中" : "发送"}</button>
            <button className={styles.danmakuVisibilityButton} type="button" onClick={this.toggleDanmakuVisibility}>{showDanmaku ? "隐藏" : "显示"}</button>
            {danmakuFeedback && <span className={styles.danmakuFeedback} role="status" aria-live="polite">{danmakuFeedback}</span>}
          </form>
        )}
        <div className={styles.controlsBottom}>
          <div className={styles.controlsLeft}>
            <HGTooltipPage
              content={isPlaying ? "暂停" : "播放"}
              placement="top"
            >
              <button className={styles.controlBtn} onClick={this.togglePlay}>
                {isPlaying ? <Icon.Pause /> : <Icon.Play />}
              </button>
            </HGTooltipPage>
            <span className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.controlsRight}>
            {isLongPressSpeed && (
              <span className={styles.speedIndicator}>{LONG_PRESS_RATE}x</span>
            )}

            <HGTooltipPage content="截图" placement="top">
              <button
                className={styles.controlBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  this.takeScreenshot();
                }}
              >
                <Icon.Screenshot />
              </button>
            </HGTooltipPage>

            <HGTooltipPage content="画中画" placement="top">
              <button
                className={`${styles.controlBtn} ${
                  this.state.isPiP ? styles.controlBtnActive : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  this.togglePiP();
                }}
              >
                <Icon.PictureInPicture />
              </button>
            </HGTooltipPage>

            <HGTooltipPage
              content={showDanmakuComposer ? "收起弹幕输入" : "发送弹幕"}
              placement="top"
            >
              <button
                className={`${styles.controlBtn} ${
                  showDanmakuComposer ? styles.controlBtnActive : ""
                }`}
                onClick={this.toggleDanmaku}
                aria-label={showDanmakuComposer ? "收起弹幕输入" : "发送弹幕"}
                aria-expanded={showDanmakuComposer}
              >
                {showDanmaku ? <Icon.Danmaku /> : <Icon.DanmakuOff />}
              </button>
            </HGTooltipPage>

            {/* 清晰度 */}
            <div className={styles.menuWrapper}>
              <HGTooltipPage content="清晰度" placement="top">
                <button
                  className={styles.controlBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      showQualityMenu: !showQualityMenu,
                      showRateMenu: false,
                    });
                  }}
                >
                  <span className={styles.qualityLabel}>
                    {QUALITY_OPTIONS.find(
                      (q) => q.key === quality
                    )?.label.split(" ")[0] || "HD"}
                  </span>
                </button>
              </HGTooltipPage>
              {showQualityMenu && (
                <div
                  className={styles.menuPopup}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.menuTitle}>清晰度</div>
                  {QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`${styles.menuOption} ${
                        quality === option.key ? styles.menuOptionActive : ""
                      } ${!option.available ? styles.menuOptionDisabled : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (option.available) this.setQuality(option.key);
                      }}
                      disabled={!option.available}
                    >
                      <span>{option.label}</span>
                      {quality === option.key && (
                        <span className={styles.checkIcon}>✓</span>
                      )}
                      {!option.available && (
                        <span className={styles.badge}>敬请期待</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 播放速度 */}
            <div className={styles.menuWrapper}>
              <HGTooltipPage content="播放速度" placement="top">
                <button
                  className={styles.controlBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      showRateMenu: !showRateMenu,
                      showQualityMenu: false,
                    });
                  }}
                >
                  <span className={styles.rateLabel}>{playbackRate}x</span>
                </button>
              </HGTooltipPage>
              {showRateMenu && (
                <div
                  className={styles.menuPopup}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.menuTitle}>播放速度</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      className={`${styles.menuOption} ${
                        playbackRate === rate ? styles.menuOptionActive : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        this.setPlaybackRate(rate);
                      }}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && (
                        <span className={styles.checkIcon}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 音量 */}
            <div
              className={styles.volumeWrapper}
              onClick={(e) => e.stopPropagation()}
            >
              <HGTooltipPage
                content={isMuted ? "取消静音" : "静音"}
                placement="top"
              >
                <button className={styles.controlBtn} onClick={this.toggleMute}>
                  {isMuted || volume === 0 ? (
                    <Icon.VolumeMute />
                  ) : volume < 0.5 ? (
                    <Icon.VolumeLow />
                  ) : (
                    <Icon.VolumeHigh />
                  )}
                </button>
              </HGTooltipPage>
              <div className={styles.volumeSliderWrapper}>
                <input
                  className={styles.volumeSlider}
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={this.handleVolumeChange}
                />
              </div>
            </div>

            {/* 宽屏 */}
            <HGTooltipPage
              content={isActive(PLAY_MODE.WIDE) ? "退出宽屏" : "宽屏"}
              placement="top"
            >
              <button
                className={`${styles.controlBtn} ${
                  isActive(PLAY_MODE.WIDE) ? styles.controlBtnActive : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  this.setPlayMode(PLAY_MODE.WIDE);
                }}
              >
                {isActive(PLAY_MODE.WIDE) ? (
                  <Icon.WidescreenActive />
                ) : (
                  <Icon.Widescreen />
                )}
              </button>
            </HGTooltipPage>

            {/* 网页全屏 */}
            <HGTooltipPage
              content={
                isActive(PLAY_MODE.WEB_FULLSCREEN) ? "退出网页全屏" : "网页全屏"
              }
              placement="top"
            >
              <button
                className={`${styles.controlBtn} ${
                  isActive(PLAY_MODE.WEB_FULLSCREEN)
                    ? styles.controlBtnActive
                    : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  this.setPlayMode(PLAY_MODE.WEB_FULLSCREEN);
                }}
              >
                {isActive(PLAY_MODE.WEB_FULLSCREEN) ? (
                  <Icon.WebFullscreenExit />
                ) : (
                  <Icon.WebFullscreen />
                )}
              </button>
            </HGTooltipPage>

            {/* 全屏 */}
            <HGTooltipPage
              content={isActive(PLAY_MODE.FULLSCREEN) ? "退出全屏" : "全屏"}
              placement="top"
            >
              <button
                className={`${styles.controlBtn} ${
                  isActive(PLAY_MODE.FULLSCREEN) ? styles.controlBtnActive : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  this.setPlayMode(PLAY_MODE.FULLSCREEN);
                }}
              >
                {isActive(PLAY_MODE.FULLSCREEN) ? (
                  <Icon.FullscreenExit />
                ) : (
                  <Icon.Fullscreen />
                )}
              </button>
            </HGTooltipPage>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染截图提示。
   */
  renderScreenshotToast = () => {
    const { showScreenshot, screenshotUrl } = this.state;
    if (!showScreenshot || !screenshotUrl) return null;
    return (
      <div className={styles.screenshotToast}>
        <img
          src={screenshotUrl}
          alt="截图"
          className={styles.screenshotPreview}
        />
        <button
          className={styles.screenshotDownloadBtn}
          onClick={this.downloadScreenshot}
        >
          保存截图
        </button>
      </div>
    );
  };

  render() {
    const { video, className = "" } = this.props;
    const { playMode } = this.state;

    if (!video) {
      return <div className={styles.emptyText}>请选择一个视频</div>;
    }

    const containerClass = [
      styles.playerContainer,
      className,
      playMode === PLAY_MODE.WIDE ? styles.wideMode : "",
      playMode === PLAY_MODE.WEB_FULLSCREEN ? styles.webFullscreenMode : "",
      playMode === PLAY_MODE.FULLSCREEN ? styles.fullscreenMode : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={containerClass} ref={this.playerContainerRef}>
        <div className={styles.playerMain}>
          <div
            className={styles.playerWrapper}
            onMouseMove={this.handleMouseMove}
            onMouseDown={this.handleMouseDown}
            onMouseUp={this.handleMouseUp}
            onMouseLeave={this.handleMouseUp}
            onClick={this.handleVideoClick}
          >
            <video
              ref={this.videoRef}
              className={styles.videoElement}
              src={video.url || video.filePath}
              onTimeUpdate={this.handleTimeUpdate}
              onProgress={this.handleProgress}
              onEnded={() => this.setState({ isPlaying: false })}
              onLoadedMetadata={() => {
                const videoEl = this.videoRef.current;
                if (videoEl) this.setState({ duration: videoEl.duration });
              }}
              onEnterPictureInPicture={() => this.setState({ isPiP: true })}
              onLeavePictureInPicture={() => this.setState({ isPiP: false })}
            />
            {this.renderDanmaku()}
            {this.renderControls()}
            {this.renderScreenshotToast()}

            {!this.state.isPlaying && (
              <div
                className={styles.playOverlay}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.playButton} onClick={this.togglePlay}>
                  <Icon.Play />
                </div>
              </div>
            )}

            {playMode === PLAY_MODE.WEB_FULLSCREEN && (
              <HGTooltipPage content="退出网页全屏" placement="bottom">
                <button
                  className={styles.webFullscreenCloseBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setPlayMode(PLAY_MODE.WEB_FULLSCREEN);
                  }}
                >
                  <Icon.Close />
                </button>
              </HGTooltipPage>
            )}
          </div>

        </div>
      </div>
    );
  }
}

export default HGVideoPlayerPage;
