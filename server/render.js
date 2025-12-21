import { chromium } from 'playwright';
import { getHighlighter } from './highlighters/index.js';
import { loadTheme } from './theme-loader.js';

let sharedBrowser = null;
let sharedBrowserPromise = null;

async function getSharedBrowser() {
  if (sharedBrowser) return sharedBrowser;
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium
      .launch({
        args: ['--no-sandbox'],
      })
      .then((browser) => {
        sharedBrowser = browser;
        return browser;
      })
      .catch((error) => {
        sharedBrowserPromise = null;
        throw error;
      });
  }
  return sharedBrowserPromise;
}

export async function closeSharedBrowser() {
  if (sharedBrowserPromise) {
    try {
      const browser = await sharedBrowserPromise;
      await browser.close();
    } finally {
      sharedBrowser = null;
      sharedBrowserPromise = null;
    }
    return;
  }

  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } finally {
      sharedBrowser = null;
      sharedBrowserPromise = null;
    }
  }
}

const FONT_STACK =
  '"JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
const HEADER_FONT_STACK =
  'JetBrains Mono, Fira Code, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildHeaderTemplate({ settings, projectName, fileName, filePath }) {
  if (!settings.showProjectHeader && !settings.showFileHeader) return null;
  const headerFontSize = Math.max(8, settings.fontSize - 1);
  const left = settings.showProjectHeader ? escapeHtml(projectName) : '';
  const showPath = settings.showFileHeader && settings.showFilePath;
  const right = settings.showFileHeader
    ? escapeHtml(showPath ? filePath || fileName : fileName)
    : '';
  const rightStyle = showPath
    ? 'flex:2 1 66.6667%; min-width:0; white-space:normal; overflow-wrap:anywhere; word-break:break-word; text-align:right;'
    : 'flex:2 1 66.6667%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;';
  return `
    <div style="width:100%; font-family:${HEADER_FONT_STACK}; font-size:${headerFontSize}px; letter-spacing:-0.05em; padding:7mm 14mm; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; gap:12px; width:100%;">
        <span style="flex:1 1 33.3333%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${left}</span>
        <span style="${rightStyle}">${right}</span>
      </div>
    </div>
  `;
}

export function buildFooterTemplate({ settings }) {
  if (!settings.showPageNumbers) return null;
  return `
    <div style="width:100%; font-family:${HEADER_FONT_STACK}; font-size:${settings.fontSize}px; padding:7mm 14mm; box-sizing:border-box;">
      <div style="width:100%; text-align:center;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    </div>
  `;
}

export function buildFileHtml({ file, theme, fontSize, lineHeight, highlighter }) {
  const highlighted = highlighter.highlight(file.content, 'java');
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${theme.css}
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background: ${theme.colors.background};
            color: ${theme.colors.color};
            font-family: ${FONT_STACK};
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          pre,
          code,
          .hljs {
            font-family: ${FONT_STACK};
            font-size: ${fontSize}px;
          }
          .hljs * {
            font-size: inherit;
          }
          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            overflow-wrap: anywhere;
            background: transparent;
          }
        </style>
      </head>
      <body>
        <pre><code class="hljs language-java">${highlighted}</code></pre>
      </body>
    </html>
  `;
}

export async function createPdfRenderer() {
  const browser = await getSharedBrowser();

  return {
    async render(html, options = {}) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        ...options,
      });
      await page.close();
      return buffer;
    },
    async close() {
      // Intentionally no-op: the shared browser is reused across requests.
    },
  };
}

export async function createRenderContext(settings) {
  const theme = await loadTheme(settings.theme);
  const highlighter = getHighlighter(settings.highlighter);
  return { theme, highlighter };
}

export function buildPdfOptions({ headerTemplate, footerTemplate }) {
  const hasHeader = Boolean(headerTemplate);
  const hasFooter = Boolean(footerTemplate);
  if (!hasHeader && !hasFooter) {
    return {
      margin: {
        top: '18mm',
        right: '14mm',
        bottom: '18mm',
        left: '14mm',
      },
      displayHeaderFooter: false,
    };
  }

  return {
    margin: {
      top: hasHeader ? '25mm' : '18mm',
      right: '14mm',
      bottom: hasFooter ? '25mm' : '18mm',
      left: '14mm',
    },
    displayHeaderFooter: true,
    headerTemplate: headerTemplate || '<div></div>',
    footerTemplate: footerTemplate || '<div></div>',
  };
}
