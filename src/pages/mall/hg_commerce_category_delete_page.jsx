import React from "react";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 删除平台普通类目确认页（独立路由，由类目管理列表行内「删除」进入）。
 * 职责：展示目标类目信息并在显式确认后提交删除；删除接口为前端预留契约，后端实现前提交会失败并如实展示错误。
 * 约束：无类目详情接口，目标信息从可经营类目列表解析；解析不到时不允许提交删除。
 */
export default class HGCommerceCategoryDeletePage extends React.Component {
  state = {
    hgTarget: null, // 待删类目 { categoryId, name, depth }；null 表示尚未解析。
    hgBusy: false, // 提交中禁用操作。
    hgError: "", // 最近一次失败提示；空表示无错误。
    hgNotice: "", // 最近一次成功提示；空表示无提示。
  };

  hgMounted = false; // 卸载后丢弃过期请求结果。
  hgFlight = false; // 写操作同步门闩，避免异步 setState 期间重复提交。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoad();
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

  /** 目标类目信息；受监管或禁用类目不在可经营列表中，解析不到时不允许删除。 */
  hgLoad = async () => {
    const hgID = this.props.params?.categoryId;
    if (!hgID) {
      this.setState({ hgError: "缺少类目 ID，请从类目管理列表进入" });
      return;
    }
    try {
      const hgCategories = await HGCommerceVM.adminCategories();
      if (!this.hgMounted) return;
      const hgTarget = (hgCategories || []).find(
        (hgItem) => hgItem.categoryId === hgID
      );
      if (!hgTarget) {
        this.setState({
          hgError: "未找到该类目；可能已被禁用或删除，请刷新类目列表",
        });
        return;
      }
      this.setState({ hgTarget });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "类目信息加载失败" });
    }
  };

  /** 返回来源页；导航能力由路由包装注入，测试环境允许缺失。 */
  hgBack = () => {
    if (this.state.hgBusy) return;
    this.props.navigate?.(-1);
  };

  hgConfirm = () => {
    if (this.hgFlight || !this.state.hgTarget) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    // 删除接口为前端预留契约：后端实现前请求失败，页面如实展示服务端错误。
    HGCommerceVM.deleteCategory(this.state.hgTarget.categoryId)
      .then(() => {
        if (this.hgMounted) this.setState({ hgNotice: "类目已删除" });
      })
      .catch((hgError) => {
        if (this.hgMounted)
          this.setState({ hgError: hgError?.message || "删除失败，请重试" });
      })
      .finally(() => {
        this.hgFlight = false;
        if (this.hgMounted) this.setState({ hgBusy: false });
      });
  };

  render() {
    const { hgTarget, hgBusy, hgError, hgNotice } = this.state;
    return (
      <main className={styles.page} aria-label="删除普通类目">
        {hgError && (
          <p role="alert" className={styles.errorBar}>
            {hgError}
          </p>
        )}
        {hgNotice && (
          <p role="status" className={styles.noticeBar}>
            {hgNotice}
          </p>
        )}
        <section className={styles.panel}>
          <div className={styles.head}>
            <h2>删除普通类目</h2>
          </div>
          <p className={styles.desc}>
            删除操作不可恢复；是否允许删除由服务端校验（如类目下仍有商品时通常会被拒绝）。
          </p>
          {hgTarget ? (
            <div className={styles.commerceReviewDetail}>
              <p>
                类目 ID：{hgTarget.categoryId} · 层级：第
                {hgTarget.depth}级
              </p>
              <h4>{hgTarget.name}</h4>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={hgBusy}
                  onClick={this.hgConfirm}
                >
                  {hgBusy ? "删除中…" : "确认删除"}
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={hgBusy}
                  onClick={this.hgBack}
                >
                  返回
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.fieldHint}>
              正在读取类目信息；若该类目不可经营则不会出现在列表中，无法删除。
            </p>
          )}
        </section>
      </main>
    );
  }
}
