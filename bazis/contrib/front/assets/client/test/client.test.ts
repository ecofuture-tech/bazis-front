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
import { BASE, recordingFetch } from './support.js';

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

const PARENT = '/api/v1/entity/parent_entity/';
const ACCEPT = 'application/vnd.api+json, application/json';
const JSONAPI = 'application/vnd.api+json';
const JSON_TYPE = 'application/json';

function setup(responses: Response[] = [], options: ClientOptions = {}) {
  const { fetch, calls } = recordingFetch(responses, 204);
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

describe('action', () => {
  it('posts the body of a custom action of the route set as application/json', async () => {
    const { api, calls } = setup([json({ task: 'a1' }, 200, JSON_TYPE)]);
    const loose = api as unknown as { action: (path: string, name: string, body?: unknown) => Promise<unknown> };
    await expect(loose.action(PARENT, 'count', { priority: 'high' })).resolves.toEqual({ task: 'a1' });
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}count/`,
        init: {
          method: 'POST',
          headers: { Accept: ACCEPT, 'Content-Type': 'application/json' },
          body: '{"priority":"high"}',
        },
      },
    ]);
  });

  it('calls an action of an item with another method, without a body for GET', async () => {
    const { api, calls } = setup([json({ total: 3 }, 200, JSON_TYPE), new Response(null, { status: 204 })]);
    const loose = api as unknown as {
      itemAction: (path: string, id: string, name: string, body?: unknown, options?: { method?: string }) => Promise<unknown>;
    };
    await expect(loose.itemAction(PARENT, 'a/1', 'summary', { ignored: true }, { method: 'get' })).resolves.toEqual({
      total: 3,
    });
    await expect(loose.itemAction(PARENT, '1', 'archive', undefined, { method: 'delete' })).resolves.toBeUndefined();
    expect(calls).toEqual([
      { url: `${BASE}${PARENT}a%2F1/summary/`, init: { method: 'GET', headers: { Accept: ACCEPT } } },
      { url: `${BASE}${PARENT}1/archive/`, init: { method: 'DELETE', headers: { Accept: ACCEPT } } },
    ]);
  });

  it('sends the query parameters of an action: a list repeats its name, null and undefined are left out', async () => {
    const { api, calls } = setup([json({ valid: true }, 200, JSON_TYPE), json({ total: 3 }, 200, JSON_TYPE)]);
    type Options = { method?: string; query?: Record<string, unknown> };
    const loose = api as unknown as {
      action: (path: string, name: string, body?: unknown, options?: Options) => Promise<unknown>;
      itemAction: (path: string, id: string, name: string, body?: unknown, options?: Options) => Promise<unknown>;
    };
    await loose.action(PARENT, 'check', undefined, {
      method: 'get',
      query: { code: 'a b&c', limit: 5, strict: false, tags: ['x', 'y'], since: null, until: undefined },
    });
    await loose.itemAction(PARENT, '7', 'summary', { ignored: true }, { method: 'get', query: { currency: 'RUB' } });
    expect(calls).toEqual([
      {
        url: `${BASE}${PARENT}check/?code=a+b%26c&limit=5&strict=false&tags=x&tags=y`,
        init: { method: 'GET', headers: { Accept: ACCEPT } },
      },
      { url: `${BASE}${PARENT}7/summary/?currency=RUB`, init: { method: 'GET', headers: { Accept: ACCEPT } } },
    ]);
    // an object is no query parameter: nothing is sent
    await expect(loose.action(PARENT, 'check', undefined, { method: 'get', query: { code: { a: 1 } } })).rejects.toThrow(
      TypeError,
    );
    expect(calls).toHaveLength(2);
  });

  it('rejects with the errors of the body by its fields', async () => {
    const errors = [
      { status: 422, code: 'ERR_VALIDATE', detail: 'Input should be a valid date', source: { pointer: '/date_to' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'Too many', source: { pointer: '/items/0' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'The period ends before it starts' },
      // the parameters of the request are no fields of the body
      { status: 400, code: 'ERR_FILTER', detail: 'Unknown field', source: { pointer: '/query/filter' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'Missing', source: { pointer: '/header/x-token' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'Missing', source: { pointer: '/cookie/session' } },
      // a field of the body named as a kind of parameter
      { status: 422, code: 'ERR_VALIDATE', detail: 'Too short', source: { pointer: '/query' } },
    ];
    const { api } = setup([json({ errors }, 422, JSON_TYPE)]);
    const loose = api as unknown as { action: (path: string, name: string, body?: unknown) => Promise<unknown> };
    const error = await loose.action(PARENT, 'export', {}).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.bodyErrors()).toEqual({ date_to: ['Input should be a valid date'], items: ['Too many'], query: ['Too short'] });
    expect(apiError.fieldErrors()).toEqual({});
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

  it('sends the language of the interface as Accept-Language, the current one at each request', async () => {
    let language: string | null = 'en';
    const { api, calls } = setup([json(DOC), json(DOC), json(DOC)], { token: 'secret', language: () => language });
    await api.retrieve(PARENT, '1');
    language = 'ru';
    await api.list(PARENT);
    language = null;
    await api.retrieve(PARENT, '1');
    expect(calls.map((it) => it.init.headers)).toEqual([
      { Accept: ACCEPT, 'Accept-Language': 'en', Authorization: 'Bearer secret' },
      { Accept: ACCEPT, 'Accept-Language': 'ru', Authorization: 'Bearer secret' },
      { Accept: ACCEPT, Authorization: 'Bearer secret' },
    ]);
    // a fixed language, also on a login
    const fixed = setup([json({ access_token: 'jwt', token_type: 'bearer' }, 200, JSON_TYPE)], { language: 'ru' });
    await fixed.api.login({ username: 'ann', password: 'p' });
    expect(fixed.calls[0]?.init.headers).toMatchObject({ 'Accept-Language': 'ru' });
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
    // the pointers of the request schemas of bazis 2.11, into the document
    const errors = [
      error422('Field required', '/data/attributes/name', 'missing'),
      error422('Input should be a valid decimal', '/data/attributes/price', 'decimal_parsing'),
      error422('Too long', '/data/attributes/name/0', 'too_long'),
      error422('Not a valid UUID', '/data/relationships/parent_entity/data/0/id', 'value_error'),
      error422('Bad id', '/data/id'),
      // not a pointer into the document: a `JsonApiBazisError` of a product with
      // `loc=('attributes', name)`, and the pointers of the schemas up to bazis 2.10
      error422('Legacy', '/attributes/name'),
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
      parent_entity: ['Not a valid UUID'],
    });
    expect(apiError.formErrors()).toEqual([
      { message: 'Bad id', included: null, field: null },
      { message: 'Legacy', included: null, field: null },
      { message: 'Whole item', included: null, field: null },
    ]);
    expect(apiError.message).toBe(
      'Field required; Input should be a valid decimal; Too long; Not a valid UUID; Bad id; Legacy; Whole item',
    );
  });

  it('gives every error of a relationships endpoint to the form: they point into its body', async () => {
    // bazis 2.11: the value of the relationship (`/data`), a refused identifier of a to-many
    // relationship (`/data/<index>`), an identifier that is no key (`/data/<index>/id`)
    const errors = [
      { status: 403, code: 'ERR_RELATION_ACCESS', detail: 'No access to the related object', source: { pointer: '/data/1' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'Not a valid UUID', source: { pointer: '/data/0/id' } },
      { status: 422, code: 'ERR_VALIDATE', detail: 'Input should be a valid list', source: { pointer: '/data' } },
    ];
    const { api } = setup([json({ errors }, 422, JSON_TYPE)]);
    const error = (await api
      .relationship(PARENT, '1', 'child_entities', 'add', [{ type: 'entity.child_entity', id: 'c1' }])
      .catch((e: unknown) => e)) as ApiError;
    expect(error.fieldErrors()).toEqual({});
    expect(error.formErrors()).toEqual([
      { message: 'No access to the related object', included: null, field: null },
      { message: 'Not a valid UUID', included: null, field: null },
      { message: 'Input should be a valid list', included: null, field: null },
    ]);
  });

  it('maps the errors of the checks of the backend to the fields, the others to the form', async () => {
    // validate_item of the core (`ERR_ITEM_INVALID`): a field of the item, the item as a
    // whole, an included item and its field; a related item the user cannot see
    const invalid = (detail: string, pointer: string) => ({
      status: 422,
      code: 'ERR_ITEM_INVALID',
      title: 'Validation error',
      detail,
      source: { pointer },
    });
    const errors = [
      invalid('The room is taken', '/data/relationships/room'),
      invalid('Too many participants', '/data/attributes/participants'),
      invalid('The booking overlaps another one', '/data'),
      invalid('The start is after the end', '/included/1/attributes/start'),
      invalid('The slot is invalid', '/included/0'),
      { status: 422, code: 'ERR_ITEM_INVALID', detail: 'The relation is invalid', source: { parameter: '/related_field_name' } },
    ];
    const { api } = setup([json({ errors }, 422, JSON_TYPE)]);
    const error = (await api
      .update(PARENT, '1', { data: { type: 'entity.parent_entity', id: '1', attributes: {}, relationships: {} } })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.fieldErrors()).toEqual({
      room: ['The room is taken'],
      participants: ['Too many participants'],
    });
    expect(error.formErrors()).toEqual([
      { message: 'The booking overlaps another one', included: null, field: null },
      { message: 'The start is after the end', included: 1, field: 'start' },
      { message: 'The slot is invalid', included: 0, field: null },
      { message: 'The relation is invalid', included: null, field: null },
    ]);
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
    expect(error.formErrors()).toEqual([{ message: 'Field not found', included: null, field: null }]);
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
