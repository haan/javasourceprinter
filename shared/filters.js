function collapseBlankLines(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const result = [];
  let previousBlank = false;

  for (const line of lines) {
    const isBlank = line.trim() === '';
    if (isBlank) {
      if (!previousBlank) {
        result.push('');
        previousBlank = true;
      }
    } else {
      result.push(line);
      previousBlank = false;
    }
  }

  return result.join(newline);
}

function stripComments(text, removeJavadoc) {
  const placeholders = [];
  let working = text;

  if (!removeJavadoc) {
    working = working.replace(/\/\*\*[\s\S]*?\*\//g, (match) => {
      const key = `__JAVADOC_PLACEHOLDER_${placeholders.length}__`;
      placeholders.push(match);
      return key;
    });
  }

  working = working.replace(/\/\*[\s\S]*?\*\//g, '');
  working = working.replace(/(^|[^:])\/\/.*$/gm, '$1');

  if (!removeJavadoc) {
    placeholders.forEach((comment, index) => {
      const key = `__JAVADOC_PLACEHOLDER_${index}__`;
      working = working.replace(key, comment);
    });
  }

  return working;
}

function removeInitComponents(text) {
  const signature = 'private void initComponents()';
  let index = 0;
  let result = '';

  while (index < text.length) {
    const matchIndex = text.indexOf(signature, index);
    if (matchIndex === -1) {
      result += text.slice(index);
      break;
    }

    result += text.slice(index, matchIndex);
    let cursor = matchIndex + signature.length;
    const openBraceIndex = text.indexOf('{', cursor);
    if (openBraceIndex === -1) {
      result += text.slice(matchIndex);
      break;
    }

    cursor = openBraceIndex + 1;
    let depth = 1;
    while (cursor < text.length && depth > 0) {
      const char = text[cursor];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      cursor += 1;
    }

    result += `${signature} {\n    // initComponents() hidden\n  }\n`;
    index = cursor;
  }

  return result;
}

function replaceTabs(text, tabWidth = 4) {
  const spaces = ' '.repeat(tabWidth);
  return text.replace(/\t/g, spaces);
}

export function applyFilters(content, options = {}) {
  let text = content;
  const removeJavadoc = Boolean(options.removeJavadoc);
  const removeComments = Boolean(options.removeComments);
  const collapseBlanks = Boolean(options.collapseBlankLines);
  const hideInitComponents = Boolean(options.hideInitComponents);
  const tabsToSpaces = Boolean(options.tabsToSpaces);

  if (removeComments) {
    text = stripComments(text, removeJavadoc);
  } else if (removeJavadoc) {
    text = text.replace(/\/\*\*[\s\S]*?\*\//g, '');
  }

  if (hideInitComponents) {
    text = removeInitComponents(text);
  }

  if (collapseBlanks) {
    text = collapseBlankLines(text);
  }

  if (tabsToSpaces) {
    text = replaceTabs(text, 4);
  }

  return text;
}
