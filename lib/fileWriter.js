/**
 * Write article content to a .txt file with a metadata header.
 */

import fs from 'fs/promises';
import path from 'path';
import { sanitizeFilename } from './utils.js';

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

/**
 * Ensure the output directory exists.
 */
export async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

/**
 * Check whether an article file already exists in the output directory.
 *
 * @param {{ cvid: number, title: string }} article
 * @returns {boolean} true if the file already exists
 */
export async function articleExists({ cvid, title }) {
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
 * Write a single article to a .txt file.
 *
 * @param {{ cvid: number, title: string, content: string }} article
 */
export async function writeArticle({ cvid, title, content }) {
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
