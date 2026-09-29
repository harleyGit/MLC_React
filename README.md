<!--
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-04-30 22:07:42
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24 22:45:19
 * @FilePath: /MLC_React/README01.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
- [工程需要资源](#工程需要资源)
  - [图片资源](#图片资源)
- [工程运行](#工程运行)
- [AI规则文件](#AI规则文件)
	



<br/><br/><br/>

***
<br/>

> <h1 id="工程需要资源">工程需要资源</h1>

- **iconPark**
  - 图标：iconPark: https://iconpark.oceanengine.com/home
  - 地址： /Users/ganghuang/HGFiles/GitHub/MLC_React/src/assets



***
<br/><br/><br/>
<h2 id="图片资源">图片资源</h2>

- **iconPark**
  - [图标](https://iconpark.oceanengine.com/home): iconPark: https://iconpark.oceanengine.com/home 
  - 地址： /Users/ganghuang/HGFiles/GitHub/MLC_React/src/assets



<br/><br/><br/>

***
<br/>

> <h1 id="工程运行">工程运行</h1>

| 环境 | 命令 | 加载环境 |
| ---- | ---- | ---- |
| 开发 | `npm run dev` | `.env.debug` |
| Pre | `npm run dev:pre` | `.env.pre` |
| 上线 | `npm run dev:release` | `.env.release` |


## 现在工程配置：

```json id="n8phs2"
"scripts": {
  "dev": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite --mode debug --host",

  "dev:pre": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite --mode pre --host",

  "dev:release": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite --mode release --host",

  "build:pre": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite build --mode pre",

  "build:release": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite build --mode release",

  "lint": "eslint .",

  "preview": "PATH=\"$HOME/.nvm/versions/node/v20.19.0/bin:$PATH\" vite preview --host"
}
```

<br/><br/><br/>

***
<br/>

> <h1 id="AI规则文件">AI规则文件</h1>

项目根目录 [AGENTS.md](AGENTS.md) 承载项目事实、目录、版本、类组件约束、禁止事项与验证入口，不再保留旧 `rules/` 副本。

- React 方法按需使用 `~/HGFiles/GitHub/AITools/Skills/mlc-engineering/react/SKILL.md`。
- 通用实施、安全、测试、审查分别使用 `engineering-workflow`、`security`、`testing`、`code-review` 技能；输出与提交参照 `dev_general_skill`。
- 跨语言任务先获得授权并读取目标工程 `AGENTS.md`，再使用对应语言技能，不覆盖目标构建范围或设备约束。

项目 `opencode.json` 只注册公共技能发现路径，不通过 `instructions` 强制加载技能正文：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      "~/HGFiles/GitHub/AITools/Skills/mlc-engineering"
    ]
  }
}
```

配置修改后退出并重启 OpenCode，从本项目目录启动。该路径要求本机存在对应 AITools 目录；其他机器需提供相同布局或显式调整路径。项目硬约束由根 `AGENTS.md` 提供，技能按任务加载；`dev_general_skill` 的全局发现或直接读取方式见 `AGENTS.md`。

`codex-pro-init.sh` 已弃用，仅提示新入口并退出，不复制规则、不修改任何 CLI 配置、不安装依赖、不执行构建或生成报告。此配置仅面向 OpenCode，不代表 Codex 等其他工具已自动加载规则。

