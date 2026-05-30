#!/bin/bash
# 启动脚本：启动 Vite 开发服务器并在当前 Chrome 中打开页面
# 用法：./start-dev.sh

# 获取脚本所在目录的父目录（即项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目目录
cd "$PROJECT_DIR"

# 检查 5174 端口是否已有服务监听
if ! lsof -nP -iTCP:5174 -sTCP:LISTEN >/dev/null 2>&1; then
    # 端口空闲，启动 Vite 开发服务器（后台运行）
    npm run dev &
    
    # 等待端口就绪（最多等待 30 秒）
    WAIT_COUNT=0
    while ! lsof -nP -iTCP:5174 -sTCP:LISTEN >/dev/null 2>&1; do
        sleep 0.2
        WAIT_COUNT=$((WAIT_COUNT + 1))
        if [ $WAIT_COUNT -ge 150 ]; then
            echo "错误：等待 Vite 启动超时（30秒）"
            exit 1
        fi
    done
    
    echo "Vite 开发服务器已启动"
fi

# 在当前 Chrome 中打开新标签页
# open -a 'Google Chrome' 会在已运行的 Chrome 中打开新标签页
open -a 'Google Chrome' 'http://localhost:5174/'

echo "已在 Chrome 中打开 http://localhost:5174/"

# 等待后台进程，保持终端运行
wait
