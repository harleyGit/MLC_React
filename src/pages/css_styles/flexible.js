/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-12 10:17:45
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2025-05-12 10:17:50
 * @FilePath: /app-web/imi-diagnosis/public/flexible.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
(function (d, c) {
  var e = d.documentElement,
    b = "orientationchange" in window ? "orientationchange" : "resize",
    a = function () {
      var f = e.clientWidth;
      if (!f) {
        return;
      }
      if (
        !/Android|webOS|iPhone|iPod|BlackBerry|SymbianOS|Windows Phone/i.test(
          navigator.userAgent
        )
      ) {
        // PC端不设置
        // e.style.fontSize = "100px";
        return;
      }
      // 根据屏幕宽度动态设置font-size
      e.style.fontSize = 100 * (f / 375) + "px";
    };
  if (!d.addEventListener) {
    return;
  }
  c.addEventListener(b, a, false);
  d.addEventListener("DOMContentLoaded", a, false);
})(document, window);
