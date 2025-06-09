#!/bin/bash

# 智能版本递增脚本
# 用法: 
#   ./bump-version.sh patch   # 0.1.5 -> 0.1.6
#   ./bump-version.sh minor   # 0.1.5 -> 0.2.0
#   ./bump-version.sh major   # 0.1.5 -> 1.0.0
#   ./bump-version.sh 0.2.0   # 直接指定版本号

set -e  # 遇到错误时退出

# 获取当前版本号
get_current_version() {
    if command -v jq > /dev/null; then
        jq -r '.version' package.json
    else
        grep '"version":' package.json | sed 's/.*"version": "\([^"]*\)".*/\1/'
    fi
}

# 递增版本号
bump_version() {
    local current_version=$1
    local bump_type=$2
    
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $bump_type in
        "major")
            echo "$((major + 1)).0.0"
            ;;
        "minor")
            echo "$major.$((minor + 1)).0"
            ;;
        "patch")
            echo "$major.$minor.$((patch + 1))"
            ;;
        *)
            echo "错误: 无效的递增类型: $bump_type"
            exit 1
            ;;
    esac
}

# 检查参数
if [ $# -eq 0 ]; then
    echo "错误: 请提供版本递增类型或具体版本号"
    echo "用法:"
    echo "  $0 patch   # 递增补丁版本 (0.1.5 -> 0.1.6)"
    echo "  $0 minor   # 递增次版本 (0.1.5 -> 0.2.0)"
    echo "  $0 major   # 递增主版本 (0.1.5 -> 1.0.0)"
    echo "  $0 0.2.0   # 直接指定版本号"
    exit 1
fi

BUMP_TYPE=$1
CURRENT_VERSION=$(get_current_version)

echo "📊 当前版本: $CURRENT_VERSION"

# 确定新版本号
if [[ $BUMP_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # 直接指定版本号
    NEW_VERSION=$BUMP_TYPE
    echo "🎯 指定版本: $NEW_VERSION"
elif [[ $BUMP_TYPE =~ ^(major|minor|patch)$ ]]; then
    # 递增版本号
    NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_TYPE")
    echo "⬆️  递增 $BUMP_TYPE 版本: $NEW_VERSION"
else
    echo "错误: 无效的参数 '$BUMP_TYPE'"
    echo "请使用 'major', 'minor', 'patch' 或具体的版本号 (如 1.0.0)"
    exit 1
fi

# 检查版本是否有变化
if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
    echo "⚠️  版本号没有变化，操作已取消"
    exit 0
fi

# 确认操作
echo
echo "🔄 版本更新计划:"
echo "   从: $CURRENT_VERSION"
echo "   到: $NEW_VERSION"
echo
read -p "确认执行版本更新? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "错误: 当前目录不是 git 仓库"
    exit 1
fi

# 检查工作区是否干净
if ! git diff-index --quiet HEAD --; then
    echo "警告: 工作区有未提交的更改"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 1
    fi
fi

echo "🚀 开始更新版本到 $NEW_VERSION"

# 更新 package.json
echo "📝 更新 package.json"
if command -v jq > /dev/null; then
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm -f package.json.bak
fi

# 更新 src-tauri/tauri.conf.json
echo "📝 更新 tauri.conf.json"
if command -v jq > /dev/null; then
    jq ".version = \"$NEW_VERSION\"" src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
else
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
    rm -f src-tauri/tauri.conf.json.bak
fi

# 更新 src-tauri/Cargo.toml
echo "📝 更新 Cargo.toml"
sed -i.bak "s/^version = \"[^\"]*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# 提交更改
echo "📦 提交版本更新"
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to $NEW_VERSION"

# 创建 git tag
echo "🏷️  创建 git tag: v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# 推送到远程仓库
echo "🚀 推送到远程仓库"
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

echo "✅ 版本更新完成!"
echo "📋 更新内容:"
echo "   - 版本: $CURRENT_VERSION → $NEW_VERSION"
echo "   - 更新文件: package.json, tauri.conf.json, Cargo.toml"
echo "   - Git tag: v$NEW_VERSION"
echo "   - 已推送到远程仓库 ($CURRENT_BRANCH 分支)"
echo
echo "🎉 发布完成! 可以在 GitHub 上创建 Release 了。"