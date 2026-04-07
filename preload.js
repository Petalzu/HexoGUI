const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hexoAdmin", {
  getI18nBundle: () => ipcRenderer.invoke("i18n:get-bundle"),
  setLanguage: (language) => ipcRenderer.invoke("i18n:set-language", language),
  setTheme: (theme) => ipcRenderer.invoke("theme:set", theme),
  getThemeState: () => ipcRenderer.invoke("theme:get-state"),

  getConfig: () => ipcRenderer.invoke("config:get"),
  updateConfig: (payload) => ipcRenderer.invoke("config:update", payload),
  pickFolder: (initialPath) =>
    ipcRenderer.invoke("path:pick-folder", initialPath),
  detectSiblingSites: () => ipcRenderer.invoke("sites:detect-siblings"),
  applySiblingSite: (siteRoot) =>
    ipcRenderer.invoke("sites:apply-sibling", siteRoot),

  getBasic: () => ipcRenderer.invoke("site:get-basic"),

  listPosts: () => ipcRenderer.invoke("posts:list"),
  getPost: (filename) => ipcRenderer.invoke("posts:get", filename),
  createPost: (payload) => ipcRenderer.invoke("posts:create", payload),
  updatePost: (payload) => ipcRenderer.invoke("posts:update", payload),
  deletePost: (filename) => ipcRenderer.invoke("posts:delete", filename),

  listPages: () => ipcRenderer.invoke("pages:list"),
  getPage: (relativePath) => ipcRenderer.invoke("pages:get", relativePath),
  createPage: (payload) => ipcRenderer.invoke("pages:create", payload),
  updatePage: (payload) => ipcRenderer.invoke("pages:update", payload),
  deletePage: (relativePath) =>
    ipcRenderer.invoke("pages:delete", relativePath),

  listImages: (relativeRoot) => ipcRenderer.invoke("images:list", relativeRoot),
  pickLocalImage: () => ipcRenderer.invoke("images:pick-local"),
  uploadImage: (payload) => ipcRenderer.invoke("images:upload", payload),
  replaceImage: (payload) => ipcRenderer.invoke("images:replace", payload),
  deleteImage: (payload) => ipcRenderer.invoke("images:delete", payload),

  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  serverStatus: () => ipcRenderer.invoke("server:status"),
  openPreview: () => ipcRenderer.invoke("server:open-preview"),

  onServerOutput: (listener) => {
    const fn = (_event, text) => listener(text);
    ipcRenderer.on("server:output", fn);
    return () => ipcRenderer.removeListener("server:output", fn);
  },

  onSystemThemeChanged: (listener) => {
    const fn = (_event, payload) => listener(payload);
    ipcRenderer.on("theme:system-changed", fn);
    return () => ipcRenderer.removeListener("theme:system-changed", fn);
  },
});
