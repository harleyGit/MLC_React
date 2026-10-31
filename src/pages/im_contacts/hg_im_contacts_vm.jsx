/*
 * @Description: 联系人 ViewModel，参照 Go IM 设计文档维护联系人、群组、好友申请与黑名单的数据结构与展示规则。
 * 约束：Go 后端联系人接口（/api/im/contacts/*）尚未落地，先以本地模拟数据 + 异步延迟模拟请求链路；
 *       接口对齐后仅需替换 fetchContacts / acceptFriendRequest 等异步方法实现，页面渲染逻辑不变。
 * 关键业务规则（来自设计文档，前端展示需遵守）：
 *       好友申请需对方接受后才建立好友关系；好友备注单向保存；删除好友保留历史但禁止单聊；黑名单有方向。
 */

/** 头像底色候选（按标识哈希取色，保证同一人颜色稳定）。 */
const AVATAR_COLOR_PALETTE = [
  "#07c160",
  "#1296db",
  "#f5a623",
  "#e6642e",
  "#8c6fe6",
  "#2f9e8f",
  "#d4567a",
  "#5a8fd6",
];

/** 模拟联系人姓名首字到拼音首字母的映射，仅覆盖内置 mock 数据用字；未命中归入「#」分组。 */
const PINYIN_INITIAL_MAP = {
  陈: "C",
  高: "G",
  黄: "H",
  何: "H",
  李: "L",
  林: "L",
  刘: "L",
  马: "M",
  宋: "S",
  孙: "S",
  王: "W",
  吴: "W",
  徐: "X",
  杨: "Y",
  于: "Y",
  张: "Z",
  赵: "Z",
  郑: "Z",
  周: "Z",
};

/** 我的好友模拟数据，字段对齐设计文档中好友资料（publicId/username/remark 等）。 */
const MOCK_FRIENDS = [
  {
    userId: "100001",
    publicId: "U202610310001",
    username: "zhangwei888",
    nickname: "张伟",
    remark: "项目经理",
    region: "广东 深圳",
    signature: "把每一件事做到有始有终。",
    source: "通过搜索自定义 ID 添加",
    phone: "138****8888",
    email: "zhangwei@example.com",
    tags: ["工作", "重点"],
    description: "",
    starred: true,
    friendSince: "2025-03-12",
  },
  {
    userId: "100002",
    publicId: "U202610310002",
    username: "wangqiang_go",
    nickname: "王强",
    remark: "后端负责人",
    region: "北京 朝阳",
    signature: "Gopher，热爱高并发。",
    source: "通过群聊添加",
    phone: "139****2266",
    email: "wangqiang@example.com",
    tags: ["工作", "Go"],
    description: "负责网关与消息服务。",
    starred: false,
    friendSince: "2025-04-02",
  },
  {
    userId: "100003",
    publicId: "U202610310003",
    username: "zhaolei_fe",
    nickname: "赵磊",
    remark: "前端同事",
    region: "广东 广州",
    signature: "CSS 才是第一生产力。",
    source: "通过搜索手机号添加",
    phone: "137****9081",
    email: "",
    tags: ["工作", "前端"],
    description: "",
    starred: false,
    friendSince: "2025-05-20",
  },
  {
    userId: "100004",
    publicId: "U202610310004",
    username: "chenchen_hz",
    nickname: "陈晨",
    remark: "老同学",
    region: "浙江 杭州",
    signature: "跑步、爬山、晒太阳。",
    source: "通过搜索手机号添加",
    phone: "",
    email: "chenchen@example.com",
    tags: ["同学"],
    description: "",
    starred: false,
    friendSince: "2024-11-08",
  },
  {
    userId: "100005",
    publicId: "U202610310005",
    username: "linna_dev",
    nickname: "李娜",
    remark: "",
    region: "上海 浦东",
    signature: "Kubernetes 铁粉。",
    source: "通过群聊添加",
    phone: "",
    email: "",
    tags: ["Go"],
    description: "",
    starred: false,
    friendSince: "2026-01-15",
  },
  {
    userId: "100006",
    publicId: "U202610310006",
    username: "liuyang77",
    nickname: "刘洋",
    remark: "",
    region: "四川 成都",
    signature: "火锅与代码不可辜负。",
    source: "对方通过手机号添加我",
    phone: "186****3307",
    email: "",
    tags: [],
    description: "",
    starred: false,
    friendSince: "2026-02-27",
  },
  {
    userId: "100007",
    publicId: "U202610310007",
    username: "sunyue",
    nickname: "孙悦",
    remark: "",
    region: "湖北 武汉",
    signature: "产品让世界更简单。",
    source: "通过搜索系统 ID 添加",
    phone: "",
    email: "sunyue@example.com",
    tags: ["产品"],
    description: "",
    starred: false,
    friendSince: "2026-03-09",
  },
  {
    userId: "100008",
    publicId: "U202610310008",
    username: "zhoujie_kafka",
    nickname: "周杰",
    remark: "Kafka 群友",
    region: "江苏 南京",
    signature: "消息不丢不重，是种修行。",
    source: "通过群聊添加",
    phone: "",
    email: "",
    tags: ["技术群友"],
    description: "",
    starred: false,
    friendSince: "2026-05-18",
  },
  {
    userId: "100009",
    publicId: "U202610310009",
    username: "wumin_hr",
    nickname: "吴敏",
    remark: "HR 吴姐",
    region: "广东 深圳",
    signature: "招人是缘分，留人是本事。",
    source: "通过搜索手机号添加",
    phone: "158****6612",
    email: "",
    tags: ["人事"],
    description: "",
    starred: false,
    friendSince: "2026-06-30",
  },
  {
    userId: "100010",
    publicId: "U202610310010",
    username: "zhengkai_ops",
    nickname: "郑凯",
    remark: "",
    region: "广东 广州",
    signature: "凌晨三点的告警最提神。",
    source: "通过群聊添加",
    phone: "",
    email: "",
    tags: ["运维"],
    description: "",
    starred: false,
    friendSince: "2026-07-21",
  },
  {
    userId: "100011",
    publicId: "U202610310011",
    username: "huangbw_test",
    nickname: "黄博文",
    remark: "测试同事",
    region: "湖南 长沙",
    signature: "Bug 猎人，专治不服。",
    source: "通过搜索自定义 ID 添加",
    phone: "177****4520",
    email: "",
    tags: ["工作", "测试"],
    description: "",
    starred: false,
    friendSince: "2026-08-12",
  },
  {
    userId: "100012",
    publicId: "U202610310012",
    username: "gaoxiang",
    nickname: "高翔",
    remark: "",
    region: "山东 青岛",
    signature: "面朝大海，写代码。",
    source: "对方通过系统 ID 添加我",
    phone: "",
    email: "gaoxiang@example.com",
    tags: [],
    description: "",
    starred: false,
    friendSince: "2026-09-03",
  },
];

