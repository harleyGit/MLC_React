import React from "react";
import { handleError } from "../../../../api/HttpManagerV1";
import HGCollectionView from "../../../../components/hg_collection_view/hg_collection_view";
import { HGSkeletonList } from "../../../../components/hg_loading_animations/hg_loading_animations.jsx";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import { hgMessage } from "../../../../components/hg_message/hg_message_page";
import { PAGE } from "../../../../components/hg_navigation/hg_page_registry";
import HGAddressBookVM, { ADDRESS_MAX_COUNT } from "./hg_address_book_vm";
import HGAddressFormModal from "./hg_address_form_modal";
import styles from "./hg_address_book_page.module.css";

/**
 * 收货地址管理页：账号设置「收货地址」入口打开的独立路由页面。
 * 约束：地址读写全部走本人鉴权接口，前端不落本地缓存；列表复用 HGCollectionView 以保持滑动与刷新手势一致。
 */
class HGAddressBookPage extends React.Component {
  state = HGAddressBookVM.createInitialState();

  hgMounted = false; // 是否已挂载；卸载后丢弃异步响应。
  hgRequestSeq = 0; // 地址列表请求序号；较旧响应不能覆盖较新操作结果。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadAddresses();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequestSeq += 1;
  }

  /**
   * 读取本人地址列表。
   * 约束：成功后递增 resetKey，让 HGCollectionView 丢弃旧的测量高度；失败只落页面提示，不弹全局提示。
   */
  hgLoadAddresses = () => {
    const requestSeq = ++this.hgRequestSeq; // 本次请求版本；其他刷新启动后本次结果失效。
    this.setState({ loading: true, error: "" });
    return HGAddressBookVM.listAddresses()
      .then((addresses) => {
        if (!this.hgMounted || requestSeq !== this.hgRequestSeq) return;
        this.setState((previousState) => ({
          addresses,
          loading: false,
          resetKey: previousState.resetKey + 1,
        }));
      })
      .catch((error) => {
        if (!this.hgMounted || requestSeq !== this.hgRequestSeq) return;
        this.setState({
          loading: false,
          error: HGAddressBookVM.errorMessage(error),
        });
      });
  };

  /**
   * 返回账号设置页，保留明确的回退路径。
   */
  handleBack = () => {
    this.props.pageNavigator?.open({ page: PAGE.EDIT_USER_INFO });
  };

  /**
   * 打开新建弹窗。
   */
  handleCreateClick = () => {
    this.setState({ formVisible: true, editingAddress: null, error: "" });
  };

  /**
   * 打开编辑弹窗。
   * @param {Object} address 待编辑地址。
   */
  handleEditClick = (address) => {
    this.setState({ formVisible: true, editingAddress: address, error: "" });
  };

  /**
   * 关闭新建/编辑弹窗。
   * 约束：提交中不允许关闭，避免请求结果与界面状态不一致。
   */
  handleCloseForm = () => {
    if (this.state.formSubmitting) return;
    this.setState({ formVisible: false, editingAddress: null });
  };

  /**
   * 保存地址：新建走 POST，编辑走 PUT，随后按勾选补一次设置默认。
   * @param {Object} addressInput 后端 HGAddressInput 请求体。
   * @param {Object} options 弹窗透传的选项。
   * @param {boolean} options.setDefault 保存成功后是否设为默认地址。
   */
  handleSubmitForm = async (addressInput, options = {}) => {
    const { editingAddress } = this.state;
    const isEditing = Boolean(editingAddress);
    let addressSaved = false; // 地址主写是否已成功；默认地址二次请求失败时不允许误导用户重提新建。
    this.setState({ formSubmitting: true, error: "" });
    try {
      const savedAddress = isEditing
        ? await HGAddressBookVM.updateAddress(editingAddress.id, addressInput)
        : await HGAddressBookVM.createAddress(addressInput);
      addressSaved = true;
      const savedAddressId = isEditing ? editingAddress.id : savedAddress?.id;

      // 默认地址由独立接口维护；已有默认地址时不重复提交，避免多一次写请求。
      if (options.setDefault && savedAddressId && !editingAddress?.isDefault) {
        await HGAddressBookVM.setDefaultAddress(savedAddressId);
      }

      if (!this.hgMounted) return;
      this.setState({ formVisible: false, editingAddress: null });
      hgMessage.success(isEditing ? "收货地址已更新" : "收货地址已保存");
      await this.hgLoadAddresses();
    } catch (error) {
      handleError(error);
      if (this.hgMounted) {
        if (addressSaved) {
          this.setState({ formVisible: false, editingAddress: null, error: "地址已保存，但设置默认地址失败，请在列表中重试" });
          await this.hgLoadAddresses();
          if (this.hgMounted) this.setState({ error: "地址已保存，但设置默认地址失败，请在列表中重试" });
        } else {
          this.setState({ error: HGAddressBookVM.errorMessage(error) });
        }
      }
    } finally {
      if (this.hgMounted) this.setState({ formSubmitting: false });
    }
  };

  /**
   * 打开删除确认框。
   * @param {Object} address 待删除地址。
   */
  handleAskDelete = (address) => {
    this.setState({ deletingAddress: address });
  };

  /**
   * 关闭删除确认框。
   */
  handleCancelDelete = () => {
    if (this.state.deleting) return;
    this.setState({ deletingAddress: null });
  };

  /**
   * 确认删除地址；删除默认地址后新的默认地址由服务端在同一事务内补位。
   */
  handleConfirmDelete = async () => {
    const { deletingAddress, deleting } = this.state;
    if (!deletingAddress || deleting) return;
    this.setState({ deleting: true, error: "" });
    try {
      await HGAddressBookVM.deleteAddress(deletingAddress.id);
      if (!this.hgMounted) return;
      this.setState({ deletingAddress: null });
      hgMessage.success("收货地址已删除");
      await this.hgLoadAddresses();
    } catch (error) {
      handleError(error);
      if (this.hgMounted) this.setState({ error: HGAddressBookVM.errorMessage(error) });
    } finally {
      if (this.hgMounted) this.setState({ deleting: false });
    }
  };

  /**
   * 设置默认地址。
   * @param {Object} address 目标地址。
   */
  handleSetDefault = async (address) => {
    if (address.isDefault || this.state.defaultingId) return;
    this.setState({ defaultingId: address.id, error: "" });
    try {
      await HGAddressBookVM.setDefaultAddress(address.id);
      if (!this.hgMounted) return;
      hgMessage.success("已设为默认地址");
      await this.hgLoadAddresses();
    } catch (error) {
      handleError(error);
      if (this.hgMounted) this.setState({ error: HGAddressBookVM.errorMessage(error) });
    } finally {
      if (this.hgMounted) this.setState({ defaultingId: null });
    }
  };

  /**
   * 取默认地址，用于概要区展示。
   * @returns {Object|null} 默认地址对象；没有默认地址时返回 null。
   */
  getDefaultAddress = () => {
    return this.state.addresses.find((address) => address.isDefault) || null;
  };

  /**
   * 渲染返回入口与页头。
   * @returns {React.ReactNode} 页头 JSX。
   */
  renderHeader = () => {
    return (
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={this.handleBack}>
          <span aria-hidden="true">‹</span>
          账号设置
        </button>
        <div className={styles.headerInner}>
          <div className={styles.brandMark} aria-hidden="true">
            M
          </div>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>MLC SHIPPING ADDRESS</p>
            <h1>收货地址</h1>
          </div>
          <button type="button" className={styles.createButton} disabled={this.state.addresses.length >= ADDRESS_MAX_COUNT} onClick={this.handleCreateClick}>
            <span aria-hidden="true">＋</span>
            新建地址
          </button>
        </div>
      </header>
    );
  };

  /**
   * 渲染地址概览：已保存数量、默认收件人与刷新入口。
   * @returns {React.ReactNode} 概览区 JSX。
   */
  renderSummary = () => {
    const { addresses, loading } = this.state;
    const defaultAddress = this.getDefaultAddress();
    return (
      <section className={styles.summary} aria-label="收货地址概览">
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>已保存地址</span>
          <strong className={styles.summaryValue}>
            {addresses.length}
            <small>/{ADDRESS_MAX_COUNT}</small>
          </strong>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>默认收货人</span>
          <strong className={styles.summaryValue}>{defaultAddress ? defaultAddress.receiverName : "未设置"}</strong>
          <span className={styles.summarySub}>
            {defaultAddress ? HGAddressBookVM.maskPhone(defaultAddress.receiverPhone) : "可在下方列表设置"}
          </span>
        </div>
        <p className={styles.summaryTip}>下单时可直接选用默认地址，省去重复填写收件信息。</p>
        <button type="button" className={styles.refreshButton} disabled={loading} onClick={this.hgLoadAddresses}>
          刷新
        </button>
      </section>
    );
  };

  /**
   * 渲染列表错误提示与重试入口。
   * @returns {React.ReactNode} 错误提示 JSX。
   */
  renderError = () => {
    if (!this.state.error) return null;
    return (
      <p role="alert" className={styles.errorBanner}>
        {this.state.error}
        <button type="button" className={styles.errorRetry} disabled={this.state.loading} onClick={this.hgLoadAddresses}>
          重试
        </button>
      </p>
    );
  };

  /**
   * 渲染单张地址卡片。
   * @param {Object} address 地址对象。
   * @returns {React.ReactNode} 地址卡片 JSX。
   */
  renderAddressCard = (address) => {
    const { defaultingId, deleting } = this.state;
    return (
      <article className={`${styles.card} ${address.isDefault ? styles.cardDefault : ""}`}>
        <div className={styles.cardHead}>
          <div className={styles.receiverBlock}>
            <span className={styles.receiverName}>{address.receiverName}</span>
            <span className={styles.receiverPhone}>{HGAddressBookVM.maskPhone(address.receiverPhone)}</span>
            {address.isDefault ? <span className={styles.defaultTag}>默认</span> : null}
          </div>
          <span className={styles.regionTag}>{address.region}</span>
        </div>
        <p className={styles.detailLine}>{address.detailAddress}</p>
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.ghostButton}
            disabled={address.isDefault || defaultingId !== null}
            onClick={() => this.handleSetDefault(address)}
          >
            {address.isDefault ? "当前默认" : defaultingId === address.id ? "设置中…" : "设为默认"}
          </button>
          <button type="button" className={styles.ghostButton} onClick={() => this.handleEditClick(address)}>
            编辑
          </button>
          <button
            type="button"
            className={`${styles.ghostButton} ${styles.dangerButton}`}
            disabled={deleting}
            onClick={() => this.handleAskDelete(address)}
          >
            删除
          </button>
        </div>
      </article>
    );
  };

  /**
   * 渲染地址列表。
   * 约束：首屏加载（尚无数据）时渲染骨架屏占位；已有数据后的刷新仍走 HGCollectionView 内建状态。
   * @returns {React.ReactNode} 骨架屏或 HGCollectionView 实例 JSX。
   */
  renderAddressList = () => {
    const { addresses, loading, resetKey } = this.state;
    if (loading && addresses.length === 0) {
      return <HGSkeletonList rows={3} className={styles.skeletonList} />;
    }
    return (
      <HGCollectionView
        items={addresses}
        getKey={(address) => address.addressId || address.id}
        renderCell={this.renderAddressCard}
        loading={loading}
        hasMore={false}
        resetKey={resetKey}
        height={460}
        ariaLabel="收货地址列表"
        onRefresh={this.hgLoadAddresses}
        emptyText="还没有保存收货地址，点击右上角「新建地址」添加"
        loadedText={`共 ${addresses.length} 条地址，默认地址会排在最前`}
      />
    );
  };

  /**
   * 渲染新建/编辑弹窗。
   * @returns {React.ReactNode} 弹窗 JSX；未打开时返回 null。
   */
  renderFormModal = () => {
    const { formVisible, editingAddress, formSubmitting } = this.state;
    if (!formVisible) return null;
    return (
      <HGAddressFormModal
        address={editingAddress}
        submitting={formSubmitting}
        onCancel={this.handleCloseForm}
        onSubmit={this.handleSubmitForm}
      />
    );
  };

  /**
   * 渲染删除确认框。
   * @returns {React.ReactNode} 确认框 JSX；没有待删除地址时返回 null。
   */
  renderDeleteModal = () => {
    const { deletingAddress, deleting } = this.state;
    if (!deletingAddress) return null;
    return (
      <HGModalPage
        visible
        size="small"
        title="删除收货地址"
        closable={!deleting}
        onClose={this.handleCancelDelete}
        okText={deleting ? "删除中…" : "确认删除"}
        cancelText="取消"
        okType="danger"
        onOk={this.handleConfirmDelete}
        onCancel={this.handleCancelDelete}
      >
        <p className={styles.confirmText}>
          确认删除 {deletingAddress.receiverName} 的收货地址？删除后不可恢复；
          若删除的是默认地址，系统会自动选择另一条地址作为默认地址。
        </p>
      </HGModalPage>
    );
  };

  render() {
    const { error } = this.state;
    return (
      <div className={styles.page}>
        {this.renderHeader()}
        <main className={styles.main}>
          {this.renderSummary()}
          {error ? this.renderError() : null}
          <section className={styles.listPanel} aria-label="收货地址">
            {this.renderAddressList()}
          </section>
        </main>
        {this.renderFormModal()}
        {this.renderDeleteModal()}
      </div>
    );
  }
}

export default HGAddressBookPage;
