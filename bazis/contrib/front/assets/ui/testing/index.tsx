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

// The support of the contract tests of the components (`*.contract.test.tsx`): a backend
// that answers the requests of the client (a mocked `fetch`, and the XMLHttpRequest of its
// uploads), the documents and runtime
// schemas of Bazis it answers with, a socket of bazis-ws (`FakeSocket`), and the render of
// a component inside the providers of the hooks and a router. The tests find the elements by their `data-bz` (`getByTestId`).
// Only the tests import it.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, configure, render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach } from 'vitest';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';

// `getByTestId('state:loaded')` finds `data-bz="state:loaded"`, as the scenarios do
configure({ testIdAttribute: 'data-bz' });
// vitest has no globals: unmount what a test rendered
afterEach(cleanup);

export const BASE = 'https://api.test';

/**
 * The route set of the tests, of no product: pass it as `path={ITEMS as never}`, since the
 * components are typed by the paths of the product.
 */
export const ITEMS = '/api/test/item/';
export const ITEM_ID = '7c1e5a4e-0000-4000-8000-000000000001';

export interface Call {
  method: string;
  /** The path and the query, without the origin. */
  url: string;
  body: unknown;
}

interface Reply {
  status: number;
  body?: unknown;
  pending?: boolean;
}

/**
 * The XMLHttpRequest of an upload of the client: sent to the backend, which answers it as a
 * fetch (with the reply of `POST <url>`), after the progress of half and of all the file.
 */
class UploadRequest {
  private url = '';
  status = 0;
  statusText = '';
  responseText = '';
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private aborted = false;

  constructor(private readonly backend: Backend) {}

  open(_method: string, url: string) {
    this.url = url;
  }

  setRequestHeader() {
    // the headers are those of the client, checked by its tests
  }

