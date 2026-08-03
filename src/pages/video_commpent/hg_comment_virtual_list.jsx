import React from "react";
import styles from "./hg_video_comments.module.css";

/**
 * 固定行高的回收式评论列表，DOM 行数只由视口、rowHeight 和 overscan 决定。
 */
class HGCommentVirtualList extends React.Component {
  static defaultProps = {
    height: 480,
    rowHeight: 112,
    overscan: 3,
    loadMoreThreshold: 224,
  };

  constructor(props) {
    super(props);
    this.state = { firstVisibleIndex: 0 };
    this.hgViewportRef = React.createRef();
  }

  componentDidMount() {
    this.checkLoadMore();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.items.length !== this.props.items.length
      || prevProps.hasMore !== this.props.hasMore
    ) {
      this.clampVisibleIndex();
      this.checkLoadMore();
    }
  }

  /** 根据滚动位置更新池对应的首行，并在接近底部时触发游标翻页。 */
  handleScroll = (event) => {
    const { rowHeight, overscan } = this.props;
    const maximumStart = Math.max(0, this.props.items.length - this.getPoolSize());
    const firstVisibleIndex = Math.min(
      maximumStart,
      Math.max(0, Math.floor(event.currentTarget.scrollTop / rowHeight) - overscan),
    );
    if (firstVisibleIndex !== this.state.firstVisibleIndex) {
      this.setState({ firstVisibleIndex });
    }
    this.checkLoadMore(event.currentTarget);
  };

  /** 数据删除后限制池起点，避免留下不可见空白。 */
  clampVisibleIndex = () => {
    const poolSize = this.getPoolSize();
    const maximumStart = Math.max(0, this.props.items.length - poolSize);
    if (this.state.firstVisibleIndex > maximumStart) {
      this.setState({ firstVisibleIndex: maximumStart });
    }
  };

  /** 距离列表底部达到阈值时请求下一页；父组件负责 loading 去重。 */
  checkLoadMore = (viewport = this.hgViewportRef.current) => {
    const { hasMore, loading, loadMoreThreshold, onLoadMore } = this.props;
    if (!viewport || !hasMore || loading || typeof onLoadMore !== "function") return;
    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (remaining <= loadMoreThreshold) onLoadMore();
  };

  /** 固定池大小确保累计加载评论时 DOM 节点数不增长。 */
  getPoolSize = () => {
    const { height, rowHeight, overscan } = this.props;
    return Math.ceil(height / rowHeight) + overscan * 2;
  };

  render() {
    const { items, height, rowHeight, renderRow } = this.props;
    const { firstVisibleIndex } = this.state;
    const poolSize = this.getPoolSize();

    return (
      <div
        ref={this.hgViewportRef}
        className={styles.virtualViewport}
        style={{ height }}
        onScroll={this.handleScroll}
      >
        <div className={styles.virtualCanvas} style={{ height: items.length * rowHeight }}>
          {Array.from({ length: poolSize }, (_, poolIndex) => {
            const itemIndex = firstVisibleIndex + poolIndex;
            const item = items[itemIndex];
            // poolIndex 保持节点身份稳定，滚动时只替换数据和位移。
            return (
              <div
                key={poolIndex}
                className={styles.virtualRow}
                style={{
                  height: rowHeight,
                  transform: `translateY(${itemIndex * rowHeight}px)`,
                  visibility: item ? "visible" : "hidden",
                }}
              >
                {item ? renderRow(item, itemIndex) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

export default HGCommentVirtualList;
