/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/menu_component/hg_side_menu_page.jsx
 * @Description: 侧边栏多级菜单组件，支持无限层级展开/折叠（antd v6 items 模式）
 */
import { Menu } from "antd";
import React, { Component } from "react";
import HGSideMenuVM from "./hg_side_menu_vm";
import styles from "./hg_side_menu.module.css";

/**
 * 侧边栏多级菜单组件
 * 职责：渲染可展开/折叠的多级菜单，点击叶子节点触发 onSelect 回调
 * 输入：menuItems（菜单数据）、selectedKey（当前选中叶子节点 key）、onSelect（选中回调）
 * 约束：菜单数据格式为 [{key, label, children?}]，支持无限层级嵌套
 * 实现：使用 antd v6 items 属性传递菜单数据，无需手动递归渲染
 */
class HGSideMenuPage extends Component {
  constructor(props) {
    super(props);
    const { menuItems = [] } = props;
    this.state = {
      openKeys: HGSideMenuVM.collectParentKeys(menuItems),
    };
  }

  /**
   * 菜单项点击处理：仅叶子节点触发 onSelect 回调
   * @param {{key: string}} info antd Menu 点击事件信息
   */
  handleMenuClick = (info) => {
    const { menuItems = [], onSelect } = this.props;
    if (HGSideMenuVM.isLeafNode(menuItems, info.key) && onSelect) {
      onSelect(info.key);
    }
  };

  /**
   * 子菜单展开/关闭处理：更新 openKeys 状态
   * @param {Array} openKeys 当前展开的子菜单 key 列表
   */
  handleOpenChange = (openKeys) => {
    this.setState({ openKeys });
  };

  /**
   * 将菜单数据转换为 antd Menu items 格式
   * 职责：递归转换 [{key, label, children}] 为 antd items 结构
   * @param {Array} menuItems 菜单数据数组
   * @returns {Array} antd Menu items 数组
   */
  convertToAntdItems = (menuItems) => {
    return menuItems.map((item) => {
      if (item.children && item.children.length > 0) {
        return {
          key: item.key,
          label: item.label,
          children: this.convertToAntdItems(item.children),
        };
      }
      return {
        key: item.key,
        label: item.label,
      };
    });
  };

  render() {
    const { menuItems = [], selectedKey } = this.props;
    const { openKeys } = this.state;
    const antdItems = this.convertToAntdItems(menuItems);

    return (
      <div className={styles.sideMenuWrap}>
        <Menu
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          openKeys={openKeys}
          onClick={this.handleMenuClick}
          onOpenChange={this.handleOpenChange}
          className={styles.sideMenu}
          items={antdItems}
        />
      </div>
    );
  }
}

export default HGSideMenuPage;
