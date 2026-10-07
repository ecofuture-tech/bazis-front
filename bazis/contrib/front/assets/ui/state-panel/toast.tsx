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

// The feedback of a change: a toast after a mutation succeeded (`toast({title})`), shown by
// the `Toaster` of the layout (`AppShell` renders it) in a polite live region, and gone after
// a few seconds. The errors of the backend are not toasts: they stay where they happened
// (`StatePanel`, the errors of the fields).

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface Toast {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: 'success' | 'info' | 'danger';
}

/** How long a toast is shown, in milliseconds. */
const DURATION = 4000;

let toasts: readonly Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();

function emit(items: readonly Toast[]) {
  toasts = items;
  for (const listener of listeners) listener();
}

/** Removes a toast. */
export function dismissToast(id: number): void {
  emit(toasts.filter((it) => it.id !== id));
}

/** Shows a toast, the feedback of a change that succeeded; returns its id. */
export function toast({ title, description, tone = 'success' }: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }): number {
  const id = next++;
  emit([...toasts.slice(-2), { id, title, description, tone }]);
  setTimeout(() => {
    dismissToast(id);
  }, DURATION);
  return id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ICONS = { success: CircleCheck, info: Info, danger: CircleAlert } as const;
const TONES = {
  success: 'text-success',
  info: 'text-info',
  danger: 'text-destructive',
} as const;

/** The toasts, at the bottom of the screen. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {items.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm animate-in items-start gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg fade-in-0 slide-in-from-bottom-2"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', TONES[item.tone])} aria-hidden="true" />
            <div className="grid flex-1 gap-0.5">
              <p className="font-medium">{item.title}</p>
              {item.description !== undefined && <p className="text-muted-foreground">{item.description}</p>}
            </div>
            <button
              type="button"
              className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Dismiss"
              onClick={() => {
                dismissToast(item.id);
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
