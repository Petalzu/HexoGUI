const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const THEME_MODE_ORDER = ["dark", "light", "system"];
const THEME_MODE_SYMBOL = {
  dark: "🌙",
  light: "☀",
  system: "🅰",
};

const state = {
  config: null,
  themeMode: "dark",
  effectiveTheme: "dark",
  systemTheme: "dark",
  i18n: {
    language: "en",
    supportedLanguages: ["en", "zh"],
    messages: { en: {}, zh: {} },
  },
  siblingSites: [],
  posts: [],
  filteredPosts: [],
  selectedPost: null,
  pages: [],
  filteredPages: [],
  selectedPage: null,
  images: [],
  selectedImage: null,
  serverRunning: false,
};

function normalizeTheme(theme) {
  const text = String(theme || "")
    .trim()
    .toLowerCase();
  if (text === "light" || text === "dark" || text === "system") {
    return text;
  }
  return "dark";
}

function resolveEffectiveTheme(themeMode, systemTheme) {
  if (themeMode === "system") {
    return systemTheme === "light" ? "light" : "dark";
  }
  return themeMode === "light" ? "light" : "dark";
}

function renderQuickToggleButtons() {
  const langBtn = $("#lang-toggle-btn");
  if (langBtn) {
    langBtn.textContent =
      state.i18n.language === "zh" ? t("language.zh") : t("language.en");
  }

  const themeBtn = $("#theme-toggle-btn");
  if (themeBtn) {
    const mode = normalizeTheme(state.themeMode);
    const symbol = THEME_MODE_SYMBOL[mode] || "🅰";
    themeBtn.textContent = `${symbol} ${t(`theme.${mode}`)}`;
  }
}

function applyThemeMode(themeMode, options = {}) {
  const nextMode = normalizeTheme(themeMode);
  if (options.systemTheme) {
    state.systemTheme = options.systemTheme === "light" ? "light" : "dark";
  }
  const effective = resolveEffectiveTheme(nextMode, state.systemTheme);
  state.themeMode = nextMode;
  state.effectiveTheme = effective;
  document.documentElement.setAttribute("data-theme", effective);
  renderQuickToggleButtons();
}

function applyLanguage(language) {
  const next =
    String(language || "en")
      .trim()
      .toLowerCase() === "zh"
      ? "zh"
      : "en";
  state.i18n.language = next;
  renderQuickToggleButtons();
}

function getNestedMessage(source, path) {
  return String(path || "")
    .split(".")
    .reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined),
      source,
    );
}

