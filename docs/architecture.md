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
  (`init`, `contract`, `check`, `design`, `add`, `update`, `e2e`; `impact` is planned).
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
bound to the runtime schema of the create or the update (its fields are those of the
current user, read-only where they may not change them; it submits the changed attributes and to-one relationships as one JSON:API
document and maps a 422 to the fields). They are typed by the generated `paths` of the
product and contain no UI. The hooks of a package are a separate asset that `init` copies
only when the product has its capability (`requires` in the registry): the transits of
bazis-statusy (`useTransits` from `meta.state_actions`, `useTransit`) in
`@/bazis/react/statusy`; uploadable, ws and async will follow.

Runtime metadata (schemas, filter fields, permission meta, state actions) is never part of
the contract: it is requested at run time and cached by TanStack Query. Every query key is
`['bazis', path, …, session]`: a mutation invalidates `['bazis', path]`. The data of one user
is kept from the next one twice: the template clears the query and mutation caches when the
user changes, and the session in the keys (a value of the application that changes at every
login and logout) keeps a request still running for the previous user out of the queries of
the next one.

### 3. Components

Components are primitives on shadcn/ui and Tailwind 4 over the hooks (`assets/ui`):
`state-panel` (the states of a screen, the only mapping of the errors of the backend:
401/403 `forbidden`, 404 `not_found`, 422 `invalid`), `app-shell` (the layout, the
navigation, the session, `Screen`), `login-form`, `resource-list`, `resource-card`,
`resource-form` and, with bazis-statusy, `status-badge` and `transit-bar`. They are listed
in `assets/registry.json` with what they require (`requires.assets`: other components, the
hooks, the shadcn/ui components; `requires.capabilities`), copied by
`bazis_front add` (and `init` for those the template uses) with their pristine copies and
lock entries, like the hooks; the product owns and changes them. Each ships a contract test
that checks its `data-bz` marks and states, run by `npm test` of the product, so that it
keeps working after the product edits it. The shadcn/ui components they use are copied as
assets too (into `src/components/ui/`), not through the shadcn CLI: `add` needs no network,
and the template declares every npm dependency of the components. The components read
the fields, their titles and what is read-only from the runtime schemas and the actions
from the permission meta; they are small explicit APIs over the field ids of the specs,
and the screens are written by the agent from them: there is no generator of screens.

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
shows what it lacks.

### Design

The design layer keeps generated products from looking like a bare admin panel: the specs
choose a preset (`workspace`, a working application: a sidebar, tables, the card next to the
list, forms in dialogs; `portal`, a public shell: a top bar, larger type, grids of cards,
forms on pages) with its options (navigation, density, composition, the tones of the
statuses), and the tokens of a brand (DTCG, with the values of a dark mode in the group
`dark`). `bazis_front design` (`spec/theme.py`, also run by `init`) compiles them into
`frontend/src/bazis/generated/`: `theme.css`, imported by the `src/index.css` of the
template (the tokens as CSS variables of the light and the dark mode, the spacing of the
density, the Tailwind theme over the variables, the base styles of the preset), and
`theme.ts` (`THEME`, the options the components read for their defaults). Like the
end-to-end tests, the theme depends on the specs only: the lock records the hashes, `--check`
and the system check `front.W005` compare it without Node and the database. The components
use the tokens only (Tailwind classes such as `bg-primary`), so a brand is a change of the
tokens and never of the components; the validator computes the contrast of the text colors
(WCAG AA, `D009`) for the light and the dark mode.

### End-to-end tests

`bazis_front e2e` (`spec/e2e.py`) turns each scenario into a Playwright test,
`frontend/e2e/generated/<scenario>.spec.ts`, with `e2e/generated/product.ts`, the part of
the specs read at run time (the test user of each role, the route of each screen). The
steps are read by the walk of `spec/scenarios.py`, the same that `check` validates: it
returns the screen each step leads to (the `then` of a form or a destroy, the `list.open`
of an item), which the test then expects. The tests call the helpers of the asset
`playwright` (`frontend/e2e/bazis/`, vendored like the hooks), which drive the screens only
through `data-bz` (`screen:<id>`, `state:<state>`, `row:<id>` and its cells
`cell:<column>`, `field:<id>`, `action:<id>`, `transit:<id>`, `status:<id>`, …) and wait on
the states the components render, never for a fixed time; the contract tests of the
components keep those marks. The generated text depends only on the specs: the lock
records the hashes of the specs and of the tests, the tests of a removed scenario are
deleted, and `e2e --check` and the system check `front.W003` compare them byte for byte
without Node. The tests log in as the `test_user` of a role with the password of
`E2E_PASSWORD`; the users and the data they use are created by the backend (a command or a
fixture of the product), never by the tests.

## The frontend of a product

`bazis_front init` creates `frontend/` next to `manage.py` from the template
(`assets/template`): React 19, TypeScript strict, Vite 7, React Router 7, TanStack Query 5,
Tailwind 4 set up for shadcn/ui; `src/app/` holds the providers (the query cache and the
client), the session (the token in memory and `localStorage`, the login of bazis-users),
the router (in the layout `AppShell`) and the errors, and `src/screens/` a login
(`LoginForm`) and a home screen. The template is owned by the product from then on. The
client is copied into `src/bazis/client/`, the hooks into `src/bazis/react/` (with those of
the installed packages), the components of the template into `src/bazis/ui/`, their
pristine copies into `.bazis/base/`, and the lock is written; `bazis_front add` copies the
other components. The files that the assets copy
are listed in `assets/registry.json`, which the wheel is checked against.

## Updates of the copied code

Every copied file carries the version of bazis-front in its header (a stamp line after its
license header), and `frontend/bazis-front.lock.json` records the hashes of the contract,
the generated files and the copied assets. Pristine copies of the assets are kept in
`frontend/.bazis/base/<asset>@<version>/` and committed: after `pip install -U
bazis-front` the old version is no longer installed, and the merge needs it.

`bazis_front update` (`vendor/update.py`) brings the copies to the installed version, each
file from three versions: the pristine copy (the base), the file of the package (the
upstream) and the file of the product. A file unchanged in the product is replaced, a file
changed only there is kept, a file changed on both sides is merged by `git merge-file`
(products are Git repositories: `.bazis/base/` is committed), and where both changed the
same or adjacent lines the file is
written with git conflict markers and the command fails. Files added to an asset are added, files removed from it are
deleted unless the product changed them. The stamp lines are compared at the new version,
so they never conflict. The assets that a new version requires are copied, the pristine
copies of the new version replace the old ones, the lock is updated, and the copies of the
JSON Schemas in `spec/` are refreshed. Everything is read and merged before anything is
written. The template is the product's and never updated; `update` reports the npm
dependency versions of the new template that differ from the product's `package.json`.
`update --check` and the system check `front.W004` (run by `bazis_doctor`) report copies of
another version without Node.

The client, the hooks and the helpers of the tests are not edited by the product, so they
are replaced without conflicts; the components are owned by the product and merged.

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
first components (`assets/ui`, `bazis_front add`), the contract export with the generated
TypeScript (`bazis_front contract`, `front.W001`), the frontend template with the copies
of the client, the hooks and its components and the lock (`bazis_front init`), the specs
with their validator (`bazis_front check`, `front.W002`), and the end-to-end tests of the
scenarios with their helpers (`bazis_front e2e`, `assets/playwright`, `front.W003`), run in
CI against the sample backend, and the update of the copies with a three-way merge
(`bazis_front update`, `front.W004`), and the design layer: presets and brand tokens compiled
into the theme of the frontend (`bazis_front design`, `front.W005`).
