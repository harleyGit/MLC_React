import React from "react";
import styles from "./hg_video_upload_item.module.css";

/**
 * 视频上传单项组件：展示单个视频的上传状态、进度和操作按钮。
 * @param {Object} props
 * @param {Object} props.video 视频数据对象 {id, file, name, size, progress, status, previewUrl}。
 * @param {Function} props.onPause 暂停上传回调。
 * @param {Function} props.onResume 恢复上传回调。
 * @param {Function} props.onRetry 重新上传回调。
 * @param {Function} props.onReplace 更换视频回调。
 * @param {Function} props.onDelete 删除视频回调。
 * @param {boolean} props.isActive 是否为当前激活（选中）的视频。
 * @param {Function} props.onSelect 选中当前视频回调。
 */
class HGVideoUploadItem extends React.Component {
  /**
   * 渲染上传中状态的操作按钮。
   * @returns {React.ReactNode} 上传中按钮组 JSX。
   */
  renderUploadingActions = () => {
    const { video, onPause, onResume, onRetry, onDelete } = this.props;
    const isPaused = video.status === "paused";

    return (
      <div className={styles.actionGroup}>
        <span className={styles.progressText}>{Math.round(video.progress)}%</span>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => (isPaused ? onResume?.(video.id) : onPause?.(video.id))}
        >
          {isPaused ? "继续" : "暂停"}
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onRetry?.(video.id)}
        >
          重传
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
          onClick={() => onDelete?.(video.id)}
        >
          删除
        </button>
      </div>
    );
  };

  /**
   * 渲染上传完成状态的操作按钮。
   * @returns {React.ReactNode} 上传完成按钮组 JSX。
   */
  renderCompletedActions = () => {
    const { video, onReplace, onDelete } = this.props;

    return (
      <div className={styles.actionGroup}>
        <span className={styles.completedText}>上传完成</span>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onReplace?.(video.id)}
        >
          更换
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
          onClick={() => onDelete?.(video.id)}
        >
          删除
        </button>
      </div>
    );
  };

  /**
   * 组件主渲染：视频 logo、名称、进度条、操作按钮。
   * @returns {React.ReactNode} 视频上传项 JSX。
   */
  render() {
    const { video, isActive, onSelect } = this.props;
    const isUploading = video.status === "uploading" || video.status === "paused";

    return (
      <div
        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
        onClick={() => onSelect?.(video.id)}
      >
        <div className={styles.videoLogo}>▶</div>
        <div className={styles.infoArea}>
          <div className={styles.videoName}>{video.name}</div>
          {isUploading ? (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${video.progress}%` }}
              />
            </div>
          ) : null}
        </div>
        {isUploading ? this.renderUploadingActions() : this.renderCompletedActions()}
      </div>
    );
  }
}

export default HGVideoUploadItem;
