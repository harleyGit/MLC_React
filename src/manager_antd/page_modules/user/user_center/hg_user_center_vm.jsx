/*
 * @Description: 个人中心 ViewModel，集中维护左侧菜单配置与默认选中项。
 */

/** 个人中心菜单 key；内容区按叶子 key 渲染，新增条目需同步补充渲染分支。 */
export const USER_CENTER_MENU_KEYS = {
  UNPAID: "unpaid", // 我的订单 → 待付款（待支付与超时取消）。
  REVIEW: "review", // 我的订单 → 评价（已支付商品）。
  MERCHANT: "merchant", // 商家中心 → 商家入驻申请。
  MERCHANT_PRODUCTS: "merchant_products", // 商家中心 → 我的商品（列表、资料修改、补图与归档）。
  MERCHANT_PUBLISH: "merchant_publish", // 商家中心 → 新增商品（发布草稿与图片）。
  MERCHANT_ORDERS: "merchant_orders", // 商家中心 → 本店实物订单与发货。
  MERCHANT_COMMERCE: "merchant_commerce", // 独立生产人民币商品草稿、审核与上架；不包含交易。
  MERCHANT_COMMERCE_CATEGORY: "merchant_commerce_category", // 平台普通类目管理（列表、新建、编辑与删除）。
  CONTACTS: "im_contacts", // 即时通信 → 联系人（通讯录，好友按字母分组）。
  FRIEND_REQUESTS: "im_requests", // 即时通信 → 新的朋友（好友申请接受/拒绝）。
  IM_GROUPS: "im_groups", // 即时通信 → 群组（群聊列表与群资料）。
};

/**
 * 个人中心左侧菜单配置。
 * 约束：分组节点（含 children）只负责展开，只有叶子节点会触发内容区切换；
 *       「商家中心」与「即时通信」的 children 顺序需与页面渲染分支保持一致。
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
    children: [
      { key: USER_CENTER_MENU_KEYS.MERCHANT, label: "商家入驻申请" },
      { key: USER_CENTER_MENU_KEYS.MERCHANT_PRODUCTS, label: "我的商品" },
      { key: USER_CENTER_MENU_KEYS.MERCHANT_PUBLISH, label: "新增商品" },
      { key: USER_CENTER_MENU_KEYS.MERCHANT_ORDERS, label: "本店订单与发货" },
      { key: USER_CENTER_MENU_KEYS.MERCHANT_COMMERCE, label: "人民币商品·发布审核" },
      { key: USER_CENTER_MENU_KEYS.MERCHANT_COMMERCE_CATEGORY, label: "普通类目管理" },
    ],
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
