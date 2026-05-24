import React from "react";
import HGTablePage from "./hg_table_page";
import styles from "./hg_table_demo.module.css";

/**
 * HGTable 自定义演示页面。
 * 职责：展示 cell、sectionHeader、sectionFooter 的自定义渲染能力。
 */
class HGTableDemoPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: "cell",
    };
  }

  /**
   * 渲染自定义 cell 的列配置。
   * 使用 columns.render 函数自定义每个单元格的渲染。
   */
  getCellColumns = () => [
    {
      title: "姓名",
      dataIndex: "name",
      width: 120,
      render: (value, record) => (
        <div className={styles.customCell}>
          <div className={styles.avatar} style={{ background: record.color }}>
            {value.charAt(0)}
          </div>
          <span className={styles.nameText}>{value}</span>
        </div>
      ),
    },
    {
      title: "年龄",
      dataIndex: "age",
      width: 80,
      render: (value) => (
        <span className={styles.ageBadge}>{value}岁</span>
      ),
    },
    {
      title: "职业",
      dataIndex: "job",
      width: 120,
      render: (value) => (
        <span className={styles.jobTag}>{value}</span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value) => {
        const isActive = value === "在职";
        return (
          <span className={`${styles.statusDot} ${isActive ? styles.statusActive : styles.statusInactive}`}>
            {value}
          </span>
        );
      },
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 150,
      render: () => (
        <div className={styles.actionBtns}>
          <button className={styles.editBtn}>编辑</button>
          <button className={styles.deleteBtn}>删除</button>
        </div>
      ),
    },
  ];

  /**
   * 渲染自定义 cell 的数据源。
   */
  getCellData = () => [
    { id: "1", name: "张三", age: 28, job: "前端工程师", status: "在职", color: "#1890ff" },
    { id: "2", name: "李四", age: 32, job: "后端工程师", status: "在职", color: "#52c41a" },
    { id: "3", name: "王五", age: 25, job: "UI设计师", status: "离职", color: "#faad14" },
    { id: "4", name: "赵六", age: 30, job: "产品经理", status: "在职", color: "#722ed1" },
    { id: "5", name: "钱七", age: 27, job: "测试工程师", status: "在职", color: "#eb2f96" },
    { id: "6", name: "孙八", age: 35, job: "架构师", status: "在职", color: "#13c2c2" },
    { id: "7", name: "周九", age: 29, job: "运维工程师", status: "离职", color: "#fa541c" },
    { id: "8", name: "吴十", age: 31, job: "数据分析师", status: "在职", color: "#2f54eb" },
  ];

  /**
   * 渲染自定义 sectionHeader 和 sectionFooter 的配置。
   * header/footer 支持函数形式，接收 (section, columns) 参数。
   */
  getSections = () => [
    {
      header: (section) => (
        <div className={styles.customSectionHeader}>
          <span className={styles.sectionIcon}>📁</span>
          <span className={styles.sectionTitle}>{section.title}</span>
          <span className={styles.sectionCount}>{section.data.length} 人</span>
          <button className={styles.sectionAddBtn}>+ 添加</button>
        </div>
      ),
      footer: (section) => {
        const totalAge = section.data.reduce((sum, item) => sum + item.age, 0);
        const avgAge = Math.round(totalAge / section.data.length);
        return (
          <div className={styles.customSectionFooter}>
            <span>平均年龄: {avgAge}岁</span>
            <span>总计: {section.data.length} 人</span>
          </div>
        );
      },
      title: "技术部",
      data: [
        { id: "1", name: "张三", age: 28, job: "前端工程师", status: "在职", color: "#1890ff" },
        { id: "2", name: "李四", age: 32, job: "后端工程师", status: "在职", color: "#52c41a" },
        { id: "6", name: "孙八", age: 35, job: "架构师", status: "在职", color: "#13c2c2" },
      ],
    },
    {
      header: (section) => (
        <div className={styles.customSectionHeader}>
          <span className={styles.sectionIcon}>🎨</span>
          <span className={styles.sectionTitle}>{section.title}</span>
          <span className={styles.sectionCount}>{section.data.length} 人</span>
          <button className={styles.sectionAddBtn}>+ 添加</button>
        </div>
      ),
      footer: (section) => {
        const totalAge = section.data.reduce((sum, item) => sum + item.age, 0);
        const avgAge = Math.round(totalAge / section.data.length);
        return (
          <div className={styles.customSectionFooter}>
            <span>平均年龄: {avgAge}岁</span>
            <span>总计: {section.data.length} 人</span>
          </div>
        );
      },
      title: "设计部",
      data: [
        { id: "3", name: "王五", age: 25, job: "UI设计师", status: "离职", color: "#faad14" },
        { id: "4", name: "赵六", age: 30, job: "产品经理", status: "在职", color: "#722ed1" },
      ],
    },
    {
      header: (section) => (
        <div className={styles.customSectionHeader}>
          <span className={styles.sectionIcon}>🧪</span>
          <span className={styles.sectionTitle}>{section.title}</span>
          <span className={styles.sectionCount}>{section.data.length} 人</span>
          <button className={styles.sectionAddBtn}>+ 添加</button>
        </div>
      ),
      footer: (section) => {
        const totalAge = section.data.reduce((sum, item) => sum + item.age, 0);
        const avgAge = Math.round(totalAge / section.data.length);
        return (
          <div className={styles.customSectionFooter}>
            <span>平均年龄: {avgAge}岁</span>
            <span>总计: {section.data.length} 人</span>
          </div>
        );
      },
      title: "测试部",
      data: [
        { id: "5", name: "钱七", age: 27, job: "测试工程师", status: "在职", color: "#eb2f96" },
        { id: "7", name: "周九", age: 29, job: "运维工程师", status: "离职", color: "#fa541c" },
        { id: "8", name: "吴十", age: 31, job: "数据分析师", status: "在职", color: "#2f54eb" },
      ],
    },
  ];

  /**
   * 渲染自定义 cell 演示。
   */
  renderCellDemo = () => {
    const columns = this.getCellColumns();
    const dataSource = this.getCellData();

    return (
      <div className={styles.demoSection}>
        <h3 className={styles.demoTitle}>自定义 Cell 渲染</h3>
        <p className={styles.demoDesc}>
          通过 columns 的 render 函数，可以自定义每个单元格的渲染内容，包括头像、标签、状态点、操作按钮等。
        </p>
        <HGTablePage
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          scroll={{ y: 400 }}
          pagination={false}
        />
      </div>
    );
  };

  /**
   * 渲染自定义 sectionHeader 和 sectionFooter 演示。
   */
  renderSectionDemo = () => {
    const columns = [
      { title: "姓名", dataIndex: "name", width: 120 },
      { title: "年龄", dataIndex: "age", width: 80 },
      { title: "职业", dataIndex: "job", width: 150 },
      { title: "状态", dataIndex: "status", width: 100 },
    ];
    const sections = this.getSections();

    return (
      <div className={styles.demoSection}>
        <h3 className={styles.demoTitle}>自定义 SectionHeader & SectionFooter</h3>
        <p className={styles.demoDesc}>
          通过 section 的 header/footer 函数，可以自定义分组头部和尾部的渲染，包括图标、标题、统计信息、操作按钮等。
        </p>
        <HGTablePage
          columns={columns}
          sections={sections}
          rowKey="id"
          scroll={{ y: 500 }}
          pagination={false}
        />
      </div>
    );
  };

  /**
   * 渲染综合演示。
   */
  renderFullDemo = () => {
    const sections = this.getSections().map((section) => ({
      ...section,
      data: section.data.map((item) => ({ ...item })),
    }));

    return (
      <div className={styles.demoSection}>
        <h3 className={styles.demoTitle}>综合演示：自定义 Cell + Section</h3>
        <p className={styles.demoDesc}>
          同时使用自定义 cell 渲染和自定义 sectionHeader/sectionFooter，展示完整的自定义能力。
        </p>
        <HGTablePage
          columns={this.getCellColumns()}
          sections={sections}
          rowKey="id"
          scroll={{ y: 500 }}
          pagination={false}
        />
      </div>
    );
  };

  /**
   * 渲染 Tab 切换。
   */
  renderTabs = () => {
    const { activeTab } = this.state;
    const tabs = [
      { key: "cell", label: "自定义 Cell" },
      { key: "section", label: "自定义 Section" },
      { key: "full", label: "综合演示" },
    ];

    return (
      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
            onClick={() => this.setState({ activeTab: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  render() {
    const { activeTab } = this.state;

    return (
      <div className={styles.pageContainer}>
        <h2 className={styles.pageTitle}>HGTable 自定义渲染演示</h2>
        <p className={styles.pageDesc}>
          本演示展示 HGTable 组件的自定义渲染能力，包括自定义 Cell、SectionHeader、SectionFooter。
        </p>

        {this.renderTabs()}

        <div className={styles.demoContent}>
          {activeTab === "cell" && this.renderCellDemo()}
          {activeTab === "section" && this.renderSectionDemo()}
          {activeTab === "full" && this.renderFullDemo()}
        </div>

        <div className={styles.codeSection}>
          <h3 className={styles.codeTitle}>使用说明</h3>
          <div className={styles.codeBlock}>
            <pre>{`// 1. 自定义 Cell - 通过 columns.render 函数
const columns = [
  {
    title: "姓名",
    dataIndex: "name",
    render: (value, record) => (
      <div>
        <Avatar>{value.charAt(0)}</Avatar>
        <span>{value}</span>
      </div>
    ),
  },
];

// 2. 自定义 SectionHeader - 通过 section.header 函数
const sections = [
  {
    header: (section, columns) => (
      <div>
        <Icon />
        <span>{section.title}</span>
        <span>{section.data.length} 条</span>
      </div>
    ),
    data: [...],
  },
];

// 3. 自定义 SectionFooter - 通过 section.footer 函数
const sections = [
  {
    footer: (section, columns) => (
      <div>
        <span>总计: {section.data.length}</span>
      </div>
    ),
    data: [...],
  },
];`}</pre>
          </div>
        </div>
      </div>
    );
  }
}

export default HGTableDemoPage;