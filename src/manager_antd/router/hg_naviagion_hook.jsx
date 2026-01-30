/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 10:12:51
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-30 10:29:07
 * @FilePath: /MLC_React/src/manager_antd/router/hg_naviagion_hook.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useLocation, useNavigate, useParams } from "react-router-dom";

/* 给class 注入navigate ,该方法只能跳转
 * @deprecated Use `WithRouter` instead.,k😀 开玩笑的，试试替代语法
 */
Depre;
export function WithNavigation(Component) {
  return function (props) {
    const navigate = useNavigate();
    return (
      <Component
        {...props}
        navigate={navigate}
        location={useLocation()}
        params={useParams()}
      />
    );
  };
}
