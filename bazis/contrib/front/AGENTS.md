# bazis-front — guide for AI agents

The frontend layer of a product on Bazis: a React + TypeScript + Vite frontend next to the
backend, whose contract is generated from the backend and whose protocol code is copied
from this package. There are no npm packages of Bazis: the TypeScript code of the package
is shipped as package data and copied into the product, which then owns the copy.

**Status: pre-release.** The package ships the protocol client
(`bazis/contrib/front/assets/client/src/`) and `manage.py bazis_front contract`, the
export of the contract. The generation of the TypeScript constants and types from the
contract, the copying of the client into a product and the validation of the specs are
planned, not available yet.

## Setup

`pip install bazis-front` (needs bazis 2.5.0 or newer) and add `"bazis.contrib.front"` to
`BS_INSTALLED_APPS`.

## The contract

```bash
python manage.py bazis_front contract            # write contract/openapi.json and contract/contract.json
python manage.py bazis_front contract --check    # write nothing; exit 1 if they are stale
python manage.py bazis_front contract --out DIR  # another directory
```

- The contract is in `contract/` of the product root: `BASE_DIR`, the directory of
  `manage.py` (Bazis sets it from `DJANGO_SETTINGS_MODULE`; `BS_BASE_DIR` overrides it).
- **The contract is generated, never edited.** Export it again after every change of the
  models, routes, roles, statuses or transits and commit it with the change. The system
  check `front.W001` (run by `bazis_doctor`) reports a contract that differs from the
  backend; `--check` does the same in CI.
- The permit roles and the statusy transits are read from the database: export from a
  migrated database with the data of the project (roles, statuses, transits) loaded, as in
  the tests. Otherwise the command fails with `front.E002`, and `front.W001` is skipped
  with the info `front.I001`.
- The files are JSON with sorted keys, two spaces and a trailing newline; the same backend
  gives the same bytes, so the files are compared byte for byte.

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
    "permit": {"roles": [{"slug": "manager", "name": "Manager", "for_anonymous": false, "groups": ["tasks_change"]}]},
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
  (the roles with the slugs of their permission groups), `statusy` (per statusy model: the
  initial status, the statuses of its transits, the transits with the JSON Schema of the
  payload they require, `null` without one). Names are in `LANGUAGE_CODE`; lists are
  sorted.

## Layers

| Layer | What | In the product |
|---|---|---|
| 0. Contract | the OpenAPI, `contract.json` and (planned) the TypeScript types of the API | `contract/`, `frontend/src/bazis/generated/`, only generated |
| 1. Protocol | the client (`assets/client`) | `frontend/src/bazis/client/`, copied, not edited |
| 2. Hooks | React hooks over the client (planned) | `frontend/src/bazis/react/`, copied, not edited |
| 3. Components | visual building blocks on shadcn/ui (planned) | `frontend/src/bazis/ui/`, copied, owned by the product |
| 4. Specs | product, screens and design specs (planned) | `spec/`, validated against the contract |

## Rules

- **Generate the contract, never write it.** `contract/` comes from
  `manage.py bazis_front contract`. The types of the API come from the OpenAPI of the
  backend through openapi-typescript with `--default-non-nullable=false`, into
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
