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

```sh
MLC_React/
├── AGENTS.md
├── rules/
│   ├── common.md
│   ├── react.md
│   ├── ios.md
│   └── go.md
└── codex-pro-init.sh


想iOS、GO、React共用一套AGENTS.md文件，如下：
chmod +x codex-pro-init.sh
./codex-pro-init.sh /path/to/MLC_GO
```



