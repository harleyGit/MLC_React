#!/bin/bash
# 旧初始化入口仅保留弃用提示，不执行任何配置或工程操作。
printf '%s\n' \
  '此初始化脚本已弃用，未执行初始化。' \
  'MLC_React 项目规则：项目根目录 AGENTS.md；React 方法：~/HGFiles/GitHub/AITools/Skills/mlc-engineering/react/SKILL.md' \
  'OpenCode 通过项目 opencode.json 的 skills.paths 按需发现技能，请退出并重启 OpenCode。' \
  '本脚本不复制规则、不覆盖配置、不安装依赖、不构建、不生成报告，也不配置 Codex。'
exit 0
