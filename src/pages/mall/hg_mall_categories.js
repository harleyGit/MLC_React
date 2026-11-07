/*
 * @Description: 商城类目白名单；目录筛选、发布表单与详情共用，避免多处硬编码漂移。
 */

/** 与 Go 服务端类目白名单对齐；空字符串代表全部类目，仅用于目录筛选，发布表单须过滤掉。 */
export const HG_MALL_CATEGORIES = [
  ["", "全部商品"],
  ["digital", "数码影音"],
  ["appliance", "家用电器"],
  ["clothing", "服饰"],
  ["beauty", "美妆个护"],
  ["membership", "会员"],
];
