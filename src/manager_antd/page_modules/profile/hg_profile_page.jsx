import React, { Component } from "react";
import styles from "./hg_profile.module.css";

class Profile extends Component {
  render() {
    return (
      <div className={styles.container}>
        <h1>我的信息</h1>
        <div className={styles.infoItem}>
          <strong>用户名：</strong> user@example.com
        </div>
        <div className={styles.infoItem}>
          <strong>会员等级：</strong> 黄金会员
        </div>
        <div className={styles.infoItem}>
          <strong>注册时间：</strong> 2024-01-15
        </div>
      </div>
    );
  }
}

export default Profile;
