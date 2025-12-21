import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import archiver from 'archiver';
import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { config } from './config.js';
import { parseSettings } from './settings.js';
import { saveUploadToTemp, readJavaProjects } from './zip.js';
import { baseNameWithoutExtension, sanitizeFilename, UserError } from './utils.js';
import { applyFilters } from '../shared/filters.js';
import {
  buildFileHtml,
  buildFooterTemplate,
  buildHeaderTemplate,
  buildPdfOptions,
  closeSharedBrowser,
  createPdfRenderer,
  createRenderContext,
} from './render.js';

const app = fastify({ logger: false });
const RENDER_CONCURRENCY = Math.max(1, config.renderConcurrency);

if (process.env.NODE_ENV !== 'production') {
  app.register(cors, { origin: true });
}

app.register(multipart, {
  limits: {
    fileSize: config.maxZipBytes,
    files: 1,
  },
});

app.get('/api/health', async () => ({ status: 'ok' }));

async function renderFilePdf({ file, projectName, settings, renderer, theme, highlighter }) {
  const filteredFile = {
    ...file,
    content: applyFilters(file.content, settings),
  };
  const html = buildFileHtml({
    file: filteredFile,
    theme,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    highlighter,
  });
  const headerTemplate = buildHeaderTemplate({
    settings,
    projectName,
    fileName: file.name,
    filePath: file.path,
  });
  const footerTemplate = buildFooterTemplate({ settings });
  const pdfOptions = buildPdfOptions({ headerTemplate, footerTemplate });
  return renderer.render(html, pdfOptions);
}

async function mapWithConcurrency(items, limit, mapper) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const launch = () => {
      while (active < limit && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        active += 1;
        Promise.resolve(mapper(items[currentIndex], currentIndex))
          .then((result) => {
            results[currentIndex] = result;
            active -= 1;
            if (nextIndex >= items.length && active === 0) {
              resolve(results);
              return;
            }
            launch();
          })
          .catch(reject);
      }
    };

    launch();
  });
}

async function appendPdfPages(targetDoc, pdfBuffer) {
  const sourceDoc = await PDFDocument.load(pdfBuffer);
  const pageIndices = sourceDoc.getPageIndices();
  const pages = await targetDoc.copyPages(sourceDoc, pageIndices);
  pages.forEach((page) => targetDoc.addPage(page));
  const pageCount = pageIndices.length;
  const pageSize = pageCount > 0 ? sourceDoc.getPage(0).getSize() : null;
  return { pageCount, pageSize };
}

function insertPaddingPages(targetDoc, pageCount, pageSize, multiple) {
  if (multiple <= 1 || pageCount === 0) return;
  const remainder = pageCount % multiple;
  if (remainder === 0) return;
  const padding = multiple - remainder;
  const fallbackSize = { width: 595.28, height: 841.89 };
  const size = pageSize || fallbackSize;
  for (let i = 0; i < padding; i += 1) {
    targetDoc.addPage([size.width, size.height]);
  }
}

app.post('/api/render', async (request, reply) => {
  const parts = request.parts();
  let uploadInfo = null;
  let settingsPayload = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'zip') {
      if (uploadInfo) {
        throw new UserError('Only one zip file is allowed.', 400);
      }
      uploadInfo = await saveUploadToTemp(part, config);
    }
    if (part.type === 'field' && part.fieldname === 'settings') {
      settingsPayload = part.value;
    }
  }

  if (!uploadInfo) {
    throw new UserError('Zip file is required.', 400);
  }

  const settings = parseSettings(settingsPayload);
  const { tempDir, zipPath, originalName } = uploadInfo;

  try {
    const projects = await readJavaProjects(zipPath, config);
    const renderer = await createPdfRenderer();

    try {
      const { theme, highlighter } = await createRenderContext(settings);

      if (settings.outputMode === 'single') {
        const merged = await PDFDocument.create();
        const fileQueue = projects.flatMap((project) =>
          project.files.map((file) => ({
            projectName: project.name,
            file,
          })),
        );
        const pdfBuffers = await mapWithConcurrency(fileQueue, RENDER_CONCURRENCY, (item) =>
          renderFilePdf({
            file: item.file,
            projectName: item.projectName,
            settings,
            renderer,
            theme,
            highlighter,
          }),
        );
        for (let index = 0; index < pdfBuffers.length; index += 1) {
          const pdf = pdfBuffers[index];
          const { pageCount, pageSize } = await appendPdfPages(merged, pdf);
          if (index < pdfBuffers.length - 1) {
            insertPaddingPages(merged, pageCount, pageSize, settings.pageBreakMultiple);
          }
        }

        const pdf = Buffer.from(await merged.save());
        const fileName = `${baseNameWithoutExtension(originalName)}.pdf`;

        reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(pdf);
      }

      const zipName = `${baseNameWithoutExtension(originalName)}.zip`;
      reply.type('application/zip').header('Content-Disposition', `attachment; filename="${zipName}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (error) => reply.raw.destroy(error));
      reply.send(archive);

      for (const project of projects) {
        const merged = await PDFDocument.create();
        const pdfBuffers = await mapWithConcurrency(project.files, RENDER_CONCURRENCY, (file) =>
          renderFilePdf({
            file,
            projectName: project.name,
            settings,
            renderer,
            theme,
            highlighter,
          }),
        );
        for (let index = 0; index < pdfBuffers.length; index += 1) {
          const pdf = pdfBuffers[index];
          const { pageCount, pageSize } = await appendPdfPages(merged, pdf);
          if (index < pdfBuffers.length - 1) {
            insertPaddingPages(merged, pageCount, pageSize, settings.pageBreakMultiple);
          }
        }

        const pdf = Buffer.from(await merged.save());
        const pdfName = `${sanitizeFilename(project.name, 'project')}.pdf`;
        archive.append(pdf, { name: pdfName });
      }

      await archive.finalize();
      return reply;
    } finally {
      await renderer.close();
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error.';
  reply.code(statusCode).send({ error: message });
});

async function shutdown() {
  try {
    await app.close();
  } catch (error) {
    console.error('Error closing server', error);
  }

  try {
    await closeSharedBrowser();
  } catch (error) {
    console.error('Error closing browser', error);
  }
}

process.once('SIGINT', () => {
  shutdown().finally(() => process.exit(0));
});

process.once('SIGTERM', () => {
  shutdown().finally(() => process.exit(0));
});

process.once('beforeExit', (code) => {
  shutdown().finally(() => process.exit(code));
});

app.listen({ host: config.host, port: config.port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
