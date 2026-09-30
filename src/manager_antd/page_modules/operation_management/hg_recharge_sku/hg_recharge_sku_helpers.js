/** 金额及币数仅在安全整数范围内转为 JSON number，中间计算全部使用 BigInt。 */
const HG_MAX_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

export const HG_RECHARGE_PERMISSIONS = Object.freeze({
  READ: "payment.recharge_sku.read",
  WRITE: "payment.recharge_sku.write",
});

/** 新建不预设兑换比例，startTime 留空交给服务端使用当前时间。 */
export const HG_EMPTY_SKU_FORM = Object.freeze({
  skuCode: "", title: "", amountYuan: "", coinAmount: "", bonusCoin: "0",
  status: "1", sortOrder: "0", startTime: "", endTime: "",
});

/** 元字符串精确转分，禁止指数、符号、小数截断和浮点乘算。 */
export function hgYuanToFen(value) {
  const hgText = String(value ?? "").trim();
  if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(hgText)) throw new Error("金额请输入正数，最多两位小数");
  const [hgYuan, hgFraction = ""] = hgText.split(".");
  const hgFen = BigInt(hgYuan) * 100n + BigInt(hgFraction.padEnd(2, "0"));
  if (hgFen <= 0n || hgFen > HG_MAX_INTEGER) throw new Error("金额须为 0.01 至 90071992547409.91 元");
  return Number(hgFen);
}

/** 分转元用于列表及编辑回填，不经浮点除法丢失末位。 */
export function hgFenToYuan(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("服务端金额不是正安全整数");
  const hgFen = BigInt(value);
  return `${hgFen / 100n}.${String(hgFen % 100n).padStart(2, "0")}`;
}

/** 整数字段接受十进制文本，不把空值、指数或负值强制转换为有效输入。 */
function hgSafeInteger(value, label, minimum = 0) {
  const hgText = String(value ?? "").trim();
  if (!/^\d{1,16}$/.test(hgText)) throw new Error(`${label}须为${minimum ? "正" : "非负"}整数`);
  const hgValue = BigInt(hgText);
  if (hgValue < BigInt(minimum) || hgValue > HG_MAX_INTEGER) throw new Error(`${label}超出安全整数范围`);
  return Number(hgValue);
}

/** 校验 RFC3339 及真实日历日期，原样保留时区和小数秒以免编辑损失精度。 */
function hgValidateTime(value, label) {
  const hgText = String(value ?? "").trim();
  if (!hgText) return "";
  const hgMatch = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(hgText);
  if (!hgMatch) throw new Error(`${label}须为 RFC3339，例如 2026-10-01T00:00:00+08:00`);
  const hgYear = Number(hgMatch[1]);
  const hgMonth = Number(hgMatch[2]);
  const hgDay = Number(hgMatch[3]);
  const hgLeap = hgYear % 4 === 0 && (hgYear % 100 !== 0 || hgYear % 400 === 0);
  const hgDays = [31, hgLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (hgMonth < 1 || hgMonth > 12 || hgDay < 1 || hgDay > hgDays[hgMonth - 1] || !Number.isFinite(Date.parse(hgText))) {
    throw new Error(`${label}不是有效日期`);
  }
  return hgText;
}

/** 编辑和删除必须携带读取时的版本；不会用新版本自动覆盖旧记录。 */
export function hgSkuIdentity(record) {
  if (typeof record?.skuId !== "string" || !record.skuId.trim()) throw new Error("缺少档位 ID，请刷新列表");
  if (!Number.isSafeInteger(record.version) || record.version < 1) throw new Error("档位版本无效，请刷新列表");
  return { skuId: record.skuId, version: record.version };
}

/** 白名单构造创建/更新协议；currency 由服务端固定为 CNY，totalCoin 由服务端计算，均不得提交。 */
export function hgBuildSkuRequest(form, record = null) {
  const hgCode = String(form.skuCode ?? "").trim();
  const hgTitle = String(form.title ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(hgCode)) throw new Error("SKU code 必填，限 64 位 ASCII 字母、数字、下划线或横线");
  if (!hgTitle) throw new Error("标题不能为空");
  if ([...hgTitle].length > 128) throw new Error("标题不能超过 128 个字符");
  // 后端排序字段为 int32，不使用金额/币数的安全整数上限。
  const hgSortOrder = hgSafeInteger(form.sortOrder, "排序值");
  if (hgSortOrder > 2147483647) throw new Error("排序值不能超过 2147483647");
  const hgCoin = hgSafeInteger(form.coinAmount, "基础币", 1);
  const hgBonus = hgSafeInteger(form.bonusCoin, "赠币");
  if (BigInt(hgCoin) + BigInt(hgBonus) > HG_MAX_INTEGER) throw new Error("基础币与赠币之和超出安全整数范围");
  if (!["0", "1"].includes(String(form.status))) throw new Error("状态只能为停用或启用");
  const hgStart = hgValidateTime(form.startTime, "开始时间");
  const hgEnd = hgValidateTime(form.endTime, "结束时间");
  if (hgStart && hgEnd && Date.parse(hgEnd) <= Date.parse(hgStart)) throw new Error("结束时间须晚于开始时间");
  return {
    ...(record ? hgSkuIdentity(record) : {}),
    skuCode: hgCode, title: hgTitle, payAmount: hgYuanToFen(form.amountYuan),
    coinAmount: hgCoin, bonusCoin: hgBonus, status: Number(form.status),
    sortOrder: hgSortOrder,
    ...(hgStart ? { startTime: hgStart } : {}), endTime: hgEnd,
  };
}

/** 回填保留协议时间字符串，金额以元展示，币数仍为独立字段。 */
export function hgSkuToForm(record) {
  hgSkuIdentity(record);
  return {
    skuCode: record.skuCode, title: record.title, amountYuan: hgFenToYuan(record.payAmount),
    coinAmount: String(record.coinAmount), bonusCoin: String(record.bonusCoin),
    status: String(record.status), sortOrder: String(record.sortOrder),
    startTime: record.startTime || "", endTime: record.endTime || "",
  };
}

/** 列表结构异常必须报错，不能把协议错误伪装成空列表。 */
export function hgValidateSkuList(data) {
  if (!Array.isArray(data?.list) || data.list.length > 20 || typeof data.hasMore !== "boolean"
    || typeof data.nextCursor !== "string" || (data.hasMore && !data.nextCursor)) {
    throw new Error("充值档位列表响应格式错误，请联系管理员");
  }
  for (const hgRow of data.list) {
    hgSkuIdentity(hgRow);
    hgFenToYuan(hgRow.payAmount);
    if (hgRow.currency !== "CNY") throw new Error("充值档位币种不是 CNY");
  }
  return data;
}
