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

// The messages that the hooks read on the socket, the published JSON parsed. bazis-ws carries
// any JSON; these are the formats of bazis-front (a backend publishes them with
// `user.ws_publish(...)` or to `COMMON_CHANNEL` of bazis-ws) and of bazis-async-background:
//
// - `{"resource": "<JSON:API type>", "id": "<id>"}`: the item changed (its id may be
//   absent: the resource changed); `useLiveQueries` refetches the queries of the resource.
// - `{"action": "notification", "title": "...", "text"?: "...", "resource"?: "...", "id"?: "..."}`:
//   a notification of the user (`useNotifications`); with a resource, it also changed.
// - `{"action": "async_bg", "task_id": "...", "status": "..."}`: the status of a task of
//   bazis-async-background (sent by the backend itself); `useLiveQueries` refetches the
//   task (`useAsyncTask`).

/** A notification of the user, as received. */
export interface Notification {
  /** Its number in the page, from 1: the later, the greater. */
  key: number;
  title: string;
  text: string | null;
  /** The JSON:API type and the id of the item it is about. */
  resource: string | null;
  id: string | null;
  received: Date;
  read: boolean;
}

type Message = Readonly<Record<string, unknown>>;

function object(message: unknown): Message | null {
  return typeof message === 'object' && message !== null && !Array.isArray(message) ? (message as Message) : null;
}

/** An id of the backend, a string or a number (an integer primary key). */
function identifier(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** The resource (and the item) that a message says changed; null for another message. */
export function changedResource(message: unknown): { resource: string; id: string | null } | null {
  const data = object(message);
  if (data === null || typeof data.resource !== 'string' || data.action === 'async_bg') return null;
  return { resource: data.resource, id: identifier(data.id) };
}

/** The notification of a message (numbered `key`), null for another message. */
export function notificationOf(message: unknown, key: number, received: Date): Notification | null {
  const data = object(message);
  if (data === null || data.action !== 'notification' || typeof data.title !== 'string') return null;
  return {
    key,
    title: data.title,
    text: typeof data.text === 'string' ? data.text : null,
    resource: typeof data.resource === 'string' ? data.resource : null,
    id: identifier(data.id),
    received,
    read: false,
  };
}

/** The status of a task of bazis-async-background that a message carries; null for another message. */
export function backgroundStatusOf(message: unknown): { taskId: string; status: string } | null {
  const data = object(message);
  if (data === null || data.action !== 'async_bg' || typeof data.task_id !== 'string') return null;
  return { taskId: data.task_id, status: typeof data.status === 'string' ? data.status : '' };
}
