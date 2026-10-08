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

import { ApiError, errorFromResponse } from './errors.js';
import type { Filter } from './filter.js';
import type {
  AuthState,
  AuthUser,
  BackgroundMethod,
  BackgroundResult,
  BackgroundStart,
  BodyOf,
  EndpointOf,
  IncludeOption,
  ItemOptions,
  ListOptions,
  RequestOptions,
  ResourceIdentifier,
  ResponseOf,
  RouteSetWith,
  TokenResponse,
  UploadOptions,
} from './types.js';

const JSONAPI = 'application/vnd.api+json';
const JSON_TYPE = 'application/json';
const FORM = 'application/x-www-form-urlencoded';
const ACCEPT = `${JSONAPI}, ${JSON_TYPE}`;

/** The default path of the token endpoint of bazis-users (`BAZIS_OPENAPI_TOKEN_URL`). */
export const TOKEN_PATH = '/api/openapi-token/';

type MaybePromise<T> = T | Promise<T>;

export interface ClientOptions {
  /** Prepended to every path, e.g. `https://api.example.com`; empty for the same origin. */
  baseUrl?: string;
  /** The bearer token, or a function that returns the current one. */
  token?: string | (() => MaybePromise<string | null | undefined>);
  /** The fetch implementation; the global `fetch` by default. */
  fetch?: typeof fetch;
  /** Creates the XMLHttpRequest of an upload (fetch reports no progress of a body); `new XMLHttpRequest()` by default. */
  xhr?: () => XMLHttpRequest;
}

/** The header that asks bazis-async-request to run a request in the background (`async_request` of the contract). */
export const BACKGROUND_HEADER = 'X-Async-Background';

/** How often `authWait` asks the auth endpoint of bazis-authing, in milliseconds. */
export const AUTH_POLL_INTERVAL = 1500;

type Item = '{item_id}/';
type Relationship = '{item_id}/relationships/{related_field_name}';
/** The suffix of the endpoint of each runtime schema, after the path of the route set. */
export type SchemaSuffix = {
  list: 'schema_list/';
  create: 'schema_create/';
  retrieve: '{item_id}/schema_retrieve/';
  update: '{item_id}/schema_update/';
  transit: '{item_id}/schema_transit/';
};
/** Runtime schemas of a route set; `transit` exists on bazis-statusy route sets. */
export type CollectionSchemaKind = 'list' | 'create';
export type ItemSchemaKind = 'retrieve' | 'update' | 'transit';
export type RelationshipOperation = 'add' | 'replace' | 'remove';

/**
 * A client of a Bazis API typed by the `paths` generated from its OpenAPI. Every operation
 * takes the path of a route set (`/api/v1/app/model/`) and, for an item, its id.
 */
