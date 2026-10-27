/*
 * @Description: 个人中心 ViewModel，集中维护左侧菜单配置与默认选中项。
 */

/**
 * 个人中心左侧菜单配置。
 * 约束：当前只承载从商城迁入的「我的商品订单」；新增条目需同步补充内容区渲染分支。
 */
export const USER_CENTER_MENU_ITEMS = [
  {
    key: "orders",
    label: "我的商品订单",
  },
];

/**
 * 个人中心 ViewModel。
 * 职责：提供默认选中菜单项，避免页面组件硬编码初始 key。
 */
export default class HGUserCenterVM {
  /**
   * 获取默认选中的菜单 key。
   * @returns {string} 默认选中「我的商品订单」。
   */
  static getDefaultSelectedKey = () => {
    return USER_CENTER_MENU_ITEMS[0]?.key ?? "";
  };
}
