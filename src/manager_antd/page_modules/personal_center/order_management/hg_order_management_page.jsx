/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/order_management/hg_order_management_page.jsx
 * @Description: 订单管理页面，支持订单查询、状态变更、统计
 * 
 * 记录用户下单核心信息，管控订单全流程状态（待支付、已完成、取消、退款），统计交易数据，溯源下单渠道。
 */
import React from "react";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGOrderManagementVM, {
  ORDER_STATUS,
  ORDER_STATUS_CONFIG,
  ORDER_SOURCE_CONFIG,
} from "./hg_order_management_vm";
import styles from "./hg_order_management.module.css";

/**
 * 订单管理页面组件。
 * 职责：展示订单列表、筛选、统计，支持订单状态变更。
 * 约束：使用类组件实现。
 */
class HGOrderManagementPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      orders: [],
      users: [],
      stats: { totalOrders: 0, totalAmount: 0, pendingOrders: 0, refundAmount: 0 },
      loading: false,
      filters: {
        user_id: "",
        status: "",
        order_source: "",
        order_no: "",
        start_date: "",
        end_date: "",
      },
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0,
      },
      showModal: false,
      modalType: "", // "cancel" | "refund"
      modalOrderId: null,
      modalData: {
        reason: "",
        refund_type: "full",
      },
      showDetail: false,
      detailOrder: null,
    };
  }

  /**
   * 生命周期挂载：加载数据。
   */
  componentDidMount() {
    this.loadData();
  }

  /**
   * 加载页面数据。
   */
  loadData = async () => {
    this.setState({ loading: true });
    try {
      const [orderRes, userRes, statsRes] = await Promise.all([
        HGOrderManagementVM.fetchOrders(this.state.filters),
        HGOrderManagementVM.fetchUsers(),
        HGOrderManagementVM.fetchStats(),
      ]);
      this.setState({
        orders: orderRes.data || [],
        users: userRes.data || [],
        stats: statsRes.data || {},
        pagination: { ...this.state.pagination, total: orderRes.total || 0 },
      });
    } catch {
      message.error("加载数据失败");
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 处理筛选条件变化。
   * @param {string} field 字段名。
   * @param {*} value 字段值。
   */
  handleFilterChange = (field, value) => {
    this.setState((prevState) => ({
      filters: { ...prevState.filters, [field]: value },
    }));
  };

  /**
   * 执行筛选。
   */
  handleSearch = () => {
    this.setState({ pagination: { ...this.state.pagination, current: 1 } });
    this.loadData();
  };

  /**
   * 重置筛选。
   */
  handleReset = () => {
    this.setState(
      {
        filters: {
          user_id: "",
          status: "",
          order_source: "",
          order_no: "",
          start_date: "",
          end_date: "",
        },
        pagination: { ...this.state.pagination, current: 1 },
      },
      () => this.loadData()
    );
  };

  /**
   * 打开弹窗。
   * @param {string} type 弹窗类型。
   * @param {number} orderId 订单 ID。
   */
  openModal = (type, orderId) => {
    this.setState({
      showModal: true,
      modalType: type,
      modalOrderId: orderId,
      modalData: { reason: "", refund_type: "full" },
    });
  };

  /**
   * 关闭弹窗。
   */
  closeModal = () => {
    this.setState({ showModal: false, modalType: "", modalOrderId: null });
  };

  /**
   * 处理弹窗数据变化。
   * @param {string} field 字段名。
   * @param {*} value 字段值。
   */
  handleModalChange = (field, value) => {
    this.setState((prevState) => ({
      modalData: { ...prevState.modalData, [field]: value },
    }));
  };

  /**
   * 提交弹窗操作。
   */
  handleModalSubmit = async () => {
    const { modalType, modalOrderId, modalData } = this.state;

    if (!modalData.reason) {
      message.error("请填写原因");
      return;
    }

    try {
      let result;
      if (modalType === "cancel") {
        result = await HGOrderManagementVM.cancelOrder(modalOrderId, modalData.reason);
      } else if (modalType === "refund") {
        result = await HGOrderManagementVM.refundOrder(modalOrderId, modalData);
      }

      if (result?.success) {
        message.success(result.message);
        this.closeModal();
        this.loadData();
      }
    } catch {
      message.error("操作失败");
    }
  };

  /**
   * 处理分页变化。
   * @param {number} page 页码。
   */
  handlePageChange = (page) => {
    this.setState({ pagination: { ...this.state.pagination, current: page } });
  };

  /**
   * 打开订单详情。
   * @param {Object} order 订单数据。
   */
  openDetail = (order) => {
    this.setState({ showDetail: true, detailOrder: order });
  };

  /**
   * 关闭订单详情。
   */
  closeDetail = () => {
    this.setState({ showDetail: false, detailOrder: null });
  };

  /**
   * 渲染筛选区域。
   * @returns {React.ReactNode} 筛选区域节点。
   */
  renderFilters = () => {
    const { filters, users } = this.state;

    return (
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>订单号</span>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="请输入订单号"
              value={filters.order_no}
              onChange={(e) => this.handleFilterChange("order_no", e.target.value)}
            />
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>用户</span>
            <select
              className={styles.filterSelect}
              value={filters.user_id}
              onChange={(e) => this.handleFilterChange("user_id", e.target.value)}
            >
              <option value="">全部用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>订单状态</span>
            <select
              className={styles.filterSelect}
              value={filters.status}
              onChange={(e) => this.handleFilterChange("status", e.target.value)}
            >
              <option value="">全部状态</option>
              {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>下单来源</span>
            <select
              className={styles.filterSelect}
              value={filters.order_source}
              onChange={(e) => this.handleFilterChange("order_source", e.target.value)}
            >
              <option value="">全部来源</option>
              {Object.entries(ORDER_SOURCE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>下单时间</span>
            <div className={styles.filterDateWrapper}>
              <input
                type="date"
                className={styles.filterDateInput}
                value={filters.start_date}
                onChange={(e) => this.handleFilterChange("start_date", e.target.value)}
              />
              <span className={styles.filterDateSeparator}>至</span>
              <input
                type="date"
                className={styles.filterDateInput}
                value={filters.end_date}
                onChange={(e) => this.handleFilterChange("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.filterActions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={this.handleSearch}>
              查询
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnDefault}`} onClick={this.handleReset}>
              重置
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染统计卡片。
   * @returns {React.ReactNode} 统计卡片节点。
   */
  renderStats = () => {
    const { stats } = this.state;

    return (
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>订单总数</div>
          <div className={styles.statValue}>{stats.totalOrders}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>交易总额</div>
          <div className={`${styles.statValue} ${styles.statValueHighlight}`}>
            {HGOrderManagementVM.formatAmount(stats.totalAmount)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>待支付订单</div>
          <div className={styles.statValue}>{stats.pendingOrders}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>退款金额</div>
          <div className={`${styles.statValue} ${styles.amountHighlight}`}>
            {HGOrderManagementVM.formatAmount(stats.refundAmount)}
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染状态标签。
   * @param {string} status 状态值。
   * @returns {React.ReactNode} 状态标签节点。
   */
  renderStatusTag = (status) => {
    const config = ORDER_STATUS_CONFIG[status] || { label: status, className: "" };
    return (
      <span className={`${styles.statusTag} ${styles[config.className] || ""}`}>
        {config.label}
      </span>
    );
  };

  /**
   * 渲染来源标签。
   * @param {string} source 来源值。
   * @returns {React.ReactNode} 来源标签节点。
   */
  renderSourceTag = (source) => {
    const config = ORDER_SOURCE_CONFIG[source] || { label: source };
    return <span className={styles.sourceTag}>{config.label}</span>;
  };

  /**
   * 渲染操作按钮。
   * @param {Object} order 订单数据。
   * @returns {React.ReactNode} 操作按钮节点。
   */
  renderActions = (order) => {
    const { status } = order;
    return (
      <div>
        {status === ORDER_STATUS.PENDING && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => this.openModal("cancel", order.id)}
          >
            取消
          </button>
        )}
        {(status === ORDER_STATUS.PAID || status === ORDER_STATUS.COMPLETED) && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => this.openModal("refund", order.id)}
          >
            退款
          </button>
        )}
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnDefault}`}
          onClick={() => this.openDetail(order)}
        >
          详情
        </button>
      </div>
    );
  };

  /**
   * 渲染订单表格。
   * @returns {React.ReactNode} 表格节点。
   */
  renderTable = () => {
    const { orders, pagination } = this.state;
    const { current, pageSize, total } = pagination;
    const totalPages = Math.ceil(total / pageSize);

    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>订单列表</h3>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>订单编号</th>
                <th>用户</th>
                <th>来源</th>
                <th>金额信息</th>
                <th>状态</th>
                <th>下单时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_no}</td>
                    <td>{HGOrderManagementVM.getUserName(order.user_id)}</td>
                    <td>{this.renderSourceTag(order.order_source)}</td>
                    <td>
                      <div className={styles.amountWrapper}>
                        <div className={styles.amountItem}>
                          <span className={styles.amountLabel}>原价:</span>
                          <span className={styles.amountValue}>{HGOrderManagementVM.formatAmount(order.original_price)}</span>
                        </div>
                        <div className={styles.amountItem}>
                          <span className={styles.amountLabel}>实付:</span>
                          <span className={`${styles.amountValue} ${styles.amountHighlight}`}>
                            {HGOrderManagementVM.formatAmount(order.paid_price)}
                          </span>
                        </div>
                        {order.refund_price > 0 && (
                          <div className={styles.amountItem}>
                            <span className={styles.amountLabel}>退款:</span>
                            <span className={styles.amountValue}>{HGOrderManagementVM.formatAmount(order.refund_price)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{this.renderStatusTag(order.status)}</td>
                    <td>{HGOrderManagementVM.formatDate(order.created_at)}</td>
                    <td>{this.renderActions(order)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={current <= 1}
              onClick={() => this.handlePageChange(current - 1)}
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`${styles.paginationBtn} ${page === current ? styles.paginationBtnActive : ""}`}
                onClick={() => this.handlePageChange(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={current >= totalPages}
              onClick={() => this.handlePageChange(current + 1)}
            >
              下一页
            </button>
            <span className={styles.paginationInfo}>共 {total} 条</span>
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染弹窗。
   * @returns {React.ReactNode} 弹窗节点。
   */
  renderModal = () => {
    const { showModal, modalType, modalData } = this.state;
    if (!showModal) return null;

    const isCancel = modalType === "cancel";
    const title = isCancel ? "取消订单" : "退款";

    return (
      <HGModalPage
        visible={showModal}
        title={title}
        size="default"
        onClose={this.closeModal}
        onCancel={this.closeModal}
        onOk={this.handleModalSubmit}
        cancelText="取消"
        okText="确认"
      >
        <div className={styles.modalForm}>
          <div className={styles.modalFormItem}>
            <label className={`${styles.modalFormLabel} ${styles.modalFormLabelRequired}`}>
              {isCancel ? "取消原因" : "退款原因"}
            </label>
            <div className={styles.modalFormControl}>
              <textarea
                className={styles.modalTextarea}
                placeholder={`请输入${isCancel ? "取消" : "退款"}原因`}
                value={modalData.reason}
                onChange={(e) => this.handleModalChange("reason", e.target.value)}
              />
            </div>
          </div>
          {!isCancel && (
            <div className={styles.modalFormItem}>
              <label className={`${styles.modalFormLabel} ${styles.modalFormLabelRequired}`}>
                退款类型
              </label>
              <div className={styles.modalFormControl}>
                <select
                  className={styles.modalSelect}
                  value={modalData.refund_type}
                  onChange={(e) => this.handleModalChange("refund_type", e.target.value)}
                >
                  <option value="full">全额退款</option>
                  <option value="partial">部分退款</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </HGModalPage>
    );
  };

  /**
   * 渲染订单详情弹窗。
   * @returns {React.ReactNode} 详情弹窗节点。
   */
  renderDetailModal = () => {
    const { showDetail, detailOrder } = this.state;
    if (!showDetail || !detailOrder) return null;

    return (
      <HGModalPage
        visible={showDetail}
        title="订单详情"
        size="large"
        onClose={this.closeDetail}
        onCancel={this.closeDetail}
        cancelText="关闭"
      >
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>订单编号</span>
            <span className={styles.detailValue}>{detailOrder.order_no}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>下单用户</span>
            <span className={styles.detailValue}>{HGOrderManagementVM.getUserName(detailOrder.user_id)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>订单状态</span>
            <span className={styles.detailValue}>{this.renderStatusTag(detailOrder.status)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>下单来源</span>
            <span className={styles.detailValue}>{this.renderSourceTag(detailOrder.order_source)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>原价</span>
            <span className={styles.detailValue}>{HGOrderManagementVM.formatAmount(detailOrder.original_price)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>实付金额</span>
            <span className={`${styles.detailValue} ${styles.amountHighlight}`}>{HGOrderManagementVM.formatAmount(detailOrder.paid_price)}</span>
          </div>
          {detailOrder.refund_price > 0 && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>退款金额</span>
              <span className={styles.detailValue}>{HGOrderManagementVM.formatAmount(detailOrder.refund_price)}</span>
            </div>
          )}
          {detailOrder.trade_no && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>第三方交易号</span>
              <span className={styles.detailValue}>{detailOrder.trade_no}</span>
            </div>
          )}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>下单时间</span>
            <span className={styles.detailValue}>{HGOrderManagementVM.formatDate(detailOrder.created_at)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>更新时间</span>
            <span className={styles.detailValue}>{HGOrderManagementVM.formatDate(detailOrder.updated_at)}</span>
          </div>
          {detailOrder.user_remark && (
            <div className={styles.detailItemFull}>
              <span className={styles.detailLabel}>用户备注</span>
              <span className={styles.detailValue}>{detailOrder.user_remark}</span>
            </div>
          )}
          {detailOrder.cancel_reason && (
            <div className={styles.detailItemFull}>
              <span className={styles.detailLabel}>取消原因</span>
              <span className={styles.detailValue}>{detailOrder.cancel_reason}</span>
            </div>
          )}
          {detailOrder.refund_reason && (
            <div className={styles.detailItemFull}>
              <span className={styles.detailLabel}>退款原因</span>
              <span className={styles.detailValue}>{detailOrder.refund_reason}</span>
            </div>
          )}
        </div>
      </HGModalPage>
    );
  };

  render() {
    const { loading } = this.state;

    return (
      <div className={styles.container}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
          </div>
        )}
        {this.renderStats()}
        {this.renderFilters()}
        {this.renderTable()}
        {this.renderModal()}
        {this.renderDetailModal()}
      </div>
    );
  }
}

export default HGOrderManagementPage;
