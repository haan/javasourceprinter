import path from 'node:path';

export class UserError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function sanitizeFilename(name, fallback = 'file') {
  const base = path.basename(String(name || fallback)).normalize('NFC');
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '');
  return cleaned || fallback;
}

export function baseNameWithoutExtension(name, fallback = 'download') {
  const base = path.basename(name || fallback, path.extname(name || ''));
  return sanitizeFilename(base, fallback);
}

export function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}
