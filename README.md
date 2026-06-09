# claude-code-glm-statusline

[English](README_EN.md) | 中文

Claude Code 自定义状态栏，专为 **智谱 GLM Coding Plan** 订阅用户设计。

实时显示模型信息、上下文使用率、5 小时 / 7 天配额用量、系统内存、历史 Token 统计，让你对 API 消耗一目了然。

## 效果预览

```
📁 statusline | 🧠 glm-5.1 | 📋42% ██████████████░░░░░░ | 🕐13:16
  ⏳5h 62% 2h30m | 📅7d 45% 5d12h | 💾12/16GB(75%) | 📈1.2M↑ 86K↓
```

- **目录名** — 当前工作目录
- **模型** — 当前使用的 GLM 模型
- **上下文** — 上下文窗口使用率，带颜色进度条（绿→黄→红）
- **5h 配额** — 5 小时滑动窗口 Token 用量 + 重置倒计时
- **7d 配额** — 7 天滑动窗口 Token 用量 + 重置倒计时
- **系统内存** — 已用/总内存及占比
- **Token 统计** — 历史累计输入↑/输出↓ Token 数（增量扫描，5分钟缓存）
- **时间** — 当前时间

## 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- 智谱 Coding Plan 订阅（[开通地址](https://open.bigmodel.cn/)）
- **智谱用量查询插件（glm-plan-usage）** — 配额数据依赖此插件

> **安装用量查询插件：** 推荐使用智谱官方一键安装助手自动配置：
> ```bash
> npx @z_ai/coding-helper
> ```
> 进入向导后选择 **插件市场** → 安装 **glm-plan-usage** 插件即可。
>
> 也可手动安装：
> ```bash
> claude plugin marketplace add zai-org/zai-coding-plugins
> claude plugin install glm-plan-usage@zai-coding-plugins
> ```
>
> 详见 [智谱官方文档 - 用量查询插件](https://docs.bigmodel.cn/cn/coding-plan/extension/usage-query-plugin) 和 [一键安装助手](https://docs.bigmodel.cn/cn/coding-plan/extension/coding-tool-helper)

## 快速安装

```bash
npx claude-code-glm-statusline
```

安装完成后重启 Claude Code 即可看到状态栏。

## 手动安装

如果 `npx` 不可用，可以手动安装：

1. 下载 `src/statusline.mjs` 到 `~/.claude/` 目录：

```bash
curl -o ~/.claude/statusline.mjs https://raw.githubusercontent.com/Darkycl/claude-code-glm-statusline/main/src/statusline.mjs
```

2. 编辑 `~/.claude/settings.json`，添加 `statusLine` 配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.mjs"
  }
}
```

Windows 用户使用完整路径：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/<your-username>/.claude/statusline.mjs"
  }
}
```

## 配置环境变量

确保 `~/.claude/settings.json` 中的 `env` 已配置智谱 API：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<your-api-token>"
  }
}
```

## 卸载

1. 编辑 `~/.claude/settings.json`，删除 `statusLine` 字段
2. 删除状态栏脚本和缓存文件

```bash
rm ~/.claude/statusline.mjs ~/.claude/quota_cache.json ~/.claude/token_cache.json
```

## 工作原理

- 脚本从 Claude Code 的 stdin 读取 JSON 数据，提取模型和上下文信息
- 配额数据通过智谱平台 API (`/api/monitor/usage/quota/limit`) 获取
- 配额数据缓存 5 分钟，避免频繁请求
- Token 统计通过增量扫描 `~/.claude/projects/` 下的 JSONL 会话文件，按文件 mtime 变化检测更新，缓存 5 分钟
- 系统内存通过 Node.js `os.totalmem()` / `os.freemem()` 获取
- 使用 ANSI 颜色编码和 Unicode 字符渲染进度条

## 常见问题

**Q: 状态栏没有显示配额信息？**

确保 `ANTHROPIC_BASE_URL` 指向 `https://open.bigmodel.cn/api/anthropic`，且 `ANTHROPIC_AUTH_TOKEN` 已正确设置。

**Q: 支持 Anthropic 官方 API 吗？**

配额显示功能依赖智谱平台的专属 API。如果你使用 Anthropic 官方 API，上下文使用率和模型信息仍然可以正常显示。

**Q: 支持 Windows 吗？**

支持。安装脚本会自动检测操作系统并使用正确的路径格式。

## 协议

[MIT](LICENSE)
