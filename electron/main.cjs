// Electron main process. Wraps the local Next.js server in a native window.
// - dev  : loads the running `next dev` server (localhost:3000)
// - prod : spawns the bundled Next standalone server and loads it
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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
