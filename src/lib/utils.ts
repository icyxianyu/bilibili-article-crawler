import type { LogLevel } from './types.js';

/** 等待指定毫秒 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 等待随机时间（minMs ~ maxMs 毫秒） */
export function randomSleep(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}

/** 清理文件名中的非法字符 */
export function sanitizeFilename(name: string, maxLength = 100): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, maxLength);
}

const LOG_PREFIX: Record<string, string> = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
  skip: '[SKIP]',
  match: '[MATCH]',
};

/** 打印带时间戳和级别前缀的日志 */
export function log(level: LogLevel | string, ...args: unknown[]): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const prefix = LOG_PREFIX[level] ?? `[${level.toUpperCase()}]`;
  console.log(`${time} ${prefix}`, ...args);
}
