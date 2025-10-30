/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-10-30 21:11:19
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-10-30 21:16:52
 * @FilePath: /MLC_React/src/utils/HGAssetUtils.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 *
 * 加载图片或者视频资源的
 * 
 * 当你用 create-react-app（CRA） 创建项目时，
Webpack 打包的时候会把所有文件都放到一个构建路径下（比如 / 或 /myapp/）。

src/ 里的资源 → 会被 Webpack 打包（变成哈希文件名）

public/ 里的资源 → 不会被打包，而是原样复制到构建输出目录（build/）

process.env.PUBLIC_URL 正是为了解决这个问题。
React 会在打包时自动替换成项目的 根路径（public URL）。

/app_sources/guide_bind.mp4	⚠️ 仅开发阶段可用	生产环境路径可能错误
${process.env.PUBLIC_URL}/app_sources/guide_bind.mp4	✅ 推荐	自动适配所有环境
./app_sources/... / ../app_sources/...	❌ 错误	不会被打包也找不到文件
 */

import cartoonPic00 from "./../assets/5.1_7.jpg";

export class HGAssetUntils {
  static Cartoon_PIC00 = cartoonPic00;
  static WX_Video00 = `${process.env.PUBLIC_URL}/app_sources/wx00.mp4`; //微信视频
}
