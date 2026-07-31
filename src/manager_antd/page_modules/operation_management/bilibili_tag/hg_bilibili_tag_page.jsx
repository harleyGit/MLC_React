import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import styles from "./hg_bilibili_tag.module.css";
import HGBilibiliTagVM, { BILIBILI_TAG_PAGE_SIZE } from "./hg_bilibili_tag_vm";

/** 新建表单默认值；tagId 为空表示创建模式，非空表示编辑模式。 */
const EMPTY_FORM = { tagId: "", name: "", sortOrder: 0, status: 1 };

/** 运维 Bilibili 动画标签管理页，支持 cursor 分页和完整 CRUD。 */
class HGBilibiliTagPage extends Component {
  state = {
    /** 当前页表格数据。 */
    data: [],
    /** 标签列表请求状态。 */
    loading: false,
    /** 页码到后端不透明 cursor 的映射；第 1 页固定使用空字符串。 */
    cursorByPage: { 1: "" },
    /** 表格分页状态；total 是根据 hasMore 合成的最小数量，不是数据库精确总数。 */
    pagination: { current: 1, pageSize: BILIBILI_TAG_PAGE_SIZE, total: 0 },
    /** 新增/编辑共用弹窗状态。 */
    formVisible: false,
    form: { ...EMPTY_FORM },
    submitting: false,
    /** 非空时展示删除确认弹窗。 */
    deleteRecord: null,
  };

  /** 页面挂载后加载标签首页。 */
  componentDidMount() {
    this.fetchTags(1, BILIBILI_TAG_PAGE_SIZE);
  }

  /**
   * 按前端页码读取对应 cursor 并加载标签列表。
   * 后端返回的 nextCursor 只保存给下一页，切换 pageSize 时必须清空旧映射。
   */
  fetchTags = (pageNum, pageSize) => {
    const cursor = String(this.state.cursorByPage[pageNum] || "");
    this.setState({ loading: true });
    HGBilibiliTagVM.fetchTags({ cursor, pageSize })
      .then((res) => {
        const rows = HGBilibiliTagVM.toRows(res?.list || []);
        this.setState((state) => {
          const cursorByPage = { ...state.cursorByPage };
          if (res?.hasMore && res?.nextCursor)
            cursorByPage[pageNum + 1] = String(res.nextCursor);
          return {
            data: rows,
            cursorByPage,
            pagination: {
              current: pageNum,
              pageSize,
              total: HGBilibiliTagVM.buildCursorTotal({
                pageNum,
                pageSize,
                rowCount: rows.length,
                hasMore: Boolean(res?.hasMore),
              }),
            },
          };
        });
      })
      .catch((error) =>
        message.error(
          HGBilibiliTagVM.getErrorMessage(
            error,
            "动画标签获取失败，请稍后重试"
          )
        )
      )
      .finally(() => this.setState({ loading: false }));
  };

