# React hooks

The React hooks of [Bazis](https://github.com/ecofuture-tech/bazis) over the protocol client
(`assets/client`) and TanStack Query 5: lists, items, runtime schemas, mutations, a form
bound to the runtime schema, the transits of bazis-statusy, the uploads of
bazis-uploadable, the socket of bazis-ws, the tasks of bazis-bg and the background requests
of bazis-async-request and bazis-async-background. No UI: the components
(`assets/ui`) and the screens of a product render what the hooks return. Status:
pre-release.

The hooks are not an npm package: `src/` is copied into a product by
`manage.py bazis_front init`, to `frontend/src/bazis/react/`, and imported as
`@/bazis/react`. The hooks of a package are a separate asset that `init` copies only when
the product has its capability (`requires` in `assets/registry.json`): `src/statusy/` is
the asset `react-statusy`, `@/bazis/react/statusy`, `src/uploadable/` the asset
`react-uploadable`, `@/bazis/react/uploadable`, `src/ws/` the asset `react-ws`
(`@/bazis/react/ws`, the capability `ws`), `src/bg/` the asset `react-bg`
(`@/bazis/react/bg`, `bg`), `src/async/` the asset `react-async` (`@/bazis/react/async`,
`async_background`). Do not edit the copies.

They import the client as `@/bazis/client` and the generated types of the product as
`@/bazis/generated/schema` (the `paths` of openapi-typescript), so every path, option and
document is checked by the compiler against the API of the product. Their dependencies are
those of the template: React 19 and `@tanstack/react-query` 5.

## Setup

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';

const api = createClient<paths>({ token: getToken });

<QueryClientProvider client={queryClient}>
  <BazisProvider client={api} session={session}>…</BazisProvider>
</QueryClientProvider>
```

`session` is a string that changes whenever a user logs in or out (the template numbers its
sessions in `src/app/session.ts`); never the token. The template does this in
`src/app/providers.tsx`.

## Hooks

| Hook | Request | Result |
|---|---|---|
| `useList(path, {filter, search, sort, page, fields, meta})` | `GET path` | the list; while another page or filter of the same list loads, the previous one (`isPlaceholderData`) |
| `useItem(path, id, {include, fields, meta})` | `GET path{id}/` | the item |
| `useSchema(path, 'list' \| 'create')`, `useSchema(path, 'retrieve' \| 'update' \| 'transit', id)` | `GET path[{id}/]schema_<kind>/` | the JSON Schema for the current user, not refetched in the session (`staleTime: Infinity`) but after a mutation of the resource |
| `useFilterFields(path)` | `GET path route_filter_fields/` | `{fields: [{name, py_type}]}`, kept for the session |
| `useRelatedItem(path, id)` | `GET path?filter=pk=<id>\|pk=<id>…&page[limit]=<n>`, one for the items of the resource asked for together | the item of the list (to show its label), null when the user may not view it |
| `useCreate(path)` | `POST path` | `mutate(document)` |
| `useUpdate(path)` | `PATCH path{id}/` | `mutate({id, document})` |
| `useDestroy(path)` | `DELETE path{id}/` | `mutate(id)`; the queries of the item are removed |
| `useRelationship(path)` | `POST`/`PATCH`/`DELETE path{id}/relationships/{field}` | `mutate({id, field, operation, data})` |
| `useResourceForm(path, {id?})` | the schema of the create (no id) or of the update of the item, the item, then `POST` or `PATCH` | a form, below |
| `useApi()`, `useSessionKey()` | | the client; the session of the provider |
| `useTransits(path, id)` (statusy) | `GET path{id}/?meta=state_actions` | the transits the user may run now |
| `useTransit(path, id)` (statusy) | `POST path{id}/transit/` | `mutate({transit, payload})`; the item, or null on 204 |
| `useUpload(path)` (uploadable) | `POST path`, multipart, with XMLHttpRequest | `upload(file, {name?})`: the created item, null when aborted; `status`, `progress`, `error`, `abort()`, `reset()` |
| `SocketProvider({path, token})`, `useSocket()` (ws) | the socket of bazis-ws | `{status, error}`: `idle`, `connecting`, `open`, `rejected`, `unavailable` |
| `useChannel(handler)` (ws) | | every message of the channels of the session, parsed |
| `useLiveQueries(routes)` (ws) | refetches | the queries of a resource that a message says changed, of a task of bazis-async-background, and all after a reconnect |
| `useNotifications()` (ws) | | `{items, unread, markRead, clear}` |
| `useBgTask(path, id)` (bg) | `GET path{id}/` every `BG_POLL_INTERVAL` (2 s) until `done` | `BgTask` (`bgTask(document)`): `state`, `phase`, `outcome`, `progress`, `result`, `started`, `finished` |
| `useAsyncRequest()` (async) | `method path` with `X-Async-Background` | `mutate({method, path, body})`: `{status: 'queued', taskId}` or `{status: 'done', response}` |
| `useAsyncTask(resultPath, taskId)` (async) | `GET <result path>?full_response=true` every `ASYNC_POLL_INTERVAL` (2 s) until `completed` or `failed` | `{status, response, done, error}`; `replayedResponse(response)` |

Pagination is read with the functions of the client: `nextPage(list.data)`,
`prevPage(list.data)`, `pagination(list.data)` (with `meta: ['pagination']`).

The fields of a runtime schema are read with `resourceSchema(schema)`: its JSON:API type
and its fields in schema order (as `fields` of `useResourceForm` below), for the schema of a
create, an update or a retrieve (`data` is the resource) and of a list (`data` is an array
whose items are the members of an `anyOf`: the first one is read). With bazis-permit the
first member of a list has every field and each other one the fields of a group of the
field permissions of the user: the schema of a list gives the titles and the types, the
items leave out the fields the user may not see; the schemas of an item (`retrieve`,
`update`) are those of the user for this item.
`objectFields(schema)` reads the properties of the JSON Schema of an object as attributes,
such as the payload of a transit. The types of the paths of the hooks are exported:
`ListPath`, `ItemPath`, `CreatePath`, `UpdatePath` (and `TransitPath` of `statusy`,
`UploadPath` of `uploadable`). `useRelatedItem` compares the ids as strings: the id of an
item of a model with an integer primary key is a number in the documents of the core, a
string in the relationships.

### Query keys and the session

| Query | Key |
|---|---|
| list | `['bazis', path, 'list', options, session]` |
| item | `['bazis', path, 'item', id, options, session]` |
| schema of the route set | `['bazis', path, 'schema', kind, session]` |
| schema of an item | `['bazis', path, 'item', id, 'schema', kind, session]` |
| filter fields | `['bazis', path, 'filter-fields', session]` |
| related item | `['bazis', path, 'item', id, 'related', session]` |
| a task of bazis-async-background | `['bazis', 'async_background', taskId, session]` |

`options` are those given, a filter as its expression.

`useRelatedItem` reads the items of a resource asked for before the next task (the rows of
a page that mount together) with one list request filtered by their primary keys,
`pk=<a>|pk=<b>|…` (`RELATED_BATCH`, 50, ids a request; the core has no `pk__in` lookup and
compares `pk=<a>,<b>` as one value, and Bazis ignores `include` on a list); an id the list
does not return is null. The request is shared, so the signal of one query does not cancel
it. A successful mutation invalidates
`['bazis', path]`: the lists, the items and the schemas of the resource (a change may affect
other items and what the user may change), and is pending until the active ones are
refetched; a destroy and a transit answered with 204 remove `['bazis', path, 'item', id]`
first. `useTransits` is the query of `useItem(path, id, {meta: ['state_actions']})`: both
share it.

Two mechanisms keep the data of one user from the next one, and both are needed:

- The template clears the query cache and the mutation cache (with their variables) when a
  user logs in or out (`clearOnSessionChange` in `src/app/providers.tsx`): nothing of the
  previous user stays in the page, also the queries that are not keyed by the session
  (a query `['me']` of the product) and the inactive ones.
- Every key of the hooks ends with the session: a request of the previous user still
  running when the cache is cleared resolves into a query that no one of the next session
  reads, and a list never keeps a page of another session as its placeholder. A query of
  the product's own over data of the backend ends its key with `useSessionKey()` for the
  same reason.

A logout without a session (a 401 of an anonymous request) is no change of the session: it
neither clears the cache nor changes the keys, so it does not refetch every query.

### `useResourceForm`

The fields come from the runtime schema of the current user: the core leaves out the fields
that permissions disable and marks `readOnly` those the user may see but not change now
(the form never sends them). `fields` are in schema order, each with `name`, `title`,
`required`, `readOnly`, `nullable` and

- an attribute: `kind: 'attribute'`, `type`, `format`, `enum`, `schema` (its JSON Schema);
- a relationship: `kind: 'relation'`, `relation` (the JSON:API type of the related
  resource, as `relation` of the field in the contract), `many`.

`values` start from the defaults of the schema (a create) or from the item (an update): an
attribute's value, the id of the related item of a to-one relationship (null for none);
`undefined` is no value. `setValue(name, value)` changes one; `dirty` are the fields that
differ from the initial values. `submit()` sends one JSON:API document with the dirty
attributes and to-one relationships (never the read-only ones) and resolves to the saved
item: the changes are dropped, so a create form is back at the defaults of the schema and
an update form shows the item as saved. When it fails, it resolves to null and keeps the
changes: `errors` has the messages of a 422 by field (`ApiError.fieldErrors()`),
`submitError` the error. To-many relationships are in `fields` with `many: true` but not in
`values`: change them with `useRelationship` (the relationship endpoint). `status` is
`loading`, `error` (`error`: the 403 or 404 of the schema or of the item) or `ready`;
`reset()` drops the changes and the errors of the last submit, as does another `path` or
`id`.

### `useTransits` (bazis-statusy)

`meta.state_actions` of a retrieve lists the transits the user may run on the item now (its
status and the permissions `…item.transit.<selector>.<status>.<transit>`), each a
`TransitActionSchema`: the endpoint with the JSON Schema of the body `{transit, payload}`
(the id of the transit is the default of `transit`), the errors of its validators
(`restricts`) and hints. A `Transit` is `{id, allowed, restricts, payload, hint, hintTitle,
hintAction, resource, related}`: `allowed` is false when a validator restricts it,
`payload` the JSON Schema of the payload its actions take (with its `$defs`), null when it
takes none (`dict | None`); an entry that is a list is a transit with the transits of
related items (`related`). The names of the transits are in `TRANSITS` of `contract.ts`.
`useSchema(path, 'transit', id)` is what the item must satisfy before a transit
(`schema_transit/`), not the payload.

`useTransit` posts `{transit, payload}`: 200 with the item; 204 when the user can no longer
view it (null: leave its screen); 403 when the transit is not allowed now; 400 when a
required payload is missing; 422 with the errors of the payload and the validators.

### The socket (bazis-ws)

`SocketProvider` opens one WebSocket at `path` (`CAPABILITIES.ws.path`, on the origin of the
page; a `ws://`/`wss://` URL as it is) when it has a `token`, and sends `{"token": <token>}`
as its first message (never in the URL): a session JWT of bazis-users (`exp` and `sub`
required) subscribes to the channel of its user, an anonymous token of bazis-ws (16–128
characters `A-Z a-z 0-9 _ -`) to its own channel; every session also gets the common
channel. The server sends `{"type": "data", "data": "<published JSON as a string>"}`,
which the hooks parse (a text that is not JSON as it is), `{"type": "pong"}` for the ping
that the hooks send every `PING_INTERVAL` (25 s; nothing received since the last one: the
socket is dead and reconnected), and `{"type": "error", "code"}`. `expired_token`,
`invalid_token` and `user_not_found` make it `rejected` (closed, no new attempt until the
token changes). The server accepts the connection before it takes the token: the ping sent
with the token proves the session, and the socket is `open` at its pong (or at the first
message). Another error or a close is retried after `reconnectDelay`, from `RECONNECT_MIN`
(1 s) doubling to `RECONNECT_MAX` (30 s), half of it random; the backoff starts again only
after a connection that stayed `open` `STABLE_AFTER` (10 s), so a server that drops every
session at once is asked less and less often. `UNAVAILABLE_AFTER` (5) handshakes that
failed in a row make it `unavailable` (no socket at the path), with no new attempt until the
path or the token changes. Another token (a login) opens another socket, none (a logout)
closes it. Pub/sub keeps nothing, so `useLiveQueries` refetches every query after a
reconnect that the server took.

The formats that the hooks read (`changedResource`, `notificationOf`,
`backgroundStatusOf`): `{"resource": "<type>", "id"?: "<id>"}` (an item or a resource
changed; on the common channel, which anonymous sessions receive too, the resource
only), `{"action": "notification", "title", "text"?, "resource"?, "id"?}` (a
notification, which also says its item changed) and `{"action": "async_bg", "task_id",
"status"}` of bazis-async-background. `useNotifications` keeps the notifications received
in the session (`NOTIFICATIONS_KEPT`, 50), each with a `key` unique in the page; they are
dropped when the session changes.

### The tasks (bazis-bg) and the background requests (bazis-async-request)

`useBgTask` is the query of `useItem(path, id)` with a `select` (`bgTask`): a message of the
socket about `bg.task` refetches it too. `progress` has a counter (`key: null`) or a
counter by key from `expected` and `performed`, which bazis-bg saves every few seconds and
clears when a phase ends; `outcome` is `interrupted` (`interrupt`), `error` (`error`, the
traceback) or `success` once `done`.

`useAsyncRequest` is a mutation of `api.background`: the backend answers 202 with the id of
the task (Kafka), or runs the request at once without Kafka (`{status: 'done', response}`).
It refetches nothing: the change is done when the task is; refetch what it changed then
(`['bazis', path]`). `useAsyncTask` reads `api.backgroundResult` with the token of the
request (another one is 403; an unknown or expired task 404, and it stops); `response` is
null until the task sets one.

### `useUpload` (bazis-uploadable)

One file at a time (a new upload aborts the one running), with `upload` of the client:
`status` is `idle`, `uploading` (with `progress`, `{loaded, total}` of the body), `success`
(`data`, the created item) or `error` (`error`: the `ApiError` of the backend, 413
`ERR_FILE_TOO_LARGE`, or a network error); `abort()` drops the upload that runs and goes
back to `idle` without an error. A success refetches the queries of the route set. The
item's id (a number for the integer primary key of `FileUpload`) as a string is the value
of the to-one relationship that references the file.

## Checks in this repository

`package.json`, `tsconfig.json`, `vitest.config.ts` and `test/` exist only for the checks of
this repository (`npm run typecheck`, `npm test` from the root) and are not in the wheel.
The tests render the hooks with `@testing-library/react` in jsdom against a mocked `fetch`
of the client and assert the requests, the query keys, the invalidations, the documents of
the form and the transits. The types are those of the fixture of the client (the core
sample) with the endpoints of bazis-statusy added (`test/fixtures/schema.d.ts`), aliased as
`@/bazis/generated/schema` by `tsconfig.json`. `test/fixtures/sample.json` has runtime
schemas (of the list, the create, the retrieve and the update), retrieves with
`state_actions` and a 422 of `tasks.task` of the sample of this repository, the messages of
its socket (a change, a notification, the statuses of a background request), the documents
of a task of bazis-bg and the answers of a background request, as the backend returns them (reduced to what the hooks read and normalized
across the versions of Python and Pydantic; `tests/test_react_fixture.py` of the
repository checks it against the sample and writes it again with
`BAZIS_FRONT_WRITE_FIXTURES=1`); `test/types.typecheck.ts` has the type tests.
