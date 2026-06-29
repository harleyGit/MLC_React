/*
 * @Author: huanggang
 * @Date: 2025-10-10 11:43:42
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2026-06-26 18:38:38
 * @FilePath: /app-web/imi-diagnosis/src/app/guide_video/GuideVideoListVM.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { AssetsUntil } from "../../../utils/AssetsUtils";

export class GuideVideoListVM {
  constructor() {}

  /* 引导视频列表 */
  static guideVideoListJSON = () => {
    return [
      {
        id: 1,
        titleKey: "bindDevice",
        videoUrl: AssetsUntil.GuideBindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 2,
        titleKey: "unbindDevice",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 3,
        titleKey: "shareDevice",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 5,
        titleKey: "connectNetworkCable",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 6,
        titleKey: "connectNetworkCable",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 7,
        titleKey: "connectNetworkCable",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      },
      {
        id: 8,
        titleKey: "connectNetworkCable",
        videoUrl: AssetsUntil.GuideUnbindVideo, //"https://download.samplelib.com/mp4/sample-5s.mp4",
        thumbnail: AssetsUntil.GuideVideoItem,
      } /**/,
      ,
    ];
  };
  /* 翻译译文 */
  static translationTxt = () => {
    return {
      zh: {
        title: "新手引导",
        commonQuestions: "常见问题",
        videoTutorials: "视频教程",
        bindDevice: "绑定设备",
        unbindDevice: "解绑设备",
        shareDevice: "分享设备",
        connectNetworkCable: "连接网线",
        newbieTutorial: "新手教学",
        enterGuide: "进入引导",
      },
      en: {
        title: "Newbie Guide",
        commonQuestions: "FAQ",
        videoTutorials: "Video Tutorials",
        bindDevice: "Bind Device",
        unbindDevice: "Unbind Device",
        shareDevice: "Share Device",
        connectNetworkCable: "Connect Network Cable",
        newbieTutorial: "Newbie Tutorial",
        enterGuide: "Enter Guide",
      },
    };
  };
}