/** 我的群组模拟数据，群成员之间不要求互为好友（群组规则独立于好友关系）。 */
const MOCK_GROUPS = [
  {
    groupId: "G202610310001",
    groupName: "Go 技术交流群",
    ownerNickname: "张伟",
    memberCount: 128,
    announcement: "每周四晚 8 点线上技术分享，欢迎在群里报名主题。",
    members: ["张伟", "李娜", "王强", "陈晨", "刘洋", "赵磊"],
  },
  {
    groupId: "G202610310002",
    groupName: "MLC 前端小组",
    ownerNickname: "赵磊",
    memberCount: 12,
    announcement: "React 19 升级排期已同步至共享文档，请按节点回归。",
    members: ["赵磊", "张伟", "黄博文", "高翔"],
  },
  {
    groupId: "G202610310003",
    groupName: "周末羽毛球群",
    ownerNickname: "陈晨",
    memberCount: 36,
    announcement: "每周六上午 9 点，朝阳体育馆 3 号场地，缺席提前一天请假。",
    members: ["陈晨", "孙悦", "刘洋", "郑凯"],
  },
];

/** 收到的好友申请模拟数据（incoming_pending），接受后由页面转入好友列表。 */
const MOCK_FRIEND_REQUESTS = [
  {
    requestId: "FR202611010001",
    userId: "100021",
    publicId: "U202610310021",
    username: "xulei_ops",
    nickname: "徐磊",
    region: "广东 深圳",
    message: "你好，我是运维组的徐磊，通过手机号搜索到你，加个好友方便值班联系。",
    createdAt: "2026-10-31 20:14",
  },
  {
    requestId: "FR202611010002",
    userId: "100022",
    publicId: "U202610310022",
    username: "hejing_kafka",
    nickname: "何静",
    region: "上海 徐汇",
    message: "我们在同一个 Kafka 技术群，看到你分享的实践帖，多多交流～",
    createdAt: "2026-10-31 09:41",
  },
];

/** 黑名单模拟数据，黑名单有方向（blocker → blocked），仅展示我拉黑的联系人。 */
const MOCK_BLOCKED = [
  {
    userId: "100031",
    publicId: "U202610310031",
    username: "songxm_ad",
    nickname: "宋小明",
    remark: "",
    region: "未知",
    signature: "",
    blockNote: "频繁发送广告与拉群邀请",
    blockedAt: "2026-09-28",
  },
];

/** 深拷贝工具：模拟接口返回独立数据副本，避免页面状态直接引用常量造成污染。 */
const deepClone = (value) => JSON.parse(JSON.stringify(value));

