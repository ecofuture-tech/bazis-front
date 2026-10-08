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

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { BazisProvider, useList } from '../src/index.js';
import {
  changedResource,
  notificationOf,
  PING_INTERVAL,
  RECONNECT_MAX,
  RECONNECT_MIN,
  reconnectDelay,
  SocketProvider,
  socketUrl,
  STABLE_AFTER,
  UNAVAILABLE_AFTER,
  useChannel,
  useLiveQueries,
  useNotifications,
  useSocket,
} from '../src/ws/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, BASE, CHILD, createQueryClient, PARENT } from './support.js';
import { FakeSocket } from './socket.js';

interface Props {
  path: string | null;
  token: string | null;
  session: string;
}

/** Renders a hook under the socket of `props`; change them, then `rerender()`. */
function renderSocket<Result>(hook: () => Result, backend = new Backend(), queryClient: QueryClient = createQueryClient()) {
  const api = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });
  const props: Props = { path: '/ws', token: 'session-jwt', session: 's1' };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session={props.session}>
          <SocketProvider path={props.path} token={props.token}>
            {children}
          </SocketProvider>
        </BazisProvider>
      </QueryClientProvider>
    );
  }
  return Object.assign(renderHook(hook, { wrapper: Wrapper }), { props, queryClient });
}

beforeEach(() => {
  FakeSocket.sockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the messages', () => {
  it('read the formats of the sample', () => {
    // the common channel of the sample: the resource, never the id of an item
    expect(sample.ws_changed.data).toEqual({ resource: 'tasks.task' });
    expect(changedResource(sample.ws_changed.data)).toEqual({ resource: 'tasks.task', id: null });
    const received = new Date();
    expect(notificationOf(sample.ws_notification.data, 1, received)).toEqual({
      key: 1,
      title: 'Task finished',
      text: 'Notify',
      resource: 'tasks.task',
      id: sample.ws_notification.data.id,
      received,
      read: false,
    });
    // a notification about an item: the item changed
    expect(changedResource(sample.ws_notification.data)).toEqual({ resource: 'tasks.task', id: sample.ws_notification.data.id });
    // the statuses of a task of bazis-async-background are not the change of a resource
    for (const { data } of sample.ws_async_bg) expect(changedResource({ ...data, resource: 'x' })).toBeNull();
  });

  it('leave out other messages', () => {
    for (const message of ['text', 1, null, [], { title: 'No action' }, { action: 'notification' }]) {
      expect(notificationOf(message, 1, new Date())).toBeNull();
    }
    expect(changedResource({ resource: 1 })).toBeNull();
    expect(changedResource({ resource: 'tasks.task' })).toEqual({ resource: 'tasks.task', id: null });
    expect(changedResource({ resource: 'tasks.task', id: 7 })).toEqual({ resource: 'tasks.task', id: '7' });
  });
});

/** Advances the fake timers inside act. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The server accepts the last socket and the token. */
function accept() {
  act(() => {
    FakeSocket.last().accept();
  });
}

/** The last socket drops. */
function drop(code?: number) {
  act(() => {
    FakeSocket.last().drop(code);
  });
}

