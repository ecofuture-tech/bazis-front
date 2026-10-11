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

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inboxNotification, useInbox } from '../src/notify/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, render } from './support.js';

const INBOX = '/api/v1/notify/notification/';
const LIST = `${INBOX}?page%5Blimit%5D=50`;
const COUNT = `${INBOX}unread_count/`;
const [STORED] = sample.notify_list.data;
const ID = STORED?.id ?? '';

function backend() {
  return new Backend()
    .on('GET', LIST, sample.notify_list)
    .on('GET', COUNT, sample.notify_unread_count)
    .on('PATCH', `${INBOX}${ID}/`, sample.notify_list.data[0])
    .on('POST', `${INBOX}read_all/`, { read: 1 })
    .on('POST', `${INBOX}clear/`, { deleted: 1 });
}

async function loaded(server: Backend) {
  const rendered = render(() => useInbox(INBOX), server);
  await waitFor(() => {
    expect(rendered.result.current.status).toBe('ready');
    expect(rendered.result.current.unread).toBe(1);
  });
  server.calls.length = 0;
  return rendered;
}

describe('inboxNotification', () => {
  it('reads a notification of the sample, from the list and from its live message', () => {
    const read = inboxNotification(STORED as never);
    expect(read).toEqual({
      key: ID,
      type: 'notify.notification',
      notificationType: 'tasks.finished',
      category: 'tasks',
      severity: 'success',
      title: 'Task finished',
      text: 'Notify',
      time: new Date('2026-01-01T00:00:00Z'),
      read: false,
      route: `/tasks/${ID}`,
      action: { route: `/tasks/${ID}` },
      metadata: {},
    });
    const { notification } = sample.ws_notification_created.data;
    expect(inboxNotification({ id: notification.id, type: 'notify.notification', attributes: notification })).toEqual(read);
  });

  it('reads a notification without a body, an action or a known severity', () => {
    expect(
      inboxNotification({ id: 7, type: 'notify.notification', attributes: { title: 'T', body: '', action: {}, severity: 'odd', is_read: true } }),
    ).toMatchObject({ key: '7', text: null, route: null, severity: 'info', read: true, metadata: {} });
  });
});

describe('useInbox', () => {
  it('lists the newest notifications and counts the unread ones, keyed under the resource', async () => {
    const server = backend();
    const { result, queryClient } = render(() => useInbox(INBOX), server);
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.items.map((it) => it.title)).toEqual(['Task finished']);
    expect(result.current.unread).toBe(1);
    expect(server.requests().sort()).toEqual([`GET ${LIST}`, `GET ${COUNT}`]);
    // a message of bazis-notify refetches the resource (`useLiveQueries`): both
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', INBOX, 'list', { page: { limit: 50 } }, 's1'],
      ['bazis', INBOX, 'action', 'unread_count', 's1'],
    ]);
  });

  it('marks one read and unread with read_at, all read, deletes all, and reads them again', async () => {
    const server = backend();
    const { result } = await loaded(server);
    act(() => {
      result.current.markRead(ID);
    });
    await waitFor(() => {
      expect(server.requests()).toContain(`GET ${LIST}`);
    });
    const patch = server.calls[0];
    expect(patch?.method).toBe('PATCH');
    const body = patch?.body as { data: { id: string; type: string; attributes: { read_at: string | null } } };
    expect(body.data.id).toBe(ID);
    expect(body.data.type).toBe('notify.notification');
    // any time: the backend sets its own
    expect(Number.isNaN(Date.parse(body.data.attributes.read_at ?? ''))).toBe(false);

    const changes = [
      [
        () => {
          result.current.markUnread(ID);
        },
        { method: 'PATCH', body: { data: { id: ID, type: 'notify.notification', attributes: { read_at: null } } } },
      ],
      [
        () => {
          result.current.markRead();
        },
        { method: 'POST', url: expect.stringContaining('/read_all/') as unknown },
      ],
      [
        () => {
          result.current.deleteAll();
        },
        { method: 'POST', url: expect.stringContaining('/clear/') as unknown },
      ],
    ] as const;
    for (const [change, expected] of changes) {
      server.calls.length = 0;
      act(() => {
        change();
      });
      await waitFor(() => {
        expect(server.requests().filter((it) => it.startsWith('GET'))).toHaveLength(2);
      });
      expect(server.calls[0]).toMatchObject(expected);
    }
  });

  it('gives the error of the list and reads it again', async () => {
    const server = new Backend().on('GET', LIST, { errors: [{ status: 403, detail: 'Forbidden' }] }, 403).on('GET', COUNT, sample.notify_unread_count);
    const { result } = render(() => useInbox(INBOX), server);
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).not.toBeNull();
    server.on('GET', LIST, sample.notify_list);
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });
});
