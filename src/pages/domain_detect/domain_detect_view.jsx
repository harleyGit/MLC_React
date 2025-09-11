/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:23:52
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-11 20:26:02
 * @FilePath: /MLC_React/src/pages/domain_detect/domain_detect_view.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import DomainDetectVM from "./domain_detect_vm";

export class DomainDetectView extends React.Component {
  state = {
    domainGroups: {}
  };

  componentDidMount() {
    // 调用工具类的方法，并传递 callback
    DomainDetectVM.fetchDomainLatencyInfo({
      domain: "google.com",
      callback: (domainGroups) => {
        // 在这里 setState，而不是在工具类里
        this.setState({ domainGroups });
      }
    });
  }

  render() {
    const { domainGroups } = this.state;
    return (
      <div>
        <h2>域名延迟信息</h2>
        <pre>{JSON.stringify(domainGroups, null, 2)}</pre>
      </div>
    );
  }
}

export default View;
