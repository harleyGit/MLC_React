import React from "react";
import HGExternalDanmaku from "../hg_external_danmaku/hg_external_danmaku";
import { hgExternalPlayerURL } from "./hg_external_player_url";
import styles from "./hg_external_player.module.css";

/** 外部播放与本站互动统一容器；iframe只负责媒体，本站弹幕不调用原站接口。 */
export default class HGExternalPlayer extends React.Component {
  state = { hgOverlay: [] };
  hgSequence = 0;
  hgTimers = new Map();

  /** 分P切换时清除旧画面弹幕，避免跨视频残留。 */
  componentDidUpdate(hgPrevious) {
    if (hgPrevious.video.externalContentId !== this.props.video.externalContentId || hgPrevious.part?.cid !== this.props.part?.cid) {
      this.hgClearTimers();
      this.setState({ hgOverlay: [] });
    }
  }

  componentWillUnmount() { this.hgClearTimers(); }

  /** 定时兜底与动画结束都释放弹幕，后台标签页也不会无限积累。 */
  hgClearTimers = () => {
    this.hgTimers.forEach((hgTimer) => clearTimeout(hgTimer));
    this.hgTimers.clear();
  };

  hgRemove = (hgID) => {
    clearTimeout(this.hgTimers.get(hgID));
    this.hgTimers.delete(hgID);
    this.setState((hgState) => ({ hgOverlay: hgState.hgOverlay.filter((hgItem) => hgItem.id !== hgID) }));
  };

  /** 仅成功写入后即时展示本人弹幕，不将即时反馈伪装成播放时钟同步。最多保留8条。 */
  hgShowSent = (hgContent) => {
    const hgID = ++this.hgSequence;
    this.setState((hgState) => ({ hgOverlay: [...hgState.hgOverlay.slice(-7), { id: hgID, content: hgContent, lane: (hgID - 1) % 8 }] }));
    if (this.hgTimers.size >= 8) {
      const hgOldest = this.hgTimers.keys().next().value;
      clearTimeout(this.hgTimers.get(hgOldest));
      this.hgTimers.delete(hgOldest);
    }
    this.hgTimers.set(hgID, setTimeout(() => this.hgRemove(hgID), 8500));
  };

  /** 不授予弹窗和顶层导航权限，阻止原站互动按钮打开B站页面。 */
  renderMedia() {
    const { video, part } = this.props;
    const hgURL = hgExternalPlayerURL(video.externalContentId, part?.cid, part?.page);
    if (!hgURL) return <p role="alert">外部视频标识无效，无法播放。</p>;
    return <div className={styles.media}>
      <iframe key={hgURL} src={hgURL} title={video.title}
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      <div className={styles.overlay} aria-hidden="true">
        {this.state.hgOverlay.map((hgItem) => <div key={hgItem.id} className={styles.lane} style={{ top: `${5 + hgItem.lane * 8}%` }}>
          <span className={styles.danmaku} onAnimationEnd={() => this.hgRemove(hgItem.id)}>{hgItem.content}</span>
        </div>)}
      </div>
    </div>;
  }

  render() {
    const { video, part } = this.props;
    const hgVideoID = `external:bilibili:${video.externalContentId}:${part?.cid}`;
    return <section className={styles.player} aria-label="外部视频与本站弹幕">
      {this.renderMedia()}
      <div className={styles.interaction}>
        {part && video.externalDetail?.collectedAt
          ? <HGExternalDanmaku key={hgVideoID} videoId={hgVideoID} page={part.page} duration={part.duration} onSent={this.hgShowSent} />
          : <p role="status">分 P 详情入库后可使用本站弹幕，请刷新详情状态。</p>}
      </div>
    </section>;
  }
}
