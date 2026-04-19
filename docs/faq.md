# FAQ / 常见问题

## 安装相关 / Installation

### npx 安装失败怎么办？

确保 Node.js 版本 >= 18：

```bash
node --version
```

如果版本过低，请升级 Node.js。也可以使用手动安装方式。

### Windows 上路径有问题？

手动安装时，请使用正斜杠 `/` 而非反斜杠 `\`：

```json
"command": "node C:/Users/yourname/.claude/statusline.mjs"
```

## 配置相关 / Configuration

### 配额显示为 0%？

检查以下几点：
1. `ANTHROPIC_BASE_URL` 是否设置为 `https://open.bigmodel.cn/api/anthropic`
2. `ANTHROPIC_AUTH_TOKEN` 是否有效
3. 是否已订阅智谱 Coding Plan

### 能否和 Anthropic 官方 API 一起用？

可以。上下文使用率和模型信息不依赖智谱 API。只有配额显示功能需要智谱平台支持。

### 如何更换颜色阈值？

编辑 `~/.claude/statusline.mjs` 中的 `ctxColor()` 和 `quotaColor()` 函数。

## 其他 / Other

### 会影响 Claude Code 性能吗？

不会。配额数据有 5 分钟缓存，不会频繁请求 API。脚本执行非常轻量。

### 数据会发送到第三方吗？

不会。所有数据仅在本地处理，API 请求只发送到智谱官方平台。
