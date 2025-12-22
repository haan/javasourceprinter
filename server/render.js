import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DEFAULT_FONT_ID, getFontById } from '../shared/fonts.js';
import { config } from './config.js';
import { getHighlighter } from './highlighters/index.js';
import { loadTheme } from './theme-loader.js';

let sharedBrowser = null;
let sharedBrowserPromise = null;
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const fontFiles = [
  {
    family: 'JetBrains Mono',
    weight: 400,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'jetbrains-mono',
      'files',
      'jetbrains-mono-latin-400-normal.woff2',
    ),
  },
  {
    family: 'JetBrains Mono',
    weight: 600,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'jetbrains-mono',
      'files',
      'jetbrains-mono-latin-600-normal.woff2',
    ),
  },
  {
    family: 'Fira Code',
    weight: 400,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'fira-code',
      'files',
      'fira-code-latin-400-normal.woff2',
    ),
  },
  {
    family: 'Fira Code',
    weight: 600,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'fira-code',
      'files',
      'fira-code-latin-600-normal.woff2',
    ),
  },
  {
    family: 'Source Code Pro',
    weight: 400,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'source-code-pro',
      'files',
      'source-code-pro-latin-400-normal.woff2',
    ),
  },
  {
    family: 'Source Code Pro',
    weight: 600,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'source-code-pro',
      'files',
      'source-code-pro-latin-600-normal.woff2',
    ),
  },
  {
    family: 'IBM Plex Mono',
    weight: 400,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'ibm-plex-mono',
      'files',
      'ibm-plex-mono-latin-400-normal.woff2',
    ),
  },
  {
    family: 'IBM Plex Mono',
    weight: 600,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'ibm-plex-mono',
      'files',
      'ibm-plex-mono-latin-600-normal.woff2',
    ),
  },
  {
    family: 'Inconsolata',
    weight: 400,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'inconsolata',
      'files',
      'inconsolata-latin-400-normal.woff2',
    ),
  },
  {
    family: 'Inconsolata',
    weight: 600,
    file: path.join(
      projectRoot,
      'node_modules',
      '@fontsource',
      'inconsolata',
      'files',
      'inconsolata-latin-600-normal.woff2',
    ),
  },
];
const embeddedFontCssCache = new Map();

async function buildEmbeddedFontCss(family) {
  if (!family) return '';
  const rules = [];
  for (const font of fontFiles) {
    if (font.family !== family) continue;
    try {
      const data = await fs.readFile(font.file);
      const base64 = data.toString('base64');
      rules.push(
        `@font-face { font-family: "${font.family}"; font-style: normal; font-weight: ${font.weight}; src: url(data:font/woff2;base64,${base64}) format("woff2"); font-display: swap; }`,
      );
    } catch (error) {
    }
  }
  return rules.join('\n');
}

async function getEmbeddedFontCss(fontFamilyId) {
  const font = getFontById(fontFamilyId || DEFAULT_FONT_ID);
  const family = font?.label;
  if (!family) return '';
  if (!embeddedFontCssCache.has(family)) {
    embeddedFontCssCache.set(family, buildEmbeddedFontCss(family));
  }
  return embeddedFontCssCache.get(family);
}

async function getSharedBrowser() {
  if (sharedBrowser) return sharedBrowser;
  if (!sharedBrowserPromise) {
    const launchOptions = {};
    if (config.chromiumNoSandbox) {
      launchOptions.args = ['--no-sandbox'];
    }
    sharedBrowserPromise = chromium
      .launch(launchOptions)
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

function resolveFontStack(settings) {
  return getFontById(settings?.fontFamily || DEFAULT_FONT_ID).css;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildHeaderTemplate({ settings, projectName, fileName, filePath, fontCss }) {
  if (!settings.showProjectHeader && !settings.showFileHeader) return null;
  const headerFontSize = Math.max(8, settings.fontSize - 1);
  const fontStack = resolveFontStack(settings);
  const left = settings.showProjectHeader ? escapeHtml(projectName) : '';
  const showPath = settings.showFileHeader && settings.showFilePath;
  const right = settings.showFileHeader
    ? escapeHtml(showPath ? filePath || fileName : fileName)
    : '';
  const rightStyle = showPath
    ? 'flex:2 1 66.6667%; min-width:0; white-space:normal; overflow-wrap:anywhere; word-break:break-word; text-align:right;'
    : 'flex:2 1 66.6667%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;';
  const styleBlock = fontCss ? `<style>${fontCss}</style>` : '';
  return `
    ${styleBlock}
    <div style='width:100%; font-family:${fontStack}; font-size:${headerFontSize}px; line-height:${settings.lineHeight}; letter-spacing:-0.05em; padding:7mm 14mm; box-sizing:border-box;'>
      <div style="display:flex; justify-content:space-between; gap:12px; width:100%;">
        <span style="flex:1 1 33.3333%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${left}</span>
        <span style="${rightStyle}">${right}</span>
      </div>
    </div>
  `;
}

export function buildFooterTemplate({ settings, fontCss }) {
  if (!settings.showPageNumbers) return null;
  const fontStack = resolveFontStack(settings);
  const styleBlock = fontCss ? `<style>${fontCss}</style>` : '';
  return `
    ${styleBlock}
    <div style='width:100%; font-family:${fontStack}; font-size:${settings.fontSize}px; line-height:${settings.lineHeight}; padding:7mm 14mm; box-sizing:border-box;'>
      <div style="width:100%; text-align:center;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    </div>
  `;
}

export function buildFileHtml({ file, theme, fontSize, lineHeight, highlighter, fontFamily, fontCss }) {
  const highlighted = highlighter.highlight(file.content, 'java');
  const fontStack = resolveFontStack({ fontFamily });
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${fontCss || ''}
          ${theme.css}
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background: ${theme.colors.background};
            color: ${theme.colors.color};
            font-family: ${fontStack};
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          pre,
          code,
          .hljs {
            font-family: ${fontStack};
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
  const fontCss = await getEmbeddedFontCss(settings?.fontFamily);
  return { theme, highlighter, fontCss };
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
