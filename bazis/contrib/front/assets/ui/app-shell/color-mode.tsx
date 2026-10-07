// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The color mode of the application: light, dark, or that of the system, kept in the
// storage of the browser. The dark mode is the class `dark` of <html> (the variant `dark:`
// of Tailwind and the variables of the dark mode of `theme.css`); the class `light` keeps
// the light mode against a dark system. Without a dark mode in the tokens (`THEME.dark`) the
// application stays light.

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { THEME } from '@/bazis/generated/theme';
import { Button } from '@/components/ui/button';

export type ColorMode = 'light' | 'dark' | 'system';

const KEY = 'bazis-color-mode';
const MODES: readonly ColorMode[] = ['system', 'light', 'dark'];

let mode: ColorMode = 'system';
const listeners = new Set<() => void>();

function systemDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function stored(): ColorMode {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Sets the classes of <html> for the mode. */
function apply(): void {
  const dark = THEME.dark && (mode === 'dark' || (mode === 'system' && systemDark()));
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
}

/** Applies the stored mode and follows the system; `src/main.tsx` calls it before the render. */
export function initColorMode(): void {
  mode = stored();
  apply();
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  }
}

export function setColorMode(next: ColorMode): void {
  mode = next;
  try {
    if (next === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // a storage that is not available: the mode lasts until the page is reloaded
  }
  apply();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribe, () => mode, () => mode);
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;
const LABELS = { system: 'System', light: 'Light', dark: 'Dark' } as const;

/** A button that switches the mode: system, light, dark; nothing without a dark mode. */
export function ColorModeToggle({ className }: { className?: string }) {
  const current = useColorMode();
  if (!THEME.dark) return null;
  const Icon = ICONS[current];
  const following = MODES[(MODES.indexOf(current) + 1) % MODES.length] ?? 'system';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={`Color mode: ${LABELS[current]}. Switch to ${LABELS[following]}`}
      title={`Color mode: ${LABELS[current]}`}
      onClick={() => {
        setColorMode(following);
      }}
    >
      <Icon />
    </Button>
  );
}
