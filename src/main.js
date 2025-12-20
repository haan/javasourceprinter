import './index.css';
import JSZip from 'jszip';
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import { DEFAULT_THEME_ID, getThemeOptions } from '../shared/themes.js';
import { applyHighlightTheme } from './theme-loader.js';

hljs.registerLanguage('java', java);

const elements = {
  landing: document.querySelector('#landing'),
  app: document.querySelector('#app'),
  zipInput: document.querySelector('#zip-input'),
  zipInputApp: document.querySelector('#zip-input-app'),
  landingMeta: document.querySelector('#landing-meta'),
  landingUpload: document.querySelector('#landing-upload'),
  landingDemo: document.querySelector('#landing-demo'),
  landingStatus: document.querySelector('#landing-status'),
  zipMeta: document.querySelector('#zip-meta'),
  changeZip: document.querySelector('#change-zip'),
  fileCount: document.querySelector('#file-count'),
  fileList: document.querySelector('#file-list'),
  fontSize: document.querySelector('#font-size'),
  fontSizeValue: document.querySelector('#font-size-value'),
  lineHeight: document.querySelector('#line-height'),
  lineHeightValue: document.querySelector('#line-height-value'),
  themeSelect: document.querySelector('#theme-select'),
  outputToggle: document.querySelector('#output-toggle'),
  headerProjectToggle: document.querySelector('#header-project-toggle'),
  headerFileToggle: document.querySelector('#header-file-toggle'),
  footerPageToggle: document.querySelector('#footer-page-toggle'),
  downloadBtn: document.querySelector('#download-btn'),
  status: document.querySelector('#status'),
  previewTitle: document.querySelector('#preview-title'),
  previewMeta: document.querySelector('#preview-meta'),
  previewWrapper: document.querySelector('#preview-wrapper'),
  codeBlock: document.querySelector('#code-block'),
  downloadSpinner: document.querySelector('#download-spinner'),
};

const state = {
  zipFile: null,
  pendingFile: null,
  demoMode: false,
  projects: [],
  selectedFileId: null,
  fileIndex: new Map(),
  settings: {
    fontSize: 12,
    lineHeight: 1.5,
    theme: DEFAULT_THEME_ID,
    outputMode: 'per-project',
    highlighter: 'highlightjs',
    showProjectHeader: true,
    showFileHeader: true,
    showPageNumbers: true,
  },
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('text-error', isError);
}

function setLandingStatus(message, isError = false) {
  elements.landingStatus.textContent = message;
  elements.landingStatus.classList.toggle('text-error', isError);
}

function showLanding() {
  elements.landing.classList.remove('hidden');
  elements.app.classList.add('hidden');
}

function showApp() {
  elements.landing.classList.add('hidden');
  elements.app.classList.remove('hidden');
}

function setLoading(isLoading) {
  elements.downloadSpinner.classList.toggle('hidden', !isLoading);
  elements.downloadBtn.disabled = isLoading || !state.zipFile || state.projects.length === 0;
}

function updateCounts() {
  const totalFiles = state.projects.reduce((sum, project) => sum + project.files.length, 0);
  const projectCount = state.projects.length;
  elements.fileCount.textContent = `${totalFiles} file${totalFiles === 1 ? '' : 's'} / ${projectCount} project${projectCount === 1 ? '' : 's'}`;
}

function updatePreviewFontSize() {
  elements.codeBlock.style.fontSize = `${state.settings.fontSize}px`;
}

function updatePreviewLineHeight() {
  elements.codeBlock.style.lineHeight = `${state.settings.lineHeight}`;
}

