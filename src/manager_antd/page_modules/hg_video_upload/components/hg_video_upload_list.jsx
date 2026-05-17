import React from "react";
import styles from "./hg_video_upload_list.module.css";
import HGVideoUploadItem from "./hg_video_upload_item";

/**
 * 视频上传列表组件：管理多个视频的上传状态，支持添加、删除、切换。
 * @param {Object} props
 * @param {Array} props.videos 视频数据列表。
 * @param {string} props.activeVideoId 当前激活的视频 ID。
 * @param {Function} props.onSelectVideo 选中视频回调。
 * @param {Function} props.onPause 暂停上传回调。
 * @param {Function} props.onResume 恢复上传回调。
 * @param {Function} props.onRetry 重新上传回调。
 * @param {Function} props.onReplace 更换视频回调。
 * @param {Function} props.onDelete 删除视频回调。
 * @param {Function} props.onAddVideo 添加新视频回调。
 */
class HGVideoUploadList extends React.Component {
  /**
   * 渲染添加视频按钮。
   * @returns {React.ReactNode} 添加按钮 JSX。
   */
  renderAddButton = () => {
    const { onAddVideo } = this.props;
    return (
      <button
        type="button"
        className={styles.addButton}
        onClick={onAddVideo}
      >
        + 添加视频
      </button>
    );
  };

  /**
   * 组件主渲染：视频列表 + 添加按钮。
   * @returns {React.ReactNode} 视频上传列表 JSX。
   */
  render() {
    const {
      videos,
      activeVideoId,
      onSelectVideo,
      onPause,
      onResume,
      onRetry,
      onReplace,
      onDelete,
    } = this.props;

    return (
      <div className={styles.container}>
        <div className={styles.listHeader}>
          <span className={styles.listTitle}>视频列表</span>
          <span className={styles.listCount}>{videos.length} 个视频</span>
        </div>
        <div className={styles.listBody}>
          {videos.map((video) => (
            <HGVideoUploadItem
              key={video.id}
              video={video}
              isActive={video.id === activeVideoId}
              onSelect={onSelectVideo}
              onPause={onPause}
              onResume={onResume}
              onRetry={onRetry}
              onReplace={onReplace}
              onDelete={onDelete}
            />
          ))}
          {this.renderAddButton()}
        </div>
      </div>
    );
  }
}

export default HGVideoUploadList;
