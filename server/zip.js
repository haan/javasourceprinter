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

export async function readJavaProjects(zipPath, config, projectLevel = 1) {
  const directory = await unzipper.Open.file(zipPath);
  const projectMap = new Map();
  let totalBytes = 0;
  let fileCount = 0;
  const level = Math.min(3, Math.max(1, Number.parseInt(projectLevel, 10) || 1));

  function addJavaFile(projectName, filePath, content) {
    fileCount += 1;
    if (fileCount > config.maxFileCount) {
      throw new UserError('Too many Java files in the zip.', 413);
    }

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }

    projectMap.get(projectName).push({
      name: path.basename(filePath),
      path: filePath,
      content,
    });
  }

  function addToTotalBytes(byteCount) {
    totalBytes += byteCount;
    if (totalBytes > config.maxTotalBytes) {
      throw new UserError('Total Java source size exceeds the allowed limit.', 413);
    }
  }

  async function processJavaEntry(entry, normalizedPath, projectName) {
    const entrySize = Number(entry.uncompressedSize);
    const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
    if (hasEntrySize && entrySize > config.maxFileBytes) {
      throw new UserError('A Java file exceeds the allowed size.', 413);
    }

    const buffer = await readEntryBuffer(entry, config, addToTotalBytes);
    addJavaFile(projectName, normalizedPath, buffer.toString('utf8'));
  }

  async function processUmzEntry(entry, normalizedPath, projectName) {
    const umzBuffer = await readEntryBuffer(entry, config, null);
    const nestedDirectory = await unzipper.Open.buffer(umzBuffer);

    for (const nestedEntry of nestedDirectory.files) {
      if (nestedEntry.type !== 'File') continue;
      const nestedPath = nestedEntry.path.replace(/\\/g, '/');
      if (!nestedPath.toLowerCase().endsWith('.java')) continue;
      if (nestedPath.startsWith('/') || nestedPath.includes('..')) continue;

      const combinedPath = `${normalizedPath}/${nestedPath}`;
      const entrySize = Number(nestedEntry.uncompressedSize);
      const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
      if (hasEntrySize && entrySize > config.maxFileBytes) {
        throw new UserError('A Java file exceeds the allowed size.', 413);
      }

      const javaBuffer = await readEntryBuffer(nestedEntry, config, addToTotalBytes);
      addJavaFile(projectName, combinedPath, javaBuffer.toString('utf8'));
    }
  }

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const normalizedPath = entry.path.replace(/\\/g, '/');
    if (normalizedPath.startsWith('/') || normalizedPath.includes('..')) continue;

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < level + 1) continue;
    const projectName = segments[level - 1];

    const lowerPath = normalizedPath.toLowerCase();
    if (lowerPath.endsWith('.java')) {
      await processJavaEntry(entry, normalizedPath, projectName);
      continue;
    }

    if (lowerPath.endsWith('.umz')) {
      await processUmzEntry(entry, normalizedPath, projectName);
    }
  }

  if (fileCount === 0) {
    throw new UserError(`No .java files found at project level ${level}.`, 422);
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

async function readEntryBuffer(entry, config, onChunk) {
  const chunks = [];
  let size = 0;
  const stream = entry.stream();

  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > config.maxFileBytes) {
        throw new UserError('A Java file exceeds the allowed size.', 413);
      }
      if (onChunk) {
        onChunk(chunk.length);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    stream.destroy();
    throw error;
  }

  return Buffer.concat(chunks, size);
}
