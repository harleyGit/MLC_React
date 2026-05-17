import React from "react";
import styles from "./hg_video_upload_page.module.css";
import HGVideoUploadPageVM from "./hg_video_upload_page_vm";

/**
 * 投稿上传入口页：负责选择视频文件并进入投稿信息编辑页。
 * 支持拖拽上传、多文件选择。
 */
class HGVideoUploadPage extends React.Component {
  /**
   * 构造函数：初始化拖拽状态和文件输入引用。
   * @param {Object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.state = HGVideoUploadPageVM.createInitialState();
    this.fileInputRef = React.createRef();
  }

  /**
   * 打开系统文件选择器。
   * 约束：只触发隐藏 input，支持多选。
   */
  handleOpenFilePicker = () => {
    this.fileInputRef.current?.click();
  };

  /**
   * 处理文件 input change 事件。
   * @param {Event} event 文件选择事件。
   * 约束：处理后清空 input 值，允许重复选择同一个文件。
   */
  handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleVideoFiles(Array.from(files));
    }
    event.target.value = "";
  };

  /**
   * 处理拖拽进入上传区域。
   * @param {DragEvent} event 拖拽事件。
   * 约束：阻止浏览器默认打开文件行为。
   */
  handleDragOver = (event) => {
    event.preventDefault();
    this.setState({ dragging: true });
  };

  /**
   * 处理拖拽离开上传区域。
   * @param {DragEvent} event 拖拽事件。
   * 约束：仅维护拖拽视觉状态。
   */
  handleDragLeave = (event) => {
    event.preventDefault();
    this.setState({ dragging: false });
  };

  /**
   * 处理拖拽释放文件。
   * @param {DragEvent} event 拖拽释放事件。
   * 约束：支持多个文件。
   */
  handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    this.setState({ dragging: false });
    if (files && files.length > 0) {
      this.handleVideoFiles(Array.from(files));
    }
  };

  /**
   * 校验并提交多个视频文件给父页面处理。
   * @param {Array<File>} videoFiles 用户选择的视频文件列表。
   * 约束：逐个校验，只通过校验合格的文件。
   */
  handleVideoFiles = (videoFiles) => {
    const validFiles = [];
    let errorMessage = "";

    for (const videoFile of videoFiles) {
      const validateResult = HGVideoUploadPageVM.validateVideoFile(videoFile);
      if (!validateResult.valid) {
        errorMessage = validateResult.message;
        break;
      }
      validFiles.push(videoFile);
    }

    if (errorMessage) {
      this.setState({ tips: errorMessage });
      return;
    }

    this.setState({ tips: "" });
    this.props.onVideoSelected?.(validFiles);
  };

  /**
   * 渲染投稿流程说明。
   * @returns {React.ReactNode} 投稿步骤 JSX。
   */
  renderProcess = () => {
    return (
      <div className={styles.processWrap}>
        <div className={styles.processItem}>
          <span className={styles.processIndex}>1</span>
          <span>上传视频</span>
        </div>
        <div className={styles.processLine} />
        <div className={styles.processItem}>
          <span className={styles.processIndex}>2</span>
          <span>填写稿件信息</span>
        </div>
        <div className={styles.processLine} />
        <div className={styles.processItem}>
          <span className={styles.processIndex}>3</span>
          <span>等待审核发布</span>
        </div>
      </div>
    );
  };

  /**
   * 组件主渲染：投稿上传卡片和基础规则说明。
   * @returns {React.ReactNode} 页面 JSX。
   */
  render() {
    const { dragging, tips } = this.state;
    const uploadBoxClassName = `${styles.uploadBox} ${
      dragging ? styles.uploadBoxActive : ""
    }`;

    return (
      <section className={styles.page}>
        <div className={styles.headerBar}>
          <h3 className={styles.title}>视频投稿</h3>
          <span className={styles.headerTag}>创作中心</span>
        </div>
        {this.renderProcess()}
        <div
          className={uploadBoxClassName}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop}
        >
          <div className={styles.uploadIcon}>↑</div>
          <div className={styles.uploadTitle}>拖拽视频到此处，或点击上传</div>
          <div className={styles.uploadDesc}>支持 MP4、MOV、AVI、FLV 等常见视频格式，可多选</div>
          <button
            type="button"
            className={styles.uploadButton}
            onClick={this.handleOpenFilePicker}
          >
            上传视频
          </button>
          <input
            ref={this.fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className={styles.fileInput}
            onChange={this.handleFileChange}
          />
        </div>
        {tips ? <div className={styles.tips}>{tips}</div> : null}
        <div className={styles.ruleCard}>
          <h4>投稿须知</h4>
          <p>请确认作品内容清晰、声音正常，且拥有对应素材版权。</p>
          <p>上传完成后将进入稿件信息编辑页，可继续填写标题、分区和简介。</p>
        </div>
      </section>
    );
  }
}

export default HGVideoUploadPage;
