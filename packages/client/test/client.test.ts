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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createClient, Filter } from '../src/index.js';
import type { ClientOptions } from '../src/index.js';
import type { paths } from './fixtures/schema.js';

// The route sets of the core sample are not statusy: the transit endpoint is added for the
// tests of `transit`, as bazis-statusy adds it to its route sets.
type StatusyPaths = paths & {
  '/api/v1/entity/parent_entity/{item_id}/transit/': {
    post: {
      requestBody: { content: { 'application/json': { transit: string; payload?: unknown } } };
      responses: { 200: { content: { 'application/vnd.api+json': { data: { id: string } } } } };
    };
  };
};

const BASE = 'https://api.test';
const PARENT = '/api/v1/entity/parent_entity/';
const ACCEPT = 'application/vnd.api+json, application/json';
const JSONAPI = 'application/vnd.api+json';
const JSON_TYPE = 'application/json';

interface Call {
  url: string;
  init: RequestInit;
}

function setup(responses: Response[] = [], options: ClientOptions = {}) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init: init ?? {} });
    return Promise.resolve(responses.shift() ?? new Response(null, { status: 204 }));
  });
  const api = createClient<StatusyPaths>({ baseUrl: BASE, fetch, ...options });
  return { api, calls };
}

const json = (body: unknown, status = 200, contentType = JSONAPI) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });

const DOC = { data: { id: '1', type: 'entity.parent_entity', attributes: { name: 'apple' } } };

describe('list', () => {
  it('sends the whole query in a fixed order', async () => {
    const { api, calls } = setup([json({ data: [], links: {} })]);
    await api.list(PARENT, {
      filter: Filter.and(Filter.where('is_active', true), Filter.where('price__gte', 10)),
      search: 'big apple',
      sort: ['-dt_created', 'name'],
      page: { limit: 20, offset: 40 },
      fields: { 'entity.parent_entity': ['name', 'price'] },
      meta: ['pagination'],
    });
    expect(calls).toEqual([
      {
        url:
          `${BASE}${PARENT}?filter=is_active%3Dtrue%26price__gte%3D10&search=big+apple` +
          '&sort=-dt_created%2Cname&page%5Blimit%5D=20&page%5Boffset%5D=40' +
          '&fields%5Bentity.parent_entity%5D=name%2Cprice&meta=pagination',
        init: { method: 'GET', headers: { Accept: ACCEPT } },
      },
    ]);
  });

  it('encodes the filter expression as a query parameter once more', async () => {
    const { api, calls } = setup([json({ data: [], links: {} })]);
    await api.list(PARENT, {
      filter: Filter.or(
        Filter.where('name', `a&b|(c)~'"%,`),
        Filter.not(Filter.where('state', 'state_one')),
      ),
    });
    expect(calls[0]?.url).toBe(
      `${BASE}${PARENT}?filter=name%3Da%252526b%25257C%252528c%252529%25257E%252527%252522` +
        '%252525%25252C%7C%7Estate%3Dstate_one',
    );
    // what the server parses after it decodes the query parameter and `unquote_plus`
    const expression = decodeURIComponent(
      new URL(calls[0]?.url ?? '').searchParams.get('filter') ?? '',
    );
    expect(expression).toBe(`name=a%26b%7C%28c%29%7E%27%22%25%2C|~state=state_one`);
  });

  it('sends no query without options and returns the document', async () => {
    const body = { data: [DOC.data], links: { next: null } };
    const { api, calls } = setup([json(body)]);
    await expect(api.list(PARENT)).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(`${BASE}${PARENT}`);
  });

  it('passes the abort signal', async () => {
    const { api, calls } = setup([json({ data: [], links: {} })]);
    const { signal } = new AbortController();
    await api.list(PARENT, { signal });
    expect(calls[0]?.init).toEqual({ method: 'GET', headers: { Accept: ACCEPT }, signal });
  });
});

