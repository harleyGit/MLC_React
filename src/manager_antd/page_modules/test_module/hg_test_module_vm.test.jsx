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
  ]);
});
