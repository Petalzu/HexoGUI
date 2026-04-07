const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  nativeTheme,
} = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const { spawn, execFile } = require("child_process");
const matter = require("gray-matter");

const APP_NAME = "Hexo 本地管理台";
const APP_DIR = path.resolve(__dirname);
const APP_PARENT_DIR = path.dirname(APP_DIR);
const LOCALES_DIR = path.join(APP_DIR, "locales");
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "zh"];
const DEFAULT_THEME = "dark";
const SUPPORTED_THEMES = ["dark", "light", "system"];

function normalizeLanguage(language) {
  const text = String(language || "")
    .trim()
    .toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(text)) {
    return text;
  }
  return DEFAULT_LANGUAGE;
}

function normalizeTheme(theme) {
  const text = String(theme || "")
    .trim()
    .toLowerCase();
  if (SUPPORTED_THEMES.includes(text)) {
    return text;
  }
  return DEFAULT_THEME;
}

function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function resolveEffectiveTheme(themeMode) {
  const mode = normalizeTheme(themeMode);
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

function getThemeState() {
  const mode = normalizeTheme(runtimeConfig.theme);
  return {
    mode,
    systemTheme: getSystemTheme(),
    effectiveTheme: resolveEffectiveTheme(mode),
    supportedThemes: [...SUPPORTED_THEMES],
  };
}

function emitSystemThemeChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("theme:system-changed", getThemeState());
}

