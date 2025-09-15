/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-09-05 09:35:07
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2025-09-05 10:13:57
 * @FilePath: /app-web/imi-diagnosis/src/home_module/with_router.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useNavigate, useLocation } from "react-router-dom";

function withRouter(Component) {
  return function WrappedComponent(props) {
    const navigate = useNavigate();
    const location = useLocation();
    return <Component {...props} navigate={navigate} location={location} />;
  };
}

export default withRouter;
