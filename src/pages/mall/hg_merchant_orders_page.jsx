/*
 * @Description: 个人中心「商家中心 → 本店订单与发货」页面：本店已支付订单与人工运单登记。
 */
import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { HGFormatCoin } from "./hg_mall_amount.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 本店实物订单与发货页。
 * 职责：读取本店已支付订单（商家授权接口），为待发货订单登记承运商与运单号。
 * 约束：订单与收件信息只来自服务端商家授权列表；买家本人订单由用户中心的订单面板读取。
 *       组合模式（商家工作台）注入 hgMerchant 快照；独立挂载时自行读取商家状态。
 */
export default class HGMerchantOrdersPage extends React.Component {
  state = {
    hgMerchant: this.props.hgMerchant || null, // 组合模式复用父级商家快照；独立模式自行加载。
    hgStatusLoading: !this.props.hgMerchant, // 独立模式读取商家状态期间展示占位。
    hgOrders: [], // 本店最多 20 笔当前页订单，商家身份由服务端校验。
    hgCursor: "", // 当前页查询游标；空字符串为第一页。
    hgNext: "", // 下一页游标；空字符串表示结束。
    hgLoading: false, // 订单读取中；尚未获取时不显示空态。
    hgShipping: { orderId: "", carrier: "", trackingNumber: "" }, // 当前填写的待发货运单；未选择订单时 ID 为空。
    hgBusy: false, // 写操作门闩状态，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 订单请求序号；翻页后旧响应不可覆盖新结果。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    if (this.props.hgMerchant) {
      this.hgLoadOrders();
      return;
    }
    this.hgLoadMerchantStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "请求失败，请重试";

