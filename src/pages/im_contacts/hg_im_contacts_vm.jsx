/* 联系人 ViewModel：仅通过共享签名/JWT 请求链访问 Go 权威数据，不在本地模拟成功写入。 */
import HGNetManager from "../../api/hg_net_manager";

const hgNet = new HGNetManager(); // 共享请求封装，自动处理 Bearer JWT、公共头、签名与超时。
const hgBase = "/api/v1/im/contacts"; // 与 Go IM 路由目录一致的版本化联系人前缀。
const hgPalette = ["#07c160", "#1296db", "#f5a623", "#e6642e", "#8c6fe6", "#2f9e8f", "#d4567a", "#5a8fd6"]; // 稳定头像色板。
const hgCollator = new Intl.Collator("zh-CN-u-co-pinyin"); // 本地拼音排序，不修改服务器资料。
const hgPinyinBoundaries = [
  ["阿", "A"], ["八", "B"], ["擦", "C"], ["搭", "D"], ["蛾", "E"],
  ["发", "F"], ["噶", "G"], ["哈", "H"], ["击", "J"], ["喀", "K"],
  ["垃", "L"], ["妈", "M"], ["拿", "N"], ["哦", "O"], ["啪", "P"],
  ["期", "Q"], ["然", "R"], ["撒", "S"], ["塌", "T"], ["挖", "W"],
  ["夕", "X"], ["丫", "Y"], ["匝", "Z"],
]; // 汉字拼音区间下界；浏览器不提供汉字转拼音 API，少见多音字需后续权威拼音索引。

/** 联系人视图模型：ID、昵称、单向备注均直接保留服务端返回值。 */
export default class HGImContactsVM {
  /** 获取当前用户的好友、待办和主动黑名单；任一失败向页面传播，不显示虚假空列表。 */
  static async fetchContacts() {
    const [friends, requests, blocked] = await Promise.all([
      hgNet.get(`${hgBase}/friends`),
      hgNet.get(`${hgBase}/requests/incoming`),
      hgNet.get(`${hgBase}/blocks`),
    ]);
    return { friends: friends.list, requests: requests.list, blocked: blocked.list, groups: [] };
  }

  /** 接受申请后从服务器读取真实好友资料；不依据申请资料伪造已建立关系。 */
  static async acceptFriendRequest(request) {
    const accepted = await hgNet.post(`${hgBase}/requests/accept`, { requestId: request.requestId });
    try {
      const data = await hgNet.get(`${hgBase}/friends`);
      return data.list.find((item) => item.userId === request.userId) || { ...accepted, remark: "", tags: [], phone: "", description: "" };
    } catch {
      return { ...accepted, remark: "", tags: [], phone: "", description: "" };
    }
  }

  static rejectFriendRequest(request) { return hgNet.post(`${hgBase}/requests/reject`, { requestId: request.requestId }); }
  static saveFriendProfile(userId, patch) { return hgNet.post(`${hgBase}/friends/edit`, { userId, ...patch }); }
  static deleteFriend(userId) { return hgNet.post(`${hgBase}/friends/remove`, { userId }); }
  static blockFriend(userId) { return hgNet.post(`${hgBase}/blocks/add`, { userId }); }
  static unblockFriend(userId) { return hgNet.post(`${hgBase}/blocks/remove`, { userId }); }
  static fetchBlocked() { return hgNet.get(`${hgBase}/blocks`).then((data) => data.list); }
  static fetchFriends() { return hgNet.get(`${hgBase}/friends`).then((data) => data.list); }
  /** 按公开系统 ID 或自定义 ID 精确搜索；不开放手机号/邮箱枚举。 */
  static searchUser(type, keyword) { return hgNet.post(`${hgBase}/search`, { type, keyword }); }
  /** 申请发送后仍非好友，必须等待对方接受。 */
  static sendFriendRequest(targetUserId, message) { return hgNet.post(`${hgBase}/requests`, { targetUserId, message }); }

  static getAvatarColor(seed) {
    const text = String(seed || ""); // 稳定取色标识；空 ID 使用首个颜色。
    let hash = 0; // 头像色板索引的滚动哈希，不用作安全标识。
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 100000;
    return hgPalette[hash % hgPalette.length];
  }

  static getDisplayName(contact) { return contact?.remark || contact?.nickname || contact?.groupName || contact?.publicId || ""; }
  static getAvatarText(contact) { return HGImContactsVM.getDisplayName(contact).charAt(0) || "?"; }

  /** 采用浏览器中文拼音排序规则按首字符分组；无法识别的字符归 #。 */
  static getFriendInitial(friend) {
    const first = HGImContactsVM.getDisplayName(friend).charAt(0); // 单向备注优先，空名归 #。
    if (/^[a-z]$/i.test(first)) return first.toUpperCase();
    if (/^[\u3400-\u9fff]$/.test(first)) {
      for (let index = hgPinyinBoundaries.length - 1; index >= 0; index -= 1) {
        const [boundary, letter] = hgPinyinBoundaries[index]; // 当前拼音区间的中文下界及索引字母。
        if (hgCollator.compare(first, boundary) >= 0) return letter;
      }
    }
    return "#";
  }

  static groupFriendsByLetter(friends) {
    const groups = new Map(); // 按备注优先的首字母汇总，避免修改原列表。
    friends.forEach((friend) => {
      const letter = HGImContactsVM.getFriendInitial(friend); // 当前联系人的拼音首字母。
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(friend);
    });
    return Array.from(groups, ([letter, items]) => ({
      letter, items: items.sort((a, b) => hgCollator.compare(HGImContactsVM.getDisplayName(a), HGImContactsVM.getDisplayName(b))),
    })).sort((a, b) => a.letter === "#" ? 1 : b.letter === "#" ? -1 : a.letter.localeCompare(b.letter));
  }

  static matchKeyword(contact, keyword) {
    const text = String(keyword || "").trim().toLowerCase(); // 搜索词只作用于本次已授权取得的列表。
    return !text || [contact.remark, contact.nickname, contact.username, contact.publicId, contact.groupName, contact.groupId]
      .some((value) => String(value || "").toLowerCase().includes(text));
  }
}
