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
import {
  buildFileHtml,
  buildFooterTemplate,
  buildHeaderTemplate,
  buildPdfOptions,
  createPdfRenderer,
  createRenderContext,
} from './render.js';

const app = fastify({ logger: false });

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
  const html = buildFileHtml({
    file,
    theme,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    highlighter,
  });
  const headerTemplate = buildHeaderTemplate({
    settings,
    projectName,
    fileName: file.name,
  });
  const footerTemplate = buildFooterTemplate({ settings });
  const pdfOptions = buildPdfOptions({ headerTemplate, footerTemplate });
  return renderer.render(html, pdfOptions);
}

async function appendPdfPages(targetDoc, pdfBuffer) {
  const sourceDoc = await PDFDocument.load(pdfBuffer);
  const pages = await targetDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  pages.forEach((page) => targetDoc.addPage(page));
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
    const { theme, highlighter } = await createRenderContext(settings);

    try {
      if (settings.outputMode === 'single') {
        const merged = await PDFDocument.create();
        for (const project of projects) {
          for (const file of project.files) {
            const pdf = await renderFilePdf({
              file,
              projectName: project.name,
              settings,
              renderer,
              theme,
              highlighter,
            });
            await appendPdfPages(merged, pdf);
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
        for (const file of project.files) {
          const pdf = await renderFilePdf({
            file,
            projectName: project.name,
            settings,
            renderer,
            theme,
            highlighter,
          });
          await appendPdfPages(merged, pdf);
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

app.listen({ host: config.host, port: config.port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