  /** 独立挂载时自读商家状态；未获批时不请求本店订单，仅展示入驻引导。 */
  hgLoadMerchantStatus = async () => {
    try {
      const hgMerchant = await HGMallVM.merchant();
      if (!this.hgMounted) return;
      this.setState({ hgMerchant });
      if (hgMerchant?.status === 1) this.hgLoadOrders();
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted) this.setState({ hgStatusLoading: false });
    }
  };

  /** 本店订单来自独立的商家授权接口；翻页时旧响应不可覆盖新结果。 */
  hgLoadOrders = async (hgCursor = "") => {
    const hgSeq = ++this.hgSeq;
    this.setState({ hgLoading: true });
    try {
      const hgPage = await HGMallVM.merchantOrders(hgCursor);
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage?.hasMore !== "boolean" ||
        typeof hgPage?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      this.setState({
        hgOrders: hgPage.list,
        hgCursor,
        hgNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgLoading: false });
    }
  };

  /** 更新当前订单的运单输入；切换订单时清空另一单的未提交内容。 */
  hgUpdateShipping = (hgOrderId, hgKey, hgValue) =>
    this.setState((hgState) => ({
      hgShipping: {
        orderId: hgOrderId,
        carrier:
          hgKey === "carrier"
            ? hgValue
            : hgState.hgShipping.orderId === hgOrderId
            ? hgState.hgShipping.carrier
            : "",
        trackingNumber:
          hgKey === "trackingNumber"
            ? hgValue
            : hgState.hgShipping.orderId === hgOrderId
            ? hgState.hgShipping.trackingNumber
            : "",
      },
    }));

  /** 登记运单由服务端校验商家身份与订单状态；成功后仅提示，运输状态以订单详情为准。 */
  hgShip = (hgOrderId) => {
    return this.hgWrite(
      async () => {
        await HGMallVM.ship(
          hgOrderId,
          this.state.hgShipping.carrier.trim(),
          this.state.hgShipping.trackingNumber.trim()
        );
        if (this.hgMounted) {
          this.setState({ hgShipping: { orderId: "", carrier: "", trackingNumber: "" } });
          await this.hgLoadOrders(this.state.hgCursor);
        }
      },
      "运单已登记，请等待买家确认收货"
    );
  };

  /** 写操作门闩：运单登记共用；同一次点击不产生并发写请求。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      if (this.hgMounted) this.setState({ hgNotice: hgSuccess });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 发货状态徽标：未发货已退款灰、已结算绿、已发货蓝、待发货琥珀。 */
  hgShippingBadge(hgOrder) {
    if (hgOrder.shippingStatus === 3)
      return { label: "未发货已退款", className: styles.badgeArchived };
    if (hgOrder.shippingStatus === 2)
      return { label: "已确认收货并结算", className: styles.badgeOn };
    if (hgOrder.shippingStatus === 1)
      return { label: "已发货", className: styles.badgeShipping };
    return { label: "已支付，待发货", className: styles.badgePending };
  }

  /** 单笔订单卡片：交易快照、收件信息与待发货时的运单登记表单。 */
  renderOrderCard(hgOrder) {
    const hgBadge = this.hgShippingBadge(hgOrder);
    return (
      <article className={styles.orderCard} key={hgOrder.orderId}>
        <div className={styles.orderTop}>
          <h3 className={styles.orderTitle}>
            {hgOrder.title} · {hgOrder.quantity} 件 ·{" "}
            {HGFormatCoin(hgOrder.amount)} M币
          </h3>
          <span className={`${styles.badge} ${hgBadge.className}`}>
            {hgBadge.label}
          </span>
        </div>
        <p className={styles.orderNo}>订单 {hgOrder.orderId}</p>
        <div className={styles.receiver}>
          <span>
            <b>收件人：</b>
            {hgOrder.receiverName} · {hgOrder.receiverPhone}
          </span>
          <span>
            <b>收货地址：</b>
            {hgOrder.receiverAddress}
          </span>
        </div>
        <div className={styles.actions}>
          <Link
            className={styles.orderLink}
            to={`${ROUTE_PATH.MALL_ORDER_DETAIL.replace(
              ":orderId",
              encodeURIComponent(hgOrder.orderId)
            )}?merchant=1`}
          >
            查看订单详情
          </Link>
        </div>
        {hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2 && (
          <p className={styles.tracking}>
            承运商：{hgOrder.carrier} · 运单号：{hgOrder.trackingNumber}
            （商家录入，非快递轨迹）
          </p>
        )}
        {hgOrder.shippingStatus === 0 && this.renderShipForm(hgOrder)}
      </article>
    );
  }

  /** 运单登记表单：录入前请与承运商核对；提交后等待买家确认收货。 */
  renderShipForm(hgOrder) {
    const hgMatch = this.state.hgShipping.orderId === hgOrder.orderId;
    return (
      <form
        className={styles.shipForm}
        onSubmit={(hgEvent) => {
          hgEvent.preventDefault();
          this.hgShip(hgOrder.orderId);
        }}
      >
        <span className={styles.formHint}>
          登记运单后请等待买家确认收货；录入前请与承运商核对运单号。
        </span>
        <div className={styles.shipGrid}>
          <label>
            承运商
            <input
              required
              maxLength={64}
              value={hgMatch ? this.state.hgShipping.carrier : ""}
              onChange={(hgEvent) =>
                this.hgUpdateShipping(
                  hgOrder.orderId,
                  "carrier",
                  hgEvent.target.value
                )
              }
            />
          </label>
          <label>
            运单号
            <input
              required
              maxLength={128}
              value={hgMatch ? this.state.hgShipping.trackingNumber : ""}
              onChange={(hgEvent) =>
                this.hgUpdateShipping(
                  hgOrder.orderId,
                  "trackingNumber",
                  hgEvent.target.value
                )
              }
            />
          </label>
        </div>
        <div>
          <button type="submit" className={styles.btn} disabled={this.state.hgBusy}>
            确认发货
          </button>
        </div>
      </form>
    );
  }

  renderPager() {
    const { hgCursor, hgNext, hgBusy } = this.state;
    return (
      <div className={styles.pager}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!hgCursor || hgBusy}
          onClick={() => this.hgLoadOrders()}
        >
          回到最新订单
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!hgNext || hgBusy}
          onClick={() => this.hgLoadOrders(hgNext)}
        >
          下一页订单
        </button>
      </div>
    );
  }

  render() {
    const {
      hgMerchant,
      hgStatusLoading,
      hgOrders,
      hgLoading,
      hgError,
      hgNotice,
    } = this.state;
    return (
      <div className={styles.page}>
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
        <section className={styles.panel} aria-label="本店实物订单与发货">
          <div className={styles.head}>
            <h2>本店实物订单与发货</h2>
            {hgMerchant?.shopName && (
              <span className={styles.headSmall}>
                店铺：{hgMerchant.shopName}
              </span>
            )}
          </div>
          <p className={styles.desc}>
            买家支付后在此登记承运商与运单号；买家确认收货后订单结算。运单由商家人工录入，非快递轨迹。
          </p>
          {hgStatusLoading ? (
            <p role="status" className={styles.loading}>
              正在读取商家状态...
            </p>
          ) : hgMerchant?.status === 1 ? (
            hgLoading ? (
              <p role="status" className={styles.loading}>
                正在加载本店订单...
              </p>
            ) : hgOrders.length ? (
              <>
                {hgOrders.map((hgOrder) => this.renderOrderCard(hgOrder))}
                {this.renderPager()}
              </>
            ) : (
              <div className={styles.empty}>
                <strong>暂无本店订单</strong>
                <span>买家支付实物商品后，订单会出现在这里等待发货。</span>
              </div>
            )
          ) : (
            <div className={styles.empty}>
              <strong>尚未开通商家权限</strong>
              <span>完成「商家入驻申请」并通过审核后，即可在这里处理本店订单。</span>
            </div>
          )}
        </section>
      </div>
    );
  }
}
