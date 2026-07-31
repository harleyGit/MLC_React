import assert from "node:assert/strict";
import test from "node:test";
import { getRequestErrorMessage } from "./hg_request_error.js";

test("getRequestErrorMessage surfaces backend business messages", () => {
  assert.equal(
    getRequestErrorMessage({ type: "BIZ_ERROR", message: "标签名称已存在" }, "更新失败"),
    "标签名称已存在"
  );
});

test("getRequestErrorMessage explains network failures", () => {
  assert.equal(
    getRequestErrorMessage(new TypeError("Failed to fetch"), "获取失败"),
    "网络连接失败，请检查网络或服务地址"
  );
});

test("getRequestErrorMessage falls back when no useful message exists", () => {
  assert.equal(getRequestErrorMessage({}, "删除失败"), "删除失败");
});