describe('items', () => {
  it('retrieves an item with include, fields and meta', async () => {
    const { api, calls } = setup([json(DOC)]);
    await expect(
      api.retrieve(PARENT, 'a/b c', {
        include: ['child_entities', 'extended_entity'],
        fields: { 'entity.child_entity': ['child_name'] },
        meta: ['crud_actions'],
      }),
    ).resolves.toEqual(DOC);
    expect(calls).toEqual([
      {
        url:
          `${BASE}${PARENT}a%2Fb%20c/?fields%5Bentity.child_entity%5D=child_name` +
          '&include=child_entities%2Cextended_entity&meta=crud_actions',
        init: { method: 'GET', headers: { Accept: ACCEPT } },
      },
    ]);
  });

  it('creates an item from a JSON:API document', async () => {
    const { api, calls } = setup([json(DOC, 201)]);
    const document = {
      data: { type: 'entity.parent_entity', attributes: { name: 'apple' }, relationships: {} },
    };
    await expect(api.create(PARENT, document, { include: ['child_entities'] })).resolves.toEqual(
      DOC,
    );
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}?include=child_entities`,
        init: {
          method: 'POST',
          headers: { Accept: ACCEPT, 'Content-Type': JSONAPI },
          body:
            '{"data":{"type":"entity.parent_entity",' +
            '"attributes":{"name":"apple"},"relationships":{}}}',
        },
      },
    ]);
  });

  it('updates an item from a JSON:API document', async () => {
    const { api, calls } = setup([json(DOC)]);
    const document = {
      data: {
        id: '1',
        type: 'entity.parent_entity',
        attributes: { is_active: false },
        relationships: {},
      },
    };
    await api.update(PARENT, '1', document);
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}1/`,
        init: {
          method: 'PATCH',
          headers: { Accept: ACCEPT, 'Content-Type': JSONAPI },
          body: JSON.stringify(document),
        },
      },
    ]);
  });

  it('destroys an item without a body (204)', async () => {
    const { api, calls } = setup([new Response(null, { status: 204 })]);
    await expect(api.destroy(PARENT, '1')).resolves.toBeUndefined();
    expect(calls).toEqual([
      { url: `${BASE}${PARENT}1/`, init: { method: 'DELETE', headers: { Accept: ACCEPT } } },
    ]);
  });
});

describe('relationship', () => {
  it.each([
    ['add', 'POST'],
    ['replace', 'PATCH'],
    ['remove', 'DELETE'],
  ] as const)('%s sends %s {data} as application/json', async (operation, method) => {
    const { api, calls } = setup([new Response(null, { status: 204 })]);
    const data = [{ type: 'entity.child_entity', id: 'c1' }];
    await expect(
      api.relationship(PARENT, '1', 'child_entities', operation, data),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}1/relationships/child_entities`,
        init: {
          method,
          headers: { Accept: ACCEPT, 'Content-Type': 'application/json' },
          body: '{"data":[{"type":"entity.child_entity","id":"c1"}]}',
        },
      },
    ]);
  });

  it('clears a to-one relationship with null', async () => {
    const { api, calls } = setup();
    await api.relationship(PARENT, '1', 'extended_entity', 'replace', null);
    expect(calls[0]?.init.body).toBe('{"data":null}');
  });
});

describe('runtime metadata', () => {
  it('reads the schemas of the route set and of an item', async () => {
    const { api, calls } = setup([json({}), json({}), json({}), json({})]);
    await api.schema(PARENT, 'list');
    await api.schema(PARENT, 'create', { include: ['child_entities'] });
    await api.schema(PARENT, 'retrieve', '1');
    await api.schema(PARENT, 'update', '1', { include: ['child_entities'] });
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}${PARENT}schema_list/`,
      `${BASE}${PARENT}schema_create/?include=child_entities`,
      `${BASE}${PARENT}1/schema_retrieve/`,
      `${BASE}${PARENT}1/schema_update/?include=child_entities`,
    ]);
  });

  it('reads the filter fields', async () => {
    const body = { fields: [{ name: 'name', type: 'string' }] };
    const { api, calls } = setup([json(body, 200, JSON_TYPE)]);
    await expect(api.filterFields(PARENT)).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(`${BASE}${PARENT}route_filter_fields/`);
  });
});