describe('the socket', () => {
  it('is on the origin of the page, or at a URL', () => {
    expect(socketUrl('/ws')).toBe(`ws://${window.location.host}/ws`);
    expect(socketUrl('wss://api.example.com/ws')).toBe('wss://api.example.com/ws');
  });

  it('sends the token in its first message, and is open once the server answered after it', () => {
    const { result } = renderSocket(() => useSocket());
    expect(result.current).toMatchObject({ status: 'connecting', error: null });
    const socket = FakeSocket.last();
    expect(socket.url).toBe(`ws://${window.location.host}/ws`);
    act(() => {
      socket.open();
    });
    // never in the URL; the ping proves that the server took the token
    expect(socket.sent).toEqual([{ token: 'session-jwt' }, { type: 'ping' }]);
    expect(result.current.status).toBe('connecting');
    act(() => {
      socket.receive({ type: 'pong' });
    });
    expect(result.current).toMatchObject({ status: 'open', error: null });
  });

  it('is not opened without a path or a token, and closed at a logout', () => {
    const { result, props, rerender } = renderSocket(() => useSocket());
    accept();
    props.token = null;
    rerender();
    expect(result.current.status).toBe('idle');
    expect(FakeSocket.last().closed).toBe(1000);
    props.token = 'next-jwt';
    props.path = null;
    rerender();
    expect(result.current.status).toBe('idle');
    expect(FakeSocket.sockets).toHaveLength(1);
    // the token of the next user: another socket
    props.path = '/ws';
    rerender();
    accept();
    expect(FakeSocket.sockets).toHaveLength(2);
    expect(FakeSocket.last().sent).toEqual([{ token: 'next-jwt' }, { type: 'ping' }]);
  });

  it('backs off while the server drops the session at once, and starts again after a connection that lasted', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(reconnectDelay(0)).toBe(RECONNECT_MIN);
    expect(reconnectDelay(1)).toBe(2 * RECONNECT_MIN);
    expect(reconnectDelay(20)).toBe(RECONNECT_MAX);
    const { result } = renderSocket(() => useSocket());
    // accepted, then dropped (1011: Redis is down), again and again: the delays double
    for (const delay of [RECONNECT_MIN, 2 * RECONNECT_MIN, 4 * RECONNECT_MIN]) {
      const count = FakeSocket.sockets.length;
      accept();
      drop();
      expect(result.current.status).toBe('connecting');
      advance(delay - 1);
      expect(FakeSocket.sockets).toHaveLength(count);
      advance(1);
      expect(FakeSocket.sockets).toHaveLength(count + 1);
    }
    // a connection that lasted: the next drop waits the first delay again
    accept();
    advance(STABLE_AFTER);
    drop();
    advance(RECONNECT_MIN);
    expect(FakeSocket.sockets).toHaveLength(5);
  });

  it('backs off after an error of the server, as after a drop', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { result } = renderSocket(() => useSocket());
    for (const delay of [RECONNECT_MIN, 2 * RECONNECT_MIN]) {
      const count = FakeSocket.sockets.length;
      act(() => {
        FakeSocket.last().open();
        FakeSocket.last().receive({ type: 'error', code: 'internal_error', detail: 'Internal server error' });
      });
      expect(result.current.status).toBe('connecting');
      expect(FakeSocket.last().closed).not.toBeNull();
      advance(delay - 1);
      expect(FakeSocket.sockets).toHaveLength(count);
      advance(1);
      expect(FakeSocket.sockets).toHaveLength(count + 1);
    }
  });

  it('stops at a token that the server refuses', () => {
    vi.useFakeTimers();
    const { result } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
      FakeSocket.last().receive({ type: 'error', code: 'expired_token', detail: 'Token expired' });
    });
    expect(result.current).toMatchObject({ status: 'rejected', error: 'expired_token' });
    expect(FakeSocket.last().closed).toBe(1000);
    advance(RECONNECT_MAX * 2);
    expect(FakeSocket.sockets).toHaveLength(1);
  });

  it('is unavailable when no socket answers at the path, and keeps trying slowly', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { result } = renderSocket(() => useSocket());
    // a 404 of the handshake, a server that restarts: the socket closes without being opened
    for (let attempt = 1; attempt < UNAVAILABLE_AFTER; attempt += 1) {
      drop(1006);
      expect(result.current.status).toBe('connecting');
      advance(RECONNECT_MAX);
    }
    drop(1006);
    expect(result.current).toMatchObject({ status: 'unavailable', error: null });
    // the next attempt at the longest delay, still unavailable while it fails
    advance(RECONNECT_MAX - 1);
    expect(FakeSocket.sockets).toHaveLength(UNAVAILABLE_AFTER);
    advance(1);
    expect(FakeSocket.sockets).toHaveLength(UNAVAILABLE_AFTER + 1);
    expect(result.current.status).toBe('unavailable');
    // the server is back: the socket recovers
    accept();
    expect(result.current.status).toBe('open');
  });

  it('tries at once when the network comes back, the page is shown or the user retries', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { result } = renderSocket(() => useSocket());
    for (let attempt = 0; attempt < UNAVAILABLE_AFTER; attempt += 1) {
      drop(1006);
      if (attempt < UNAVAILABLE_AFTER - 1) advance(RECONNECT_MAX);
    }
    expect(result.current.status).toBe('unavailable');
    const count = FakeSocket.sockets.length;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(FakeSocket.sockets).toHaveLength(count + 1);
    // an attempt runs: another event does not open a second socket
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(FakeSocket.sockets).toHaveLength(count + 1);
    drop(1006);
    // a page shown again
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(FakeSocket.sockets).toHaveLength(count + 2);
    drop(1006);
    // the retry of the user (LiveQuery)
    act(() => {
      result.current.retry();
    });
    expect(FakeSocket.sockets).toHaveLength(count + 3);
    accept();
    expect(result.current.status).toBe('open');
    // a live socket is not replaced
    act(() => {
      window.dispatchEvent(new Event('online'));
      result.current.retry();
    });
    expect(FakeSocket.sockets).toHaveLength(count + 3);
  });

  it('does not retry a token that the server refused', () => {
    vi.useFakeTimers();
    const { result } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
      FakeSocket.last().receive({ type: 'error', code: 'invalid_token' });
      window.dispatchEvent(new Event('online'));
      result.current.retry();
    });
    expect(result.current.status).toBe('rejected');
    expect(FakeSocket.sockets).toHaveLength(1);
  });

  it('pings, and reconnects when nothing answered', () => {
    vi.useFakeTimers();
    renderSocket(() => useSocket());
    const socket = FakeSocket.last();
    accept();
    advance(PING_INTERVAL);
    expect(socket.sent).toEqual([{ token: 'session-jwt' }, { type: 'ping' }, { type: 'ping' }]);
    act(() => {
      socket.receive({ type: 'pong' });
    });
    advance(PING_INTERVAL);
    expect(socket.sent).toHaveLength(4);
    // no pong: the socket is dead
    advance(PING_INTERVAL);
    expect(socket.closed).not.toBeNull();
    advance(RECONNECT_MIN);
    expect(FakeSocket.sockets).toHaveLength(2);
  });

  it('gives the channel the published messages, parsed', () => {
    const messages: unknown[] = [];
    renderSocket(() => {
      useChannel((message) => {
        messages.push(message);
      });
    });
    act(() => {
      const socket = FakeSocket.last();
      socket.accept();
      socket.publish({ resource: 'tasks.task' });
      socket.publish('for everybody');
    });
    expect(messages).toEqual([{ resource: 'tasks.task' }, 'for everybody']);
  });
});

