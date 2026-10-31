/*
 * @Description: 个人中心 ViewModel，集中维护左侧菜单配置与默认选中项。
 */

/** 个人中心菜单 key；内容区按叶子 key 渲染，新增条目需同步补充渲染分支。 */
export const USER_CENTER_MENU_KEYS = {
  UNPAID: "unpaid", // 我的订单 → 待付款（待支付与超时取消）。
  REVIEW: "review", // 我的订单 → 评价（已支付商品）。
  MERCHANT: "merchant", // 商家中心 → 商家入驻申请及获批后的商品、订单管理工作台。
  CONTACTS: "im_contacts", // 即时通信 → 联系人（通讯录，好友按字母分组）。
  FRIEND_REQUESTS: "im_requests", // 即时通信 → 新的朋友（好友申请接受/拒绝）。
  IM_GROUPS: "im_groups", // 即时通信 → 群组（群聊列表与群资料）。
};

/**
 * 个人中心左侧菜单配置。
 * 约束：分组节点（含 children）只负责展开，只有叶子节点会触发内容区切换；
 *       「即时通信」的 children 顺序与联系人页面视图过滤器（hgInitialFilter）一一对应。
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
  {
    key: "merchant_center",
    label: "商家中心",
    children: [{ key: USER_CENTER_MENU_KEYS.MERCHANT, label: "商家入驻申请" }],
  },
  {
    key: "im",
    label: "即时通信",
    children: [
      { key: USER_CENTER_MENU_KEYS.CONTACTS, label: "联系人" },
      { key: USER_CENTER_MENU_KEYS.FRIEND_REQUESTS, label: "新的朋友" },
      { key: USER_CENTER_MENU_KEYS.IM_GROUPS, label: "群组" },
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