function renderFileList() {
  elements.fileList.innerHTML = '';
  state.fileIndex.clear();

  if (state.projects.length === 0) {
    elements.fileList.innerHTML = '<p class="text-xs text-base-content/60">Upload a zip to see your Java files.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table table-pin-rows table-pin-cols w-full';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Project</th>
      <th>File</th>
      <th>Path</th>
    </tr>
  `;

  const tbody = document.createElement('tbody');

  for (const project of state.projects) {
    project.files.forEach((file, index) => {
      const fileId = `${project.name}:::${file.path}`;
      state.fileIndex.set(fileId, { project, file });

      const row = document.createElement('tr');
      row.dataset.fileId = fileId;
      row.className = 'cursor-pointer';
      const isSelected = fileId === state.selectedFileId;

      if (index === 0) {
        const projectCell = document.createElement('td');
        projectCell.className = 'font-medium align-top';
        projectCell.textContent = project.name;
        projectCell.rowSpan = project.files.length;
        projectCell.dataset.projectCell = project.name;
        row.appendChild(projectCell);
      }

      const fileCell = document.createElement('td');
      fileCell.textContent = file.name;
      if (isSelected) {
        fileCell.classList.add('bg-primary/10');
      }

      const pathCell = document.createElement('td');
      pathCell.className = 'text-xs text-base-content/60';
      pathCell.textContent = file.path;
      if (isSelected) {
        pathCell.classList.add('bg-primary/10');
      }

      row.appendChild(fileCell);
      row.appendChild(pathCell);
      tbody.appendChild(row);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  elements.fileList.appendChild(table);

  if (state.selectedFileId) {
    const selectedProject = state.fileIndex.get(state.selectedFileId)?.project?.name;
    if (selectedProject) {
      const projectCell = table.querySelector(`td[data-project-cell="${CSS.escape(selectedProject)}"]`);
      if (projectCell) {
        projectCell.classList.add('bg-primary/10');
      }
    }
  }
}

function renderPreview() {
  const selection = state.fileIndex.get(state.selectedFileId);
  if (!selection) {
    elements.previewTitle.textContent = 'Select a file';
    elements.previewMeta.textContent = '';
    elements.codeBlock.textContent = '';
    return;
  }

  elements.previewTitle.textContent = selection.file.name;
  elements.previewMeta.textContent = selection.project.name;

  elements.codeBlock.className = 'hljs language-java';
  elements.codeBlock.textContent = selection.file.content;
  updatePreviewFontSize();
  delete elements.codeBlock.dataset.highlighted;
  hljs.highlightElement(elements.codeBlock);
}

function setSettings({
  fontSize,
  lineHeight,
  theme,
  outputMode,
  highlighter,
  showProjectHeader,
  showFileHeader,
  showPageNumbers,
}) {
  if (fontSize) {
    state.settings.fontSize = fontSize;
    elements.fontSizeValue.textContent = `${fontSize} px`;
    updatePreviewFontSize();
  }
  if (lineHeight) {
    state.settings.lineHeight = lineHeight;
    elements.lineHeightValue.textContent = `${lineHeight}`;
    updatePreviewLineHeight();
  }
  if (theme) {
    state.settings.theme = theme;
    applyHighlightTheme(theme);
    renderPreview();
  }
  if (outputMode) {
    state.settings.outputMode = outputMode;
  }
  if (highlighter) {
    state.settings.highlighter = highlighter;
  }
  if (typeof showProjectHeader === 'boolean') {
    state.settings.showProjectHeader = showProjectHeader;
  }
  if (typeof showFileHeader === 'boolean') {
    state.settings.showFileHeader = showFileHeader;
  }
  if (typeof showPageNumbers === 'boolean') {
    state.settings.showPageNumbers = showPageNumbers;
  }
}

async function parseZip(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectMap = new Map();

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!entry.name.toLowerCase().endsWith('.java')) continue;

    const normalizedPath = entry.name.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    const projectName = segments[0];
    const fileName = segments[segments.length - 1];
    const content = await entry.async('text');

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }

    projectMap.get(projectName).push({
      name: fileName,
      path: normalizedPath,
      content,
    });
  }

  const projects = Array.from(projectMap.entries())
    .map(([name, files]) => ({
      name,
      files: files.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        return nameCompare !== 0 ? nameCompare : a.path.localeCompare(b.path, 'en', { sensitivity: 'base' });
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return projects;
}

function applyProjects(file, projects) {
  state.zipFile = file;
  state.projects = projects;
  state.demoMode = false;
  resetLandingSelection();
  state.selectedFileId = projects[0]?.files[0]
    ? `${projects[0].name}:::${projects[0].files[0].path}`
    : null;

  elements.zipMeta.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  updateCounts();
  renderFileList();
  renderPreview();
  elements.downloadBtn.disabled = !state.zipFile || state.projects.length === 0;
}

function resetLandingSelection() {
  state.pendingFile = null;
  elements.landingMeta.textContent = 'No file selected.';
  elements.landingUpload.disabled = true;
}

function updateLandingSelection(file) {
  state.pendingFile = file;
  elements.landingMeta.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  elements.landingUpload.disabled = false;
}

function handleLandingZipChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    resetLandingSelection();
    return;
  }
  updateLandingSelection(file);
  setLandingStatus('');
}

function getDemoProjects() {
  return [
    {
      name: 'demo-app',
      files: [
        {
          name: 'Main.java',
          path: 'demo-app/src/Main.java',
          content: `package demo;\n\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from demo-app\");\n  }\n}\n`,
        },
        {
          name: 'Utils.java',
          path: 'demo-app/src/Utils.java',
          content: `package demo;\n\npublic final class Utils {\n  private Utils() {}\n\n  public static int add(int a, int b) {\n    return a + b;\n  }\n}\n`,
        },
      ],
    },
    {
      name: 'demo-lib',
      files: [
        {
          name: 'Library.java',
          path: 'demo-lib/src/Library.java',
          content: `package demo.lib;\n\npublic class Library {\n  public String version() {\n    return \"1.0.0\";\n  }\n}\n`,
        },
      ],
    },
  ];
}

