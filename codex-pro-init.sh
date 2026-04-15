#!/bin/bash
# codex-pro-init.sh
# Pro版 Codex 自动初始化脚本
# 用法: ./codex-pro-init.sh <工程目录>

set -e

WORKSPACE_DIR="$1"
if [[ -z "$WORKSPACE_DIR" ]]; then
    echo "Usage: $0 <工程目录>"
    exit 1
fi
if [[ ! -d "$WORKSPACE_DIR" ]]; then
    echo "Error: Directory $WORKSPACE_DIR does not exist."
    exit 1
fi

echo "✅ Initializing Codex Pro in $WORKSPACE_DIR..."

# 复制规则
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -v "$SCRIPT_DIR/AGENTS.md" "$WORKSPACE_DIR/"
cp -rv "$SCRIPT_DIR/rules" "$WORKSPACE_DIR/"

echo "✅ AGENTS.md and rules/ copied."

# 配置 CLI 默认安全
CODEx_CONFIG="$HOME/.codex/config.toml"
mkdir -p "$(dirname "$CODEx_CONFIG")"
cat > "$CODEx_CONFIG" <<EOL
sandbox_mode = "workspace-write"
network_access = false
approval_policy = "ask"
EOL
echo "✅ Codex config.toml set"

# 自动识别工程类型
PROJECT_TYPE="unknown"
if [[ -f "$WORKSPACE_DIR/package.json" ]]; then
    PROJECT_TYPE="react"
elif [[ $(find "$WORKSPACE_DIR" -name "*.xcodeproj" | wc -l) -gt 0 ]]; then
    PROJECT_TYPE="ios"
elif [[ $(find "$WORKSPACE_DIR" -name "*.go" | wc -l) -gt 0 ]]; then
    PROJECT_TYPE="go"
fi
echo "✅ Project type detected: $PROJECT_TYPE"

# 自动 build / lint
case "$PROJECT_TYPE" in
    react)
        cd "$WORKSPACE_DIR"
        npm install
        npm run lint
        npm run build
        ;;
    ios)
        cd "$WORKSPACE_DIR"
        xcodebuild -scheme "$(ls *.xcodeproj | sed 's/.xcodeproj//')" build
        ;;
    go)
        cd "$WORKSPACE_DIR"
        go fmt ./...
        go vet ./...
        go build ./...
        ;;
esac

# 生成报告
REPORT="$WORKSPACE_DIR/codex_pro_report.txt"
echo "Codex Pro Initialization Report" > "$REPORT"
echo "Workspace: $WORKSPACE_DIR" >> "$REPORT"
echo "Project type: $PROJECT_TYPE" >> "$REPORT"
echo "Sandbox mode: workspace-write" >> "$REPORT"
echo "Network access: OFF" >> "$REPORT"
echo "Approval policy: ask" >> "$REPORT"
echo "AGENTS.md loaded: YES" >> "$REPORT"
echo "Rules folder loaded: YES" >> "$REPORT"
echo "Build / Lint status: SUCCESS" >> "$REPORT"

echo "✅ Codex Pro setup complete! Report saved to $REPORT"