describe('useNotifications', () => {
  it('keeps the notifications of the session, the newest first', () => {
    const { result, props, rerender } = renderSocket(() => useNotifications());
    act(() => {
      const socket = FakeSocket.last();
      socket.accept();
      socket.publish(sample.ws_notification.data);
      socket.publish(sample.ws_changed.data);
      socket.publish({ ...sample.ws_notification.data, title: 'Second', text: undefined });
    });
    const [second, first] = result.current.items;
    expect([second?.title, second?.text, first?.title, first?.text]).toEqual(['Second', null, 'Task finished', 'Notify']);
    expect(second?.key).toBe((first?.key ?? 0) + 1);
    expect(result.current.unread).toBe(2);
    act(() => {
      result.current.markRead();
    });
    expect(result.current.unread).toBe(0);
    expect(result.current.items).toHaveLength(2);
    // another user
    props.session = 's2';
    rerender();
    expect(result.current.items).toEqual([]);
    act(() => {
      FakeSocket.last().publish({ action: 'notification', title: 'Third' });
    });
    expect(result.current.items.map((it) => it.title)).toEqual(['Third']);
    act(() => {
      result.current.clear();
    });
    expect(result.current.items).toEqual([]);
  });
});

describe('useLiveQueries', () => {
  const ROUTES = { 'entity.parent_entity': PARENT, 'entity.child_entity': CHILD };

  function live() {
    const backend = new Backend().on('GET', PARENT, { data: [] }).on('GET', CHILD, { data: [] });
    const rendered = renderSocket(() => {
      useLiveQueries(ROUTES);
      useList(PARENT);
      useList(CHILD);
    }, backend);
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries');
    return { invalidate, keys: () => invalidate.mock.calls.map(([filters]) => filters?.queryKey) };
  }

  it('refetches the queries of a changed resource and of a task', () => {
    const { keys } = live();
    act(() => {
      const socket = FakeSocket.last();
      socket.accept();
      socket.publish({ resource: 'entity.parent_entity' });
      socket.publish({ resource: 'unknown.model' });
      socket.publish(sample.ws_notification.data);
      socket.publish(sample.ws_async_bg[0]?.data);
    });
    expect(keys()).toEqual([
      ['bazis', PARENT],
      ['bazis', 'async_background', sample.ws_async_bg[0]?.data.task_id],
    ]);
  });

  it('refetches every query after a reconnect that the server took, not while it drops the session', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { invalidate, keys } = live();
    // the first open refetches nothing
    accept();
    expect(keys()).toEqual([]);
    // opened, then dropped before the server answered: no refetch, and the delays grow
    let delay = RECONNECT_MIN;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      drop();
      advance(delay);
      act(() => {
        FakeSocket.last().open();
      });
      delay *= 2;
    }
    expect(keys()).toEqual([]);
    // the next one is taken: one refetch of every query
    act(() => {
      FakeSocket.last().receive({ type: 'pong' });
    });
    expect(keys()).toEqual([['bazis']]);
    invalidate.mockClear();
  });
});
