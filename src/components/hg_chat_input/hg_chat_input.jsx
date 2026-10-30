/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-31 00:45:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-31 00:45:00
 * @FilePath: /MLC_React/src/components/hg_chat_input/hg_chat_input.jsx
 * @Description: 微信风格聊天输入框：文字/语音双模式 + 表情面板 + 圆圈加扩展面板。
 */
import React from "react";
import styles from "./hg_chat_input.module.css";

/** 输入模式：文字 / 语音（内部常量，不对外导出）。 */
const MODE_TEXT = "text";
const MODE_VOICE = "voice";

/** 底部展开面板：无 / 表情 / 圆圈加扩展。 */
const PANEL_NONE = "none";
const PANEL_EMOJI = "emoji";
const PANEL_PLUS = "plus";

/** 表情面板选项：点击即作为表情消息发送。 */
const EMOJI_OPTIONS = [
  "😀", "😄", "😂", "🤣", "😊", "😍", "😘", "😜",
  "😎", "🤔", "😴", "😭", "😡", "👍", "👏", "🙏",
  "💪", "🤝", "🌹", "🎉", "🔥", "❤️", "💔", "💯",
];

/** 圆圈加扩展面板动作：key 对应 props 中的 onSendXxx 回调。 */
const PLUS_ACTIONS = [
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "redPacket", label: "红包" },
  { key: "card", label: "联系人名片" },
];

/* 工具条图标（内联 SVG，颜色跟随 currentColor）。 */
const ICON_MIC = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Z" />
    <path d="M19.5 11a1 1 0 1 0-2 0 5.5 5.5 0 0 1-11 0 1 1 0 1 0-2 0 7.5 7.5 0 0 0 6.5 7.42V21a1 1 0 1 0 2 0v-2.58A7.5 7.5 0 0 0 19.5 11Z" />
  </svg>
);

const ICON_KEYBOARD = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm2 3v2h2V9H5Zm3.5 0v2h2V9h-2Zm3.5 0v2h2V9h-2Zm3.5 0v2h2V9h-2ZM5 13v2h2v-2H5Zm3.5 0v2h7v-2h-7Zm8.5 0v2h2v-2h-2Z" />
  </svg>
);

const ICON_EMOJI = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
    <circle cx="8.8" cy="9.8" r="1.4" />
    <circle cx="15.2" cy="9.8" r="1.4" />
    <path d="M7.6 13.6a1 1 0 0 1 1.37.36 3.5 3.5 0 0 0 6.06 0 1 1 0 1 1 1.73 1 5.5 5.5 0 0 1-9.52 0 1 1 0 0 1 .36-1.36Z" />
  </svg>
);

const ICON_PLUS = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
    <path d="M11 6h2v5h5v2h-5v5h-2v-5H6v-2h5V6Z" />
  </svg>
);

/** 扩展面板各动作的图标。 */
const PLUS_ICONS = {
  image: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9.6l3.7-3.7a1 1 0 0 1 1.42 0L14 15.7l1.8-1.8a1 1 0 0 1 1.4 0L19 15.7V6H5Zm10.5 1a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 3.5v7l6-3.5-6-3.5Z" />
    </svg>
  ),
  redPacket: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3.4 1.6a12.4 12.4 0 0 0 9.2 0H7.4ZM12 9a2.4 2.4 0 1 0 0 4.8A2.4 2.4 0 0 0 12 9Zm-9 4.2V19h18v-5.8a13.9 13.9 0 0 1-8.1 2.5H11A13.9 13.9 0 0 1 3 13.2Z" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm5 3.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4ZM5.4 17.2c.4-2.1 1.9-3.4 3.6-3.4s3.2 1.3 3.6 3.4H5.4ZM15 9.4h4V11h-4V9.4Zm0 3.4h4v1.6h-4v-1.6Z" />
    </svg>
  ),
};

/**
 * 微信风格聊天输入框（类组件）。
 * 职责：管理文字/语音输入模式、表情面板与圆圈加扩展面板的展开收起，
 * 长按语音按钮计时录音，松开发送、移出取消。
 * 输入：value/onChange 受控文字、onSendText、onSendVoice(seconds)、
 * onSendEmoji(emoji)、onSendImage、onSendVideo、onSendRedPacket、onSendCard。
 * 约束：不持有消息业务状态，发送一律通过回调交给页面层。
 */
class HGChatInput extends React.Component {
  hgRecordStartAt = 0; // 录音开始时间戳。
  hgRecordTimer = null; // 录音计时器句柄。
  hgToastTimer = null; // 短提示消失定时器句柄。

