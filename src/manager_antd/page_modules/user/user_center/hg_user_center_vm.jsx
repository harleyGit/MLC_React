/*
 * @Description: 个人中心 ViewModel，集中维护左侧菜单配置与默认选中项。
 */

/** 个人中心菜单 key；内容区按叶子 key 渲染，新增条目需同步补充渲染分支。 */
export const USER_CENTER_MENU_KEYS = {
  UNPAID: "unpaid", // 我的订单 → 待付款（待支付与超时取消）。
  REVIEW: "review", // 我的订单 → 评价（已支付商品）。
};

/**
 * 个人中心左侧菜单配置。
 * 约束：「我的订单」是分组节点，只有叶子节点会触发内容区切换。
 */
export const USER_CENTER_MENU_ITEMS = [
  {
    key: "orders",
    label: "我的订单",
    children: [
      { key: USER_CENTER_MENU_KEYS.UNPAID, label: "待付款" },
      { key: USER_CENTER_MENU_KEYS.REVIEW, label: "评价" },
    ],
  },
];

/**
 * 个人中心 ViewModel。
 * 职责：提供默认选中菜单项，避免页面组件硬编码初始 key。
 */
export default class HGUserCenterVM {
  /**
   * 获取默认选中的菜单 key。
   * @returns {string} 默认选中「我的订单 → 待付款」。
   */
  static getDefaultSelectedKey = () => {
    return USER_CENTER_MENU_KEYS.UNPAID;
  };
}
