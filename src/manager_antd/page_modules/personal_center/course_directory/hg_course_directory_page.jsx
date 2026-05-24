/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25 02:18:21
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_directory/hg_course_directory_page.jsx
 * @Description: 课程目录管理页面，支持目录的增删改查
 * 
 * 搭建课程树形章节结构，划分一级二级目录，规整课时归类，控制前台课程章节展示层级与顺序。

 */
import React from "react";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGCourseDirectoryVM, { INITIAL_FORM_DATA } from "./hg_course_directory_vm";
import styles from "./hg_course_directory.module.css";

/**
 * 课程目录管理页面组件。
 * 职责：展示目录表单和目录列表，支持目录的增删改查。
 * 约束：使用类组件实现。
 */
class HGCourseDirectoryPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
      submitting: false,
      loading: false,
      courses: [],
      directoryTree: [],
      directoryList: [],
      parentOptions: [],
      showParentDropdown: false,
      showCourseDropdown: false,
    };
    this.parentRef = React.createRef();
    this.courseRef = React.createRef();
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
    if (this.parentRef.current && !this.parentRef.current.contains(e.target)) {
      this.setState({ showParentDropdown: false });
    }
    if (this.courseRef.current && !this.courseRef.current.contains(e.target)) {
      this.setState({ showCourseDropdown: false });
    }
  };

  /**
   * 加载页面数据。
   */
  loadData = async () => {
    this.setState({ loading: true });
    try {
      const [courseRes, treeRes, listRes] = await Promise.all([
        HGCourseDirectoryVM.fetchCourses(),
        HGCourseDirectoryVM.fetchDirectoryTree(),
        HGCourseDirectoryVM.fetchDirectoryList(),
      ]);
      const parentOptions = HGCourseDirectoryVM.getParentOptions(treeRes.data || []);
      this.setState({
        courses: courseRes.data || [],
        directoryTree: treeRes.data || [],
        directoryList: listRes.data || [],
        parentOptions,
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
   * 选择父级目录。
   * @param {Object} option 选中的选项。
   */
  handleSelectParent = (option) => {
    const level = option.id === 0 ? 1 : 2;
    this.setState((prevState) => ({
      formData: { ...prevState.formData, parent_id: option.id, level },
      showParentDropdown: false,
    }));
  };

  /**
   * 选择所属课程。
   * @param {Object} course 选中的课程。
   */
  handleSelectCourse = (course) => {
    this.handleFieldChange("good_id", course.id);
    this.setState({ showCourseDropdown: false });
  };

  /**
   * 处理表单提交。
   */
  handleSubmit = async () => {
    const { formData } = this.state;
    const validation = HGCourseDirectoryVM.validateForm(formData);
    if (!validation.valid) {
      this.setState({ errors: validation.errors });
      message.error("请填写必填项");
      return;
    }

    this.setState({ submitting: true });
    try {
      const result = await HGCourseDirectoryVM.submitDirectory(formData);
      if (result.success) {
        message.success(result.message);
        this.setState({ formData: { ...INITIAL_FORM_DATA }, errors: {} });
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
    this.setState({ formData: { ...INITIAL_FORM_DATA }, errors: {} });
    message.info("表单已重置");
  };

  /**
   * 处理删除目录。
   * @param {number} id 目录 ID。
   */
  handleDelete = async (id) => {
    try {
      const result = await HGCourseDirectoryVM.deleteDirectory(id);
      if (result.success) {
        message.success(result.message);
        this.loadData();
      }
    } catch {
      message.error("删除失败");
    }
  };

  /**
   * 渲染树形选择器。
   * @returns {React.ReactNode} 树形选择器节点。
   */
  renderTreeSelect = () => {
    const { showParentDropdown, parentOptions, formData } = this.state;
    const selectedOption = parentOptions.find((o) => o.id === formData.parent_id);
    const displayText = selectedOption ? selectedOption.name : "请选择上级目录";

    return (
      <div className={styles.treeSelectWrapper} ref={this.parentRef}>
        <div
          className={styles.treeSelectTrigger}
          onClick={() => this.setState({ showParentDropdown: !showParentDropdown })}
        >
          <span className={formData.parent_id ? styles.selectValue : styles.selectPlaceholder}>
            {displayText}
          </span>
          <svg className={`${styles.selectArrow} ${showParentDropdown ? styles.selectArrowOpen : ""}`} viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {showParentDropdown && (
          <div className={styles.treeSelectDropdown}>
            {parentOptions.map((option) => (
              <div
                key={option.id}
                className={`${styles.treeNode} ${formData.parent_id === option.id ? styles.treeNodeSelected : ""}`}
                onClick={() => this.handleSelectParent(option)}
              >
                <span className={styles.treeNodeIndent} style={{ width: `${option.level * 20}px` }} />
                <span className={styles.treeNodeLabel}>{option.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染课程下拉选择器。
   * @returns {React.ReactNode} 下拉选择器节点。
   */
  renderCourseSelect = () => {
    const { showCourseDropdown, courses, formData } = this.state;
    const selectedCourse = courses.find((c) => c.id === formData.good_id);
    const displayText = selectedCourse ? selectedCourse.name : "请选择所属课程";

    return (
      <div className={styles.selectWrapper} ref={this.courseRef}>
        <div
          className={styles.selectTrigger}
          onClick={() => this.setState({ showCourseDropdown: !showCourseDropdown })}
        >
          <span className={formData.good_id ? styles.selectValue : styles.selectPlaceholder}>
            {displayText}
          </span>
          <svg className={`${styles.selectArrow} ${showCourseDropdown ? styles.selectArrowOpen : ""}`} viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {showCourseDropdown && (
          <div className={styles.selectDropdown}>
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={`${styles.selectOption} ${formData.good_id === course.id ? styles.selectOptionSelected : ""}`}
                onClick={() => this.handleSelectCourse(course)}
              >
                {course.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染层级标签。
   * @param {number} level 层级。
   * @returns {React.ReactNode} 标签节点。
   */
  renderLevelTag = (level) => {
    const tagClass = level === 1 ? styles.tagLevel1 : level === 2 ? styles.tagLevel2 : styles.tagLevel3;
    return <span className={`${styles.tag} ${tagClass}`}>第{level}级</span>;
  };

  /**
   * 渲染表单。
   * @returns {React.ReactNode} 表单节点。
   */
  renderForm = () => {
    const { formData, errors, submitting } = this.state;

    return (
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>添加目录</h3>

        <div className={styles.formItem}>
          <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>上级目录</label>
          <div className={styles.formControl}>
            {this.renderTreeSelect()}
          </div>
        </div>

        <div className={styles.formItem}>
          <label className={styles.formLabel}>目录层级</label>
          <div className={styles.formControl}>
            <div className={styles.tagList}>
              {this.renderLevelTag(formData.level)}
            </div>
          </div>
        </div>

        <div className={styles.formItem}>
          <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>目录名称</label>
          <div className={styles.formControl}>
            <input
              type="text"
              className={styles.input}
              value={formData.name}
              placeholder="请输入目录名称"
              onChange={(e) => this.handleInputChange("name", e)}
            />
            {errors.name && <div className={styles.formError}>{errors.name}</div>}
          </div>
        </div>

        <div className={styles.formItem}>
          <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>所属课程</label>
          <div className={styles.formControl}>
            {this.renderCourseSelect()}
            {errors.good_id && <div className={styles.formError}>{errors.good_id}</div>}
          </div>
        </div>

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
   * 渲染目录列表。
   * @returns {React.ReactNode} 列表节点。
   */
  renderDirectoryList = () => {
    const { directoryList } = this.state;

    return (
      <div className={styles.directoryList}>
        <h3 className={styles.directoryListTitle}>目录列表</h3>
        <table className={styles.directoryTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>目录名称</th>
              <th>层级</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {directoryList.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>
                  <span style={{ paddingLeft: `${(item.depth || 0) * 20}px` }}>
                    {item.name}
                  </span>
                </td>
                <td>{this.renderLevelTag(item.level)}</td>
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
        {this.renderDirectoryList()}
      </div>
    );
  }
}

export default HGCourseDirectoryPage;
