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

/** The flag of a reload after a screen failed to load, in `sessionStorage`. */
export const RELOADED = 'bazis.screen-reloaded';

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

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // storage blocked by the browser
    return null;
  }
}

/**
 * A screen loaded with its own chunk when it is first rendered, like `React.lazy`, under the
 * `Suspense` and the `ErrorBoundary` of its route. A chunk that cannot be loaded (another
 * version deployed since the page was opened: its old chunks are gone) reloads the page once;
 * when it still fails (or the storage of the flag is blocked), the boundary shows the
 * `ScreenLoadError`, and its retry loads the chunk again (`React.lazy` keeps a failure until
 * the page is reloaded).
 */
export function lazyScreen<Props extends object>(load: () => Promise<ComponentType<Props>>): (props: Props) => JSX.Element {
  let screen: Promise<ComponentType<Props>> | undefined;
  const reset = () => {
    screen = undefined;
  };
  return function LazyScreen(props: Props) {
    screen ??= load().then(
      (Screen) => {
        try {
          storage()?.removeItem(RELOADED);
        } catch {
          // nothing to clear
        }
        return Screen;
      },
      (error: unknown) => {
        const flags = storage();
        try {
          if (flags && flags.getItem(RELOADED) === null) {
            flags.setItem(RELOADED, '1');
            window.location.reload();
            // the page is reloaded: the screen stays loading until then
            return new Promise<never>(() => undefined);
          }
        } catch {
          // no flag, no reload: the error is shown
        }
        throw new ScreenLoadError(error, reset);
      },
    );
    const Screen = use(screen);
    return <Screen {...props} />;
  };
}
