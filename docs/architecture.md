# Architecture

A customer runs an agent that generates an independent product: a backend on Bazis and a
frontend on React + TypeScript + Vite. bazis-front supplies the parts of the frontend that
must stay correct across products, the tools that keep the frontend consistent with the
backend, and the rules for the parts that the product owns.

This is a summary; the full design is kept by the maintainer.

## One Python package, no npm packages

bazis-front is the PyPI package `bazis-front` (module `bazis.contrib.front`), released
with the other Bazis packages and versioned by setuptools-scm, one version for everything.

- **Python** does all that needs no Node: contract export, spec validation, copying and
  updating the assets, Django system checks `front.*` (run by `bazis_doctor` and bazis-mcp).
  It is one management command with subcommands, `manage.py bazis_front`
  (`init`, `contract`, `check`, `add`, `update`, `e2e`, `tokens`, `impact`).
- **TypeScript** is shipped as package data in `bazis/contrib/front/assets/` and copied
  into the product, in the way of shadcn/ui: the protocol client, React hooks, components,
  the project template, Playwright helpers. Only third-party dependencies (React,
  TanStack Query, shadcn/ui with Tailwind 4 and Radix, Vite, openapi-typescript,
  Playwright) come from npm, through the product's own `package.json`.
- Node is needed only to generate `schema.d.ts`, build the frontend and run its tests.

The root `package.json` of this repository is private and dev-only: its workspaces are the
assets, for lint, type checks and tests in CI.

## Layers

| Layer | What | In the product | How it changes |
|---|---|---|---|
| 0. Contract | `contract/openapi.json`, `contract/contract.json`, `frontend/src/bazis/generated/` | generated | `bazis_front contract` from the live backend |
| 1. Protocol | the client (`assets/client`) | `frontend/src/bazis/client/` | copied, not edited; `bazis_front update` |
| 2. Hooks | React hooks over the client (`assets/react`) | `frontend/src/bazis/react/` | copied, not edited; `bazis_front update` |
| 3. Components | primitives on shadcn/ui (`assets/ui`) | `frontend/src/bazis/ui/` | copied by `add`, owned and edited by the product |
| 4. Specs | `spec/product.yaml`, `spec/screens/*.yaml`, `spec/design/` | the product root | written by the agent, validated against the layers below by `bazis_front check` |

### 0. Contract

`bazis_front contract` exports the OpenAPI of the backend (with the `x-bazis` extension of
each operation) and `contract.json` into `contract/` of the product root (`BASE_DIR`, the
directory of `manage.py`): the resources with their actions and fields, read from
`x-bazis` and the response schemas of the OpenAPI, and a section per installed capability
package (users, permit roles, statusy transits, …). A section is made by a module
`bazis/contrib/front/capabilities/<name>.py`, imported only when the package is installed
and its app is in `INSTALLED_APPS`. Permit and statusy sections are read from the
database, so the export needs a migrated database (`front.E002` otherwise). The files are
canonical JSON (sorted keys, a trailing newline): the same backend gives the same bytes.
`--check` compares without writing; the same comparison is the system check `front.W001`
"contract is stale", run by `bazis_doctor` when `contract/` or the lock of the frontend
exists. The format of
`contract.json` is documented in `bazis/contrib/front/AGENTS.md`.

When the product has a frontend made by `init`, the command also generates
`frontend/src/bazis/generated/`: typed constants (`contract.ts`: `ROUTES`, `RESOURCES`,
`ROLES`, `TRANSITS`, `as const`, and `CAPABILITIES`, `null` for a package the product does
not install), rendered from `contract.json` by Python,
and, through the openapi-typescript of the frontend with `--default-non-nullable=false`,
`schema.d.ts`. The lock of the frontend records the hashes of the contract they were made
from and their own, so that `--check` and `front.W001` find a stale or edited
`schema.d.ts` without Node; without Node it is `missing` in the lock.

`--default-non-nullable=false` is required: without it the fields with a server default
(`is_active`, `dt_created`) become required in the bodies of create.

The contract is never written by hand: when the backend changes, it is regenerated and the
compiler shows every place of the frontend that must follow.

### 1. Protocol: the client

The protocol of Bazis is more than plain JSON:API, and every product would otherwise
reimplement it:

- one `filter` expression with its own grammar (`&`, `|`, groups, `~`) and encoding,
  instead of `filter[name]=`;
- `include` only on retrieve, create and update, not on list;
- relationship endpoints with `{data}` bodies in `application/json`;
- errors as JSON:API `errors` with `source.pointer`;
- runtime schemas (`schema_list`, `schema_create`, `schema_retrieve`, `schema_update`) and
  `route_filter_fields`;
- the token endpoint of bazis-users, the permission meta of bazis-permit and the transits
  of bazis-statusy.

The client implements these once. It is generic over the generated `paths` type of a
product. Its unit tests and type tests stay in this repository; only `src/` is copied.

### 2. Hooks

