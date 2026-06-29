/*
 * @Description: 测试模块 ViewModel，集中维护左侧菜单配置与默认选中项。
 */

/**
 * 测试模块左侧菜单配置。
 * 约束：叶子节点 key 必须与页面 PAGE_MAP 中的 key 保持一致。
 */
export const TEST_MODULE_MENU_ITEMS = [
  {
    key: "video",
    label: "视频",
    children: [
      { key: "guide_video_list", label: "视频列表" },
      { key: "guide_video_player", label: "视频播放" },
    ],
  },
];

/**
 * 测试模块 ViewModel。
 * 职责：提供测试模块默认菜单项，避免页面组件硬编码初始 key。
 */
export default class HGTestModuleVM {
  /**
   * 获取默认选中的菜单 key。
   * @returns {string} 默认选中第一个视频页面。
   */
  static getDefaultSelectedKey = () => {
    const firstGroup = TEST_MODULE_MENU_ITEMS[0];
    if (firstGroup?.children?.length > 0) {
      return firstGroup.children[0].key;
    }
    return firstGroup ? firstGroup.key : "";
  };
}
