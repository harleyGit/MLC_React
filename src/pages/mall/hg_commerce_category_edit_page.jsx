import React from "react";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 编辑平台普通类目页（独立路由，由类目管理列表行内「编辑」进入）。
 * 职责：展示目标类目当前名称并提交新名称；编辑接口为前端预留契约，后端实现前提交会失败并如实展示错误。
 * 约束：无类目详情接口，当前名称从可经营类目列表解析；目标不在列表中时禁止编辑。
 */
export default class HGCommerceCategoryEditPage extends React.Component {
  state = {
    hgName: "", // 编辑后的类目名称；1-64 字符，服务端最终校验。
    hgLoaded: false, // 是否已从列表接口解析出目标类目。
    hgBusy: false, // 提交中禁用表单与返回。
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

  /** 目标类目当前信息；受监管或禁用类目不在可经营列表中，解析不到时不允许编辑。 */
  hgLoad = async () => {
    const hgID = this.props.params?.categoryId;
    if (!hgID) {
      this.setState({ hgError: "缺少类目 ID，请从类目管理列表进入" });
      return;
    }
    try {
      const hgCategories = await HGCommerceVM.categories();
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
      this.setState({ hgName: hgTarget.name, hgLoaded: true });
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

  hgSubmit = (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgFlight || !this.state.hgLoaded) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    // 编辑接口为前端预留契约：后端实现前请求失败，页面如实展示服务端错误。
    HGCommerceVM.editCategory(this.props.params?.categoryId, {
      name: this.state.hgName.trim(),
    })
      .then(() => {
        if (this.hgMounted) this.setState({ hgNotice: "类目已更新" });
      })
      .catch((hgError) => {
        if (this.hgMounted)
          this.setState({ hgError: hgError?.message || "更新失败，请重试" });
      })
      .finally(() => {
        this.hgFlight = false;
        if (this.hgMounted) this.setState({ hgBusy: false });
      });
  };

  render() {
    const { hgName, hgLoaded, hgBusy, hgError, hgNotice } = this.state;
    return (
      <main className={styles.page} aria-label="编辑普通类目">
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
            <h2>编辑普通类目</h2>
            <span className={styles.headSmall}>
              ID：{this.props.params?.categoryId || "未知"}
            </span>
          </div>
          <p className={styles.desc}>
            当前名称来自可经营类目列表；名称与层级合法性由服务端最终校验。
          </p>
          <form className={styles.publishForm} onSubmit={this.hgSubmit}>
            <fieldset className={styles.commerceFieldset} disabled={hgBusy}>
              <legend>类目信息</legend>
              <div className={styles.field}>
                <label htmlFor="category-edit-name">类目名称</label>
                <input
                  id="category-edit-name"
                  required
                  maxLength={64}
                  value={hgName}
                  disabled={!hgLoaded}
                  onChange={(hgEvent) =>
                    this.setState({ hgName: hgEvent.target.value })
                  }
                />
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.btn}
                disabled={hgBusy || !hgLoaded}
              >
                {hgBusy ? "提交中…" : "保存修改"}
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
