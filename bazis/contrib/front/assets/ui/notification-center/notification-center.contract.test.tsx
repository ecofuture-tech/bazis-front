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
// unread ones, the list `list:notifications` that it opens (each `notification:<key>`,
// marked read when the list opens), a toast for each new one (once, whatever the number of
// centers), the opening of the item of a notification and the clearing of the list. Keep it
// passing when the component is changed.

import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SocketProvider } from '@/bazis/react/ws';
import { NotificationCenter } from '@/bazis/ui/notification-center';
import { Toaster } from '@/bazis/ui/state-panel';
import { Backend, FakeSocket, renderWithBazis } from '@/bazis/ui/testing';

beforeEach(() => {
  FakeSocket.sockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
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

const FINISHED = { action: 'notification', title: 'Task finished', text: 'Write the report', resource: 'test.item', id: '7' };

function open() {
  act(() => {
    FakeSocket.last().open();
  });
}

function publish(message: unknown) {
  act(() => {
    FakeSocket.last().publish(message);
  });
}

describe('NotificationCenter', () => {
  it('counts the new notifications, toasts them and lists them', () => {
    renderWithBazis(
      <SocketProvider path="/ws" token="session-jwt">
        <NotificationCenter />
        <Toaster />
      </SocketProvider>,
      new Backend(),
    );
    open();
    const bell = screen.getByTestId('action:notifications');
    expect(bell.getAttribute('aria-label')).toBe('Notifications');
    publish(FINISHED);
    publish({ resource: 'test.item', id: '7' });
    publish({ action: 'notification', title: 'Second' });
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 2 unread');
    const toasts = screen.getByRole('region', { name: 'Notifications' });
    expect(toasts.textContent).toContain('Task finished');
    expect(toasts.textContent).toContain('Write the report');

    fireEvent.click(bell);
    const list = screen.getByTestId('list:notifications');
    const items = within(list).getAllByText(/Task finished|Second/);
    expect(items.map((it) => it.textContent)).toEqual(['Second', 'Task finished']);
    expect(list.querySelectorAll('[data-bz^="notification:"]')).toHaveLength(2);
    expect(bell.getAttribute('aria-label')).toBe('Notifications');
    // a notification that comes while the list is open is read
    publish({ action: 'notification', title: 'Third' });
    expect(within(screen.getByTestId('list:notifications')).getByText('Third')).toBeTruthy();
    expect(bell.getAttribute('aria-label')).toBe('Notifications');
  });

  it('toasts a notification once, whatever the number of centers', () => {
    renderWithBazis(
      <SocketProvider path="/ws" token="session-jwt">
        <NotificationCenter />
        <NotificationCenter />
        <Toaster />
      </SocketProvider>,
      new Backend(),
    );
    open();
    publish({ action: 'notification', title: 'Only once' });
    expect(screen.getAllByText('Only once')).toHaveLength(1);
  });

  it('opens the item of a notification, and clears the list', () => {
    const onOpen = vi.fn();
    renderWithBazis(
      <SocketProvider path="/ws" token="session-jwt">
        <NotificationCenter onOpen={onOpen} toasts={false} />
      </SocketProvider>,
      new Backend(),
    );
    open();
    publish(FINISHED);
    publish({ action: 'notification', title: 'About nothing' });
    fireEvent.click(screen.getByTestId('action:notifications'));
    const list = screen.getByTestId('list:notifications');
    // a notification without an item is not a link
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(list).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task finished', resource: 'test.item', id: '7' }));
    expect(screen.queryByTestId('list:notifications')).toBeNull();

    fireEvent.click(screen.getByTestId('action:notifications'));
    fireEvent.click(screen.getByTestId('action:clear-notifications'));
    expect(within(screen.getByTestId('list:notifications')).getByText('No notifications')).toBeTruthy();
  });
});
