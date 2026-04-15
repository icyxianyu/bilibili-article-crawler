/**
 * Utility helpers: sleep, sanitizeFilename, log
 */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomSleep(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}

export function sanitizeFilename(name, maxLength = 100) {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, maxLength);
}

export function log(level, ...args) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    skip: '[SKIP]',
    match: '[MATCH]',
  }[level] ?? `[${level.toUpperCase()}]`;
  console.log(`${time} ${prefix}`, ...args);
}
