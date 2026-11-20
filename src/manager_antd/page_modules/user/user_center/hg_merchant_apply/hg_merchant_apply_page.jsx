import React from "react";
import HGMallVM from "../../../../../pages/mall/hg_mall_vm.js";
import HGMerchantProductsPage from "../../../../../pages/mall/hg_merchant_products_page";
import HGMerchantPublishPage from "../../../../../pages/mall/hg_merchant_publish_page";
import HGMerchantOrdersPage from "../../../../../pages/mall/hg_merchant_orders_page";
import styles from "./hg_merchant_apply_page.module.css";

/**
 * 商家入驻申请页：原 hg_mall_catalog.renderMerchant 的渲染与业务逻辑独立组件。
 * 同一实现服务商城「商家工作台」与个人中心「商家入驻申请」菜单：
 * 入驻申请卡片由本组件维护；商品管理、发布与订单子页面在审核通过后组合展示。
 * 约束：商家申请与店铺信息只来自服务端授权接口；卸载后丢弃异步响应。
 */
export default class HGMerchantApplyPage extends React.Component {
  /** 可选属性默认值；仅省略或传 undefined 时采用。 */
  static defaultProps = {
    /** true 时仅展示入驻申请卡片（个人中心菜单入口），不组合商品/发布/订单子页面。 */
    hgApplyOnly: false,
  };

  state = {
    hgMerchant: null, // 本人商家申请；null 代表尚未申请或尚未加载。
    hgMerchantLoading: false, // 商家申请读取中；尚未获取时不显示空态。
    hgShopName: "", // 用户输入的店铺名；提交前无默认值。
    hgBusy: false, // 入驻申请写操作门闩，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 商家申请读取序号；过期响应不覆盖新结果。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadMerchant();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 仅加载本人商家申请；过期响应不得覆盖新结果。 */
  hgLoadMerchant = async () => {
    const hgSeq = ++this.hgSeq;
    this.setState({ hgMerchantLoading: true });
    try {
      const hgMerchant = await HGMallVM.merchant();
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgMerchant, hgError: "" });
    } catch (hgError) {
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgMerchantLoading: false });
    }
  };

  /** 入驻申请写操作：成功后重读申请状态；网络失败保留表单以便人工重试。 */
  hgApply = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await HGMallVM.apply(this.state.hgShopName.trim());
      if (this.hgMounted) {
        this.setState({ hgNotice: "申请已提交，请等待审核" });
        await this.hgLoadMerchant();
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  render() {
    const { hgMerchant, hgShopName, hgBusy } = this.state;
    return (
      <div className={styles.workspace}>
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}
          </p>
        )}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
          </p>
        )}
        <section>
          <h2>商家入驻</h2>
          <p>
            申请由管理员审核，通过后可发布单规格商品；商品再次审核通过才公开。
          </p>
          {this.state.hgMerchantLoading ? (
            <p role="status">正在读取店铺与商品...</p>
          ) : hgMerchant ? (
            <p>
              店铺：<strong>{hgMerchant.shopName}</strong> ·{" "}
              {hgMerchant.status === 1
                ? "审核通过"
                : hgMerchant.status === 2
                ? "审核未通过，可重新提交"
                : "等待审核"}
            </p>
          ) : (
            <p>尚未提交申请。</p>
          )}
          {!this.state.hgMerchantLoading &&
            (!hgMerchant || hgMerchant.status === 2) && (
              <form onSubmit={this.hgApply}>
                <label>
                  店铺名称{" "}
                  <input
                    required
                    maxLength={128}
                    value={hgShopName}
                    onChange={(hgEvent) =>
                      this.setState({ hgShopName: hgEvent.target.value })
                    }
                  />
                </label>
                <button type="submit" disabled={hgBusy}>
                  提交入驻申请
                </button>
              </form>
            )}
          {this.props.hgApplyOnly && hgMerchant?.status === 1 && (
            <p>商品发布、管理与发货请使用左侧「商家中心」子菜单。</p>
          )}
        </section>
        {!this.props.hgApplyOnly && hgMerchant?.status === 1 && (
          <>
            <HGMerchantProductsPage hgMerchant={hgMerchant} />
            <HGMerchantPublishPage hgMerchant={hgMerchant} />
            <HGMerchantOrdersPage hgMerchant={hgMerchant} />
          </>
        )}
      </div>
    );
  }
}
