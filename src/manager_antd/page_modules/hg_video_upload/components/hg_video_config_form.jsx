import React from "react";
import styles from "./hg_video_config_form.module.css";
import HGTagSelector from "../../../../components/hg_tag_selector/hg_tag_selector";
import HGDropdownSelector from "../../../../components/hg_dropdown_selector/hg_dropdown_selector";
import HGNetManager from "../../../../api/hg_net_manager";

/** 推荐标签列表 */
const RECOMMEND_TAGS = [
  { value: "生活记录", label: "生活记录" },
  { value: "直播", label: "直播" },
  { value: "录屏", label: "录屏" },
  { value: "记录", label: "记录" },
  { value: "自用", label: "自用" },
  { value: "学习", label: "学习" },
  { value: "PS", label: "PS" },
  { value: "原创", label: "原创" },
];

/** 分区列表 */
const CATEGORY_OPTIONS = [
  { value: "生活", label: "生活" },
  { value: "知识", label: "知识" },
  { value: "科技", label: "科技" },
  { value: "游戏", label: "游戏" },
  { value: "音乐", label: "音乐" },
  { value: "动画", label: "动画" },
  { value: "影视", label: "影视" },
  { value: "舞蹈", label: "舞蹈" },
];

/** 视频帧提取数量 */
const FRAME_COUNT = 6;

/**
 * 视频配置表单组件：每个视频对应的封面、标题、类型、分区、标签等配置。
 * @param {Object} props
 * @param {Object} props.config 当前视频配置对象。
 * @param {Function} props.onConfigChange 配置变更回调。
 * @param {string} props.videoUrl 视频地址（本地预览 URL 或服务端 URL），用于提取封面帧。
 */
