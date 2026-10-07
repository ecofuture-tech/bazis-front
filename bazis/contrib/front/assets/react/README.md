# React hooks

The React hooks of [Bazis](https://github.com/ecofuture-tech/bazis) over the protocol client
(`assets/client`) and TanStack Query 5: lists, items, runtime schemas, mutations, a form
bound to the runtime schema, and the transits of bazis-statusy. No components: the screens
of a product render what the hooks return. Status: pre-release.

The hooks are not an npm package: `src/` is copied into a product by
`manage.py bazis_front init`, to `frontend/src/bazis/react/`, and imported as
`@/bazis/react`. The hooks of a package are a separate asset that `init` copies only when
the product has its capability (`requires` in `assets/registry.json`): `src/statusy/` is
the asset `react-statusy`, `@/bazis/react/statusy`. Do not edit the copies.

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
| `useCreate(path)` | `POST path` | `mutate(document)` |
| `useUpdate(path)` | `PATCH path{id}/` | `mutate({id, document})` |
| `useDestroy(path)` | `DELETE path{id}/` | `mutate(id)`; the queries of the item are removed |
| `useRelationship(path)` | `POST`/`PATCH`/`DELETE path{id}/relationships/{field}` | `mutate({id, field, operation, data})` |
| `useResourceForm(path, {id?})` | the schema of the create (no id) or of the update of the item, the item, then `POST` or `PATCH` | a form, below |
| `useApi()`, `useSessionKey()` | | the client; the session of the provider |
| `useTransits(path, id)` (statusy) | `GET path{id}/?meta=state_actions` | the transits the user may run now |
| `useTransit(path, id)` (statusy) | `POST path{id}/transit/` | `mutate({transit, payload})`; the item, or null on 204 |

Pagination is read with the functions of the client: `nextPage(list.data)`,
`prevPage(list.data)`, `pagination(list.data)` (with `meta: ['pagination']`).

### Query keys and the session

| Query | Key |
|---|---|
| list | `['bazis', path, 'list', options, session]` |
| item | `['bazis', path, 'item', id, options, session]` |
| schema of the route set | `['bazis', path, 'schema', kind, session]` |
| schema of an item | `['bazis', path, 'item', id, 'schema', kind, session]` |
| filter fields | `['bazis', path, 'filter-fields', session]` |

`options` are those given, a filter as its expression. A successful mutation invalidates
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

## Checks in this repository

`package.json`, `tsconfig.json`, `vitest.config.ts` and `test/` exist only for the checks of
this repository (`npm run typecheck`, `npm test` from the root) and are not in the wheel.
The tests render the hooks with `@testing-library/react` in jsdom against a mocked `fetch`
of the client and assert the requests, the query keys, the invalidations, the documents of
the form and the transits. The types are those of the fixture of the client (the core
sample) with the endpoints of bazis-statusy added (`test/fixtures/schema.d.ts`), aliased as
`@/bazis/generated/schema` by `tsconfig.json`. `test/fixtures/sample.json` has runtime
schemas, retrieves with `state_actions` and a 422 of `tasks.task` of the sample of this
repository, as the backend returns them (normalized; `tests/test_react_fixture.py` of the
repository checks it against the sample and writes it again with
`BAZIS_FRONT_WRITE_FIXTURES=1`); `test/types.typecheck.ts` has the type tests.
