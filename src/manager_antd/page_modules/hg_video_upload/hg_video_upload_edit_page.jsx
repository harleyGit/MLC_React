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
   * 生命周期挂载：为本地视频创建预览地址，并调用后端真实上传接口。
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

    this.startUploadQueue();
  }

  /**
   * 生命周期卸载：释放所有视频预览 Object URL。
   */
  componentWillUnmount() {
    Object.values(this.previewUrls).forEach((url) => {
      URL.revokeObjectURL(url);
    });
  }

  /**
   * 逐个上传视频文件，保持同一 submissionId 以支持多 P 投稿。
   */
  startUploadQueue = async () => {
    const { videos } = this.state;
    let submissionId = "";

    for (let index = 0; index < videos.length; index += 1) {
      const localVideo = videos[index];
      this.updateVideoUploadState(localVideo.id, {
        status: "uploading",
        progress: 10,
      });

      try {
        const uploadResult = await HGVideoUploadEditPageVM.uploadVideoFile({
          file: localVideo.file,
          submissionId,
          partNumber: index + 1,
        });
        submissionId = submissionId || uploadResult.submissionId;
        this.updateVideoUploadState(localVideo.id, {
          status: "completed",
          progress: 100,
          submissionId: uploadResult.submissionId,
          videoId: uploadResult.videoId,
          fileUrl: uploadResult.fileUrl,
          filePath: uploadResult.filePath,
          md5: uploadResult.md5,
        });
      } catch (error) {
        this.updateVideoUploadState(localVideo.id, {
          status: "failed",
          progress: 0,
        });
        this.setState({ tips: error?.message || `视频「${localVideo.name}」上传失败` });
        return;
      }
    }
  };

  updateVideoUploadState = (videoId, patch) => {
    this.setState((prevState) => ({
      videos: prevState.videos.map((v) => (v.id === videoId ? { ...v, ...patch } : v)),
    }));
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
    }), this.startUploadQueue);
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
   * 约束：先校验所有视频配置，再调用保存草稿或提交审核接口。
   */
  handleSubmit = async (targetStatus = "reviewing") => {
    const { videos, configs } = this.state;
    const validateResult = HGVideoUploadEditPageVM.validateAllConfigs(videos, configs);
    if (!validateResult.valid) {
      this.setState({ tips: validateResult.message });
      return;
    }

    const payload = HGVideoUploadEditPageVM.buildSubmissionPayload(this.state);
    this.setState({ submitting: true, tips: "正在保存稿件信息..." });
    try {
      const response = targetStatus === "draft"
        ? await HGVideoUploadEditPageVM.saveDraft(payload)
        : await HGVideoUploadEditPageVM.submit(payload);
      this.setState({
        submitting: false,
        tips: targetStatus === "draft"
          ? `草稿已保存：${response.submissionId}`
          : `投稿已提交审核：${response.submissionId}`,
      });
    } catch (error) {
      this.setState({
        submitting: false,
        tips: error?.message || "稿件提交失败，请稍后重试。",
      });
    }
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

    const activeVideo = videos.find((v) => v.id === activeVideoId);
    const videoUrl = activeVideo?.previewUrl || activeVideo?.fileUrl || activeVideo?.filePath || "";

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
          videoUrl={videoUrl}
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
      submitting,
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
            onClick={() => this.handleSubmit("draft")}
            disabled={submitting || videos.length === 0}
          >
            保存草稿
          </button>
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => this.handleSubmit("reviewing")}
            disabled={submitting || videos.length === 0}
          >
            立即投稿
          </button>
        </div>
      </div>
    );
  }
}

export default HGVideoUploadEditPage;
