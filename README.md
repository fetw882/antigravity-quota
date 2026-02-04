# Antigravity Quota Checker / Antigravity 配额检测器

[English](#english) | [中文](#中文)

---

## English

### Overview

Check quota status for all Antigravity accounts configured in OpenClaw/Clawdbot. Monitors Claude and Gemini model quotas with ban detection.

### Features

- 📊 Real-time quota monitoring for Claude & Gemini models
- 🔄 Watch mode with auto-refresh every 5 minutes
- 📈 Delta tracking to show quota changes
- 🚫 Ban/suspension detection
- 🌍 Timezone support
- 📋 Multiple output formats (text, table, JSON)

### Requirements

- Node.js
- OpenClaw/Clawdbot with Antigravity accounts configured

### Installation

```bash
git clone https://github.com/fetw882/antigravity-quota.git
cd antigravity-quota
```

Or via ClawHub:
```bash
clawhub install antigravity-quota
```

### Usage

```bash
node check-quota.js [options]
```

| Option | Description |
|--------|-------------|
| `--watch` | Refresh every 5 minutes |
| `--table` | Output ASCII table (default) |
| `--json` | Output JSON format |
| `--tz ZONE` | Timezone for reset times |

### Status Indicators

| Emoji | Meaning |
|-------|---------|
| 🟢 | 80%+ remaining |
| 🟡 | 50-79% remaining |
| 🟠 | 20-49% remaining |
| 🔴 | <20% remaining |
| 🚫 | Account banned |

---

## 中文

### 概述

检测 OpenClaw/Clawdbot 中配置的所有 Antigravity 账户的配额状态。支持 Claude 和 Gemini 模型配额监控，具备封禁检测功能。

### 功能特性

- 📊 实时监控 Claude & Gemini 模型配额
- 🔄 监视模式，每 5 分钟自动刷新
- 📈 增量追踪，显示配额变化
- 🚫 账户封禁/暂停检测
- 🌍 时区支持
- 📋 多种输出格式（文本、表格、JSON）

### 安装

```bash
git clone https://github.com/fetw882/antigravity-quota.git
cd antigravity-quota
```

或通过 ClawHub：
```bash
clawhub install antigravity-quota
```

### 使用方法

```bash
node check-quota.js [选项]
```

| 选项 | 说明 |
|------|------|
| `--watch` | 每 5 分钟刷新 |
| `--table` | 输出表格（默认） |
| `--json` | 输出 JSON |
| `--tz ZONE` | 设置时区 |

### 状态指示

| 图标 | 含义 |
|------|------|
| 🟢 | 剩余 80%+ |
| 🟡 | 剩余 50-79% |
| 🟠 | 剩余 20-49% |
| 🔴 | 剩余 <20% |
| 🚫 | 账户被封禁 |

---

## License

MIT

## Author

Hive Matrix 🦞