function readLocaleFile(language) {
  const safeLang = normalizeLanguage(language);
  const filePath = path.join(LOCALES_DIR, `${safeLang}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_err) {
    return {};
  }
}

function getI18nBundle(language) {
  const selected = normalizeLanguage(language);
  return {
    language: selected,
    supportedLanguages: [...SUPPORTED_LANGUAGES],
    messages: {
      en: readLocaleFile("en"),
      zh: readLocaleFile("zh"),
    },
  };
}

function isHexoSiteFolder(dirPath) {
  try {
    const cfg = path.join(dirPath, "_config.yml");
    const source = path.join(dirPath, "source");
    const pkg = path.join(dirPath, "package.json");
    return (
      fs.existsSync(cfg) &&
      fs.existsSync(pkg) &&
      fs.existsSync(source) &&
      fs.statSync(source).isDirectory()
    );
  } catch (_err) {
    return false;
  }
}

function detectHexoSitesInFolder(parentDir) {
  if (!fs.existsSync(parentDir)) {
    return [];
  }
  const entries = fs.readdirSync(parentDir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(parentDir, entry.name);
    if (isHexoSiteFolder(full)) {
      result.push(full);
    }
  }
  return result;
}

function detectPreferredSiteRoot() {
  const candidates = detectHexoSitesInFolder(APP_PARENT_DIR);
  if (!candidates.length) {
    return process.cwd();
  }
  const preferredNames = ["petalzu.github.io", "blog", "hexo", "site"];
  for (const name of preferredNames) {
    const found = candidates.find(
      (dir) => path.basename(dir).toLowerCase() === name.toLowerCase(),
    );
    if (found) return found;
  }
  return candidates[0];
}

function defaultConfig() {
  const siteRoot = detectPreferredSiteRoot();
  return {
    language: DEFAULT_LANGUAGE,
    theme: DEFAULT_THEME,
    siteRoot,
    postsDir: "source/_posts",
    pagesDir: "source",
    imageRoots: ["source/images", "source/img"],
  };
}

function getConfigFilePath() {
  return path.join(app.getPath("userData"), "hexo-admin-config.json");
}

function normalizePathText(input) {
  return String(input || "").trim();
}

function normalizeImageRoots(list) {
  const unique = new Set();
  const output = [];
  const arr = Array.isArray(list) ? list : [];
  for (const item of arr) {
    const text = normalizePathText(item);
    if (!text) continue;
    const key = text.replace(/\\/g, "/").toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    output.push(text);
  }
  return output;
}

function readConfigFromDisk() {
  const cfgPath = getConfigFilePath();
  const base = defaultConfig();
  if (!fs.existsSync(cfgPath)) {
    return base;
  }
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    const parsed = JSON.parse(raw);
    const language = normalizeLanguage(parsed.language);
    const theme = normalizeTheme(parsed.theme);
    const siteRoot = normalizePathText(parsed.siteRoot) || base.siteRoot;
    const postsDir = normalizePathText(parsed.postsDir) || base.postsDir;
    const pagesDir = normalizePathText(parsed.pagesDir) || base.pagesDir;
    const imageRoots = normalizeImageRoots(parsed.imageRoots);

    return {
      language,
      theme,
      siteRoot,
      postsDir,
      pagesDir,
      imageRoots: imageRoots.length ? imageRoots : base.imageRoots,
    };
  } catch (_err) {
    return base;
  }
}

async function writeConfigToDisk(config) {
  const cfgPath = getConfigFilePath();
  await fsp.mkdir(path.dirname(cfgPath), { recursive: true });
  await fsp.writeFile(cfgPath, JSON.stringify(config, null, 2), "utf8");
}

let runtimeConfig = defaultConfig();

let mainWindow = null;
let hexoProcess = null;

function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        windowsHide: true,
      });
      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    try {
      process.kill(-pid, "SIGTERM");
    } catch (_err) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (_err2) {
        // ignore
      }
    }
    resolve();
  });
}

function getListeningPidsOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const psCmd = `Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`;
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", psCmd],
        { windowsHide: true },
        (_err, stdout) => {
          const pids = String(stdout || "")
            .split(/\r?\n/)
            .map((line) => Number(line.trim()))
            .filter((num) => Number.isInteger(num) && num > 0);
          resolve([...new Set(pids)]);
        },
      );
      return;
    }

    execFile(
      "sh",
      ["-lc", `lsof -ti tcp:${Number(port)} -sTCP:LISTEN || true`],
      {},
      (_err, stdout) => {
        const pids = String(stdout || "")
          .split(/\r?\n/)
          .map((line) => Number(line.trim()))
          .filter((num) => Number.isInteger(num) && num > 0);
        resolve([...new Set(pids)]);
      },
    );
  });
}

async function killPortListeners(port) {
  const pids = await getListeningPidsOnPort(port);
  for (const pid of pids) {
    if (pid === process.pid) continue;
    await killProcessTree(pid);
  }
}

function createApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Help",
      role: "help",
      submenu: [
        { label: "Author: Petalzu", enabled: false },
        {
          label: "GitHub: https://github.com/Petalzu",
          click: async () => {
            await shell.openExternal("https://github.com/Petalzu");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function resolveFromSite(p) {
  const text = normalizePathText(p);
  if (!text) {
    throw new Error("路径不能为空");
  }
  if (path.isAbsolute(text)) {
    return path.resolve(text);
  }
  return path.resolve(runtimeConfig.siteRoot, text);
}

function pathInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function ensureInside(parent, target) {
  const normalizedParent = path.resolve(parent);
  const normalizedTarget = path.resolve(target);
  if (normalizedParent === normalizedTarget) {
    return;
  }
  if (!pathInside(normalizedParent, normalizedTarget)) {
    throw new Error("路径越界，操作被拒绝");
  }
}

function getResolvedConfig() {
  const postsDir = resolveFromSite(runtimeConfig.postsDir);
  const pagesDir = resolveFromSite(runtimeConfig.pagesDir);
  const imageRoots = runtimeConfig.imageRoots.map((item) => ({
    key: item,
    absolute: resolveFromSite(item),
  }));
  return {
    siteRoot: path.resolve(runtimeConfig.siteRoot),
    postsDir,
    pagesDir,
    imageRoots,
  };
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeFrontMatterData(data) {
  const output = { ...data };
  output.tags = toArray(data.tags);
  output.categories = toArray(data.categories);

  if (!output.tags.length) {
    delete output.tags;
  }
  if (!output.categories.length) {
    delete output.categories;
  }

  Object.keys(output).forEach((key) => {
    if (output[key] === "" || output[key] == null) {
      delete output[key];
    }
  });

  return output;
}

function ensurePostFilename(filename) {
  let safeName = String(filename || "").trim();
  if (!safeName) {
    throw new Error("文件名不能为空");
  }
  if (!safeName.endsWith(".md")) {
    safeName += ".md";
  }
  if (safeName.includes("/") || safeName.includes("\\")) {
    throw new Error("文章文件名不能包含路径分隔符");
  }
  return safeName;
}

async function readPosts() {
  const cfg = getResolvedConfig();
  await fsp.mkdir(cfg.postsDir, { recursive: true });
  const names = await fsp.readdir(cfg.postsDir);
  const mdNames = names.filter((name) => name.toLowerCase().endsWith(".md"));

  const records = [];
  for (const name of mdNames) {
    const full = path.join(cfg.postsDir, name);
    const raw = await fsp.readFile(full, "utf8");
    const parsed = matter(raw);
    const data = parsed.data || {};
    records.push({
      filename: name,
      title: data.title || path.basename(name, ".md"),
      date: data.date || "",
      updated: data.updated || "",
      categories: toArray(data.categories),
      tags: toArray(data.tags),
      thumbnail: data.thumbnail || "",
      cover: data.cover || "",
    });
  }

  return records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function nowText() {
  const d = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

ipcMain.handle("site:get-basic", async () => {
  const cfg = getResolvedConfig();
  const sourceDir = path.join(cfg.siteRoot, "source");
  return {
    root: cfg.siteRoot,
    sourceDir,
    postsDir: cfg.postsDir,
    pagesDir: cfg.pagesDir,
    imageRoots: cfg.imageRoots.map((item) => item.key),
  };
});

ipcMain.handle("config:get", async () => {
  return { ...runtimeConfig };
});

ipcMain.handle("i18n:get-bundle", async () => {
  return getI18nBundle(runtimeConfig.language);
});

ipcMain.handle("i18n:set-language", async (_event, language) => {
  const nextLanguage = normalizeLanguage(language);
  runtimeConfig = {
    ...runtimeConfig,
    language: nextLanguage,
  };
  await writeConfigToDisk(runtimeConfig);
  return {
    ok: true,
    language: nextLanguage,
  };
});

ipcMain.handle("theme:set", async (_event, theme) => {
  const nextTheme = normalizeTheme(theme);
  runtimeConfig = {
    ...runtimeConfig,
    theme: nextTheme,
  };
  await writeConfigToDisk(runtimeConfig);
  return {
    ok: true,
    ...getThemeState(),
  };
});

ipcMain.handle("theme:get-state", async () => {
  return getThemeState();
});

ipcMain.handle("sites:detect-siblings", async () => {
  const sites = detectHexoSitesInFolder(APP_PARENT_DIR).map((dir) => ({
    name: path.basename(dir),
    path: dir,
  }));
  return {
    appDir: APP_DIR,
    appParentDir: APP_PARENT_DIR,
    sites,
  };
});

ipcMain.handle("sites:apply-sibling", async (_event, siteRoot) => {
  const selected = path.resolve(String(siteRoot || ""));
  if (!selected || !fs.existsSync(selected) || !isHexoSiteFolder(selected)) {
    throw new Error("所选目录不是有效的 Hexo 站点");
  }

  runtimeConfig = {
    language: runtimeConfig.language || DEFAULT_LANGUAGE,
    theme: runtimeConfig.theme || DEFAULT_THEME,
    siteRoot: selected,
    postsDir: "source/_posts",
    pagesDir: "source",
    imageRoots: ["source/images", "source/img"],
  };
  await writeConfigToDisk(runtimeConfig);
  return { ok: true, config: runtimeConfig };
});

ipcMain.handle("config:update", async (_event, payload) => {
  const next = {
    siteRoot: normalizePathText(payload.siteRoot),
    postsDir: normalizePathText(payload.postsDir),
    pagesDir: normalizePathText(payload.pagesDir),
    imageRoots: normalizeImageRoots(payload.imageRoots),
  };

  if (!next.siteRoot || !fs.existsSync(next.siteRoot)) {
    throw new Error("站点根目录不存在");
  }
  if (!fs.statSync(next.siteRoot).isDirectory()) {
    throw new Error("站点根目录不是文件夹");
  }
  if (!next.postsDir) {
    throw new Error("文章目录不能为空");
  }
  if (!next.pagesDir) {
    throw new Error("页面目录不能为空");
  }
  if (!next.imageRoots.length) {
    throw new Error("至少需要一个图片目录");
  }

  runtimeConfig = {
    language: runtimeConfig.language || DEFAULT_LANGUAGE,
    theme: runtimeConfig.theme || DEFAULT_THEME,
    siteRoot: path.resolve(next.siteRoot),
    postsDir: next.postsDir,
    pagesDir: next.pagesDir,
    imageRoots: next.imageRoots,
  };
  await writeConfigToDisk(runtimeConfig);
  return { ok: true, config: runtimeConfig };
});

ipcMain.handle("path:pick-folder", async (_event, initialPath) => {
  const target = normalizePathText(initialPath);
  const res = await dialog.showOpenDialog({
    title: "选择目录",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: target || runtimeConfig.siteRoot,
  });
  if (res.canceled || !res.filePaths.length) {
    return { canceled: true };
  }
  return { canceled: false, path: res.filePaths[0] };
});

ipcMain.handle("posts:list", async () => {
  return await readPosts();
});

ipcMain.handle("posts:get", async (_event, filename) => {
  const cfg = getResolvedConfig();
  const safeName = ensurePostFilename(filename);
  const full = path.join(cfg.postsDir, safeName);
  ensureInside(cfg.postsDir, full);
  const raw = await fsp.readFile(full, "utf8");
  const parsed = matter(raw);

  return {
    filename: safeName,
    title: parsed.data.title || "",
    date: parsed.data.date || "",
    updated: parsed.data.updated || "",
    categories: toArray(parsed.data.categories),
    tags: toArray(parsed.data.tags),
    thumbnail: parsed.data.thumbnail || "",
    cover: parsed.data.cover || "",
    toc: parsed.data.toc,
    content: parsed.content || "",
  };
});

ipcMain.handle("posts:create", async (_event, payload) => {
  const cfg = getResolvedConfig();
  const filename = ensurePostFilename(payload.filename);
  const full = path.join(cfg.postsDir, filename);
  ensureInside(cfg.postsDir, full);

  if (fs.existsSync(full)) {
    throw new Error("文件已存在，请更换文件名");
  }

  const date = payload.date || nowText();
  const updated = payload.updated || date;
  const data = normalizeFrontMatterData({
    title: payload.title,
    date,
    updated,
    tags: payload.tags,
    categories: payload.categories,
    thumbnail: payload.thumbnail,
    cover: payload.cover,
    toc: typeof payload.toc === "boolean" ? payload.toc : undefined,
  });

  const content = String(payload.content || "");
  const output = matter.stringify(content, data);
  await fsp.writeFile(full, output, "utf8");

  return { ok: true, filename };
});

ipcMain.handle("posts:update", async (_event, payload) => {
  const cfg = getResolvedConfig();
  const originalName = ensurePostFilename(
    payload.originalFilename || payload.filename,
  );
  const nextName = ensurePostFilename(payload.filename);
  const originalFull = path.join(cfg.postsDir, originalName);
  const nextFull = path.join(cfg.postsDir, nextName);

  ensureInside(cfg.postsDir, originalFull);
  ensureInside(cfg.postsDir, nextFull);

  if (!fs.existsSync(originalFull)) {
    throw new Error("要修改的文章不存在");
  }

  if (originalName !== nextName && fs.existsSync(nextFull)) {
    throw new Error("新的文件名已存在");
  }

  const oldRaw = await fsp.readFile(originalFull, "utf8");
  const oldParsed = matter(oldRaw);

  const date = payload.date || oldParsed.data.date || nowText();
  const updated = payload.updated || nowText();
  const data = normalizeFrontMatterData({
    ...oldParsed.data,
    title: payload.title,
    date,
    updated,
    tags: payload.tags,
    categories: payload.categories,
    thumbnail: payload.thumbnail,
    cover: payload.cover,
    toc: typeof payload.toc === "boolean" ? payload.toc : oldParsed.data.toc,
  });

  const content = String(payload.content || "");
  const output = matter.stringify(content, data);
  await fsp.writeFile(originalFull, output, "utf8");

  if (originalName !== nextName) {
    await fsp.rename(originalFull, nextFull);
  }

  return { ok: true, filename: nextName };
});

ipcMain.handle("posts:delete", async (_event, filename) => {
  const cfg = getResolvedConfig();
  const safeName = ensurePostFilename(filename);
  const full = path.join(cfg.postsDir, safeName);
  ensureInside(cfg.postsDir, full);

  if (!fs.existsSync(full)) {
    throw new Error("文章不存在");
  }

  await fsp.unlink(full);
  return { ok: true };
});

async function walkFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) {
    return result;
  }

  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(full);
      result.push(...nested);
    } else {
      result.push(full);
    }
  }
  return result;
}

function isImageFile(filePath) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(filePath);
}

function ensureRelativeMdPath(input) {
  let rel = String(input || "")
    .trim()
    .replace(/\\/g, "/");
  if (!rel) {
    throw new Error("页面文件路径不能为空");
  }
  if (rel.startsWith("/")) {
    rel = rel.slice(1);
  }
  if (!rel.toLowerCase().endsWith(".md")) {
    rel += ".md";
  }
  if (rel.includes("..")) {
    throw new Error("页面路径非法");
  }
  return rel;
}

async function readPages() {
  const cfg = getResolvedConfig();
  await fsp.mkdir(cfg.pagesDir, { recursive: true });
  const files = await walkFiles(cfg.pagesDir);
  const postsDir = path.resolve(cfg.postsDir);

  const pages = [];
  for (const full of files) {
    if (!full.toLowerCase().endsWith(".md")) continue;
    const abs = path.resolve(full);
    if (abs === postsDir || pathInside(postsDir, abs)) {
      continue;
    }
    const raw = await fsp.readFile(full, "utf8");
    const parsed = matter(raw);
    const rel = path.relative(cfg.pagesDir, full).replace(/\\/g, "/");
    pages.push({
      relativePath: rel,
      title: parsed.data.title || path.basename(rel, ".md"),
      date: parsed.data.date || "",
      updated: parsed.data.updated || "",
      categories: toArray(parsed.data.categories),
      tags: toArray(parsed.data.tags),
    });
  }

  pages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return pages;
}

ipcMain.handle("pages:list", async () => {
  return await readPages();
});

ipcMain.handle("pages:get", async (_event, relativePath) => {
  const cfg = getResolvedConfig();
  const safeRel = ensureRelativeMdPath(relativePath);
  const full = path.resolve(cfg.pagesDir, safeRel);
  ensureInside(cfg.pagesDir, full);

  const raw = await fsp.readFile(full, "utf8");
  const parsed = matter(raw);
  return {
    relativePath: safeRel,
    title: parsed.data.title || "",
    date: parsed.data.date || "",
    updated: parsed.data.updated || "",
    categories: toArray(parsed.data.categories),
    tags: toArray(parsed.data.tags),
    thumbnail: parsed.data.thumbnail || "",
    cover: parsed.data.cover || "",
    toc: parsed.data.toc,
    content: parsed.content || "",
  };
});

ipcMain.handle("pages:create", async (_event, payload) => {
  const cfg = getResolvedConfig();
  const rel = ensureRelativeMdPath(payload.relativePath);
  const full = path.resolve(cfg.pagesDir, rel);
  ensureInside(cfg.pagesDir, full);

  if (fs.existsSync(full)) {
    throw new Error("页面文件已存在");
  }

  await fsp.mkdir(path.dirname(full), { recursive: true });
  const date = payload.date || nowText();
  const updated = payload.updated || date;
  const data = normalizeFrontMatterData({
    title: payload.title,
    date,
    updated,
    tags: payload.tags,
    categories: payload.categories,
    thumbnail: payload.thumbnail,
    cover: payload.cover,
    toc: typeof payload.toc === "boolean" ? payload.toc : undefined,
  });
  const content = String(payload.content || "");
  const output = matter.stringify(content, data);
  await fsp.writeFile(full, output, "utf8");

  return { ok: true, relativePath: rel };
});

ipcMain.handle("pages:update", async (_event, payload) => {
  const cfg = getResolvedConfig();
  const originalRel = ensureRelativeMdPath(
    payload.originalRelativePath || payload.relativePath,
  );
  const nextRel = ensureRelativeMdPath(payload.relativePath);
  const originalFull = path.resolve(cfg.pagesDir, originalRel);
  const nextFull = path.resolve(cfg.pagesDir, nextRel);
  ensureInside(cfg.pagesDir, originalFull);
  ensureInside(cfg.pagesDir, nextFull);

  if (!fs.existsSync(originalFull)) {
    throw new Error("要修改的页面不存在");
  }
  if (originalRel !== nextRel && fs.existsSync(nextFull)) {
    throw new Error("新的页面文件路径已存在");
  }

  const oldRaw = await fsp.readFile(originalFull, "utf8");
  const oldParsed = matter(oldRaw);
  const date = payload.date || oldParsed.data.date || nowText();
  const updated = payload.updated || nowText();
  const data = normalizeFrontMatterData({
    ...oldParsed.data,
    title: payload.title,
    date,
    updated,
    tags: payload.tags,
    categories: payload.categories,
    thumbnail: payload.thumbnail,
    cover: payload.cover,
    toc: typeof payload.toc === "boolean" ? payload.toc : oldParsed.data.toc,
  });

  const content = String(payload.content || "");
  const output = matter.stringify(content, data);
  await fsp.mkdir(path.dirname(originalFull), { recursive: true });
  await fsp.writeFile(originalFull, output, "utf8");

  if (originalRel !== nextRel) {
    await fsp.mkdir(path.dirname(nextFull), { recursive: true });
    await fsp.rename(originalFull, nextFull);
  }
  return { ok: true, relativePath: nextRel };
});

ipcMain.handle("pages:delete", async (_event, relativePath) => {
  const cfg = getResolvedConfig();
  const rel = ensureRelativeMdPath(relativePath);
  const full = path.resolve(cfg.pagesDir, rel);
  ensureInside(cfg.pagesDir, full);
  if (!fs.existsSync(full)) {
    throw new Error("页面不存在");
  }
  await fsp.unlink(full);
  return { ok: true };
});

function findImageRootByKey(relativeRoot) {
  const cfg = getResolvedConfig();
  const selected = String(relativeRoot || cfg.imageRoots[0]?.key || "").trim();
  const root = cfg.imageRoots.find((item) => item.key === selected);
  if (!root) {
    throw new Error("无效的图片目录");
  }
  return { cfg, selected, root };
}

ipcMain.handle("images:list", async (_event, relativeRoot) => {
  const { cfg, selected, root } = findImageRootByKey(relativeRoot);
  const absRoot = root.absolute;

  await fsp.mkdir(absRoot, { recursive: true });
  const files = await walkFiles(absRoot);
  const images = files.filter(isImageFile).map((full) => {
    const relativePath = path.relative(absRoot, full).replace(/\\/g, "/");
    const sourceDir = path.join(cfg.siteRoot, "source");
    const inSource =
      path.resolve(full) === path.resolve(sourceDir)
        ? false
        : pathInside(sourceDir, full);
    const relFromSource = inSource
      ? path.relative(sourceDir, full).replace(/\\/g, "/")
      : "";
    return {
      absolute: full,
      relativeRoot: selected,
      relativePath,
      displayPath: `${selected.replace(/\\/g, "/")}/${relativePath}`,
      markdownPath: relFromSource ? `/${relFromSource}` : "",
      name: path.basename(full),
      size: fs.statSync(full).size,
    };
  });

  images.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
  return images;
});

ipcMain.handle("images:pick-local", async () => {
  const res = await dialog.showOpenDialog({
    title: "选择本地图片",
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: [
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
          "svg",
          "bmp",
          "ico",
          "avif",
        ],
      },
    ],
  });
  if (res.canceled || !res.filePaths.length) {
    return { canceled: true };
  }
  return { canceled: false, filePath: res.filePaths[0] };
});

ipcMain.handle("images:upload", async (_event, payload) => {
  const sourceFile = path.resolve(String(payload.sourceFile || ""));
  if (!fs.existsSync(sourceFile)) {
    throw new Error("本地图片不存在");
  }

  const { root } = findImageRootByKey(payload.relativeRoot);
  const rootAbs = root.absolute;

  const subFolder = String(payload.subFolder || "").trim();
  const targetDir = path.resolve(rootAbs, subFolder);
  ensureInside(rootAbs, targetDir);
  await fsp.mkdir(targetDir, { recursive: true });

  const targetName =
    String(payload.fileName || path.basename(sourceFile)).trim() ||
    path.basename(sourceFile);
  const targetFull = path.join(targetDir, targetName);
  ensureInside(rootAbs, targetFull);

  await fsp.copyFile(sourceFile, targetFull);
  return { ok: true };
});

ipcMain.handle("images:replace", async (_event, payload) => {
  const sourceFile = path.resolve(String(payload.sourceFile || ""));
  if (!fs.existsSync(sourceFile)) {
    throw new Error("本地图片不存在");
  }

  const { root } = findImageRootByKey(payload.relativeRoot);
  const relativePath = String(payload.relativePath || "").replace(/\\/g, "/");
  const targetFull = path.resolve(root.absolute, relativePath);
  ensureInside(root.absolute, targetFull);
  if (!fs.existsSync(targetFull)) {
    throw new Error("目标图片不存在");
  }

  await fsp.copyFile(sourceFile, targetFull);
  return { ok: true };
});

ipcMain.handle("images:delete", async (_event, payload) => {
  const { root } = findImageRootByKey(payload.relativeRoot);
  const relativePath = String(payload.relativePath || "").replace(/\\/g, "/");
  const targetFull = path.resolve(root.absolute, relativePath);
  ensureInside(root.absolute, targetFull);
  if (!fs.existsSync(targetFull)) {
    throw new Error("图片不存在");
  }
  await fsp.unlink(targetFull);
  return { ok: true };
});

function emitServerOutput(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server:output", text);
  }
}

ipcMain.handle("server:start", async () => {
  const cfg = getResolvedConfig();
  if (hexoProcess && !hexoProcess.killed) {
    return { ok: true, alreadyRunning: true };
  }

  if (process.platform === "win32") {
    hexoProcess = spawn(
      "cmd.exe",
      ["/d", "/s", "/c", "npm run server -- -p 4000"],
      {
        cwd: cfg.siteRoot,
        windowsHide: true,
      },
    );
  } else {
    hexoProcess = spawn("npm", ["run", "server", "--", "-p", "4000"], {
      cwd: cfg.siteRoot,
      shell: false,
      detached: true,
    });
  }

  hexoProcess.stdout.on("data", (chunk) => emitServerOutput(String(chunk)));
  hexoProcess.stderr.on("data", (chunk) => emitServerOutput(String(chunk)));
  hexoProcess.on("close", (code) => {
    emitServerOutput(`\n[hexo server exited] code=${code}\n`);
    hexoProcess = null;
  });

  return { ok: true, alreadyRunning: false };
});

ipcMain.handle("server:stop", async () => {
  const hadProcess = Boolean(hexoProcess && !hexoProcess.killed);

  if (hadProcess) {
    await killProcessTree(hexoProcess.pid);
  }

  await killPortListeners(4000);
  hexoProcess = null;
  return { ok: true, alreadyStopped: !hadProcess };
});

ipcMain.handle("server:status", async () => {
  return { running: Boolean(hexoProcess && !hexoProcess.killed) };
});

ipcMain.handle("server:open-preview", async () => {
  await shell.openExternal("http://localhost:4000");
  return { ok: true };
});

app.whenReady().then(() => {
  runtimeConfig = readConfigFromDisk();
  createApplicationMenu();
  nativeTheme.on("updated", () => {
    emitSystemThemeChanged();
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (hexoProcess && !hexoProcess.killed) {
    killProcessTree(hexoProcess.pid).catch(() => {});
  }
  killPortListeners(4000).catch(() => {});
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
