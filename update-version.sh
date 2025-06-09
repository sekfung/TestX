#!/bin/bash

# 版本更新脚本
# 用法: ./update-version.sh <new_version>
# 例如: ./update-version.sh 0.1.6

set -e  # 遇到错误时退出

# 检查参数
if [ $# -eq 0 ]; then
    echo "错误: 请提供新版本号"
    echo "用法: $0 <new_version>"
    echo "例如: $0 0.1.6"
    exit 1
fi

NEW_VERSION=$1

# 验证版本号格式 (简单的语义版本检查)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "错误: 版本号格式不正确，请使用语义版本格式 (例如: 1.0.0)"
    exit 1
fi

echo "🚀 开始更新版本到 $NEW_VERSION"

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

# 更新 package.json
echo "📝 更新 package.json"
if command -v jq > /dev/null; then
    # 使用 jq 更新 (如果可用)
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # 使用 sed 更新
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm -f package.json.bak
fi

# 更新 src-tauri/tauri.conf.json
echo "📝 更新 tauri.conf.json"
if command -v jq > /dev/null; then
    # 使用 jq 更新 (如果可用)
    jq ".version = \"$NEW_VERSION\"" src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
else
    # 使用 sed 更新
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
git push origin main
git push origin "v$NEW_VERSION"

echo "✅ 版本更新完成!"
echo "📋 更新内容:"
echo "   - package.json: $NEW_VERSION"
echo "   - tauri.conf.json: $NEW_VERSION"
echo "   - Cargo.toml: $NEW_VERSION"
echo "   - Git tag: v$NEW_VERSION"
echo "   - 已推送到远程仓库"