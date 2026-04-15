#!/usr/bin/env node
/**
 * B站专栏文章爬虫
 *
 * 配置（通过 .env 文件）：
 *   BILIBILI_UID      — 目标用户 UID（必填）
 *   BILIBILI_KEYWORD  — 关键词过滤（可选，留空则抓取全部文章）
 *   BILIBILI_COOKIE   — 浏览器 Cookie，用于携带登录态请求（推荐）
 *
 * 使用方式：
 *   npm run dev        # 直接运行 TS（无需编译）
 *   npm run build      # 编译为 JS
 *   npm start          # 运行编译后的 JS
 *   npm run crawl      # 爬取 + 自动清洗 HTML
 *
 * 特性：
 *   - 所有配置从 .env 读取，无需命令行参数
 *   - 关键词为空时抓取用户的全部文章
 *   - 自动跳过已抓取的文章（基于 output/ 目录下的文件）
 *   - 遇到 -509 / -352 风控自动指数退避重试
 *   - 熔断机制：连续 3 次 -352 错误后进入 5 分钟冷却期
 */

import 'dotenv/config';
import { fetchArticleList, fetchArticleContent } from './lib/api.js';
import { writeArticle, ensureOutputDir, articleExists } from './lib/fileWriter.js';
import { randomSleep, log } from './lib/utils.js';
import type { ArticleMeta, ArticleListResult } from './lib/types.js';

// ── 配置 ─────────────────────────────────────────────────────────────────────
const LIST_DELAY_MS = 2000;           // 列表翻页延迟
const ARTICLE_DELAY_MIN = 4000;       // 文章请求最小延迟
const ARTICLE_DELAY_MAX = 8000;       // 文章请求最大延迟
const MAX_RETRY = 3;                  // 风控重试次数
const CIRCUIT_BREAKER_THRESHOLD = 3;  // 连续 -352 次数触发熔断
const COOLDOWN_MS = 5 * 60 * 1000;   // 熔断冷却时间（5 分钟）

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/** 从错误信息中提取风控错误码 */
function getRiskControlCode(err: unknown): string | null {
  const msg = (err as Error)?.message ?? '';
  if (msg.includes('-352')) return '-352';
  if (msg.includes('-509')) return '-509';
  return null;
}

/** 带风控重试的请求包装器（指数退避） */
async function runWithRiskRetry<T>(label: string, requestFn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await requestFn();
    } catch (err) {
      const code = getRiskControlCode(err);
      if (!code || attempt === MAX_RETRY) throw err;

      const base = code === '-352' ? 15000 : 6000;
      const backoff = base * Math.pow(2, attempt - 1) + Math.random() * 3000;
      log('warn', `${label} — 风控 ${code}，第 ${attempt}/${MAX_RETRY} 次重试，等待 ${Math.round(backoff / 1000)}s …`);
      await new Promise<void>((r) => setTimeout(r, backoff));
    }
  }
  throw new Error('重试次数耗尽');
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const uid = process.env.BILIBILI_UID?.trim();
  const keyword = (process.env.BILIBILI_KEYWORD ?? '').trim();

  if (!uid) {
    console.error('错误：BILIBILI_UID 未设置，请在 .env 文件中配置。');
    process.exit(1);
  }

  log('info', `UID: ${uid}  关键词: ${keyword ? `"${keyword}"` : '（空 — 抓取全部文章）'}`);
  await ensureOutputDir();

  // ── 第一步：收集所有文章元数据 ──────────────────────────────────────────
  const allArticles: ArticleMeta[] = [];
  let page = 1;
  let total = Infinity;

  while (allArticles.length < total) {
    log('info', `正在获取文章列表第 ${page} 页 …`);

    let result: ArticleListResult;
    try {
      result = await runWithRiskRetry(
        `列表第 ${page} 页`,
        () => fetchArticleList(uid, page),
      );
    } catch (err) {
      log('error', `获取列表第 ${page} 页失败: ${(err as Error).message}`);
      break;
    }

    if (page === 1) {
      total = result.total;
      log('info', `API 报告文章总数: ${total}`);
    }

    if (result.articles.length === 0) break;

    allArticles.push(...result.articles);
    log('info', `已收集 ${allArticles.length} / ${total} 篇`);

    if (allArticles.length >= total) break;

    page++;
    await randomSleep(LIST_DELAY_MS, LIST_DELAY_MS + 1500);
  }

  log('info', `收集完成，共 ${allArticles.length} 篇文章。开始抓取正文 …`);

  // ── 第二步：抓取正文并按关键词过滤 ─────────────────────────────────────
  let matchCount = 0;
  let skipCount = 0;
  let consecutive352 = 0;

  for (let i = 0; i < allArticles.length; i++) {
    const { id: cvid, title } = allArticles[i];

    // 跳过已抓取的文章
    if (await articleExists({ cvid, title })) {
      skipCount++;
      log('skip', `cv${cvid} "${title}" — 已抓取`);
      continue;
    }

    // 带重试地抓取正文
    let content: string;
    try {
      content = await runWithRiskRetry(
        `cv${cvid} "${title}"`,
        () => fetchArticleContent(cvid),
      );
      consecutive352 = 0;
    } catch (err) {
      const code = getRiskControlCode(err);

      if (code === '-352') {
        consecutive352++;
        log('error', `cv${cvid} "${title}" — ${code}（连续: ${consecutive352}/${CIRCUIT_BREAKER_THRESHOLD}）`);

        if (consecutive352 >= CIRCUIT_BREAKER_THRESHOLD) {
          log('warn', `🛑 熔断触发！连续 ${consecutive352} 次 -352 错误。`);
          log('warn', `   进入 ${COOLDOWN_MS / 60000} 分钟冷却 …`);
          await new Promise<void>((r) => setTimeout(r, COOLDOWN_MS));
          consecutive352 = 0;
          log('info', `⏰ 冷却结束，继续抓取 …`);
          i--;
          continue;
        }
      } else {
        log('error', `cv${cvid} "${title}" — 抓取失败: ${(err as Error).message}`);
      }

      await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
      continue;
    }

    if (!content) {
      log('warn', `cv${cvid} "${title}" — 未提取到正文，跳过`);
      await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
      continue;
    }

    // 按关键词过滤（关键词为空则不过滤）
    if (keyword) {
      const fullText = title + '\n' + content;
      if (!fullText.includes(keyword)) {
        log('skip', `cv${cvid} "${title}"`);
        await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
        continue;
      }
    }

    // 关键词匹配 — 保存到文件
    try {
      const filepath = await writeArticle({ cvid, title, content });
      matchCount++;
      log('match', `cv${cvid} "${title}" → ${filepath}`);
    } catch (err) {
      log('error', `cv${cvid} "${title}" — 写入失败: ${(err as Error).message}`);
    }

    await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
  }

  log('info', `完成。匹配 ${matchCount} 篇，跳过 ${skipCount} 篇（已抓取），保存至 output/`);
}

main().catch((err: unknown) => {
  console.error('致命错误:', err);
  process.exit(1);
});
