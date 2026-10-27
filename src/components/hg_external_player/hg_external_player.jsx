import React from "react";
import HGNetManager from "../../api/hg_net_manager";
import HGVideoPlayerPage from "../hg_video_player/hg_video_player_page";

const hgNet = new HGNetManager();

/** 外部分P经鉴权媒体代理交给本站video，弹幕使用真实播放时间而非手填或墙上时钟。 */
export default class HGExternalPlayer extends React.Component {
  state = { hgURL: "", hgError: "", hgLoading: false, hgRevision: 0 };
  hgSequence = 0;
  hgActive = false;

  componentDidMount() {
    this.hgActive = true;
    this.hgLoad();
  }
  componentDidUpdate(hgPrevious) {
    if (
      hgPrevious.video.externalContentId !==
        this.props.video.externalContentId ||
      hgPrevious.part?.cid !== this.props.part?.cid
    )
      this.hgLoad();
  }
  componentWillUnmount() {
    this.hgActive = false;
    this.hgSequence += 1;
  }

  /** 每次切换获取分P专属HttpOnly凭证，旧响应不得覆盖新视频。 */
  hgLoad = async () => {
    const hgSequence = ++this.hgSequence;
    this.setState({ hgURL: "", hgError: "", hgLoading: true });
    const { video, part } = this.props;
    if (!part || !video.externalDetail?.collectedAt) {
      this.setState({
        hgLoading: false,
        hgError: "分P详情入库后才可播放，请刷新详情。",
      });
      return;
    }
    const hgID = `external:bilibili:${video.externalContentId}:${part.cid}`;
    try {
      const hgResult = await hgNet.post(
        `/api/v1/video_upload/external-playback?videoId=${encodeURIComponent(
          hgID
        )}`,
        {}
      );
      if (!this.hgActive || hgSequence !== this.hgSequence) return;
      this.setState((hgState) => ({
        hgURL: hgNet.getFullURL(hgResult.url),
        hgLoading: false,
        hgRevision: hgState.hgRevision + 1,
      }));
    } catch (hgError) {
      if (this.hgActive && hgSequence === this.hgSequence)
        this.setState({
          hgLoading: false,
          hgError: hgError.message || "播放源获取失败",
        });
    }
  };

  render() {
    const { video, part } = this.props;
    const hgID = `external:bilibili:${video.externalContentId}:${part?.cid}`;
    return (
      <section aria-label="本站外部视频播放器">
        {this.state.hgLoading && <p role="status">正在获取播放源…</p>}
        {this.state.hgError && <p role="alert">{this.state.hgError}</p>}
        {this.state.hgURL && (
          <HGVideoPlayerPage
            key={`${hgID}:${this.state.hgRevision}`}
            video={{
              ...video,
              id: hgID,
              url: this.state.hgURL,
              filePath: this.state.hgURL,
            }}
          />
        )}
        <button
          type="button"
          disabled={this.state.hgLoading}
          onClick={this.hgLoad}
        >
          刷新播放源
        </button>
        <p>
          本站弹幕跟随视频时间轴播放，暂停、回退和重播均使用实际播放进度。当前debug媒体代理为360P，凭证30分钟有效；播放失败或过期可刷新播放源（将回到开头）。
        </p>
      </section>
    );
  }
}
