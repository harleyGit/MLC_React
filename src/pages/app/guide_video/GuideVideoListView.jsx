import React, { Component } from "react";
import guideVideoItem from "../../../assets/5.1_7.jpg";
import { SystemInfoUtil } from "../../../utils/SystemInfoUtil";
import "./GuideVideoListView.css";
import { GuideVideoListVM } from "./GuideVideoListVM";

// 多语言支持
const translations = GuideVideoListVM.translationTxt();
// 视频数据
const videoData = GuideVideoListVM.guideVideoListJSON();

// 检测是否在iOS WKWebView中
const isIOSWKWebView = () => {
  return window.webkit && window.webkit.messageHandlers;
};

// 检测当前用户是否正在使用 iOS 设备（iPhone、iPad 或 iPod）访问网页。
//navigator.userAgent
// 这是浏览器提供的一个字符串，包含了当前浏览器和设备的信息。例如，在 iPhone 上 Safari 浏览器的 userAgent 可能包含 "iPhone" 字样。
// /iPhone|iPad|iPod/i 这是一个正则表达式
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Android WebView 的视频硬件层容易被模糊遮罩覆盖，播放准备页需使用更保守的黑底播放器。
const isAndroid = () => /Android/i.test(navigator.userAgent);

// 检测语言
const detectLanguage = () => {
  // 从 hash 中提取参数
  const hash = window.location.hash; // 比如 "#/app/guide_video/GuideVideoListView?lang=zn_ch"
  const queryString = hash.split("?")[1]; // "lang=zn_ch"
  const params = new URLSearchParams(queryString);
  const lang = params.get("lang") ? params.get("lang") : "zh";

  //console.log("🍎 当前语言参数:", lang);
  return lang;
  // const lang = navigator.language || navigator.userLanguage;
  // return lang.startsWith("zh") ? "zh" : "en";
};

class GuideVideoListView extends Component {
  videoRef = React.createRef();
  nativeAdRef = React.createRef();
  adPositionFrame = null;
  constructor(props) {
    super(props);
    this.state = {
      language: detectLanguage(),
      currentVideoUrl: null,
      showVideoList: true, //false, // 控制是否显示视频列表

      duration: 0,
      currentTime: 0,

      // seeking: false, // 🔒 关键锁
      // seekPercent: 0,

      // 手势滑动
      touchStartX: 0,
      touchDeltaX: 0,

      isPlaying: false,
      hasStartedPlaying: false,
      isDragging: false,
      wasPlaying: false,
      fullscreen: false, // 是否全屏
      nativeAdHeight: 0,
    };
  }

  // 切换语言
  switchLanguage = (lang) => {
    this.setState({ language: lang });
  };

  // 进入视频列表页面
  enterVideoList = () => {
    this.setState({ showVideoList: true });
  };

  componentDidMount() {
    window.nativeCallback = this.handleNativeCallback;
    this.reportNativeAdPosition();
  }

  componentWillUnmount() {
    if (window.nativeCallback === this.handleNativeCallback) {
      window.nativeCallback = undefined;
    }
    if (this.adPositionFrame !== null) {
      // 组件卸载后取消尚未执行的广告位置上报，避免旧页面的异步回调影响新页面或测试用例。
      window.cancelAnimationFrame(this.adPositionFrame);
      this.adPositionFrame = null;
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.showVideoList !== this.state.showVideoList ||
      prevState.currentVideoUrl !== this.state.currentVideoUrl
    ) {
      if (this.isVideoPlayerOpen()) {
        // 播放页不渲染 nativeAd 占位；进入播放页前先把原生 adView 移出可视区域，
        // 防止上一次广告约束残留在播放页底部形成空白或遮挡。
        this.reportNativeAdPosition(false);
        return;
      }

      // 退出播放页后列表和 nativeAd 占位重新出现，再按真实占位位置恢复原生广告。
      this.reportNativeAdPosition(true);
    }
  }

  // 判断播放器是否处于打开状态，统一播放态和广告显隐的判断口径。
  isVideoPlayerOpen = () => Boolean(this.state.currentVideoUrl);

