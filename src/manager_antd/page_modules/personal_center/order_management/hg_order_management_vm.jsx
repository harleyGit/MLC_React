/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/order_management/hg_order_management_vm.jsx
 * @Description: 订单管理视图模型，处理订单相关的业务逻辑
 */

/**
 * 订单状态枚举。
 */
export const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

/**
 * 订单状态配置。
 */
export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUS.PENDING]: { label: "待支付", className: "statusPending" },
  [ORDER_STATUS.PAID]: { label: "已支付", className: "statusPaid" },
  [ORDER_STATUS.COMPLETED]: { label: "已完成", className: "statusCompleted" },
  [ORDER_STATUS.CANCELLED]: { label: "已取消", className: "statusCancelled" },
  [ORDER_STATUS.REFUNDED]: { label: "已退款", className: "statusRefunded" },
};

/**
 * 订单来源枚举。
 */
export const ORDER_SOURCE = {
  WEB: "web",
  APP: "app",
  MINI_PROGRAM: "mini_program",
  H5: "h5",
};

/**
 * 订单来源配置。
 */
export const ORDER_SOURCE_CONFIG = {
  [ORDER_SOURCE.WEB]: { label: "网页端" },
  [ORDER_SOURCE.APP]: { label: "APP" },
  [ORDER_SOURCE.MINI_PROGRAM]: { label: "小程序" },
  [ORDER_SOURCE.H5]: { label: "H5" },
};

/**
 * 模拟用户数据。
 */
const MOCK_USERS = [
  { id: 1, name: "张三", phone: "138****1234" },
  { id: 2, name: "李四", phone: "139****5678" },
  { id: 3, name: "王五", phone: "137****9012" },
  { id: 4, name: "赵六", phone: "136****3456" },
  { id: 5, name: "孙七", phone: "135****7890" },
];

/**
 * 模拟订单数据。
 */
const MOCK_ORDERS = [
  {
    id: 1,
    order_no: "ORD20260525001",
    user_id: 1,
    status: ORDER_STATUS.COMPLETED,
    order_source: ORDER_SOURCE.WEB,
    original_price: 299,
    paid_price: 299,
    refund_price: 0,
    trade_no: "PAY20260525001",
    user_remark: "尽快发货",
    created_at: "2026-05-20 10:30:00",
    updated_at: "2026-05-20 10:35:00",
  },
  {
    id: 2,
    order_no: "ORD20260525002",
    user_id: 2,
    status: ORDER_STATUS.PAID,
    order_source: ORDER_SOURCE.APP,
    original_price: 599,
    paid_price: 549,
    refund_price: 0,
    trade_no: "PAY20260525002",
    user_remark: "",
    created_at: "2026-05-21 14:20:00",
    updated_at: "2026-05-21 14:25:00",
  },
  {
    id: 3,
    order_no: "ORD20260525003",
    user_id: 3,
    status: ORDER_STATUS.PENDING,
    order_source: ORDER_SOURCE.MINI_PROGRAM,
    original_price: 199,
    paid_price: 0,
    refund_price: 0,
    trade_no: "",
    user_remark: "需要发票",
    created_at: "2026-05-22 09:15:00",
    updated_at: "2026-05-22 09:15:00",
  },
  {
    id: 4,
    order_no: "ORD20260525004",
    user_id: 4,
    status: ORDER_STATUS.CANCELLED,
    order_source: ORDER_SOURCE.H5,
    original_price: 399,
    paid_price: 0,
    refund_price: 0,
    trade_no: "",
    user_remark: "",
    cancel_reason: "用户主动取消",
    created_at: "2026-05-23 16:45:00",
    updated_at: "2026-05-23 17:00:00",
  },
  {
    id: 5,
    order_no: "ORD20260525005",
    user_id: 5,
    status: ORDER_STATUS.REFUNDED,
    order_source: ORDER_SOURCE.WEB,
    original_price: 899,
    paid_price: 899,
    refund_price: 899,
    trade_no: "PAY20260525005",
    user_remark: "课程不适合",
    refund_reason: "课程内容与描述不符",
    refund_type: "full",
    created_at: "2026-05-24 11:30:00",
    updated_at: "2026-05-24 15:00:00",
  },
  {
    id: 6,
    order_no: "ORD20260525006",
    user_id: 1,
    status: ORDER_STATUS.COMPLETED,
    order_source: ORDER_SOURCE.APP,
    original_price: 199,
    paid_price: 179,
    refund_price: 0,
    trade_no: "PAY20260525006",
    user_remark: "",
    created_at: "2026-05-25 08:00:00",
    updated_at: "2026-05-25 08:05:00",
  },
];

