/* global expect, test */
import HGTestModuleVM, { TEST_MODULE_MENU_ITEMS } from "./hg_test_module_vm";

test("test module menu exposes guide video as the default page", () => {
  expect(HGTestModuleVM.getDefaultSelectedKey()).toBe("guide_video_list");
  expect(TEST_MODULE_MENU_ITEMS).toEqual([
    {
      key: "video",
      label: "视频",
      children: [
        { key: "guide_video_list", label: "视频列表" },
        { key: "guide_video_player", label: "视频播放" },
      ],
    },
    {
      key: "ui_components",
      label: "UI组件",
      children: [
        { key: "css_loading", label: "CSS 加载动画" },
        { key: "theme_palette", label: "主题色彩预览" },
      ],
    },
    {
      key: "data",
      label: "数据",
      children: [
        { key: "local_database_test", label: "本地数据库测试" },
      ],
    },
  ]);
});
