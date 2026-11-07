/** IM 时间统一按浏览器本地日历展示，时间戳须为服务端返回的带时区 ISO 字符串。 */
const HG_WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function hgPad(hgNumber) {
  return String(hgNumber).padStart(2, "0");
}

function hgSameDay(hgLeft, hgRight) {
  return hgLeft.getFullYear() === hgRight.getFullYear() &&
    hgLeft.getMonth() === hgRight.getMonth() && hgLeft.getDate() === hgRight.getDate();
}

function hgCategory(hgDate, hgNow) {
  if (hgDate > hgNow) return "future";
  if (hgSameDay(hgDate, hgNow)) return "today";
  const hgYesterday = new Date(hgNow);
  hgYesterday.setDate(hgYesterday.getDate() - 1);
  if (hgSameDay(hgDate, hgYesterday)) return "yesterday";
  const hgMonday = new Date(hgNow);
  hgMonday.setHours(0, 0, 0, 0);
  hgMonday.setDate(hgMonday.getDate() - (hgMonday.getDay() + 6) % 7);
  if (hgDate >= hgMonday) return "week";
  return hgDate.getFullYear() === hgNow.getFullYear() ? "year" : "older";
}

function hgClock(hgDate) {
  return `${hgPad(hgDate.getHours())}:${hgPad(hgDate.getMinutes())}`;
}

/** 会话列表仅展示最近活动时间，日期比较基于设备本地时区。 */
export function hgFormatConversationTime(hgStamp, hgNow = new Date()) {
  const hgDate = new Date(hgStamp);
  if (Number.isNaN(hgDate.getTime())) return "";
  switch (hgCategory(hgDate, hgNow)) {
    case "today":
    case "future": return hgClock(hgDate);
    case "yesterday": return "昨天";
    case "week": return HG_WEEKDAYS[hgDate.getDay()];
    case "year": return `${hgPad(hgDate.getMonth() + 1)}/${hgPad(hgDate.getDate())}`;
    default: return `${hgDate.getFullYear()}/${hgPad(hgDate.getMonth() + 1)}/${hgPad(hgDate.getDate())}`;
  }
}

/** 聊天分隔线显示日期和具体时刻，不修改消息的服务端时间。 */
export function hgFormatMessageTime(hgStamp, hgNow = new Date()) {
  const hgDate = new Date(hgStamp);
  if (Number.isNaN(hgDate.getTime())) return "";
  const hgTime = hgClock(hgDate);
  switch (hgCategory(hgDate, hgNow)) {
    case "today":
    case "future": return hgTime;
    case "yesterday": return `昨天 ${hgTime}`;
    case "week": return `${HG_WEEKDAYS[hgDate.getDay()]} ${hgTime}`;
    case "year": return `${hgDate.getMonth() + 1}月${hgDate.getDate()}日 ${hgTime}`;
    default: return `${hgDate.getFullYear()}年${hgDate.getMonth() + 1}月${hgDate.getDate()}日 ${hgTime}`;
  }
}

/** 与紧邻的上一条消息比较实际时间差；跨本地日期即使不足五分钟也显示。 */
export function hgShouldShowTimeDivider(hgCurrentStamp, hgPreviousStamp, hgIntervalMinutes = 5) {
  const hgCurrent = new Date(hgCurrentStamp);
  if (Number.isNaN(hgCurrent.getTime())) return false;
  if (!hgPreviousStamp) return true;
  const hgPrevious = new Date(hgPreviousStamp);
  if (Number.isNaN(hgPrevious.getTime())) return false;
  return !hgSameDay(hgCurrent, hgPrevious) ||
    hgCurrent.getTime() - hgPrevious.getTime() >= hgIntervalMinutes * 60 * 1000;
}

/** 虚拟窗口从中间开始时仍以完整消息序列中的前驱决定是否显示时间。 */
export function hgMessageDividerAt(hgMessages, hgIndex) {
  const hgCurrent = hgMessages[hgIndex];
  const hgPrevious = hgMessages[hgIndex - 1];
  return hgShouldShowTimeDivider(hgCurrent?.sentAt || hgCurrent?.createdAt,
    hgPrevious?.sentAt || hgPrevious?.createdAt);
}
