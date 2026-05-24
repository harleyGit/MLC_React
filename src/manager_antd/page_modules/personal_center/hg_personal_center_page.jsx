/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25 10:00:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25 10:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/hg_personal_center_page.jsx
 * @Description: 个人中心页面，左侧菜单 + 右侧内容区布局
 */
import React from "react";
import HGCourseManagementPage from "./course_management/hg_course_management_page";
import styles from "./hg_personal_center.module.css";

/**
 * SVG 图标组件。
 */
const Icon = {
  /** 投稿图标 */
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  /** 课程图标 */
  Course: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  /** 上传文件图标 */
  FileUpload: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

/**
 * 菜单项配置。
 */
const MENU_ITEMS = [
  { key: "upload", label: "投稿功能", icon: Icon.Upload },
  { key: "course", label: "课程管理", icon: Icon.Course },
  { key: "course_submit", label: "课程提交", icon: Icon.Course },
];

/**
 * 模拟投稿数据。
 */
const MOCK_UPLOADS = [
  { id: 1, name: "崩坏星穹铁道角色介绍.mp4", size: "128MB", status: "success", date: "2026-05-20" },
  { id: 2, name: "原神4.0版本前瞻.mp4", size: "256MB", status: "success", date: "2026-05-18" },
  { id: 3, name: "绝区零实机演示.mp4", size: "512MB", status: "pending", date: "2026-05-25" },
];

/**
 * 模拟课程数据。
 */
const MOCK_COURSES = [
  { id: 1, title: "React 入门到精通", cover: "", lessons: 24, students: 1280, status: "published" },
  { id: 2, title: "JavaScript 高级编程", cover: "", lessons: 18, students: 890, status: "published" },
  { id: 3, title: "CSS 动画实战", cover: "", lessons: 12, students: 456, status: "draft" },
];

/**
 * 个人中心页面组件。
 * 职责：展示左侧菜单（投稿功能、课程管理）和右侧内容区。
 * 约束：使用类组件实现，菜单切换不触发路由跳转。
 */
class HGPersonalCenterPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeMenu: "upload",
    };
  }

  /**
   * 处理菜单点击切换。
   * @param {string} key 菜单项 key。
   */
  handleMenuClick = (key) => {
    this.setState({ activeMenu: key });
  };

  /**
   * 渲染左侧菜单。
   * @returns {React.ReactNode} 菜单节点。
   */
  renderSider = () => {
    const { activeMenu } = this.state;
    return (
      <div className={styles.sider}>
        <div className={styles.siderTitle}>个人中心</div>
        {MENU_ITEMS.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.menuItem} ${activeMenu === item.key ? styles.menuItemActive : ""}`}
              onClick={() => this.handleMenuClick(item.key)}
            >
              <span className={styles.menuItemIcon}>
                <IconComponent />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染投稿功能内容区。
   * @returns {React.ReactNode} 投稿内容节点。
   */
  renderUploadContent = () => {
    return (
      <div className={styles.uploadSection}>
        <div className={styles.uploadArea}>
          <div className={styles.uploadIcon}>
            <Icon.FileUpload />
          </div>
          <div className={styles.uploadText}>点击或拖拽文件到此处上传</div>
          <div className={styles.uploadHint}>支持 MP4、AVI、MOV 格式，最大 2GB</div>
        </div>
        <div className={styles.uploadList}>
          {MOCK_UPLOADS.map((item) => (
            <div key={item.id} className={styles.uploadItem}>
              <div className={styles.uploadItemIcon}>
                <Icon.Upload />
              </div>
              <div className={styles.uploadItemInfo}>
                <div className={styles.uploadItemName}>{item.name}</div>
                <div className={styles.uploadItemMeta}>{item.size} · {item.date}</div>
              </div>
              <span className={`${styles.uploadItemStatus} ${item.status === "success" ? styles.uploadItemStatusSuccess : styles.uploadItemStatusPending}`}>
                {item.status === "success" ? "已通过" : "审核中"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染课程管理内容区。
   * @returns {React.ReactNode} 课程内容节点。
   */
  renderCourseContent = () => {
    return (
      <div className={styles.courseSection}>
        <div className={styles.courseHeader}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>我的课程</h3>
        </div>
        <div className={styles.courseGrid}>
          {MOCK_COURSES.map((course) => (
            <div key={course.id} className={styles.courseCard}>
              <div className={styles.courseCover}>
                {course.cover ? (
                  <img src={course.cover} alt={course.title} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", color: "#999" }}>
                    暂无封面
                  </div>
                )}
              </div>
              <div className={styles.courseTitle}>{course.title}</div>
              <div className={styles.courseMeta}>
                <span>{course.lessons} 课时</span>
                <span>{course.students} 学员</span>
                <span className={`${styles.courseStatus} ${course.status === "published" ? styles.courseStatusPublished : styles.courseStatusDraft}`}>
                  {course.status === "published" ? "已发布" : "草稿"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染右侧内容区。
   * @returns {React.ReactNode} 内容节点。
   */
  renderContent = () => {
    const { activeMenu } = this.state;
    const contentTitleMap = {
      upload: "投稿功能",
      course: "课程管理",
      course_submit: "课程提交",
    };
    const contentTitle = contentTitleMap[activeMenu] || "投稿功能";
    return (
      <div className={styles.content}>
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>{contentTitle}</h2>
          {activeMenu === "upload" && this.renderUploadContent()}
          {activeMenu === "course" && this.renderCourseContent()}
          {activeMenu === "course_submit" && <HGCourseManagementPage />}
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.container}>
        {this.renderSider()}
        {this.renderContent()}
      </div>
    );
  }
}

export default HGPersonalCenterPage;
