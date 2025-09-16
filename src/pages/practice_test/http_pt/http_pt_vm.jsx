/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-15 16:07:12
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-15 16:35:23
 * @FilePath: /MLC_React/src/pages/practice_test/http_pt/http_pt_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import NetManager from "../../../api/HttpManagerV1";

export default class HTTPPTVM {
  static requestSimpleGet = ({} = {}) => {
    NetManager.getWithURL("https://jsonplaceholder.typicode.com/posts/1")
      .then((resp) => {
        console.log("🍎 简单get请求：", resp);
      })
      .catch((err) => console.error("GET 出错:", err));
  };

  // 2. GET + 超时（3秒）
  static requestSimpleGet = ({} = {}) => {
    // request会拿到这个timeout
    NetManager.getWithURL("https://jsonplaceholder.typicode.com/posts/1", {
      timeout: 3000,
    })
      .then((resp) => {
        console.log("🍎 GET + 超时（3秒）请求：", resp);
      })
      .catch((err) => console.error("GET 出错:", err));
  };

  // 3. GET + 自定义 headers
  // 会被合并到fetch的headers
  static requestCustomHeader = () => {
    NetManager.getWithURL("https://jsonplaceholder.typicode.com/posts/1", {
      headers: { Authorization: "Bearer xxx" },
    })
      .then((resp) => {
        console.log("🍎 GET + 自定义 headers请求：", resp);
      })
      .catch((err) => console.error("GET 出错:", err));
  };

  // 4. POST + body + 超时
  static requestPost_outTime = () => {
    NetManager.getWithURL(
      "https://jsonplaceholder.typicode.com/posts",
      { title: "foo", body: "bar", userId: 1 },
      { timeout: 4000 }
    )
      .then((resp) => {
        console.log("🍎 POST + body + 超时请求：", resp);
      })
      .catch((err) => console.error("GET 出错:", err));
  };

  // 4. POST + body + 超时
  /* 
     规则就是：
        url → 必须有，表示请求地址
        method → 在 get/post/put 方法里固定传进去
        body → POST/PUT 时才传
        headers、timeout → 可选参数，外部通过 options 传，request 解构出来
     */
  static requestPost_outTime01 = () => {
    NetManager.getWithURL(
      { username: "aaa", password: "bbb" }, // 这是 body
      { timeout: 8000, headers: { "X-Custom": "yes" } } // request 会解构出 timeout 和 headers
    )
      .then((resp) => {
        console.log("🍎 POST + body + 超时请求：", resp);
      })
      .catch((err) => console.error("GET 出错:", err));
  };
}
