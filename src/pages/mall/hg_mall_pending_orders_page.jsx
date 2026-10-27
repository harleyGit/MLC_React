import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import HGTablePage from "../../components/hg_table/hg_table_page";
import { HGFormatCoin } from "./hg_mall_amount.js";
import {
  HG_MALL_ORDER_PAGE_SIZE,
  hgOrderCursorAt,
  hgOrderPushCursor,
  hgOrderTotalCount,
} from "./hg_mall_order_pagination.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 与商城下单流程共用的会话键；核对订单后才能清除。

/**
 * 本人待支付与超时取消订单页，对应个人中心「我的订单 → 待付款」。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；离开菜单即卸载，不保留后台轮询。
 */
export default class HGMallPendingOrdersPage extends React.Component {
  state = {
    hgOrders: [], // 本人当前页待支付及已过期取消订单；不跨用户保存收件信息。
    hgCursors: [""], // 已探索页的服务端游标；索引 i 对应第 i+1 页，首项空字符串为第一页。
    hgPage: 1, // 当前页码，从 1 起。
    hgHasMore: false, // 当前页之后是否还有下一页；由服务端 hasMore 决定。
    hgLoading: false, // 列表读取中；表格展示加载遮罩。
    hgError: "", // 加载或写操作错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgBusy: false, // 支付写操作门闩，防止快速重复提交。
    hgPendingBuy: false, // 会话内存在结果未知的购买请求时为 true，须核对订单或重试原请求。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 列表请求序号；快速翻页只接受最后一次响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({ hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey) });
    } catch {
      /* 禁用会话存储时仍保留组件内的待确认状态。 */
    }
    this.hgLoadOrders();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 仅从服务端读取本人有界待支付页；过期状态和支付权限均由后端确定。 */
  hgLoadOrders = async (hgPage = this.state.hgPage) => {
    const hgSeq = ++this.hgSeq; // 本次查询身份，忽略卸载或翻页后的旧响应。
    this.setState({ hgLoading: true });
    try {
      const hgPageData = await HGMallVM.pendingOrders(
        hgOrderCursorAt(this.state.hgCursors, hgPage)
      ); // 收件信息来自鉴权接口，不由前端拼装。
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPageData?.list) ||
        typeof hgPageData?.hasMore !== "boolean" ||
        typeof hgPageData?.nextCursor !== "string"
      )
        throw new Error("待支付订单响应异常");
      if (hgPage > 1 && !hgPageData.list.length) {
        this.hgLoadOrders(1); // 当前页被支付或超时清空后退回第一页，不停留在空页。
        return;
      }
      this.setState({
        hgOrders: hgPageData.list,
        hgPage,
        hgCursors: hgOrderPushCursor(
          this.state.hgCursors,
          hgPage,
          hgPageData.hasMore ? hgPageData.nextCursor : ""
        ),
        hgHasMore: hgPageData.hasMore,
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgLoading: false });
    }
  };

  /** 表格分页回调；加载中忽略重复点击，页码超出已探索页时由 hgOrderCursorAt 兜底。 */
  hgPageChange = ({ current }) => {
    if (!current || current === this.state.hgPage || this.state.hgLoading) return;
    this.hgLoadOrders(current);
  };

  /** 分页配置；条数按游标语义换算，不支持条数切换与跳页。 */
  hgPagination = () => ({
    current: this.state.hgPage,
    pageSize: HG_MALL_ORDER_PAGE_SIZE,
    total: hgOrderTotalCount(this.state.hgPage, this.state.hgOrders.length, this.state.hgHasMore),
  });

  /**
   * 页面内写操作串行执行；成功后重读当前页并通知余额订阅者刷新。
   * 约束：409 表示订单状态被其他端改变，重取当前页后如实展示错误。
   */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      this.props.hgOnBalanceChange?.();
      if (this.hgMounted) {
        this.setState({ hgNotice: hgSuccess });
        await this.hgLoadOrders();
      }
    } catch (hgError) {
      if (this.hgMounted) {
        this.setState({ hgError: this.hgMessage(hgError) });
        if (hgError?.status === 409) await this.hgLoadOrders();
      }
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 支付只提交订单 ID，余额、订单价格和15分钟截止时间以服务端为准。 */
  hgPay = (hgOrderId) =>
    this.hgWrite(async () => {
      await HGMallVM.pay(hgOrderId);
    }, "订单已支付 M币，请等待商家发货");

  /** 核对订单后清除会话内待确认购买标记；仅影响提示，不改变服务端订单。 */
  hgClearPendingBuy = () => {
    try {
      sessionStorage.removeItem(hgPendingBuyKey);
    } catch {
      /* 会话存储不可用时仅清理本页状态。 */
    }
    this.setState({ hgPendingBuy: false });
  };

  /** 待支付/超时订单的交易状态文案；仅覆盖本期实物订单状态。 */
  hgTradeStatusText = (hgOrder) =>
    hgOrder.tradeStatus === 1 ? "待支付" : "超时取消，库存已释放";

  /** 订单详情链接；路由参数只携带订单号，归属校验在服务端。 */
  hgDetailLink = (hgOrder) => (
    <Link
      to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(
        ":orderId",
        encodeURIComponent(hgOrder.orderId)
      )}
    >
      查看订单详情
    </Link>
  );

  /**
   * 构建待支付订单表列配置。
   * @returns {Array<Object>} HGTablePage 列配置数组。
   * 约束：操作列仅对 tradeStatus === 1 提供继续支付；权限与状态以服务端为准。
   */
  hgColumns = () => [
    { title: "商品", dataIndex: "title", width: 180 },
    { title: "数量", dataIndex: "quantity", width: 64 },
    {
      title: "金额（M币）",
      dataIndex: "amount",
      width: 110,
      render: (hgValue) => HGFormatCoin(hgValue),
    },
    { title: "订单号", dataIndex: "orderId", width: 220 },
    {
      title: "状态",
      dataIndex: "tradeStatus",
      width: 150,
      render: (_hgValue, hgOrder) => this.hgTradeStatusText(hgOrder),
    },
    { title: "支付截止（UTC）", dataIndex: "expiresAt", width: 180 },
    {
      title: "操作",
      dataIndex: "action",
      width: 200,
      render: (_hgValue, hgOrder) => (
        <span className={styles.orderActions}>
          {this.hgDetailLink(hgOrder)}
          {hgOrder.tradeStatus === 1 && (
            <button
              type="button"
              disabled={this.state.hgBusy}
              onClick={() => this.hgPay(hgOrder.orderId)}
            >
              继续支付 M币
            </button>
          )}
        </span>
      ),
    },
  ];

  /** 渲染待确认购买提示；核对前不隐藏真实订单状态。 */
  renderPendingBuyNotice = () => {
    if (!this.state.hgPendingBuy) return null;
    return (
      <>
        <p className={styles.notice}>
          有一笔购买结果尚未确认；请先核对订单记录。若未出现订单，可用原商品与相同收货信息重试。
        </p>
        <button type="button" onClick={this.hgClearPendingBuy}>
          我已核对订单，清除待确认请求
        </button>
      </>
    );
  };

  /** 渲染加载或写操作错误，保留当前页游标供人工重试。 */
  renderError = () => {
    if (!this.state.hgError) return null;
    return (
      <p role="alert" className={styles.error}>
        {this.state.hgError}{" "}
        <button type="button" onClick={() => this.hgLoadOrders()}>
          重试
        </button>
      </p>
    );
  };

  render() {
    return (
      <section className={styles.section} aria-label="待支付与超时取消">
        <h2>待付款</h2>
        {this.renderPendingBuyNotice()}
        {this.renderError()}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
          </p>
        )}
        <HGTablePage
          rowKey="orderId"
          columns={this.hgColumns()}
          dataSource={this.state.hgOrders}
          loading={this.state.hgLoading}
          pagination={this.hgPagination()}
          onChange={this.hgPageChange}
        />
      </section>
    );
  }
}