  reportNativeAdPosition = (visible = true) => {
    if (this.adPositionFrame !== null) {
      // 同一帧内只保留最后一次广告位置上报，避免快速切换列表/播放页时原生收到过期坐标。
      window.cancelAnimationFrame(this.adPositionFrame);
    }

    this.adPositionFrame = window.requestAnimationFrame(() => {
      this.adPositionFrame = null;
      const nativeAd = this.nativeAdRef.current;
      if (!nativeAd && visible) {
        return;
      }

      const rect = nativeAd?.getBoundingClientRect();
      SystemInfoUtil.postNativeMessage("adPosition", {
        elementId: "nativeAd",
        visible,
        // visible=false 时将原生 adView 的 top 约束移到页面内容底部之外。
        // iOS 端 AdHandler 未消费 visible 字段，只消费 y；这个偏移能让广告退出可视播放区。
        y: visible
          ? rect.top + window.scrollY
          : document.body.scrollHeight + window.innerHeight,
      });
    });
  };

  // 广告高度回调处理
  handleNativeCallback = (action, data) => {
    if (action !== "nativeAdHeight") {
      return;
    }

    const height = Number(data?.height);
    if (!Number.isFinite(height) || height < 0) {
      return;
    }

    if (height === this.state.nativeAdHeight) {
      return;
    }

    this.setState({ nativeAdHeight: height }, this.reportNativeAdPosition);
  };

  // 返回主页面
  goBack = () => {
    this.setState({ showVideoList: false });
  };

  // 处理视频点击
  handleVideoClick = (video) => {
    console.log("🍎 播放model：", video.videoUrl);
    // 点击列表项只进入播放器准备态，不自动播放。
    // 这样既满足移动端必须由用户手势触发 play() 的限制，也避免打开页面时突然出声。
    this.setState({
      currentVideoUrl: video.videoUrl,
      isPlaying: false,
      hasStartedPlaying: false,
      fullscreen: false,
    });
  };
  handleVideoClick01 = (video) => {
    if (isIOSWKWebView()) {
      // 在iOS WKWebView中调用原生方法
      if (window.webkit.messageHandlers.playVideo) {
        window.webkit.messageHandlers.playVideo.postMessage({
          videoUrl: video.videoUrl,
          title: translations[this.state.language][video.titleKey],
        });
      }
    } else {
      // 在网页中直接播放
      this.setState({ currentVideoUrl: video.videoUrl });
    }
  };

  // 关闭视频播放器
  closeVideoPlayer = () => {
    const video = this.videoRef.current;
    if (video) video.pause();
    this.setState({
      currentVideoUrl: null,
      isPlaying: false,
      hasStartedPlaying: false,
      fullscreen: false,
    });
  };

  // 处理常见问题点击
  handleFAQ = () => {
    console.log("FAQ clicked");
  };

  // 处理返回按钮
  handleBack = () => {
    if (this.state.showVideoList) {
      this.goBack();
    } else {
      window.history.back();
    }
  };

  /* ================== Video ==================> */
  onLoadedMeta = () => {
    const video = this.videoRef.current;
    if (!video) return;
    this.setState({ duration: video.duration });
  };

  handleTimeUpdate = () => {
    if (this.state.isDragging) return;

    const video = this.videoRef.current;
    if (!video) return;

    this.setState({
      currentTime: video.currentTime,
    });
  };

  togglePlay = async () => {
    const video = this.videoRef.current;
    if (!video) return;

    if (this.state.isPlaying) {
      video.pause();
      this.setState({ isPlaying: false });
    } else {
      // Android WebView 只要 video 提前绑定 src，就可能提前创建原生视频层并盖住 H5 封面。
      // 因此 Android 首次播放必须先通过状态变更让 renderPlayer 写入 src，再在 setState 回调里播放。
      if (isAndroid() && !this.state.hasStartedPlaying) {
        this.setState({ hasStartedPlaying: true }, this.playCurrentVideo);
      } else {
        await this.playCurrentVideo();
      }
    }
  };

  playCurrentVideo = async () => {
    const video = this.videoRef.current;
    if (!video) return;

    // 这里统一处理真实播放动作：取消静音、提升预加载策略、隐藏封面并调用浏览器 play()。
    // Android 首次进入该方法时，setState 回调已经触发重新渲染，video.src 已从空值变为真实地址。
    video.muted = false;
    video.setAttribute("preload", "auto");
    this.setState({ hasStartedPlaying: true });
    try {
      await video.play();
      this.setState({ isPlaying: true, hasStartedPlaying: true });
    } catch (e) {
      // Chrome / Android 可能因资源未就绪或 WebView 策略拒绝播放；恢复封面便于用户重试。
      console.error("视频播放失败", e);
      this.setState({ isPlaying: false, hasStartedPlaying: false });
    }
  };

  handleVideoPlay = () => {
    this.setState({ isPlaying: true, hasStartedPlaying: true });
  };

  handleVideoPause = () => {
    this.setState({ isPlaying: false });
  };

