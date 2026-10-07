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

// The hooks against a mocked `fetch` of the client: every request is recorded and answered
// by the reply registered for its method and URL.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { BazisProvider } from '../src/index.js';

export const PARENT = '/api/v1/entity/parent_entity/';
export const CHILD = '/api/v1/entity/child_entity/';
export const BASE = 'https://api.test';

export interface Call {
  method: string;
  url: string;
  body: unknown;
}

interface Reply {
  status: number;
  body?: unknown;
}

/** A backend: `on(method, url, body, status)` registers a reply; `calls` are the requests. */
export class Backend {
  readonly calls: Call[] = [];
  private readonly replies = new Map<string, Reply>();
  private readonly pending = new Map<string, Promise<undefined>>();

  on(method: string, url: string, body?: unknown, status = 200): this {
    this.replies.set(`${method} ${BASE}${url}`, { status, body });
    return this;
  }

  /** Holds the replies to this request until the returned function is called. */
  hold(method: string, url: string): () => void {
    let release: (() => void) | undefined;
    this.pending.set(
      `${method} ${BASE}${url}`,
      new Promise<undefined>((resolve) => {
        release = () => {
          resolve(undefined);
        };
      }),
    );
    return () => {
      release?.();
    };
  }

  requests(method?: string): string[] {
    return this.calls
      .filter((call) => method === undefined || call.method === method)
      .map((call) => `${call.method} ${call.url.slice(BASE.length)}`);
  }

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const text = typeof init?.body === 'string' ? init.body : undefined;
    this.calls.push({ method, url, body: text === undefined ? undefined : JSON.parse(text) });
    await this.pending.get(`${method} ${url}`);
    const reply = this.replies.get(`${method} ${url}`);
    if (!reply) return new Response('', { status: 404, statusText: `no reply to ${method} ${url}` });
    const body = reply.body === undefined ? null : JSON.stringify(reply.body);
    return new Response(reply.status === 204 ? null : body, { status: reply.status });
  };
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** The session of the provider: change `value`, then `rerender()`. */
export interface Session {
  value: string;
}

/** Renders a hook inside the providers, with the session `s1`. */
export function render<Result, Props>(
  hook: (props: Props) => Result,
  backend: Backend,
  queryClient = createQueryClient(),
  initialProps?: Props,
): RenderHookResult<Result, Props> & { queryClient: QueryClient; session: Session } {
  const api = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });
  const session: Session = { value: 's1' };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session={session.value}>
          {children}
        </BazisProvider>
      </QueryClientProvider>
    );
  }
  const result = renderHook<Result, Props>(hook, {
    wrapper: Wrapper,
    ...(initialProps === undefined ? {} : { initialProps }),
  });
  return Object.assign(result, { queryClient, session });
}

/** The keys of the queries in the cache. */
export function cachedKeys(queryClient: QueryClient): unknown[] {
  return queryClient.getQueryCache().getAll().map((query) => query.queryKey);
}
