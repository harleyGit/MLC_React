/*
index.jsx 是我加的“桶文件（barrel）”，作用只有一个：统一导出，方便引用路径更
  短。

  - 有它时：
      - import { HGToast } from "src/utils/toast";
  - 没它时：
      - import { HGToast } from "src/utils/toast/hg_toast.jsx";

  它不是必须文件，只是导出中转层。
  如果你不希望有这个文件，我可以直接删掉 index.jsx，并统一改成直连 hg_toast.jsx
  的导入方式。
*/
/* eslint-disable react-refresh/only-export-components */
export { default as HGToast, showHGToast } from "./hg_toast";
