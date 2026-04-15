/**
 * 将文章内容写入 .txt 文件，带元数据头。
 */

import fs from 'fs/promises';
import path from 'path';
import { sanitizeFilename } from './utils.js';
import type { ArticleData } from './types.js';

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

/**
 * 确保输出目录存在。
 */
export async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

/**
 * 检查文章文件是否已存在于输出目录中。
 */
export async function articleExists({ cvid, title }: Pick<ArticleData, 'cvid' | 'title'>): Promise<boolean> {
  const safeTitle = sanitizeFilename(title);
  const filename = `${safeTitle}_cv${cvid}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将单篇文章写入 .txt 文件。
 */
export async function writeArticle({ cvid, title, content }: ArticleData): Promise<string> {
  await ensureOutputDir();

  const safeTitle = sanitizeFilename(title);
  const filename = `${safeTitle}_cv${cvid}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const fetchedAt = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const header = [
    `标题: ${title}`,
    `URL: https://www.bilibili.com/read/cv${cvid}`,
    `抓取时间: ${fetchedAt}`,
    '─'.repeat(60),
    '',
  ].join('\n');

  await fs.writeFile(filepath, header + content, 'utf-8');
  return filepath;
}
