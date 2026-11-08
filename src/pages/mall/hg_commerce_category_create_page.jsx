import React from "react";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 新建平台普通类目页（独立路由，由类目管理列表右上角进入）。
 * 职责：提交类目名称与可选上级 ID；成功后提示并支持返回列表。
 * 约束：本期仅创建 regulated=false 的普通类目；名称与层级合法性由服务端最终校验。
 */
export default class HGCommerceCategoryCreatePage extends React.Component {
  state = {
    hgName: "", // 新类目名称；1-64 字符，服务端最终校验。
    hgParentId: "", // 上级类目 ID 文本；空表示一级类目。
    hgBusy: false, // 提交中禁用表单与返回。
    hgError: "", // 最近一次失败提示；空表示无错误。
    hgNotice: "", // 最近一次成功提示；空表示无提示。
  };

  hgFlight = false; // 写操作同步门闩，避免异步 setState 期间重复提交。
  hgMounted = false; // 卸载后丢弃过期请求结果。

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

  /** 返回来源页；导航能力由路由包装注入，测试环境允许缺失。 */
  hgBack = () => {
    if (this.state.hgBusy) return;
    this.props.navigate?.(-1);
  };

  hgSubmit = (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgFlight) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    HGCommerceVM.createCategory({
      name: this.state.hgName.trim(),
      parentId: this.state.hgParentId.trim(),
      regulated: false, // 本期仅开放普通类目，受监管类目由后端单独维护。
    })
      .then(() => {
        if (this.hgMounted) this.setState({ hgNotice: "类目已创建" });
      })
      .catch((hgError) => {
        if (this.hgMounted)
          this.setState({ hgError: hgError?.message || "创建失败，请重试" });
      })
      .finally(() => {
        this.hgFlight = false;
        if (this.hgMounted) this.setState({ hgBusy: false });
      });
  };

  render() {
    const { hgName, hgParentId, hgBusy, hgError, hgNotice } = this.state;
    return (
      <main className={styles.page} aria-label="新建普通类目">
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
            <h2>新建普通类目</h2>
          </div>
          <p className={styles.desc}>
            仅创建普通（无需经营资质）类目；上级留空表示一级类目，最多三级。
          </p>
          <form className={styles.publishForm} onSubmit={this.hgSubmit}>
            <fieldset className={styles.commerceFieldset} disabled={hgBusy}>
              <legend>类目信息</legend>
              <div className={styles.field}>
                <label htmlFor="category-name">类目名称</label>
                <input
                  id="category-name"
                  required
                  maxLength={64}
                  value={hgName}
                  onChange={(hgEvent) =>
                    this.setState({ hgName: hgEvent.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="category-parent">上级类目 ID（可选）</label>
                <input
                  id="category-parent"
                  maxLength={32}
                  value={hgParentId}
                  onChange={(hgEvent) =>
                    this.setState({ hgParentId: hgEvent.target.value })
                  }
                />
                <p className={styles.fieldHint}>
                  填写已有类目 ID 则创建其子类目；留空创建一级类目。
                </p>
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={hgBusy}>
                {hgBusy ? "提交中…" : "创建类目"}
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
          </form>
        </section>
      </main>
    );
  }
}
