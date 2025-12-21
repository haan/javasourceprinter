# javasourceprinter

Java Source Printer turns a zip full of Java projects into syntax-highlighted PDFs. It parses the zip in the browser for preview, then sends the zip and settings to a stateless Node backend that renders PDFs and streams the download.

## Features
- Upload a zip containing multiple top-level project folders.
- Overview grouped by project, sorted by project then file name.
- Preview with adjustable font size, line height, and color scheme.
- Filters: remove JavaDoc, remove comments, collapse blank lines, hide initComponents, tabs to spaces.
- Output as a single PDF or a zip of per-project PDFs.
- Optional headers (project and file name) and footer page numbers.
- Render progress with a live radial indicator (per-file progress).
- Highlighting via highlight.js with built-in themes: atom-one-light, arduino-light, stackoverflow-light, vs, monochrome.
- No files retained on the server (temp files are deleted after each request).

## Development

```
npm install
npm run playwright:install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://127.0.0.1:3001`

## Build

```
npm run build
```

## Deployment

See `deploy/README-DEPLOY.md`.
