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

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/app/errors';
import { lazyScreen, RELOAD_WINDOW, RELOADED } from '@/app/lazy';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const GONE = 'Failed to fetch dynamically imported module';

function Card({ name }: { name: string }): string {
  return `card ${name}`;
}

/** A chunk whose load the test settles. */
function chunk<T>() {
  let settle!: { resolve: (value: T) => void; reject: (error: unknown) => void };
  const promise = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { load: () => promise, ...settle };
}

// a screen that suspends renders again once its chunk is loaded: in an awaited `act`
async function route(children: ReactNode) {
  await act(async () => {
    render(
      <ErrorBoundary>
        <Suspense fallback={<p>loading</p>}>{children}</Suspense>
      </ErrorBoundary>,
    );
    await Promise.resolve();
  });
}

async function settled(callback: () => void) {
  await act(async () => {
    callback();
    await Promise.resolve();
  });
}

describe('lazyScreen', () => {
  it('renders the screen of its chunk with its props', async () => {
    const Screen = lazyScreen(() => Promise.resolve(Card));
    await route(<Screen name="Ann" />);
    expect(await screen.findByText('card Ann')).toBeTruthy();
  });

  it('reloads the page once when a chunk fails, whatever the other screens load', async () => {
    const reload = vi.fn();
    // the first page: the card loads, the list is gone (another version deployed)
    const list = chunk<typeof Card>();
    const card = chunk<typeof Card>();
    const ListScreen = lazyScreen(list.load, reload);
    const CardScreen = lazyScreen(card.load, reload);
    await route(
      <>
        <ListScreen name="all" />
        <CardScreen name="Ann" />
      </>,
    );
    await settled(() => {
      card.resolve(Card);
    });
    await settled(() => {
      list.reject(new Error(GONE));
    });
    expect(reload).toHaveBeenCalledTimes(1);
    // loading until the page is reloaded, no error shown
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();

    // the reloaded page: the card loads first again, the list is still gone
    const CardAgain = lazyScreen(() => Promise.resolve(Card), reload);
    const ListAgain = lazyScreen<{ name: string }>(() => Promise.reject(new Error(GONE)), reload);
    await route(
      <>
        <CardAgain name="Ann" />
        <ListAgain name="all" />
      </>,
    );
    const state = await screen.findByRole('alert');
    expect(state.getAttribute('data-bz')).toBe('state:error');
    expect(state.textContent).toContain(GONE);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again after the window of the last reload', async () => {
    sessionStorage.setItem(RELOADED, String(Date.now() - RELOAD_WINDOW - 1));
    const reload = vi.fn();
    const Screen = lazyScreen(() => Promise.reject(new Error(GONE)), reload);
    await route(<Screen />);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(Number(sessionStorage.getItem(RELOADED))).toBeGreaterThan(Date.now() - RELOAD_WINDOW);
  });

  it('shows the error at once when the storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const reload = vi.fn();
    const Screen = lazyScreen(() => Promise.reject(new Error(GONE)), reload);
    await route(<Screen />);
    expect((await screen.findByRole('alert')).textContent).toContain(GONE);
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps a failure until the retry of its boundary, which loads the chunk again', async () => {
    sessionStorage.setItem(RELOADED, String(Date.now()));
    const reload = vi.fn();
    const load = vi
      .fn<() => Promise<typeof Card>>()
      .mockRejectedValueOnce(new Error(GONE))
      .mockResolvedValue(Card);
    const Screen = lazyScreen(load, reload);
    await route(<Screen name="Ann" />);
    await screen.findByRole('alert');
    // the renders of React never load it in a loop
    expect(load).toHaveBeenCalledTimes(1);

    await settled(() => {
      fireEvent.click(screen.getByText('Retry'));
    });
    expect(await screen.findByText('card Ann')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });
});