function formatMessage(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

function t(key, params = {}, fallback = "") {
  const lang = state.i18n.language || "en";
  const current = getNestedMessage(state.i18n.messages[lang] || {}, key);
  const english = getNestedMessage(state.i18n.messages.en || {}, key);
  const raw = current ?? english ?? fallback ?? key;
  return formatMessage(raw, params);
}

function setLabelTextForControl(controlSelector, text) {
  const control = $(controlSelector);
  if (!control) return;
  const label = control.closest("label");
  if (!label) return;

  const textNode = Array.from(label.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE,
  );
  if (textNode) {
    textNode.textContent = `${text}\n`;
  } else {
    label.prepend(document.createTextNode(`${text}\n`));
  }
}

function setCheckboxLineText(checkboxSelector, text) {
  const checkbox = $(checkboxSelector);
  if (!checkbox) return;
  const label = checkbox.closest("label");
  if (!label) return;

  const textNode = Array.from(label.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
  );

  if (textNode) {
    textNode.textContent = ` ${text}`;
  } else {
    label.appendChild(document.createTextNode(` ${text}`));
  }
}

function applyTranslations() {
  document.documentElement.lang = state.i18n.language === "zh" ? "zh-CN" : "en";
  document.title = t("meta.title", {}, "Hexo Local Admin");

  $(".logo").textContent = "Hexo Control";
  $(".subtitle").textContent = t("meta.subtitle");
  renderQuickToggleButtons();

  $(".nav-btn[data-tab='settings']").textContent = t("nav.settings");
  $(".nav-btn[data-tab='posts']").textContent = t("nav.posts");
  $(".nav-btn[data-tab='pages']").textContent = t("nav.pages");
  $(".nav-btn[data-tab='images']").textContent = t("nav.images");
  $(".nav-btn[data-tab='debug']").textContent = t("nav.debug");

  $("#panel-settings .panel-header h2").textContent = t("settings.title");
  $("#cfg-detect").textContent = t("settings.detectSites");
  $("#cfg-apply-sibling").textContent = t("settings.applySite");
  $("#cfg-save").textContent = t("settings.save");
  setLabelTextForControl("#cfg-site-root", t("settings.siteRoot"));
  setLabelTextForControl("#cfg-posts-dir", t("settings.postsDir"));
  setLabelTextForControl("#cfg-pages-dir", t("settings.pagesDir"));
  setLabelTextForControl("#cfg-image-roots", t("settings.imageRoots"));
  $("#cfg-pick-site-root").textContent = t("settings.pick");
  $("#cfg-pick-posts-dir").textContent = t("settings.pick");
  $("#cfg-pick-pages-dir").textContent = t("settings.pick");
  $("#cfg-site-root").placeholder = t("settings.placeholderSiteRoot");
  $("#cfg-posts-dir").placeholder = t("settings.placeholderPostsDir");
  $("#cfg-pages-dir").placeholder = t("settings.placeholderPagesDir");

  $("#panel-posts .panel-header h2").textContent = t("posts.title");
  $("#post-refresh").textContent = t("posts.refresh");
  $("#post-new").textContent = t("posts.new");
  $("#post-search").placeholder = t("posts.searchPlaceholder");
  setLabelTextForControl("#post-filename", t("posts.filename"));
  setLabelTextForControl("#post-title", t("posts.postTitle"));
  setLabelTextForControl("#post-date", t("posts.date"));
  setLabelTextForControl("#post-updated", t("posts.updated"));
  setLabelTextForControl("#post-categories", t("posts.categories"));
  setLabelTextForControl("#post-tags", t("posts.tags"));
  setCheckboxLineText("#post-toc", t("posts.toc"));
  $("#panel-posts .content-label").textContent = t("posts.content");
  $("#post-save").textContent = t("posts.save");
  $("#post-delete").textContent = t("posts.delete");
  $("#post-filename").placeholder = t("posts.placeholderFilename");
  $("#post-title").placeholder = t("posts.placeholderTitle");
  $("#post-date").placeholder = t("posts.placeholderDatetime");
  $("#post-updated").placeholder = t("posts.placeholderDatetime");
  $("#post-categories").placeholder = t("posts.placeholderCategories");
  $("#post-tags").placeholder = t("posts.placeholderTags");

  $("#panel-pages .panel-header h2").textContent = t("pages.title");
  $("#page-refresh").textContent = t("pages.refresh");
  $("#page-new").textContent = t("pages.new");
  $("#page-search").placeholder = t("pages.searchPlaceholder");
  setLabelTextForControl("#page-relative-path", t("pages.relativePath"));
  setLabelTextForControl("#page-title", t("pages.pageTitle"));
  setLabelTextForControl("#page-date", t("pages.date"));
  setLabelTextForControl("#page-updated", t("pages.updated"));
  setLabelTextForControl("#page-categories", t("pages.categories"));
  setLabelTextForControl("#page-tags", t("pages.tags"));
  setCheckboxLineText("#page-toc", t("pages.toc"));
  $("#panel-pages .content-label").textContent = t("pages.content");
  $("#page-save").textContent = t("pages.save");
  $("#page-delete").textContent = t("pages.delete");
  $("#page-relative-path").placeholder = t("pages.placeholderRelativePath");
  $("#page-title").placeholder = t("pages.placeholderTitle");
  $("#page-date").placeholder = t("pages.placeholderDatetime");
  $("#page-updated").placeholder = t("pages.placeholderDatetime");
  $("#page-categories").placeholder = t("pages.placeholderCategories");
  $("#page-tags").placeholder = t("pages.placeholderTags");

  $("#panel-images .panel-header h2").textContent = t("images.title");
  $("#img-refresh").textContent = t("images.refresh");
  $("#img-preview").alt = t("images.previewAlt");
  setLabelTextForControl("#img-upload-subfolder", t("images.uploadSubfolder"));
  setLabelTextForControl("#img-upload-name", t("images.uploadName"));
  $("#img-upload-subfolder").placeholder = t("images.placeholderSubfolder");
  $("#img-upload-name").placeholder = t("images.placeholderName");
  $("#img-upload").textContent = t("images.upload");
  $("#img-replace").textContent = t("images.replace");
  $("#img-copy").textContent = t("images.copy");
  $("#img-delete").textContent = t("images.delete");

  $("#panel-debug .panel-header h2").textContent = t("debug.title");
  $("#debug-start").textContent = t("debug.start");
  $("#debug-stop").textContent = t("debug.stop");
  $("#debug-open").textContent = t("debug.open");
  $("#debug-refresh").textContent = t("debug.refresh");

  if (!state.selectedImage) {
    $("#img-meta").textContent = t("images.metaSelect");
  }
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function splitCSV(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function fillPathSettings(cfg) {
  state.config = cfg;
  applyLanguage(cfg.language || "en");
  applyThemeMode(cfg.theme || "dark", { systemTheme: state.systemTheme });
  $("#cfg-site-root").value = cfg.siteRoot || "";
  $("#cfg-posts-dir").value = cfg.postsDir || "";
  $("#cfg-pages-dir").value = cfg.pagesDir || "";
  $("#cfg-image-roots").value = (cfg.imageRoots || []).join("\n");
}

function getPathSettingsPayload() {
  return {
    siteRoot: $("#cfg-site-root").value.trim(),
    postsDir: $("#cfg-posts-dir").value.trim(),
    pagesDir: $("#cfg-pages-dir").value.trim(),
    imageRoots: $("#cfg-image-roots")
      .value.split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean),
  };
}

function renderSiblingSites(data) {
  state.siblingSites = data.sites || [];
  const select = $("#cfg-sibling-sites");
  select.innerHTML = "";

  if (!state.siblingSites.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("settings.noSiblingSites");
    select.appendChild(option);
    return;
  }

  for (const site of state.siblingSites) {
    const option = document.createElement("option");
    option.value = site.path;
    option.textContent = `${site.name} (${site.path})`;
    if (
      state.config &&
      String(state.config.siteRoot).toLowerCase() ===
        String(site.path).toLowerCase()
    ) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

function fillPostForm(post, keepOriginal = false) {
  const p = post || {};
  $("#post-original-filename").value = keepOriginal
    ? $("#post-original-filename").value
    : p.filename || "";
  $("#post-filename").value = p.filename || "";
  $("#post-title").value = p.title || "";
  $("#post-date").value = p.date || "";
  $("#post-updated").value = p.updated || "";
  $("#post-categories").value = (p.categories || []).join(",");
  $("#post-tags").value = (p.tags || []).join(",");
  $("#post-thumbnail").value = p.thumbnail || "";
  $("#post-cover").value = p.cover || "";
  $("#post-toc").checked = Boolean(p.toc);
  $("#post-content").value = p.content || "";
}

function getPostPayload() {
  return {
    originalFilename: $("#post-original-filename").value.trim(),
    filename: $("#post-filename").value.trim(),
    title: $("#post-title").value.trim(),
    date: $("#post-date").value.trim(),
    updated: $("#post-updated").value.trim(),
    categories: splitCSV($("#post-categories").value),
    tags: splitCSV($("#post-tags").value),
    thumbnail: $("#post-thumbnail").value.trim(),
    cover: $("#post-cover").value.trim(),
    toc: $("#post-toc").checked,
    content: $("#post-content").value,
  };
}

function fillPageForm(page, keepOriginal = false) {
  const p = page || {};
  $("#page-original-relative-path").value = keepOriginal
    ? $("#page-original-relative-path").value
    : p.relativePath || "";
  $("#page-relative-path").value = p.relativePath || "";
  $("#page-title").value = p.title || "";
  $("#page-date").value = p.date || "";
  $("#page-updated").value = p.updated || "";
  $("#page-categories").value = (p.categories || []).join(",");
  $("#page-tags").value = (p.tags || []).join(",");
  $("#page-thumbnail").value = p.thumbnail || "";
  $("#page-cover").value = p.cover || "";
  $("#page-toc").checked = Boolean(p.toc);
  $("#page-content").value = p.content || "";
}

function getPagePayload() {
  return {
    originalRelativePath: $("#page-original-relative-path").value.trim(),
    relativePath: $("#page-relative-path").value.trim(),
    title: $("#page-title").value.trim(),
    date: $("#page-date").value.trim(),
    updated: $("#page-updated").value.trim(),
    categories: splitCSV($("#page-categories").value),
    tags: splitCSV($("#page-tags").value),
    thumbnail: $("#page-thumbnail").value.trim(),
    cover: $("#page-cover").value.trim(),
    toc: $("#page-toc").checked,
    content: $("#page-content").value,
  };
}

function renderPostList() {
  const ul = $("#post-list");
  ul.innerHTML = "";

  for (const post of state.filteredPosts) {
    const li = document.createElement("li");
    li.textContent = `${post.title} (${post.filename})`;
    if (state.selectedPost === post.filename) {
      li.classList.add("active");
    }
    li.onclick = async () => {
      state.selectedPost = post.filename;
      const full = await window.hexoAdmin.getPost(post.filename);
      fillPostForm(full);
      $("#post-original-filename").value = full.filename;
      renderPostList();
    };
    ul.appendChild(li);
  }
}

function filterPostList() {
  const keyword = $("#post-search").value.trim().toLowerCase();
  state.filteredPosts = state.posts.filter((p) => {
    if (!keyword) return true;
    return (
      p.title.toLowerCase().includes(keyword) ||
      p.filename.toLowerCase().includes(keyword)
    );
  });
  renderPostList();
}

function renderPageList() {
  const ul = $("#page-list");
  ul.innerHTML = "";

  for (const page of state.filteredPages) {
    const li = document.createElement("li");
    li.textContent = `${page.title} (${page.relativePath})`;
    if (state.selectedPage === page.relativePath) {
      li.classList.add("active");
    }
    li.onclick = async () => {
      state.selectedPage = page.relativePath;
      const full = await window.hexoAdmin.getPage(page.relativePath);
      fillPageForm(full);
      $("#page-original-relative-path").value = full.relativePath;
      renderPageList();
    };
    ul.appendChild(li);
  }
}

function filterPageList() {
  const keyword = $("#page-search").value.trim().toLowerCase();
  state.filteredPages = state.pages.filter((p) => {
    if (!keyword) return true;
    return (
      p.title.toLowerCase().includes(keyword) ||
      p.relativePath.toLowerCase().includes(keyword)
    );
  });
  renderPageList();
}

async function refreshPosts() {
  state.posts = await window.hexoAdmin.listPosts();
  filterPostList();
}

async function refreshPages() {
  state.pages = await window.hexoAdmin.listPages();
  filterPageList();
}

function refreshImageRootOptions() {
  const select = $("#img-root-select");
  select.innerHTML = "";
  for (const root of state.config.imageRoots || []) {
    const option = document.createElement("option");
    option.value = root;
    option.textContent = root;
    select.appendChild(option);
  }
}

async function savePost() {
  const payload = getPostPayload();
  if (!payload.filename) {
    showToast(t("posts.needFilename"));
    return;
  }
  if (!payload.title) {
    showToast(t("posts.needTitle"));
    return;
  }

  const isUpdate = Boolean(payload.originalFilename);
  if (isUpdate) {
    await window.hexoAdmin.updatePost(payload);
    showToast(t("posts.updatedToast"));
  } else {
    await window.hexoAdmin.createPost(payload);
    $("#post-original-filename").value = payload.filename;
    showToast(t("posts.createdToast"));
  }

  state.selectedPost = payload.filename;
  await refreshPosts();
}

async function savePage() {
  const payload = getPagePayload();
  if (!payload.relativePath) {
    showToast(t("pages.needPath"));
    return;
  }
  if (!payload.title) {
    showToast(t("pages.needTitle"));
    return;
  }

  const isUpdate = Boolean(payload.originalRelativePath);
  if (isUpdate) {
    await window.hexoAdmin.updatePage(payload);
    showToast(t("pages.updatedToast"));
  } else {
    await window.hexoAdmin.createPage(payload);
    $("#page-original-relative-path").value = payload.relativePath;
    showToast(t("pages.createdToast"));
  }

  state.selectedPage = payload.relativePath;
  await refreshPages();
}

async function deletePost() {
  const filename =
    $("#post-original-filename").value.trim() ||
    $("#post-filename").value.trim();
  if (!filename) {
    showToast(t("posts.selectFirst"));
    return;
  }
  if (!confirm(t("posts.confirmDelete", { name: filename }))) {
    return;
  }

  await window.hexoAdmin.deletePost(filename);
  showToast(t("posts.deletedToast"));
  state.selectedPost = null;
  fillPostForm({});
  await refreshPosts();
}

async function deletePage() {
  const relativePath =
    $("#page-original-relative-path").value.trim() ||
    $("#page-relative-path").value.trim();
  if (!relativePath) {
    showToast(t("pages.selectFirst"));
    return;
  }
  if (!confirm(t("pages.confirmDelete", { name: relativePath }))) {
    return;
  }

  await window.hexoAdmin.deletePage(relativePath);
  showToast(t("pages.deletedToast"));
  state.selectedPage = null;
  fillPageForm({});
  await refreshPages();
}

function renderImageList() {
  const ul = $("#img-list");
  ul.innerHTML = "";

  for (const img of state.images) {
    const li = document.createElement("li");
    li.textContent = img.displayPath;
    if (
      state.selectedImage &&
      state.selectedImage.relativeRoot === img.relativeRoot &&
      state.selectedImage.relativePath === img.relativePath
    ) {
      li.classList.add("active");
    }

    li.onclick = () => {
      state.selectedImage = img;
      $("#img-preview").src = `file://${img.absolute}`;
      const md = img.markdownPath
        ? t("images.metaMarkdown", { path: img.markdownPath })
        : t("images.metaNoMarkdown");
      $("#img-meta").textContent =
        `${img.displayPath} | ${img.size} bytes | ${md}`;
      renderImageList();
    };
    ul.appendChild(li);
  }
}

async function refreshImages() {
  const root = $("#img-root-select").value;
  state.images = await window.hexoAdmin.listImages(root);
  state.selectedImage = null;
  $("#img-preview").src = "";
  $("#img-meta").textContent = t("images.metaSelect");
  renderImageList();
}

async function pickLocalImagePath() {
  const result = await window.hexoAdmin.pickLocalImage();
  if (result.canceled) {
    return null;
  }
  return result.filePath;
}

async function uploadImage() {
  const sourceFile = await pickLocalImagePath();
  if (!sourceFile) return;

  await window.hexoAdmin.uploadImage({
    relativeRoot: $("#img-root-select").value,
    subFolder: $("#img-upload-subfolder").value.trim(),
    fileName: $("#img-upload-name").value.trim(),
    sourceFile,
  });

  showToast(t("images.uploadedToast"));
  await refreshImages();
}

async function replaceImage() {
  if (!state.selectedImage) {
    showToast(t("images.selectFirst"));
    return;
  }

  const sourceFile = await pickLocalImagePath();
  if (!sourceFile) return;

  await window.hexoAdmin.replaceImage({
    relativeRoot: state.selectedImage.relativeRoot,
    relativePath: state.selectedImage.relativePath,
    sourceFile,
  });

  showToast(t("images.replacedToast"));
  await refreshImages();
}

async function deleteImage() {
  if (!state.selectedImage) {
    showToast(t("images.selectFirst"));
    return;
  }

  if (
    !confirm(
      t("images.confirmDelete", { name: state.selectedImage.displayPath }),
    )
  ) {
    return;
  }

  await window.hexoAdmin.deleteImage({
    relativeRoot: state.selectedImage.relativeRoot,
    relativePath: state.selectedImage.relativePath,
  });
  showToast(t("images.deletedToast"));
  await refreshImages();
}

async function copyImageMarkdownPath() {
  if (!state.selectedImage) {
    showToast(t("images.selectFirst"));
    return;
  }
  if (!state.selectedImage.markdownPath) {
    showToast(t("images.copyUnavailable"));
    return;
  }
  await navigator.clipboard.writeText(state.selectedImage.markdownPath);
  showToast(t("images.copiedToast"));
}

function appendLog(text) {
  const log = $("#debug-log");
  log.value += text;
  log.scrollTop = log.scrollHeight;
}

function renderSitePathSummary() {
  const cfg = state.config;
  $("#site-path").textContent = t("summary.sitePath", {
    siteRoot: cfg.siteRoot,
    postsDir: cfg.postsDir,
    pagesDir: cfg.pagesDir,
  });
}

async function refreshServerStatus() {
  const status = await window.hexoAdmin.serverStatus();
  state.serverRunning = Boolean(status.running);
  const dot = $("#server-status-dot");
  const text = $("#server-status-text");
  dot.classList.toggle("running", state.serverRunning);
  text.textContent = state.serverRunning
    ? t("debug.running")
    : t("debug.stopped");
}

async function startDebugServer() {
  const res = await window.hexoAdmin.startServer();
  appendLog(
    res.alreadyRunning ? t("debug.logAlreadyRunning") : t("debug.logStart"),
  );
  $("#debug-preview").src = "http://localhost:4000";
  await refreshServerStatus();
}

async function stopDebugServer() {
  const res = await window.hexoAdmin.stopServer();
  appendLog(
    res.alreadyStopped ? t("debug.logAlreadyStopped") : t("debug.logStop"),
  );
  await refreshServerStatus();
}

function bindTabs() {
  $$(".nav-btn").forEach((btn) => {
    btn.onclick = () => {
      $$(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      $$(".panel").forEach((p) => p.classList.remove("active"));
      $("#panel-" + tab).classList.add("active");
    };
  });
}

async function reloadAllData() {
  await refreshPosts();
  await refreshPages();
  refreshImageRootOptions();
  await refreshImages();
  renderSitePathSummary();
}

async function refreshSiblingSites() {
  const data = await window.hexoAdmin.detectSiblingSites();
  renderSiblingSites(data);
}

async function applySelectedSiblingSite() {
  const siteRoot = $("#cfg-sibling-sites").value;
  if (!siteRoot) {
    showToast(t("settings.selectSiblingFirst"));
    return;
  }
  const result = await window.hexoAdmin.applySiblingSite(siteRoot);
  fillPathSettings(result.config);
  await refreshSiblingSites();
  await reloadAllData();
  showToast(t("settings.applied"));
}

async function pickFolderToInput(inputId) {
  const current = $(inputId).value.trim();
  const result = await window.hexoAdmin.pickFolder(current);
  if (!result.canceled) {
    $(inputId).value = result.path;
  }
}

async function saveSettings() {
  const payload = getPathSettingsPayload();
  const result = await window.hexoAdmin.updateConfig(payload);
  fillPathSettings(result.config);
  await reloadAllData();
  showToast(t("settings.saved"));
}

async function setup() {
  try {
    bindTabs();

    const bundle = await window.hexoAdmin.getI18nBundle();
    applyLanguage(bundle.language || "en");
    state.i18n.supportedLanguages = bundle.supportedLanguages || ["en", "zh"];
    state.i18n.messages = bundle.messages || { en: {}, zh: {} };

    const themeState = await window.hexoAdmin.getThemeState();
    state.systemTheme = themeState.systemTheme || "dark";
    applyThemeMode(themeState.mode || "dark", {
      systemTheme: state.systemTheme,
    });

    applyTranslations();

    const cfg = await window.hexoAdmin.getConfig();
    applyLanguage(cfg.language || state.i18n.language);
    fillPathSettings(cfg);
    applyTranslations();
    await refreshSiblingSites();
    try {
      await reloadAllData();
    } catch (err) {
      showToast(`${t("settings.loadFailed")}: ${err.message || String(err)}`);
    }

    $("#lang-toggle-btn").onclick = async () => {
      try {
        const nextLanguage = state.i18n.language === "en" ? "zh" : "en";
        await window.hexoAdmin.setLanguage(nextLanguage);
        applyLanguage(nextLanguage);
        state.config = {
          ...state.config,
          language: nextLanguage,
        };
        applyTranslations();
        renderSiblingSites({ sites: state.siblingSites });
        renderSitePathSummary();
        await refreshServerStatus();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#theme-toggle-btn").onclick = async () => {
      try {
        const current = normalizeTheme(state.themeMode);
        const currentIdx = THEME_MODE_ORDER.indexOf(current);
        const nextThemeMode =
          THEME_MODE_ORDER[(currentIdx + 1) % THEME_MODE_ORDER.length];
        const themeResult = await window.hexoAdmin.setTheme(nextThemeMode);
        applyThemeMode(themeResult.mode || nextThemeMode, {
          systemTheme: themeResult.systemTheme || state.systemTheme,
        });
        state.config = {
          ...state.config,
          theme: themeResult.mode || nextThemeMode,
        };
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    window.hexoAdmin.onSystemThemeChanged((payload) => {
      const nextSystemTheme =
        payload && payload.systemTheme === "light" ? "light" : "dark";
      state.systemTheme = nextSystemTheme;
      if (state.themeMode === "system") {
        applyThemeMode("system", { systemTheme: nextSystemTheme });
      }
    });

    // Manual mode (dark/light) always wins over system updates.
    // Only when mode=system, UI follows OS theme changes.

    $("#cfg-detect").onclick = async () => {
      try {
        await refreshSiblingSites();
        showToast(t("settings.detectRefreshed"));
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#cfg-apply-sibling").onclick = async () => {
      try {
        await applySelectedSiblingSite();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#cfg-pick-site-root").onclick = () =>
      pickFolderToInput("#cfg-site-root");
    $("#cfg-pick-posts-dir").onclick = () =>
      pickFolderToInput("#cfg-posts-dir");
    $("#cfg-pick-pages-dir").onclick = () =>
      pickFolderToInput("#cfg-pages-dir");
    $("#cfg-save").onclick = async () => {
      try {
        await saveSettings();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#post-search").addEventListener("input", filterPostList);
    $("#post-refresh").onclick = refreshPosts;
    $("#post-new").onclick = () => {
      state.selectedPost = null;
      fillPostForm({ date: "", updated: "", content: "" });
      $("#post-original-filename").value = "";
      renderPostList();
      showToast(t("posts.newMode"));
    };
    $("#post-save").onclick = async () => {
      try {
        await savePost();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#post-delete").onclick = async () => {
      try {
        await deletePost();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#page-search").addEventListener("input", filterPageList);
    $("#page-refresh").onclick = refreshPages;
    $("#page-new").onclick = () => {
      state.selectedPage = null;
      fillPageForm({ date: "", updated: "", content: "" });
      $("#page-original-relative-path").value = "";
      renderPageList();
      showToast(t("pages.newMode"));
    };
    $("#page-save").onclick = async () => {
      try {
        await savePage();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#page-delete").onclick = async () => {
      try {
        await deletePage();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#img-root-select").onchange = refreshImages;
    $("#img-refresh").onclick = refreshImages;
    $("#img-upload").onclick = async () => {
      try {
        await uploadImage();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#img-replace").onclick = async () => {
      try {
        await replaceImage();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#img-delete").onclick = async () => {
      try {
        await deleteImage();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#img-copy").onclick = async () => {
      try {
        await copyImageMarkdownPath();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };

    $("#debug-start").onclick = async () => {
      try {
        await startDebugServer();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#debug-stop").onclick = async () => {
      try {
        await stopDebugServer();
      } catch (err) {
        showToast(err.message || String(err));
      }
    };
    $("#debug-open").onclick = async () => {
      await window.hexoAdmin.openPreview();
    };
    $("#debug-refresh").onclick = () => {
      $("#debug-preview").src = "http://localhost:4000";
    };

    window.hexoAdmin.onServerOutput((text) => appendLog(text));

    await refreshServerStatus();
    setInterval(refreshServerStatus, 2500);
  } catch (err) {
    showToast(err.message || String(err));
  }
}

setup();