  send(body: FormData) {
    const file = body.get('file');
    const size = file instanceof Blob ? file.size : 0;
    const fields = Object.fromEntries(
      [...body.entries()].map(([name, value]) => [name, value instanceof File ? value.name : value]),
    );
    void this.backend.fetch(this.url, { method: 'POST', body: JSON.stringify(fields) }).then(async (response) => {
      if (this.aborted) return;
      this.upload.onprogress?.({ loaded: Math.floor(size / 2), total: size, lengthComputable: true });
      this.upload.onprogress?.({ loaded: size, total: size, lengthComputable: true });
      this.status = response.status;
      this.statusText = response.statusText;
      this.responseText = await response.text();
      this.onload?.();
    });
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

/**
 * A backend: `on(method, url, body, status)` registers a reply; a url without `?` answers
 * the path with any query. `calls` are the requests, in their order; an upload is a `POST`
 * whose body has the name of its file (`{file: 'brief.txt'}`).
 */
export class Backend {
  readonly calls: Call[] = [];
  private readonly replies = new Map<string, Reply>();

  on(method: string, url: string, body?: unknown, status = 200): this {
    this.replies.set(`${method} ${url}`, { status, body });
    return this;
  }

  /** The request never gets a reply: what renders while it loads. */
  hold(method: string, url: string): this {
    this.replies.set(`${method} ${url}`, { status: 0, pending: true });
    return this;
  }

  /** The urls of the requests, `METHOD /path?query`. */
  requests(method?: string): string[] {
    return this.calls
      .filter((call) => method === undefined || call.method === method)
      .map((call) => `${call.method} ${call.url}`);
  }

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = href.slice(BASE.length);
    const method = init?.method ?? 'GET';
    const text = typeof init?.body === 'string' ? init.body : undefined;
    this.calls.push({ method, url, body: text === undefined ? undefined : (JSON.parse(text) as unknown) });
    const reply =
      this.replies.get(`${method} ${url}`) ?? this.replies.get(`${method} ${url.split('?')[0] ?? ''}`);
    if (!reply) return new Response('', { status: 404, statusText: `no reply to ${method} ${url}` });
    if (reply.pending) return new Promise<Response>(() => undefined);
    const body = reply.body === undefined ? null : JSON.stringify(reply.body);
    return new Response(reply.status === 204 ? null : body, { status: reply.status });
  };

  /** The XMLHttpRequest of the uploads of the client. */
  readonly xhr = (): XMLHttpRequest => new UploadRequest(this) as unknown as XMLHttpRequest;
}

/** A JSON:API error document with the errors of fields: `{title: 'Required'}`. */
export function errors(status: number, fields: Readonly<Record<string, string>> = {}): unknown {
  const items = Object.entries(fields).map(([name, detail]) => ({
    status,
    detail,
    source: { pointer: `/attributes/${name}` },
  }));
  return { errors: items.length ? items : [{ status, detail: `HTTP ${String(status)}` }] };
}

/** A resource object. */
export function resource(
  id: string,
  attributes: Readonly<Record<string, unknown>> = {},
  relationships: Readonly<Record<string, { type: string; id: string } | null>> = {},
  type = 'test.item',
) {
  return {
    id,
    type,
    attributes,
    relationships: Object.fromEntries(
      Object.entries(relationships).map(([name, data]) => [name, { data }]),
    ),
  };
}

/** A list document with the pagination meta and links of Bazis. */
export function listDocument(
  items: readonly unknown[],
  { count = items.length, meta = {}, next = null }: { count?: number; meta?: object; next?: string | null } = {},
) {
  return {
    data: items,
    links: { first: null, last: null, prev: null, next },
    meta: { pagination: { count, limit: 20, offset: 0 }, ...meta },
  };
}

/** A field of a runtime schema: an attribute (its JSON Schema) or a to-one relationship. */
export type SchemaField =
  | { attribute: Readonly<Record<string, unknown>>; required?: boolean }
  | { relation: string; title?: string; required?: boolean; nullable?: boolean };

/**
 * A runtime schema of Bazis for the resource `type` with these fields: of a create or an
 * update (`data` is the resource), or of a list (`data` is an array of it).
 */
export function runtimeSchema(
  fields: Readonly<Record<string, SchemaField>>,
  { list = false, type = 'test.item' }: { list?: boolean; type?: string } = {},
) {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};
  const required: { attributes: string[]; relationships: string[] } = { attributes: [], relationships: [] };
  for (const [name, field] of Object.entries(fields)) {
    if ('attribute' in field) {
      attributes[name] = { title: name, ...field.attribute };
      if (field.required) required.attributes.push(name);
    } else {
      const identifier = { properties: { id: { type: 'string' }, type: { type: 'string', default: field.relation } } };
      relationships[name] = {
        title: field.title ?? name,
        nullable: field.nullable ?? true,
        properties: { data: { anyOf: [identifier, { type: 'null' }] } },
      };
      if (field.required) required.relationships.push(name);
    }
  }
  const item = {
    type: 'object',
    properties: {
      type: { type: 'string', default: type },
      attributes: { type: 'object', properties: attributes, required: required.attributes },
      relationships: { type: 'object', properties: relationships, required: required.relationships },
    },
  };
  return {
    type: 'object',
    properties: { data: list ? { type: 'array', items: { anyOf: [item] } } : item },
  };
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Renders the element inside the providers of the hooks and a router at `route`. */
export function renderWithBazis(
  element: ReactNode,
  backend: Backend,
  { route = '/' }: { route?: string } = {},
): RenderResult & { queryClient: QueryClient } {
  const queryClient = createQueryClient();
  const api = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch, xhr: backend.xhr });
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test">
          {element}
        </BazisProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return Object.assign(result, { queryClient });
}

/**
 * The WebSocket of the page in a test (`vi.stubGlobal('WebSocket', FakeSocket)`): records the
 * sockets created and what they send, and receives what the test sends as the server of
 * bazis-ws.
 */
export class FakeSocket {
  static readonly sockets: FakeSocket[] = [];
  readonly sent: unknown[] = [];
  closed: number | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.sockets.push(this);
  }

  /** The socket created last. */
  static last(): FakeSocket {
    const socket = FakeSocket.sockets.at(-1);
    if (socket === undefined) throw new Error('No socket was created.');
    return socket;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(code?: number): void {
    this.closed = code ?? 1005;
  }

  /** The server accepts the connection. */
  open(): void {
    this.onopen?.(new Event('open'));
  }

  /** The server accepts the connection and the token: it answers the ping sent with it. */
  accept(): void {
    this.open();
    this.receive({ type: 'pong' });
  }

  /** A message of the server. */
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  /** A message published to a channel of the session, as the server sends it (its text). */
  publish(published: unknown): void {
    const data = typeof published === 'string' ? published : JSON.stringify(published);
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'data', data }) }));
  }

  /** The connection is lost. */
  drop(code = 1011): void {
    this.onclose?.(new CloseEvent('close', { code }));
  }
}
