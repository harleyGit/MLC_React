import assert from "node:assert/strict";
import test from "node:test";
import { joinApiURL } from "./hg_api_url.js";

test("joinApiURL avoids duplicating a terminal api path segment", () => {
  assert.equal(
    joinApiURL("https://example.com/api/", "/api/v1/ops/bilibili/tags/list"),
    "https://example.com/api/v1/ops/bilibili/tags/list"
  );
});

test("joinApiURL preserves deployment path prefixes", () => {
  assert.equal(
    joinApiURL("https://example.com/gateway/api", "/api/v1/profile/info"),
    "https://example.com/gateway/api/v1/profile/info"
  );
});

test("joinApiURL keeps relative development requests unchanged", () => {
  assert.equal(joinApiURL("", "/api/v1/auth/login"), "/api/v1/auth/login");
});
