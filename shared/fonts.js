export const DEFAULT_FONT_ID = 'jetbrains-mono';

export const FONTS = [
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    css: '"JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    css: '"Fira Code", "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    css: '"Source Code Pro", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    css: '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    id: 'inconsolata',
    label: 'Inconsolata',
    css: '"Inconsolata", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  },
];

export function getFontById(id) {
  return FONTS.find((font) => font.id === id) || FONTS[0];
}

export function getFontOptions() {
  return FONTS.map((font) => ({ id: font.id, label: font.label }));
}
