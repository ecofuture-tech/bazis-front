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

// The contract of the notifications: the bell `action:notifications` with the count of the
// unread ones, the list `list:notifications` that it opens (each `notification:<key>`), where
// a click marks a notification read and opens it, `action:read-notifications`,
// `action:clear-notifications` of a source that can forget them (the session of bazis-ws), the
// deletion with a confirmation only with `onDeleteAll`, a toast for each new one (once,
// whatever the number of centers, none for those there when they are first read or that came
// while the list was open), the states of the reading. The source is a plain object, as
// `useInbox` (bazis-notify) and `useNotifications` (bazis-ws) give it. Keep it passing when
// the component is changed.

import { act, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationCenter, type CenterNotification, type NotificationSource } from '@/bazis/ui/notification-center';
import { Toaster } from '@/bazis/ui/state-panel';
import { Backend, renderWithBazis } from '@/bazis/ui/testing';

beforeEach(() => {
  // the popover is positioned with ResizeObserver, which jsdom does not have
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Note extends CenterNotification {
  key: string;
  route: string | null;
}

let keys = 0;

/** A notification, unread, with a key unique in the tests (the toasts are once per page). */
function note(title: string, extra: Partial<Note> = {}): Note {
  keys += 1;
  return { key: `n${String(keys)}`, title, text: null, time: new Date('2026-01-01T09:30:00Z'), read: false, route: null, ...extra };
}

/** The source of the tests: its state, its actions recorded, `push` and `set` change it. */
function source(
  initial: readonly Note[],
  status: NotificationSource<Note>['status'] = 'ready',
  { forgets = true }: { forgets?: boolean } = {},
) {
  type Change = Partial<{ items: readonly Note[]; status: NotificationSource<Note>['status'] }>;
  const handle = {
    markRead: vi.fn(),
    clear: vi.fn(),
    retry: vi.fn(),
    /** Changes the source, set by the rendered center. */
    set: (change: Change): void => {
      throw new Error(`Not rendered: ${JSON.stringify(change)}`);
    },
  };
  function Center({ count = 1, onOpen, onDeleteAll }: { count?: number; onOpen?: (it: Note) => void; onDeleteAll?: () => void }) {
    const [state, setState] = useState({ items: initial, status });
    handle.set = (change) => {
      act(() => {
        setState((current) => ({ ...current, ...change }));
      });
    };
    const notifications: NotificationSource<Note> = {
      items: state.items,
      unread: state.items.filter((it) => !it.read).length,
      status: state.status,
      error: state.status === 'error' ? new Error('Down') : null,
      retry: handle.retry,
      markRead: handle.markRead,
      ...(forgets ? { clear: handle.clear } : {}),
    };
    return (
      <>
        {Array.from({ length: count }, (_, index) => (
          <NotificationCenter key={index} notifications={notifications} onOpen={onOpen} onDeleteAll={onDeleteAll} />
        ))}
        <Toaster />
      </>
    );
  }
  return { handle, Center };
}

describe('NotificationCenter', () => {
  it('counts the unread notifications and lists them, the unread ones marked', () => {
    const { Center } = source([note('Task finished', { text: 'Write the report' }), note('Old', { read: true })]);
    renderWithBazis(<Center />, new Backend());
    const bell = screen.getByTestId('action:notifications');
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 1 unread');
    fireEvent.click(bell);
    const list = screen.getByTestId('list:notifications');
    const items = list.querySelectorAll('[data-bz^="notification:"]');
    expect([...items].map((it) => it.textContent)).toEqual([
      expect.stringMatching(/^UnreadTask finished.*Write the report$/) as unknown,
      expect.stringMatching(/^Old/) as unknown,
    ]);
    // the list is open: nothing is read until it is clicked
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 1 unread');
  });

  it('marks a notification read when it is clicked and opens it, marks all read, clears', () => {
    const first = note('Task finished', { route: '/tasks/7' });
    const read = note('Read', { read: true });
    const { Center, handle } = source([first, read]);
    const onOpen = vi.fn();
    renderWithBazis(<Center onOpen={onOpen} />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(within(screen.getByTestId(`notification:${first.key}`)).getByRole('button'));
    expect(handle.markRead).toHaveBeenCalledWith(first.key);
    expect(onOpen).toHaveBeenCalledWith(first);
    expect(screen.queryByTestId('list:notifications')).toBeNull();

    // a read one is opened, not marked again
    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(within(screen.getByTestId(`notification:${read.key}`)).getByRole('button'));
    expect(handle.markRead).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenLastCalledWith(read);

    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(screen.getByTestId('action:read-notifications'));
    expect(handle.markRead).toHaveBeenLastCalledWith();
    fireEvent.click(screen.getByTestId('action:clear-notifications'));
    expect(handle.clear).toHaveBeenCalledOnce();
    handle.set({ items: [] });
    expect(within(screen.getByTestId('list:notifications')).getByText('No notifications')).toBeTruthy();
    expect(screen.queryByTestId('action:read-notifications')).toBeNull();
    expect(screen.queryByTestId('action:clear-notifications')).toBeNull();
  });

  it('offers no clear of the stored notifications, and deletes them only after a confirmation', () => {
    const { Center, handle } = source([note('Stored')], 'ready', { forgets: false });
    const onDeleteAll = vi.fn();
    const { unmount } = renderWithBazis(<Center />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    expect(screen.queryByTestId('action:clear-notifications')).toBeNull();
    expect(screen.queryByTestId('action:delete-notifications')).toBeNull();
    unmount();

    renderWithBazis(<Center onDeleteAll={onDeleteAll} />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(screen.getByTestId('action:delete-notifications'));
    expect(onDeleteAll).not.toHaveBeenCalled();
    // cancelled
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('action:confirm-delete-notifications')).toBeNull();
    fireEvent.click(screen.getByTestId('action:delete-notifications'));
    fireEvent.click(screen.getByTestId('action:confirm-delete-notifications'));
    expect(onDeleteAll).toHaveBeenCalledOnce();
    expect(handle.clear).not.toHaveBeenCalled();
  });

  it('toasts no notification that came while the list was open', () => {
    const { Center, handle } = source([]);
    renderWithBazis(<Center />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    handle.set({ items: [note('Seen in the list')] });
    expect(within(screen.getByTestId('list:notifications')).getByText('Seen in the list')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByTestId('list:notifications')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Notifications' })?.textContent ?? '').not.toContain('Seen in the list');
  });

  it('keeps the list open without onOpen', () => {
    const first = note('Plain');
    const { Center, handle } = source([first]);
    renderWithBazis(<Center />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(within(screen.getByTestId(`notification:${first.key}`)).getByRole('button'));
    expect(handle.markRead).toHaveBeenCalledWith(first.key);
    expect(screen.getByTestId('list:notifications')).toBeTruthy();
  });

  it('toasts each new notification once, whatever the number of centers, not those it found', () => {
    const { Center, handle } = source([], 'loading');
    renderWithBazis(<Center count={2} />, new Backend());
    const found = note('Found at the first reading');
    handle.set({ status: 'ready', items: [found] });
    expect(screen.queryByRole('region', { name: 'Notifications' })?.textContent ?? '').not.toContain('Found');
    const fresh = note('Only once', { text: 'Write the report', severity: 'success' });
    handle.set({ items: [fresh, note('Already read', { read: true }), found] });
    const toasts = screen.getByRole('region', { name: 'Notifications' });
    expect(within(toasts).getAllByText('Only once')).toHaveLength(1);
    expect(toasts.textContent).toContain('Write the report');
    expect(toasts.textContent).not.toContain('Already read');
  });

  it('shows the reading of the notifications and its retry', () => {
    const { Center, handle } = source([], 'loading');
    renderWithBazis(<Center />, new Backend());
    fireEvent.click(screen.getByTestId('action:notifications'));
    expect(screen.getByTestId('state:loading')).toBeTruthy();
    expect(screen.queryByTestId('list:notifications')).toBeNull();
    handle.set({ status: 'error' });
    fireEvent.click(within(screen.getByTestId('state:error')).getByTestId('action:retry'));
    expect(handle.retry).toHaveBeenCalledOnce();
    handle.set({ status: 'ready', items: [note('Back')] });
    expect(within(screen.getByTestId('list:notifications')).getByText('Back')).toBeTruthy();
  });
});
