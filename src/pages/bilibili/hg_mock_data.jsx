/**
 * B 站动画区 Mock 数据。
 * 职责：提供视频列表、分区标签等模拟数据，后期替换为接口。
 */

/**
 * 分区标签列表。
 */
export const DOUGA_TAGS = [
  "推荐",
  "MAD·AMV",
  "MMD·3D",
  "短片·手书",
  "配音·声优",
  "特摄",
  "综合",
];

/**
 * 视频封面占位图（使用 picsum.photos）。
 */
const covers = [
  "https://picsum.photos/seed/bili1/320/200",
  "https://picsum.photos/seed/bili2/320/200",
  "https://picsum.photos/seed/bili3/320/200",
  "https://picsum.photos/seed/bili4/320/200",
  "https://picsum.photos/seed/bili5/320/200",
  "https://picsum.photos/seed/bili6/320/200",
  "https://picsum.photos/seed/bili7/320/200",
  "https://picsum.photos/seed/bili8/320/200",
  "https://picsum.photos/seed/bili9/320/200",
  "https://picsum.photos/seed/bili10/320/200",
  "https://picsum.photos/seed/bili11/320/200",
  "https://picsum.photos/seed/bili12/320/200",
  "https://picsum.photos/seed/bili13/320/200",
  "https://picsum.photos/seed/bili14/320/200",
  "https://picsum.photos/seed/bili15/320/200",
  "https://picsum.photos/seed/bili16/320/200",
  "https://picsum.photos/seed/bili17/320/200",
  "https://picsum.photos/seed/bili18/320/200",
  "https://picsum.photos/seed/bili19/320/200",
  "https://picsum.photos/seed/bili20/320/200",
];

/**
 * 作者头像占位图。
 */
const avatars = [
  "https://picsum.photos/seed/avatar1/40/40",
  "https://picsum.photos/seed/avatar2/40/40",
  "https://picsum.photos/seed/avatar3/40/40",
  "https://picsum.photos/seed/avatar4/40/40",
  "https://picsum.photos/seed/avatar5/40/40",
  "https://picsum.photos/seed/avatar6/40/40",
  "https://picsum.photos/seed/avatar7/40/40",
  "https://picsum.photos/seed/avatar8/40/40",
];

/**
 * 生成 Mock 视频数据。
 * @param {string} tag - 分区标签。
 * @param {number} count - 数量。
 * @returns {Array} 视频列表。
 */
export function generateMockVideos(tag, count = 20) {
  const titles = {
    "推荐": [
      "【4K】原神4.5版本PV「敕诫枯木」",
      "当AI学会了画漫画，结果太震撼了！",
      "用100天时间，我做了一个游戏",
      "这个UP主用乐高搭了一个城市",
      "动漫混剪｜那些年的青春回忆",
      "日本街头美食，看饿了！",
      "手绘教程：如何画出好看的眼睛",
      "3D动画短片：太空冒险",
      "配音挑战：一人配10个角色",
      "特摄片幕后揭秘",
    ],
    "MAD·AMV": [
      "【鬼灭之刃】炭治郎的觉醒之路",
      "【咒术回战】五条悟战斗混剪",
      "【进击的巨人】最终季高燃剪辑",
      "【间谍过家家】阿尼亚可爱瞬间",
      "【电锯人】波奇塔的日常",
      "【我推的孩子】星野爱的舞台",
      "【葬送的芙莉莲】魔法之旅",
      "【迷宫饭】美食冒险",
      "【药屋少女】猫猫的推理",
      "【不死不幸】安迪与夕日",
    ],
    "MMD·3D": [
      "【MMD】初音未来 - グリッチ",
      "【3D】崩坏：星穹铁道角色展示",
      "【MMD】星之梦 - Luminescence",
      "【3D】原神角色舞蹈合集",
      "【MMD】Vocaloid经典曲目",
      "【3D】明日方舟干员动态",
      "【MMD】偶像大师舞台",
      "【3D】蔚蓝档案角色展示",
      "【MMD】虚拟歌姬演唱会",
      "【3D】碧蓝航线舰娘",
    ],
    "短片·手书": [
      "手书：如果动漫角色有了手机",
      "原创短片：最后的书店",
      "手书：当老师发现你在画画",
      "定格动画：橡皮泥大战",
      "手书：猫咪的一天",
      "原创动画：星际旅人",
      "手书：如果历史人物有朋友圈",
      "逐帧动画：水果忍者",
      "手书：打工人的日常",
      "短片：雨后彩虹",
    ],
    "配音·声优": [
      "一人配音挑战：10个经典角色",
      "日语配音教程：如何模仿动漫角色",
      "声优现场配音表演",
      "中文配音 vs 日语配音",
      "配音练习：情感表达",
      "声优访谈：幕后故事",
      "配音比赛精彩片段",
      "如何成为声优？入门指南",
      "经典角色配音对比",
      "配音设备推荐",
    ],
    "特摄": [
      "【假面骑士】最新形态展示",
      "【奥特曼】经典战斗回顾",
      "【超级战队】变身合集",
      "特摄片幕后制作揭秘",
      "【假面骑士】剧情解析",
      "【奥特曼】怪兽图鉴",
      "特摄影片推荐TOP10",
      "【超级战队】机甲合体",
      "特摄道具制作过程",
      "假面骑士 vs 奥特曼",
    ],
    "综合": [
      "动漫资讯：本月新番推荐",
      "漫画推荐：10部必看作品",
      "游戏改编动画盘点",
      "声优梗大集合",
      "动漫冷知识",
      "二次元美食还原",
      "动漫圣地巡礼",
      "周边开箱：手办展示",
      "动漫音乐推荐",
      "二次元文化科普",
    ],
  };

  const authors = [
    "动画疯子", "MAD大师", "3D建模师", "手书达人",
    "配音演员", "特摄迷", "二次元宅", "UP主小明",
    "动漫达人", "游戏主播", "绘画教程", "音乐制作人",
  ];

  const tagTitles = titles[tag] || titles["推荐"];
  const videos = [];

  for (let i = 0; i < count; i++) {
    const idx = i % tagTitles.length;
    const coverIdx = i % covers.length;
    const authorIdx = i % authors.length;
    const avatarIdx = i % avatars.length;

    videos.push({
      id: `${tag}-${i + 1}`,
      title: tagTitles[idx],
      cover: covers[coverIdx],
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: Math.floor(Math.random() * 600) + 30,
      play: Math.floor(Math.random() * 1000000) + 1000,
      danmaku: Math.floor(Math.random() * 10000) + 100,
      author: authors[authorIdx],
      authorAvatar: avatars[avatarIdx],
      authorFans: `${Math.floor(Math.random() * 100)}万`,
      pubDate: getRandomDate(),
      tag,
    });
  }

  return videos;
}

/**
 * 生成随机日期（最近30天内）。
 * @returns {string} ISO 日期字符串。
 */
function getRandomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

/**
 * 首页推荐视频（热门/排行）。
 */
export const HOT_VIDEOS = generateMockVideos("推荐", 12);

/**
 * 获取指定分区的视频列表。
 * @param {string} tag - 分区标签。
 * @returns {Array} 视频列表。
 */
export function getVideosByTag(tag) {
  return generateMockVideos(tag, 20);
}