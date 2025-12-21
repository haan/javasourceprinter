import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { sanitizeFilename, UserError } from './utils.js';

export async function saveUploadToTemp(filePart, config) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), config.tempPrefix));
  const safeName = sanitizeFilename(filePart.filename || 'upload.zip', 'upload.zip');
  const zipPath = path.join(tempDir, safeName);

  await pipeline(filePart.file, fs.createWriteStream(zipPath));
  return { tempDir, zipPath, originalName: filePart.filename || 'upload.zip' };
}

export async function readJavaProjects(zipPath, config) {
  const directory = await unzipper.Open.file(zipPath);
  const projectMap = new Map();
  let totalBytes = 0;
  let fileCount = 0;

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const normalizedPath = entry.path.replace(/\\/g, '/');
    if (!normalizedPath.toLowerCase().endsWith('.java')) continue;
    if (normalizedPath.startsWith('/') || normalizedPath.includes('..')) continue;

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    fileCount += 1;
    if (fileCount > config.maxFileCount) {
      throw new UserError('Too many Java files in the zip.', 413);
    }

    const entrySize = Number(entry.uncompressedSize);
    const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
    if (hasEntrySize && entrySize > config.maxFileBytes) {
      throw new UserError('A Java file exceeds the allowed size.', 413);
    }
    if (hasEntrySize) {
      totalBytes += entrySize;
      if (totalBytes > config.maxTotalBytes) {
        throw new UserError('Total Java source size exceeds the allowed limit.', 413);
      }
    }

    const buffer = await entry.buffer();
    if (buffer.length > config.maxFileBytes) {
      throw new UserError('A Java file exceeds the allowed size.', 413);
    }

    if (!hasEntrySize) {
      totalBytes += buffer.length;
      if (totalBytes > config.maxTotalBytes) {
        throw new UserError('Total Java source size exceeds the allowed limit.', 413);
      }
    } else if (buffer.length !== entrySize) {
      totalBytes += buffer.length - entrySize;
      if (totalBytes > config.maxTotalBytes) {
        throw new UserError('Total Java source size exceeds the allowed limit.', 413);
      }
    }

    const projectName = segments[0];
    const fileName = segments[segments.length - 1];
    const content = buffer.toString('utf8');

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }

    projectMap.get(projectName).push({
      name: fileName,
      path: normalizedPath,
      content,
    });
  }

  if (fileCount === 0) {
    throw new UserError('No .java files found at the top-level projects.', 422);
  }

  const projects = Array.from(projectMap.entries())
    .map(([name, files]) => ({
      name,
      files: files.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        return nameCompare !== 0 ? nameCompare : a.path.localeCompare(b.path, 'en', { sensitivity: 'base' });
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return projects;
}