describe('transit', () => {
  it('posts the transit and its payload as application/json', async () => {
    const { api, calls } = setup([json(DOC)]);
    await expect(api.transit(PARENT, '1', 'to_done', { dt_closed: '2026-10-06' })).resolves.toEqual(
      DOC,
    );
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}1/transit/`,
        init: {
          method: 'POST',
          headers: { Accept: ACCEPT, 'Content-Type': 'application/json' },
          body: '{"transit":"to_done","payload":{"dt_closed":"2026-10-06"}}',
        },
      },
    ]);
  });

  it('omits an absent payload and resolves to null on 204', async () => {
    const { api, calls } = setup([new Response(null, { status: 204 })]);
    await expect(api.transit(PARENT, '1', 'to_done')).resolves.toBeNull();
    expect(calls[0]?.init.body).toBe('{"transit":"to_done"}');
  });
});

describe('authentication', () => {
  it.each([
    ['a string', 'secret'],
    ['a function', () => 'secret'],
    ['an async function', () => Promise.resolve('secret')],
  ])('sends the token from %s as a bearer token', async (_, token) => {
    const { api, calls } = setup([json(DOC)], { token });
    await api.retrieve(PARENT, '1');
    expect(calls[0]?.init.headers).toEqual({ Accept: ACCEPT, Authorization: 'Bearer secret' });
  });

  it('sends no Authorization without a token', async () => {
    const { api, calls } = setup([json(DOC)], { token: () => null });
    await api.retrieve(PARENT, '1');
    expect(calls[0]?.init.headers).toEqual({ Accept: ACCEPT });
  });

  it('logs in with the password form of bazis-users', async () => {
    const token = { access_token: 'jwt', token_type: 'bearer' };
    const { api, calls } = setup([json(token, 200, JSON_TYPE)], { token: 'stale' });
    await expect(api.login({ username: 'ann lee', password: 'p&ss=+' })).resolves.toEqual(token);
    expect(calls).toEqual([
      {
        url: `${BASE}/api/openapi-token/`,
        init: {
          method: 'POST',
          headers: { Accept: ACCEPT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'username=ann+lee&password=p%26ss%3D%2B',
        },
      },
    ]);
  });

  it('logs in at a configured token path', async () => {
    const { api, calls } = setup([json({ access_token: 'jwt', token_type: 'bearer' })], {
      baseUrl: `${BASE}/`,
    });
    await api.login({ username: 'ann', password: 'p' }, { path: '/auth/token/' });
    expect(calls[0]?.url).toBe(`${BASE}/auth/token/`);
  });

  it('rejects invalid credentials with an ApiError', async () => {
    const { api } = setup([
      json({ errors: [{ status: 401, detail: 'Credentials are invalid' }] }, 401, JSON_TYPE),
    ]);
    const error = await api.login({ username: 'ann', password: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Credentials are invalid' });
  });
});

describe('errors', () => {
  it('maps 422 validation errors to fields by their pointer', async () => {
    const error422 = (detail: string, pointer?: string, title?: string) => ({
      status: 422,
      code: 'ERR_VALIDATE',
      detail,
      ...(title ? { title } : {}),
      ...(pointer ? { source: { pointer } } : {}),
    });
    const errors = [
      error422('Field required', '/attributes/name', 'missing'),
      error422('Input should be a valid decimal', '/attributes/price', 'decimal_parsing'),
      error422('Too long', '/attributes/name/0', 'too_long'),
      error422('Not allowed', '/relationships/parent_entity'),
      error422('Bad id', '/id'),
      error422('Whole item'),
    ];
    const { api } = setup([json({ errors }, 422, JSON_TYPE)]);
    const error = await api.create(PARENT, {
      data: { type: 'entity.parent_entity', attributes: { name: '' }, relationships: {} },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.errors).toEqual(errors);
    expect(apiError.fieldErrors()).toEqual({
      name: ['Field required', 'Too long'],
      price: ['Input should be a valid decimal'],
      parent_entity: ['Not allowed'],
    });
    expect(apiError.message).toBe(
      'Field required; Input should be a valid decimal; Too long; Not allowed; Bad id; Whole item',
    );
  });

  it('keeps 400 errors of the query out of the field errors', async () => {
    const body = {
      errors: [
        {
          status: 400,
          title: 'Invalid filter',
          code: 'ERR_FILTER',
          detail: 'Field not found',
          source: { pointer: '/query/filter' },
        },
      ],
    };
    const { api } = setup([json(body, 400, JSON_TYPE)]);
    const error = (await api.list(PARENT).catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 400, errors: body.errors, message: 'Field not found' });
    expect(error.fieldErrors()).toEqual({});
  });

  it('builds an error from a response that is not JSON', async () => {
    const { api } = setup([
      new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    ]);
    const error = (await api.retrieve(PARENT, '1').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 502,
      errors: [{ status: 502, title: 'Bad Gateway' }],
      message: 'Bad Gateway',
    });
  });

  it('builds an error from an empty response', async () => {
    const { api } = setup([new Response(null, { status: 404 })]);
    const error = (await api.retrieve(PARENT, '1').catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({
      status: 404,
      errors: [{ status: 404, title: null }],
      message: 'HTTP 404',
    });
  });
});

describe('fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the global fetch at call time by default', async () => {
    const fetch = vi.fn(() => Promise.resolve(json(DOC)));
    vi.stubGlobal('fetch', fetch);
    const api = createClient<paths>();
    await api.retrieve(PARENT, '1');
    expect(fetch).toHaveBeenCalledWith(`${PARENT}1/`, {
      method: 'GET',
      headers: { Accept: ACCEPT },
    });
  });
});
