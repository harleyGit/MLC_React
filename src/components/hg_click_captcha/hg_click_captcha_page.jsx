/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-31
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-31
 * @FilePath: /MLC_React/src/components/hg_click_captcha/hg_click_captcha_page.jsx
 * @Description: 点选验证码弹窗组件，用于防止恶意发送验证码
 */
import React from "react";
import styles from "./hg_click_captcha.module.css";
import HGNet from "../../manager_antd/net_handle/hg_net_manager_vm";

/**
 * SVG 关闭图标。
 */
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/**
 * SVG 刷新图标。
 */
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/**
 * 点选验证码弹窗组件。
 * 职责：显示验证码图片，让用户按顺序点选字符，验证通过后回调。
 * 输入：visible, onClose, onSuccess, onError。
 * 约束：visible 控制显示隐藏，验证成功后调用 onSuccess 并传递 verifyToken。
 */
class HGClickCaptchaPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      verifying: false,
      captchaId: "",
      imageUrl: "",
      chars: [],
      // 提交给后端的点击坐标。这里必须使用验证码原始图片坐标系，不能直接用页面显示坐标。
      // 原因：后端生成验证码时把字符坐标写入 Redis，坐标基于原始 PNG 尺寸（当前 Go 端是 280x100）。
      // 浏览器中图片会被 CSS 按弹窗宽度缩放，如果直接提交 displayX/displayY，后端容差判断会偏移。
      clickedPoints: [],
      // 用于前端渲染蓝色点击标记的坐标。这里必须使用页面显示坐标系。
      // 如果复用 clickedPoints，页面标记会因为原图坐标和显示坐标不一致而显示在错误位置。
      clickedDisplayPoints: [],
      // 当前需要点击的字符下标。用户每点击一次递增，等于 chars.length 时自动触发后端验证。
      currentIndex: 0,
      error: "",
    };
  }

  /**
   * 组件挂载或 visible 变为 true 时获取验证码。
   */
  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.fetchCaptcha();
    }
  }

  /**
   * 获取点选验证码图片。
   *
   * 这个方法只负责“生成一轮新的点选验证码”，不做业务验证码发送。
   * 完整流程是：
   * 1. 用户点击注册页的“发送验证码”。
   * 2. 注册页打开本弹窗。
   * 3. 本方法调用 /click_captcha 获取 captchaId、imageUrl、chars。
   * 4. 用户按 chars 顺序点击图片。
   * 5. 点击完成后 verifyCaptcha 调用 /verify_click_captcha。
   * 6. 验证通过后把 verifyToken 交给父组件，父组件再调用 send_code / send_email_code。
   *
   * 每次重新获取验证码时必须清空上一轮点击状态，避免旧坐标被带入新 captchaId。
   */
  fetchCaptcha = async () => {
    this.setState({ loading: true, verifying: false, error: "", clickedPoints: [], clickedDisplayPoints: [], currentIndex: 0 });

    try {
      const result = await HGNet.getClickCaptcha();

      if (result) {
        this.setState({
          captchaId: result.captchaId,
          imageUrl: result.imageUrl,
          chars: result.chars || [],
          loading: false,
        });
      } else {
        this.setState({
          error: "获取验证码失败",
          loading: false,
        });
      }
    } catch (err) {
      this.setState({
        error: err.message || "网络错误，请重试",
        loading: false,
      });
    }
  };

  /**
   * 处理图片点击事件，记录点击坐标。
   *
   * 这里有两个坐标系：
   * 1. display 坐标系：用户在浏览器中看到的图片尺寸，由 CSS 决定，可能不是 280x100。
   * 2. natural 坐标系：验证码 PNG 原始尺寸，也是后端 Redis 中保存字符位置时使用的坐标系。
   *
   * 后端 VerifyCaptcha 使用 Redis 中的字符原始坐标与用户提交坐标做距离容差判断。
   * 因此前端必须把 display 坐标按 image.naturalWidth/naturalHeight 换算成 natural 坐标后提交。
   * 同时，为了页面上的点击圆点能贴着用户实际点击位置显示，前端还要单独保存 display 坐标。
   */
  handleImageClick = (e) => {
    const { currentIndex, chars, clickedPoints, clickedDisplayPoints, verifying, loading } = this.state;

    // loading 时图片或字符列表还没有就绪；verifying 时已经发起后端校验。
    // 这两个阶段都禁止继续点击，避免重复提交、多记一次坐标或打乱点击顺序。
    if (loading || verifying || currentIndex >= chars.length) {
      return;
    }

    const imageEl = e.currentTarget.querySelector("img");
    // naturalWidth/naturalHeight 为 0 通常表示图片还没加载完成。
    // 此时无法做显示坐标到原图坐标的比例换算，直接忽略本次点击。
    if (!imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) {
      return;
    }

    const rect = imageEl.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    // 点击事件绑定在 captchaContainer 上，理论上可能点到边框、圆点等非图片区域。
    // 后端只认识图片坐标，所以超出图片矩形的点击不能参与验证。
    if (displayX < 0 || displayY < 0 || displayX > rect.width || displayY > rect.height) {
      return;
    }

    // 后端按原图坐标校验；页面可能按 CSS 缩放显示，所以提交前必须换算成原图坐标。
    // 例如原图 280x100，页面显示 292x104：用户点击 displayX=146 时，应提交 x=140。
    const x = Math.round(displayX * imageEl.naturalWidth / rect.width);
    const y = Math.round(displayY * imageEl.naturalHeight / rect.height);

    // newPoints 用于后端验证，newDisplayPoints 用于前端渲染点击标记。
    // 两组数组长度始终保持一致，index 也一致，便于展示“第几次点击”的序号。
    const newPoints = [...clickedPoints, { x, y }];
    const newDisplayPoints = [...clickedDisplayPoints, {
      x: Math.round(displayX),
      y: Math.round(displayY),
    }];
    const newIndex = currentIndex + 1;

    this.setState({
      clickedPoints: newPoints,
      clickedDisplayPoints: newDisplayPoints,
      currentIndex: newIndex,
    });

    // 如果已点选所有字符，立即自动提交验证。
    // 不额外提供“确认”按钮，是为了降低用户操作步骤，并保证点击顺序固定由 currentIndex 控制。
    if (newIndex === chars.length) {
      this.verifyCaptcha(newPoints);
    }
  };

  /**
   * 验证点选结果。
   *
   * points 必须是原图坐标系下的坐标数组，顺序必须与 chars 顺序一致。
   * 后端验证通过后会返回 verifyToken，该 token 是后续发送短信/邮箱验证码的前置凭证。
   * token 在 Go 端按一次性 token 设计，send_code/send_email_code 使用后会删除，避免复用绕过点选验证码。
   */
  verifyCaptcha = async (points) => {
    const { captchaId } = this.state;
    const { onSuccess, onError } = this.props;

    this.setState({ verifying: true, error: "" });

    try {
      const result = await HGNet.verifyClickCaptcha({
        captchaId,
        points,
      });

      if (result?.valid) {
        // 验证成功后只关闭本组件的 verifying 状态，真正关闭弹窗、发送业务验证码由父组件 onSuccess 负责。
        // 这样组件保持通用：未来别的页面也可以复用这个点选验证码弹窗。
        this.setState({ verifying: false });
        if (onSuccess) {
          onSuccess(result.verifyToken);
        }
      } else {
        // 验证失败通常是用户点错、图片过期或坐标容差不命中。
        // 失败后清空当前点击并刷新图片，避免用户继续在已失败的 captchaId 上重复尝试。
        const errorMsg = "验证失败，请重新点选";
        this.setState({
          error: errorMsg,
          verifying: false,
          clickedPoints: [],
          clickedDisplayPoints: [],
          currentIndex: 0,
        });
        if (onError) {
          onError(errorMsg);
        }
        // 延迟 1 秒刷新，让用户能看到失败提示；刷新后 captchaId、图片、字符和坐标全部换新。
        setTimeout(() => this.fetchCaptcha(), 1000);
      }
    } catch (err) {
      // 网络错误、后端业务错误或 Redis 中验证码过期都会走到这里。
      // 与验证失败保持一致：清空状态并刷新一张新图，降低用户卡在坏状态里的概率。
      const errorMsg = err.message || "网络错误，请重试";
      this.setState({
        error: errorMsg,
        verifying: false,
        clickedPoints: [],
        clickedDisplayPoints: [],
        currentIndex: 0,
      });
      if (onError) {
        onError(errorMsg);
      }
      setTimeout(() => this.fetchCaptcha(), 1000);
    }
  };

  /**
   * 刷新验证码。
   */
  handleRefresh = () => {
    this.fetchCaptcha();
  };

  /**
   * 渲染点击指示器。
   *
   * 指示器必须使用 clickedDisplayPoints，而不是提交给后端的 clickedPoints。
   * clickedPoints 是原图坐标，页面图片被缩放时用它渲染会出现圆点偏移。
   */
  renderClickIndicators = () => {
    const { clickedDisplayPoints } = this.state;

    return clickedDisplayPoints.map((point, index) => (
      <div
        key={index}
        className={styles.clickIndicator}
        style={{
          left: `${point.x}px`,
          top: `${point.y}px`,
        }}
        data-index={index + 1}
      />
    ));
  };

  /**
   * 渲染字符列表。
   */
  renderCharList = () => {
    const { chars, currentIndex } = this.state;

    return (
      <div className={styles.charList}>
        {chars.map((char, index) => {
          let charClass = styles.charItem;
          if (index < currentIndex) {
            charClass += ` ${styles.correct}`;
          } else if (index === currentIndex) {
            charClass += ` ${styles.active}`;
          }

          return (
            <div key={index} className={charClass}>
              {char}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染内容。
   */
  renderContent = () => {
    const { loading, imageUrl, chars, currentIndex, error, verifying } = this.state;

    if (loading) {
      return <div className={styles.loading}>加载中...</div>;
    }

    return (
      <>
        <div className={styles.hint}>
          请按顺序点击下方图片中的
          <span style={{ color: "#1890ff", fontWeight: "bold" }}>
            {chars.join(" ")}
          </span>
        </div>

        {this.renderCharList()}

        <div className={styles.captchaContainer} onClick={this.handleImageClick}>
          <img
            src={imageUrl}
            alt="验证码"
            className={styles.captchaImage}
            draggable={false}
          />
          {this.renderClickIndicators()}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={this.handleRefresh}
            disabled={verifying}
          >
            <RefreshIcon />
            换一张
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDefault}`}
            onClick={this.props.onClose}
          >
            取消
          </button>
        </div>

        {verifying && (
          <div style={{ textAlign: "center", color: "#999", marginTop: "12px", fontSize: "13px" }}>
            验证中...
          </div>
        )}
      </>
    );
  };

  render() {
    const { visible, title = "安全验证" } = this.props;

    if (!visible) return null;

    return (
      <div className={styles.overlay}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>{title}</h3>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={this.props.onClose}
            >
              <CloseIcon />
            </button>
          </div>
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

export default HGClickCaptchaPage;
