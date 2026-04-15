# Bilibili Article Crawler

抓取指定 B站用户的专栏文章，支持按关键词过滤，保存为纯文本文件。

## 功能特性

- 通过 `.env` 配置 UID、关键词和 Cookie，无需命令行参数
- 关键词为空时抓取用户的**所有文章**
- 自动跳过已抓取的文章（基于 `output/` 目录下的文件）
- 遇到风控（-509 / -352）自动指数退避重试
- 熔断机制：连续 3 次 -352 错误后进入 5 分钟冷却期

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
node crawler.js
```

抓取的文章将保存到 `output/` 目录，每篇文章一个 `.txt` 文件。

## 输出格式

每个文件包含元数据头和正文：

```
标题: 文章标题
URL: https://www.bilibili.com/read/cv12345
抓取时间: 2025/01/01 12:00:00
────────────────────────────────────────────────────────────────
正文内容 ...
```

## 项目结构

```
├── crawler.js          # 主入口：流程控制、重试与熔断
├── lib/
│   ├── api.js          # B站 API 请求封装
│   ├── fileWriter.js   # 文件写入与去重
│   └── utils.js        # 工具函数（sleep、日志等）
├── output/             # 抓取结果输出目录
├── .env                # 环境变量配置（不提交到 Git）
├── .env.example        # 环境变量模板
└── package.json
```

## 注意事项

- B站有反爬策略，**强烈建议设置 Cookie** 以降低被风控的概率
- 请合理使用，不要高频率抓取，避免对 B站服务造成压力
- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除

## License

MIT
