/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-29
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/components/hg_page_header/hg_page_header_page.jsx
 * @Description: 页面头组件，统一展示页面标题、描述与右侧操作区
 */
import React from "react";
import styles from "./hg_page_header.module.css";

/**
 * 页面头组件。
 * 职责：展示页面标题、副标题描述和右侧操作区，只负责展示。
 *
 * Props:
 * - title: 页面标题。
 * - description: 标题下方的说明文字。
 * - extra: 右侧操作区节点。
 */
/** @extends {React.PureComponent<Partial<typeof HGPageHeaderPage.defaultProps>>} */
class HGPageHeaderPage extends React.PureComponent {
  static defaultProps = {
    /** 页面主标题，默认 undefined 不提供标题内容。 @type {React.ReactNode} */
    title: undefined,
    /** 标题下的补充说明，默认 undefined 不显示。 @type {React.ReactNode} */
    description: undefined,
    /** 页头右侧操作节点，默认 undefined 不显示。 @type {React.ReactNode} */
    extra: undefined,
  };

  render() {
    const { title, description, extra } = this.props;
    const showHeader = title != null || extra != null;
    if (!showHeader && !description) return null;

    return (
      <div className={styles.pageHeader}>
        <div className={styles.mainArea}>
          {title != null && (
            <div className={styles.titleRow}>
              <span className={styles.titleAccent} />
              <h2 className={styles.title}>{title}</h2>
            </div>
          )}
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
        </div>
        {extra != null ? <div className={styles.extra}>{extra}</div> : null}
      </div>
    );
  }
}

export default HGPageHeaderPage;
