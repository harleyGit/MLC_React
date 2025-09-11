/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:24:11
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-11 20:25:19
 * @FilePath: /MLC_React/src/pages/domain_detect/domain_detect_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
export default class DomainDetectVM {
   
    static fetchDomainLatencyInfo = async ({ domain, callback }) => {
      // 模拟请求延迟信息
      const latency = Math.floor(Math.random() * 100) + "ms";
  
      // 构造 domainGroups
      const domainGroups = {
        [domain]: { latency }
      };
  
      // 调用外部传进来的 callback，把数据交给调用方处理
      if (callback) {
        callback(domainGroups);
      }
    };
  }
  