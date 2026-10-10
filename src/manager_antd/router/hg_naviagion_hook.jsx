/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 10:12:51
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-04-23 00:10:06
 * @FilePath: /MLC_React/src/manager_antd/router/hg_naviagion_hook.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { hgPageNavigator } from "../../components/hg_navigation/hg_page_navigator";

/** 注入页面导航协议；保留旧路由 props 供尚未迁移的消费者使用。 */
export function WithNavigation(Component) {
  return function HGWithNavigation(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    return React.createElement(Component, {
      ...props,
      navigate,
      pageNavigator: hgPageNavigator,
      pageNavigation: hgPageNavigator.getPageNavigation(location),
      location,
      params,
    });
  };
}
