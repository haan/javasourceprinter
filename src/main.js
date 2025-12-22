import './index.css';
import JSZip from 'jszip';
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import { DEFAULT_FONT_ID, getFontById, getFontOptions } from '../shared/fonts.js';
import { DEFAULT_THEME_ID, getThemeOptions } from '../shared/themes.js';
import { applyHighlightTheme } from './theme-loader.js';
import { applyFilters } from '../shared/filters.js';

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
  projectLevel: document.querySelector('#project-level'),
  fontSize: document.querySelector('#font-size'),
  fontSizeValue: document.querySelector('#font-size-value'),
  lineHeight: document.querySelector('#line-height'),
  lineHeightValue: document.querySelector('#line-height-value'),
  tabsToSpacesToggle: document.querySelector('#tabs-to-spaces-toggle'),
  themeSelect: document.querySelector('#theme-select'),
  fontSelect: document.querySelector('#font-select'),
  pageBreakSelect: document.querySelector('#page-break-select'),
  outputToggle: document.querySelector('#output-toggle'),
  headerProjectToggle: document.querySelector('#header-project-toggle'),
  headerFileToggle: document.querySelector('#header-file-toggle'),
  headerPathToggle: document.querySelector('#header-path-toggle'),
  footerPageToggle: document.querySelector('#footer-page-toggle'),
  filterJavadocToggle: document.querySelector('#filter-javadoc-toggle'),
  filterCommentsToggle: document.querySelector('#filter-comments-toggle'),
  filterBlankLinesToggle: document.querySelector('#filter-blanklines-toggle'),
  filterInitComponentsToggle: document.querySelector('#filter-initcomponents-toggle'),
  filterMainToggle: document.querySelector('#filter-main-toggle'),
  downloadBtn: document.querySelector('#download-btn'),
  status: document.querySelector('#status'),
  progressWrap: document.querySelector('#progress-wrap'),
  progressRing: document.querySelector('#progress-ring'),
  progressValue: document.querySelector('#progress-value'),
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
  },
};

let activeEventSource = null;

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

function showProgress() {
  elements.progressWrap.classList.remove('hidden');
}

function hideProgress() {
  elements.progressWrap.classList.add('hidden');
}

function updateProgress(completed, total) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  elements.progressRing.style.setProperty('--value', percent);
  elements.progressValue.textContent = `${percent}%`;
}

function closeEventSource() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
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

function updatePreviewFontFamily() {
  const font = getFontById(state.settings.fontFamily);
  elements.codeBlock.style.fontFamily = font.css;
}

function syncHeaderPathToggle() {
  const canShowPath = state.settings.showFileHeader;
  elements.headerPathToggle.disabled = !canShowPath;
  if (!canShowPath) {
    state.settings.showFilePath = false;
    elements.headerPathToggle.checked = false;
  }
}

