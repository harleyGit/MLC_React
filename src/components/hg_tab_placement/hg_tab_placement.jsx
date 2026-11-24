import React from "react";
import styles from "./hg_tab_placement.module.css";

/**
 * 标签项配置（JSDoc 契约，供编辑器跳转与调用方核对）。
 * @typedef {Object} HGTabPlacementTab
 * @property {React.Key} key 标签稳定标识；同级唯一，允许空字符串（如「全部」项），不参与展示。
 * @property {React.ReactNode} label 标签展示文案。
 * @property {React.ReactNode} [content] 该标签对应内容区节点；所有标签均缺省时不渲染内容区，组件退化为纯标签栏。
 * @property {boolean} [disabled] 是否禁用点击与键盘激活；默认 false。
 */

/**
 * 四向 Tab 组件：对标 antd Tabs 的 tabPlacement 行为。
 * 职责：按 start|end|top|bottom 四个位置排布标签栏与内容区；移动端窄屏（<=620px，
 * 与商城页断点一致）下 start/end 竖向布局自动降级为 top 横向布局，由 CSS 实现，
 * 不依赖 JS 环境探测。受控（activeKey）与非受控（defaultActiveKey）两种模式均可使用。
 */
class HGTabPlacement extends React.Component {
  static defaultProps = {
    /** 标签列表，默认 []；空数组时仅渲染空标签栏。 @type {HGTabPlacementTab[]} */
    tabs: [],
    /** 受控当前选中 key，默认 undefined 走非受控；传入后以该值为准（可为空字符串）。 @type {React.Key|undefined} */
    activeKey: undefined,
    /** 非受控模式初始选中 key，默认 undefined 初始不选中；仅首次挂载生效。 @type {React.Key|undefined} */
    defaultActiveKey: undefined,
    /** 切换到不同标签时回调新 key，默认 undefined 不通知；点击已选中或禁用标签不触发。 @type {((hgKey: React.Key) => void)|undefined} */
    onChange: undefined,
    /** 标签栏位置：start 左竖排 / end 右竖排 / top 顶横排 / bottom 底横排；默认 "top"，移动端 start/end 自动降级为 top。 @type {"start"|"end"|"top"|"bottom"} */
    tabPlacement: "top",
    /** 视觉变体：line 为下划线指示器（antd 默认风格），pill 为描边胶囊（商城二级类目风格）；默认 "line"。 @type {"line"|"pill"} */
    hgVariant: "line",
    /** 追加到根容器的额外类名，默认 undefined 不追加；用于调用方微调外层间距。 @type {string|undefined} */
    className: undefined,
    /** 标签栏 aria-label 无障碍名称，默认 undefined 不输出。 @type {string|undefined} */
    ariaLabel: undefined,
  };

  state = {
    // 非受控内部选中 key；受控模式（传入 activeKey）时不参与渲染，undefined 表示未选中。
    hgActiveKey: this.props.defaultActiveKey,
  };

  /**
   * 当前生效的选中 key：受控模式取 props.activeKey，非受控取内部 state。
   * @returns {React.Key|undefined} 当前选中 key；undefined 表示未选中任何标签。
   */
  hgResolvedKey() {
    return this.props.activeKey !== undefined
      ? this.props.activeKey
      : this.state.hgActiveKey;
  }

  /**
   * 点击标签：禁用或重复点击不触发；非受控模式先更新内部 state 再回调。
   * @param {HGTabPlacementTab} hgTab 被点击的标签配置。
   */
  hgHandleTabClick = (hgTab) => {
    if (hgTab.disabled || hgTab.key === this.hgResolvedKey()) return;
    if (this.props.activeKey === undefined)
      this.setState({ hgActiveKey: hgTab.key });
    this.props.onChange?.(hgTab.key);
  };

  /**
   * 标签栏方向键导航：Left/Up 向前、Right/Down 向后环形移动焦点并自动激活目标标签
   * （对齐 antd Tabs 的 automatic activation）；禁用标签被跳过。
   * @param {React.KeyboardEvent<HTMLDivElement>} hgEvent 标签栏键盘事件。
   */
  hgHandleKeyDown = (hgEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
        hgEvent.key
      )
    )
      return;
    const hgButtons = Array.from(
      hgEvent.currentTarget.querySelectorAll(
        "[data-tab-key]:not([disabled])"
      )
    );
    if (hgButtons.length < 2) return;
    hgEvent.preventDefault();
    const hgIndex = hgButtons.indexOf(
      hgEvent.target.closest("[data-tab-key]")
    );
    if (hgIndex < 0) return;
    const hgDelta =
      hgEvent.key === "ArrowLeft" || hgEvent.key === "ArrowUp" ? -1 : 1;
    const hgNext =
      hgButtons[(hgIndex + hgDelta + hgButtons.length) % hgButtons.length];
    hgNext.focus();
    const hgTab = this.props.tabs.find(
      (hgItem) => String(hgItem.key) === hgNext.dataset.tabKey
    );
    if (hgTab) this.hgHandleTabClick(hgTab);
  };

  /**
   * 标签栏渲染：role=tablist + tab 按钮，选中态用 aria-selected 表达。
   * @param {React.Key|undefined} hgActiveKey 当前生效选中 key。
   * @returns {React.ReactNode} 标签栏 JSX。
   */
  renderTabList(hgActiveKey) {
    const { tabs, ariaLabel } = this.props;
    return (
      <div
        className={styles.tabList}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={this.hgHandleKeyDown}
      >
        {tabs.map((hgTab) => (
          <button
            key={hgTab.key}
            type="button"
            role="tab"
            data-tab-key={String(hgTab.key)}
            aria-selected={hgTab.key === hgActiveKey}
            disabled={hgTab.disabled}
            className={`${styles.tabItem} ${
              hgTab.key === hgActiveKey ? styles.tabItemActive : ""
            }`}
            onClick={() => this.hgHandleTabClick(hgTab)}
          >
            {hgTab.label}
          </button>
        ))}
      </div>
    );
  }

  render() {
    const { tabs, tabPlacement, hgVariant, className } = this.props;
    // 位置到布局类的映射；未知取值兜底为 top，避免布局崩坏。
    const hgPlacementClass = {
      start: styles.placementStart,
      end: styles.placementEnd,
      top: styles.placementTop,
      bottom: styles.placementBottom,
    }[tabPlacement] || styles.placementTop;
    const hgActiveKey = this.hgResolvedKey();
    // 当前选中标签；未选中或 key 失配时为 undefined，内容区渲染空。
    const hgActiveTab = tabs.find((hgTab) => hgTab.key === hgActiveKey);
    // 任一标签声明 content 才渲染内容区，纯导航场景不产生多余容器。
    const hgHasContent = tabs.some(
      (hgTab) => hgTab.content !== undefined && hgTab.content !== null
    );
    return (
      <div
        className={[
          styles.tabPlacement,
          hgPlacementClass,
          hgVariant === "pill" ? styles.variantPill : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {this.renderTabList(hgActiveKey)}
        {hgHasContent && (
          <div className={styles.tabContent} role="tabpanel">
            {hgActiveTab?.content ?? null}
          </div>
        )}
      </div>
    );
  }
}

export default HGTabPlacement;
