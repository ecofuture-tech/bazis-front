# Frontend — guide for AI agents

The frontend of this product: React 19, TypeScript (strict), Vite 7, React Router 7,
TanStack Query 5, Tailwind 4 with shadcn/ui. It was created by
`manage.py bazis_front init` of bazis-front: its contract with the backend is generated
from the backend, its protocol client and its React hooks are copied from bazis-front. The
backend, its contract and the specs of the product are one directory up (`manage.py`,
`contract/`, `spec/`).

## Layers

| Path | What | Changed by |
|---|---|---|
| `src/bazis/generated/` | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API) | only `manage.py bazis_front contract` |
| `src/bazis/client/` | the client of the Bazis protocol | bazis-front; not edited, wrapped in `src/app/` |
| `src/bazis/react/` | the React hooks over the client and TanStack Query (`@/bazis/react`); `statusy/` (`@/bazis/react/statusy`) when the backend has bazis-statusy | bazis-front; not edited |
| `src/app/` | providers (query cache, `BazisProvider`), session, router, errors | the product |
| `src/screens/<screen>/` | the screens | the product |
| `src/components/ui/`, `src/lib/` | shadcn/ui components (`npx shadcn add <name>`) | the product |
| `../spec/` | the specs: `product.yaml` (roles, entities, access, scenarios), `screens/<id>.yaml`, `design/` | the product; checked by `manage.py bazis_front check` |
| `bazis-front.lock.json`, `.bazis/base/` | the versions and hashes of the contract, of the generated files and of the copied assets; the pristine copies of the assets | bazis-front; commit them |

## Commands

From the product root, after every change of the models, routes, roles, statuses or
transits of the backend (with a migrated database):

```bash
python manage.py bazis_front contract          # contract/, src/bazis/generated/, the lock
python manage.py bazis_front contract --check  # write nothing; exit 1 if anything is stale (CI)
python manage.py bazis_front check             # the specs against the contract; exit 1 on errors
```

From `frontend/`:

```bash
npm install
npm run dev        # the dev server; /api goes to BAZIS_API_URL (http://localhost:8000)
npm run typecheck
npm run lint
npm test
npm run build
```

`schema.d.ts` is generated with the `openapi-typescript` of this `package.json`: run
`npm install` before `bazis_front contract`.

## Specs

`spec/` describes what this frontend must do; the format, the access grammar and the codes
of the issues are in the guide of bazis-front (`bazis/contrib/front/AGENTS.md` of the
installed package, `manage.py bazis_front check --help`). The JSON Schemas are in
`spec/schema/`: an editor with the YAML language server checks the files as they are
written.

- Work top down: `spec/product.yaml` (roles, entities with their fields, workflow and
  access, scenarios), then a file `spec/screens/<id>.yaml` per screen, then the design.
  The backend follows the product spec; export the contract and run
  `bazis_front check` until it reports no errors.
- A screen is one primitive (`list`, `card` or `form`) over an entity; implement it in
  `src/screens/<id>/` with the route of its spec, and render every state that it lists.
- Mark the elements with `data-bz` (`screen:<id>`, `state:<state>`, `list:<entity>`,
  `row:<id>`, `field:<field>`, `error:<field>`, `action:<id>`, `transit:<id>`,
  `status:<id>`, `nav:<screen>`): the scenarios of the product spec act through them.
- `access` is what the backend must grant, checked against the permissions of the roles
  in the contract. It does not decide what the frontend shows: that is the permission
  meta and the runtime schemas (see below).
- Colors, radii and fonts are the CSS variables of `src/index.css`, with the values of
  `spec/design/tokens.json` (`color.primary` is `--primary`, `radius` is `--radius`,
  `font.body` is `--font-body`; the table is in the guide of bazis-front);
  the components use the variables, never literal colors.

## Rules

- **`src/bazis/generated/` is never edited**, and the types of the backend are never
  written by hand. When the backend changes, generate again and fix what the compiler
  reports; never cast an error away.
- **Read and change the data of the backend with the hooks of `@/bazis/react`** (below),
  not with `useQuery` around the client: their query keys carry the session and their
  mutations refetch what they change. The client itself is `useApi()` (login, a request
  the hooks do not cover). Do not edit `src/bazis/client/` or `src/bazis/react/`; put what
  the product needs around them in `src/app/`, so that a new version of bazis-front
  replaces the copies without conflicts.
- Take the paths of the resources from `ROUTES` of `contract.ts`; address an item by the
  path and its id (`useItem(ROUTES['app.model'], id)`).
