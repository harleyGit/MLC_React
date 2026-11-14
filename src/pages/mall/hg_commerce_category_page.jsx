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
 * 职责：按父子关系展示平台普通类目；审核员从右上角进入新建页、行内进入编辑/删除页。
 * 约束：数据来自管理员类目接口，受监管或已禁用类目不在本页；读写权限由服务端最终校验。
 */
export default class HGCommerceCategoryPage extends React.Component {
  state = {
    hgCategories: [], // 服务端返回的启用普通类目平铺列表；空表示尚无类目或当前无权限。
    hgCanReview: false, // 现有商城审核权限接口结果；无权限不展示管理入口。
    hgLoading: true, // 首次加载状态，避免误显示空表。
    hgError: "", // 最近一次失败提示；空表示无错误。
    hgPageCurrent: 1, // 前端分页当前页码；adminCategories 接口无分页参数，切片在本页完成。
    hgPageSize: 10, // 每页条数；随分页器 showSizeChanger 变化。
    hgCollapsedIds: [], // 已收起的父类目 ID；默认空数组表示全部展开，刷新后复位。
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
        hgPageCurrent: 1, // 重新加载后回到第一页，避免旧页码超出新数据范围导致空页。
        hgCollapsedIds: [],
      });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "类目列表加载失败" });
    } finally {
      if (this.hgMounted) this.setState({ hgLoading: false });
    }
  };

  /**
   * 分页变更回调：HGTablePage 的分页器只负责 UI 与回调，数据切片由本页完成。
   * 约束：切换每页条数时 HGTablePage 会回传 current=1，无需本页额外归位。
   * @param {{current: number, pageSize: number}} hgPagination 最新分页状态
   */
  hgHandleTableChange = ({ current, pageSize }) => {
    this.setState({ hgPageCurrent: current, hgPageSize: pageSize });
  };

  /** 构造独立树节点，不改动管理接口的平铺契约；缺失父节点时保留孤儿为根节点。 */
  hgCategoryRoots = () => {
    const hgNodes = new Map(); // 业务 ID 到展示节点；节点只在本次计算中使用。
    const hgRoots = []; // 一级类目及父节点缺失的类目；分页只针对这些根节点。
    this.state.hgCategories.forEach((hgItem) => {
      hgNodes.set(hgItem.categoryId, { hgItem, hgChildren: [] });
    });
    hgNodes.forEach((hgNode) => {
      const hgParent = hgNodes.get(hgNode.hgItem.parentId); // 上级缺失时不丢弃该类目。
      if (hgParent && hgParent !== hgNode) hgParent.hgChildren.push(hgNode);
      else hgRoots.push(hgNode);
    });
    return hgRoots;
  };

  /** 以根节点为分页单位展开可见行，确保子类目始终跟随父类目同页。 */
  hgCurrentPageCategories = (hgRoots = this.hgCategoryRoots()) => {
    const { hgPageCurrent, hgPageSize, hgCollapsedIds } = this.state;
    const hgMaxPage = Math.max(1, Math.ceil(hgRoots.length / hgPageSize)); // 空列表仍保留第一页。
    const hgSafeCurrent = Math.min(hgPageCurrent, hgMaxPage); // 数据刷新时避免空页。
    const hgStart = (hgSafeCurrent - 1) * hgPageSize; // 当前页根节点起始偏移。
    const hgRows = []; // 展平后供 HGTablePage 渲染的当前页可见行。
    const hgAppend = (hgNode, hgLevel) => {
      hgRows.push({ ...hgNode.hgItem, hgTreeLevel: hgLevel, hgHasChildren: hgNode.hgChildren.length > 0 });
      if (!hgCollapsedIds.includes(hgNode.hgItem.categoryId)) {
        hgNode.hgChildren.forEach((hgChild) => hgAppend(hgChild, hgLevel + 1));
      }
    };
    hgRoots.slice(hgStart, hgStart + hgPageSize).forEach((hgRoot) => hgAppend(hgRoot, 0));
    return hgRows;
  };

  /** 只切换当前父类目的可见子行，保持其他父类目及分页状态不变。 */
  hgToggleCategory = (hgID) => {
    this.setState((hgState) => ({
      hgCollapsedIds: hgState.hgCollapsedIds.includes(hgID)
        ? hgState.hgCollapsedIds.filter((hgItem) => hgItem !== hgID)
        : [...hgState.hgCollapsedIds, hgID],
    }));
  };

  /** 在第一列提供键盘可操作的展开按钮，子行以层级缩进展示。 */
  renderCategoryId(hgID, hgCategory) {
    const hgCollapsed = this.state.hgCollapsedIds.includes(hgID); // 仅有子类目时渲染可操作控件。
    return (
      <span className={styles.categoryTreeCell} style={{ paddingLeft: hgCategory.hgTreeLevel * 20 }}>
        {hgCategory.hgHasChildren ? (
          <button type="button" className={styles.categoryTreeToggle}
            aria-label={`${hgCollapsed ? "展开" : "收起"}类目 ${hgCategory.name}`}
            aria-expanded={!hgCollapsed} onClick={() => this.hgToggleCategory(hgID)}>
            {hgCollapsed ? "▸" : "▾"}
          </button>
        ) : <span className={styles.categoryTreeSpacer} aria-hidden="true" />}
        <span>{hgID}</span>
      </span>
    );
  }

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
    { title: "类目 ID", dataIndex: "categoryId", width: 220, render: (hgID, hgCategory) => this.renderCategoryId(hgID, hgCategory) },
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
    const { hgLoading, hgError, hgPageCurrent, hgPageSize } =
      this.state;
    const hgRoots = this.hgCategoryRoots(); // 根节点总数用于分页；展开的子行不额外占分页名额。
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
            列表展示已启用且无需经营资质的类目，点击箭头展开或收起子类目；已停用类目的 ID 仍被占用，不在列表中展示。
          </p>
          <HGTablePage
            columns={this.hgColumns()}
            dataSource={this.hgCurrentPageCategories(hgRoots)}
            rowKey="categoryId"
            loading={hgLoading}
            pagination={{
              current: hgPageCurrent,
              pageSize: hgPageSize,
              total: hgRoots.length,
              showSizeChanger: true,
            }}
            onChange={this.hgHandleTableChange}
          />
        </section>
      </main>
    );
  }
}