  handleVideoEnded = () => {
    const video = this.videoRef.current;
    if (video) video.currentTime = 0;
    this.setState({ isPlaying: false, currentTime: 0 });
  };

  /* <================== Video结束 ================== */

  /* ================== 手势滑动快进 ================== */

  onTouchStart = (e) => {
    this.setState({
      touchStartX: e.touches[0].clientX,
      touchDeltaX: 0,
    });
  };

  onTouchMove = (e) => {
    const delta = e.touches[0].clientX - this.state.touchStartX;
    this.setState({ touchDeltaX: delta });
  };

  onTouchEnd = () => {
    const video = this.videoRef.current;
    if (!video || !this.state.duration) return;

    const seconds = this.state.touchDeltaX / 5; // 灵敏度
    video.currentTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      this.state.duration
    );

    this.setState({ touchDeltaX: 0 });
  };
  /* ================== 手势滑动快进 结束 ================== */

  /* ================== 全屏开始 ==================> */

  exitFullscreen = () => {
    this.setState({ fullscreen: false });
  };
  enterFullscreen = () => {
    this.setState({ fullscreen: true });
  };
  /* ================== 全屏结束 ================== */

  /* ===== 进度拖动开始 ===== */

  handleDragStart = () => {
    const video = this.videoRef.current;
    if (!video) return;

    this.setState({
      isDragging: true,
      wasPlaying: this.state.isPlaying,
    });

    video.pause();
  };
  handleDragChange = (e) => {
    const video = this.videoRef.current;
    if (!video) return;

    const time = Number(e.target.value);
    video.currentTime = time;

    this.setState({ currentTime: time });
  };
  handleDragEnd = async () => {
    const video = this.videoRef.current;
    if (!video) return;

    const { wasPlaying } = this.state;

    this.setState({ isDragging: false });

    if (wasPlaying) {
      try {
        await video.play();
        this.setState({ isPlaying: true });
      } catch (e) {}
    }
  };
  /* ===== 进度拖动结束 ===== */

  handleTimeUpdate = () => {
    if (this.state.isDragging) return;

    const video = this.videoRef.current;
    if (!video) return;

    this.setState({
      currentTime: video.currentTime,
    });
  };

  render() {
    const { language, currentVideoUrl, showVideoList } = this.state;
    const t = translations[language];
    // console.log("🍎 翻译:", t);
    if (!t) {
      return null;
    }

    // 如果显示视频列表，渲染视频列表页面
    if (showVideoList) {
      return this.renderVideoListPage(t);
    }

    // 否则渲染主页面（包含进入按钮）
    return this.renderMainPage(t);
  }
  // 渲染视频列表页面
  renderVideoListPage = (t) => {
    // 如果视频播放器已打开，则渲染播放器页面
    if (this.isVideoPlayerOpen()) {
      return this.renderPlayerPage(t);
    }

    return (
      <div className="guide-container">
        {/* 状态栏 */}
        {/* {this.statusBarView()} */}
        {/* 导航栏 */}
        {/* {this.navigationBarView(t)} */}
        {/* 主内容区域 */}
        <div className="main-content">
          <div className="content-card">
            {/* <h2 className="section-title">{t.videoTutorials}</h2> */}
            <div className="video-list">
              {videoData.map((video) => this.videoPlayItemView(video, t))}
              {/* Web 侧占位负责告诉原生广告应该贴在哪个 y 坐标；播放态不移除该节点，
                  关闭播放器后才能立即重新计算并显示原生 adView。 */}
              <div
                id="nativeAd"
                ref={this.nativeAdRef}
                className="native-ad"
                style={{ height: `${this.state.nativeAdHeight}px` }}
              />
            </div>
          </div>
        </div>
        {/* 语言切换按钮 */}
        {/* {this.switchLanguageView()} */}
      </div>
    );
  };

  // 渲染覆盖式播放页，保留列表作为被遮罩背景，但不挂载 nativeAd 避免原生广告留白。
  renderPlayerPage = (t) => {
    const androidPlayerPage = isAndroid();
    return (
      <div
        className={`guide-container player-page ${
          androidPlayerPage ? "android-player-page" : ""
        }`}
      >
        {!androidPlayerPage && (
          <div className="main-content player-page-background">
            <div className="content-card">
              <div className="video-list">
                {videoData.map((video) => this.videoPlayItemView(video, t))}
              </div>
            </div>
          </div>
        )}
        <div className="player-page-content">
          {this.renderPlayer(
            androidPlayerPage
              ? "android-visible-player"
              : "blurred-player-overlay"
          )}
        </div>
      </div>
    );
  };

  renderPlayer(extraClassName = "") {
    const { duration, currentTime } = this.state;
    // renderPlayer 会被 iOS/普通浏览器和 Android 播放页共用；Android 需要单独处理 src 绑定时机。
    const androidPlayer = isAndroid();
    const overlayClassName = [
      "video-player-overlay",
      this.state.fullscreen ? "fullscreen" : "",
      extraClassName,
    ]
      .filter(Boolean)
      .join(" ");

    // const percent = duration ? (currentTime / duration) * 100 : 0;
    return (
      <div className={overlayClassName}>
        <div className="video-player-container">
          {/* 🔙 恢复按钮 */}
          {this.state.fullscreen && (
            <button
              className="exit-fullscreen-btn"
              onClick={this.exitFullscreen}
              aria-label="退出全屏"
            >
              <svg
                className="exit-fullscreen-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M7 3v4H3M13 3v4h4M17 13h-4v4M3 13h4v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* 左上角返回按钮：退出播放页并回到引导视频列表，同时触发广告重新上报显示。 */}
          {!this.state.fullscreen && (
            <button className="close-button" onClick={this.closeVideoPlayer}>
              ×
            </button>
          )}
          <div className="video-stage video-stage-ready">
            <video
              // 保存 video DOM 引用，用于自定义播放、暂停、拖动进度和读取时长。
              ref={this.videoRef}
              // Android 播放前不绑定 src，避免 WebView 提前创建原生视频层覆盖 guideVideoItem 封面。
              // 点击封面或播放按钮后 hasStartedPlaying 变为 true，才把 currentVideoUrl 写入 video。
              // 非 Android 保持原逻辑，进入播放器准备态时即可绑定 src，方便浏览器预加载元数据。
              src={
                androidPlayer && !this.state.hasStartedPlaying
                  ? undefined
                  : this.state.currentVideoUrl
              }
              // Android WebView 对 video poster 的绘制缓存不稳定，可能播放后仍显示占位图。
              // 所以 video 不使用 poster，占位统一交给上层自定义 img，播放时直接卸载该 img。
              // 不使用 autoPlay，避免进入页面后浏览器或 WebView 自动播放。
              // autoPlay
              // iOS Safari/WKWebView 内联播放，避免系统自动拉起原生全屏播放器。
              playsInline
              // 兼容旧版 iOS WebKit 的内联播放属性。
              webkit-playsinline="true"
              // 兼容部分 X5 内核的内联播放属性。
              x5-playsinline="true"
              // Android X5/部分国产 WebView 使用 h5-page 模式可避免拉起独立播放器，并减少音画分层异常。
              x5-video-player-type="h5-page"
              // 明确禁止 X5 强制全屏，保证自定义遮罩和控制栏仍在同一页面层级。
              x5-video-player-fullscreen="false"
              // 允许 H5 页面内播放，避免 Android WebView 将视频挪到独立原生层后只剩音频或黑屏。
              x5-video-orientation="portrait"
              // 不设置 muted，Android WebView 上自定义按钮点击后应按用户手势正常有声播放。
              muted={false}
              // 预加载元数据和资源，减少 Android WebView 点击播放时因资源未就绪导致的失败。
              preload="auto"
              // 禁用系统原生控件，播放、暂停和进度条统一使用下方自定义 controls。
              controls={false}
              // 加载元数据后记录视频总时长，用于自定义进度条 max 值。
              onLoadedMetadata={this.onLoadedMeta}
              // 播放进度变化时同步 currentTime，用于自定义进度条显示。
              onTimeUpdate={this.handleTimeUpdate}
              // 点击视频区域时切换自定义播放状态；全屏时 CSS 会禁用 video 点击目标。
              onClick={this.togglePlay}
              // 记录触摸起点，用于左右滑动快进/快退。
              onTouchStart={this.onTouchStart}
              // 记录触摸位移，用于计算快进/快退秒数。
              onTouchMove={this.onTouchMove}
              // 触摸结束后执行快进/快退。
              onTouchEnd={this.onTouchEnd}
              // 同步浏览器真实播放状态，避免自定义按钮状态和 video 状态不一致。
              onPlay={this.handleVideoPlay}
              // 同步暂停状态，保证自定义按钮切回播放图标。
              onPause={this.handleVideoPause}
              // 播放结束后重置播放状态和进度。
              onEnded={this.handleVideoEnded}
              // 全屏时增加 custom-controlled，用 CSS 禁止系统原生点击目标。
              className={
                this.state.fullscreen
                  ? "video-player custom-controlled"
                  : "video-player"
              }
              // 视频加载失败时输出错误，便于定位资源地址或网络问题。
              onError={(e) => console.error("视频加载失败", e)}
              // 视频可播放时输出日志，用于调试资源加载完成状态。
              onCanPlay={() => console.log("✅ 视频可播放")}
            />
            {!this.state.hasStartedPlaying && (
              <img
                className="video-player-cover"
                src={guideVideoItem}
                alt=""
                onClick={this.togglePlay}
              />
            )}
          </div>
          {/* 控制层 */}
          <div className="controls">
            <button
              className="play-toggle-button"
              onClick={this.togglePlay}
              aria-label={this.state.isPlaying ? "暂停播放" : "开始播放"}
            >
              <svg
                className="play-toggle-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                {this.state.isPlaying ? (
                  <path
                    d="M6 4v12M14 4v12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                ) : (
                  <path d="M6 4l10 6-10 6V4z" fill="currentColor" />
                )}
              </svg>
            </button>

            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              className="video-range"
              // value={seeking ? seekPercent : percent}
              // onMouseDown={this.handleSeekStart}
              // onMouseUp={this.handleSeekEnd}
              // onChange={this.handleSeekChange}
              // onTouchStart={this.handleSeekStart}
              // onTouchEnd={this.handleSeekEnd}
              onMouseDown={this.handleDragStart}
              onTouchStart={this.handleDragStart}
              onChange={this.handleDragChange}
              onMouseUp={this.handleDragEnd}
              onTouchEnd={this.handleDragEnd}
              style={{
                background: `linear-gradient(
                  to right,
                  #2BB070 ${(currentTime / duration) * 100}%,
                  rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%
                )`,
              }}
            />

            <button
              className="fullscreen-button"
              onClick={this.enterFullscreen}
              aria-label="全屏播放"
            >
              <svg
                className="fullscreen-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 渲染主页面
  renderMainPage = (t) => {
    return (
      <div className="guide-container">
        {/* 状态栏 */}
        {this.statusBarView()}
        {/* 导航栏 */}
        {this.navigationBarView(t)}

        {/* 主内容区域 */}
        {this.guideMainPageView(t)}

        {/* 语言切换按钮 */}
        {this.switchLanguageView()}
      </div>
    );
  };

  navigationBarView = (t) => {
    return (
      <div className="navigation-bar">
        <button className="back-button" onClick={this.handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="title">{t?.title}</h1>
        <button className="faq-button" onClick={this.handleFAQ}>
          {t?.commonQuestions}
        </button>
      </div>
    );
  };

  statusBarView = () => {
    return (
      <div className="status-bar">
        <div className="time">2:32</div>
        <div className="status-icons">
          <div className="signal-icon">📶</div>
          <div className="wifi-icon">📶</div>
          <div className="battery-icon">🔋</div>
        </div>
      </div>
    );
  };

  switchLanguageView = () => {
    return (
      <div className="language-switcher">
        <button
          className={`lang-btn ${this.state.language === "zh" ? "active" : ""}`}
          onClick={() => this.switchLanguage("zh")}
        >
          中文
        </button>
        <button
          className={`lang-btn ${this.state.language === "en" ? "active" : ""}`}
          onClick={() => this.switchLanguage("en")}
        >
          EN
        </button>
      </div>
    );
  };

  videoPlayItemView = (video, t) => {
    return (
      <div key={video.id} className="video-item">
        <div className="video-title">{t[video.titleKey]}</div>
        <div
          className="video-preview"
          onClick={() => this.handleVideoClick(video)}
        >
          <img
            src={video.thumbnail}
            alt={t[video.titleKey]}
            className="video-thumbnail"
            loading="lazy"
          />
          <div className="video-overlay">
            {/* <div className="tutorial-label">{t.newbieTutorial}</div> */}
            {/* <div className="play-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.8)" />
                <path d="M10 8L16 12L10 16V8Z" fill="white" />
              </svg>
            </div> */}
          </div>
        </div>
      </div>
    );
  };

  guideMainPageView(t) {
    return (
      <div className="main-content">
        <div className="content-card">
          <h2 className="section-title">{t.videoTutorials}</h2>
          <div className="welcome-message">
            <p>欢迎使用新手引导系统！</p>
            <p>点击下方按钮开始学习视频教程。</p>
          </div>
          <button className="enter-guide-button" onClick={this.enterVideoList}>
            {t.enterGuide}
          </button>
        </div>
      </div>
    );
  }
}

export default GuideVideoListView;
