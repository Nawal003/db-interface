"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/**
 * `false` on the server and during hydration, `true` afterwards. Using
 * useSyncExternalStore lets React reconcile the difference without a hydration
 * mismatch warning (and without a setState-in-effect).
 */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  const isLight = mounted && !isDark;

  const base =
    "grid size-7 cursor-pointer place-items-center rounded-md transition-colors";
  const active = "bg-secondary/15 text-secondary";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        aria-pressed={isLight}
        className={cn(base, isLight ? active : inactive)}
      >
        <Sun className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        aria-pressed={isDark}
        className={cn(base, isDark ? active : inactive)}
      >
        <Moon className="size-4" />
      </button>
    </div>
  );
}
