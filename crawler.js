#!/usr/bin/env node
/**
 * Bilibili Article Crawler
 *
 * Configuration (via .env file):
 *   BILIBILI_UID      — target user UID (required)
 *   BILIBILI_KEYWORD  — keyword to filter articles (optional, empty = crawl all)
 *   BILIBILI_COOKIE   — browser cookie for authenticated requests (recommended)
 *
 * Usage:
 *   node crawler.js
 *
 * Features:
 *   - Reads all config from .env, no CLI arguments needed
 *   - Keyword can be empty to crawl all articles from the user
 *   - Skips already-crawled articles (based on output files)
 *   - Auto retries on -509 / -352 with exponential backoff
 *   - Circuit breaker: after 3 consecutive -352 hits, enters long cooldown (5 min)
 */

import 'dotenv/config';
import { fetchArticleList, fetchArticleContent } from './lib/api.js';
import { writeArticle, ensureOutputDir, articleExists } from './lib/fileWriter.js';
import { randomSleep, log } from './lib/utils.js';

// ── Configuration ────────────────────────────────────────────────────────────
const LIST_DELAY_MS = 2000;           // delay between list page fetches
const ARTICLE_DELAY_MIN = 4000;       // min delay between article fetches
const ARTICLE_DELAY_MAX = 8000;       // max delay between article fetches
const MAX_RETRY = 3;                  // retries per request on risk-control error
const CIRCUIT_BREAKER_THRESHOLD = 3;  // consecutive -352 hits before long cooldown
const COOLDOWN_MS = 5 * 60 * 1000;   // 5 minutes cooldown after circuit breaker trips

// ── Helpers ──────────────────────────────────────────────────────────────────
function getRiskControlCode(err) {
  const msg = err?.message ?? '';
  if (msg.includes('-352')) return '-352';
  if (msg.includes('-509')) return '-509';
  return null;
}

async function runWithRiskRetry(label, requestFn) {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await requestFn();
    } catch (err) {
      const code = getRiskControlCode(err);
      if (!code || attempt === MAX_RETRY) throw err;

      const base = code === '-352' ? 15000 : 6000;
      const backoff = base * Math.pow(2, attempt - 1) + Math.random() * 3000;
      log('warn', `${label} — risk control ${code}, retry ${attempt}/${MAX_RETRY} in ${Math.round(backoff / 1000)}s …`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const uid = process.env.BILIBILI_UID?.trim();
  const keyword = (process.env.BILIBILI_KEYWORD ?? '').trim();

  if (!uid) {
    console.error('Error: BILIBILI_UID is required. Set it in .env file.');
    process.exit(1);
  }

  log('info', `UID: ${uid}  keyword: ${keyword ? `"${keyword}"` : '(empty — crawl all articles)'}`);
  await ensureOutputDir();

  // ── Step 1: collect all article metadata ────────────────────────────────
  const allArticles = [];
  let page = 1;
  let total = Infinity;

  while (allArticles.length < total) {
    log('info', `Fetching article list page ${page} …`);

    let result;
    try {
      result = await runWithRiskRetry(
        `list page ${page}`,
        () => fetchArticleList(uid, page),
      );
    } catch (err) {
      log('error', `Failed to fetch list page ${page}: ${err.message}`);
      break;
    }

    if (page === 1) {
      total = result.total;
      log('info', `Total articles reported by API: ${total}`);
    }

    if (result.articles.length === 0) break;

    allArticles.push(...result.articles);
    log('info', `Collected ${allArticles.length} / ${total} articles`);

    if (allArticles.length >= total) break;

    page++;
    await randomSleep(LIST_DELAY_MS, LIST_DELAY_MS + 1500);
  }

  log('info', `Finished collecting ${allArticles.length} articles. Starting content fetch …`);

  // ── Step 2: fetch content and filter by keyword ─────────────────────────
  let matchCount = 0;
  let skipCount = 0;
  let consecutive352 = 0;    // circuit breaker counter

  for (let i = 0; i < allArticles.length; i++) {
    const { id: cvid, title } = allArticles[i];

    // Skip already-crawled articles
    if (await articleExists({ cvid, title })) {
      skipCount++;
      log('skip', `cv${cvid} "${title}" — already crawled`);
      continue;
    }

    // Fetch content with retry
    let content;
    try {
      content = await runWithRiskRetry(
        `cv${cvid} "${title}"`,
        () => fetchArticleContent(cvid),
      );
      consecutive352 = 0; // reset on success
    } catch (err) {
      const code = getRiskControlCode(err);

      if (code === '-352') {
        consecutive352++;
        log('error', `cv${cvid} "${title}" — ${code} (consecutive: ${consecutive352}/${CIRCUIT_BREAKER_THRESHOLD})`);

        if (consecutive352 >= CIRCUIT_BREAKER_THRESHOLD) {
          log('warn', `🛑 Circuit breaker tripped! ${consecutive352} consecutive -352 errors.`);
          log('warn', `   Entering ${COOLDOWN_MS / 60000} min cooldown …`);
          await new Promise((r) => setTimeout(r, COOLDOWN_MS));
          consecutive352 = 0;
          log('info', `⏰ Cooldown over, resuming …`);
          i--; // retry the same article after cooldown
          continue;
        }
      } else {
        log('error', `cv${cvid} "${title}" — fetch failed: ${err.message}`);
      }

      await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
      continue;
    }

    if (!content) {
      log('warn', `cv${cvid} "${title}" — no content extracted, skipping`);
      await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
      continue;
    }

    // Filter by keyword (skip filtering if keyword is empty)
    if (keyword) {
      const fullText = title + '\n' + content;
      if (!fullText.includes(keyword)) {
        log('skip', `cv${cvid} "${title}"`);
        await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
        continue;
      }
    }

    // Keyword matched — save to file
    try {
      const filepath = await writeArticle({ cvid, title, content });
      matchCount++;
      log('match', `cv${cvid} "${title}" → ${filepath}`);
    } catch (err) {
      log('error', `cv${cvid} "${title}" — write failed: ${err.message}`);
    }

    await randomSleep(ARTICLE_DELAY_MIN, ARTICLE_DELAY_MAX);
  }

  log('info', `Done. ${matchCount} matched, ${skipCount} already crawled, saved to output/`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
