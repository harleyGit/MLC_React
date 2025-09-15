/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-12 09:35:18
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-12 09:36:55
 * @FilePath: /MLC_React/src/optimize/reportWebVitals.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/* 性能指标优化用的  */
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import("web-vitals").then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
