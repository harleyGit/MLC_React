import React from "react";
import { ROUTE_PATH } from "../../router/hg_router_path";
import styles from "./hg_video_upload_edit_page.module.css";
import HGVideoUploadEditPageVM from "./hg_video_upload_edit_page_vm";
import HGVideoUploadList from "./components/hg_video_upload_list";
import HGVideoConfigForm from "./components/hg_video_config_form";
import HGTabSelector from "./components/hg_tab_selector";
import HGSchedulePublish from "./components/hg_schedule_publish";
import HGSecondaryCreation from "./components/hg_secondary_creation";
import HGMoreSettings from "./components/hg_more_settings";

/**
 * 视频上传后编辑页：展示视频列表、每个视频的配置表单、定时发布、二创设置等。
 * 支持多视频上传、分P、来回切换配置。
 */
class HGVideoUploadEditPage extends React.Component {
  /**
   * 构造函数：初始化视频列表、配置和全局设置。
   * @param {Object} props 组件属性，包含路由 state 中的视频文件列表。
   */
  constructor(props) {
    super(props);
    const videoFiles = props.location?.state?.uploadVideos || [];
    const videos = videoFiles.map((file) => {
      const id = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
        previewUrl: "",
      };
    });
    this.state = HGVideoUploadEditPageVM.createInitialState(videos);
    this.previewUrls = {};
  }

  /**
   * 生命周期挂载：为本地视频创建预览地址，启动模拟上传进度。
   * 约束：没有视频时保持空态，避免页面报错。
   */
  componentDidMount() {
    const { videos } = this.state;
    if (videos.length === 0) {
      this.setState({ tips: "未找到已选择的视频，请返回投稿页重新上传。" });
      return;
    }

    this.setState((prevState) => {
      const updatedVideos = prevState.videos.map((v) => {
        const previewUrl = URL.createObjectURL(v.file);
        this.previewUrls[v.id] = previewUrl;
        return { ...v, previewUrl };
      });
      return { videos: updatedVideos };
    });

    this.startSimulatedUpload();
  }

  /**
   * 生命周期卸载：释放所有视频预览 Object URL。
   */
  componentWillUnmount() {
    Object.values(this.previewUrls).forEach((url) => {
      URL.revokeObjectURL(url);
    });
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }
  }

  /**
   * 启动模拟上传进度。
   * 约束：仅用于前端演示，真实场景应替换为后端上传逻辑。
   */
  startSimulatedUpload = () => {
    this.uploadTimer = setInterval(() => {
      this.setState((prevState) => {
        let allDone = true;
        const updatedVideos = prevState.videos.map((v) => {
          if (v.status === "uploading" && v.progress < 100) {
            allDone = false;
            const newProgress = Math.min(v.progress + Math.random() * 15, 100);
            return {
              ...v,
              progress: newProgress,
              status: newProgress >= 100 ? "completed" : "uploading",
            };
          }
          return v;
        });
        if (allDone) {
          clearInterval(this.uploadTimer);
        }
        return { videos: updatedVideos };
      });
    }, 500);
  };

  /**
   * 选中视频：切换当前配置的视频。
   * @param {string} videoId 视频 ID。
   */
  handleSelectVideo = (videoId) => {
    this.setState({ activeVideoId: videoId });
  };

  /**
   * 暂停上传。
   * @param {string} videoId 视频 ID。
   */
  handlePause = (videoId) => {
    this.setState((prevState) => ({
      videos: prevState.videos.map((v) =>
        v.id === videoId ? { ...v, status: "paused" } : v
      ),
    }));
  };

  /**
   * 恢复上传。
   * @param {string} videoId 视频 ID。
   */
  handleResume = (videoId) => {
    this.setState((prevState) => ({
      videos: prevState.videos.map((v) =>
        v.id === videoId ? { ...v, status: "uploading" } : v
      ),
    }));
  };

  /**
   * 重试上传。
   * @param {string} videoId 视频 ID。
   */
  handleRetry = (videoId) => {
    this.setState((prevState) => ({
      videos: prevState.videos.map((v) =>
        v.id === videoId ? { ...v, progress: 0, status: "uploading" } : v
      ),
    }));
  };

  /**
   * 删除视频。
   * @param {string} videoId 视频 ID。
   * 约束：删除后自动切换到相邻视频。
   */
  handleDeleteVideo = (videoId) => {
    this.setState((prevState) => {
      const filtered = prevState.videos.filter((v) => v.id !== videoId);
      const newConfigs = { ...prevState.configs };
      delete newConfigs[videoId];

      let newActiveId = prevState.activeVideoId;
      if (videoId === prevState.activeVideoId && filtered.length > 0) {
        newActiveId = filtered[0].id;
      }

      return {
        videos: filtered,
        configs: newConfigs,
        activeVideoId: newActiveId,
      };
    });

    if (this.previewUrls[videoId]) {
      URL.revokeObjectURL(this.previewUrls[videoId]);
      delete this.previewUrls[videoId];
    }
  };

  /**
   * 更新当前激活视频的配置。
   * @param {Object} newConfig 新的配置对象。
   */
  handleConfigChange = (newConfig) => {
    this.setState((prevState) => ({
      configs: {
        ...prevState.configs,
        [prevState.activeVideoId]: newConfig,
      },
    }));
  };

  /**
   * 返回投稿上传入口。
   * 约束：仅路由返回，不清理外部状态。
   */
  handleBackUpload = () => {
    this.props.navigate?.(ROUTE_PATH.EDIT_USER_INFO);
  };

  /**
   * 提交全部稿件。
   * 约束：校验所有视频配置，通过后提示（未接入后端）。
   */
  handleSubmit = () => {
    const { videos, configs } = this.state;
    const validateResult = HGVideoUploadEditPageVM.validateAllConfigs(videos, configs);
    if (!validateResult.valid) {
      this.setState({ tips: validateResult.message });
      return;
    }
    this.setState({ tips: "稿件信息校验通过，后续可接入真实发布接口。" });
  };

  /**
   * 渲染左侧视频列表面板。
   * @returns {React.ReactNode} 视频列表 JSX。
   */
  renderLeftPanel = () => {
    const { videos, activeVideoId } = this.state;
    return (
      <HGVideoUploadList
        videos={videos}
        activeVideoId={activeVideoId}
        onSelectVideo={this.handleSelectVideo}
        onPause={this.handlePause}
        onResume={this.handleResume}
        onRetry={this.handleRetry}
        onReplace={this.handleRetry}
        onDelete={this.handleDeleteVideo}
      />
    );
  };

  /**
   * 渲染视频预览。
   * @returns {React.ReactNode} 视频预览 JSX。
   */
  renderVideoPreview = () => {
    const { videos, activeVideoId } = this.state;
    const activeVideo = videos.find((v) => v.id === activeVideoId);
    if (!activeVideo) return null;

    return (
      <div className={styles.videoPreview}>
        {activeVideo.previewUrl ? (
          <video
            src={activeVideo.previewUrl}
            controls
            className={styles.videoPlayer}
          />
        ) : (
          <div className={styles.videoPlaceholder}>暂无预览</div>
        )}
      </div>
    );
  };

  /**
   * 渲染右侧配置面板：视频预览 + Tab 切换 + 配置表单。
   * @returns {React.ReactNode} 配置面板 JSX。
   */
  renderRightPanel = () => {
    const { videos, activeVideoId, configs } = this.state;
    const activeConfig = configs[activeVideoId] || {};

    const tabItems = videos.map((v) => ({
      key: v.id,
      label: v.name.length > 12 ? `${v.name.slice(0, 12)}...` : v.name,
    }));

    return (
      <div className={styles.rightPanel}>
        <HGTabSelector
          tabs={tabItems}
          activeKey={activeVideoId}
          onChange={this.handleSelectVideo}
        />
        {this.renderVideoPreview()}
        <HGVideoConfigForm
          config={activeConfig}
          onConfigChange={this.handleConfigChange}
        />
      </div>
    );
  };

  /**
   * 组件主渲染：顶部标题、左侧视频列表、右侧配置、底部操作。
   * @returns {React.ReactNode} 页面 JSX。
   */
  render() {
    const {
      tips,
      scheduleEnabled,
      publishTime,
      allowSecondaryCreation,
      hasCommercial,
      commercialInfo,
      moreSettings,
      videos,
    } = this.state;

    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h2 className={styles.pageTitle}>视频投稿</h2>
            <p className={styles.subTitle}>上传已完成，请继续完善稿件信息</p>
          </div>
          <button
            type="button"
            className={styles.backButton}
            onClick={this.handleBackUpload}
          >
            重新上传
          </button>
        </div>

        <main className={styles.mainGrid}>
          {this.renderLeftPanel()}
          {this.renderRightPanel()}
        </main>

        <div className={styles.globalSettings}>
          <HGSchedulePublish
            enabled={scheduleEnabled}
            publishTime={publishTime}
            onEnabledChange={(val) => this.setState({ scheduleEnabled: val })}
            onTimeChange={(val) => this.setState({ publishTime: val })}
          />
          <HGSecondaryCreation
            allowSecondaryCreation={allowSecondaryCreation}
            hasCommercial={hasCommercial}
            commercialInfo={commercialInfo}
            onSecondaryCreationChange={(val) =>
              this.setState({ allowSecondaryCreation: val })
            }
            onCommercialChange={(val) => this.setState({ hasCommercial: val })}
            onCommercialInfoChange={(val) =>
              this.setState({ commercialInfo: val })
            }
          />
          <HGMoreSettings
            settings={moreSettings}
            onSettingsChange={(val) => this.setState({ moreSettings: val })}
          />
        </div>

        {tips ? <div className={styles.tips}>{tips}</div> : null}

        <div className={styles.actionBar}>
          <button
            type="button"
            className={styles.draftButton}
            onClick={this.handleSubmit}
          >
            保存草稿
          </button>
          <button
            type="button"
            className={styles.submitButton}
            onClick={this.handleSubmit}
            disabled={videos.length === 0}
          >
            立即投稿
          </button>
        </div>
      </div>
    );
  }
}

export default HGVideoUploadEditPage;
