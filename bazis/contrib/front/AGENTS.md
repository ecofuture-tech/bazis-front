# bazis-front — guide for AI agents

The frontend layer of a product on Bazis: a React + TypeScript + Vite frontend next to the
backend, whose contract is generated from the backend and whose protocol code is copied
from this package. There are no npm packages of Bazis: the TypeScript code of the package
is shipped as package data and copied into the product, which then owns the copy.

**Status: pre-release.** The package ships the protocol client
(`bazis/contrib/front/assets/client/src/`). The command `manage.py bazis_front` that copies
it into a product, exports the contract and validates the specs is planned, not available
yet.

## Setup

`pip install bazis-front` (needs bazis 2.5.0 or newer) and add `"bazis.contrib.front"` to
`BS_INSTALLED_APPS`.

## Layers

| Layer | What | In the product |
|---|---|---|
| 0. Contract | the OpenAPI and the TypeScript types of the API | `contract/`, `frontend/src/bazis/generated/`, only generated |
| 1. Protocol | the client (`assets/client`) | `frontend/src/bazis/client/`, copied, not edited |
| 2. Hooks | React hooks over the client (planned) | `frontend/src/bazis/react/`, copied, not edited |
| 3. Components | visual building blocks on shadcn/ui (planned) | `frontend/src/bazis/ui/`, copied, owned by the product |
| 4. Specs | product, screens and design specs (planned) | `spec/`, validated against the contract |

## Rules

- **Generate the contract, never write it.** The types of the API come from the OpenAPI
  of the backend through openapi-typescript with `--default-non-nullable=false`, into
  `frontend/src/bazis/generated/`. Regenerate them after every change of the backend and fix
  what the compiler reports; do not edit the generated files and do not declare resource
  types by hand.
- **Use the client, do not reimplement it.** Requests, filters, errors, pagination,
  authentication and permission checks go through the client. Do not edit the copied
  client; extend it with a wrapper in the product code, so that a new version replaces the
  copy without conflicts.
- **The backend decides the permissions.** Do not encode roles or permission rules in the
  frontend. Hide or disable controls from what the backend reports: the permission meta
  and the runtime schema `schema_update` of the item.
- **Copy the visual layer, own it.** Components and screens are part of the product and may
  be changed freely.

## The client

```ts
import { createClient, Filter } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

export const api = createClient<paths>({ baseUrl, token: () => session.token });
```

- Address every operation by the path of the route set and the id:
  `api.list(path, …)`, `api.retrieve(path, id, …)`, `api.update(path, id, document)`.
  If a path or an attribute does not compile, the contract is stale or the code is wrong;
  never cast it away.
- Build filters with `Filter.where/and/or/not`; never concatenate the expression or encode
  values yourself. Only the lookups of Bazis work (see `assets/client/README.md`); an
  unknown field or lookup is a 400 `ERR_FILTER` error (silently ignored before bazis 2.5.0).
- Show validation errors from `ApiError.fieldErrors()`; show other errors from
  `ApiError.message`.
- Request the permission meta (`meta: ['for_change', 'for_delete', 'for_create']` on a
  list, `['crud_actions']` on an item) and read it with `can()`; read the editable fields
  of an item from `api.schema(path, 'update', id)`.
- Log in with `api.login()` and keep the token in the application; the client reads it
  through the `token` option on every request.

## Protocol facts that are easy to get wrong

- The list filter is one `filter` expression (`price__gte=10&(state=new|state=draft)`),
  not `filter[name]=value`.
- `include` works on retrieve, create and update; list ignores it.
- Pagination is `page[limit]` and `page[offset]`; sorting is `sort` with `-` for
  descending; meta fields such as `pagination` are returned only when requested with
  `meta`.
- Validation errors are 422 with `errors[].source.pointer` such as `/attributes/name`.
