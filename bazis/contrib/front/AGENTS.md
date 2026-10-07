# bazis-front — guide for AI agents

The frontend layer of a product on Bazis: a React + TypeScript + Vite frontend next to the
backend, whose contract is generated from the backend and whose protocol code is copied
from this package. There are no npm packages of Bazis: the TypeScript code of the package
is shipped as package data and copied into the product, which then owns the copy.

**Status: pre-release.** The package ships `manage.py bazis_front init` (a frontend made
from its template, with the protocol client copied into it) and
`manage.py bazis_front contract` (the export of the contract and the TypeScript generated
from it). The React hooks, the components, the update of the copies and the validation of
the specs are planned, not available yet.

## Setup

`pip install bazis-front` (needs bazis 2.5.0 or newer) and add `"bazis.contrib.front"` to
`BS_INSTALLED_APPS`.

## The frontend

```bash
python manage.py bazis_front init            # create frontend/ in the product root and run `npm install`
python manage.py bazis_front init --no-node  # the same without `npm install`
```

`init` creates `frontend/` next to `manage.py`, a React 19 + TypeScript + Vite 7 app with
TanStack Query, React Router 7 and Tailwind 4 set up for shadcn/ui (`components.json`, no
components yet), with a login screen and a home screen that lists the resources of the
contract. It never overwrites an existing `frontend/`. It writes:

- the files of the template (`assets/template`), which the product owns from then on,
  among them `frontend/AGENTS.md`, the guide of the frontend for agents;
- the protocol client in `src/bazis/client/`, each file stamped with
  `// bazis-front <version> asset client` after its license header, and the same pristine
  copy in `.bazis/base/client@<version>/` for the merge of later versions;
- `bazis-front.lock.json`: the version of bazis-front, the hashes of the contract and of
  the generated files (see below), and the version and the file hashes of every copied
  asset (`"template"` has only its version).

Commit `bazis-front.lock.json` and `.bazis/`. The files that `init` copies are listed in
`assets/registry.json` of the package. The frontend compiles once `contract` has generated
`src/bazis/generated/`. It has a login (the token endpoint of bazis-users) only when the
backend has bazis-users; without it every screen is open and requests are anonymous.

## The contract

```bash
python manage.py bazis_front contract            # contract/, and the generated files of frontend/
python manage.py bazis_front contract --check    # write nothing; exit 1 if anything is stale
python manage.py bazis_front contract --out DIR  # the contract in another directory
python manage.py bazis_front contract --no-node  # do not run openapi-typescript
```

- The contract is in `contract/` of the product root: `BASE_DIR`, the directory of
  `manage.py` (Bazis sets it from `DJANGO_SETTINGS_MODULE`; `BS_BASE_DIR` overrides it).
- **The contract is generated, never edited.** Export it again after every change of the
  models, routes, roles, statuses or transits and commit it with the change. The system
  check `front.W001` (run by `bazis_doctor`) reports a contract or generated files that
  differ from the backend; `--check` does the same in CI.
- The permit roles and the statusy transits are read from the database: export from a
  migrated database with the data of the project (roles, statuses, transits) loaded, as in
  the tests. Otherwise the command fails with `front.E002`, and `front.W001` is skipped
  with the info `front.I001`.
- The files are JSON with sorted keys, two spaces and a trailing newline; the same backend
  gives the same bytes, so the files are compared byte for byte.
- When the product has a frontend made by `init` (`frontend/bazis-front.lock.json`),
  `contract` also writes `frontend/src/bazis/generated/`:
  - `contract.ts`, rendered from `contract.json` by Python: `ROUTES` (the path of each
    resource by its JSON:API type, with the type `ResourceType`), `RESOURCES` (the
    resources as in `contract.json`), `ROLES` (the permit roles, `[]` without
    bazis-permit), `TRANSITS` (the statusy models, `{}` without bazis-statusy), all
    `as const`, and `CAPABILITIES` (the section of every capability known to bazis-front,
    `null` when the product does not install the package, typed by the interface
    `Capabilities`, so that the frontend compiles with and without each package);
  - `schema.d.ts`, the types of the API (`paths`), by
    `npx --no-install openapi-typescript ../contract/openapi.json -o src/bazis/generated/schema.d.ts --default-non-nullable=false`
    in `frontend/`. It needs Node and the `npm install` of the frontend; without them, or
    with `--no-node`, it is skipped with a warning and recorded as `"missing"` in the lock
    (an existing one stays recorded while the OpenAPI does not change).

  and records in the lock the hashes of the contract files and of the generated files.
  `--check` compares `contract.ts` byte for byte and checks by the lock that `schema.d.ts`
  was generated from the current OpenAPI and not edited; it never runs Node. The system
  check `front.W001` makes the same comparison, also for the generated files.

