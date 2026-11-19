import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGPageHeaderPage from "../../../../components/hg_page_header/hg_page_header_page";
import HGTablePage from "../../../../components/hg_table/hg_table_page";
import HGScopeTypeVM from "./hg_scope_type_vm";

/** 创建与编辑共用表单页面；编辑由详情接口回填，不依赖列表中可能过期的字段。 */
class HGScopeTypeFormPage extends Component {
  state = {
    form: { code: "", name: "", description: "" }, // 新建时为空；编辑时按 code 请求权威详情。
    loading: Boolean(this.props.code), // 有编辑编码时在回填结束前禁止保存。
    saving: false, // 提交中的同步锁和按钮禁用标记。
    error: "", // 查询失败时保持页面并允许重试。
  };
  hgMounted = false; // 卸载后不再写入表单状态。

  componentDidMount() { this.hgMounted = true; if (this.props.code) this.hgLoadDetail(); }
  componentWillUnmount() { this.hgMounted = false; }

  /** 从服务端查询编辑对象，防止使用列表快照覆盖后端的新状态。 */
  hgLoadDetail = async () => {
    this.setState({ loading: true, error: "" });
    try {
      const item = await HGScopeTypeVM.detail(this.props.code);
      if (this.hgMounted) this.setState({ form: { code: item.code, name: item.name, description: item.description || "" }, loading: false });
    } catch (error) {
      if (this.hgMounted) this.setState({ error: error?.message || "作用域类型读取失败", loading: false });
    }
  };

  /** 仅提交类型编码、名称和用途；不能从表单改变后端的启停或资源 ID 校验。 */
  hgSave = async () => {
    if (this.state.saving || this.state.loading || this.state.error) return;
    const form = { ...this.state.form, code: this.state.form.code.trim(), name: this.state.form.name.trim(), description: this.state.form.description.trim() }; // 提交时的稳定快照。
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(form.code) || !form.name || form.name.length > 64 || form.description.length > 255) { message.error("请填写有效的编码、名称与用途"); return; }
    this.setState({ saving: true });
    try {
      if (this.props.code) await HGScopeTypeVM.update(form);
      else await HGScopeTypeVM.create(form);
      if (this.hgMounted) { message.success(this.props.code ? "已更新" : "已创建（待业务接入后启用）"); this.props.onBack(); }
    } catch (error) { if (this.hgMounted) message.error(error?.message || "保存失败"); }
    finally { if (this.hgMounted) this.setState({ saving: false }); }
  };

  /** 受控输入只更新当前表单草稿。 */
  hgField = (field, value) => this.setState((previous) => ({ form: { ...previous.form, [field]: value } }));

  render() {
    const { form, loading, saving, error } = this.state; // 当前页面输入和网络状态。
    return <>
      <HGPageHeaderPage title={this.props.code ? "编辑作用域类型" : "创建作用域类型"} extra={<HGButtonPage onClick={this.props.onBack}>返回列表</HGButtonPage>} />
      <HGCardPage title="类型信息">
        {error && <p role="alert">{error} <HGButtonPage onClick={this.hgLoadDetail}>重试</HGButtonPage></p>}
        <p><label>类型编码 <input aria-label="类型编码" value={form.code} maxLength={32} disabled={Boolean(this.props.code) || loading || saving} onChange={(event) => this.hgField("code", event.target.value)} /></label></p>
        <p><label>中文名称 <input aria-label="中文名称" value={form.name} maxLength={64} disabled={loading || saving} onChange={(event) => this.hgField("name", event.target.value)} /></label></p>
        <p><label>业务用途 <textarea aria-label="业务用途" value={form.description} maxLength={255} disabled={loading || saving} onChange={(event) => this.hgField("description", event.target.value)} /></label></p>
        <p>新类型默认停用；实际资源 ID 校验与权限引擎接入须通过代码和迁移完成。</p>
        <HGButtonPage type="primary" onClick={this.hgSave} loading={saving} disabled={loading || Boolean(error)}>保存</HGButtonPage>
      </HGCardPage>
    </>;
  }
}