React hooks over the client with TanStack Query as the cache (`assets/react`, imported as
`@/bazis/react`): `useList`, `useItem`, `useSchema`, `useFilterFields`, the mutations
`useCreate`, `useUpdate`, `useDestroy`, `useRelationship`, and `useResourceForm`, a form
bound to the runtime schema of the create or the update (its fields are what the current
user may set; it submits the changed attributes and to-one relationships as one JSON:API
document and maps a 422 to the fields). They are typed by the generated `paths` of the
product and contain no UI. The hooks of a package are a separate asset that `init` copies
only when the product has its capability (`requires` in the registry): the transits of
bazis-statusy (`useTransits` from `meta.state_actions`, `useTransit`) in
`@/bazis/react/statusy`; uploadable, ws and async will follow.

Runtime metadata (schemas, filter fields, permission meta, state actions) is never part of
the contract: it is requested at run time and cached by TanStack Query. Every query key is
`['bazis', path, …, session]`: a mutation invalidates `['bazis', path]`, and the session (a
value of the application that changes at every login and logout) keeps the cached data of
one user from another; it is the only such mechanism.

### 3. Components (planned)

Components are primitives on shadcn/ui (`app-shell`,
`resource-list`, `resource-form`, `transit-bar`, …) listed in `assets/registry.json` with
what they require; each ships a contract test that checks its `data-bz` test ids and
states, so that it keeps working after the product edits it.

### 4. Specs

The product is described in `spec/` of the product root, in layers that reference each
other by id (a screen the entities and roles, a scenario the screens and transitions; the
contract knows nothing of them): the product spec (`product.yaml`: roles with their permit
roles, entities with their resource, fields, workflow and access, and scenarios), the
screens (`screens/<id>.yaml`: one primitive, `list`, `card` or `form`, over an entity,
its actions and the states it must render) and the design (`design/theme.yaml`: a preset
and its options; `design/tokens.json`: DTCG tokens). The formats are versioned
(`spec: bazis-product/1`, `bazis-screen/1`, `bazis-design/1`) and described by JSON
Schemas (Draft 2020-12) in `bazis/contrib/front/spec/schemas/`, which `init` copies to
`spec/schema/` for the editors along with starters of the product and the design.

`bazis_front check` (`spec/validate.py`) checks each file against its schema, then the
references between the files (`spec/refs.py`: entities, roles, fields, screens, actions,
transitions; `spec/scenarios.py` follows a scenario from screen to screen) and, when the
product has `contract/contract.json`, against the contract: the resources and their
fields, the statuses and transits of statusy, the permit roles, and `access` compiled to
the permissions of bazis-permit (`spec/access.py`) that the role must have. The design is
checked against the tokens its preset requires (`spec/design.py`). An issue is
`{layer, file, path, code, severity, message, hint}` with a stable code (`C0xx` contract,
`P0xx` product, `S0xx` screens, `D0xx` design; `spec/issues.py`); errors fail the command.
The same validation is the system check `front.W002` when `spec/` exists: a warning, so
that a spec under construction never blocks `migrate` or `contract`. The format and the
codes are documented in `bazis/contrib/front/AGENTS.md`.

The specs are written by the agent; there is no generator of screens or of the
permissions of the roles: the backend is built to satisfy the specs, and the validator
shows what it lacks. Scenarios will be turned into Playwright tests that drive the screens
through `data-bz` (`screen:<id>`, `state:<state>`, `field:<id>`, `action:<id>`,
`transit:<id>`, …); the lock will then record the hashes of the specs from which they are
generated.

## The frontend of a product

`bazis_front init` creates `frontend/` next to `manage.py` from the template
(`assets/template`): React 19, TypeScript strict, Vite 7, React Router 7, TanStack Query 5,
Tailwind 4 set up for shadcn/ui; `src/app/` holds the providers (the query cache and the
client), the session (the token in memory and `localStorage`, the login of bazis-users),
the router and the errors, and `src/screens/` a login and a home screen. The template is
owned by the product from then on. The client is copied into `src/bazis/client/`, the
hooks into `src/bazis/react/` (with those of the installed packages), their pristine
copies into `.bazis/base/`, and the lock is written. The files that the assets copy
are listed in `assets/registry.json`, which the wheel is checked against.

## Updates of the copied code

Every copied file carries the version of bazis-front in its header, and
`frontend/bazis-front.lock.json` records the hashes of the contract, the generated files
and the copied assets. Pristine copies of the assets are kept in `frontend/.bazis/base/` and
committed, so that `bazis_front update` can merge a new version with the local edits
(three-way merge, `merge3`). `bazis_doctor` reports copied assets older than the installed
package, and security advisories of the asset registry as errors.

## Principles

- **The backend is the source of truth.** The contract is generated from it; what the user
  may see and change is decided by it.
- **The frontend is not a security boundary.** Permissions live in the backend
  (bazis-permit). The frontend only adapts to them: the runtime schema `schema_update`
  shows which fields the current user may change, and the permission meta (`crud_actions`,
  `for_change`, `for_delete`, `for_create`) which actions they may take.
- **Protocol updated, look owned.** Protocol code is copied but kept pristine and updated
  from the package; components are copied and changed freely by the product.
- **No hand-written contract.** Types that describe the backend are only generated.

## Status

Pre-release. Available: the client (`assets/client`), the hooks (`assets/react`), the
contract export with the generated TypeScript (`bazis_front contract`, `front.W001`), the
frontend template with the copies of the client and the hooks and the lock
(`bazis_front init`), and the specs with their validator (`bazis_front check`,
`front.W002`). Next: the first components, `add` and `update`, and the end-to-end
pipeline against a sample backend.
