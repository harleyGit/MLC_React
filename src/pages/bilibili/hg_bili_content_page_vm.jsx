import { generateMockVideos, HOT_VIDEOS } from "./hg_mock_data";

/**
 * 首页频道导航配置。
 * 左侧入口使用图片，中间和右侧入口使用文字按钮，保持与 B 站首页相近的信息层级。
 */
const BILI_CHANNEL_NAV = {
  featured: [
    {
      key: "dynamic",
      label: "动态",
      image: "https://picsum.photos/seed/bili-dynamic/96/96",
    },
    {
      key: "popular",
      label: "热门",
      image: "https://picsum.photos/seed/bili-popular/96/96",
    },
  ],
  primary: [
    { key: "bangumi", label: "番剧" },
    { key: "guochuang", label: "国创" },
    { key: "variety", label: "综艺" },
    { key: "douga", label: "动画" },
    { key: "kichiku", label: "鬼畜" },
    { key: "dance", label: "舞蹈" },
    { key: "ent", label: "娱乐" },
    { key: "movie", label: "电影" },
    { key: "tv", label: "电视剧" },
    { key: "documentary", label: "纪录片" },
    { key: "game", label: "游戏" },
    { key: "music", label: "音乐" },
    { key: "food", label: "美食" },
    { key: "knowledge", label: "知识" },
    { key: "information", label: "资讯" },
    { key: "life", label: "生活" },
  ],
  secondary: [
    { key: "column", label: "专栏", icon: "▤" },
    { key: "activity", label: "活动", icon: "旗" },
    { key: "community", label: "社区中心", icon: "◆" },
    { key: "live", label: "直播", icon: "◉" },
    { key: "class", label: "课堂", icon: "▣" },
    { key: "new-song", label: "新歌热榜", icon: "♫" },
  ],
};

/**
 * 内容页 VM，集中处理频道元数据和播放页回退数据。
 */
class HGBiliContentPageVM {
  /** 首页频道导航配置。 */
  static CHANNEL_NAV = BILI_CHANNEL_NAV;

  /**
   * 查找频道配置，未知频道使用推荐兜底。
   * @param {string} channelKey 频道标识。
   * @returns {{key: string, label: string}} 频道配置。
   */
  static getChannel(channelKey) {
    const channels = [
      ...BILI_CHANNEL_NAV.featured,
      ...BILI_CHANNEL_NAV.primary,
      ...BILI_CHANNEL_NAV.secondary,
    ];
    return channels.find((item) => item.key === channelKey) || {
      key: channelKey,
      label: channelKey,
    };
  }

  /**
   * 为频道生成默认推荐视频，确保导航目标页在接口不可用时仍可浏览和播放。
   * @param {string} channelKey 频道标识。
   * @returns {Array<Object>} 视频列表。
   */
  static getChannelVideos(channelKey) {
    const channel = this.getChannel(channelKey);
    return generateMockVideos("推荐", 20).map((video, index) => ({
      ...video,
      id: `${channel.key}-${index + 1}`,
      title: `【${channel.label}】${video.title}`,
      tag: channel.label,
    }));
  }

  /**
   * 获取播放器当前视频，优先使用路由 state，刷新丢失 state 时回退到本地推荐。
   * @param {string} videoId 视频标识。
   * @param {Object|null} routeVideo 路由携带的视频对象。
   * @returns {Object} 可播放视频。
   */
  static getVideo(videoId, routeVideo) {
    if (routeVideo) return routeVideo;
    return HOT_VIDEOS.find((item) => String(item.id) === String(videoId)) || HOT_VIDEOS[0];
  }

  /**
   * 获取相关推荐并排除当前视频。
   * @param {Object} currentVideo 当前播放视频。
   * @returns {Array<Object>} 相关推荐。
   */
  static getRelatedVideos(currentVideo) {
    return generateMockVideos(currentVideo?.tag || "推荐", 8).filter(
      (item) => item.id !== currentVideo?.id
    );
  }
}

export default HGBiliContentPageVM;
