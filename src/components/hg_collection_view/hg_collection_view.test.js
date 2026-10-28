import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { hgCollectionOffsets, hgCollectionStart } from "./hg_collection_layout.js";

/** 运行真实 JSX 组件；DOM 和样式只使用本地替身，不启动网络服务。 */
function hgCollection(props) {
  const file = new URL("./hg_collection_view.jsx", import.meta.url);
  const code = transformSync(readFileSync(file, "utf8"), {
    filename: file.pathname,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const module = { exports: {} }; // 当前编译产物仅存在于测试 VM 中。
  runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (name === "react") return React;
      if (name.endsWith("hg_collection_layout.js")) return { hgCollectionOffsets, hgCollectionStart };
      return { default: {}, __esModule: true };
    },
  });
  const instance = new module.exports.default(props);
  instance.setState = (update) => {
    instance.state = { ...instance.state, ...(typeof update === "function" ? update(instance.state) : update) };
  };
  return instance;
}

test("固定 slot 池复用，子节点使用业务 key；长内容高度改变后定位仍正确", () => {
  const items = Array.from({ length: 12 }, (_, index) => ({ id: `order-${index}` }));
  const collection = hgCollection({ items, getKey: (item) => item.id, renderCell: (item) => item.id });
  collection.state.hgViewportHeight = 110;
  const offsets = hgCollectionOffsets(items, collection.props.getKey, collection.hgHeights);
  const first = collection.renderSlots(offsets);
  const poolSize = first.length;
  assert.ok(poolSize < items.length);
  assert.equal(first[0].key, "0");
  assert.equal(first[0].props.children.key, "order-0");

  collection.hgHeights.set("order-0", 410); // 子组件撑开的高度大于初始估算值。
  collection.state.hgScrollTop = 1000;
  const moved = collection.renderSlots(hgCollectionOffsets(items, collection.props.getKey, collection.hgHeights));
  assert.equal(moved[0].key, "0");
  assert.notEqual(moved[0].props.children.key, first[0].props.children.key);
  assert.ok(moved.length <= items.length);
});

test("触底只发起一次追加；顶部下拉阈值和加载中门闩避免重复刷新", () => {
  let loads = 0; // 本地请求计数，初始尚未加载更多。
  let refreshes = 0; // 本地刷新计数，初始尚未刷新。
  const collection = hgCollection({
    items: [{ id: "order-1" }], getKey: (item) => item.id, renderCell: () => null,
    hasMore: true, loading: false, onLoadMore: () => { loads += 1; },
    onRefresh: () => { refreshes += 1; },
  });
  collection.hgViewport.current = { scrollTop: 0, scrollHeight: 100, clientHeight: 520 };
  collection.hgCheckLoadMore();
  collection.hgCheckLoadMore();
  assert.equal(loads, 1);
  collection.hgOnTouchStart({ touches: [{ clientY: 100 }] });
  collection.hgOnTouchMove({ touches: [{ clientY: 180 }] });
  collection.hgOnTouchEnd();
  assert.equal(refreshes, 1);
  collection.props = { ...collection.props, loading: true };
  collection.hgOnTouchStart({ touches: [{ clientY: 100 }] });
  collection.hgOnTouchMove({ touches: [{ clientY: 200 }] });
  collection.hgOnTouchEnd();
  assert.equal(refreshes, 1);
  collection.props = { ...collection.props, loading: false };
  collection.hgOnTouchStart({ touches: [{ clientY: 100 }] });
  collection.hgOnTouchMove({ touches: [{ clientY: 200 }] });
  collection.hgOnTouchCancel();
  collection.hgOnTouchEnd();
  assert.equal(refreshes, 1);
});

test("上方 cell 内容增高时保持当前滚动锚点，重置时清除高度缓存", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const collection = hgCollection({ items, getKey: (item) => item.id, renderCell: () => null, resetKey: 1 });
  collection.hgViewport.current = { scrollTop: 320, clientWidth: 400, clientHeight: 520 };
  const slot = { dataset: { index: "0", key: "a" }, getBoundingClientRect: () => ({ height: 200 }) };
  collection.hgMeasureSlot(slot);
  assert.equal(collection.hgViewport.current.scrollTop, 364);
  assert.equal(collection.hgHeights.get("a"), 200);
  collection.props = { ...collection.props, resetKey: 2 };
  collection.componentDidUpdate({ ...collection.props, resetKey: 1 });
  assert.equal(collection.hgViewport.current.scrollTop, 0);
  assert.equal(collection.hgHeights.size, 0);
});

test("受控分页展示页码、每页条数及前后页；分页模式不触发原有触底加载", () => {
  const changes = []; // 模拟调用方接收分页事件，初始为空。
  let loads = 0; // 分页模式不应向旧的触底回调发起请求。
  const collection = hgCollection({
    items: [{ id: "a" }], getKey: (item) => item.id, renderCell: () => null,
    hasMore: true, loading: false, onLoadMore: () => { loads += 1; },
    pagination: { current: 1, pageSize: 20, loadedCount: 20, hasMore: true },
    onChange: (page) => changes.push(page),
  });
  collection.hgViewport.current = { scrollTop: 0, scrollHeight: 100, clientHeight: 520 };
  collection.hgCheckLoadMore();
  assert.equal(loads, 0);
  const pager = collection.renderPagination();
  const children = pager.props.children;
  const sizeSelect = children[1].props.children[1];
  sizeSelect.props.onChange({ target: { value: "50" } });
  children[3].at(-1).props.onClick(); // 点击服务端尚有更多数据对应的下一页页码。
  children[4].props.onClick();
  assert.deepEqual(changes.map((page) => ({ ...page })), [
    { current: 1, pageSize: 50 }, { current: 2, pageSize: 20 }, { current: 2, pageSize: 20 },
  ]);
  assert.equal(children[2].props.disabled, true); // 第一页无上一页。
});

test("切换展示页只回到滚动顶部，保留业务 key 对应的高度缓存", () => {
  const collection = hgCollection({
    items: [{ id: "a" }], getKey: (item) => item.id, renderCell: () => null,
    pageKey: 2, pagination: { current: 2, pageSize: 10, loadedCount: 20, hasMore: false },
  });
  collection.hgViewport.current = { scrollTop: 300, clientWidth: 400, clientHeight: 520 };
  collection.hgHeights.set("a", 260);
  collection.componentDidUpdate({ ...collection.props, pageKey: 1 });
  assert.equal(collection.hgViewport.current.scrollTop, 0);
  assert.equal(collection.hgHeights.get("a"), 260);
});

test("分页列表不显示刷新按钮，仍可在顶部下拉触发刷新", () => {
  let refreshes = 0; // 下拉回调次数，初始尚未刷新。
  const collection = hgCollection({
    items: [{ id: "a" }], getKey: (item) => item.id, renderCell: () => null,
    loading: false, pagination: { current: 1, pageSize: 20, loadedCount: 1, hasMore: false },
    onRefresh: () => { refreshes += 1; },
  });
  collection.hgViewport.current = { scrollTop: 0 };
  const children = collection.render().props.children;
  assert.equal(children[0].props.role, "list"); // 第一个节点直接是滚动区，不再有顶部按钮栏。
  assert.equal(children.at(-1).type, "nav"); // 分页栏仍保留。
  collection.hgOnTouchStart({ touches: [{ clientY: 100 }] });
  collection.hgOnTouchMove({ touches: [{ clientY: 175 }] });
  collection.hgOnTouchEnd();
  assert.equal(refreshes, 1);
});
