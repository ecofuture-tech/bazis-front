# Client

The JSON:API protocol of [Bazis](https://github.com/ecofuture-tech/bazis) for TypeScript:
requests, filters, errors, pagination, authentication (bazis-users), permission meta
(bazis-permit) and transits (bazis-statusy). It is generic over the types generated from
the OpenAPI of a project, so paths, request bodies and responses are checked by the
compiler.

ESM only, no dependencies, uses the standard `fetch`. Status: pre-release.

The client is not an npm package: its `src/*.ts` files are copied into a product, to
`frontend/src/bazis/client/`, and imported as `@/bazis/client` (a `paths` alias of the
product's `tsconfig.json`). Do not edit the copy; wrap it in the product code instead, so
that new versions replace it without conflicts.

## Generate the types of a project

The types are generated from the OpenAPI of the backend, never written by hand:
`manage.py bazis_front contract` writes `frontend/src/bazis/generated/schema.d.ts` with
openapi-typescript, which it runs as

```bash
npx --no-install openapi-typescript ../contract/openapi.json -o src/bazis/generated/schema.d.ts --default-non-nullable=false
```

`--default-non-nullable=false` is required: without it the fields with a server default
become required in the bodies of create. Generate the file again after every change of
the backend.

## Usage

```ts
import { ApiError, can, createClient, Filter, nextPage } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

const api = createClient<paths>({
  baseUrl: 'https://api.example.com',
  token: () => localStorage.getItem('token'),
});

const { access_token } = await api.login({ username, password });

const ORDERS = '/api/v1/shop/order/';

const page = await api.list(ORDERS, {
  filter: Filter.and(
    Filter.where('is_paid', true),
    Filter.or(Filter.where('total__gte', 100), Filter.where('customer__name__istartswith', 'A')),
  ),
  search: 'bike',
  sort: ['-dt_created'],
  page: { limit: 20 },
  fields: { 'shop.order': ['number', 'total'] },
  meta: ['pagination', 'for_change'],
});
page.data[0]?.attributes.number; // typed by the OpenAPI of the project
const more = nextPage(page); // { offset: 20, limit: 20 } or null
const editable = can(page.meta, 'change', page.data[0]!.id);

const order = await api.retrieve(ORDERS, id, { include: ['items'], meta: ['crud_actions'] });

try {
  await api.create(ORDERS, {
    data: { type: 'shop.order', attributes: { number: 'A-1' }, relationships: {} },
  });
} catch (error) {
  if (error instanceof ApiError && error.status === 422) {
    error.fieldErrors(); // { number: ['Field required'] }
  }
}
```

Every operation takes the path of a route set and, for an item, its id:

| Method | Request |
|---|---|
| `list(path, {filter, search, sort, page, fields, meta})` | `GET path` |
| `create(path, document, {include, meta})` | `POST path`, `application/vnd.api+json` |
| `retrieve(path, id, {include, fields, meta})` | `GET path{id}/` |
| `update(path, id, document, {include, meta})` | `PATCH path{id}/`, `application/vnd.api+json` |
| `destroy(path, id)` | `DELETE path{id}/` |
| `relationship(path, id, field, 'add' \| 'replace' \| 'remove', data)` | `POST`/`PATCH`/`DELETE path{id}/relationships/{field}`, `{data}` as `application/json` |
| `schema(path, 'list' \| 'create')`, `schema(path, 'retrieve' \| 'update' \| 'transit', id)` | `GET path[{id}/]schema_<kind>/`: the JSON schema of the action for the current user |
| `filterFields(path)` | `GET path route_filter_fields/` |
| `transit(path, id, transit, payload?)` | `POST path{id}/transit/` (bazis-statusy); `null` on 204 |
| `login({username, password}, {path})` | `POST /api/openapi-token/` (bazis-users), a form |
| `upload(path, file, {name, onProgress})` | `POST path`, `multipart/form-data` with `file` (and `name`), with XMLHttpRequest (bazis-uploadable); the created item |
| `auth(path, {store})` | `GET path` (bazis-authing), the store token as the bearer token, without cookies; the state of the store |
| `authLogin(path, store, body)` | `POST path` of a login action, `application/json` in the store, its redirect to the auth endpoint followed; the state of the store |
| `authWait(path, store, {interval})` | `GET path` every `interval` ms (`AUTH_POLL_INTERVAL`, 1.5 s) until the store is signed in, has an error or has expired |
| `background(method, path, {body})` | `method path` with `X-Async-Background: true` (`BACKGROUND_HEADER`, bazis-async-request), a body as `application/vnd.api+json`; `{status: 'queued', taskId}` (202) or `{status: 'done', response}` |
| `backgroundResult(path)` | `GET path?full_response=true` (bazis-async-background); `{status, response}` |

All of them accept `signal` (an `AbortSignal`). `include` exists only on retrieve, create
and update: Bazis ignores it on a list, and the types reject it. A meta field such as
`pagination` or the permission meta is returned only when it is requested with `meta`.

Errors are thrown as `ApiError` with the HTTP `status` and the JSON:API `errors`;
`fieldErrors()` groups the messages by attribute or relationship name from
`source.pointer` (`/attributes/<name>`, `/relationships/<name>`).

**Uploads** (bazis-uploadable). A file is the multipart create of a route set of
`FileUploadRouteSet`: fetch reports no progress of a body, so `upload` sends it with
XMLHttpRequest (`xhr` of the options creates it, for the tests) with the bearer token, and
`onProgress` gets `{loaded, total}` of the body. 2xx resolves to the item (`file`: the URL
of the file in the storage, `name`, `extension`, `size`; its `id` is a number for an integer
primary key); an error status is an `ApiError` (413 `ERR_FILE_TOO_LARGE` beyond
`BAZIS_FILE_UPLOAD_MAX_SIZE`, also a page of a proxy that refuses the body), a network
error a `TypeError`, an abort (`signal`) a `DOMException` `AbortError`. A model references
the file by a to-one relationship set to its id.

**bazis-authing.** `GET` of the auth endpoint without a store token creates a store: a 400
whose error `UNAUTHORIZED` has the store token in `meta.token`. With a store token, a store
that is signed in answers 200 with the user and the session token (`token`, the JWT of
bazis-users with `auth_type`); else the 400 lists the errors of the logins of the store
(status 422: `USERNAME_PASSWORD_ERROR`, `GOOGLE_AUTH_ERROR`), and an expired store is
replaced by a new one (another `meta.token`). A login action with a body (`POST` of the
password service, `{username, password}`) answers 303 to the auth endpoint with the store
token in the query, which fetch follows. `AuthState` is
`{status: 'signed_in', user}` or `{status: 'signed_out', store, errors}`; other errors are
thrown (`ApiError`, 401 for a store that expired before a login). The requests are sent
without cookies: the endpoint sets the store token as a cookie, which would sign the next
user in with the store of the previous one. The store token has no `exp`: bazis-users
treats a request with it as anonymous; only the session token is a bearer token of the API.

**Background requests** (bazis-async-request, bazis-async-background). A request with the
header `X-Async-Background` (its presence is enough) and a bearer token that names a
channel of bazis-ws (a session JWT, or an anonymous token of bazis-ws; else 401 with
`{"detail"}`) is queued in Kafka: 202 `{"data": null, "meta": {"async_request_id": <id>,
"async_background_id": <id>}}`, the same id. Without Kafka the middleware runs it at once
and answers as the endpoint does, so `background` resolves to `{status: 'done', response}`
for any other status (a 2xx; a 4xx is an `ApiError` as usual), and to the task only for a
202 with `meta.async_request_id`. The result path of the contract
(`async_background.result_path`, `{task_id}` replaced) with `full_response=true` answers
`{status, channel_name, response}` with the token of the request (403 with another one, 404
for an unknown task or after `KAFKA_RESPONSE_HOLD_SEC`); `backgroundResult` returns its
`status` (`created`, `pending`, `processing`, `completed`, `failed`) and `response` (null
until the task sets one). Without `full_response` the endpoint answers the response itself
or `{"status": "not ready"}`, which cannot be told apart, so the client always asks for
the full one. The response of a request replayed by bazis-async-request is
`ReplayedResponse` (`{task_id, endpoint, status, headers, response}`): an HTTP error of the
endpoint is a `completed` task with that status.

`can(meta, action, id?)` reads the permission meta of bazis-permit: on a list
`can(meta, 'change' | 'delete', id)` (`for_change`, `for_delete`) and `can(meta, 'add')`
(`for_create`); on an item `can(meta, action)` (`crud_actions`). It is false when the meta
was not requested. The backend checks every request itself: use it only to adapt the
interface.

## The filter grammar

A list takes one `filter` expression, parsed by `bazis.core.utils.query_complex`; Bazis
has no `filter[name]=value` form. `Filter` builds it:

| Expression | Builder |
|---|---|
| `key=value` | `Filter.where('key', value)` |
| `a&b` | `Filter.and(a, b)` |
| `a\|b` | `Filter.or(a, b)` |
| `(…)` | nested groups are parenthesized |
| `~a`, `~(a\|b)` | `Filter.not(a)` |
| `key=v1,v2` | `Filter.where('key', [v1, v2])` |

The key is a field path with an optional lookup, separated by `__`:

| Key | Meaning |
|---|---|
| `name`, `author__name` | equal; through relations (an `EXISTS` subquery) |
| `price__gt`, `__gte`, `__lt`, `__lte` | ranges |
| `price__isnull`, `parent__isnull` | `true` / `false`; on a relation the opposite of `__exists` |
| `name__iexact`, `__istartswith`, `__iregex` | text lookups, applied to every word of the value (`__search` only on string fields) |
| `name__$search` | every word of the value is contained in the field |
| `$search` | every word is contained in one of the text or integer fields of the model |
| `children__exists` | the relation has (`true`) or has no (`false`) objects |
| `tags=a,b` | an array field overlaps the values (`__overlap`, `__contains`, `__contained_by`) |
| `period__overlap=start,end` | range fields, a lookup is required: `contains`, `contained_by`, `overlap`, `fully_lt`, `fully_gt`, `not_lt`, `not_gt`, `adjacent_to` |
| `point__near=lon,lat[,meters]`, `point__in_bbox=…` | geometry |
| `app.model=id1,id2` | objects related to these objects of the model |
| `pk=a\|pk=b` | the objects of these ids: there is no `pk__in`, and `pk=a,b` compares one value (`useRelatedItem` of the hooks) |

An unknown field or a lookup the field does not support (`__in`, `__icontains` on a
plain field) is rejected with a 400 `ERR_FILTER` error that lists the supported lookups
(bazis 2.5.0; older versions silently compared such a field for equality). A text field
(`TextField`) is always searched by words, not compared. The words of a value are
separated by spaces or commas and must all match.

Values: `null` is sent as `null` (no value) and booleans as `true`/`false`.

Encoding: Bazis decodes the `filter` parameter, then the whole expression once more
(`unquote_plus`), then every value once more. `Filter` therefore percent-encodes every
character of a value except `A-Z a-z 0-9 - _ .` twice, and the client encodes the
expression as the query parameter. Limits of the server: it removes quotes (`'`, `"`) and
the surrounding spaces from every value, a value `null` cannot be a string, and an item of
a list cannot contain a comma (`Filter` rejects it).