/** 延迟工具：模拟网络耗时，让加载态可见。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 联系人 ViewModel。
 * 职责：提供联系人模块的模拟数据源、列表分组、搜索过滤与头像展示规则。
 * 约束：所有异步方法均为前端模拟实现，替换为真实接口时保持返回结构不变即可。
 */
export default class HGImContactsVM {
  /**
   * 拉取联系人模块全量数据（好友、群组、好友申请、黑名单）。
   * @returns {Promise<{friends: Array, groups: Array, requests: Array, blocked: Array}>} 各列表的深拷贝数据。
   */
  static async fetchContacts() {
    await sleep(300);
    return {
      friends: deepClone(MOCK_FRIENDS),
      groups: deepClone(MOCK_GROUPS),
      requests: deepClone(MOCK_FRIEND_REQUESTS),
      blocked: deepClone(MOCK_BLOCKED),
    };
  }

  /**
   * 接受好友申请：模拟服务端将申请置为 accepted 并返回新好友资料。
   * @param {Object} request 好友申请对象。
   * @returns {Promise<Object>} 建立好友关系后的好友资料。
   */
  static async acceptFriendRequest(request) {
    await sleep(220);
    return {
      userId: request.userId,
      publicId: request.publicId,
      username: request.username,
      nickname: request.nickname,
      remark: "",
      region: request.region || "未知",
      signature: "这个人很懒，什么都没有写。",
      source: "来自好友申请",
      phone: "",
      email: "",
      tags: [],
      description: "",
      starred: false,
      friendSince: "2026-11-01",
    };
  }

  /**
   * 保存好友资料修改（备注、标签、电话、描述等）。
   * @param {string} userId 好友用户 ID。
   * @param {Object} patch 待更新的字段集合。
   * @returns {Promise<Object>} 更新后的字段集合。
   */
  static async saveFriendProfile(userId, patch) {
    await sleep(220);
    return { userId, ...deepClone(patch) };
  }

  /**
   * 计算头像底色：按标识字符串哈希从候选色板取色，保证同一联系人颜色稳定。
   * @param {string} seed 头像取色标识（优先用户 ID）。
   * @returns {string} 十六进制色值。
   */
  static getAvatarColor(seed) {
    const text = String(seed || "");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return AVATAR_COLOR_PALETTE[hash % AVATAR_COLOR_PALETTE.length];
  }

  /**
   * 获取联系人展示名：备注优先于昵称，群组使用群名称。
   * @param {Object} contact 联系人或群组对象。
   * @returns {string} 展示名。
   */
  static getDisplayName(contact) {
    if (!contact) return "";
    return contact.remark || contact.nickname || contact.groupName || "";
  }

  /**
   * 获取头像文字：展示名首字符。
   * @param {Object} contact 联系人或群组对象。
   * @returns {string} 头像文字。
   */
  static getAvatarText(contact) {
    return HGImContactsVM.getDisplayName(contact).charAt(0) || "?";
  }

  /**
   * 计算好友在字母分组的索引（模拟拼音首字母），非字母字符归入「#」。
   * @param {Object} friend 好友对象。
   * @returns {string} 分组字母（大写）或「#」。
   */
  static getFriendInitial(friend) {
    const name = friend.remark || friend.nickname || "";
    const first = name.charAt(0);
    if (PINYIN_INITIAL_MAP[first]) return PINYIN_INITIAL_MAP[first];
    if (/[a-zA-Z]/.test(first)) return first.toUpperCase();
    return "#";
  }

  /**
   * 将好友列表按字母分组并排序，用于通讯录字母索引展示。
   * @param {Array} friends 好友列表。
   * @returns {Array<{letter: string, items: Array}>} 分组结果，字母升序、「#」置于末尾。
   */
  static groupFriendsByLetter(friends) {
    const groupMap = new Map();
    friends.forEach((friend) => {
      const letter = HGImContactsVM.getFriendInitial(friend);
      if (!groupMap.has(letter)) groupMap.set(letter, []);
      groupMap.get(letter).push(friend);
    });
    return Array.from(groupMap.entries())
      .map(([letter, items]) => ({ letter, items }))
      .sort((a, b) => {
        if (a.letter === "#") return 1;
        if (b.letter === "#") return -1;
        return a.letter.localeCompare(b.letter);
      });
  }

  /**
   * 关键字匹配：按展示名、昵称、自定义 ID、公开 ID 模糊过滤。
   * @param {Object} contact 联系人或群组对象。
   * @param {string} keyword 搜索关键字。
   * @returns {boolean} 是否命中。
   */
  static matchKeyword(contact, keyword) {
    const text = String(keyword || "").trim().toLowerCase();
    if (!text) return true;
    const fields = [
      contact.remark,
      contact.nickname,
      contact.username,
      contact.publicId,
      contact.groupName,
      contact.groupId,
    ];
    return fields.some((field) => String(field || "").toLowerCase().includes(text));
  }
}