/**
 * 订单管理视图模型类。
 * 职责：处理订单的查询、状态变更、统计等业务逻辑。
 */
class HGOrderManagementVM {
  /**
   * 获取用户列表。
   * @returns {Promise<Array>} 用户列表。
   */
  static async fetchUsers() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: MOCK_USERS });
      }, 300);
    });
  }

  /**
   * 获取订单列表。
   * @param {Object} filters 筛选条件。
   * @returns {Promise<Object>} 订单列表和分页信息。
   */
  static async fetchOrders(filters = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = [...MOCK_ORDERS];

        // 按用户筛选
        if (filters.user_id) {
          filtered = filtered.filter((o) => o.user_id === parseInt(filters.user_id, 10));
        }

        // 按状态筛选
        if (filters.status) {
          filtered = filtered.filter((o) => o.status === filters.status);
        }

        // 按来源筛选
        if (filters.order_source) {
          filtered = filtered.filter((o) => o.order_source === filters.order_source);
        }

        // 按订单号搜索
        if (filters.order_no) {
          filtered = filtered.filter((o) => o.order_no.includes(filters.order_no));
        }

        // 按日期筛选
        if (filters.start_date) {
          filtered = filtered.filter((o) => o.created_at >= filters.start_date);
        }
        if (filters.end_date) {
          filtered = filtered.filter((o) => o.created_at <= filters.end_date + " 23:59:59");
        }

        resolve({
          success: true,
          data: filtered,
          total: filtered.length,
        });
      }, 500);
    });
  }

  /**
   * 获取订单统计数据。
   * @returns {Promise<Object>} 统计数据。
   */
  static async fetchStats() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const totalOrders = MOCK_ORDERS.length;
        const totalAmount = MOCK_ORDERS.reduce((sum, o) => sum + o.paid_price, 0);
        const pendingOrders = MOCK_ORDERS.filter((o) => o.status === ORDER_STATUS.PENDING).length;
        const refundAmount = MOCK_ORDERS.reduce((sum, o) => sum + o.refund_price, 0);

        resolve({
          success: true,
          data: {
            totalOrders,
            totalAmount,
            pendingOrders,
            refundAmount,
          },
        });
      }, 300);
    });
  }

  /**
   * 取消订单。
   * @param {number} orderId 订单 ID。
   * @param {string} reason 取消原因。
   * @returns {Promise<Object>} 操作结果。
   */
  static async cancelOrder(orderId, reason) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("取消订单:", orderId, "原因:", reason);
        resolve({ success: true, message: "订单已取消" });
      }, 500);
    });
  }

  /**
   * 退款。
   * @param {number} orderId 订单 ID。
   * @param {Object} params 退款参数。
   * @returns {Promise<Object>} 操作结果。
   */
  static async refundOrder(orderId, params) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("退款:", orderId, "参数:", params);
        resolve({ success: true, message: "退款申请已提交" });
      }, 500);
    });
  }

  /**
   * 获取用户名。
   * @param {number} userId 用户 ID。
   * @returns {string} 用户名。
   */
  static getUserName(userId) {
    const user = MOCK_USERS.find((u) => u.id === userId);
    return user ? user.name : `用户${userId}`;
  }

  /**
   * 格式化金额。
   * @param {number} amount 金额。
   * @returns {string} 格式化后的金额。
   */
  static formatAmount(amount) {
    return `¥${amount.toFixed(2)}`;
  }

  /**
   * 格式化日期。
   * @param {string} dateStr 日期字符串。
   * @returns {string} 格式化后的日期。
   */
  static formatDate(dateStr) {
    if (!dateStr) return "-";
    return dateStr.substring(0, 16);
  }
}

export default HGOrderManagementVM;
