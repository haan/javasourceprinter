export const DEFAULT_THEME_ID = 'atom-one-light';

export const THEMES = [
  {
    id: 'atom-one-light',
    label: 'Atom One Light',
    file: 'atom-one-light.css',
  },
  {
    id: 'arduino-light',
    label: 'Arduino Light',
    file: 'arduino-light.css',
  },
  {
    id: 'stackoverflow-light',
    label: 'Stack Overflow Light',
    file: 'stackoverflow-light.css',
  },
  {
    id: 'vs',
    label: 'VS',
    file: 'vs.css',
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    file: 'monochrome.css',
  },
];

export function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export function getThemeOptions() {
  return THEMES.map((theme) => ({ id: theme.id, label: theme.label }));
}
