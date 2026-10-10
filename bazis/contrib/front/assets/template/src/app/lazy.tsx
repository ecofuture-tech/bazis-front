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

import { use, type ComponentType, type JSX } from 'react';

/**
 * The time of the last reload after a screen failed to load (`Date.now()`), in
 * `sessionStorage`: the page is reloaded again only after `RELOAD_WINDOW`, so that a chunk
 * that is gone for good never reloads it in a loop, whatever the other screens load.
 */
export const RELOADED = 'bazis.screen-reloaded';

/** The milliseconds after a reload during which a screen that fails is not reloaded again. */
export const RELOAD_WINDOW = 30_000;

/**
 * A chunk of a screen that failed to load, the error that its `ErrorBoundary` shows: `reset()`
 * makes the next render of the screen load it again (the retry of the boundary, another
 * route). It is kept until then, so that the renders of React never load it in a loop.
 */
export class ScreenLoadError extends Error {
  readonly reset: () => void;

  constructor(cause: unknown, reset: () => void) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'ScreenLoadError';
    this.reset = reset;
  }
}

/**
 * Whether the page is reloaded for a chunk that failed: once per `RELOAD_WINDOW`, never when
 * the storage of the flag is blocked (the error is shown at once).
 */
function reloadOnce(reload: () => void): boolean {
  try {
    const flags = window.sessionStorage;
    const last = Number(flags.getItem(RELOADED));
    const now = Date.now();
    if (last > 0 && now - last < RELOAD_WINDOW) return false;
    flags.setItem(RELOADED, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}

/**
 * A screen loaded with its own chunk when it is first rendered, like `React.lazy`, under the
 * `Suspense` and the `ErrorBoundary` of its route. A chunk that cannot be loaded (another
 * version deployed since the page was opened: its old chunks are gone) reloads the page, at
 * most once per `RELOAD_WINDOW` (`reload`: `window.location.reload` by default); otherwise
 * the boundary shows the `ScreenLoadError`, and its retry loads the chunk again
 * (`React.lazy` keeps a failure until the page is reloaded).
 */
export function lazyScreen<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  reload: () => void = () => {
    window.location.reload();
  },
): (props: Props) => JSX.Element {
  let screen: Promise<ComponentType<Props>> | undefined;
  const reset = () => {
    screen = undefined;
  };
  return function LazyScreen(props: Props) {
    screen ??= load().catch((error: unknown) => {
      // the page is reloaded: the screen stays loading until then
      if (reloadOnce(reload)) return new Promise<never>(() => undefined);
      throw new ScreenLoadError(error, reset);
    });
    const Screen = use(screen);
    return <Screen {...props} />;
  };
}
