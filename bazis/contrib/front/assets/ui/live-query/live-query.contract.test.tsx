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

// The contract of the live queries: the state of the socket of bazis-ws as
// `socket:<status>` (also `unavailable` when no socket answers at the path), and the queries of a resource refetched when a message says it changed.
// Keep it passing when the component is changed.

import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useList } from '@/bazis/react';
import { RECONNECT_MAX, SocketProvider, UNAVAILABLE_AFTER } from '@/bazis/react/ws';
import { LiveQuery } from '@/bazis/ui/live-query';
import { Backend, FakeSocket, ITEMS, listDocument, renderWithBazis } from '@/bazis/ui/testing';

beforeEach(() => {
  FakeSocket.sockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Items() {
  useList(ITEMS as never);
  return null;
}

describe('LiveQuery', () => {
  it('shows the state of the socket', () => {
    renderWithBazis(
      <SocketProvider path="/ws" token="session-jwt">
        <LiveQuery routes={{}} />
      </SocketProvider>,
      new Backend(),
    );
    expect(screen.getByTestId('socket:connecting').textContent).toBe('Connecting for live updates');
    act(() => {
      FakeSocket.last().accept();
    });
    expect(screen.getByTestId('socket:open').getAttribute('role')).toBe('status');
    act(() => {
      FakeSocket.last().onmessage?.(
        new MessageEvent('message', { data: JSON.stringify({ type: 'error', code: 'expired_token' }) }),
      );
    });
    expect(screen.getByTestId('socket:rejected')).toBeTruthy();
  });

  it('shows that the live updates are unavailable when no socket answers', () => {
    vi.useFakeTimers();
    try {
      renderWithBazis(
        <SocketProvider path="/ws" token="session-jwt">
          <LiveQuery routes={{}} />
        </SocketProvider>,
        new Backend(),
      );
      for (let attempt = 0; attempt < UNAVAILABLE_AFTER; attempt += 1) {
        act(() => {
          FakeSocket.last().drop(1006);
          vi.advanceTimersByTime(RECONNECT_MAX);
        });
      }
      expect(screen.getByTestId('socket:unavailable').textContent).toBe('Live updates unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it('is off without a token', () => {
    renderWithBazis(
      <SocketProvider path="/ws" token={null}>
        <LiveQuery routes={{}} />
      </SocketProvider>,
      new Backend(),
    );
    expect(screen.getByTestId('socket:idle')).toBeTruthy();
    expect(FakeSocket.sockets).toEqual([]);
  });

  it('refetches the queries of a resource that changed', async () => {
    const backend = new Backend().on('GET', ITEMS, listDocument([]));
    renderWithBazis(
      <SocketProvider path="/ws" token="session-jwt">
        <LiveQuery routes={{ 'test.item': ITEMS }} />
        <Items />
      </SocketProvider>,
      backend,
    );
    await waitFor(() => {
      expect(backend.requests('GET')).toHaveLength(1);
    });
    act(() => {
      FakeSocket.last().accept();
      FakeSocket.last().publish({ resource: 'test.other' });
      FakeSocket.last().publish({ resource: 'test.item' });
    });
    await waitFor(() => {
      expect(backend.requests('GET')).toHaveLength(2);
    });
  });
});