class HGVideoConfigForm extends React.Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();
    this.state = {
      frames: [],
      extracting: false,
      uploadingCover: false,
      selectedFrameIdx: -1,
    };
  }

  componentDidMount() {
    this.extractFrames();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.videoUrl !== this.props.videoUrl) {
      this.setState({ selectedFrameIdx: -1 });
      this.extractFrames();
    }
  }

  /**
   * 从视频中提取 6 帧画面。
   * 通过隐藏 video + canvas 实现：加载视频后跳转到指定时间点，逐帧截图。
   */
  extractFrames = () => {
    const { videoUrl } = this.props;
    if (!videoUrl) return;

    this.setState({ extracting: true, frames: [] });

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration === Infinity || isNaN(duration)) {
        this.setState({ extracting: false });
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const frames = [];
      const timestamps = [];

      for (let i = 1; i <= FRAME_COUNT; i++) {
        timestamps.push((duration / (FRAME_COUNT + 1)) * i);
      }

      let index = 0;

      const captureFrame = () => {
        if (index >= timestamps.length) {
          this.setState({ frames, extracting: false });
          video.remove();
          return;
        }

        video.currentTime = timestamps[index];
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
        index++;
        captureFrame();
      };

      captureFrame();
    };

    video.onerror = () => {
      this.setState({ extracting: false });
    };

    video.src = videoUrl;
  };

  /**
   * 更新配置字段。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段值。
   */
  handleFieldChange = (fieldName, fieldValue) => {
    const { config, onConfigChange } = this.props;
    if (onConfigChange) {
      onConfigChange({
        ...config,
        [fieldName]: fieldValue,
      });
    }
  };

  /**
   * 选择视频帧作为封面：先上传到服务端获取 URL，再写入配置。
   * @param {string} frameDataUrl 帧的 data URL。
   * @param {number} idx 帧索引。
   */
  handleSelectFrame = async (frameDataUrl, idx) => {
    this.setState({ uploadingCover: true, selectedFrameIdx: idx });
    try {
      const HGNet = new HGNetManager();
      const resp = await HGNet.post("/api/v1/video_upload/cover", {
        image: frameDataUrl,
      });
      const coverUrl = resp?.url || "";
      this.handleFieldChange("coverUrl", coverUrl);
    } catch (err) {
      console.error("封面上传失败:", err);
      this.setState({ selectedFrameIdx: -1 });
    } finally {
      this.setState({ uploadingCover: false });
    }
  };

  /**
   * 渲染封面选择区域：从视频帧中选择封面。
   * @returns {React.ReactNode} 封面选择 JSX。
   */
  renderCoverSection = () => {
    const { config } = this.props;
    const { frames, extracting, uploadingCover, selectedFrameIdx } = this.state;

    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>
          封面 <span className={styles.required}>*</span>
        </span>

        {/* 当前封面预览 */}
        <div className={styles.coverArea}>
          {config.coverUrl ? (
            <img src={config.coverUrl} alt="封面预览" className={styles.coverPreview} />
          ) : (
            <div className={styles.coverEmpty}>
              {extracting ? "正在提取视频帧..." : uploadingCover ? "封面上传中..." : "从下方选择封面帧"}
            </div>
          )}
        </div>

        {/* 视频帧选择网格 */}
        {frames.length > 0 && (
          <div className={styles.frameGrid}>
            {frames.map((frame, idx) => (
              <div
                key={idx}
                className={`${styles.frameItem} ${selectedFrameIdx === idx ? styles.frameItemSelected : ""} ${uploadingCover ? styles.frameItemDisabled : ""}`}
                onClick={() => !uploadingCover && this.handleSelectFrame(frame, idx)}
              >
                <img src={frame} alt={`帧 ${idx + 1}`} className={styles.frameImage} />
                <span className={styles.frameLabel}>{idx + 1}</span>
              </div>
            ))}
          </div>
        )}

        {extracting && (
          <div className={styles.frameGrid}>
            {Array.from({ length: FRAME_COUNT }).map((_, idx) => (
              <div key={idx} className={`${styles.frameItem} ${styles.frameItemLoading}`}>
                <div className={styles.frameSkeleton} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染类型选择（自制/转载）。
   * @returns {React.ReactNode} 类型选择 JSX。
   */
  renderTypeSection = () => {
    const { config } = this.props;
    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>类型</span>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="videoType"
              checked={config.videoType === "自制"}
              onChange={() => this.handleFieldChange("videoType", "自制")}
            />
            <span>自制</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="videoType"
              checked={config.videoType === "转载"}
              onChange={() => this.handleFieldChange("videoType", "转载")}
            />
            <span>转载</span>
          </label>
        </div>
        {config.videoType === "转载" ? (
          <input
            className={styles.inputControl}
            value={config.sourceUrl || ""}
            placeholder="请输入转载来源 URL"
            onChange={(e) => this.handleFieldChange("sourceUrl", e.target.value)}
          />
        ) : null}
      </div>
    );
  };

  /**
   * 渲染标签选择区域。
   * @returns {React.ReactNode} 标签选择 JSX。
   */
  renderTagSection = () => {
    const { config } = this.props;
    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>
          标签 <span className={styles.required}>*</span>
          <span className={styles.tagLimit}>（最多 7 个）</span>
        </span>
        <HGTagSelector
          options={RECOMMEND_TAGS}
          value={config.tags || []}
          multiple
          maxCount={7}
          onChange={(newTags) => this.handleFieldChange("tags", newTags)}
        />
      </div>
    );
  };

  /**
   * 组件主渲染：封面、标题、类型、分区、标签、简介。
   * @returns {React.ReactNode} 视频配置表单 JSX。
   */
  render() {
    const { config } = this.props;

    return (
      <div className={styles.container}>
        {this.renderCoverSection()}

        <label className={styles.formItem}>
          <span className={styles.formLabel}>
            标题 <span className={styles.required}>*</span>
          </span>
          <input
            className={styles.inputControl}
            value={config.title || ""}
            maxLength={80}
            placeholder="请输入稿件标题"
            onChange={(e) => this.handleFieldChange("title", e.target.value)}
          />
          <span className={styles.charCount}>{(config.title || "").length}/80</span>
        </label>

        {this.renderTypeSection()}

        <div className={styles.formItem}>
          <span className={styles.formLabel}>
            分区 <span className={styles.required}>*</span>
          </span>
          <HGDropdownSelector
            options={CATEGORY_OPTIONS}
            value={config.category || ""}
            placeholder="请选择分区"
            onChange={(val) => this.handleFieldChange("category", val)}
          />
        </div>

        {this.renderTagSection()}

        <label className={styles.formItem}>
          <span className={styles.formLabel}>简介</span>
          <textarea
            className={`${styles.inputControl} ${styles.textareaControl}`}
            value={config.description || ""}
            maxLength={2000}
            placeholder="填写视频简介，让观众更快了解你的作品"
            onChange={(e) => this.handleFieldChange("description", e.target.value)}
          />
        </label>
      </div>
    );
  }
}

export default HGVideoConfigForm;
