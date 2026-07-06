// Electron main process. Wraps the local Next.js server in a native window.
// - dev  : loads the running `next dev` server (localhost:3000)
// - prod : spawns the bundled Next standalone server and loads it
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const https = require("node:https");
const { spawn } = require("node:child_process");

// Boot log to a stable path, written before any app.getPath() call, so we can
// diagnose even the earliest failures (packaged macOS apps detach stdout).
const bootLog = path.join(os.tmpdir(), "dbinterface-boot.log");
function blog(...a) {
  try {
    fs.appendFileSync(bootLog, `[${new Date().toISOString()}] ${a.join(" ")}\n`);
  } catch {
    // ignore
  }
}
blog("main.cjs loaded", "packaged=" + app.isPackaged, "electron=" + process.versions.electron);
process.on("uncaughtException", (e) => blog("uncaughtException:", e && e.stack));
process.on("unhandledRejection", (e) => blog("unhandledRejection:", String(e)));

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";
const PROD_PORT = 34517;
const PROD_URL = `http://127.0.0.1:${PROD_PORT}`;

let serverProc = null;

// Native "Open file" dialog — shows the real OS folder tree and lets the OS
// grant read access to the picked file (avoids the in-app browser hitting
// filesystem permissions, e.g. macOS Desktop/Documents/Downloads protection).
const IMPORT_EXTENSIONS = [
  "csv", "tsv", "json", "xlsx", "txt", "log", "md",
  "db", "sqlite", "sqlite3", "sql",
];
ipcMain.handle("dialog:pickImportFile", async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(parent, {
    title: "Importer un fichier de données",
    properties: ["openFile"],
    filters: [
      { name: "Données (CSV, JSON, Excel, SQLite, SQL…)", extensions: IMPORT_EXTENSIONS },
      { name: "Tous les fichiers", extensions: ["*"] },
    ],
  });
  return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
});

// Lightweight update check: compare the running version to the latest GitHub
// release and let the renderer show a "Mettre à jour" banner (no auto-install —
// that needs code signing on macOS). The button opens the download page.
const DOWNLOAD_PAGE = "https://nawal003.github.io/db-interface/";
const RELEASES_API =
  "https://api.github.com/repos/Nawal003/db-interface/releases/latest";

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      RELEASES_API,
      { headers: { "User-Agent": "DB-Interface", Accept: "application/vnd.github+json" } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode));
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(String(JSON.parse(data).tag_name || "").replace(/^v/, ""));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
  });
}

function isNewer(latest, current) {
  const a = String(latest).split(".").map(Number);
  const b = String(current).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

ipcMain.handle("update:check", async () => {
  const current = app.getVersion();
  try {
    const latest = await fetchLatestVersion();
    return {
      current,
      latest,
      hasUpdate: !!latest && isNewer(latest, current),
      url: DOWNLOAD_PAGE,
    };
  } catch {
    return { current, latest: null, hasUpdate: false, url: DOWNLOAD_PAGE };
  }
});

ipcMain.handle("shell:openExternal", (_event, url) => {
  if (typeof url === "string" && /^https:\/\//.test(url)) shell.openExternal(url);
});

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("server timeout"));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function startProdServer(userData) {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverJs = path.join(standaloneDir, "server.js");
  const out = fs.openSync(path.join(userData, "server.log"), "a");
  blog("spawn server:", serverJs, "exists=" + fs.existsSync(serverJs));
  serverProc = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(PROD_PORT),
      HOSTNAME: "127.0.0.1",
      DBADMIN_DATA_DIR: path.join(userData, "data"),
    },
    stdio: ["ignore", out, out],
  });
  serverProc.on("error", (e) => blog("server spawn error:", String(e)));
  serverProc.on("exit", (code) => blog("server exit code=" + code));
  blog("server pid=" + serverProc.pid);
}

async function createWindow(userData) {
  const url = isDev ? DEV_URL : PROD_URL;
  if (!isDev) startProdServer(userData);
  try {
    await waitForServer(url);
    blog("server ready", url);
  } catch (err) {
    blog("waitForServer failed:", String(err));
  }

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "DB Interface",
    backgroundColor: "#0b1220",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadURL(url);
  blog("window created");
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
}

function stopServer() {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  fs.mkdirSync(userData, { recursive: true });
  blog("app ready, userData=" + userData);
  createWindow(userData).catch((e) => blog("createWindow error:", e && e.stack));
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(app.getPath("userData"));
  }
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);
