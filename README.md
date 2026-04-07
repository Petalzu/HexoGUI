# Hexo Local Admin GUI

<p align="center">
  <img src="./HexoGUI.png" alt="HexoGUI" width="320" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-37.x-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Hexo-Local%20Manager-0E83CD?logo=hexo&logoColor=white" alt="Hexo" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-2ea44f" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

An Electron desktop app for managing a Hexo blog locally with a visual workflow.

It combines content operations and local preview in one place:
- Posts: create, edit, rename, delete
- Pages: create, edit, rename, delete
- Images: upload, replace, delete, copy markdown path
- Front-matter editing: title, date, updated, categories, tags, thumbnail, cover, toc
- One-click Hexo debug server + embedded preview
- Flexible path configuration (relative or absolute)
- Auto-detection of sibling Hexo sites

## Table of Contents

- [Hexo Local Admin GUI](#hexo-local-admin-gui)
  - [Table of Contents](#table-of-contents)
  - [Highlights](#highlights)
  - [Project Layout](#project-layout)
  - [Requirements](#requirements)
  - [Quick Start](#quick-start)
    - [1. Install dependencies](#1-install-dependencies)
    - [2. Run the app](#2-run-the-app)
  - [Configuration](#configuration)
  - [Usage Guide](#usage-guide)
    - [Path Settings](#path-settings)
    - [Posts](#posts)
    - [Pages](#pages)
    - [Images](#images)
    - [Local Debug](#local-debug)
  - [Security Notes](#security-notes)
  - [Development](#development)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
  - [License](#license)

## Highlights

- Fast local workflow for Hexo content maintenance
- GUI-first editing for markdown + front-matter
- Built-in server controls and runtime logs
- Safe filesystem guards for write operations

## Project Layout

```text
LocalPublisher/
  HexoGUI/                 # this app
    main.js
    preload.js
    renderer/
      index.html
      app.js
      styles.css
  petalzu.github.io/       # your Hexo site (example)
    _config.yml
    source/
    package.json
```

When these two folders are side-by-side, the app can detect the Hexo site automatically.

## Requirements

- Node.js 18+
- npm 9+
- A valid Hexo site folder containing:
  - `_config.yml`
  - `source/`
  - `package.json`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Run the app

```bash
npm start
```

## Configuration

Open **Path Settings** and configure:
- Site root
- Posts directory
- Pages directory
- Image roots (one per line)

You can use:
- Relative paths (relative to site root), or
- Absolute paths

Default values:
- Posts: `source/_posts`
- Pages: `source`
- Images: `source/images`, `source/img`

The app stores config in Electron user data:
- `hexo-admin-config.json`

## Usage Guide

### Path Settings

1. Click **Detect Sibling Sites**
2. Select a detected site
3. Click **Apply Site**
4. Click **Save Path Settings**

### Posts

- Search and browse existing posts
- Create markdown post files
- Edit front-matter + content
- Rename `.md` filename safely
- Delete selected post

### Pages

- Manage standalone markdown pages
- Supports nested path like `about/index.md`
- Same metadata editing experience as posts

### Images

- Switch between configured image roots
- Upload image from local disk
- Replace selected image file
- Delete selected image
- Copy markdown path when file is under `source`

### Local Debug

- Start/stop Hexo server from UI
- View server output logs
- Open preview in browser
- In-app iframe preview

## Security Notes

- Path traversal protection is implemented in backend handlers
- Renderer runs with `contextIsolation` enabled
- No direct Node integration in renderer
- File access is routed through controlled preload APIs

## Development

Scripts:

```json
{
  "start": "electron .",
  "dev": "electron ."
}
```

Main dependencies:
- Electron
- gray-matter
- Node.js `fs` / `path`

```bash
npm run build:portable
```

## Roadmap

- Draft autosave and recovery
- Batch image operations
- Better markdown preview tooling
- Export/import app configuration

## Contributing

Issues and pull requests are welcome.

Recommended steps:
1. Fork the repository
2. Create a feature branch
3. Commit with clear messages
4. Open a pull request with context and screenshots

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
