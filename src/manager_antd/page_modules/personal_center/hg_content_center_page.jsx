/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25 10:00:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25 10:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/hg_content_center_page.jsx
 * @Description: 内容中心页面，左侧菜单 + 右侧内容区布局
 */
import React from "react";
import HGMenuPage from "../../../components/hg_menu/hg_menu_page";
import HGBreadcrumbPage from "../../../components/hg_breadcrumb/hg_breadcrumb_page";
import HGCourseManagementPage from "./course_management/hg_course_management_page";
import HGContentCenterVM, { MENU_KEY } from "./hg_content_center_vm";
import styles from "./hg_content_center.module.css";
import iconUpload from "../../../assets/icons/icon_upload.svg";
import iconCourse from "../../../assets/icons/icon_course.svg";
import iconFileUpload from "../../../assets/icons/icon_file_upload.svg";

/**
 * 菜单项配置。
 */
const MENU_ITEMS = [
  { key: MENU_KEY.UPLOAD, label: "投稿功能", icon: <img src={iconUpload} alt="投稿" width="18" height="18" /> },
  { key: MENU_KEY.COURSE, label: "课程管理", icon: <img src={iconCourse} alt="课程" width="18" height="18" /> },
  { key: MENU_KEY.COURSE_SUBMIT, label: "课程提交", icon: <img src={iconCourse} alt="课程提交" width="18" height="18" /> },
];

/**
 * 内容中心页面组件。
 * 职责：展示左侧菜单（投稿功能、课程管理）和右侧内容区。
 * 约束：使用类组件实现，菜单切换不触发路由跳转。
 */
class HGContentCenterPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeMenu: MENU_KEY.UPLOAD,
      uploads: [],
      courses: [],
      loading: false,
    };
  }

  /**
   * 生命周期挂载：加载初始数据。
   */
  componentDidMount() {
    this.loadData();
  }

  /**
   * 加载页面数据。
   */
  loadData = async () => {
    this.setState({ loading: true });
    try {
      const [uploadRes, courseRes] = await Promise.all([
        HGContentCenterVM.fetchUploadList(),
        HGContentCenterVM.fetchCourseList(),
      ]);
      this.setState({
        uploads: uploadRes.data || [],
        courses: courseRes.data || [],
      });
    } catch {
      // 错误处理
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 处理菜单点击切换。
   * @param {{key: string}} e 菜单点击事件对象。
   */
  handleMenuClick = (e) => {
    this.setState({ activeMenu: e.key });
  };

  /**
   * 渲染左侧菜单。
   * @returns {React.ReactNode} 菜单节点。
   */
  renderSider = () => {
    const { activeMenu } = this.state;
    return (
      <div className={styles.sider}>
        <div className={styles.siderTitle}>内容中心</div>
        <HGMenuPage
          mode="inline"
          theme="light"
          selectedKeys={[activeMenu]}
          onClick={this.handleMenuClick}
          items={MENU_ITEMS}
        />
      </div>
    );
  };

  /**
   * 渲染面包屑导航。
   * @returns {React.ReactNode} 面包屑节点。
   */
  renderBreadcrumb = () => {
    const { activeMenu } = this.state;
    const breadcrumbItems = HGContentCenterVM.getBreadcrumbItems(activeMenu);
    return (
      <div className={styles.breadcrumbWrap}>
        <HGBreadcrumbPage items={breadcrumbItems} />
      </div>
    );
  };

  /**
   * 渲染投稿功能内容区。
   * @returns {React.ReactNode} 投稿内容节点。
   */
  renderUploadContent = () => {
    const { uploads } = this.state;
    return (
      <div className={styles.uploadSection}>
        <div className={styles.uploadArea}>
          <div className={styles.uploadIcon}>
            <img src={iconFileUpload} alt="上传" width="48" height="48" />
          </div>
          <div className={styles.uploadText}>点击或拖拽文件到此处上传</div>
          <div className={styles.uploadHint}>支持 MP4、AVI、MOV 格式，最大 2GB</div>
        </div>
        <div className={styles.uploadList}>
          {uploads.map((item) => (
            <div key={item.id} className={styles.uploadItem}>
              <div className={styles.uploadItemIcon}>
                <img src={iconUpload} alt="文件" width="18" height="18" />
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
    const { courses } = this.state;
    return (
      <div className={styles.courseSection}>
        <div className={styles.courseHeader}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>我的课程</h3>
        </div>
        <div className={styles.courseGrid}>
          {courses.map((course) => (
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
    return (
      <div className={styles.content}>
        {this.renderBreadcrumb()}
        <div className={styles.contentCard}>
          {activeMenu === MENU_KEY.UPLOAD && this.renderUploadContent()}
          {activeMenu === MENU_KEY.COURSE && this.renderCourseContent()}
          {activeMenu === MENU_KEY.COURSE_SUBMIT && <HGCourseManagementPage />}
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

export default HGContentCenterPage;