- **Filter with `Filter`** (`Filter.where/and/or/not`): one `filter` expression, never
  built by hand.
- Show validation errors by field (`form.errors` of `useResourceForm`, or
  `ApiError.fieldErrors()`), other errors with `errorMessage()` (`src/app/errors.tsx`).
- **The backend decides the rights.** Do not encode roles or permissions here: request
  the permission meta (`for_change`, `for_delete`, `for_create` on a list, `crud_actions`
  on an item), read it with `can()`, and take the fields of a form from its runtime schema
  (`useResourceForm`). Hide or disable what the backend does not allow.
- Check for an optional package with `CAPABILITIES.<name> !== null` (`contract.ts`): the
  login exists only with bazis-users (`LOGIN_ENABLED` of `src/app/session.ts`).
- A 401 of any query or mutation ends the session (`src/app/providers.tsx`). Cached data
  belongs to the user who loaded it: logging in or out clears the query and mutation
  caches, and every query key of the hooks ends with the session (`useSession()` of
  `src/app/session.ts`, a number that changes at every login and logout), so that a
  request still running for the previous user never fills a query of the next one. A query
  of your own over data of the backend ends its key with `useSessionKey()` too.
- No translations: the labels come from the backend (its schemas and names are already in
  the language of the product) and from the screens.

## Hooks (`@/bazis/react`)

Typed by `schema.d.ts`: a path that does not compile is not an endpoint of the backend.
Every query key starts with `['bazis', path]`; the mutations refetch the queries of their
resource and stay pending until the active ones are refetched.

```tsx
import { Filter, can, nextPage, pagination } from '@/bazis/client';
import { ROUTES } from '@/bazis/generated/contract';
import { useItem, useList, useResourceForm, useDestroy } from '@/bazis/react';

const TASKS = ROUTES['tasks.task'];

const list = useList(TASKS, {
  filter: Filter.where('status', 'draft'), search, sort: ['-dt_created'],
  page: { limit: 20, offset }, meta: ['pagination', 'for_change', 'for_delete', 'for_create'],
});
// list.data keeps the previous page while the next one loads (list.isPlaceholderData)
const next = list.data && nextPage(list.data);      // { limit, offset } or null
const count = list.data && pagination(list.data)?.count;

const item = useItem(TASKS, id, { include: ['assignee'], meta: ['crud_actions'] });
const editable = can(item.data?.meta, 'change');

const form = useResourceForm(TASKS, { id });        // without `id`: a create
// form.status: loading | error | ready; form.fields: name, title, kind, required,
// readOnly, nullable; attributes: type, format, enum; relations: relation, many
form.setValue('title', 'Report');                   // a to-one relation takes the id or null
const saved = await form.submit();                  // null when it failed: form.errors.title
```

| Hook | What |
|---|---|
| `useList(path, {filter, search, sort, page, fields, meta})` | a page of a list |
| `useItem(path, id, {include, fields, meta})` | an item |
| `useSchema(path, 'list' \| 'create')`, `useSchema(path, 'retrieve' \| 'update' \| 'transit', id)` | the runtime schema for the current user, kept for the session |
| `useFilterFields(path)` | the fields a list can be filtered by, with their types |
| `useCreate(path)`, `useUpdate(path)`, `useDestroy(path)` | `mutate(document)`, `mutate({id, document})`, `mutate(id)` |
| `useRelationship(path)` | `mutate({id, field, operation: 'add' \| 'replace' \| 'remove', data})`: the relationship endpoint, for to-many relationships |
| `useResourceForm(path, {id?})` | a form bound to `schema_create`/`schema_update`: fields, values, dirty, submit of the changed attributes and to-one relationships, `errors` of a 422 by field |
| `useApi()`, `useSessionKey()` | the client; the session, the last item of a query key of your own |

With bazis-statusy, `@/bazis/react/statusy`:

| Hook | What |
|---|---|
| `useTransits(path, id)` | the transits the user may run on the item now (`meta.state_actions`): `id`, `allowed` (no `restricts` of its validators), `restricts`, `payload` (the JSON Schema of the payload it requires, or null), `related`; the names are in `TRANSITS` of `contract.ts` |
| `useTransit(path, id)` | `mutate({transit, payload})`; resolves to the item, or to null when the user can no longer view it (leave its screen) |

A form shows the errors of a 422 by field from `form.errors` and any other error from
`form.submitError`; the fields a user may not change now are `readOnly` in `schema_update`
(show them disabled) and are never sent, those permissions disable are not in it. To-many relationships are in `form.fields` (`many: true`)
but not in its values: change them with `useRelationship`.