`contract/openapi.json` is `app.openapi()`: every operation of a route set has `x-bazis`
(`resource`, `route_set`, `action`, `kind`). `contract/contract.json`:

```json
{
  "format": 1,
  "generated_by": {"bazis": "2.5.0", "bazis-front": "0.1.0", "bazis-permit": "2.4.1"},
  "openapi_hash": "sha256:…",
  "project": {"resources": {
    "tasks.task": {
      "model": "tasks.Task", "route_set": "tasks.routes.TaskRouteSet", "path": "/api/v1/tasks/task/",
      "actions": {"action_list": "collection", "action_retrieve": "item", "action_transit": "other"},
      "fields": {
        "title": {"type": "string", "filter": "title", "order": "title"},
        "dt_created": {"type": "string", "format": "date-time", "filter": "dt_created", "order": "dt_created"},
        "assignee": {"relation": "users.user", "many": false, "filter": "assignee", "order": "assignee"}
      }
    }
  }},
  "capabilities": {
    "users": {"token_url": "/api/openapi-token/", "user_resource": "users.user"},
    "permit": {"roles": [{"slug": "manager", "name": "Manager", "for_anonymous": false,
                          "groups": ["tasks_change"], "permissions": ["tasks.task.item.change.all.draft"]}]},
    "statusy": {"models": {"tasks.task": {
      "initial": "draft",
      "statuses": [{"id": "draft", "name": "Draft"}, {"id": "done", "name": "Done"}],
      "transits": [{"id": "finish", "name": "Finish", "src": "draft", "dst": "done",
                    "payload": {"required": true, "schema": {"type": "object", "properties": {…}}}}]
    }}}
  }
}
```

- `format`: the version of this format; `generated_by`: the versions of the Bazis
  distributions whose apps the project installs; `openapi_hash`: the hash of what clients
  depend on in the OpenAPI (parameters, bodies, responses, security, `x-bazis` of every
  operation, and the components), not of summaries and descriptions.
- `project.resources` is keyed by the JSON:API type. A resource is described by the route
  set that the core uses as the default route of its model; other route sets of the model
  are listed in `other_routes`. `actions` maps the name of each route to its `kind`.
  `fields` are the attributes and relationships of the item response: `type` (and
  `format`) of an attribute, `relation` (the JSON:API type) and `many` of a relationship;
  `filter` and `order` are the labels for `filter` and `sort`, absent when the field cannot
  be filtered or sorted.
- `capabilities` has a section for each installed package whose app is in
  `INSTALLED_APPS`: `users` (the token endpoint, the resource of the user model), `permit`
  (the roles with the slugs of their permission groups and their effective permissions:
  the union of the permissions of the groups, as bazis-permit checks them for the current
  role of a user; a role has no permissions of its own), `statusy` (per statusy model: the
  initial status, the statuses of its transits, the transits with the JSON Schema of the
  payload they require, `null` without one). Names are in `LANGUAGE_CODE`; lists are
  sorted.

## Layers

| Layer | What | In the product |
|---|---|---|
| 0. Contract | the OpenAPI, `contract.json`, `contract.ts` and the TypeScript types of the API | `contract/`, `frontend/src/bazis/generated/`, only generated |
| 1. Protocol | the client (`assets/client`) | `frontend/src/bazis/client/`, copied by `init`, not edited |
| 2. Hooks | React hooks over the client (planned) | `frontend/src/bazis/react/`, copied, not edited |
| 3. Components | visual building blocks on shadcn/ui (planned) | `frontend/src/bazis/ui/`, copied, owned by the product |
| 4. Specs | product, screens and design specs (planned) | `spec/`, validated against the contract |
| App | the template (`assets/template`): providers, session, router, errors, screens | `frontend/`, copied once by `init`, owned by the product |

## Rules

- **Generate the contract, never write it.** `contract/` and
  `frontend/src/bazis/generated/` come from `manage.py bazis_front contract`. Generate
  them again after every change of the backend and fix what the compiler reports; do not
  edit the generated files and do not declare resource types by hand.
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

In a frontend made by `init`, the client is created in `src/app/providers.tsx` and read
with `useApi()`; the token is kept by `src/app/session.ts`.

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
