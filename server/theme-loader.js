import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getThemeById } from '../shared/themes.js';

const cache = new Map();
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const themesDir = path.join(projectRoot, 'shared', 'themes');

function extractThemeColors(css) {
  const colorMatch = css.match(/\.hljs\s*\{[^}]*color:\s*([^;]+);/);

  return {
    background: '#ffffff',
    color: colorMatch ? colorMatch[1].trim() : '#111111',
  };
}

export async function loadTheme(themeId) {
  const theme = getThemeById(themeId);
  if (cache.has(theme.id)) {
    return cache.get(theme.id);
  }

  const cssPath = path.join(themesDir, theme.file);
  const css = await fs.readFile(cssPath, 'utf8');
  const colors = extractThemeColors(css);

  const data = {
    id: theme.id,
    label: theme.label,
    css,
    colors,
  };

  cache.set(theme.id, data);
  return data;
}
