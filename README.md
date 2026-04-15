# Bilibili Article Crawler

抓取指定 B站用户的专栏文章，支持按关键词过滤，保存为纯文本文件。

## 功能特性

- TypeScript 编写，类型安全
- 通过 `.env` 配置 UID、关键词和 Cookie，无需命令行参数
- 关键词为空时抓取用户的**所有文章**
- 自动跳过已抓取的文章（基于 `output/` 目录下的文件）
- 遇到风控（-509 / -352）自动指数退避重试
- 熔断机制：连续 3 次 -352 错误后进入 5 分钟冷却期
- 内置 HTML 清洗工具，可将抓取内容转为干净的纯文本（适合喂给 LLM / RAG）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下内容：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `BILIBILI_UID` | **是** | 目标用户的 UID，可在 B站用户主页 URL 中找到 |
| `BILIBILI_KEYWORD` | 否 | 关键词过滤，留空则抓取全部文章 |
| `BILIBILI_COOKIE` | 否（推荐） | B站浏览器 Cookie，设置后可大幅降低风控概率 |

#### 获取 Cookie

1. 用 Chrome 打开 https://www.bilibili.com 并登录
2. F12 打开 DevTools → Network 面板
3. 刷新页面，点任意一个请求
4. 在 Request Headers 中找到 `Cookie` 字段，完整复制
5. 粘贴到 `.env` 的 `BILIBILI_COOKIE=` 后面（一整行，不要换行）

### 3. 运行

```bash
# 爬取 + 自动清洗 HTML（推荐，一步到位）
npm run crawl

# 仅爬取，保留原始内容（含 HTML 标签）
npm run dev

# 仅清洗已有文件中的 HTML 标签
npm run clean

# 编译后运行（仅爬取，不清洗）
npm run build
npm start
```

## 命令说明

| 命令 | 作用 |
| --- | --- |
| `npm run crawl` | 爬取 + 自动清洗（推荐日常使用） |
| `npm run dev` | 仅爬取，不清洗，保留 API 返回的原始 HTML 内容 |
| `npm run clean` | 仅清洗 `output/` 下已有文件的 HTML 标签，转为纯文本 |
| `npm run build` | 编译 TypeScript 到 `dist/` |
| `npm start` | 运行编译后的 JS（仅爬取） |

> **为什么需要清洗？** B站专栏 API 返回的正文是 HTML 格式（含 `<p>`、`<img>`、`<figure>` 等标签），直接使用会浪费 token 并干扰 embedding 质量。`clean` 命令会将 HTML 转为干净的纯文本，保留元数据头。

## 输出格式

每个文件包含元数据头和正文：

```
标题: 文章标题
URL: https://www.bilibili.com/read/cv12345
抓取时间: 2025/01/01 12:00:00
────────────────────────────────────────────────────────────────

正文内容（纯文本，经 clean 清洗后不含 HTML 标签）...
```

## 项目结构

```
├── src/
│   ├── crawler.ts        # 主入口：流程控制、重试与熔断
│   ├── clean.ts          # HTML 清洗工具
│   └── lib/
│       ├── types.ts      # 共享类型定义
│       ├── api.ts        # B站 API 请求封装
│       ├── fileWriter.ts # 文件写入与去重
│       ├── parser.ts     # HTML 解析器（备用）
│       └── utils.ts      # 工具函数（sleep、日志等）
├── dist/                 # 编译输出（git ignored）
├── output/               # 抓取结果输出目录
├── .env                  # 环境变量配置（不提交到 Git）
├── .env.example          # 环境变量模板
├── tsconfig.json         # TypeScript 配置
└── package.json
```

## 注意事项

- B站有反爬策略，**强烈建议设置 Cookie** 以降低被风控的概率
- 请合理使用，不要高频率抓取，避免对 B站服务造成压力
- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除
- 首次爬取完成后建议运行 `npm run clean` 清洗历史文件

## License

MIT