/** 作用域字典列表：有界游标翻页、进入共用创建/编辑页，并以停用替代删除。 */
export default class HGScopeTypePage extends Component {
  state = {
    items: [], // 当前已加载的字典项，空数组表示尚未加载或无记录。
    cursor: "", // 下一页服务端游标，空字符串表示没有游标。
    more: false, // 是否还有更多字典项。
    loading: false, // 当前页请求中。
    error: "", // 列表失败文案；不显示伪空态。
    editing: null, // null 为列表，空字符串为创建，非空编码为编辑。
    deleting: "", // 当前正在停用的类型编码，空值表示没有请求。
  };
  hgMounted = false; // 卸载后不再处理异步结果。
  hgRequest = 0; // 重试/刷新时废弃旧列表结果。
  componentDidMount() { this.hgMounted = true; this.hgLoad(); }
  componentWillUnmount() { this.hgMounted = false; this.hgRequest += 1; }

  /** 列表由服务端按 id DESC 游标读取，刷新丢弃过期响应。 */
  hgLoad = async (cursor = 0) => {
    const request = ++this.hgRequest; // 本次请求身份标记。
    this.setState({ loading: true, error: "" });
    try {
      const result = await HGScopeTypeVM.list(cursor);
      if (!this.hgMounted || request !== this.hgRequest) return;
      if (!Array.isArray(result?.list)) throw new Error("作用域字典响应无效");
      this.setState((previous) => ({ items: cursor ? [...previous.items, ...result.list] : result.list, cursor: result.nextCursor || "", more: Boolean(result.hasMore), loading: false }));
    } catch (error) { if (this.hgMounted && request === this.hgRequest) this.setState({ error: error?.message || "列表加载失败", loading: false }); }
  };

  /** 删除仅停用；服务端对被绑定引用和核心类型保持拒绝。 */
  hgDisable = async (item) => {
    if (this.state.deleting || !window.confirm(`确认停用作用域类型 ${item.name}？`)) return;
    this.setState({ deleting: item.code });
    try { await HGScopeTypeVM.disable(item.code); if (this.hgMounted) { message.success("已停用"); this.hgLoad(); } }
    catch (error) { if (this.hgMounted) message.error(error?.message || "停用失败，可能已有绑定或属于内置类型"); }
    finally { if (this.hgMounted) this.setState({ deleting: "" }); }
  };

  render() {
    if (this.state.editing !== null) return <HGScopeTypeFormPage code={this.state.editing} onBack={() => this.setState({ editing: null }, () => this.hgLoad())} />;
    const columns = [ // 表格操作列根据服务端状态控制按钮，服务端仍执行最终权限/引用校验。
      { title: "编码", dataIndex: "code" },
      { title: "名称", dataIndex: "name" },
      { title: "用途", dataIndex: "description" },
      { title: "需要作用域 ID", dataIndex: "requiresScopeId", render: (value) => value ? "是" : "否" },
      { title: "状态", dataIndex: "status", render: (value) => value === 1 ? "已启用" : "未启用/已停用" },
      { title: "操作", dataIndex: "code", render: (_, item) => <><HGButtonPage type="link" onClick={() => this.setState({ editing: item.code })}>编辑</HGButtonPage><HGButtonPage type="link" disabled={item.status !== 1 || ["global", "shop", "org"].includes(item.code) || Boolean(this.state.deleting)} onClick={() => this.hgDisable(item)}>删除</HGButtonPage></> },
    ];
    return <>
      <HGPageHeaderPage title="作用域类型" description="字典类型只定义授权范围；未启用类型不能用于新授权" extra={<HGButtonPage type="primary" onClick={() => this.setState({ editing: "" })}>创建作用域类型</HGButtonPage>} />
      <HGCardPage title="作用域类型列表">
        <HGButtonPage onClick={() => this.hgLoad()} disabled={this.state.loading}>刷新</HGButtonPage>
        {this.state.error && <p role="alert">{this.state.error} <HGButtonPage onClick={() => this.hgLoad()}>重试</HGButtonPage></p>}
        <HGTablePage rowKey="code" columns={columns} dataSource={this.state.items} loading={this.state.loading} pagination={false} autoRowHeight />
        {this.state.more && <HGButtonPage disabled={this.state.loading} onClick={() => this.hgLoad(this.state.cursor)}>加载更多</HGButtonPage>}
      </HGCardPage>
    </>;
  }
}
