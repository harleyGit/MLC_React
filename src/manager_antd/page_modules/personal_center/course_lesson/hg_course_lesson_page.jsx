/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_lesson/hg_course_lesson_page.jsx
 * @Description: 课时管理页面，支持课时的增删改查
 * 
 * 存储最小教学单元课时，关联章节目录，存放视频、作业、详情内容，支持试听权限配置，供学员在线学习。
 */
import React from "react";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGCourseLessonVM, { INITIAL_FORM_DATA } from "./hg_course_lesson_vm";
import styles from "./hg_course_lesson.module.css";

/**
 * SVG 图标组件。
 */
const Icon = {
  Upload: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Bold: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Italic: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  List: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="4" cy="6" r="1" fill="currentColor"/>
      <circle cx="4" cy="12" r="1" fill="currentColor"/>
      <circle cx="4" cy="18" r="1" fill="currentColor"/>
    </svg>
  ),
};

/**
 * 课时管理页面组件。
 * 职责：展示课时表单和课时列表，支持课时的增删改查。
 * 约束：使用类组件实现。
 */
class HGCourseLessonPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
      submitting: false,
      loading: false,
      courses: [],
      catalogs: [],
      lessons: [],
      showCourseDropdown: false,
      showCatalogDropdown: false,
      videoPreview: null,
    };
    this.courseRef = React.createRef();
    this.catalogRef = React.createRef();
    this.videoInputRef = React.createRef();
    this.detailRef = React.createRef();
    this.homeworkRef = React.createRef();
  }

  /**
   * 生命周期挂载：加载数据。
   */
  componentDidMount() {
    this.loadData();
    document.addEventListener("mousedown", this.handleDocumentClick);
  }

  /**
   * 生命周期卸载：移除监听。
   */
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleDocumentClick);
  }

  /**
   * 处理全局点击，关闭下拉框。
   * @param {MouseEvent} e 鼠标事件。
   */
  handleDocumentClick = (e) => {
    if (this.courseRef.current && !this.courseRef.current.contains(e.target)) {
      this.setState({ showCourseDropdown: false });
    }
    if (this.catalogRef.current && !this.catalogRef.current.contains(e.target)) {
      this.setState({ showCatalogDropdown: false });
    }
  };

  /**
   * 加载页面数据。
   */
  loadData = async () => {
    this.setState({ loading: true });
    try {
      const [courseRes, lessonRes] = await Promise.all([
        HGCourseLessonVM.fetchCourses(),
        HGCourseLessonVM.fetchLessonList(),
      ]);
      this.setState({
        courses: courseRes.data || [],
        lessons: lessonRes.data || [],
      });
    } catch {
      message.error("加载数据失败");
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 处理表单字段变化。
   * @param {string} field 字段名。
   * @param {*} value 字段值。
   */
  handleFieldChange = (field, value) => {
    this.setState((prevState) => ({
      formData: { ...prevState.formData, [field]: value },
      errors: { ...prevState.errors, [field]: undefined },
    }));
  };

  /**
   * 处理输入框变化。
   * @param {string} field 字段名。
   * @param {React.ChangeEvent} e 输入事件。
   */
  handleInputChange = (field, e) => {
    this.handleFieldChange(field, e.target.value);
  };

  /**
   * 处理数字增减。
   * @param {string} field 字段名。
   * @param {number} step 步长。
   */
  handleNumberStep = (field, step) => {
    const { formData } = this.state;
    const currentValue = formData[field] || 0;
    const newValue = Math.max(0, currentValue + step);
    this.handleFieldChange(field, newValue);
  };

  /**
   * 选择课程。
   * @param {Object} course 选中的课程。
   */
  handleSelectCourse = async (course) => {
    this.handleFieldChange("goods_id", course.id);
    this.handleFieldChange("catalog_id", "");
    this.setState({ showCourseDropdown: false });

    // 加载该课程的目录
    try {
      const res = await HGCourseLessonVM.fetchCatalogs(course.id);
      this.setState({ catalogs: res.data || [] });
    } catch {
      message.error("加载目录失败");
    }
  };

  /**
   * 选择目录。
   * @param {Object} catalog 选中的目录。
   */
  handleSelectCatalog = (catalog) => {
    this.handleFieldChange("catalog_id", catalog.id);
    this.setState({ showCatalogDropdown: false });
  };

  /**
   * 处理视频上传。
   * @param {React.ChangeEvent} e 文件输入事件。
   */
  handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ["video/mp4", "video/avi", "video/quicktime", "video/webm"];
    if (!allowedTypes.includes(file.type)) {
      message.error("请上传视频文件（MP4、AVI、MOV、WebM）");
      return;
    }

    // 验证文件大小（500MB）
    if (file.size > 500 * 1024 * 1024) {
      message.error("视频大小不能超过500MB");
      return;
    }

    try {
      message.info("视频上传中...");
      const result = await HGCourseLessonVM.uploadVideo(file);
      if (result.success) {
        this.handleFieldChange("video_key", result.key);
        this.setState({ videoPreview: result.url });
        message.success("视频上传成功");
      }
    } catch {
      message.error("视频上传失败");
    }
  };

  /**
   * 处理富文本编辑器输入。
   * @param {string} field 字段名。
   * @param {React.FormEvent} e 输入事件。
   */
  handleRichTextInput = (field, e) => {
    this.handleFieldChange(field, e.currentTarget.innerHTML);
  };

  /**
   * 执行富文本命令。
   * @param {string} command 命令名称。
   */
  execRichTextCommand = (command) => {
    document.execCommand(command, false, null);
  };

  /**
   * 处理表单提交。
   */
  handleSubmit = async () => {
    const { formData } = this.state;
    const validation = HGCourseLessonVM.validateForm(formData);
    if (!validation.valid) {
      this.setState({ errors: validation.errors });
      message.error("请填写必填项");
      return;
    }

    this.setState({ submitting: true });
    try {
      const result = await HGCourseLessonVM.submitLesson(formData);
      if (result.success) {
        message.success(result.message);
        this.setState({ formData: { ...INITIAL_FORM_DATA }, errors: {}, videoPreview: null });
        this.loadData();
      }
    } catch (error) {
      if (error.type === "validation") {
        this.setState({ errors: error.errors });
      } else {
        message.error("提交失败，请重试");
      }
    } finally {
      this.setState({ submitting: false });
    }
  };

  /**
   * 处理表单重置。
   */
  handleReset = () => {
    this.setState({ formData: { ...INITIAL_FORM_DATA }, errors: {}, videoPreview: null });
    message.info("表单已重置");
  };

  /**
   * 处理删除课时。
   * @param {number} id 课时 ID。
   */
  handleDelete = async (id) => {
    try {
      const result = await HGCourseLessonVM.deleteLesson(id);
      if (result.success) {
        message.success(result.message);
        this.loadData();
      }
    } catch {
      message.error("删除失败");
    }
  };

  /**
   * 渲染下拉选择器。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Array} options 选项列表。
   * @param {Object} config 配置项。
   * @returns {React.ReactNode} 下拉选择器节点。
   */
  renderSelect = (label, field, options, config = {}) => {
    const { errors, formData } = this.state;
    const { required, placeholder, refKey } = config;
    const hasError = !!errors[field];
    const selectedOption = options.find((o) => o.id === formData[field]);
    const displayText = selectedOption ? selectedOption.name : placeholder || `请选择${label}`;
    const showDropdown = this.state[`show${field}Dropdown`];

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${required ? styles.formLabelRequired : ""}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <div className={styles.selectWrapper} ref={this[refKey]}>
            <div
              className={styles.selectTrigger}
              onClick={() => this.setState({ [`show${field}Dropdown`]: !showDropdown })}
            >
              <span className={formData[field] ? styles.selectValue : styles.selectPlaceholder}>
                {displayText}
              </span>
              <svg className={`${styles.selectArrow} ${showDropdown ? styles.selectArrowOpen : ""}`} viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {showDropdown && (
              <div className={styles.selectDropdown}>
                {options.length === 0 ? (
                  <div className={styles.selectOption} style={{ color: "#999", cursor: "default" }}>
                    暂无数据
                  </div>
                ) : (
                  options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.selectOption} ${formData[field] === option.id ? styles.selectOptionSelected : ""}`}
                      onClick={() => config.onSelect(option)}
                    >
                      {option.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {hasError && <div className={styles.formError}>{errors[field]}</div>}
        </div>
      </div>
    );
  };

  /**
   * 渲染开关。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Object} options 配置选项。
   * @returns {React.ReactNode} 开关节点。
   */
  renderSwitch = (label, field, options = {}) => {
    const { formData } = this.state;
    const { checkedLabel, uncheckedLabel } = options;
    const isChecked = !!formData[field];

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <div className={styles.switchWrapper}>
            <button
              type="button"
              className={`${styles.switch} ${isChecked ? styles.switchChecked : styles.switchUnchecked}`}
              onClick={() => this.handleFieldChange(field, !isChecked)}
            >
              <span className={`${styles.switchDot} ${isChecked ? styles.switchDotChecked : styles.switchDotUnchecked}`} />
            </button>
            <span className={styles.switchLabel}>
              {isChecked ? (checkedLabel || "是") : (uncheckedLabel || "否")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染视频上传。
   * @returns {React.ReactNode} 视频上传节点。
   */
  renderVideoUpload = () => {
    const { errors, videoPreview } = this.state;
    const hasError = !!errors.video_key;
    const hasVideo = !!videoPreview;

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>视频文件</label>
        <div className={styles.formControl}>
          <input
            type="file"
            ref={this.videoInputRef}
            accept="video/*"
            style={{ display: "none" }}
            onChange={this.handleVideoUpload}
          />
          <div
            className={`${styles.uploadArea} ${hasVideo ? styles.uploadAreaHasVideo : ""}`}
            onClick={() => this.videoInputRef.current?.click()}
          >
            {hasVideo ? (
              <div className={styles.uploadPreview}>
                <span>视频已上传</span>
                <div className={styles.uploadPreviewOverlay}>点击更换</div>
              </div>
            ) : (
              <>
                <div className={styles.uploadIcon}>
                  <Icon.Upload />
                </div>
                <span className={styles.uploadText}>点击上传视频</span>
              </>
            )}
          </div>
          {hasError && <div className={styles.formError}>{errors.video_key}</div>}
          <div className={styles.formHint}>支持 MP4、AVI、MOV、WebM 格式，最大 500MB</div>
        </div>
      </div>
    );
  };

  /**
   * 渲染富文本编辑器。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {string} placeholder 占位文本。
   * @returns {React.ReactNode} 富文本编辑器节点。
   */
  renderRichText = (label, field, placeholder) => {
    return (
      <div className={styles.formItem}>
        <label className={styles.formLabel}>{label}</label>
        <div className={styles.formControl}>
          <div className={styles.richTextWrapper}>
            <div className={styles.richTextToolbar}>
              <button
                type="button"
                className={styles.richTextToolbarBtn}
                onClick={() => this.execRichTextCommand("bold")}
                title="加粗"
              >
                <Icon.Bold />
              </button>
              <button
                type="button"
                className={styles.richTextToolbarBtn}
                onClick={() => this.execRichTextCommand("italic")}
                title="斜体"
              >
                <Icon.Italic />
              </button>
              <button
                type="button"
                className={styles.richTextToolbarBtn}
                onClick={() => this.execRichTextCommand("insertUnorderedList")}
                title="无序列表"
              >
                <Icon.List />
              </button>
            </div>
            <div
              ref={field === "detail" ? this.detailRef : this.homeworkRef}
              className={styles.richTextContent}
              contentEditable
              data-placeholder={placeholder}
              onInput={(e) => this.handleRichTextInput(field, e)}
              suppressContentEditableWarning
            />
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染表单。
   * @returns {React.ReactNode} 表单节点。
   */
  renderForm = () => {
    const { courses, catalogs, formData, errors, submitting } = this.state;

    return (
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>添加课时</h3>

        {this.renderSelect("所属课程", "goods_id", courses, {
          required: true,
          placeholder: "请选择所属课程",
          refKey: "courseRef",
          onSelect: this.handleSelectCourse,
        })}

        {this.renderSelect("所属目录", "catalog_id", catalogs, {
          required: true,
          placeholder: "请选择所属目录",
          refKey: "catalogRef",
          onSelect: this.handleSelectCatalog,
        })}

        <div className={styles.formItem}>
          <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>课时名称</label>
          <div className={styles.formControl}>
            <input
              type="text"
              className={styles.input}
              value={formData.name}
              placeholder="请输入课时名称"
              onChange={(e) => this.handleInputChange("name", e)}
            />
            {errors.name && <div className={styles.formError}>{errors.name}</div>}
          </div>
        </div>

        {this.renderSwitch("是否试听", "enable_trial", {
          checkedLabel: "可试听",
          uncheckedLabel: "不可试听",
        })}

        {this.renderSwitch("启用状态", "status", {
          checkedLabel: "启用",
          uncheckedLabel: "禁用",
        })}

        {this.renderVideoUpload()}

        {this.renderRichText("课时详情", "detail", "请输入课时详情（选填）")}

        {this.renderRichText("课后作业", "homework", "请输入课后作业（选填）")}

        <div className={styles.formItem}>
          <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>排序值</label>
          <div className={styles.formControl}>
            <div className={styles.inputNumberWrapper}>
              <button
                type="button"
                className={`${styles.inputNumberBtn} ${formData.sort <= 0 ? styles.inputNumberBtnDisabled : ""}`}
                onClick={() => this.handleNumberStep("sort", -1)}
                disabled={formData.sort <= 0}
              >
                -
              </button>
              <input
                type="number"
                className={styles.inputNumberInput}
                value={formData.sort}
                min={0}
                onChange={(e) => this.handleFieldChange("sort", parseInt(e.target.value, 10) || 0)}
              />
              <button
                type="button"
                className={styles.inputNumberBtn}
                onClick={() => this.handleNumberStep("sort", 1)}
              >
                +
              </button>
            </div>
            {errors.sort && <div className={styles.formError}>{errors.sort}</div>}
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${submitting ? styles.btnDisabled : ""}`}
            onClick={this.handleSubmit}
            disabled={submitting}
          >
            {submitting ? "提交中..." : "提交"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDefault}`}
            onClick={this.handleReset}
            disabled={submitting}
          >
            重置
          </button>
        </div>
      </div>
    );
  };

  /**
   * 渲染课时列表。
   * @returns {React.ReactNode} 列表节点。
   */
  renderLessonList = () => {
    const { lessons, courses, catalogs } = this.state;

    const getCourseName = (id) => courses.find((c) => c.id === id)?.name || "-";
    const getCatalogName = (id) => catalogs.find((c) => c.id === id)?.name || "-";

    return (
      <div className={styles.lessonList}>
        <h3 className={styles.lessonListTitle}>课时列表</h3>
        <table className={styles.lessonTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>课时名称</th>
              <th>所属课程</th>
              <th>所属目录</th>
              <th>试听</th>
              <th>状态</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>{getCourseName(item.goods_id)}</td>
                <td>{getCatalogName(item.catalog_id)}</td>
                <td>
                  <span className={`${styles.tag} ${item.enable_trial ? styles.tagSuccess : styles.tagDefault}`}>
                    {item.enable_trial ? "可试听" : "不可试听"}
                  </span>
                </td>
                <td>
                  <span className={`${styles.tag} ${item.status ? styles.tagSuccess : styles.tagDefault}`}>
                    {item.status ? "启用" : "禁用"}
                  </span>
                </td>
                <td>{item.sort}</td>
                <td>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDefault}`}
                    onClick={() => this.handleDelete(item.id)}
                    style={{ padding: "4px 12px", fontSize: "12px" }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  render() {
    const { loading } = this.state;

    return (
      <div className={styles.container}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
          </div>
        )}
        {this.renderForm()}
        {this.renderLessonList()}
      </div>
    );
  }
}

export default HGCourseLessonPage;
