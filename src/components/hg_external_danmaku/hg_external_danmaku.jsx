import React from "react";
import { createVideoDanmaku, getVideoDanmaku } from "../../pages/bilibili/hg_bili_danmaku_api";

/** 官方iframe不暴露可靠播放时钟；本站弹幕按用户指定时间点读写，不模拟同步叠加。父组件按CID重挂载。 */
export default class HGExternalDanmaku extends React.Component {
  state = { hgSeconds: "0", hgContent: "", hgItems: [], hgCursor: "", hgMore: false, hgTotal: 0, hgLoading: false, hgSending: false, hgError: "" };
  hgActive = false;
  hgSequence = 0;
  hgPending = null;

  componentDidMount() { this.hgActive = true; this.hgLoad(); }
  componentWillUnmount() { this.hgActive = false; this.hgSequence += 1; }

  /** 校验手填时间，避免越界时间和空值静默提交。 */
  hgTime = () => {
    const hgSeconds = Number(this.state.hgSeconds);
    if (this.state.hgSeconds.trim() === "" || !Number.isFinite(hgSeconds) || hgSeconds < 0 || hgSeconds > this.props.duration || hgSeconds * 1000 > 4294907295) throw new Error("请输入当前分 P 时长内的时间点（秒）");
    return Math.floor(hgSeconds * 1000);
  };

  /** 每次仅展示一页、60秒时间窗，下一页替换列表以保持内存有界。 */
  hgLoad = async (hgNext = false) => {
    const hgSequence = ++this.hgSequence;
    this.setState({ hgLoading: true, hgError: "" });
    try {
      const hgFrom = Math.floor(this.hgTime() / 60000) * 60000;
      const hgResult = await getVideoDanmaku(this.props.videoId, hgFrom, hgNext ? this.state.hgCursor : "");
      if (!this.hgActive || hgSequence !== this.hgSequence) return;
      this.setState({ hgItems: hgResult.danmaku || [], hgCursor: hgResult.nextCursor || "", hgMore: Boolean(hgResult.hasMore), hgTotal: hgResult.totalCount || 0 });
    } catch (hgError) {
      if (this.hgActive && hgSequence === this.hgSequence) this.setState({ hgError: hgError.message || "本站弹幕读取失败" });
    } finally {
      if (this.hgActive && hgSequence === this.hgSequence) this.setState({ hgLoading: false });
    }
  };

  /** 同载荷失败重试沿用requestId；成功后才清空，避免网络结果未知时重复写入。 */
  hgSend = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.state.hgSending) return;
    this.setState({ hgSending: true, hgError: "" });
    try {
      const hgContent = this.state.hgContent.trim();
      if (!hgContent || Array.from(hgContent).length > 100) throw new Error("弹幕内容须为1至100个字符");
      const hgProgress = this.hgTime();
      if (!this.hgPending || this.hgPending.content !== hgContent || this.hgPending.progressMs !== hgProgress) {
        this.hgPending = { videoId: this.props.videoId, content: hgContent, progressMs: hgProgress, requestId: crypto.randomUUID() };
      }
      await createVideoDanmaku(this.hgPending);
      if (!this.hgActive) return;
      this.props.onSent?.(hgContent);
      this.hgPending = null;
      this.setState({ hgContent: "" });
      await this.hgLoad();
    } catch (hgError) {
      if (this.hgActive) this.setState({ hgError: hgError.message || "本站弹幕发送失败，可重试" });
    } finally {
      if (this.hgActive) this.setState({ hgSending: false });
    }
  };

  renderComposer() {
    return <form onSubmit={this.hgSend}>
      <label>时间点（秒）<input type="number" min="0" max={this.props.duration} step="0.1" value={this.state.hgSeconds} disabled={this.state.hgSending} onChange={(hgEvent) => {
        this.hgSequence += 1;
        this.setState({ hgSeconds: hgEvent.target.value, hgItems: [], hgCursor: "", hgMore: false, hgLoading: false });
      }} /></label>
      <label>本站弹幕<input value={this.state.hgContent} disabled={this.state.hgSending} onChange={(hgEvent) => this.setState({ hgContent: hgEvent.target.value })} placeholder="1至100个字符" /></label>
      <button type="submit" disabled={this.state.hgSending}>{this.state.hgSending ? "发送中…" : "发送本站弹幕"}</button>
    </form>;
  }

  render() {
    return <section aria-label="本站分P弹幕">
      <h3>本站弹幕 · P{this.props.page} · 共{this.state.hgTotal}条</h3>
      <p>点击“发送本站弹幕”保存成功后，文案会立即在上方画面滚动显示。时间点用于保存和查询；历史弹幕尚不随播放进度自动回放。原站播放器全屏和画中画不包含本站叠加层。</p>
      {this.renderComposer()}
      <button type="button" disabled={this.state.hgLoading} onClick={() => this.hgLoad()}>刷新该分钟弹幕</button>
      {this.state.hgError && <p role="alert">{this.state.hgError}</p>}
      <ul>{this.state.hgItems.map((hgItem) => <li key={hgItem.danmakuId}>{(hgItem.progressMs / 1000).toFixed(1)}秒 · {hgItem.content}</li>)}</ul>
      {this.state.hgMore && <button type="button" disabled={this.state.hgLoading} onClick={() => this.hgLoad(true)}>下一页</button>}
    </section>;
  }
}
