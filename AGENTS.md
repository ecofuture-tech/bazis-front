# bazis-front — guide for AI agents

How to build the frontend of a product on Bazis with the bazis-front packages. The layers
and the reasons behind these rules are in `docs/architecture.md`.

## Rules

- **Generate the contract, never write it.** The types of the backend API come from its
  OpenAPI through openapi-typescript with `--default-non-nullable=false`, into
  `src/bazis/generated/`. Regenerate them after every change of the backend and fix what
  the compiler reports; do not edit the generated files and do not declare resource types
  by hand.
- **Use the protocol packages, do not reimplement them.** Requests, filters, errors,
  pagination, authentication and permission checks go through `@bazis/client`.
- **The backend decides the permissions.** Do not encode roles or permission rules in the
  frontend. Hide or disable controls from what the backend reports: the permission meta
  and the runtime schema `schema_update` of the item.
- **Copy the visual layer, own it.** Components and screens are part of the product and may
  be changed freely; protocol code is updated only through package versions.

## `@bazis/client`

```ts
import { createClient, Filter } from '@bazis/client';
import type { paths } from './bazis/generated/schema';

export const api = createClient<paths>({ baseUrl, token: () => session.token });
```

- Address every operation by the path of the route set and the id:
  `api.list(path, …)`, `api.retrieve(path, id, …)`, `api.update(path, id, document)`.
  If a path or an attribute does not compile, the contract is stale or the code is wrong;
  never cast it away.
- Build filters with `Filter.where/and/or/not`; never concatenate the expression or encode
  values yourself. Only the lookups of Bazis work (see the README of the package): `__in`
  and `__icontains` on a plain field silently compare for equality.
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
