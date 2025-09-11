/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:38:12
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-11 20:41:09
 * @FilePath: /MLC_React/src/api/proxy_until.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// COSR跨域问题解决： https://blog.csdn.net/lph159/article/details/141629994
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  /* 使用阿里查询域名的IP地址 */
  app.use(
    "/dns.alidns",
    createProxyMiddleware({
      target: "https://dns.alidns.com",
      changeOrigin: true,
      pathRewrite: {
        "^/dns.alidns": "", // 去掉前缀，确保拼接到 /resolve
      },
    })
  );

  /* 测试 */
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000", // 代理的目标地址
      changeOrigin: true,
      pathRewrite: {
        "^/api": "", // 将请求路径中的 "/api" 替换为空
      },
    })
  );
};
