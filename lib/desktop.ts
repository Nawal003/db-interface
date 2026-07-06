// Bridge exposed by electron/preload.cjs when the app runs inside Electron.
export interface DesktopBridge {
  pickImportFile: () => Promise<string | null>;
}

/** The native desktop bridge, or null when running in a plain browser. */
export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { desktop?: DesktopBridge }).desktop ?? null;
}
