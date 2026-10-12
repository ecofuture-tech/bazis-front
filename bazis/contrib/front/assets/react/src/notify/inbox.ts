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

// The stored notifications of the user (bazis-notify): the inbox API of its route set,
// `notify.notification` (only the notifications of the user of the request), and the live
// messages that `useLiveQueries` turns into refetches. The source of `NotificationCenter`.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBazis } from '../context.js';
import { keys } from '../keys.js';
import { invalidateResource } from '../mutations.js';
import { loose } from '../types.js';

/** The notifications that the inbox lists, the newest first. */
const INBOX_LIMIT = 50;

export type Severity = 'info' | 'success' | 'warning' | 'error';

/** A stored notification of the user. */
export interface InboxNotification {
  /** Its id, the key of the list. */
  key: string;
  /** Its JSON:API type, for its update. */
  type: string;
  /** The type of bazis-notify (`billing.purchase_declined`) and its category (`billing`). */
  notificationType: string;
  category: string;
  severity: Severity;
  title: string;
  /** Its body; null when it has none. */
  text: string | null;
  /** When it was created. */
  time: Date;
  read: boolean;
  /** `route` of its action (`action={'route': '/orders/1'}` of `notify`): where it leads; null without one. */
  route: string | null;
  action: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}

interface ResourceObject {
  id: string | number;
  type: string;
  attributes?: Readonly<Record<string, unknown>> | null;
}

const SEVERITIES: readonly string[] = ['info', 'success', 'warning', 'error'];

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** A notification of the list of the inbox API (or of a message `notification_created`, its attributes with its id). */
export function inboxNotification(item: ResourceObject): InboxNotification {
  const attributes = record(item.attributes);
  const action = record(attributes.action);
  const severity = text(attributes.severity);
  return {
    key: String(item.id),
    type: item.type,
    notificationType: text(attributes.notification_type),
    category: text(attributes.category),
    severity: SEVERITIES.includes(severity) ? (severity as Severity) : 'info',
    title: text(attributes.title),
    text: text(attributes.body) || null,
    time: new Date(text(attributes.dt_created)),
    read: attributes.is_read === true,
    route: typeof action.route === 'string' && action.route ? action.route : null,
    action,
    metadata: record(attributes.metadata),
  };
}

export interface InboxOptions {
  /** The notifications listed, the newest first: 50 by default. */
  limit?: number;
  /**
   * Read the list and the count again every `poll` milliseconds: for a backend without
   * bazis-ws, whose notifications come with no live message. None by default: with bazis-ws,
   * `useLiveQueries` refetches them on the messages of bazis-notify.
   */
  poll?: number;
}

export interface Inbox {
  items: readonly InboxNotification[];
  /** The unread notifications of the user, all of them (`unread_count/`), not only those listed. */
  unread: number;
  /** The reading of the list: `loading`, `error` (`error`, `retry()`), then `ready`. */
  status: 'loading' | 'error' | 'ready';
  error: Error | null;
  retry: () => void;
  /** Marks a notification read (PATCH of `read_at`), or all of them without a key (`read_all/`). */
  markRead: (key?: string) => void;
  /** Marks a notification unread again (`read_at: null`). */
  markUnread: (key: string) => void;
  /**
   * Deletes every stored notification of the user (`clear/`): irreversible, so it is not the
   * `clear` of a source of `NotificationCenter` (`onDeleteAll` there, with a confirmation).
   */
  deleteAll: () => void;
}

/** A change of the notifications: of one (its `read_at`), or an action of all of them. */
type Change = { kind: 'read' | 'unread'; key: string } | { kind: 'read_all' } | { kind: 'clear' };

/**
 * The stored notifications of the user from the route set of bazis-notify (`path`:
 * `ROUTES['notify.notification']`): the newest `limit`, the unread count, the read, the unread,
 * read all and delete all, after which the list and the count are read again (with bazis-ws, also
 * when the backend says they changed: `useLiveQueries`).
 */
export function useInbox(path: string, { limit = INBOX_LIMIT, poll }: InboxOptions = {}): Inbox {
  const { api, scope } = useBazis();
  const queryClient = useQueryClient();
  const client = loose(api);
  const query = { page: { limit } };
  const list = useQuery({
    queryKey: keys.list(path, query, scope),
    queryFn: ({ signal }) => client.list(path, { ...query, signal }) as Promise<{ data: readonly ResourceObject[] }>,
    refetchInterval: poll,
  });
  const count = useQuery({
    queryKey: keys.action(path, 'unread_count', undefined, scope),
    queryFn: ({ signal }) =>
      client.action(path, 'unread_count', undefined, { method: 'get', signal }) as Promise<{ unread_count: number }>,
    refetchInterval: poll,
  });
  const change = useMutation({
    mutationFn: async (variables: Change) => {
      if (!('key' in variables)) {
        await client.action(path, variables.kind, undefined, { method: 'post' });
        return;
      }
      const item = list.data?.data.find((it) => String(it.id) === variables.key);
      // the time is the server's: any time marks it read, null unread
      const readAt = variables.kind === 'read' ? new Date().toISOString() : null;
      await client.update(path, variables.key, {
        data: { id: variables.key, type: item?.type ?? 'notify.notification', attributes: { read_at: readAt } },
      });
    },
    onSettled: () => invalidateResource(queryClient, path),
  });
  const { mutate } = change;
  const items = useMemo(() => (list.data?.data ?? []).map(inboxNotification), [list.data]);
  return {
    items,
    unread: count.data?.unread_count ?? 0,
    status: list.isPending ? 'loading' : list.isError ? 'error' : 'ready',
    error: list.error,
    retry: () => {
      void list.refetch();
      void count.refetch();
    },
    markRead: (key) => {
      mutate(key === undefined ? { kind: 'read_all' } : { kind: 'read', key });
    },
    markUnread: (key) => {
      mutate({ kind: 'unread', key });
    },
    deleteAll: () => {
      mutate({ kind: 'clear' });
    },
  };
}
