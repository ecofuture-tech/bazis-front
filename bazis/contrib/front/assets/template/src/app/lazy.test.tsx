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

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/app/errors';
import { lazyScreen, RELOADED } from '@/app/lazy';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Greeting({ name }: { name: string }): string {
  return `hello ${name}`;
}

// a screen that suspends renders again once its chunk is loaded: in an awaited `act`
async function route(Screen: (props: { name: string }) => JSX.Element) {
  await act(async () => {
    render(
      <ErrorBoundary>
        <Suspense fallback={<p>loading</p>}>
          <Screen name="Ann" />
        </Suspense>
      </ErrorBoundary>,
    );
    await Promise.resolve();
  });
}

describe('lazyScreen', () => {
  it('renders the screen of its chunk with its props', async () => {
    sessionStorage.setItem(RELOADED, '1');
    await route(lazyScreen(() => Promise.resolve(Greeting)));
    expect(await screen.findByText('hello Ann')).toBeTruthy();
    // a loaded screen clears the flag of the reload
    expect(sessionStorage.getItem(RELOADED)).toBeNull();
  });

  it('reloads the page once when a chunk fails to load', async () => {
    // jsdom has no navigation: it reports the reload as not implemented
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    await route(lazyScreen(load));
    await waitFor(() => {
      expect(sessionStorage.getItem(RELOADED)).toBe('1');
    });
    // loading until the page is reloaded, no error shown
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows the error after the reload, and its retry loads the chunk again', async () => {
    sessionStorage.setItem(RELOADED, '1');
    const load = vi
      .fn<() => Promise<typeof Greeting>>()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValue(Greeting);
    await route(lazyScreen(load));
    const state = await screen.findByRole('alert');
    expect(state.getAttribute('data-bz')).toBe('state:error');
    expect(state.textContent).toContain('Failed to fetch dynamically imported module');
    // the failure is kept: the renders of React never load it in a loop
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
      await Promise.resolve();
    });
    expect(await screen.findByText('hello Ann')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