  /** 处理分页或每页数量变化；pageSize 改变后从首页重新建立 cursor 链。 */
  handleTableChange = (pagination) => {
    if (pagination.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: "" } }, () =>
        this.fetchTags(1, pagination.pageSize)
      );
      return;
    }
    this.fetchTags(pagination.current, pagination.pageSize);
  };

  /** 打开创建弹窗并清空上一次编辑内容。 */
  openCreate = () =>
    this.setState({ formVisible: true, form: { ...EMPTY_FORM } });

  /** 打开编辑弹窗，复制当前记录避免直接修改表格数据对象。 */
  openEdit = (tagId) => {
    const record = this.state.data.find((item) => item.tagId === tagId);
    if (record) this.setState({ formVisible: true, form: { ...record } });
  };

  /** 按业务 tagId 打开删除确认，避免操作列闭包依赖整个记录对象。 */
  openDelete = (tagId) => {
    const record = this.state.data.find((item) => item.tagId === tagId);
    if (record) this.setState({ deleteRecord: record });
  };

  /** 关闭表单弹窗并恢复默认值。 */
  closeForm = () =>
    this.setState({ formVisible: false, form: { ...EMPTY_FORM } });

  /** 更新新增/编辑表单的单个字段。 */
  changeForm = (field, value) =>
    this.setState((state) => ({ form: { ...state.form, [field]: value } }));

  /** 校验并提交创建或更新请求，成功后刷新对应列表页。 */
  submitForm = () => {
    const { form, pagination } = this.state;
    const validationError = HGBilibiliTagVM.validateForm(form);
    if (validationError) {
      message.error(validationError);
      return;
    }
    this.setState({ submitting: true });
    const request = form.tagId
      ? HGBilibiliTagVM.updateTag(form)
      : HGBilibiliTagVM.createTag(form);
    request
      .then(() => {
        message.success(form.tagId ? "标签更新成功" : "标签创建成功");
        this.closeForm();
        this.fetchTags(
          form.tagId ? pagination.current : 1,
          pagination.pageSize
        );
      })
      .catch((error) =>
        message.error(
          HGBilibiliTagVM.getErrorMessage(
            error,
            form.tagId ? "标签更新失败" : "标签创建失败"
          )
        )
      )
      .finally(() => this.setState({ submitting: false }));
  };

  /** 确认软删除标签，成功后保留当前分页位置并刷新数据。 */
  confirmDelete = () => {
    const { deleteRecord, pagination } = this.state;
    if (!deleteRecord) return;
    HGBilibiliTagVM.deleteTag({ tagId: deleteRecord.tagId })
      .then(() => {
        message.success("标签删除成功");
        this.setState({ deleteRecord: null });
        this.fetchTags(pagination.current, pagination.pageSize);
      })
      .catch((error) =>
        message.error(
          HGBilibiliTagVM.getErrorMessage(error, "标签删除失败")
        )
      );
  };

  /** 构建标签表格列和操作入口。 */
  getColumns = () => [
    { title: "标签ID", dataIndex: "tagId", width: 280 },
    { title: "标签名称", dataIndex: "name", width: 180 },
    { title: "排序", dataIndex: "sortOrder", width: 90 },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status) => (
        <span
          className={status === 1 ? styles.statusActive : styles.statusDisabled}
        >
          {status === 1 ? "启用" : "停用"}
        </span>
      ),
    },
    { title: "更新时间", dataIndex: "updatedAt", width: 200 },
    {
      title: "操作",
      dataIndex: "action",
      width: 180,
      render: (_, record) => (
        <span>
          <a className={styles.action} onClick={() => this.openEdit(record.tagId)}>
            编辑
          </a>
          <span style={{ margin: "0 8px", color: "#d8deea" }}>|</span>
          <a
            className={styles.dangerAction}
            onClick={() => this.openDelete(record.tagId)}
          >
            删除
          </a>
        </span>
      ),
    },
  ];

  /** 渲染新增/编辑共用表单。 */
  renderForm = () => {
    const { form } = this.state;
    return (
      <div className={styles.form}>
        <div className={styles.field}>
          <label>标签名称</label>
          <input
            value={form.name}
            maxLength={32}
            placeholder="例如 MMD·3D"
            onChange={(event) => this.changeForm("name", event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>排序值</label>
          <input
            type="number"
            min="0"
            max="1000000"
            value={form.sortOrder}
            onChange={(event) =>
              this.changeForm("sortOrder", event.target.value)
            }
          />
        </div>
        <div className={styles.field}>
          <label>状态</label>
          <select
            value={form.status}
            onChange={(event) =>
              this.changeForm("status", Number(event.target.value))
            }
          >
            <option value={1}>启用</option>
            <option value={2}>停用</option>
          </select>
        </div>
      </div>
    );
  };

  render() {
    const {
      data,
      loading,
      pagination,
      formVisible,
      form,
      submitting,
      deleteRecord,
    } = this.state;
    return (
      <div className={styles.container}>
        <HGCardPage
          title="Bilibili 动画标签"
          extra={
            <div className={styles.toolbar}>
              <HGButtonPage
                onClick={() => this.fetchTags(1, pagination.pageSize)}
              >
                刷新
              </HGButtonPage>
              <HGButtonPage type="primary" onClick={this.openCreate}>
                新增标签
              </HGButtonPage>
            </div>
          }
        >
          <p className={styles.tip}>
            “推荐”为系统保留项，不入库；停用或删除标签不会修改历史视频上的标签快照。
          </p>
          <HGTablePage
            rowKey={(record) => String(record.tagId)}
            columns={this.getColumns()}
            dataSource={data}
            loading={loading}
            pagination={{ ...pagination, showSizeChanger: true }}
            onChange={this.handleTableChange}
            scroll={{ y: 420 }}
          />
        </HGCardPage>
        <HGModalPage
          visible={formVisible}
          title={form.tagId ? "编辑动画标签" : "新增动画标签"}
          onClose={this.closeForm}
          onCancel={this.closeForm}
          onOk={this.submitForm}
          okText={submitting ? "提交中..." : "确认"}
        >
          {this.renderForm()}
        </HGModalPage>
        <HGModalPage
          visible={Boolean(deleteRecord)}
          title="确认删除"
          onClose={() => this.setState({ deleteRecord: null })}
          onCancel={() => this.setState({ deleteRecord: null })}
          onOk={this.confirmDelete}
          okType="danger"
          okText="确认删除"
        >
          <p>确定删除标签“{deleteRecord?.name}”吗？历史视频标签不受影响。</p>
        </HGModalPage>
      </div>
    );
  }
}

export default HGBilibiliTagPage;
