import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';

hljs.registerLanguage('java', java);

export const name = 'highlightjs';

export function highlight(code, language = 'java') {
  return hljs.highlight(code, { language }).value;
}
