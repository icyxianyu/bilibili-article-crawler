#!/usr/bin/env node
/**
 * clean.ts — 清洗 output/ 下所有 .txt 文件中的 HTML 标签，转为纯文本
 *
 * Usage:
 *   npm run clean          # 清洗所有含 HTML 的文件
 */

import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { log } from './lib/utils.js';

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);

  // 删除图片、figure、figcaption（对文本无意义）
  $('img, figure, figcaption, style, script').remove();

  // 把 <br> 转换为换行
  $('br').replaceWith('\n');

  // 每个 <p> 末尾加换行
  $('p').each((_, el) => {
    $(el).append('\n');
  });

  let text = $('body').text();

  // 清理多余空行（保留最多一个空行）
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

async function main(): Promise<void> {
  let files: string[];
  try {
    files = (await fs.readdir(OUTPUT_DIR)).filter(f => f.endsWith('.txt'));
  } catch {
    log('error', `Cannot read directory: ${OUTPUT_DIR}`);
    process.exit(1);
  }

  log('info', `Found ${files.length} files in output/`);

  let cleaned = 0;
  let skipped = 0;

  for (const file of files) {
    const filepath = path.join(OUTPUT_DIR, file);
    const content = await fs.readFile(filepath, 'utf-8');

    // 跳过不含 HTML 标签的文件
    if (!/<[a-z][\s\S]*>/i.test(content)) {
      skipped++;
      continue;
    }

    // 保留元数据头（标题/URL/抓取时间/分隔线）
    const lines = content.split('\n');
    const sepIndex = lines.findIndex(l => l.startsWith('─'));
    const header = lines.slice(0, sepIndex + 1).join('\n');
    const body = lines.slice(sepIndex + 1).join('\n');

    const cleanBody = htmlToPlainText(body);
    await fs.writeFile(filepath, header + '\n\n' + cleanBody, 'utf-8');
    cleaned++;
  }

  log('info', `Done. Cleaned: ${cleaned}, Already clean: ${skipped}`);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
