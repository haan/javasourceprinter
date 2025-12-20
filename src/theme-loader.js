import { DEFAULT_THEME_ID } from '../shared/themes.js';
import atomOneLightUrl from '../shared/themes/atom-one-light.css?url';
import arduinoLightUrl from '../shared/themes/arduino-light.css?url';
import stackoverflowLightUrl from '../shared/themes/stackoverflow-light.css?url';
import vsUrl from '../shared/themes/vs.css?url';

const THEME_URLS = {
  'atom-one-light': atomOneLightUrl,
  'arduino-light': arduinoLightUrl,
  'stackoverflow-light': stackoverflowLightUrl,
  vs: vsUrl,
};

export function applyHighlightTheme(themeId) {
  const linkId = 'hljs-theme';
  let link = document.getElementById(linkId);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = linkId;
    document.head.appendChild(link);
  }
  link.href = THEME_URLS[themeId] || THEME_URLS[DEFAULT_THEME_ID];
}
