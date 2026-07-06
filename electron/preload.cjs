// Minimal, safe bridge exposed to the renderer (contextIsolation is on).
// Lets the web UI use native desktop features when running inside Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // Opens the native "Open file" dialog; resolves to an absolute path, or null if cancelled.
  pickImportFile: () => ipcRenderer.invoke("dialog:pickImportFile"),
  // Compares the running version to the latest GitHub release.
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  // Opens an https URL in the user's default browser.
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
