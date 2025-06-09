# 版本管理脚本使用说明

本项目提供了两个脚本来自动化版本管理流程：

## 脚本说明

### 1. `update-version.sh` - 直接指定版本号

用于直接设置特定的版本号。

**用法：**
```bash
./update-version.sh <版本号>
```

**示例：**
```bash
./update-version.sh 0.2.0
./update-version.sh 1.0.0
```

### 2. `bump-version.sh` - 智能版本递增

支持语义化版本递增和直接指定版本号。

**用法：**
```bash
# 递增补丁版本 (0.1.5 -> 0.1.6)
./bump-version.sh patch

# 递增次版本 (0.1.5 -> 0.2.0)
./bump-version.sh minor

# 递增主版本 (0.1.5 -> 1.0.0)
./bump-version.sh major

# 直接指定版本号
./bump-version.sh 0.3.0
```

## 脚本功能

两个脚本都会执行以下操作：

1. **更新版本号**：
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`

2. **Git 操作**：
   - 提交版本更新 (commit message: `chore: bump version to x.x.x`)
   - 创建 git tag (`vx.x.x`)
   - 推送到远程仓库

## 安全检查

脚本包含以下安全检查：

- ✅ 验证版本号格式
- ✅ 检查是否在 git 仓库中
- ✅ 检查工作区状态（有未提交更改时会警告）
- ✅ 用户确认操作
- ✅ 自动检测当前分支并推送

## 依赖要求

**必需：**
- `git`
- `sed`

**可选（推荐）：**
- `jq` - 用于更安全的 JSON 文件处理

### 安装 jq (可选)

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

## 使用示例

### 场景 1：修复 bug，需要发布补丁版本
```bash
./bump-version.sh patch
# 0.1.5 -> 0.1.6
```

### 场景 2：添加新功能，需要发布次版本
```bash
./bump-version.sh minor
# 0.1.5 -> 0.2.0
```

### 场景 3：重大更新，需要发布主版本
```bash
./bump-version.sh major
# 0.1.5 -> 1.0.0
```

### 场景 4：需要跳跃到特定版本
```bash
./bump-version.sh 2.0.0
# 直接设置为 2.0.0
```

## 注意事项

1. **工作区状态**：建议在干净的工作区中运行脚本
2. **分支管理**：脚本会自动检测当前分支并推送到该分支
3. **远程仓库**：确保有推送权限到远程仓库
4. **版本格式**：只支持语义化版本格式 (x.y.z)

## 错误处理

如果脚本执行过程中出现错误：

1. **版本号格式错误**：检查版本号是否符合 x.y.z 格式
2. **Git 错误**：检查是否在 git 仓库中，是否有推送权限
3. **文件权限错误**：确保脚本有执行权限 (`chmod +x *.sh`)

## 自动化集成

可以将这些脚本集成到 CI/CD 流程中：

```yaml
# GitHub Actions 示例
- name: Bump version
  run: ./bump-version.sh patch
```

## 回滚操作

如果需要回滚版本更新：

```bash
# 删除本地 tag
git tag -d v0.1.6

# 删除远程 tag
git push origin :refs/tags/v0.1.6

# 回滚到上一个 commit
git reset --hard HEAD~1
git push origin main --force
```

⚠️ **警告**：强制推送会影响其他协作者，请谨慎使用。