  /**
   * 构造函数：初始化输入模式、展开面板与录音状态。
   * @param {object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.state = {
      mode: MODE_TEXT,
      panel: PANEL_NONE,
      recording: false,
      recordSeconds: 0,
      toast: "",
    };
  }

  /**
   * 生命周期卸载：清理录音计时器与提示定时器。
   * @returns {void}
   */
  componentWillUnmount() {
    this.hgClearRecordTimer();
    if (this.hgToastTimer) {
      window.clearTimeout(this.hgToastTimer);
      this.hgToastTimer = null;
    }
  }

  /** 清理录音计时器。 */
  hgClearRecordTimer = () => {
    if (this.hgRecordTimer) {
      window.clearInterval(this.hgRecordTimer);
      this.hgRecordTimer = null;
    }
  };

  /** 展示一条 1.5s 自动消失的短提示。 */
  hgShowToast = (text) => {
    this.setState({ toast: text });
    if (this.hgToastTimer) {
      window.clearTimeout(this.hgToastTimer);
    }
    this.hgToastTimer = window.setTimeout(() => {
      this.setState({ toast: "" });
      this.hgToastTimer = null;
    }, 1500);
  };

  /** 切换文字/语音模式，切换时收起已展开面板。 */
  hgSwitchMode = (mode) => {
    this.setState({ mode, panel: PANEL_NONE });
  };

  /** 切换底部展开面板：再次点击同一面板收起。 */
  hgTogglePanel = (panel) => {
    this.setState((prevState) => ({
      panel: prevState.panel === panel ? PANEL_NONE : panel,
    }));
  };

  /** 圆圈加动作分派：调用对应回调后收起面板并回到文字输入模式。 */
  hgHandleAction = (key) => {
    const handlers = {
      image: this.props.onSendImage,
      video: this.props.onSendVideo,
      redPacket: this.props.onSendRedPacket,
      card: this.props.onSendCard,
    };
    const handler = handlers[key];
    if (typeof handler === "function") {
      handler();
    }
    this.setState({ panel: PANEL_NONE, mode: MODE_TEXT });
  };

  /** 点击表情：直接作为表情消息发送（与需求一致，不进输入框）。 */
  hgHandleEmojiClick = (emoji) => {
    if (typeof this.props.onSendEmoji === "function") {
      this.props.onSendEmoji(emoji);
    }
  };

  /** 文字变更透传给受控层。 */
  hgHandleTextChange = (event) => {
    if (typeof this.props.onChange === "function") {
      this.props.onChange(event);
    }
  };

