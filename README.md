# javasourceprinter

Java Source Printer turns a zip full of Java projects into syntax-highlighted PDFs. It parses the zip in the browser for preview, then sends the zip and settings to a stateless Node backend that renders PDFs and streams the download.

## Features
- Upload a zip containing multiple top-level project folders.
- Configure the project folder level when the zip nests projects deeper.
- Parse embedded `.umz` archives (created by Unimozer Next) inside the uploaded zip and include their `.java` files (one nesting level; nested `.umz` inside `.umz` are ignored).
- Ignore hidden/macOS metadata files (for example entries under `__MACOSX` and files whose basename starts with `.`).
- Overview grouped by project, sorted by project then file name.
- Preview with adjustable font size, line height, color scheme, and font family.
- Filters: remove JavaDoc, remove comments, collapse blank lines, hide initComponents(), hide main(), tabs to spaces.
- Per-file include checkboxes with preview selection.
- Output as a single PDF or a zip of per-project PDFs, with optional per-project page padding.
- Optional headers (project and file name/full path) and footer page numbers.
- Render progress with a live radial indicator (per-file progress).
- Highlighting via highlight.js with built-in themes: atom-one-light, arduino-light, stackoverflow-light, vs, monochrome.
- Settings persist in localStorage with a reset-to-defaults action.
- No files retained on the server (temp files are deleted after each request).

## Development

```
npm install
npm run playwright:install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://127.0.0.1:3001`

## Lint

```
npm run lint
npm run lint:fix
```

## Build

```
npm run build
```

## Deployment

See `deploy/README-DEPLOY.md`.

## Related Project

Unimozer Next: https://github.com/haan/UnimozerNext
