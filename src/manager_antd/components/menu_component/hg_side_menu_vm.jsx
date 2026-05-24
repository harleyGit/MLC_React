/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/menu_component/hg_side_menu_vm.jsx
 * @Description: 侧边栏菜单 ViewModel，管理菜单数据与展开/选中状态
 */

/**
 * 侧边栏菜单 ViewModel 类
 * 职责：管理菜单展开键列表、选中键、菜单数据配置
 * 约束：菜单数据为静态配置，支持无限层级嵌套
 */
export default class HGSideMenuVM {
  /**
   * 根据菜单数据收集所有含子节点的 key，用于默认全部展开
   * @param {Array} menuItems 菜单数据数组
   * @returns {Array} 含子节点的 key 列表
   */
  static collectParentKeys = (menuItems) => {
    const keys = [];
    const walk = (items) => {
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          keys.push(item.key);
          walk(item.children);
        }
      });
    };
    walk(menuItems);
    return keys;
  };

  /**
   * 在菜单树中查找指定 key 的节点
   * @param {Array} menuItems 菜单数据数组
   * @param {string} targetKey 目标 key
   * @returns {Object|null} 匹配的菜单节点，未找到返回 null
   */
  static findMenuItem = (menuItems, targetKey) => {
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      if (item.key === targetKey) return item;
      if (item.children && item.children.length > 0) {
        const found = HGSideMenuVM.findMenuItem(item.children, targetKey);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * 判断指定 key 的菜单节点是否为叶子节点（无子节点）
   * @param {Array} menuItems 菜单数据数组
   * @param {string} targetKey 目标 key
   * @returns {boolean} 是否为叶子节点
   */
  static isLeafNode = (menuItems, targetKey) => {
    const node = HGSideMenuVM.findMenuItem(menuItems, targetKey);
    return node ? !node.children || node.children.length === 0 : true;
  };

  /**
   * 获取叶子节点 key 列表（用于 Menu selectedKeys）
   * @param {Array} menuItems 菜单数据数组
   * @returns {Array} 所有叶子节点 key
   */
  static collectLeafKeys = (menuItems) => {
    const keys = [];
    const walk = (items) => {
      items.forEach((item) => {
        if (!item.children || item.children.length === 0) {
          keys.push(item.key);
        } else {
          walk(item.children);
        }
      });
    };
    walk(menuItems);
    return keys;
  };
}
