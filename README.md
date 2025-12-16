# AI Siri Gateway

一个轻量级的 AI 中转网关，用于 HomePod / iPhone 快捷指令调用 OpenAI 兼容的 Chat Completions API。

## 功能特性

- ✅ 简单的 API Key 鉴权
- ✅ 支持三种模式：idea、todo、daily
- ✅ 零第三方依赖，使用 Node.js 原生 fetch
- ✅ 一键部署到 Vercel
- ✅ 完整的错误处理和超时控制

## 项目结构

```
.
├── api/
│   └── ai.js          # 主 API 接口
├── package.json       # 项目配置
└── README.md          # 本文档
```

## 本地运行（可选）

### 前置要求

- Node.js 18+ （支持原生 fetch）
- Vercel CLI（可选，用于本地测试）

### 安装 Vercel CLI

```bash
npm i -g vercel
```

### 运行

```bash
# 安装依赖（实际上没有依赖，但可以运行）
npm install

# 使用 Vercel CLI 本地运行
vercel dev
```

本地运行需要设置环境变量，可以通过 `.env.local` 文件或 Vercel CLI 的交互式设置。

## 部署到 Vercel

### 方法一：通过 Vercel CLI

1. **安装 Vercel CLI**（如果还没安装）
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署**
   ```bash
   vercel
   ```
   
   首次部署会提示：
   - 是否链接到现有项目？选择 `N`
   - 项目名称：输入你的项目名（或直接回车）
   - 目录：直接回车（使用当前目录）

4. **设置环境变量**（见下方"环境变量配置"）

5. **生产环境部署**
   ```bash
   vercel --prod
   ```

### 方法二：通过 GitHub（推荐）

1. **将代码推送到 GitHub**

2. **在 Vercel 网站导入项目**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "Add New Project"
   - 选择你的 GitHub 仓库
   - 点击 "Import"

3. **配置环境变量**（见下方）

4. **部署**
   - Vercel 会自动检测并部署
   - 每次推送到主分支会自动触发部署

## 环境变量配置

在 Vercel 项目设置中，添加以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GATEWAY_API_KEY` | 网关鉴权密钥（客户端请求头需携带此值） | `your-secret-key-123` |
| `UPSTREAM_KEY` | 上游 AI 服务的 API Key | `sk-xxx...` |
| `UPSTREAM_BASE` | 上游 AI 服务的 Base URL | `https://api.openai.com/v1` 或 `https://api.deepseek.com/v1` |
| `MODEL` | 使用的模型名称（可选，默认 gpt-3.5-turbo） | `gpt-4` 或 `deepseek-chat` |

### 在 Vercel 中设置环境变量

1. 进入项目 Dashboard
2. 点击 **Settings** → **Environment Variables**
3. 添加上述四个变量
4. 选择环境（Production、Preview、Development）
5. 点击 **Save**
6. 重新部署项目使环境变量生效

## API 接口说明

### 端点

```
POST https://your-project.vercel.app/api/ai
```

### 请求头

```
Content-Type: application/json
x-api-key: your-secret-key-123  # 必须等于 GATEWAY_API_KEY
```

### 请求体

```json
{
  "text": "用户输入的文本内容",
  "mode": "idea"  // 可选值：idea | todo | daily
}
```

### 响应

**成功响应（200）**
```json
{
  "reply": "AI 返回的回复内容"
}
```

**错误响应（401）**
```json
{
  "error": "Unauthorized: Invalid API key"
}
```

**错误响应（400）**
```json
{
  "error": "Missing or invalid \"text\" field"
}
```

**错误响应（500）**
```json
{
  "error": "Failed to process AI request",
  "detail": "具体错误信息（最多300字）"
}
```

## iPhone 快捷指令配置

### 步骤 1：创建快捷指令

1. 打开 **快捷指令** App
2. 点击右上角 **+** 创建新指令
3. 点击 **添加操作**

### 步骤 2：添加"获取网页内容"操作

1. 搜索并添加 **"获取网页内容"** 操作
2. 配置如下：

**URL**
```
https://your-project.vercel.app/api/ai
```

**方法**
```
POST
```

**请求头**
```
x-api-key: your-secret-key-123
Content-Type: application/json
```

**请求体**
```json
{
  "text": "{{快捷指令输入}}",
  "mode": "idea"
}
```

> 提示：`{{快捷指令输入}}` 可以通过"文本"操作或"询问输入"操作获取。

### 步骤 3：解析 JSON 响应

1. 添加 **"从输入中获取词典值"** 操作
2. 键名填写：`reply`
3. 输入来源选择：上一个操作的输出

### 步骤 4：显示结果

1. 添加 **"显示通知"** 或 **"朗读文本"** 操作
2. 输入来源选择：上一步获取的 `reply` 值

### 完整示例流程

```
1. 询问输入（文本："你想说什么？"）
   ↓
2. 获取网页内容
   - URL: https://your-project.vercel.app/api/ai
   - 方法: POST
   - 请求头: x-api-key: your-secret-key-123
   - 请求体: {"text": "{{询问输入}}", "mode": "idea"}
   ↓
3. 从输入中获取词典值（键：reply）
   ↓
4. 显示通知（内容：{{词典值}}）
```

### 三种 Mode 的使用场景

#### `mode: "idea"` - 想法总结
**用途**：快速总结想法并给出下一步建议

**示例输入**：
```
我想做一个时间管理的 App，帮助用户记录每天的时间分配
```

**示例输出**：
```
这是一个时间管理 App 的想法，目标是帮助用户记录和分析时间分配。下一步建议：先做一个简单的 MVP，包含手动记录时间的功能。
```

#### `mode: "todo"` - 任务规划
**用途**：将想法转化为可执行的任务列表

**示例输入**：
```
我要准备下周的会议演讲
```

**示例输出**：
```
目标：完成下周会议演讲的准备工作

TODO：
- P1: 确定演讲主题和核心内容框架
- P2: 准备 PPT 演示文稿
- P3: 提前演练并准备问答环节

第一最小动作：打开文档，写下演讲的3个核心要点
```

#### `mode: "daily"` - 日常复盘
**用途**：每日总结和规划

**示例输入**：
```
今天完成了项目文档，但遇到了 API 接口超时的问题，明天需要修复并测试
```

**示例输出**：
```
Progress（进展）：
- 完成了项目文档编写
- 梳理了项目架构和接口设计

Problem（问题）：
- API 接口出现超时问题，影响用户体验

Plan（计划）：
- 明天修复 API 超时问题
- 进行完整的接口测试
- 优化错误处理机制
```

## 安全建议

1. **保护 API Key**：`GATEWAY_API_KEY` 应该使用强随机字符串，不要泄露
2. **HTTPS 强制**：Vercel 默认使用 HTTPS，确保所有请求都通过 HTTPS
3. **限制访问**：可以考虑在 Vercel 中添加 IP 白名单（通过 Vercel 的 Edge Config 或 Middleware）

## 故障排查

### 401 Unauthorized
- 检查请求头 `x-api-key` 是否正确
- 检查 Vercel 环境变量 `GATEWAY_API_KEY` 是否设置

### 500 Internal Server Error
- 检查 Vercel 环境变量 `UPSTREAM_KEY` 和 `UPSTREAM_BASE` 是否正确
- 查看 Vercel 日志：Dashboard → Deployments → 选择部署 → Logs

### 超时错误
- 默认超时时间为 30 秒
- 如果上游 API 响应慢，可以修改 `api/ai.js` 中的超时时间

## 许可证

MIT

