/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-30
 * @FilePath: /MLC_React/src/manager_antd/page_modules/user_space/hg_user_space_vm.jsx
 * @Description: 用户空间页面 ViewModel，管理用户数据、视频列表、标签页切换
 */

/**
 * 标签页配置
 * 职责：定义用户空间页的导航标签列表
 */
export const SPACE_TABS = [
  { key: "dynamic", label: "动态" },
  { key: "video", label: "投稿" },
  { key: "favorite", label: "收藏" },
  { key: "bangumi", label: "追番" },
  { key: "fans", label: "粉丝" },
  { key: "following", label: "关注" },
];

/**
 * 模拟用户数据
 */
const mockUser = {
  uid: "670364288",
  name: "Sharp锐评影社",
  avatar: "https://i2.hdslb.com/bfs/face/ba03740702a90df1be71dfc04c41136e82775bf3.jpg",
  cover: "https://i0.hdslb.com/bfs/new_dyn/a3b48a4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b.png",
  bio: "创作不易多多支持！拜谢拜谢！+V:xhc6433968",
  level: 6,
  following: 128,
  followers: 25600,
  plays: 1580000,
};

/**
 * 模拟视频列表数据
 */
const mockVideos = [
  {
    id: 1,
    title: "【锐评】2026年最值得看的电影推荐",
    cover: "https://picsum.photos/320/200?random=1",
    playCount: 125000,
    duration: 480,
    publishTime: "2026-05-20",
  },
  {
    id: 2,
    title: "漫威新片深度解析，彩蛋全收集",
    cover: "https://picsum.photos/320/200?random=2",
    playCount: 89000,
    duration: 720,
    publishTime: "2026-05-18",
  },
  {
    id: 3,
    title: "DC vs 漫威：谁才是真正的王者",
    cover: "https://picsum.photos/320/200?random=3",
    playCount: 210000,
    duration: 600,
    publishTime: "2026-05-15",
  },
  {
    id: 4,
    title: "本周票房排行榜出炉，第一名竟然是它",
    cover: "https://picsum.photos/320/200?random=4",
    playCount: 156000,
    duration: 360,
    publishTime: "2026-05-12",
  },
  {
    id: 5,
    title: "奥斯卡最佳影片回顾，经典永不过时",
    cover: "https://picsum.photos/320/200?random=5",
    playCount: 78000,
    duration: 900,
    publishTime: "2026-05-10",
  },
  {
    id: 6,
    title: "韩国电影为什么这么好看？深度分析",
    cover: "https://picsum.photos/320/200?random=6",
    playCount: 92000,
    duration: 540,
    publishTime: "2026-05-08",
  },
];

/**
 * 用户空间 ViewModel 类
 * 职责：管理用户数据、视频列表、标签页状态
 */
export default class HGUserSpaceVM {
  /**
   * 获取用户信息
   * 约束：对接真实 API 时替换本方法实现
   * @returns {Promise} 用户信息
   */
  static getUserInfo = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, data: { ...mockUser } });
      }, 300);
    });
  };

  /**
   * 获取用户视频列表
   * 约束：对接真实 API 时替换本方法实现
   * @returns {Promise} 视频列表
   */
  static getVideoList = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, data: [...mockVideos] });
      }, 300);
    });
  };

  /**
   * 关注用户
   * 约束：对接真实 API 时替换本方法实现
   * @returns {Promise} 关注结果
   */
  static followUser = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ code: 0, message: "关注成功" });
      }, 300);
    });
  };
}
