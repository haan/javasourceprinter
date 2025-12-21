function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: toInt(process.env.PORT, 3001),
  renderConcurrency: toInt(process.env.RENDER_CONCURRENCY, 2),
  maxZipBytes: toInt(process.env.MAX_ZIP_BYTES, 50 * 1024 * 1024),
  maxTotalBytes: toInt(process.env.MAX_TOTAL_BYTES, 50 * 1024 * 1024),
  maxFileBytes: toInt(process.env.MAX_FILE_BYTES, 2 * 1024 * 1024),
  maxFileCount: toInt(process.env.MAX_FILE_COUNT, 2000),
  tempPrefix: process.env.TMP_PREFIX || 'java-printer-',
};
