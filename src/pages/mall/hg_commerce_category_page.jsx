import React from "react";
import { Link } from "react-router-dom";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path.jsx";
import HGTablePage from "../../components/hg_table/hg_table_page";
import HGCommerceVM from "./hg_commerce_vm.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

// 类目层级编码对应展示文案；服务端约束 1-3，未知编码原样展示不猜测。
const HG_CATEGORY_DEPTH_LABELS = { 1: "一级", 2: "二级", 3: "三级" };

/**
 * 平台普通类目管理列表页（个人中心「商家中心 → 普通类目管理」子菜单内容）。
 * 职责：表格展示平台普通叶子类目；审核员从右上角进入新建页、行内进入编辑/删除页。
  * 约束：数据来自管理员类目接口，受监管或已禁用类目不在本页；读写权限由服务端最终校验。
 */
export default class HGCommerceCategoryPage extends React.Component {
  state = {
    hgCategories: [], // 服务端返回的平台普通叶子类目；空表示尚无类目或当前无权限。
    hgCanReview: false, // 现有商城审核权限接口结果；无权限不展示管理入口。
    hgLoading: true, // 首次加载状态，避免误显示空表。
    hgError: "", // 最近一次失败提示；空表示无错误。
  };

  hgMounted = false; // 卸载后丢弃过期请求结果。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoad();
  }

  componentWillUnmount() {
    this.hgMounted = false;
  }

  /** 先确认审核权再读取管理员类目，避免将商家类目接口当作平台入口。 */
  hgLoad = async () => {
    this.setState({ hgLoading: true, hgError: "" });
    try {
      const hgAccess = await HGMallVM.reviewAccess(); // 平台管理入口的服务端权限结果。
      if (!hgAccess?.canReview) {
        if (this.hgMounted)
          this.setState({
            hgCategories: [],
            hgCanReview: false,
            hgError: "需要商城审核权限 mall:merchant:review 才能管理平台类目",
          });
        return;
      }
      const hgCategories = await HGCommerceVM.adminCategories(); // 审核员专属列表，不要求商家身份。
      if (!this.hgMounted) return;
      this.setState({
        hgCategories: hgCategories || [],
        hgCanReview: true,
      });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "类目列表加载失败" });
    } finally {
      if (this.hgMounted) this.setState({ hgLoading: false });
    }
  };

  /** 行内操作列：编辑与删除均进入独立页面，不在列表内直接提交写操作。 */
  renderActions(hgCategory) {
    if (!this.state.hgCanReview)
      return <span className={styles.fieldHint}>—</span>;
    return (
      <div className={styles.actions}>
        <Link
          className={styles.btnGhost}
          to={ROUTE_PATH.COMMERCE_CATEGORY_EDIT.replace(
            ":categoryId",
            encodeURIComponent(hgCategory.categoryId)
          )}
        >
          编辑
        </Link>
        <Link
          className={styles.btnDanger}
          to={ROUTE_PATH.COMMERCE_CATEGORY_DELETE.replace(
            ":categoryId",
            encodeURIComponent(hgCategory.categoryId)
          )}
        >
          删除
        </Link>
      </div>
    );
  }

  /** 表格列配置；操作列内容随审核权变化。 */
  hgColumns = () => [
    { title: "类目 ID", dataIndex: "categoryId", width: 220 },
    { title: "类目名称", dataIndex: "name", width: 240 },
    {
      title: "类目图片",
      dataIndex: "imageURL",
      width: 140,
      render: (hgURL) => hgURL
        ? <img className={styles.editThumb} src={normalizeVideoCoverUrl(hgURL)} alt="类目图片" loading="lazy" />
        : <span className={styles.fieldHint}>无图</span>,
    },
    {
      title: "层级",
      dataIndex: "depth",
      width: 100,
      render: (hgDepth) =>
        HG_CATEGORY_DEPTH_LABELS[hgDepth] || `未知(${String(hgDepth)})`,
    },
    {
      title: "操作",
      dataIndex: "hgActions",
      width: 170,
      render: (_, hgCategory) => this.renderActions(hgCategory),
    },
  ];

  /** 页头右侧新建入口；仅审核员可见，避免无权限用户进入必然失败的表单页。 */
  renderToolbar() {
    if (!this.state.hgCanReview) return null;
    return (
      <div className={styles.actions}>
        <Link className={styles.btn} to={ROUTE_PATH.COMMERCE_CATEGORY_CREATE}>
          新建普通类目
        </Link>
      </div>
    );
  }

  render() {
    const { hgCategories, hgLoading, hgError } = this.state;
    return (
      <main className={styles.page} aria-label="平台普通类目管理">
        {hgError && (
          <p role="alert" className={styles.errorBar}>
            {hgError}
          </p>
        )}
        <section className={styles.panel}>
          <div className={styles.head}>
            <h2>普通类目管理</h2>
            {this.renderToolbar()}
          </div>
          <p className={styles.desc}>
            列表仅展示已启用且无需经营资质的叶子类目；受监管或已禁用类目由服务端维护，不在本页展示。
          </p>
          <HGTablePage
            columns={this.hgColumns()}
            dataSource={hgCategories}
            rowKey="categoryId"
            loading={hgLoading}
            pagination={false}
            scroll={{ y: 480 }}
          />
        </section>
      </main>
    );
  }
}
