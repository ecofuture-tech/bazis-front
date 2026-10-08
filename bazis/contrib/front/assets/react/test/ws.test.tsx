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
    // as the server sends them: the published JSON as a string
    const changed = JSON.parse(JSON.stringify(sample.ws_changed.data)) as unknown;
    expect(changedResource(changed)).toEqual({ resource: 'tasks.task', id: sample.ws_changed.data.id });
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

describe('the socket', () => {
  it('is on the origin of the page, or at a URL', () => {
    expect(socketUrl('/ws')).toBe(`ws://${window.location.host}/ws`);
    expect(socketUrl('wss://api.example.com/ws')).toBe('wss://api.example.com/ws');
  });

  it('sends the token in its first message, never in the URL', () => {
    const { result } = renderSocket(() => useSocket());
    expect(result.current).toEqual({ status: 'connecting', error: null });
    const socket = FakeSocket.last();
    expect(socket.url).toBe(`ws://${window.location.host}/ws`);
    act(() => {
      socket.open();
    });
    expect(socket.sent).toEqual([{ token: 'session-jwt' }]);
    expect(result.current).toEqual({ status: 'open', error: null });
  });

  it('is not opened without a path or a token, and closed at a logout', () => {
    const { result, props, rerender } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
    });
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
    act(() => {
      FakeSocket.last().open();
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    expect(FakeSocket.last().sent).toEqual([{ token: 'next-jwt' }]);
  });

  it('reconnects after a drop with a doubling delay', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(reconnectDelay(0)).toBe(RECONNECT_MIN);
    expect(reconnectDelay(1)).toBe(2 * RECONNECT_MIN);
    expect(reconnectDelay(20)).toBe(RECONNECT_MAX);
    const { result } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
      FakeSocket.last().drop();
    });
    expect(result.current.status).toBe('connecting');
    expect(FakeSocket.sockets).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MIN);
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    // the server cannot be reached: the next attempt waits twice as long
    act(() => {
      FakeSocket.last().drop(1006);
      vi.advanceTimersByTime(RECONNECT_MIN);
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MIN);
    });
    expect(FakeSocket.sockets).toHaveLength(3);
    act(() => {
      FakeSocket.last().open();
    });
    expect(result.current.status).toBe('open');
    expect(FakeSocket.last().sent).toEqual([{ token: 'session-jwt' }]);
  });

  it('stops at a token that the server refuses', () => {
    vi.useFakeTimers();
    const { result } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
      FakeSocket.last().receive({ type: 'error', code: 'expired_token', detail: 'Token expired' });
    });
    expect(result.current).toEqual({ status: 'rejected', error: 'expired_token' });
    expect(FakeSocket.last().closed).toBe(1000);
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MAX * 2);
    });
    expect(FakeSocket.sockets).toHaveLength(1);
  });

  it('reconnects after an internal error of the server', () => {
    vi.useFakeTimers();
    const { result } = renderSocket(() => useSocket());
    act(() => {
      FakeSocket.last().open();
      FakeSocket.last().receive({ type: 'error', code: 'internal_error', detail: 'Internal server error' });
    });
    expect(result.current.status).toBe('connecting');
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MIN);
    });
    expect(FakeSocket.sockets).toHaveLength(2);
  });

  it('pings, and reconnects when nothing answered', () => {
    vi.useFakeTimers();
    renderSocket(() => useSocket());
    const socket = FakeSocket.last();
    act(() => {
      socket.open();
      vi.advanceTimersByTime(PING_INTERVAL);
    });
    expect(socket.sent).toEqual([{ token: 'session-jwt' }, { type: 'ping' }]);
    act(() => {
      socket.receive({ type: 'pong' });
      vi.advanceTimersByTime(PING_INTERVAL);
    });
    expect(socket.sent).toHaveLength(3);
    // no pong: the socket is dead
    act(() => {
      vi.advanceTimersByTime(PING_INTERVAL);
    });
    expect(socket.closed).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MIN);
    });
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
      socket.open();
      socket.receive({ type: 'pong' });
      socket.publish({ resource: 'tasks.task', id: '1' });
      socket.publish('for everybody');
    });
    expect(messages).toEqual([{ resource: 'tasks.task', id: '1' }, 'for everybody']);
  });
});

describe('useNotifications', () => {
  it('keeps the notifications of the session, the newest first', () => {
    const { result, props, rerender } = renderSocket(() => useNotifications());
    act(() => {
      const socket = FakeSocket.last();
      socket.open();
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

  it('refetches the queries of a changed resource and of a task, and all after a reconnect', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const backend = new Backend().on('GET', PARENT, { data: [] }).on('GET', CHILD, { data: [] });
    const { queryClient } = renderSocket(() => {
      useLiveQueries(ROUTES);
      useList(PARENT);
      useList(CHILD);
    }, backend);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      const socket = FakeSocket.last();
      socket.open();
      socket.publish({ resource: 'entity.parent_entity', id: '1' });
      socket.publish({ resource: 'unknown.model' });
      socket.publish(sample.ws_notification.data);
      socket.publish(sample.ws_async_bg[0]?.data);
    });
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['bazis', PARENT],
      ['bazis', 'async_background', sample.ws_async_bg[0]?.data.task_id],
    ]);
    invalidate.mockClear();
    // the first open refetches nothing; an open after a drop refetches every query
    act(() => {
      FakeSocket.last().drop();
    });
    act(() => {
      vi.advanceTimersByTime(RECONNECT_MIN);
      FakeSocket.last().open();
    });
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([['bazis']]);
    await act(async () => {
      await Promise.resolve();
    });
  });
});
