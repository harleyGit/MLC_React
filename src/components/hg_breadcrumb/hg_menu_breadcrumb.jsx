import React from "react";
import HGBreadcrumbPage from "./hg_breadcrumb_page";
import HGSideMenuVM from "../menu_component/hg_side_menu_vm";
import { hgBuildSubMenuUrl } from "../hg_navigation/hg_sub_nav";

/** 菜单面包屑：分组没有独立页面时进入其首个可用叶子；隐藏编辑页显式提供完整路径。 */
export default function HGMenuBreadcrumb({
  menuItems, // 页面已有菜单树，无默认值。
  selectedKey, // URL 中的当前子页 key，无默认值。
  basePath, // 已注册的栏目路径，无默认值。
  rootLabel, // 栏目名称，无默认值。
  hiddenPath = [], // 隐藏页的完整路径；默认使用菜单树。
  onNavigate, // 普通点击交给 React Router；保留修饰键打开新标签页。
  className = "", // 默认不附加外层样式。
}) {
  // 真实菜单路径优先；隐藏页由父容器提供，不推测编辑对象。
  const menuPath = HGSideMenuVM.findPathToKey(menuItems, selectedKey);
  const path = menuPath.length ? menuPath : hiddenPath;
  // 分组本身没有路由时，按菜单顺序寻找第一个未禁用的真实页面。
  const firstLeaf = (nodes) => {
    for (const node of nodes) {
      if (node.disabled) continue;
      const key = node.children?.length ? firstLeaf(node.children) : node.key;
      if (key) return key;
    }
    return null;
  };
  const items = [
    { label: rootLabel, href: basePath },
    ...path.map((node) => {
      // 隐藏页 key 同样由父容器注册；最终当前项只显示名称。
      const menuNode = HGSideMenuVM.findMenuItem(menuItems, node.key);
      const key = menuNode ? firstLeaf([menuNode]) : node.key;
      return { label: node.label, href: key ? hgBuildSubMenuUrl(basePath, key) : undefined };
    }),
  ];
  return <HGBreadcrumbPage items={items} className={className} onNavigate={onNavigate} />;
}
