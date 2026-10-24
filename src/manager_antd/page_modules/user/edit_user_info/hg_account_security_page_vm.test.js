import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// VM 文件无 JSX，但浏览器模块依赖不能由 Node 直接导入；运行原类并用禁用网络的替身观察请求。
const hgSource = readFileSync(new URL("./hg_account_security_page_vm.jsx", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default class HGAccountSecurityPageVM", "class HGAccountSecurityPageVM");

test("账号安全手机号只在获得点选凭证后发送，邮箱仍使用原有入口", async () => {
  const hgCalls = [];
  const HGNet = {
    sendCode: async (params) => { hgCalls.push({ method: "sendCode", params }); return { message: "sent" }; },
    post: async (path, params) => { hgCalls.push({ method: "post", path, params }); return { message: "sent" }; },
  };
  const HGVM = runInNewContext(`${hgSource}\nHGAccountSecurityPageVM`, {
    HGNet, HGMANAGER_API: { SECURITY_CODE_API_PATH: "/api/v1/profile/security/send_code" },
  });

  await assert.rejects(HGVM.requestSecurityVerifyCode({ itemKey: "phone", targetValue: "13900000000" }), /请先完成点选验证码/);
  assert.equal(hgCalls.length, 0, "缺少点选凭证不得请求短信接口");

  await HGVM.requestSecurityVerifyCode({ itemKey: "phone", targetValue: "13900000000", verifyToken: "fixture-once" });
  assert.equal(hgCalls[0].method, "sendCode");
  assert.equal(hgCalls[0].params.phone, "13900000000");
  assert.equal(hgCalls[0].params.verifyToken, "fixture-once");

  await HGVM.requestSecurityVerifyCode({ itemKey: "email", targetValue: "fixture@example.test" });
  assert.equal(hgCalls[1].method, "post");
  assert.equal(hgCalls[1].path, "/api/v1/profile/security/send_code");
  assert.equal(hgCalls[1].params.target, "fixture@example.test");
});