async function handleLandingUpload() {
  if (!state.pendingFile) {
    setLandingStatus('Select a zip before uploading.', true);
    return;
  }

  elements.landingUpload.disabled = true;
  setLandingStatus('Reading zip file...');
  try {
    const projects = await parseZip(state.pendingFile);
    applyProjects(state.pendingFile, projects);
    showApp();
    setLandingStatus('');
    if (projects.length === 0) {
      setStatus('No .java files found at the top-level projects.');
    } else {
      setStatus('Preview ready.');
    }
  } catch (error) {
    setLandingStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    elements.landingUpload.disabled = !state.pendingFile;
  }
}

async function handleAppZipChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setLoading(true);
  setStatus('Reading zip file...');
  try {
    const projects = await parseZip(file);
    applyProjects(file, projects);
    if (projects.length === 0) {
      setStatus('No .java files found at the top-level projects.');
    } else {
      setStatus('Preview ready.');
    }
  } catch (error) {
    setStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    event.target.value = '';
    setLoading(false);
  }
}

function handleChangeZipClick() {
  elements.zipInputApp.click();
}

function handleDemoMode() {
  const projects = getDemoProjects();
  state.zipFile = null;
  state.demoMode = true;
  state.projects = projects;
  state.selectedFileId = projects[0]?.files[0]
    ? `${projects[0].name}:::${projects[0].files[0].path}`
    : null;

  elements.zipMeta.textContent = 'Demo mode';
  updateCounts();
  renderFileList();
  renderPreview();
  elements.downloadBtn.disabled = true;
  setStatus('Demo mode: upload a zip to generate PDFs.');
  showApp();
}

function handleFileListClick(event) {
  const row = event.target.closest('tr[data-file-id]');
  if (!row) return;
  state.selectedFileId = row.dataset.fileId;
  renderFileList();
  renderPreview();
}

async function handleDownload() {
  if (!state.zipFile) return;
  setLoading(true);
  setStatus('Generating PDF...');

  try {
    const formData = new FormData();
    formData.append('zip', state.zipFile, state.zipFile.name);
    formData.append('settings', JSON.stringify(state.settings));

    const response = await fetch('/api/render', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate PDF.';
      try {
        const payload = await response.json();
        if (payload?.error) errorMessage = payload.error;
      } catch (err) {
        // Ignore parse errors.
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const fallbackName = getFallbackFilename();
    const downloadName = getFilenameFromDisposition(response.headers.get('content-disposition')) || fallbackName;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    setStatus('Download started.');
  } catch (error) {
    setStatus(error.message || 'Download failed.', true);
  } finally {
    setLoading(false);
  }
}

function getFilenameFromDisposition(value) {
  if (!value) return null;
  const match = value.match(/filename="([^"]+)"/i);
  return match ? match[1] : null;
}

function getFallbackFilename() {
  const base = state.zipFile?.name?.replace(/\.zip$/i, '') || 'java-source';
  return state.settings.outputMode === 'single' ? `${base}.pdf` : `${base}.zip`;
}

function setupThemeOptions() {
  const options = getThemeOptions();
  elements.themeSelect.innerHTML = options
    .map((option) => `<option value="${option.id}">${option.label}</option>`)
    .join('');
  elements.themeSelect.value = state.settings.theme;
}

elements.zipInput.addEventListener('change', handleLandingZipChange);
elements.landingUpload.addEventListener('click', handleLandingUpload);
elements.landingDemo.addEventListener('click', handleDemoMode);
elements.zipInputApp.addEventListener('change', handleAppZipChange);
elements.changeZip.addEventListener('click', handleChangeZipClick);
elements.fileList.addEventListener('click', handleFileListClick);
elements.downloadBtn.addEventListener('click', handleDownload);

elements.fontSize.addEventListener('input', (event) => {
  setSettings({ fontSize: Number(event.target.value) });
});

elements.lineHeight.addEventListener('input', (event) => {
  setSettings({ lineHeight: Number(event.target.value) });
});

elements.themeSelect.addEventListener('change', (event) => {
  setSettings({ theme: event.target.value });
});

elements.outputToggle.addEventListener('change', (event) => {
  setSettings({ outputMode: event.target.checked ? 'single' : 'per-project' });
});

elements.headerProjectToggle.addEventListener('change', (event) => {
  setSettings({ showProjectHeader: event.target.checked });
});

elements.headerFileToggle.addEventListener('change', (event) => {
  setSettings({ showFileHeader: event.target.checked });
});

elements.footerPageToggle.addEventListener('change', (event) => {
  setSettings({ showPageNumbers: event.target.checked });
});

setupThemeOptions();
applyHighlightTheme(state.settings.theme);
updatePreviewFontSize();
updatePreviewLineHeight();
setStatus('Upload a zip to begin.');
setLandingStatus('Select a zip or try the demo.');
showLanding();
elements.outputToggle.checked = state.settings.outputMode === 'single';
elements.headerProjectToggle.checked = state.settings.showProjectHeader;
elements.headerFileToggle.checked = state.settings.showFileHeader;
elements.footerPageToggle.checked = state.settings.showPageNumbers;
elements.lineHeight.value = state.settings.lineHeight;
elements.lineHeightValue.textContent = `${state.settings.lineHeight}`;
