import { DEFAULT_FONT_ID, getFontById } from '../shared/fonts.js';
import { DEFAULT_THEME_ID, getThemeById } from '../shared/themes.js';
import { clampNumber } from './utils.js';

export const DEFAULT_SETTINGS = {
  fontSize: 12,
  lineHeight: 1.5,
  projectLevel: 1,
  tabsToSpaces: true,
  theme: DEFAULT_THEME_ID,
  fontFamily: DEFAULT_FONT_ID,
  pageBreakMultiple: 1,
  outputMode: 'per-project',
  highlighter: 'highlightjs',
  showProjectHeader: true,
  showFileHeader: true,
  showFilePath: false,
  showPageNumbers: true,
  removeJavadoc: false,
  removeComments: false,
  collapseBlankLines: true,
  hideInitComponents: true,
  hideMain: true,
};

function toStringPayload(payload) {
  if (typeof payload === 'string') return payload;
  if (Buffer.isBuffer(payload)) return payload.toString('utf8');
  if (payload && typeof payload.toString === 'function') return payload.toString();
  return '';
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item) => typeof item === 'string');
  return items.length > 0 ? items : [];
}

function toBreakMultiple(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return [1, 2, 4, 8].includes(parsed) ? parsed : fallback;
}

export function parseSettings(payload) {
  let parsed = {};
  try {
    const raw = toStringPayload(payload);
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    parsed = {};
  }

  const fontSize = clampNumber(Number(parsed.fontSize), 9, 18, DEFAULT_SETTINGS.fontSize);
  const lineHeight = clampNumber(Number(parsed.lineHeight), 1.2, 2, DEFAULT_SETTINGS.lineHeight);
  const projectLevel = clampNumber(Number.parseInt(parsed.projectLevel, 10), 1, 3, DEFAULT_SETTINGS.projectLevel);
  const tabsToSpaces = toBoolean(parsed.tabsToSpaces, DEFAULT_SETTINGS.tabsToSpaces);
  const theme = getThemeById(parsed.theme).id;
  const fontFamily = getFontById(parsed.fontFamily).id;
  const pageBreakMultiple = toBreakMultiple(parsed.pageBreakMultiple, DEFAULT_SETTINGS.pageBreakMultiple);
  const includedFiles = toStringArray(parsed.includedFiles);
  const outputMode =
    parsed.outputMode === 'single' || parsed.outputMode === 'per-project'
      ? parsed.outputMode
      : DEFAULT_SETTINGS.outputMode;
  const highlighter = parsed.highlighter === 'highlightjs' ? 'highlightjs' : DEFAULT_SETTINGS.highlighter;
  const showProjectHeader = toBoolean(parsed.showProjectHeader, DEFAULT_SETTINGS.showProjectHeader);
  const showFileHeader = toBoolean(parsed.showFileHeader, DEFAULT_SETTINGS.showFileHeader);
  const showPageNumbers = toBoolean(parsed.showPageNumbers, DEFAULT_SETTINGS.showPageNumbers);
  const removeJavadoc = toBoolean(parsed.removeJavadoc, DEFAULT_SETTINGS.removeJavadoc);
  const removeComments = toBoolean(parsed.removeComments, DEFAULT_SETTINGS.removeComments);
  const collapseBlankLines = toBoolean(parsed.collapseBlankLines, DEFAULT_SETTINGS.collapseBlankLines);
  const hideInitComponents = toBoolean(parsed.hideInitComponents, DEFAULT_SETTINGS.hideInitComponents);
  const hideMain = toBoolean(parsed.hideMain, DEFAULT_SETTINGS.hideMain);
  const showFilePath = showFileHeader ? toBoolean(parsed.showFilePath, DEFAULT_SETTINGS.showFilePath) : false;

  return {
    fontSize,
    lineHeight,
    projectLevel,
    tabsToSpaces,
    theme,
    fontFamily,
    pageBreakMultiple,
    includedFiles,
    outputMode,
    highlighter,
    showProjectHeader,
    showFileHeader,
    showFilePath,
    showPageNumbers,
    removeJavadoc,
    removeComments,
    collapseBlankLines,
    hideInitComponents,
    hideMain,
  };
}
