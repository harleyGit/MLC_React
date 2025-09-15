/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-09-04 17:56:43
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-11 21:14:44
 * @FilePath: /app-web/imi-diagnosis/src/app/guide_video/GuideVideoView.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component, createRef } from "react";
import styles from "./GuideVideo.module.css";
import withRouter from "../../../utils/WithRouter";

class GuideVideoView extends Component {
  constructor(props) {
    super(props);
    this.videoRef = createRef();
    this.state = {
      isPlaying: false,
      showPlayButton: false,
      videoUrl: ""
    };
  }

  componentDidMount() {
    const videoUrl = this.props.location?.state?.videoUrl || "";
    if (videoUrl) {
      this.setState({ videoUrl }, this.autoPlay);
    }

    // 暴露给原生调用
    window.playGuideVideo = (url) => {
      this.setState({ videoUrl: url, showPlayButton: false }, this.autoPlay);
    };
    window.closeGuideVideo = this.handleClose;
  }

  componentWillUnmount() {
    const video = this.videoRef.current;
    if (video) video.removeEventListener("ended", this.handleVideoEnded);
    window.playGuideVideo = null;
    window.closeGuideVideo = null;
  }

  autoPlay = () => {
    const video = this.videoRef.current;
    if (!video) return;

    video.play().then(() => {
      this.setState({ isPlaying: true, showPlayButton: false });
    }).catch(() => {
      this.setState({ isPlaying: false, showPlayButton: true });
    });

    video.addEventListener("ended", this.handleVideoEnded);
  };

  handleVideoEnded = () => {
    const video = this.videoRef.current;
    if (video) video.currentTime = 0;
    this.setState({ isPlaying: false, showPlayButton: true });
  };

  handlePlay = () => {
    const video = this.videoRef.current;
    if (video) {
      video.play();
      this.setState({ isPlaying: true, showPlayButton: false });
    }
  };

  handleTogglePlay = () => {
    const video = this.videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      this.setState({ isPlaying: true, showPlayButton: false });
    } else {
      video.pause();
      this.setState({ isPlaying: false, showPlayButton: true });
    }
  };

  handleClose = () => {
    // iOS
    if (window.webkit?.messageHandlers?.exitFreshManGuideView) {
      window.webkit.messageHandlers.exitFreshManGuideView.postMessage(null);
    }
    // Android
    if (window.Android?.exitFreshManGuideView) {
      window.Android.exitFreshManGuideView();
    }
    console.log("关闭页面");
  };

  render() {
    const { showPlayButton, videoUrl } = this.state;

    return (
      <div className={styles.container}>
        <button className={styles.closeButton} onClick={this.handleClose}>
          ✕
        </button>

        {videoUrl && (
          <video
            ref={this.videoRef}
            className={styles.video}
            src={videoUrl}
            playsInline
            webkit-playsinline="true"
            onClick={this.handleTogglePlay}
          />
        )}

        {showPlayButton && (
          <button className={styles.playButton} onClick={this.handlePlay}>
            ▶
          </button>
        )}
      </div>
    );
  }
}

export default withRouter(GuideVideoView);
