/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 09:50:10
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-11 21:21:58
 * @FilePath: /app-web/imi-diagnosis/src/HomePage.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import withRouter from "../../utils/WithRouter";

class HomePage extends Component {
  constructor(props) {
    super(props);
  }
  domainDetectClick = () => {
    this.props.navigate("/domain-detection");
  };

  freshManGuideClick = () => {
    this.props.navigate("/app/guide_video", {
      state: { videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
    });
  };

  render() {
    return (
      <div style={{ padding: 20 }}>
        <h1>首页</h1>
        <button onClick={this.domainDetectClick}>跳转到域名检测页面</button>
        <button onClick={this.freshManGuideClick}>新手引导视频</button>
      </div>
    );
  }
}

export default withRouter(HomePage);