  /** Enter 发送、Shift+Enter 换行。 */
  hgHandleTextKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.hgHandleSendText();
    }
  };

  /** 发送文字：交给页面层处理（空内容由页面层拦截）。 */
  hgHandleSendText = () => {
    if (typeof this.props.onSendText === "function") {
      this.props.onSendText();
    }
  };

  /** 长按开始录音：记录起始时间并每秒累加计时。 */
  hgHandleRecordStart = (event) => {
    event.preventDefault();
    if (this.state.recording) {
      return;
    }
    this.hgRecordStartAt = Date.now();
    this.setState({ recording: true, recordSeconds: 0 });
    this.hgRecordTimer = window.setInterval(() => {
      this.setState((prevState) => ({
        recordSeconds: prevState.recordSeconds + 1,
      }));
    }, 1000);
  };

  /** 结束录音：send 为 true 时发送，否则提示已取消；时长过短提示太短。 */
  hgFinishRecord = (send) => {
    if (!this.state.recording) {
      return;
    }
    this.hgClearRecordTimer();
    const rawSeconds = (Date.now() - this.hgRecordStartAt) / 1000;
    this.setState({ recording: false, recordSeconds: 0 });
    if (!send) {
      this.hgShowToast("已取消发送");
      return;
    }
    if (rawSeconds < 1) {
      this.hgShowToast("说话时间太短");
      return;
    }
    if (typeof this.props.onSendVoice === "function") {
      this.props.onSendVoice(Math.round(rawSeconds));
    }
  };

  /** 松开发送语音。 */
  hgHandleRecordEnd = () => {
    this.hgFinishRecord(true);
  };

  /** 按住期间移出按钮：取消本次录音（对齐微信上滑取消交互）。 */
  hgHandleRecordCancel = () => {
    this.hgFinishRecord(false);
  };

  /**
   * 渲染底部展开面板（表情网格 / 圆圈加动作）。
   * @returns {React.ReactNode} 面板节点，未展开返回 null。
   */
  renderPanel = () => {
    const { panel } = this.state;
    if (panel === PANEL_EMOJI) {
      return (
        <div className={styles.panel}>
          <div className={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiItem}
                title={`发送表情 ${emoji}`}
                onClick={() => this.hgHandleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (panel === PANEL_PLUS) {
      return (
        <div className={styles.panel}>
          <div className={styles.plusGrid}>
            {PLUS_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                className={styles.plusItem}
                onClick={() => this.hgHandleAction(action.key)}
              >
                <span className={styles.plusIcon}>{PLUS_ICONS[action.key]}</span>
                <span className={styles.plusLabel}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  /**
   * 渲染短提示浮层（取消发送 / 时间太短）。
   * @returns {React.ReactNode} 提示节点。
   */
  renderToast = () => {
    const { toast } = this.state;
    if (!toast) {
      return null;
    }
    return <div className={styles.toast}>{toast}</div>;
  };

  /**
   * 渲染左侧模式切换按钮：文字模式显示语音键，语音模式显示键盘键。
   * @returns {React.ReactNode} 模式切换按钮节点。
   */
  renderModeButton = () => {
    const { mode } = this.state;
    if (mode === MODE_TEXT) {
      return (
        <button
          type="button"
          className={styles.toolButton}
          title="切换到语音输入"
          onClick={() => this.hgSwitchMode(MODE_VOICE)}
        >
          {ICON_MIC}
        </button>
      );
    }
    return (
      <button
        type="button"
        className={styles.toolButton}
        title="切换到键盘输入"
        onClick={() => this.hgSwitchMode(MODE_TEXT)}
      >
        {ICON_KEYBOARD}
      </button>
    );
  };

  /**
   * 渲染中间输入主体：文字输入框或按住说话按钮。
   * @returns {React.ReactNode} 输入主体节点。
   */
  renderInputBody = () => {
    const { value, placeholder = "输入消息，Enter 发送", disabled } = this.props;
    const { mode, recording, recordSeconds } = this.state;
    if (mode === MODE_TEXT) {
      return (
        <textarea
          className={styles.input}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={this.hgHandleTextChange}
          onKeyDown={this.hgHandleTextKeyDown}
        />
      );
    }
    const holdClassName = `${styles.holdButton} ${
      recording ? styles.holdButtonActive : ""
    }`;
    return (
      <button
        type="button"
        className={holdClassName}
        onPointerDown={this.hgHandleRecordStart}
        onPointerUp={this.hgHandleRecordEnd}
        onPointerLeave={this.hgHandleRecordCancel}
        onPointerCancel={this.hgHandleRecordCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        {recording ? `松开 发送（${recordSeconds}s）` : "按住 说话"}
      </button>
    );
  };

  /**
   * 渲染右侧操作区：有文字时显示发送按钮，否则显示圆圈加。
   * @returns {React.ReactNode} 右侧操作节点。
   */
  renderRightActions = () => {
    const { value } = this.props;
    const { panel, mode } = this.state;
    const canSend = Boolean((value || "").trim());
    if (canSend && mode === MODE_TEXT) {
      return (
        <button
          type="button"
          className={styles.sendButton}
          onClick={this.hgHandleSendText}
        >
          发送
        </button>
      );
    }
    const plusClassName = `${styles.toolButton} ${
      panel === PANEL_PLUS ? styles.toolButtonActive : ""
    }`;
    return (
      <button
        type="button"
        className={plusClassName}
        title={panel === PANEL_PLUS ? "收起" : "更多功能"}
        onClick={() => this.hgTogglePanel(PANEL_PLUS)}
      >
        {ICON_PLUS}
      </button>
    );
  };

  render() {
    const { panel } = this.state;
    const emojiClassName = `${styles.toolButton} ${
      panel === PANEL_EMOJI ? styles.toolButtonActive : ""
    }`;
    return (
      <div className={styles.root}>
        {this.renderToast()}
        {this.renderPanel()}
        <div className={styles.inputBar}>
          {this.renderModeButton()}
          {this.renderInputBody()}
          <button
            type="button"
            className={emojiClassName}
            title={panel === PANEL_EMOJI ? "收起表情" : "表情"}
            onClick={() => this.hgTogglePanel(PANEL_EMOJI)}
          >
            {ICON_EMOJI}
          </button>
          {this.renderRightActions()}
        </div>
      </div>
    );
  }
}

export default HGChatInput;
