import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import HGTablePage from "../../components/hg_table/hg_table_page";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 与商城下单流程共用的会话键；核对订单后才能清除。

/**
 * 本人商品订单面板：从商城目录迁入用户中心，承载待支付、已支付订单及支付、退款、确认收货。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；切出菜单即卸载，不保留后台轮询。
 */
export default class HGMallOrdersPanel extends React.Component {
  state = {
    hgOrders: [], // 本人最多 20 笔当前页已支付订单，不累计历史页。
    hgOrdersCursor: "", // 当前页查询游标；空字符串为第一页。
    hgOrdersNext: "", // 下一页游标；空字符串表示结束。
    hgPendingOrders: [], // 本人当前页待支付及已过期取消订单；不跨用户保存收件信息。
    hgPendingCursor: "", // 待支付记录当前页游标；空字符串代表第一页。
    hgPendingNext: "", // 待支付记录下一页游标；空字符串表示结束。
    hgPendingError: "", // 待支付列表独立的加载错误；不覆盖已支付订单的错误提示。
    hgPendingBuy: false, // 会话内存在结果未知的购买请求时为 true，须核对订单或重试原请求。
    hgBusy: false, // 支付/退款/收货写操作门闩，防止快速重复提交。
    hgOrdersLoading: false, // 已支付订单表读取中；表格展示加载遮罩。
    hgPendingLoading: false, // 待支付订单表读取中；表格展示加载遮罩。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgOrdersSeq = 0; // 本人订单请求序号；后发请求覆盖先发请求。
  hgPendingSeq = 0; // 待支付订单请求序号；快速翻页只接受最后一次响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgRefundRequestIds = new Map(); // 各订单退款幂等键；失败后复用，成功后移除。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({
        hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey),
      });
    } catch {
      /* 禁用存储时仍保留面板内的待确认状态。 */
    }
    this.hgLoadOrders();
    this.hgLoadPending();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgOrdersSeq += 1;
    this.hgPendingSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 只读取本人有界已支付订单页，过期响应不可覆盖新结果。 */
  hgLoadOrders = async (hgCursor = "") => {
    const hgSeq = ++this.hgOrdersSeq;
    this.setState({ hgOrdersLoading: true });
    try {
      const hgPage = await HGMallVM.orders(hgCursor);
      if (!this.hgMounted || this.hgOrdersSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage?.hasMore !== "boolean" ||
        typeof hgPage?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      this.setState({
        hgOrders: hgPage.list,
        hgOrdersCursor: hgCursor,
        hgOrdersNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgOrdersSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgOrdersSeq === hgSeq)
        this.setState({ hgOrdersLoading: false });
    }
  };

  /** 仅从服务端读取本人有界待支付页；过期状态和支付权限均由后端确定。 */
  hgLoadPending = async (hgCursor = "") => {
    const hgSeq = ++this.hgPendingSeq; // 本次待支付页查询身份，忽略卸载后的旧响应。
    this.setState({ hgPendingLoading: true });
    try {
      const hgPage = await HGMallVM.pendingOrders(hgCursor); // 本人订单的收件信息来自鉴权接口。
      if (!this.hgMounted || this.hgPendingSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage.hasMore !== "boolean" ||
        typeof hgPage.nextCursor !== "string"
      )
        throw new Error("待支付订单响应异常");
      this.setState({
        hgPendingOrders: hgPage.list,
        hgPendingCursor: hgCursor,
        hgPendingNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgPendingError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgPendingSeq === hgSeq)
        this.setState({ hgPendingError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgPendingSeq === hgSeq)
        this.setState({ hgPendingLoading: false });
    }
  };

  /**
   * 面板内写操作串行执行；成功后重读两个订单列表并通知余额订阅者刷新。
   * 约束：409 表示订单状态被其他端改变，重取当前待支付页后如实展示错误。
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
        await this.hgLoadPending();
      }
    } catch (hgError) {
      if (this.hgMounted) {
        this.setState({ hgError: this.hgMessage(hgError) });
        if (hgError?.status === 409)
          await this.hgLoadPending(this.state.hgPendingCursor);
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
      /* 会话存储不可用时仅清理面板状态。 */
    }
    this.setState({ hgPendingBuy: false });
  };

  /** 待支付/超时订单的交易状态文案；仅覆盖本期实物订单状态。 */
  hgTradeStatusText = (hgOrder) =>
    hgOrder.tradeStatus === 1 ? "待支付" : "超时取消，库存已释放";

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
   * 构建待支付订单表列配置。
   * @returns {Array<Object>} HGTablePage 列配置数组。
   * 约束：操作列仅对 tradeStatus === 1 提供继续支付；权限与状态以服务端为准。
   */
  hgPendingColumns = () => [
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
    {
      title: "支付截止（UTC）",
      dataIndex: "expiresAt",
      width: 180,
    },
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

  /**
   * 构建已支付订单表列配置。
   * @returns {Array<Object>} HGTablePage 列配置数组。
   * 约束：未发货可全额退款、已发货可确认收货；收件信息整行拼接，不做本地脱敏。
   */
  hgPaidColumns = () => [
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
              onClick={() =>
                this.hgWrite(async () => {
                  await HGMallVM.receive(hgOrder.orderId);
                }, "已确认收货，商家 M币已结算")
              }
            >
              确认收货
            </button>
          )}
        </span>
      ),
    },
  ];

  /**
   * 渲染待支付与超时取消区块（表格列表）。
   * @returns {React.ReactNode} 待支付订单表格 JSX。
   * 约束：游标分页不映射为页码，仍使用按钮式翻页，表格关闭内置分页。
   */
  renderPendingOrders = () => {
    return (
      <section aria-label="我的待支付商品">
        <h3>待支付与超时取消</h3>
        {this.state.hgPendingError && (
          <p role="alert" className={styles.error}>
            {this.state.hgPendingError}{" "}
            <button
              type="button"
              onClick={() => this.hgLoadPending(this.state.hgPendingCursor)}
            >
              重试
            </button>
          </p>
        )}
        <HGTablePage
          rowKey="orderId"
          columns={this.hgPendingColumns()}
          dataSource={this.state.hgPendingOrders}
          loading={this.state.hgPendingLoading}
          pagination={false}
        />
        <div className={styles.pager}>
          <button
            type="button"
            disabled={!this.state.hgPendingCursor || this.state.hgBusy}
            onClick={() => this.hgLoadPending()}
          >
            最新订单
          </button>
          <button
            type="button"
            disabled={!this.state.hgPendingNext || this.state.hgBusy}
            onClick={() => this.hgLoadPending(this.state.hgPendingNext)}
          >
            下一页待支付记录
          </button>
        </div>
      </section>
    );
  };

  /**
   * 渲染已支付订单区块（表格列表）。
   * @returns {React.ReactNode} 已支付订单表格 JSX。
   */
  renderPaidOrders = () => {
    return (
      <>
        <HGTablePage
          rowKey="orderId"
          columns={this.hgPaidColumns()}
          dataSource={this.state.hgOrders}
          loading={this.state.hgOrdersLoading}
          pagination={false}
        />
        <div className={styles.pager}>
          <button
            type="button"
            disabled={!this.state.hgOrdersCursor || this.state.hgBusy}
            onClick={() => this.hgLoadOrders()}
          >
            回到最新订单
          </button>
          <button
            type="button"
            disabled={!this.state.hgOrdersNext || this.state.hgBusy}
            onClick={() => this.hgLoadOrders(this.state.hgOrdersNext)}
          >
            下一页订单
          </button>
        </div>
      </>
    );
  };

  /**
   * 组件主渲染：组装待确认提示、错误与两个订单区块。
   * @returns {React.ReactNode} 面板根节点 JSX。
   */
  render() {
    return (
      <section className={styles.section} aria-label="我的商品订单">
        <h2>我的商品订单</h2>
        {this.state.hgPendingBuy && (
          <p className={styles.notice}>
            有一笔购买结果尚未确认；请先核对订单记录。若未出现订单，可用原商品与相同收货信息重试。
          </p>
        )}
        {this.state.hgPendingBuy && (
          <button type="button" onClick={this.hgClearPendingBuy}>
            我已核对订单，清除待确认请求
          </button>
        )}
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}{" "}
            <button
              type="button"
              onClick={() => {
                this.hgLoadOrders(this.state.hgOrdersCursor);
                this.hgLoadPending(this.state.hgPendingCursor);
              }}
            >
              重试
            </button>
          </p>
        )}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
          </p>
        )}
        {this.renderPendingOrders()}
        <h3>已支付商品</h3>
        {this.renderPaidOrders()}
      </section>
    );
  }
}