function renderFileList() {
  elements.fileList.innerHTML = '';
  state.fileIndex.clear();

  if (state.projects.length === 0) {
    elements.fileList.innerHTML = '<p class="text-xs text-base-content/60">Upload a zip to see your Java files.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table table-pin-rows table-pin-cols w-full table-xs sm:table-sm table-fixed';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="w-1/4">Project</th>
      <th class="w-1/4">File</th>
      <th class="w-1/2">Path</th>
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
      pathCell.className = 'text-xs text-base-content/60 truncate';
      pathCell.title = file.path;
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

  const filteredContent = applyFilters(selection.file.content, state.settings);
  const highlighted = hljs.highlight(filteredContent, { language: 'java' }).value;
  elements.codeBlock.className = 'hljs language-java';
  elements.codeBlock.innerHTML = highlighted;
  updatePreviewFontSize();
  updatePreviewLineHeight();
  updatePreviewFontFamily();
}

function setSettings({
  projectLevel,
  fontSize,
  lineHeight,
  tabsToSpaces,
  theme,
  fontFamily,
  pageBreakMultiple,
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
}) {
  let needsPreviewRefresh = false;
  if (Number.isFinite(projectLevel)) {
    state.settings.projectLevel = projectLevel;
  }
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
  if (typeof tabsToSpaces === 'boolean') {
    state.settings.tabsToSpaces = tabsToSpaces;
    needsPreviewRefresh = true;
  }
  if (theme) {
    state.settings.theme = theme;
    applyHighlightTheme(theme);
    renderPreview();
  }
  if (fontFamily) {
    state.settings.fontFamily = fontFamily;
    updatePreviewFontFamily();
  }
  if (Number.isFinite(pageBreakMultiple)) {
    state.settings.pageBreakMultiple = pageBreakMultiple;
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
  if (typeof showFilePath === 'boolean') {
    if (state.settings.showFileHeader) {
      state.settings.showFilePath = showFilePath;
    } else {
      state.settings.showFilePath = false;
    }
  }
  syncHeaderPathToggle();
  if (typeof showPageNumbers === 'boolean') {
    state.settings.showPageNumbers = showPageNumbers;
  }
  if (typeof removeJavadoc === 'boolean') {
    state.settings.removeJavadoc = removeJavadoc;
    needsPreviewRefresh = true;
  }
  if (typeof removeComments === 'boolean') {
    state.settings.removeComments = removeComments;
    needsPreviewRefresh = true;
  }
  if (typeof collapseBlankLines === 'boolean') {
    state.settings.collapseBlankLines = collapseBlankLines;
    needsPreviewRefresh = true;
  }
  if (typeof hideInitComponents === 'boolean') {
    state.settings.hideInitComponents = hideInitComponents;
    needsPreviewRefresh = true;
  }
  if (typeof hideMain === 'boolean') {
    state.settings.hideMain = hideMain;
    needsPreviewRefresh = true;
  }

  if (needsPreviewRefresh) {
    renderPreview();
  }
}

async function parseZip(file, projectLevel = state.settings.projectLevel) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectMap = new Map();
  const level = Math.min(3, Math.max(1, Number(projectLevel) || 1));

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!entry.name.toLowerCase().endsWith('.java')) continue;

    const normalizedPath = entry.name.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < level + 1) continue;

    const projectName = segments[level - 1];
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
          content: `package demo.app;\n\npublic class Main {\n  /**\n   * Entry point for demo-app.\n   */\n  public static void main(String[] args) {\n    System.out.println(\"Hello from demo-app\");\n  }\n}\n`,
        },
        {
          name: 'Config.java',
          path: 'demo-app/src/Config.java',
          content: `package demo.app;\n\npublic final class Config {\n  public static final String ENV = \"dev\";\n\n  // Feature flags\n  public static final boolean ENABLE_METRICS = true;\n\n  /*\n   * Multi-line comment to demonstrate filtering.\n   */\n  public static final int MAX_RETRIES = 3;\n\n  private Config() {}\n}\n`,
        },
        {
          name: 'Startup.java',
          path: 'demo-app/src/Startup.java',
          content: `package demo.app;\n\npublic final class Startup {\n  private Startup() {}\n\n  public static boolean ready() {\n    return true;\n  }\n}\n`,
        },
      ],
    },
    {
      name: 'demo-lib',
      files: [
        {
          name: 'MathUtils.java',
          path: 'demo-lib/src/MathUtils.java',
          content: `package demo.lib;\n\npublic final class MathUtils {\n\tprivate MathUtils() {}\n\n\tpublic static int multiply(int a, int b) {\n\t\treturn a * b;\n\t}\n}\n`,
        },
        {
          name: 'CollectionUtils.java',
          path: 'demo-lib/src/CollectionUtils.java',
          content: `package demo.lib;\n\nimport java.util.List;\n\npublic final class CollectionUtils {\n  private CollectionUtils() {}\n\n  public static boolean isEmpty(List<?> list) {\n    return list == null || list.isEmpty();\n  }\n}\n`,
        },
        {
          name: 'Library.java',
          path: 'demo-lib/src/Library.java',
          content: `package demo.lib;\n\npublic class Library {\n  public String version() {\n    return \"1.0.0\";\n  }\n}\n`,
        },
      ],
    },
    {
      name: 'demo-service',
      files: [
        {
          name: 'ApiClient.java',
          path: 'demo-service/src/ApiClient.java',
          content: `package demo.service;\n\npublic class ApiClient {\n  /**\n   * Fetches data from the service.\n   */\n  public String fetch(String endpoint) {\n    return \"ok\";\n  }\n}\n`,
        },
        {
          name: 'RetryPolicy.java',
          path: 'demo-service/src/RetryPolicy.java',
          content: `package demo.service;\n\npublic final class RetryPolicy {\n  private final int maxAttempts;\n\n  public RetryPolicy(int maxAttempts) {\n    this.maxAttempts = maxAttempts;\n  }\n\n  public boolean shouldRetry(int attempt) {\n    return attempt < maxAttempts;\n  }\n}\n`,
        },
        {
          name: 'ServiceStatus.java',
          path: 'demo-service/src/ServiceStatus.java',
          content: `package demo.service;\n\npublic enum ServiceStatus {\n  STARTING,\n  RUNNING,\n  STOPPED\n}\n`,
        },
      ],
    },
    {
      name: 'demo-ui',
      files: [
        {
          name: 'MainFrame.java',
          path: 'demo-ui/src/MainFrame.java',
          content: `package demo.ui;\n\npublic class MainFrame {\n  private void initComponents() {\n    // UI components would be configured here.\n    javax.swing.JButton button = new javax.swing.JButton();\n    button.setText(\"OK\");\n  }\n}\n`,
        },
        {
          name: 'Theme.java',
          path: 'demo-ui/src/Theme.java',
          content: `package demo.ui;\n\npublic final class Theme {\n  public static final String PRIMARY = \"#0f766e\";\n\n  private Theme() {}\n}\n`,
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
    const projects = await parseZip(state.pendingFile, state.settings.projectLevel);
    applyProjects(state.pendingFile, projects);
    showApp();
    setLandingStatus('');
    if (projects.length === 0) {
      setStatus(`No .java files found at project level ${state.settings.projectLevel}.`);
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
    const projects = await parseZip(file, state.settings.projectLevel);
    applyProjects(file, projects);
    if (projects.length === 0) {
      setStatus(`No .java files found at project level ${state.settings.projectLevel}.`);
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
  setStatus('Starting render...');
  showProgress();
  updateProgress(0, 0);
  closeEventSource();

  try {
    const formData = new FormData();
    formData.append('zip', state.zipFile, state.zipFile.name);
    formData.append('settings', JSON.stringify(state.settings));

    const response = await fetch('/api/render/start', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to start render.';
      try {
        const payload = await response.json();
        if (payload?.error) errorMessage = payload.error;
      } catch (err) {
        // Ignore parse errors.
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    const jobId = payload?.jobId;
    if (!jobId) {
      throw new Error('Render job was not created.');
    }

    activeEventSource = new EventSource(`/api/render/progress/${jobId}`);

    activeEventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        updateProgress(data.completed, data.total);
      } catch (error) {
        // Ignore parse errors.
      }
    });

    activeEventSource.addEventListener('done', async () => {
      closeEventSource();
      try {
        await downloadJob(jobId);
        setStatus('Download started.');
      } catch (error) {
        setStatus(error.message || 'Download failed.', true);
      } finally {
        setLoading(false);
        hideProgress();
      }
    });

    activeEventSource.addEventListener('failed', (event) => {
      let message = 'Render failed.';
      try {
        const data = JSON.parse(event.data);
        if (data?.error) message = data.error;
      } catch (error) {
        // Ignore parse errors.
      }
      setStatus(message, true);
      closeEventSource();
      setLoading(false);
      hideProgress();
    });

    activeEventSource.addEventListener('error', () => {
      setStatus('Lost connection to render progress.', true);
      closeEventSource();
      setLoading(false);
      hideProgress();
    });
  } catch (error) {
    setStatus(error.message || 'Download failed.', true);
    closeEventSource();
    setLoading(false);
    hideProgress();
  } finally {
    // handled in SSE callbacks
  }
}

async function downloadJob(jobId) {
  const response = await fetch(`/api/render/download/${jobId}`);
  if (!response.ok) {
    let errorMessage = 'Failed to download PDF.';
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

function setupFontOptions() {
  const options = getFontOptions();
  elements.fontSelect.innerHTML = options
    .map((option) => `<option value="${option.id}">${option.label}</option>`)
    .join('');
  elements.fontSelect.value = state.settings.fontFamily;
}

elements.zipInput.addEventListener('change', handleLandingZipChange);
elements.landingUpload.addEventListener('click', handleLandingUpload);
elements.landingDemo.addEventListener('click', handleDemoMode);
elements.zipInputApp.addEventListener('change', handleAppZipChange);
elements.changeZip.addEventListener('click', handleChangeZipClick);
elements.fileList.addEventListener('click', handleFileListClick);
elements.downloadBtn.addEventListener('click', handleDownload);

elements.projectLevel.addEventListener('input', async (event) => {
  const projectLevel = Number(event.target.value);
  setSettings({ projectLevel });
  if (!state.zipFile) return;
  setLoading(true);
  setStatus('Reading zip file...');
  try {
    const projects = await parseZip(state.zipFile, state.settings.projectLevel);
    applyProjects(state.zipFile, projects);
    if (projects.length === 0) {
      setStatus(`No .java files found at project level ${state.settings.projectLevel}.`);
    } else {
      setStatus('Preview ready.');
    }
  } catch (error) {
    setStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    setLoading(false);
  }
});

elements.fontSize.addEventListener('input', (event) => {
  setSettings({ fontSize: Number(event.target.value) });
});

elements.lineHeight.addEventListener('input', (event) => {
  setSettings({ lineHeight: Number(event.target.value) });
});

elements.tabsToSpacesToggle.addEventListener('change', (event) => {
  setSettings({ tabsToSpaces: event.target.checked });
});

elements.themeSelect.addEventListener('change', (event) => {
  setSettings({ theme: event.target.value });
});

elements.fontSelect.addEventListener('change', (event) => {
  setSettings({ fontFamily: event.target.value });
});

elements.pageBreakSelect.addEventListener('change', (event) => {
  setSettings({ pageBreakMultiple: Number(event.target.value) });
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

elements.headerPathToggle.addEventListener('change', (event) => {
  setSettings({ showFilePath: event.target.checked });
});

elements.footerPageToggle.addEventListener('change', (event) => {
  setSettings({ showPageNumbers: event.target.checked });
});

elements.filterJavadocToggle.addEventListener('change', (event) => {
  setSettings({ removeJavadoc: event.target.checked });
});

elements.filterCommentsToggle.addEventListener('change', (event) => {
  setSettings({ removeComments: event.target.checked });
});

elements.filterBlankLinesToggle.addEventListener('change', (event) => {
  setSettings({ collapseBlankLines: event.target.checked });
});

elements.filterInitComponentsToggle.addEventListener('change', (event) => {
  setSettings({ hideInitComponents: event.target.checked });
});

elements.filterMainToggle.addEventListener('change', (event) => {
  setSettings({ hideMain: event.target.checked });
});

setupThemeOptions();
setupFontOptions();
applyHighlightTheme(state.settings.theme);
updatePreviewFontSize();
updatePreviewLineHeight();
updatePreviewFontFamily();
setStatus('Upload a zip to begin.');
setLandingStatus('Select a zip or try the demo.');
showLanding();
elements.projectLevel.value = state.settings.projectLevel;
elements.outputToggle.checked = state.settings.outputMode === 'single';
elements.headerProjectToggle.checked = state.settings.showProjectHeader;
elements.headerFileToggle.checked = state.settings.showFileHeader;
elements.headerPathToggle.checked = state.settings.showFilePath;
elements.footerPageToggle.checked = state.settings.showPageNumbers;
elements.lineHeight.value = state.settings.lineHeight;
elements.lineHeightValue.textContent = `${state.settings.lineHeight}`;
elements.pageBreakSelect.value = String(state.settings.pageBreakMultiple);
elements.fontSelect.value = state.settings.fontFamily;
elements.filterJavadocToggle.checked = state.settings.removeJavadoc;
elements.filterCommentsToggle.checked = state.settings.removeComments;
elements.filterBlankLinesToggle.checked = state.settings.collapseBlankLines;
elements.filterInitComponentsToggle.checked = state.settings.hideInitComponents;
elements.filterMainToggle.checked = state.settings.hideMain;
elements.tabsToSpacesToggle.checked = state.settings.tabsToSpaces;
syncHeaderPathToggle();
