// Bridge exposed by electron/preload.cjs when the app runs inside Electron.
export interface UpdateInfo {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  url: string;
}

export interface DesktopBridge {
  pickImportFile: () => Promise<string | null>;
  checkForUpdate: () => Promise<UpdateInfo>;
  openExternal: (url: string) => Promise<void>;
}

/** The native desktop bridge, or null when running in a plain browser. */
export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { desktop?: DesktopBridge }).desktop ?? null;
}
