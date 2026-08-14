/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-08-14 20:43:27
 * @FilePath: /MLC_React/src/manager_antd/page_modules/user_space/hg_user_space_page.jsx
 * @Description: 用户空间页面，模拟B站个人空间，包含封面、用户信息、标签导航、视频列表
 */
import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import { hgMessage } from "../../../components/hg_message/hg_message_page";
import HGTabNavPage from "../../../components/hg_tab_nav/hg_tab_nav_page";
import HGUserCardPage from "../../../components/hg_user_card/hg_user_card_page";
import HGVideoCardPage from "../../../components/hg_video_card/hg_video_card_page";
import HGEnvLogger from "../../../utils/HGEnvLogger";
import styles from "./hg_user_space.module.css";
import HGUserSpaceVM, { followUser, SPACE_TABS } from "./hg_user_space_vm";

/**
 * 用户空间页面
 * 职责：展示用户封面、信息卡片、标签导航、视频投稿列表
 * 约束：类组件，使用 HGUserSpaceVM 获取数据
 */
class HGUserSpacePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      videos: [],
      activeTab: "video",
      loading: true,
      isFollowed: false,
      followSubmitting: false,
    };
    this.hgFollowPending = false;
  }

  /**
   * 挂载后加载用户信息和视频列表
   */
  componentDidMount() {
    this.loadData();
  }

  /**
   * 加载用户信息和视频列表
   */
  loadData = () => {
    this.setState({ loading: true });
    Promise.all([HGUserSpaceVM.getUserInfo(), HGUserSpaceVM.getVideoList()])
      .then(([userRes, videoRes]) => {
        if (userRes.code === 0) {
          this.setState({
            user: userRes.data,
            isFollowed: Boolean(userRes.data?.followed),
          });
        }
        if (videoRes.code === 0) {
          this.setState({ videos: videoRes.data });
        }
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 标签切换回调
   * @param {string} key 标签 key
   */
  handleTabChange = (key) => {
    this.setState({ activeTab: key });
  };

  /**
   * 关注按钮点击
   * @param {React.MouseEvent<HTMLButtonElement>} event 点击事件
   */
  handleFollow = async (event) => {
    HGEnvLogger.info("关注up㊗️====");
    event?.preventDefault();
    event?.stopPropagation();
    HGEnvLogger.info("关注up㊗️《〈《〈《〈");
    if (this.hgFollowPending) {
      return;
    }

    this.hgFollowPending = true;
    this.setState({ followSubmitting: true });
    try {
      const followeeId = String(
        this.props.params?.uid || this.state.user?.uid || ""
      ).trim();
      if (!followeeId) {
        throw new Error("无法确定要关注的用户");
      }

      const active = !this.state.isFollowed;
      await followUser(followeeId, active);
      this.setState((prevState) => ({
        isFollowed: active,
        user: prevState.user
          ? {
              ...prevState.user,
              followers: Math.max(
                0,
                Number(prevState.user.followers || 0) + (active ? 1 : -1)
              ),
            }
          : prevState.user,
      }));
      hgMessage.success(active ? "关注成功" : "已取消关注");
    } catch (error) {
      hgMessage.error(
        getRequestErrorMessage(
          error,
          this.state.isFollowed
            ? "取消关注失败，请稍后重试"
            : "关注失败，请稍后重试"
        )
      );
    } finally {
      this.hgFollowPending = false;
      this.setState({ followSubmitting: false });
    }
  };

  /**
   * 发消息按钮点击
   */
  handleMessage = () => {
    alert("发消息功能待实现");
  };

  /**
   * 渲染封面区域
   * @returns {React.ReactNode} 封面节点
   */
  renderCover = () => {
    const { user } = this.state;
    if (!user) return null;
    return (
      <div className={styles.coverSection}>
        <img
          src={user.cover || "https://picsum.photos/1200/200"}
          alt="cover"
          className={styles.coverImage}
        />
      </div>
    );
  };

  /**
   * 渲染用户信息卡片
   * @returns {React.ReactNode} 用户卡片节点
   */
  renderUserCard = () => {
    const { user } = this.state;
    if (!user) return null;
    return (
      <div className={styles.userCardWrapper}>
        <HGUserCardPage
          avatar={user.avatar}
          name={user.name}
          bio={user.bio}
          level={user.level}
          uid={user.uid}
          following={user.following}
          followers={user.followers}
          plays={user.plays}
          isFollowed={this.state.isFollowed}
          followLoading={this.state.followSubmitting}
          onFollow={this.handleFollow}
          onMessage={this.handleMessage}
        />
      </div>
    );
  };

  /**
   * 渲染标签导航
   * @returns {React.ReactNode} 标签导航节点
   */
  renderTabNav = () => {
    const { activeTab, user } = this.state;
    const tabsWithCount = SPACE_TABS.map((tab) => {
      if (tab.key === "video")
        return { ...tab, count: this.state.videos.length };
      if (tab.key === "fans") return { ...tab, count: user?.followers || 0 };
      if (tab.key === "following")
        return { ...tab, count: user?.following || 0 };
      return tab;
    });
    return (
      <HGTabNavPage
        tabs={tabsWithCount}
        activeKey={activeTab}
        onChange={this.handleTabChange}
      />
    );
  };

  /**
   * 渲染视频投稿列表
   * @returns {React.ReactNode} 视频列表节点
   */
  renderVideoList = () => {
    const { videos } = this.state;
    if (videos.length === 0) {
      return <div className={styles.emptyState}>暂无投稿视频</div>;
    }
    return (
      <div className={styles.videoGrid}>
        {videos.map((video) => (
          <HGVideoCardPage
            key={video.id}
            cover={video.cover}
            title={video.title}
            playCount={video.playCount}
            duration={video.duration}
            publishTime={video.publishTime}
            onClick={() => alert(`点击视频: ${video.title}`)}
          />
        ))}
      </div>
    );
  };

  /**
   * 渲染内容区域
   * @returns {React.ReactNode} 内容节点
   */
  renderContent = () => {
    const { activeTab } = this.state;
    if (activeTab === "video") {
      return this.renderVideoList();
    }
    return (
      <div className={styles.emptyState}>
        「{SPACE_TABS.find((t) => t.key === activeTab)?.label}」内容开发中
      </div>
    );
  };

  render() {
    const { loading } = this.state;
    if (loading) {
      return <div className={styles.loadingState}>加载中...</div>;
    }
    return (
      <div className={styles.spaceContainer}>
        {this.renderCover()}
        {this.renderUserCard()}
        {this.renderTabNav()}
        <div className={styles.contentSection}>{this.renderContent()}</div>
      </div>
    );
  }
}

export default HGUserSpacePage;
