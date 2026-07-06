// Minimal, safe bridge exposed to the renderer (contextIsolation is on).
// Lets the web UI open the native OS file picker when running inside Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // Opens the native "Open file" dialog; resolves to an absolute path, or null if cancelled.
  pickImportFile: () => ipcRenderer.invoke("dialog:pickImportFile"),
});