export interface BazisClient<Paths> {
  list<P extends RouteSetWith<Paths, '', 'get'>>(
    path: P,
    options?: ListOptions<EndpointOf<Paths, P, '', 'get'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, '', 'get'>>>;

  create<P extends RouteSetWith<Paths, '', 'post'>>(
    path: P,
    document: BodyOf<EndpointOf<Paths, P, '', 'post'>>,
    options?: ItemOptions<EndpointOf<Paths, P, '', 'post'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, '', 'post'>>>;

  retrieve<P extends RouteSetWith<Paths, Item, 'get'>>(
    path: P,
    id: string,
    options?: ItemOptions<EndpointOf<Paths, P, Item, 'get'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, Item, 'get'>>>;

  update<P extends RouteSetWith<Paths, Item, 'patch'>>(
    path: P,
    id: string,
    document: BodyOf<EndpointOf<Paths, P, Item, 'patch'>>,
    options?: ItemOptions<EndpointOf<Paths, P, Item, 'patch'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, Item, 'patch'>>>;

  destroy(
    path: RouteSetWith<Paths, Item, 'delete'>,
    id: string,
    options?: RequestOptions,
  ): Promise<void>;

  /**
   * Changes a relationship of an item: `add` (POST) adds to a to-many relationship,
   * `replace` (PATCH) sets it, `remove` (DELETE) removes from it.
   */
  relationship(
    path: RouteSetWith<Paths, Relationship, 'post'>,
    id: string,
    field: string,
    operation: RelationshipOperation,
    data: ResourceIdentifier | readonly ResourceIdentifier[] | null,
    options?: RequestOptions,
  ): Promise<void>;

  /** The JSON schema of an action for the current user (`schema_list/`, `schema_create/`). */
  schema<K extends CollectionSchemaKind, P extends RouteSetWith<Paths, SchemaSuffix[K], 'get'>>(
    path: P,
    kind: K,
    options?: RequestOptions & IncludeOption<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>>;

  /** The JSON schema of an action on an item for the current user (`schema_update/`...). */
  schema<K extends ItemSchemaKind, P extends RouteSetWith<Paths, SchemaSuffix[K], 'get'>>(
    path: P,
    kind: K,
    id: string,
    options?: RequestOptions & IncludeOption<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>,
  ): Promise<ResponseOf<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>>;

  /** The fields a list can be filtered by (`route_filter_fields/`). */
  filterFields<P extends RouteSetWith<Paths, 'route_filter_fields/', 'get'>>(
    path: P,
    options?: RequestOptions,
  ): Promise<ResponseOf<EndpointOf<Paths, P, 'route_filter_fields/', 'get'>>>;

  /**
   * Runs a transit of bazis-statusy (`POST {item_id}/transit/`). Resolves to the item, or
   * to `null` when the user can no longer view it (204).
   */
  transit<P extends RouteSetWith<Paths, '{item_id}/transit/', 'post'>>(
    path: P,
    id: string,
    transit: string,
    payload?: unknown,
    options?: RequestOptions,
  ): Promise<ResponseOf<EndpointOf<Paths, P, '{item_id}/transit/', 'post'>> | null>;

  /**
   * Gets a token from the token endpoint of bazis-users (an OAuth2 password form). The
   * client does not keep it: return it from the `token` option.
   */
  login(
    credentials: { username: string; password: string },
    options?: RequestOptions & { path?: string },
  ): Promise<TokenResponse>;

  /**
   * Uploads a file to a route set of bazis-uploadable (`FileUploadRouteSet` or a subclass):
   * a `POST` of multipart form data with `file` (and `name`), sent with XMLHttpRequest, whose
   * progress `onProgress` reports. Resolves to the created item (its `id` may be a number);
   * a file larger than `BAZIS_FILE_UPLOAD_MAX_SIZE` is a 413 `ERR_FILE_TOO_LARGE`.
   */
  upload<P extends RouteSetWith<Paths, '', 'post'>>(
    path: P,
    file: Blob,
    options?: UploadOptions,
  ): Promise<ResponseOf<EndpointOf<Paths, P, '', 'post'>>>;

  /**
   * bazis-authing: the state of an authorization store, `GET` of its auth endpoint with the
   * store token of `store` (a new store without one). Without cookies: the cookie that the
   * endpoint sets would sign in the next user with the store of the previous one.
   */
  auth(path: string, options?: RequestOptions & { store?: string }): Promise<AuthState>;

  /**
   * bazis-authing: a login action with a body in a store (`POST` of the password service,
   * `{username, password}`); resolves to the state of the store, which its redirect to the
   * auth endpoint answers.
   */
  authLogin(path: string, store: string, body: unknown, options?: RequestOptions): Promise<AuthState>;

  /**
   * bazis-authing: waits for a login in a page of a service (Google) in the store: asks the
   * auth endpoint every `interval` ms until the store is signed in, has an error of a login,
   * or has expired (the endpoint answers with another store). Rejects when aborted.
   */
  authWait(
    path: string,
    store: string,
    options?: RequestOptions & { interval?: number },
  ): Promise<AuthState>;

  /**
   * bazis-async-request: sends a request of the API with `X-Async-Background` (a body as
   * `application/vnd.api+json`). Resolves to its task when it is queued (202), or to its
   * response when the backend ran it at once (without Kafka); an error status is an
   * `ApiError` (401 without a token that names a channel of bazis-ws).
   */
  background(
    method: BackgroundMethod,
    path: string,
    options?: RequestOptions & { body?: unknown },
  ): Promise<BackgroundStart>;

  /**
   * bazis-async-background: the state of a task, `GET` of its result path (`result_path` of
   * the contract with its id) with `full_response=true`, with the token of the request that
   * queued it (403 with another one, 404 for an unknown or expired task).
   */
  backgroundResult(path: string, options?: RequestOptions): Promise<BackgroundResult>;
}

interface Query {
  filter?: Filter;
  search?: string;
  sort?: readonly string[];
  page?: { limit?: number; offset?: number };
  fields?: Readonly<Record<string, readonly string[] | undefined>>;
  include?: readonly string[];
  meta?: readonly string[];
}

interface Send {
  body?: string;
  contentType?: string;
  query?: Query;
  signal?: AbortSignal | undefined;
  anonymous?: boolean;
  headers?: Record<string, string>;
}

function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  if (query.filter) params.set('filter', query.filter.toString());
  if (query.search !== undefined) params.set('search', query.search);
  if (query.sort?.length) params.set('sort', query.sort.join(','));
  if (query.page?.limit !== undefined) params.set('page[limit]', String(query.page.limit));
  if (query.page?.offset !== undefined) params.set('page[offset]', String(query.page.offset));
  for (const [type, names] of Object.entries(query.fields ?? {})) {
    if (names) params.set(`fields[${type}]`, names.join(','));
  }
  if (query.include?.length) params.set('include', query.include.join(','));
  if (query.meta?.length) params.set('meta', query.meta.join(','));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Creates a client of a Bazis API: `createClient<paths>({ baseUrl, token })`. */
export function createClient<Paths>(options: ClientOptions = {}): BazisClient<Paths> {
  const baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
  const fetcher: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function authorization(): Promise<string | null | undefined> {
    const { token } = options;
    return typeof token === 'function' ? token() : token;
  }

  function abortError(signal: AbortSignal): Error {
    const reason: unknown = signal.reason;
    return reason instanceof Error ? reason : new DOMException('The request was aborted.', 'AbortError');
  }

  async function upload(
    path: string,
    file: Blob,
    { name, onProgress, signal }: UploadOptions = {},
  ): Promise<unknown> {
    const token = await authorization();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError(signal));
        return;
      }
      const xhr = options.xhr?.() ?? new XMLHttpRequest();
      const abort = () => {
        xhr.abort();
      };
      xhr.open('POST', `${baseUrl}${path}`);
      xhr.setRequestHeader('Accept', ACCEPT);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        onProgress?.({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size });
      };
      xhr.onload = () => {
        signal?.removeEventListener('abort', abort);
        const text = xhr.responseText;
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(errorFromResponse(xhr.status, xhr.statusText, text));
          return;
        }
        try {
          resolve(text ? (JSON.parse(text) as unknown) : undefined);
        } catch {
          // a page of a proxy instead of the item: the upload cannot be read
          reject(new ApiError(xhr.status, [{ status: xhr.status, title: 'The response of the upload is not JSON.' }]));
        }
      };
      xhr.onerror = () => {
        signal?.removeEventListener('abort', abort);
        reject(new TypeError('The upload failed: the backend cannot be reached.'));
      };
      xhr.onabort = () => {
        reject(signal ? abortError(signal) : new DOMException('The upload was aborted.', 'AbortError'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      const body = new FormData();
      body.append('file', file);
      if (name !== undefined) body.append('name', name);
      // the browser sets the type with the boundary of the multipart body
      xhr.send(body);
    });
  }

  /**
   * A request of bazis-authing: with the store token as the bearer token and without
   * cookies; 200 is the signed-in user, a 400 with the error `UNAUTHORIZED` the store
   * (`meta.token`) and the errors of its logins (status 422).
   */
  async function authorize(
    method: string,
    path: string,
    { store, body, signal }: { store?: string | undefined; body?: unknown; signal?: AbortSignal | undefined },
  ): Promise<AuthState> {
    const headers: Record<string, string> = { Accept: ACCEPT };
    if (store) headers.Authorization = `Bearer ${store}`;
    if (body !== undefined) headers['Content-Type'] = JSON_TYPE;
    const response = await fetcher(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'omit',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    const text = await response.text();
    if (response.ok) return { status: 'signed_in', user: JSON.parse(text) as AuthUser };
    const error = errorFromResponse(response.status, response.statusText, text);
    const token = error.errors.find((it) => it.code === 'UNAUTHORIZED')?.meta?.token;
    if (response.status !== 400 || typeof token !== 'string') throw error;
    return { status: 'signed_out', store: token, errors: error.errors.filter((it) => Number(it.status) === 422) };
  }

  async function authWait(
    path: string,
    store: string,
    { signal, interval = AUTH_POLL_INTERVAL }: RequestOptions & { interval?: number } = {},
  ): Promise<AuthState> {
    for (;;) {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(abortError(signal));
          return;
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', stop);
          resolve();
        }, interval);
        function stop() {
          clearTimeout(timer);
          reject(abortError(signal as AbortSignal));
        }
        signal?.addEventListener('abort', stop, { once: true });
      });
      const state = await authorize('GET', path, { store, signal });
      if (state.status === 'signed_in' || state.errors.length || state.store !== store) return state;
    }
  }

  /** A request: the status and the body of a successful response (undefined for 204). */
  async function request(method: string, path: string, init: Send = {}): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = { Accept: ACCEPT, ...init.headers };
    if (!init.anonymous) {
      const token = await authorization();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    if (init.contentType) headers['Content-Type'] = init.contentType;

    const response = await fetcher(`${baseUrl}${path}${queryString(init.query)}`, {
      method,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
      ...(init.signal ? { signal: init.signal } : {}),
    });
    if (response.status === 204) return { status: 204, body: undefined };
    const text = await response.text();
    if (!response.ok) throw errorFromResponse(response.status, response.statusText, text);
    return { status: response.status, body: text ? (JSON.parse(text) as unknown) : undefined };
  }

  async function send(method: string, path: string, init: Send = {}): Promise<unknown> {
    return (await request(method, path, init)).body;
  }

  /** 202 of bazis-async-request: `{data: null, meta: {async_request_id}}`. */
  function queuedTask(status: number, body: unknown): string | null {
    if (status !== 202 || typeof body !== 'object' || body === null) return null;
    const id = (body as { meta?: { async_request_id?: unknown } | null }).meta?.async_request_id;
    return typeof id === 'string' ? id : null;
  }

  const item = (path: string, id: string): string => `${path}${encodeURIComponent(id)}/`;
  const jsonapi = (document: unknown) => ({ body: JSON.stringify(document), contentType: JSONAPI });
  const json = (body: unknown) => ({ body: JSON.stringify(body), contentType: JSON_TYPE });
  const methods: Record<RelationshipOperation, string> = {
    add: 'POST',
    replace: 'PATCH',
    remove: 'DELETE',
  };

  // The typed signatures are in BazisClient; at run time the paths are plain strings.
  const client = {
    list: (path: string, { signal, ...query }: Query & RequestOptions = {}) =>
      send('GET', path, { query, signal }),

    create: (path: string, document: unknown, { signal, ...query }: Query & RequestOptions = {}) =>
      send('POST', path, { ...jsonapi(document), query, signal }),

    retrieve: (path: string, id: string, { signal, ...query }: Query & RequestOptions = {}) =>
      send('GET', item(path, id), { query, signal }),

    update: (
      path: string,
      id: string,
      document: unknown,
      { signal, ...query }: Query & RequestOptions = {},
    ) => send('PATCH', item(path, id), { ...jsonapi(document), query, signal }),

    destroy: async (path: string, id: string, { signal }: RequestOptions = {}) => {
      await send('DELETE', item(path, id), { signal });
    },

    relationship: async (
      path: string,
      id: string,
      field: string,
      operation: RelationshipOperation,
      data: unknown,
      { signal }: RequestOptions = {},
    ) => {
      const url = `${item(path, id)}relationships/${encodeURIComponent(field)}`;
      await send(methods[operation], url, { ...json({ data }), signal });
    },

    schema: (
      path: string,
      kind: CollectionSchemaKind | ItemSchemaKind,
      idOrOptions?: string | (Query & RequestOptions),
      itemOptions?: Query & RequestOptions,
    ) => {
      const byItem = typeof idOrOptions === 'string';
      const { signal, ...query } = (byItem ? itemOptions : idOrOptions) ?? {};
      const base = byItem ? item(path, idOrOptions) : path;
      return send('GET', `${base}schema_${kind}/`, { query, signal });
    },

    filterFields: (path: string, { signal }: RequestOptions = {}) =>
      send('GET', `${path}route_filter_fields/`, { signal }),

    transit: async (
      path: string,
      id: string,
      transit: string,
      payload?: unknown,
      { signal }: RequestOptions = {},
    ) =>
      (await send('POST', `${item(path, id)}transit/`, {
        ...json(payload === undefined ? { transit } : { transit, payload }),
        signal,
      })) ?? null,

    login: async (
      { username, password }: { username: string; password: string },
      { path = TOKEN_PATH, signal }: RequestOptions & { path?: string } = {},
    ) =>
      (await send('POST', path, {
        body: new URLSearchParams({ username, password }).toString(),
        contentType: FORM,
        signal,
        anonymous: true,
      })) as TokenResponse,

    upload,

    auth: (path: string, { store, signal }: RequestOptions & { store?: string } = {}) =>
      authorize('GET', path, { store, signal }),

    authLogin: (path: string, store: string, body: unknown, { signal }: RequestOptions = {}) =>
      authorize('POST', path, { store, body, signal }),

    authWait,

    background: async (
      method: BackgroundMethod,
      path: string,
      { body, signal }: RequestOptions & { body?: unknown } = {},
    ): Promise<BackgroundStart> => {
      const answer = await request(method, path, {
        ...(body === undefined ? {} : jsonapi(body)),
        headers: { [BACKGROUND_HEADER]: 'true' },
        signal,
      });
      const taskId = queuedTask(answer.status, answer.body);
      return taskId === null ? { status: 'done', response: answer.body } : { status: 'queued', taskId };
    },

    backgroundResult: async (path: string, { signal }: RequestOptions = {}): Promise<BackgroundResult> => {
      const { status, response } = (await send('GET', `${path}?full_response=true`, { signal })) as BackgroundResult;
      return { status, response: response ?? null };
    },
  };

  return client as unknown as BazisClient<Paths>;
}
