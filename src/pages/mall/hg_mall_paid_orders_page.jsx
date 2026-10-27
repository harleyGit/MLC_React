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
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

/**
 * 本人已支付商品订单页，对应个人中心「我的订单 → 评价」。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；离开菜单即卸载，不保留后台轮询。
 */
export default class HGMallPaidOrdersPage extends React.Component {
  state = {
    hgOrders: [], // 本人最多 20 笔当前页已支付订单，不累计历史页。
    hgCursors: [""], // 已探索页的服务端游标；索引 i 对应第 i+1 页，首项空字符串为第一页。
    hgPage: 1, // 当前页码，从 1 起。
    hgHasMore: false, // 当前页之后是否还有下一页；由服务端 hasMore 决定。
    hgLoading: false, // 列表读取中；表格展示加载遮罩。
    hgError: "", // 加载或写操作错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgBusy: false, // 退款/收货写操作门闩，防止快速重复提交。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 列表请求序号；快速翻页只接受最后一次响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgRefundRequestIds = new Map(); // 各订单退款幂等键；失败后复用，成功后移除。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadOrders();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 只读取本人有界已支付订单页；页码经本地游标历史换算，过期响应不可覆盖新结果。 */
  hgLoadOrders = async (hgPage = this.state.hgPage) => {
    const hgSeq = ++this.hgSeq; // 本次查询身份，忽略卸载或翻页后的旧响应。
    this.setState({ hgLoading: true });
    try {
      const hgPageData = await HGMallVM.orders(hgOrderCursorAt(this.state.hgCursors, hgPage));
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPageData?.list) ||
        typeof hgPageData?.hasMore !== "boolean" ||
        typeof hgPageData?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      if (hgPage > 1 && !hgPageData.list.length) {
        this.hgLoadOrders(1); // 当前页被清空后退回第一页，不停留在空页。
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

  /** 未发货订单退款使用稳定的幂等键；失败后复用，成功后移除。 */
  hgRefund = (hgOrderId) => {
    if (!this.hgRefundRequestIds.has(hgOrderId)) {
      try {
        this.hgRefundRequestIds.set(hgOrderId, hgSecureRequestId());
      } catch (hgError) {
        this.setState({ hgError: this.hgMessage(hgError) });
        return;
      }
    }
    const hgRequestId = this.hgRefundRequestIds.get(hgOrderId);
    this.hgWrite(async () => {
      await HGMallVM.refund(hgOrderId, hgRequestId);
      this.hgRefundRequestIds.delete(hgOrderId);
    }, "未发货订单已全额退还 M币并释放库存");
  };

  /** 确认收货只提交订单 ID；结算金额与状态以服务端为准。 */
  hgReceive = (hgOrderId) =>
    this.hgWrite(async () => {
      await HGMallVM.receive(hgOrderId);
    }, "已确认收货，商家 M币已结算");

  /** 已支付订单的履约状态文案；退款优先于发货状态展示。 */
  hgShippingStatusText = (hgOrder) =>
    hgOrder.shippingStatus === 3
      ? "未发货已退款"
      : hgOrder.shippingStatus === 2
      ? "已确认收货并结算"
      : hgOrder.shippingStatus === 1
      ? "已发货"
      : "已支付，待发货";

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
   * 构建已支付订单表列配置。
   * @returns {Array<Object>} HGTablePage 列配置数组。
   * 约束：未发货可全额退款、已发货可确认收货；收件信息整行拼接，不做本地脱敏。
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
      dataIndex: "shippingStatus",
      width: 150,
      render: (_hgValue, hgOrder) => this.hgShippingStatusText(hgOrder),
    },
    {
      title: "运单",
      dataIndex: "carrier",
      width: 200,
      render: (_hgValue, hgOrder) =>
        hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2
          ? `${hgOrder.carrier} · ${hgOrder.trackingNumber}（商家录入，非快递轨迹）`
          : "—",
    },
    {
      title: "收件信息",
      dataIndex: "receiverName",
      render: (_hgValue, hgOrder) =>
        `${hgOrder.receiverName} · ${hgOrder.receiverPhone} · ${hgOrder.receiverAddress}`,
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 220,
      render: (_hgValue, hgOrder) => (
        <span className={styles.orderActions}>
          {this.hgDetailLink(hgOrder)}
          {hgOrder.shippingStatus === 0 && (
            <button
              type="button"
              disabled={this.state.hgBusy}
              onClick={() => this.hgRefund(hgOrder.orderId)}
            >
              未发货全额退款
            </button>
          )}
          {hgOrder.shippingStatus === 1 && (
            <button
              type="button"
              disabled={this.state.hgBusy}
              onClick={() => this.hgReceive(hgOrder.orderId)}
            >
              确认收货
            </button>
          )}
        </span>
      ),
    },
  ];

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
      <section className={styles.section} aria-label="已支付商品">
        <h2>已支付商品</h2>
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
