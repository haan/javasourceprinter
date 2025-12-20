import { highlight, name } from './highlightjs.js';

const registry = {
  [name]: {
    id: name,
    highlight,
  },
};

export function getHighlighter(id) {
  return registry[id] || registry[name];
}
