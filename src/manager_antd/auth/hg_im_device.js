import HGIMAPI from "../net_handle/hg_im_api";
import { hgIMOwner, hgIMSession, hgIMSessionID } from "../storage/hg_im_session";

/** 只复用当前账号本标签页的完整凭据；不能凭设备 ID 推断归属。 */
function hgValidCredential(hgCredential) {
  return /^[a-f0-9]{32}$/.test(hgCredential?.deviceId) && /^[a-f0-9]{64}$/.test(hgCredential?.secret);
}

/** 登录后为当前标签页注册一次设备；已持有凭据时复用，不因页面跳转耗尽额度。 */
export async function hgRegisterIMDevice() {
  const hgOwner = hgIMOwner(); // JWT 所属用户；空值不发起注册请求。
  if (!hgOwner) throw new Error("登录用户身份无效");
  const hgSessionID = hgIMSessionID(); // 同账号重新登录时 sid 会更新，旧凭据不能跨会话复用。
  const hgPrevious = hgIMSession(hgOwner, undefined, true); // 仅此处读取旧会话秘密用于撤销。
  const hgStored = hgPrevious.credential; // 只读取本账号当前标签页的秘密。
  const hgStoredSessionID = hgPrevious.sessionID; // 空值表示旧版设备，没有可验证的会话归属。
  if (hgValidCredential(hgStored) && hgStoredSessionID === hgSessionID && hgSessionID) return hgStored;
  if (hgValidCredential(hgStored)) await hgRevokeIMDevice(true); // 先撤销本标签页旧设备，失败则不额外占用名额。
  const hgCredential = await new HGIMAPI(new AbortController().signal).hgRegister();
  if (!hgValidCredential(hgCredential) || hgIMOwner() !== hgOwner || hgIMSessionID() !== hgSessionID) throw new Error("设备注册响应或账号状态已变化");
  hgIMSession(hgOwner, { credential: hgCredential, sessionID: hgSessionID });
  return hgCredential;
}

/** 登出前撤销本标签页已知设备；失败向上传递，不假装服务端已释放额度。 */
export async function hgRevokeIMDevice(hgIncludePrevious = false) {
  const hgOwner = hgIMOwner(); // JWT 所属用户；不使用客户端自报用户 ID。
  if (!hgOwner) return;
  const hgCredential = hgIMSession(hgOwner, undefined, hgIncludePrevious).credential; // 默认不撤销其他会话设备。
  if (!hgValidCredential(hgCredential)) return;
  await new HGIMAPI(new AbortController().signal).hgRevoke(hgCredential);
  if (hgIMOwner() === hgOwner) hgIMSession(hgOwner, { credential: null, sessionID: "", callId: "" });
}
