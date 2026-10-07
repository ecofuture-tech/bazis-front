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
| 4. Specs | `spec/product.yaml`, `spec/screens/*.yaml`, `spec/design/` | the product root | written by the agent, validated against the layers below |

### 0. Contract

`bazis_front contract` exports the OpenAPI of the backend (with the `x-bazis` extension of
each operation) and `contract.json`: the resources with their actions and fields, and a
section per installed capability package (users, permit roles, statusy transits, …).
Permit and statusy sections are read from the database, so the export needs a migrated
database. From these it generates typed constants (`contract.ts`) and, through
openapi-typescript with `--default-non-nullable=false`, `schema.d.ts`. `--check` compares
without writing and is also the system check "contract is stale".

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

### 2. Hooks, 3. Components (planned)

React hooks over the client with TanStack Query as the cache: session, list, item,
schema, mutations, forms bound to the runtime schemas, and per package hooks (statusy,
uploadable, ws, async). Components are primitives on shadcn/ui (`app-shell`,
`resource-list`, `resource-form`, `transit-bar`, …) listed in `assets/registry.json` with
what they require; each ships a contract test that checks its `data-bz` test ids and
states, so that it keeps working after the product edits it.

### 4. Specs (planned)

The product is described in layers: the product spec (roles, entities, access, scenarios),
the screens and the design tokens. The validator (Python, JSON Schema plus cross-checks
against `contract.json`) reports stable error codes; scenarios are turned into Playwright
tests that drive the screens through `data-bz`.

## Updates of the copied code

Every copied file carries the version of bazis-front in its header, and
`frontend/bazis-front.lock.json` records the hashes of the contract, the specs and the
copied assets. Pristine copies of the assets are kept in `frontend/.bazis/base/` and
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

Pre-release. Available: the package skeleton and the client (`assets/client`). Next: the
contract export, the spec validator and the copy and update commands; then the hooks, the
first components and the end-to-end pipeline against a sample backend.
