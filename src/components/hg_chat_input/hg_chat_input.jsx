/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-31 00:45:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-31 00:45:00
 * @FilePath: /MLC_React/src/components/hg_chat_input/hg_chat_input.jsx
 * @Description: 微信风格聊天输入框：文字/语音双模式 + 表情面板 + 圆圈加扩展面板。
 */
import React from "react";
import HGIconPage from "../hg_icon/hg_icon_page.jsx";
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

/** 圆圈加扩展面板动作：key 对应 props 中的 onSendXxx 回调与 hg_icon 图标 type。 */
const PLUS_ACTIONS = [
  { key: "image", label: "图片", icon: "image" },
  { key: "video", label: "视频", icon: "video" },
  { key: "redPacket", label: "红包", icon: "red-packet" },
  { key: "card", label: "联系人名片", icon: "card" },
];

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
                <span className={styles.plusIcon}>
                  <HGIconPage type={action.icon} className={styles.actionIcon} />
                </span>
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
          <HGIconPage type="mic" className={styles.toolIcon} />
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
        <HGIconPage type="keyboard" className={styles.toolIcon} />
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
        <HGIconPage type="plus-circle" className={styles.toolIcon} />
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
        <div className={styles.inputBar}>
          {this.renderModeButton()}
          {this.renderInputBody()}
          <button
            type="button"
            className={emojiClassName}
            title={panel === PANEL_EMOJI ? "收起表情" : "表情"}
            onClick={() => this.hgTogglePanel(PANEL_EMOJI)}
          >
            <HGIconPage type="emotion" className={styles.toolIcon} />
          </button>
          {this.renderRightActions()}
        </div>
        {/* 表情/更多面板在输入条下方展开，撑高底部把输入框顶上来 */}
        {this.renderPanel()}
      </div>
    );
  }
}

export default HGChatInput;
