"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

const CHOICES = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Match system theme", Icon: Monitor },
] as const;

// Sits beside the style switcher and borrows its currentColor pill so it fits
// every skin. Light/Dark are explicit visitor overrides (persisted by
// next-themes); System follows the OS.
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  // `theme` is undefined during SSR but read from localStorage on the client,
  // so mark the active choice only after hydration to keep the server and
  // first client paint identical.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="group"
      aria-label="Choose light or dark mode"
      className="flex items-center gap-1 rounded-full border border-current/15 p-1 pointer-coarse:gap-1.5"
    >
      {CHOICES.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center rounded-full px-2 py-1 transition-colors pointer-coarse:min-h-11 ${
              active ? "bg-current/15" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Icon aria-hidden className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
};
