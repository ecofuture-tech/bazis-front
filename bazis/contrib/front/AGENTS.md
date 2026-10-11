# bazis-front — guide for AI agents

The frontend layer of a product on Bazis: a React + TypeScript + Vite frontend next to the
backend, whose contract is generated from the backend and whose protocol code is copied
from this package. There are no npm packages of Bazis: the TypeScript code of the package
is shipped as package data and copied into the product, which then owns the copy.

**Status: pre-release.** The package ships `manage.py bazis_front init` (a frontend made
from its template, with the protocol client, the React hooks and the first components
copied into it, and the starters of the specs), `manage.py bazis_front add` (the
components), `manage.py bazis_front contract` (the export of the contract and the
TypeScript generated from it), `manage.py bazis_front check` (the validation of the
specs against the contract), `manage.py bazis_front design` (the theme of the frontend
compiled from the design of the specs), `manage.py bazis_front e2e` (the Playwright tests of
the scenarios of the specs) and `manage.py bazis_front update` (the copies brought to a new
version of bazis-front, merged with the changes of the product).

### Setup

`pip install bazis-front` (needs bazis 2.15.0 or newer) and add `"bazis.contrib.front"` to
`BS_INSTALLED_APPS`. The assets follow the protocol of recent versions of the packages of
the capabilities: bazis-ws 2.5.0 (the socket is open once the server sends `subscribed`),
bazis-authing 2.6.0 (the logout endpoint), bazis-permit 2.7.0 (the selectors of the
contract, also many-to-many and reverse relations, and the filter of a route restricted to
the fields the user sees), bazis-statusy 2.12.0 (the JSON Schemas of the transit payloads
with their titles translated, and the initial status of each model, `Workflow(initial=...)`),
bazis-uploadable 2.7.0 (the files of their author, for every route, and their download
route with its access check), bazis-bg 2.6.0 (the download route of the file of a task).
An older one that the project installs is the warning
`front.W006` of the system checks (it does not block `migrate`; `front.W002` does not repeat
it) and the error `C004` of `bazis_front check`: like any error of the specs, it also stops
`bazis_front e2e` (no tests are generated) and the comparison of `front.W003` until the
package is upgraded.

### Building the frontend of a product

The steps, each with the sections to read when you reach it, not before. Read a section with
`package_guide("bazis-front", "<section>")`; `guide_search` finds the section that answers a
question, and the `API:` sections give the signature of every export of the copied code (the
props of the components, the hooks, the client, the helpers of the tests), so that the copies
in `frontend/` never need to be read.

1. Install bazis-front and the packages of the product (above), then create the frontend
   with `python manage.py bazis_front init` (`--preset portal` for a product for the public,
   `workspace` for the staff): "The frontend".
2. Describe the product top down: `spec/product.yaml` (the roles with their `test_user`, the
   entities with their fields, workflows and access, the scenarios, the languages), "The
   specs"; then a file `spec/screens/<id>.yaml` per screen and the design, "The specs of the
   screens and the design".
3. Build the backend to satisfy the specs: the models and route sets, the roles with their
   permissions in `roles.py`, the workflows in `workflow.py`, the `e2e_data` command, "The
   backend of a product" (and the guides of bazis-permit and bazis-statusy).
4. Migrate the database and export the contract, `python manage.py bazis_front contract`:
   "The contract".
5. Run `python manage.py bazis_front check` and fix the spec or the backend as the hint of
   each issue says until it reports no errors, exporting the contract again after every
   change of the backend: "The issues of check".
6. Copy the components the screens need (`bazis_front add`) and write the screens in
   `frontend/src/screens/<id>/`: "The components", "Writing the screens" and "Composing beyond
   the specs"; by topic "Choices, filters, permissions and relationships", "Files, points and
   maps", "Custom actions and background work", "The socket" and "The language"; the data
   through "The hooks" and "The client".
7. Brand the design and generate the theme, `python manage.py bazis_front design`: "The
   design".
8. Generate the end-to-end tests, `python manage.py bazis_front e2e`, and run them with
   `npm run e2e` against the migrated backend with the data of `e2e_data`: "The end-to-end
   tests".
9. Check the frontend in `frontend/`: `npx tsc --noEmit`, `npm run lint`, `npm test` and
   `npm run build`; `python manage.py bazis_front status` lists what is stale.

Later, after `pip install -U bazis-front`: "Updating the copies".

### Rules

- **Generate the contract, never write it.** `contract/` and
  `frontend/src/bazis/generated/` come from `manage.py bazis_front contract`. Generate
  them again after every change of the backend and fix what the compiler reports; do not
  edit the generated files and do not declare resource types by hand.
- **Describe the product in `spec/` and keep `bazis_front check` green.** Build the
  backend to satisfy the specs (models, route sets, and the roles with their permissions,
  the statuses and the transits declared in `roles.py` and `workflow.py`), export the
  contract, and fix every issue that `check` reports, in the spec or in the backend, as its
  hint says.
- **Use the hooks and the client, do not reimplement them.** Data of the backend is read
  and changed with the hooks (`@/bazis/react`); requests, filters, errors, pagination,
  authentication and permission checks go through the client. Do not edit the copies;
  extend them with wrappers in the product code, so that a new version replaces them
  without conflicts.
- **The backend decides the permissions.** Do not encode roles or permission rules in the
  frontend. Hide or disable controls from what the backend reports: the permission meta
  and the runtime schema `schema_update` of the item.
- **Compose the screens from the components, own them.** Components and screens are part
  of the product and may be changed freely; keep the contract tests of the components
  passing, since the scenarios act through their `data-bz`.
- **Design through the tokens, never with literal colors.** The look of the product is
  `spec/design/` compiled by `bazis_front design`: a brand is a change of the tokens, not of
  the components; the screens use the Tailwind classes of the tokens (`bg-primary`,
  `text-muted-foreground`, `bg-success-soft`) and the patterns of the preset (`Screen`,
  `ListCardLayout`, `FormSurface`, the components), never colors such as `bg-blue-600` or
  `#3b82f6`.
- **Generate the end-to-end tests, never edit them.** Run `bazis_front e2e` after every
  change of the scenarios or the screens of the specs and keep `npm run e2e` green against
  the migrated backend with the data of `manage.py e2e_data`; write the other tests in
  `frontend/e2e/custom/`.

### The sections

| Section | Read it when |
|---|---|
| The frontend | you create the frontend (`init`), need the files of `frontend/` and who changes them, the npm commands, the lock, `status` |
| The specs | you write `spec/product.yaml`: the roles, entities, fields, workflows, access (with the permissions it requires), scenarios and their steps |
| The specs of the screens and the design | you write `spec/screens/<id>.yaml` (list, card, form, `card.related`, `list.filter`, `list.map`), the `data-bz` marks, `spec/design/theme.yaml` |
| The issues of check | `bazis_front check` reports a code (`C…`, `P…`, `S…`, `D…`) |
| The backend of a product | you build the backend the frontend relies on: the declared roles and workflows, the test data, the changes and the notifications, the invariants, the labels |
| The contract | you export the contract or read `contract.json` and `contract.ts` (`ROUTES`, `CAPABILITIES`, the sections of the capabilities) |
| The components | you choose the components and copy them (`add`): what each one is, its `data-bz`, what it requires |
| Writing the screens | you write a screen from its spec: the component of each part of a spec, the routes, the navigation, the card next to the list |
| Composing beyond the specs | a screen needs more than the specs say: a section of your own, a form of your own (and the marks that the tests need), numbers and dates in a text |
| Choices, filters, permissions and relationships | the choices and their labels, the related items ("add here"), the filters of a list, the navigation, the field permissions, the pickers and the labels of related items, the to-many fields in a form |
| Files, points and maps | the files of bazis-uploadable, the points and the maps, what is near |
| Custom actions and background work | an action of the backend that is no CRUD (an export, a report), its permission, a task of bazis-bg, a background request |
| The socket | bazis-ws: the live updates, the notifications and the bell, the protocol of the socket |
| The design | the presets, the tokens, the brand, the dark mode, the tones of the statuses, the classes of the theme |
| The end-to-end tests | `bazis_front e2e`, the steps and their helpers, `e2e_data`, `npm run e2e` and its ports, the tests of your own |
| The client | a request that the hooks do not cover, the filters, the errors of a form, the permission meta, the uploads |
| The hooks | the data of the backend in a screen: lists, items, forms, schemas, permissions, transits, uploads, the socket, tasks |
| The language | the languages, the dictionaries and `t()`, the formats of dates and numbers, the language of the profile |
| Logins with bazis-authing | the login of the template with bazis-users or bazis-authing, the sign-out |
| Protocol facts that are easy to get wrong | a request is refused or answers otherwise than you expected: the filters, `include`, 403 and 404, the errors, the files, the points, the tasks |
| Updating the copies | after `pip install -U bazis-front`: `update`, its conflicts, the changes of the API of the copies |
| `API: …` (generated) | you need the props of a component, the parameters and the result of a hook or of the client, a helper of the end-to-end tests |

## The frontend

```bash
python manage.py bazis_front init                  # create frontend/ in the product root and run `npm install`
python manage.py bazis_front init --no-node        # the same without `npm install`
python manage.py bazis_front init --preset portal  # the starters of the design of the preset portal (workspace by default)
```

`init` creates `frontend/` next to `manage.py`, a React 19 + TypeScript + Vite 7 app with
TanStack Query, React Router 7 and Tailwind 4 set up for shadcn/ui (`components.json`),
with the layout of the application (`app-shell`), a login screen (`login-form`) and a home
screen that lists the resources of the contract. It never overwrites an existing
`frontend/`. It writes:

- `spec/` next to `manage.py`, when the product has none (an existing one is kept): the
  JSON Schemas of the specs in `spec/schema/` (for the editors) and starters of
  `spec/product.yaml`, `spec/design/theme.yaml` and `spec/design/tokens.json` (those of the
  preset of `--preset`); see [The specs](#the-specs);
- the theme of the frontend, `src/bazis/generated/theme.css` and `theme.ts`, compiled from
  `spec/design/` as `bazis_front design` does (see [The design](#the-design)); a design with
  errors is reported and the theme is left to `bazis_front design`;

- the files of the template (`assets/template`), which the product owns from then on
  (`update` merges a new version with its changes), among them `frontend/AGENTS.md`, which
  points the agents to the sections of this guide, with their pristine copy in
  `.bazis/base/template@<version>/`;
- the protocol client in `src/bazis/client/` and the React hooks in `src/bazis/react/`,
  each file stamped with `// bazis-front <version> asset <asset>` after its license header,
  and the same pristine copy in `.bazis/base/<asset>@<version>/` for the merge of later
  versions. The hooks of a package are copied only when the product has it at `init` (its
  app in `INSTALLED_APPS`, as the capabilities of the contract): with bazis-statusy the
  asset `react-statusy` in `src/bazis/react/statusy/`, with bazis-uploadable `react-uploadable`
  in `src/bazis/react/uploadable/`, with bazis-ws `react-ws` in `src/bazis/react/ws/` (bazis-ws
  is not a Django app: its installed package is enough), with bazis-bg `react-bg` in
  `src/bazis/react/bg/`, with bazis-async-background `react-async` in
  `src/bazis/react/async/`. A package installed after `init` has
  no hooks in the frontend until `bazis_front add react-statusy` (or a component that
  requires them) copies them: `check` reports it (`C003`);
- the translation of the interface in `src/bazis/i18n/` (the asset `i18n`, copied like the
  hooks; see [The language](#the-language));
- the components that the template uses, `state-panel`, `app-shell` and `login-form`, in
  the same way, with the shadcn/ui components they use (see [The components](#the-components));
- the helpers of the end-to-end tests in `e2e/bazis/` (the asset `playwright`, copied like
  the hooks), with `playwright.config.ts` and `e2e/custom/` of the template (see
  [The end-to-end tests](#the-end-to-end-tests));
- `bazis-front.lock.json`: the version of bazis-front, the hashes of the contract and of
  the generated files (see below), and the version and the file hashes of every copied
  asset, the template too; an asset that was not copied is not in it.
  `bazis_front e2e` adds the hashes of the specs and of the tests it generates (`e2e`),
  `init` and `bazis_front design` those of the design and of the theme (`design`).

Commit `bazis-front.lock.json` and `.bazis/`: `update` merges a new version with the
changes of the product from the pristine copies, and the old version is no longer installed
then. The files that `init` and `add` copy are
listed in `assets/registry.json` of the package. The frontend compiles once `contract` has generated
`src/bazis/generated/`. It has a login only when the backend has bazis-users; without it
every screen is open and requests are anonymous. The login is the token endpoint of
bazis-users, or with bazis-authing its services: the username and the password through the
service `password`, and a button for each service whose page opens in a window (Google);
see [Logins with bazis-authing](#logins-with-bazis-authing).

The files of the frontend and of the product, by the layers of bazis-front, and who changes
them:

| Path | Layer | What | Changed by |
|---|---|---|---|
| `contract/` (in the product root) | 0. Contract | the OpenAPI and `contract.json` (see [The contract](#the-contract)) | only `manage.py bazis_front contract` |
| `frontend/src/bazis/generated/` | 0. Contract | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API); `theme.css` and `theme.ts` (the design: the tokens as CSS variables, `THEME`) | only `manage.py bazis_front contract`; the theme only `manage.py bazis_front design` |
| `frontend/src/bazis/client/` | 1. Protocol (`assets/client`) | the client of the Bazis protocol | bazis-front, copied by `init`; not edited, wrapped in `src/app/` |
| `frontend/src/bazis/react/` | 2. Hooks (`assets/react`) | the React hooks over the client and TanStack Query (`@/bazis/react`); `statusy/` (`@/bazis/react/statusy`) when the backend has bazis-statusy, `uploadable/` (`@/bazis/react/uploadable`) when it has bazis-uploadable, `ws/` with bazis-ws, `bg/` with bazis-bg, `async/` with bazis-async-background | bazis-front, copied; not edited |
| `frontend/src/bazis/ui/<component>/` | 3. Components (`assets/ui`) | the components (`@/bazis/ui/<component>`), each with its contract test; `init` copies `state-panel`, `app-shell`, `login-form`, `manage.py bazis_front add` the others (`add map` also sets Leaflet in `package.json`: `npm install` then) | the product, keeping the contract tests passing |
| `frontend/src/components/ui/`, `frontend/src/lib/` | 3. Components | shadcn/ui components: those of the components copied by bazis-front, others with `npx shadcn add <name>` | the product |
| `spec/` (in the product root) | 4. Specs | the specs: `product.yaml` (roles, entities, access, scenarios), `screens/<id>.yaml`, `design/`; validated against the contract, its scenarios generate the end-to-end tests and its design the theme | the product; checked by `manage.py bazis_front check` |
| `frontend/e2e/generated/` | 4. Specs | the end-to-end tests of the scenarios of `spec/product.yaml`, and `product.ts` (the test users and the routes of the specs) | only `manage.py bazis_front e2e` |
| `frontend/e2e/bazis/` | 4. Specs | the helpers of the end-to-end tests (Playwright, through `data-bz`) | bazis-front; not edited |
| `frontend/e2e/custom/` | 4. Specs | the end-to-end tests written by hand | the product |
| `frontend/src/app/` | App (the template, `assets/template`) | providers (query cache, `BazisProvider`), session, router (the layout and the navigation), errors | the product; merged with a new version by `update` |
| `frontend/src/screens/<screen>/` | App | the screens, composed from the components | the product |
| `frontend/package.json`, the configs, `frontend/src/i18n/`, `frontend/AGENTS.md` | App | the rest of the template | the product; merged with a new version by `update` |
| `frontend/bazis-front.lock.json`, `frontend/.bazis/base/` | | the versions and hashes of the contract, of the generated files and of the copied assets; the pristine copies of the assets, from which `bazis_front update` merges a new version | bazis-front; commit them, never edit them |

From `frontend/`:

```bash
npm install
npm run dev        # the dev server; /api goes to BAZIS_API_URL (http://localhost:8000)
npm run typecheck
npm run lint
npm run format     # prettier of package.json, its style; the code of the product only (.prettierignore)
npm test
npm run build
npx playwright install chromium   # once
npm run e2e        # the end-to-end tests, against the running backend of BAZIS_API_URL (E2E_PASSWORD)
```

`schema.d.ts` is generated with the `openapi-typescript` of the `package.json` of the
frontend: run `npm install` before `bazis_front contract`. Format with `npm run format` only:
it is the prettier pinned in `package.json` with the style of the template (`prettier` there),
and leaves the copies, the generated files and `e2e/fixtures/` (uploaded byte for byte) alone; `npx prettier` downloads another
version with other defaults, and its output no longer matches the copies and the template.

```bash
python manage.py bazis_front status         # the copies, the generated files, every stale or changed one
python manage.py bazis_front status --json  # {bazis_front, frontend, assets, generated, issues}
```

`status` writes nothing and exits with 0: it shows the installed bazis-front, the assets of
the lock with their versions, which generated files the frontend has (`contract`: the
TypeScript of the contract; `design`: the theme; `e2e`: the end-to-end tests), and the
issues of the checks of bazis-front, each with its id, level, message and hint:
`front.W006` (an outdated package), `front.W001` (a stale contract or generated file; the
database must be migrated, else `front.I001`), `front.W002` (an issue of the specs),
`front.W004` (stale copies), `front.W007` (changed copies), `front.W005` (a stale theme),
`front.W003` (stale end-to-end tests). The `--check` of `contract`, `update`, `design`
and `e2e`, and `check`, fail on their own state in CI. No subcommand of `bazis_front` runs
the system checks of Django (`manage.py check` and `bazis_doctor` do): their warnings never
mix with its output.

## The specs

The product is described in `spec/` of the product root, in three layers: the product
(`product.yaml`: roles, entities, access, scenarios), the screens (`screens/<id>.yaml`)
and the design (`design/theme.yaml`, `design/tokens.json`). They reference each other by
id: a screen the entities and the roles of the product, a scenario the screens, their
actions and the transitions; the contract knows nothing of them. The agent writes them; the backend is built to satisfy them and
the validator checks them against the contract:

```bash
python manage.py bazis_front check                  # every layer; exit 1 if there are errors
python manage.py bazis_front check --json           # the same as JSON
python manage.py bazis_front check --layer screens  # the issues of one layer (all are read)
```

`check` validates each file against its JSON Schema (Draft 2020-12, shipped in the
package; `init` copies them to `spec/schema/`, and every starter references its schema for
the editors), then the references between the files and, when the product has
`contract/contract.json`, against the contract. The YAML files are read with the types of
YAML 1.2: only `true` and `false` are booleans (`yes`, `No`, `on` are strings) and dates
stay strings. Without the contract only the shape and
the references between the specs are checked, and the output says so (`"contract": false`
in JSON). Export the contract first (`bazis_front contract`); `check` reads it, it does not
compare it with the backend (that is `contract --check` and `front.W001`).

### `spec/product.yaml` (`spec: bazis-product/1`)

The specs of the sample of this package (its roles, statuses and transits are declared in
`tasks/roles.py` and `tasks/workflow.py`):

```yaml
# yaml-language-server: $schema=./schema/product.schema.json
spec: bazis-product/1
product: {id: tasks, name: Tasks, summary: The tasks of a team}
packages: [users, authing, permit, statusy, uploadable, ws, bg, async_background, async_request]   # each needs its section in the contract
languages: [en, ru]                  # optional: LANGUAGES of the backend (P029)
language: en                         # optional: the code of LANGUAGES of LANGUAGE_CODE (P029)
roles:
  - {id: manager, permit: manager, title: Manager, test_user: {username: manager}}
  - {id: viewer, permit: viewer, title: Viewer, test_user: {username: viewer}}
  # the users who do not log in: a role `for_anonymous` of bazis-permit (or none, for the
  # public routes and actions only), no test user (P030)
  - {id: guest, permit: visitor, title: Guest, anonymous: true}
entities:
  - id: task
    resource: tasks.task                 # the JSON:API type in contract.json
    title: Task
    fields:                              # attributes (type) and relationships (relation: entity)
      - {id: title, type: string}
      - {id: report, type: text}
      - {id: dt_created, type: datetime}
      - {id: assignee, relation: user}   # many: false by default
      - {id: attachment, type: file}     # bazis-uploadable: a relationship to its uploaded files
    workflow:                            # bazis-statusy; the entity gets the field `status`
      initial: draft
      statuses: [draft, in_progress, done]
      transitions:
        - {id: start, from: draft, to: in_progress}
        - {id: finish, from: in_progress, to: done, payload: {fields: [{id: report, type: text}]}}
    access:
      manager:
        view: all
        add: all
        change: {selector: all, statuses: [draft]}
        transit: [start, finish]
      viewer: {view: all}
  - id: user
    resource: users.user
    fields: [{id: username, type: string}]
scenarios:
  - id: manager-finishes-a-task
    role: manager
    steps:
      - open: task-list
      - action: create
      - fill: {title: Write the report}
      - submit: {}
      - expect: {screen: task-card, status: draft}
      - transit: start
      - transit: {id: finish, payload: {report: Done}}
      - expect: {status: done, field_readonly: title}
```

#### Languages

**Languages** (optional): `languages`, the codes of the languages of the interface, and
`language`, the default one (one of them), as the backend has them: `check` compares them
with `project.languages` (`LANGUAGES`) and `project.language` (the code of `LANGUAGES`
that `LANGUAGE_CODE` names) of the contract (P029). See [The language](#the-language).

#### Fields

**Fields** are those of the resource in the API (`fields` of contract.json), with `type`
(`string`, `text`, `integer`, `number`, `boolean`, `date`, `datetime`, `time`, `json`,
`point`, `file`) or `relation` (the id of an entity) and `many`. A `DecimalField` (a sum,
a price) is a `string` of its exact digits in the API and in the contract
(`"45000.10"`): declare it `string` (`number` is P013), and show it with `formatDecimal`
(see [The language](#the-language)). A `point` is a
`PointField` of the model (`format: point` of the contract; `json` is another object: a
point field declared `json` is P013, declare it `point`). A `file` is a to-one
relationship to a resource of the uploaded files of bazis-uploadable (`resources` of the
capability `uploadable`; P013 otherwise): declare such a relationship as a `file`, not as
a `relation`; it needs no entity. A payload of a transit has no `file`. What is required, writable or
visible for the current user is not in the spec: the runtime schemas of the backend
decide it.

#### Workflow

**Workflow**: the statuses and the transits of bazis-statusy; a transit has one `from`
(a Transit row has one source status), and `payload` when an action of the transit takes
a typed payload. The ids are those of the Status and Transit rows, including those that
bazis-statusy generates for a Transit created without one (`task#draft_to_done`,
`task#draft_to_done#1`); any characters but `.` and white space.

#### Access

**Access** says what a role may do; it is compiled to permissions of bazis-permit that
the permit role of the role must have (through its permission groups). It does not
decide what the frontend shows: that is the permission meta and the runtime schemas. An operation
(`view`, `add`, `change`, `delete`) takes a selector: `all`, `none` (not granted, as an
absent operation), `self` (the object is the selector source itself, such as the user),
a relationship that links the object to the user (`author`, `org_owner`) or a path of
relationships to it (`parent__author`); on a statusy model also `{selector, statuses}` to grant it only in these statuses.
Several of them are a list (`view: [author, participants]`, not `none`): the role may do
the operation on the objects of any of them, as bazis-permit unites the permissions of a
role, and each is a permission of its own. `transit` is a list of transits (selector
`all`) or `{transit: selector}` (or a list of selectors, `{finish: [author, assignee]}`).
The permissions, as bazis-permit and bazis-statusy name them:

| Access | Model without statuses | Statusy model |
|---|---|---|
| `view: all` | `app.model.item.view.all` | `app.model.item.view.all.all` |
| `change: author` | `app.model.item.change.author` | `app.model.item.change.author.all` |
| `change: {selector: all, statuses: [draft]}` | | `app.model.item.change.all.draft` |
| `view: [author, participants]` | `app.model.item.view.author`, `app.model.item.view.participants` | `app.model.item.view.author.all`, `app.model.item.view.participants.all` |
| `transit: [finish]` | | `app.model.item.transit.all.in_progress.finish` (the source status of the transit) |

A permission of the role with the selector `all` covers any selector, and the status
`all` any status. Missing permissions are errors (P019); permissions the role has beyond
the access are not reported (the absence of an operation is what the scenarios check,
with `expect: {action_absent: ...}`). A selector that is not one of the resource is a
warning (P020): its last name must be one of the `selectors` of the section `permit` of
the resource it reaches (a reverse relation such as `members` or a many-to-many field,
bazis-permit 2.6.0, whether the route shows it or not; `self` only on a selector
source), and each relation of its path a relationship of the contract or a selector;
what the contract does not describe is not checked. A path through a relation that the
route set does not show and that is not a selector (a reverse relation to a model that
is no selector source: the participants of the events of an organizer,
`registrations__event__author` on the user) is written in `access` as it is, like any
other grant: the contract does not describe the relation, bazis-permit checks the
selectors of the permissions it declares (`permit.E005`) and `check` that the role has
the permission (P019). Never leave a grant out of the spec to silence a warning.

#### Scenarios

**Scenarios** are the end-to-end tests of the product: steps over the screens, each one
key: `open: <screen>`, `open_item: {where: {field: value}}` (a row of the current list,
which opens the screen of its `list.open`), `action: <action of the screen>`,
`fill: {field: value}` and `upload: {field, file}` (in the open form, or on a card with
`edit: true`; a `file` field is uploaded, a file of `e2e/fixtures/` of the frontend,
never filled: P022; a to-many relationship, `many: true`, is filled with the list of the
labels of its items, `fill: {interviewers: [Ann Lee, Bob Stone]}`, which replace those it
had, `[]` for none: P022 for one value), `submit: {}`, `transit: <id>` or `{id, payload}` (on a card with
`transitions: true`), `expect` with `screen`, `status`, `state`, `action_absent`,
`field_readonly`, `field_absent` (a field the screen shows that the user may not see:
not on the screen once it is loaded), `values` (`{field: text}`: the fields of the
current card, without an open form, show these texts; a file its name), `rows`,
`error`, `notification` (a notification of the user whose text contains the text, in the
list of the notifications; the product has bazis-notify or bazis-ws, `packages` has
`notify` or `ws`: P027). The
validator follows the steps from screen to screen
and checks each against the screen it acts on: `open` takes a screen without an item in
its route (an item is reached with `open_item` or the `then` of a form), a form with
`fields` is filled only in them, `action_absent` names an action of the screen and
`field_absent` a field it shows (a column, a field of a section or of the open form). A
`submit` followed by an `expect` of a refusal, an `error` of a field or a `state` of a
failure (`invalid`, `error`, `forbidden`, `not_found`), is refused: its form stays open on
its screen (no `then`), the expectation names no other `screen` (P022), and the next steps
fix it and submit again; every other submit saves. When the
product logs in (`packages` has `users`), the role of a scenario has a `test_user`, the
user its end-to-end test logs in as (P025) with its password: with bazis-authing, through
its service `password` (P026). A role of the users who do not log in (the guests of a
public site, the form of a public action) is `anonymous: true`, without a `test_user`: its
scenarios log in as nobody. Its permit role is one that bazis-permit gives anonymous users
(`Role(..., for_anonymous=True)`), or none when they use only the public routes and actions
(no `access` then); anonymous users match no selector but `all` (P030). Its screens are
routed outside the screens of a session (see
[The routes and the navigation](#the-routes-and-the-navigation)). `bazis_front e2e` turns
each scenario into a Playwright test (see [The end-to-end tests](#the-end-to-end-tests)).

## The specs of the screens and the design

### `spec/screens/<id>.yaml` (`spec: bazis-screen/1`)

```yaml
# yaml-language-server: $schema=../schema/screen.schema.json
spec: bazis-screen/1
id: task-list                    # the name of the file
title: Tasks
route: /tasks
entity: task
roles: [manager, viewer]         # the roles of the scenarios; the backend decides access (and the links: `requires`)
primitive: list                  # list | card | form, with its section of the same name
list:
  columns: [title, status, assignee, dt_created]
  filters: [status, assignee]    # fields with `filter` in the contract
  sort: [-dt_created]            # fields with `order` in the contract
  search: true
  open: task-card                # the card that a row opens
actions:
  - {id: create, primitive: form, mode: create, fields: [title, assignee], then: task-card}
states: [loading, empty, error, forbidden]
```

A list of some of the items (a report) has `filter`, the fields (with `filter` in the
contract) equal to their values, combined with the filters of the user; `highlight` marks
the rows whose boolean field is true with a tone of the theme (`neutral`, `primary`,
`info`, `success`, `warning`, `danger`) and its `label` (a key of the dictionaries of the
frontend or a text, required: the color alone tells nothing to some users). In the screen
they are `filter` of `ResourceList` (`Filter.where('is_overdue', true)`; `Filter.and` of
one for each field), `rowTone` and `rowToneLabel` (see "The filters of a list" in
[Choices, filters, permissions and relationships](#choices-filters-permissions-and-relationships)); the link of the screen requires
the fields of its filter (`requires.filters`), which every role that sees it must be able
to filter by. S014 reports a value of another type than its field and a highlight by a
field that is not a boolean or without a label:

```yaml
list:
  columns: [title, priority, response_due]
  filter: {is_overdue: true}
  highlight: {field: is_overdue, tone: danger, label: tickets.overdue}
```

`map` puts the items of a list with a point on a map beside it: `map: {field: location}`, a
field of the entity with `type: point` (S016), in the screen `ResourceMap` of the component
map with the `filter` of the list, its markers opening `open`. A point field is never one of
the `filters` (S016): a list of what is near filters by the distance in the screen
(`nearFilter`).

```yaml
spec: bazis-screen/1
id: task-card
route: /tasks/:id
entity: task
primitive: card
card:
  sections:
    - {id: main, fields: [title, status, assignee]}
  edit: true                     # the update form of the runtime schema
  transitions: true              # the transits of the item (needs a workflow)
  history: true                  # its status history (needs a workflow)
actions: [{id: delete, primitive: destroy, then: task-list}]
states: [loading, error, forbidden, not_found]
```

A card shows the items that reference its item in `related` sections: a list of the related
entity filtered by its to-one relationship to the entity of the card (`relation`, a field of
the related entity with `relation: <entity of the card>`, S015; one the contract filters by,
S008), its `columns`, the card a row opens (`open`), and `add`, "add here": the action
`add.id` of the card opens the create form of the related entity (`add.fields`, all its
fields but the relationship when omitted) with the relationship fixed to the item. A scenario
runs it as an action of the card (`action: add-step`), fills the form (never the fixed
relationship: P022) and submits it; the card stays. In the screen it is `RelatedList`
("Related items" in
[Choices, filters, permissions and relationships](#choices-filters-permissions-and-relationships)):

```yaml
card:
  sections: [{id: main, fields: [title, status]}]
  related:
    - id: steps
      title: Steps
      entity: step                 # the related entity
      relation: task               # its relationship to the entity of the card
      columns: [title, dt_created]
      add: {id: add-step, fields: [title]}
```

A `form` screen has `form: {mode: create | update, fields, then}`. Actions are `form`
(`mode: create` on a list or a card, `mode: update` on a card) and `destroy` (on a card).
The states that a primitive must render are required: list `loading, empty, error,
forbidden`; card `loading, error, forbidden, not_found`; form `loading, error, forbidden,
invalid`.

#### `data-bz`

**`data-bz`**: the screens mark their elements, and the scenarios act through them:
`screen:<id>`, `state:<loading|empty|loaded|error|forbidden|not_found|invalid>`,
`list:<entity>`, `row:<id>` (its cells `cell:<column>`), `field:<field>`,
`error:<field>`, `upload:<field>` (a file field, `aria-busy` while its file uploads; the
input of the file is its `field:<field>`), `file:unavailable` (a file the user may not
read), `action:<id>`, `transit:<id>`, `status:<id>`,
`nav:<screen>`, `map:<entity>` with `marker:<id>` (`list.map`); of the components of the
packages `socket:<status>` (the socket of bazis-ws), `list:notifications` with
`notification:<key>` (opened by `action:notifications`), `bg:<state>` (a task of
bazis-bg) with `action:download`, `async:<status>` (a background result). The components
render the marks of their parts (see [The components](#the-components)); a screen of
your own renders them itself.

### `spec/design/` (`spec: bazis-design/1`)

```yaml
# theme.yaml
spec: bazis-design/1
preset: workspace          # workspace (a working application) | portal (a public shell)
navigation: sidebar        # sidebar | topbar
density: comfortable       # comfortable | compact
composition:
  list: table              # table | cards
  list_card: split         # split (the list and the card side by side) | pages
  forms: dialog            # dialog | page
statuses:                  # the tone of the badge of each status of bazis-statusy
  draft: neutral           # neutral | primary | info | success | warning | danger
  in_progress: info
  done: success
```

`spec/design/` is optional (without it the theme is that of the starter of `workspace`);
when `theme.yaml` exists, `tokens.json` must define the tokens of its preset. An option of
`theme.yaml` that is left out is that of the preset. `tokens.json` is a subset of the DTCG
format: groups of tokens with `$value` and `$type` (`color`, `dimension` in `px`/`rem`,
`fontFamily`, `fontWeight`, `number`, `duration` in `ms`) on every token, and references
`{group.token}` to a token of the same type (D006), never coming back to the token they
start from (D004). `bazis_front design` compiles them into the theme of the frontend (see
[The design](#the-design)); `check` reports the statuses of `statuses` that the contract
does not have (D008) and the text colors below the contrast of WCAG AA (D009).

## The issues of check

An issue is `{layer, file, path, code, severity, message, hint}`: `file` is relative to
the product root, `path` the JSON Pointer of the value, `hint` the fix. The codes are
stable. Errors fail `check` (exit 1); warnings do not. When `spec/` exists, the system
check `front.W002` (run by `bazis_doctor`) reports every issue with its code and severity:
the system checks run before every management command, so an error of the specs is a
warning there, never blocking `migrate` or `contract`.

| Code | Severity | Meaning |
|---|---|---|
| `C001` | error | contract/contract.json cannot be read |
| `C002` | error | contract/contract.json has another format: it was exported by another version of bazis-front |
| `C003` | warning | the assets of the frontend (its lock) differ from the capabilities of the contract: the hooks of a package are missing, or assets of a package are there without it |
| `C004` | error | the installed package of a capability of the contract is older than the version whose protocol the frontend follows (bazis-ws 2.5.0, bazis-authing 2.6.0, bazis-permit 2.7.0, bazis-statusy 2.12.0, bazis-uploadable 2.7.0, bazis-bg 2.6.0); the system check `front.W006` (a warning) reports it instead of `front.W002`; it stops `bazis_front e2e` and `front.W003` as any error |
| `P001` | error | spec/product.yaml is missing or is not valid YAML |
| `P002` | error | spec/product.yaml does not follow product.schema.json |
| `P003` | error | an id is declared twice (role, entity, field, transition, scenario) |
| `P004` | error | an unknown role (in access or in a scenario) |
| `P005` | error | a relation references an unknown entity |
| `P006` | error | the workflow is inconsistent: a status or a transition that the workflow of the entity does not declare |
| `P010` | error | a package is not installed: the contract has no section for it |
| `P011` | error | the resource of an entity is not in the contract |
| `P012` | error | a field is not in the resource of the contract |
| `P013` | error | a field differs from the contract: attribute or relationship, type, related resource, many |
| `P014` | error | the entity has a workflow, the resource is not a statusy model of the contract |
| `P015` | error | a status of the workflow is not in the contract, or the initial status differs |
| `P016` | error | a transition is not in the contract, or its from/to differ |
| `P017` | error | the payload of a transition differs from the contract |
| `P018` | error | the permit role of a role is not in the contract |
| `P019` | error | the permit role lacks a permission that `access` grants |
| `P020` | warning | a selector of `access` is not a selector of the resource in the contract (`selectors` of the section `permit`), or a field of its path is not a relationship (a relation that the contract does not describe is not checked) |
| `P021` | error | a scenario step references an unknown screen |
| `P022` | error | a scenario step is not possible on the current screen |
| `P023` | error | a scenario step references a field that the entity of the screen does not declare |
| `P024` | error | a scenario step references an unknown status or transition, or its payload differs |
| `P025` | error | the role of a scenario has no `test_user` and is not `anonymous`, and the product logs in (`packages` has `users`) |
| `P026` | error | the scenarios log in with a password, and the bazis-authing of the contract has no service `password` |
| `P027` | error | a scenario expects a notification, and the product has no notifications (`packages` has neither `notify` nor `ws`) |
| `P028` | error | `packages` has `ws`, and the contract has no path of the socket: the socket of bazis-ws is not routed where the export sees it (the router module) |
| `P029` | error | the languages of the product differ from the contract (`languages`: LANGUAGES, `language`: the code of LANGUAGES that LANGUAGE_CODE names), or `language` is not one of `languages` |
| `P030` | error | an anonymous role is not what bazis-permit gives the users who do not log in: its permit role is not `for_anonymous`, it has `access` without a permit role, or a selector of its access is not `all` |
| `S001` | error | a screen file is not valid YAML |
| `S002` | error | a screen does not follow screen.schema.json |
| `S003` | error | the id of a screen differs from its file name, or its route is taken |
| `S004` | error | a screen references an unknown entity |
| `S005` | error | a screen references an unknown role |
| `S006` | error | a screen references an unknown screen, or one of another primitive |
| `S007` | error | a screen references a field that its entity does not declare |
| `S008` | error | a filter or a sort field cannot be filtered or sorted by in the contract |
| `S009` | error | a state required by the primitive is missing |
| `S010` | error | an action is not valid: a duplicate id, or not possible on the primitive |
| `S011` | error | transitions or history on a card whose entity has no workflow |
| `S012` | warning | a screen edits or filters a relationship with a picker (a filter of a list, a field of a form or of a card with `edit`), and the related resource has no search fields in the contract: its picker lists the items without a search |
| `S013` | error | a list has `search`, and the resource of its entity has no search fields in the contract: the search is 400 `ERR_FILTER` |
| `S014` | error | a value of the filter of a list does not fit the type of its field in the contract, or its highlight is not by a boolean field or has no label |
| `S015` | error | the relation of a related section of a card is not a to-one relationship of the related entity to the entity of the card |
| `S016` | error | the map of a list is not by a point field of its entity, or a point field is a filter of a list |
| `S017` | warning | a screen edits or filters a relationship with a picker, and the search fields of the related resource do not cover the fields that give the label of its items (`first_name`, `last_name`, `name`…: see "The label of an item"): a search by the label shown finds nothing |
| `D001` | error | a design file is not valid YAML or JSON |
| `D002` | error | spec/design/theme.yaml does not follow design.schema.json |
| `D003` | error | spec/design/tokens.json does not follow tokens.schema.json |
| `D004` | error | a token references an undefined token, or references itself through other tokens |
| `D005` | error | a token required by the preset is undefined or of another type |
| `D006` | error | a token references a token of another type |
| `D007` | error | a token of the dark mode (the group `dark`) overrides no token of the same name and type |
| `D008` | warning | a status of `statuses` in theme.yaml is not a status of the contract |
| `D009` | warning | a text color has a contrast below 4.5:1 (WCAG AA) on its background, in the light or the dark mode |

## The backend of a product

What the frontend relies on in the backend, as the sample of the bazis-front repository
(`sample/`, not in the package) does it; the parts a product copies are below:

### The roles, the permissions, the statuses and the transits are declared in the code

**The roles, the permissions, the statuses and the transits are declared in the code**
(bazis-permit and bazis-statusy; their guides have the details): the permission groups
and the roles in `<app>/roles.py`, the workflow of each statusy model in
`<app>/workflow.py` (the sample: `tasks/roles.py`, `tasks/workflow.py`), with English
names (`gettext_lazy`) that the catalogs of the project translate into the column of each
language. `migrate` applies them after the last migration, on every database (CI, the
end-to-end tests), and keeps them as declared (the declared rows are `managed`); a change
is a change of the module and a `migrate`. The database checks of `bazis_doctor` report a
database that differs from them (`permit.W005`, `statusy.W003`). `access` of the specs is
what the permissions cover (P019). The frontend reads the names of the statuses and the
transits, in every language, from the contract (`TRANSITS` of `contract.ts`: `statusName`,
`statusOptions`, `transitName` of `@/bazis/ui/status-badge`), and the transits of an item
from its retrieve: it needs no route of bazis-statusy, so do not register
`bazis.contrib.statusy.router` for it (its routes `statusy/status/` and `statusy/transit/`
restrict nothing, and bazis-permit warns about them, `permit.W002`).

```python
# tasks/roles.py
from django.utils.translation import gettext_lazy as _
from bazis.contrib.permit.declare import Group, Role

VIEW = Group('tasks_view', _('View the tasks'), ['tasks.task.item.view.all.all'])
GROUPS = [VIEW]
ROLES = [Role('viewer', _('Viewer'), [VIEW])]

# tasks/workflow.py
from django.utils.translation import gettext_lazy as _
from bazis.contrib.statusy.declare import Status, Transit, Workflow

DRAFT, DONE = Status('draft', _('Draft')), Status('done', _('Done'))
WORKFLOWS = [Workflow('tasks.Task', [DRAFT, DONE], [Transit('finish', _('Finish'), DRAFT, DONE)])]
```

The tests need nothing more than bazis-test-utils, whose pytest plugin installs the
triggers of `pgtrigger` in the test database: the test database is migrated, so the
declarations are there, also after a `django_db(transaction=True)` test empties the
tables (the flush applies them again). No fixture creates the roles, statuses or
transits; a test that changes the declared rows itself takes the fixture
`bazis_declared`. A product whose data migrations created these rows keeps them as
history without effect (`operations = []`, as `sample/tasks/migrations/0005_workflow.py`):
`migrate` takes over the existing rows of the declared slugs and ids.

### The test data of the end-to-end tests

**The test data of the end-to-end tests** is `manage.py e2e_data` (see
[The end-to-end tests](#the-end-to-end-tests); `sample/tasks/management/commands/e2e_data.py`
and `sample/tasks/e2e.py`; not `workflow.py`, the module of the declared workflows).

### The changes and the notifications

**The changes and the notifications** reach the frontend as `sample/tasks/models.py` sends
them, from `save()` and from an action of a transit (after the commit, robustly): the change
of a task on the common channel of bazis-ws without its id (`publish_changed`, the formats
of [The socket](#the-socket)), the notification of the assignee with `notify` of
bazis-notify (stored, in his language, its type registered in `<app>/notifications.py`;
bazis-notify delivers it live itself, `notification_created`: never publish it a second
time with `bazis.contrib.ws.messages.notify`, which is for a product without bazis-notify).

```python
from bazis.contrib.notify.service import notify
from bazis.contrib.ws.messages import publish_changed

publish_changed(task)
notify(task.assignee, 'tasks.finished', _('Task finished'), lambda user: task.title,
       action={'route': f'/tasks/{task.pk}'})   # the route that the bell opens
```

### Every rule that the frontend follows to hide an action is a rule of the backend too

**Every rule that the frontend follows to hide an action is a rule of the backend too**:
the frontend is not a security boundary, and a hidden button stops nobody who sends the
request. A permission is a permission of bazis-permit (the frontend reads its meta); an
invariant of the data (a step is added to a draft task only, an approval within the
budget) is `validate_item` of the model (the core: 422 `ERR_ITEM_INVALID` pointing at the
field, which the forms show), as `tasks.models.Step` of the sample does, with a test of
the API that the request is refused:

```python
def validate_item(self, changes):
    if (changes.is_new or 'task' in changes.fields) and self.task.status_id != 'draft':
        raise ValidationError({'task': _('A step is added to a draft task only')})
```

### The labels of the choices

**The labels of the choices** of a model field are those of its `choices` (`TextChoices`
with English labels in `gettext_lazy`, translated by the catalogs of the project): the
runtime schemas give them (`enumDict`) in the language of the request, and the frontend
shows, offers and filters a choice by them. A field that only names a few values needs no
model of its own for its labels.

### The labels of the payload of a transit

**The labels of the payload of a transit** are the titles of the fields of its payload
model (`report: str = Field(title=_('Report'))`): the runtime schemas (`state_actions`)
give them in the language of the request, the contract in `LANGUAGE_CODE`.

### The navigation and the filters follow the permissions

**The navigation and the filters follow the permissions**: a route set whose list or
create the role may not use answers its runtime schema with 403 (bazis-permit), and a
field hidden from the user is not in its `route_filter_fields/` (the frontend hides the
link, `requires`, and the filter).

### The screens

**The screens** are product code over the components (`sample/frontend-overlay/src/`, copied
over a frontend made by `init`): see [Writing the screens](#writing-the-screens).

## The contract

```bash
python manage.py bazis_front contract            # contract/, and the generated files of frontend/
python manage.py bazis_front contract --check    # write nothing; exit 1 if anything is stale
python manage.py bazis_front contract --out DIR  # the contract in another directory
python manage.py bazis_front contract --no-node  # do not run openapi-typescript
```

- The contract is in `contract/` of the product root: `BASE_DIR`, the directory of
  `manage.py` (Bazis sets it from `DJANGO_SETTINGS_MODULE`; `BS_BASE_DIR` overrides it).

### The contract is generated, never edited

**The contract is generated, never edited.** Export it again after every change of the
models, routes, roles, statuses or transits and commit it with the change. The system
check `front.W001` (run by `bazis_doctor`) reports a contract or generated files that
differ from the backend; `--check` does the same in CI.

- The permit roles and the statusy transits are read from the database: export from a
  migrated database. The roles (with their permission groups and permissions), statuses
  and transits are data of the product that `migrate` applies: declared in `roles.py` and
  `workflow.py` of its apps (see [The backend of a product](#the-backend-of-a-product));
  never created by a command or a fixture of the tests only: then every migrated database,
  the one of CI and the one of the end-to-end tests too, gives the same contract.
  An unmigrated database fails the command with `front.E002`, and `front.W001` is skipped
  with the info `front.I001`.
- The files are JSON with sorted keys, two spaces and a trailing newline; the same backend
  gives the same bytes, so the files are compared byte for byte.
- When the product has a frontend made by `init` (`frontend/bazis-front.lock.json`),
  `contract` also writes `frontend/src/bazis/generated/`:
  - `contract.ts`, rendered from `contract.json` by Python: `LANGUAGES` (the languages of
    the backend, `{code, name}`) and `LANGUAGE` (its default language), `ROUTES` (the path of each
    resource by its JSON:API type, with the type `ResourceType`), `RESOURCES` (the
    resources as in `contract.json`), `ROLES` (the permit roles, `[]` without
    bazis-permit), `TRANSITS` (the statusy models, `{}` without bazis-statusy), all
    `as const`, and `CAPABILITIES` (the section of every capability known to bazis-front,
    `null` when the product does not install the package, typed by the interface
    `Capabilities`, so that the frontend compiles with and without each package: check
    for an optional package with `CAPABILITIES.<name> !== null`);
  - `schema.d.ts`, the types of the API (`paths`), by
    `npx --no-install openapi-typescript ../contract/openapi.json -o src/bazis/generated/schema.d.ts --default-non-nullable=false`
    in `frontend/`. It needs Node and the `npm install` of the frontend; without them, or
    with `--no-node`, it is skipped with a warning and recorded as `"missing"` in the lock
    (an existing one stays recorded while the OpenAPI does not change).

  and records in the lock the hashes of the contract files and of the generated files.
  `--check` compares `contract.ts` byte for byte and checks by the lock that `schema.d.ts`
  was generated from the current OpenAPI and not edited; it never runs Node. The system
  check `front.W001` makes the same comparison, also for the generated files.

### `contract.json`

`contract/openapi.json` is `app.openapi()`: every operation of a route set has `x-bazis`
(`resource`, `route_set`, `action`, `kind`). `contract/contract.json`:

```json
{
  "format": 4,
  "generated_by": {"bazis": "2.5.0", "bazis-front": "0.1.0", "bazis-permit": "2.4.1"},
  "openapi_hash": "sha256:…",
  "project": {
    "language": "en",
    "languages": [{"code": "en", "name": "English"}, {"code": "ru", "name": "Русский"}],
    "resources": {
      "tasks.task": {
        "model": "tasks.Task", "route_set": "tasks.routes.TaskRouteSet", "path": "/api/v1/tasks/task/",
        "actions": {"action_list": "collection", "action_retrieve": "item", "action_transit": "other"},
        "fields": {
          "title": {"type": "string", "filter": "title", "order": "title"},
          "dt_created": {"type": "string", "format": "date-time", "filter": "dt_created", "order": "dt_created"},
          "assignee": {"relation": "users.user", "many": false, "filter": "assignee", "order": "assignee"}
        },
        "search": ["title"]
      }
    }
  },
  "capabilities": {
    "users": {"token_url": "/api/openapi-token/", "user_resource": "users.user", "profile_language": false},
    "authing": {"auth_url": "/api/v1/authing/auth/", "logout_url": "/api/v1/authing/logout/", "token_param": "bazis_auth",
                "actions": [{"code": "password", "name": "Login/Password", "method": "POST",
                             "url": "/api/v1/authing/password/"}]},
    "uploadable": {"max_size": null, "resources": ["uploadable.file_upload"]},
    "ws": {"path": "/api/v1/ws"},
    "bg": {"resource": "bg.task"},
    "notify": {"resource": "notify.notification"},
    "async_background": {"result_path": "/api/v1/async_background_response/{task_id}/"},
    "async_request": {"header": "X-Async-Background"},
    "permit": {"roles": [{"slug": "manager", "name": {"en": "Manager", "ru": "Менеджер"}, "for_anonymous": false,
                          "groups": ["tasks_change"], "permissions": ["tasks.task.item.change.all.draft"]}],
               "selectors": {"tasks.task": {"assignee": "users.user", "status_author": "users.user"}}},
    "statusy": {"models": {"tasks.task": {
      "initial": "draft",
      "statuses": [{"id": "draft", "name": {"en": "Draft", "ru": "Черновик"}}, {"id": "done", "name": {"en": "Done", "ru": "Готово"}}],
      "transits": [{"id": "finish", "name": {"en": "Finish", "ru": "Завершить"}, "src": "draft", "dst": "done",
                    "payload": {"required": true, "schema": {"type": "object", "properties": {…}}}}]
    }}}
  }
}
```

- `format`: the version of this format; `generated_by`: the versions of the Bazis
  distributions whose apps the project installs; `openapi_hash`: the hash of what clients
  depend on in the OpenAPI (parameters, bodies, responses, security, `x-bazis` of every
  operation, and the components), not of summaries and descriptions.
- `project.languages` are the languages of the backend (`LANGUAGES`, in their order, with
  their names) and `project.language` its default language (the code of `LANGUAGES` that
  `LANGUAGE_CODE` names: the same code, else the same base code): those the interface may be in.
- `project.resources` is keyed by the JSON:API type. A resource is described by the route
  set that the core uses as the default route of its model; other route sets of the model
  are listed in `other_routes`. `actions` maps the name of each route to its `kind` (a custom action of the route set is
  `other`: `client.action`).
  `fields` are the attributes and relationships of the item response: `type` (and
  `format`) of an attribute (`format: point` for a `PointField` of the model, whose GeoJSON
  object is that of any geometry), `relation` (the JSON:API type) and `many` of a
  relationship, and `reverse: true` for one whose foreign key or many-to-many field is on
  the related model (the steps of a task, the tasks a user watches by the `related_name`):
  written in a create or an update, the core sets it to the items sent and deletes the
  unlinked items of a reverse foreign key that is not null, so a form edits it only when it
  names it;
  `filter` and `order` are the labels for `filter` and `sort`, absent when the field cannot
  be filtered or sorted: they are those the core takes (bazis 2.9), the fields of the LIST
  schema of the route set that can filter or order (`query_fields`), so a field of the item
  schema that the LIST schema does not have has neither. `search` lists the search fields of
  the route set (`search_fields`, as declared) that its LIST schema reaches, those the core
  searches with `search`; empty, the route set has no search, and a `search` is 400
  `ERR_FILTER`. Both are read for the LIST schema of the route set itself: a package that
  narrows it per user (the field permissions of bazis-permit) may refuse a field for some
  users, and `BS_BAZIS_FILTERS_STRICT=false` (transitional) searches a route set without
  search fields anyway; the contract follows the strict scope.

### The sections of the capabilities

- `capabilities` has a section for each installed package whose app is in
  `INSTALLED_APPS` (bazis-ws: its installed package): `users` (the token endpoint, the resource of the user model,
  `profile_language`: whether the user model has a text field `language`, the language of
  the profile that the interface follows; see [The language](#the-language)), `authing`
  (the auth endpoint of bazis-authing, null when it is not routed; the login actions of
  the services of `BAZIS_AUTH_KINDS` as the endpoint lists them in `meta.actions`, in the
  order of the setting, without those whose route is not registered; the logout endpoint
  `logout_url`, null when it is not routed; the query parameter of the store token,
  `BAZIS_AUTH_COOKIE_NAME`), `uploadable` (`max_size`, the
  `BAZIS_FILE_UPLOAD_MAX_SIZE` of an upload in bytes, null for no limit; `resources`, the
  JSON:API types of the route sets of `FileUploadRouteSet` and its subclasses: a to-one
  relationship to one of them is a file), `permit`
  (the roles with the slugs of their permission groups and their effective permissions:
  the union of the permissions of the groups, as bazis-permit checks them for the current
  role of a user; a role has no permissions of its own; `selectors`, the selectors of every
  permission model by its JSON:API type, with the type of their selector source: those of
  `get_selector_fields`, its relations to a selector source, also a many-to-many field and a
  reverse relation by its accessor, which the route set may not show, and `self` when the
  model is a selector source itself), `statusy` (per statusy model: the
  initial status, that of its `Workflow(initial=...)` of bazis-statusy 2.12, else the global
  `BAZIS_STATUS_INITIAL`, the statuses of its transits, the transits with the JSON Schema of the
  payload they require, `null` without one), `ws` (`path`: the path of the socket, that of
  a route of `WsEndpoint` that the application of `bazis.core.app` has, null without one;
  see [The socket](#the-socket)), `bg` (`resource`: the JSON:API type of the route set of `BgRoute`, null
  when it is not routed), `notify` (`resource`: that of `NotificationRouteSet` of
  bazis-notify, null when it is not routed), `async_background` (`result_path`: the path of the result of a
  task with `{task_id}`, null when it is not routed), `async_request` (`header`: the header
  that asks for the background execution, `X-Async-Background`). The names of the roles,
  the statuses and the transits are maps `{language: name}` of every language of
  `LANGUAGES` (their translated fields read in each); the other texts (the OpenAPI, the
  names of the login actions, the payloads) are in `LANGUAGE_CODE`, whatever the language
  of the process; lists are sorted.

## The components

```bash
python manage.py bazis_front add resource-list resource-card resource-form   # the core
python manage.py bazis_front add status-badge status-history transit-bar     # with bazis-statusy
python manage.py bazis_front add file-field                                  # with bazis-uploadable
python manage.py bazis_front add notification-center                         # with bazis-notify (or bazis-ws)
python manage.py bazis_front add live-query                                  # with bazis-ws
python manage.py bazis_front add task-progress                               # with bazis-bg
python manage.py bazis_front add async-result                                # with bazis-async-background
python manage.py bazis_front add map                                         # the points on a map (Leaflet, loaded with the first map): then `npm install`
```

The components are the visual building blocks of the screens: React components on
shadcn/ui and Tailwind 4 over the hooks, in `frontend/src/bazis/ui/<component>/`
(`@/bazis/ui/<component>`). `add` (never a copy by hand) copies them like `init` copies the
hooks (stamped, with
their pristine copies in `.bazis/base/` and their hashes in the lock), with the assets
they require: the other components, the hooks, and the shadcn/ui components they use
(`button`, `input`, `label`, `native-select`, `table`, `badge`, `card`, `dialog`, `popover`,
`sheet`, `skeleton`) in
`src/components/ui/`, where `components.json` puts them. It needs neither the network nor
the shadcn CLI. The template declares the npm dependencies of the components (`radix-ui`,
`class-variance-authority`, `lucide-react`, and `@testing-library/react` with `jsdom` for
their tests); an optional component that brings a library of its own, `map` (Leaflet),
sets it in `package.json` when it is added (`leaflet`, `@types/leaflet`, recorded in its
entry of the lock): run `npm install` then, as `add` says. `update` brings these
dependencies to the versions of the new release without a conflict in `package.json`.

- A component of a package needs its capability in `contract/contract.json` (export the
  contract first): `transit-bar`, `status-badge` and `status-history` need `statusy`,
  `file-field` needs `uploadable`, `live-query` needs `ws`,
  `task-progress` needs `bg`, `async-result` needs `async_background`; `add` fails with the
  missing capability and copies nothing.
- An asset already in the frontend is kept as it is; `add` of it again does nothing when
  it is unchanged. `add` never overwrites: a component named again that was changed in the
  frontend, any asset it needs (also `client` and `react`) that the frontend has in another
  version of bazis-front, or a file of the product at the path of a copy (a shadcn/ui
  component added with the shadcn CLI) fail the command, and nothing is written. So after
  `pip install -U bazis-front`, `add` refuses until `bazis_front update` has brought the
  copies to the new version (see [Updating the copies](#updating-the-copies)).

### The product owns the copies

**The product owns the copies** and changes them freely (the look, the texts, the
layout). Each component comes with its contract test, `<component>.contract.test.tsx`,
run by `npm test` of the frontend: it checks the `data-bz` marks and the states that the
scenarios of the specs rely on. Keep it passing when the component is changed.

- There is no generator of screens: the screens are written in `src/screens/<id>/` from
  their specs, composed from the components (see
  [Writing the screens](#writing-the-screens)).

### Their texts are translated

**Their texts are translated** (see [The language](#the-language)): every text of a
component is a key of the dictionaries of `@/bazis/i18n` (`state.error.title`,
`list.next`, …) in the language of the interface, and a product changes one with the same
key in its own dictionary (`src/i18n/<language>.ts`), never in the copy; the dates and the
numbers are formatted in that language. The labels of the data are the titles of the
runtime schemas and the labels of the choices (in the language the backend answers in),
the names of the statuses and transits of the contract (in every language), and the props.

- They look as the design of the specs says (see [The design](#the-design)): the colors,
  radii and fonts are the tokens (Tailwind classes such as `bg-primary`, `text-muted-foreground`,
  `bg-success-soft text-success-ink`, never literal colors), the spacing is that of the
  density, and the navigation, the lists, the list with its card and the forms follow the
  composition of the preset (`THEME` of `src/bazis/generated/theme.ts`; a prop overrides it).
  The loading states are skeletons of what loads (still `state:loading`), the other states
  an icon with a title and a hint, and a change that succeeded shows a toast.

| Component | What | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel` (the state of a screen or of a part of it, `inline`, with a `skeleton` while it loads), `errorState(error)`, `queryState(query, empty?)`, `SkeletonLines`; `toast({title, description?, tone?})`, `Toaster` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell` (`navigation`: `'sidebar'` or `'topbar'`; `items`: the links, each with its `screen`, `to`, `icon` and `requires`, see [The navigation](#choices-filters-permissions-and-relationships); `session`: null without a login; `tools`: next to the color mode, mounted once; at the foot of the sidebar on a row that wraps, above the session), `Screen`, `ListCardLayout`, `useBesideCard`, `initColorMode`, `ColorModeToggle`, `LanguageToggle` (next to the color mode, with more than one language), `useScreenPage` | `nav:<screen>`, `screen:<id>`, `action:logout`, `action:language` (the current code in `data-value`) | |
| `login-form` | `LoginForm`: the password form with `onLogin`, a button per method of `methods` (a login in a window, with a cancel while it waits) | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource` (shared, copied with the components) | `FieldInput` (the only input of a field of a runtime schema; `path`: its route set, for its point fields), `FieldValue`, `formatValue`, `choiceOptions`, `fieldValue`, `itemLabel`, `permitted(meta, 'add' \| 'change' \| 'delete' \| 'action_<name>', id?)`, `RelationPicker`, `RelationListPicker` (the items of a to-many relationship), `RelationLabel`, `useListFields`, `useItemFields`; the points: `pointOf`, `geoJsonPoint`, `formatPoint`, `parsePoint`, `PointsProvider` | `field:<name>`, `error:<name>` | |
| `resource-list` | `ResourceList` (its `filters`, `filter`, `rowTone` and `rowToneLabel`: see [The filters of a list](#choices-filters-permissions-and-relationships); `layout`: `'table'` or `'cards'`; `compactColumns`: next to a card), `filterOf` | `list:<entity>` (`aria-busy` until its rows are those of its search and page, their search in `data-search`), `row:<id>` (`data-tone` and `aria-description` when highlighted) with its cells `cell:<column>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>` (`state:error` in the bar when its fields cannot be read), `field:$search`, `action:<id>`, `action:prev-page`, `action:next-page` | |
| `resource-card` | `ResourceCard` (`children`: a node or `(item, meta) => node`, `meta` the permission meta of the item, `crud_actions` and `custom_actions`; `forms`: `'dialog'` or `'page'`); `RelatedList`: a related section, its `rowActions`, the card (`itemPath`, `item`) read again after an add, in its `children` or after it, see [Related items](#choices-filters-permissions-and-relationships) | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>`; a related section `list:<entity>` and `action:<add.id>` | |
| `resource-form` | `ResourceForm` (`fixed`: the values the screen sets), `FormSurface` (a dialog or a page, `mode`) | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge` (in the tone of its status), `statusOf`, `statusName(type, id, language?)`, `statusOptions(type, language?)`, `statusTone`, `transitName(type, id, language?)`, `transitTarget` | `status:<id>` | `statusy` |
| `status-history` | `StatusHistory`: the status since `status_dt`, by `status_author` | none | `statusy` |
| `transit-bar` | `TransitBar`: the transits of an item | `transit:<id>`, `state:<loading\|error\|forbidden>`; in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | `statusy` |
| `file-field` | `FileFieldProvider` (`accept` by field, `maxSize`): `FileField` becomes the control of the file fields of `FieldInput` (the forms); `FileField`, `accepts(file, accept)`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads), its errors `error:<name>` | `uploadable` |
| `live-query` | `LiveQuery`: refetches what the messages of the socket say changed (`useLiveQueries`, `ROUTES` and `CAPABILITIES.notify.resource` by default) and shows the state of the socket (the texts `socket.<status>`) | `socket:<idle\|connecting\|open\|rejected\|unavailable>`, `action:reconnect` (unavailable) | `ws` |
| `notification-center` | `NotificationCenter`: a bell with the count of the unread notifications, their list (a click marks one read and opens it, `onOpen`), mark all read, a toast for each new one (`toasts`); `notifications` is `useInbox(ROUTES['notify.notification'])` (bazis-notify) or `useNotifications()` (bazis-ws only, which also has `clear`: forget those of the session); the stored notifications are deleted only with `onDeleteAll={inbox.deleteAll}`, after a confirmation | `action:notifications`, `list:notifications` with `notification:<key>`, `action:read-notifications`, `action:clear-notifications` (`useNotifications`), `action:delete-notifications` and `action:confirm-delete-notifications` (`onDeleteAll`) | none (its source: `notify` or `ws`) |
| `task-progress` | `TaskProgress` (the task of its `id`), `taskView`, `BG_TASKS` (the texts `bg.<view>`); a task with a file (an export) has its download | `bg:<waiting\|running\|success\|error\|interrupted>`, a progress bar per counter, `action:download`, `state:<loading\|error\|forbidden\|not_found>` | `bg` |
| `async-result` | `AsyncResult` (`start`: what `useAsyncRequest` resolved to), `asyncResult(status, response)`, `RESULT_PATH` (the texts `async.<view>`) | `async:<pending\|processing\|completed\|failed>`, `state:<error\|forbidden\|not_found>` | `async_background` |
| `map` | `ResourceMap` (`list.map`: the items with a point in `field`), `MapProvider` (the tiles of the maps, `OSM_TILES` by default, and the map of the point fields of the forms), `nearFilter(field, point, meters)`, `nearSort(field, point, {farthest?})`, `useGeolocation()`, `LeafletMap`, `MapPointControl` | `map:<entity>` (`aria-busy` while it loads) with `marker:<id>`; in a form `map:<field>` and `action:locate-<field>` | npm `leaflet` |

They read what the backend reports and decide nothing: `state-panel` maps the errors of the
backend to the states (401 and 403 `forbidden`, 404 `not_found`, 422 `invalid`, else
`error`) in one place; the fields, their titles and what is read-only come from the
runtime schemas; an action with a `permission` (`add` on a list, `change` or `delete` on a
row or an item) is shown when the permission meta of bazis-permit allows it, and always
when the backend does not report the meta. The shared parts are the asset `resource`
(`FieldInput`, the only input of a field: the forms and the payloads of the transits use
it; `FieldValue`, `RelationLabel`, `RelationPicker`, `RelationListPicker`, `FileValue`, `FilesProvider`,
`permitted`) and `testing` (the support of the contract tests). The `API:` sections list
the exports of each component with their props.

### The status history

**The status history** (`StatusHistory`) is what bazis-statusy exposes: the current
status with `status_dt` and `status_author`. bazis-statusy records every transit
(`<Model>StatusyTransit`) but has no endpoint that reads them, so the earlier transits
are not shown.

## Writing the screens

The screens are written in `frontend/src/screens/<id>/`, from their specs; nothing
generates them. A screen is one primitive (`list`, `card` or `form`) over an entity:
implement it with the route of its spec, from the components of `src/bazis/ui/` (their
`data-bz` in [The components](#the-components), their props in the `API:` sections), and
render every state that it lists. The components decide nothing: pass them the field ids
of the specs and the paths of `ROUTES`.

| Spec | Component |
|---|---|
| a screen (`screen:<id>`, its title, its actions) | `Screen` of `@/bazis/ui/app-shell`; the layout, the navigation (`nav:<screen>`, `navigation` of `spec/design/theme.yaml`) and the logout are `AppShell` in `src/app/router.tsx` |
| `primitive: list` (`columns`, `filters`, `sort`, `search`, `open`) | `ResourceList` of `@/bazis/ui/resource-list` (a filter the backend does not offer the user has no control) |
| `list.filter` (a report), `list.highlight: {field, tone, label}` | `filter={Filter.where('<field>', <value>)}` of `ResourceList` (`Filter.and` for several), combined with the filters of the user: fields that every role that sees the screen may filter by, its link `requires: {path, filters: [<field>]}` (else the list answers 400 to the others); `rowTone={(row) => fieldValue(row, '<field>') === true ? '<tone>' : undefined}` (`fieldValue` of `@/bazis/ui/resource`) and `rowToneLabel={() => t('<label>')}`, the words of the highlight for those who do not see the color |
| `primitive: card` (`sections`, `edit`, `transitions`, `history`) | `ResourceCard` of `@/bazis/ui/resource-card` (only the fields the user may see; with `edit`, those its update does not change marked read-only), with `StatusBadge`, `TransitBar` and `StatusHistory` of `@/bazis/ui/status-badge`, `@/bazis/ui/transit-bar` and `@/bazis/ui/status-history` (bazis-statusy) |
| `card.related` (the items that reference the item, "add here") | `RelatedList` of `@/bazis/ui/resource-card`: `path`, `entity`, `relation`, `item={id}`, `itemPath` (the `path` of the card), `columns`, `add={{id, label, fields}}` (the create form with the relationship fixed; leave it out while the item takes no more of them: `permitted(meta, 'change')`). In the `children` of the card it is drawn under the heading, above the sections of fields; a list that follows the fields goes after the card ("Composing beyond the specs"). Both read the card again after an add |
| a field with choices (a column, a field of a card or a form, a filter) | nothing to do: the components show, offer and filter it by the labels of its choices (`enumDict` of the runtime schemas, in the language of the interface) |
| the notifications and the live updates (bazis-notify, bazis-ws) | `NotificationCenter` of `@/bazis/ui/notification-center` (its `notifications`: `useInbox` with bazis-notify, else `useNotifications`) and `LiveQuery` of `@/bazis/ui/live-query` in the `tools` of `AppShell`, under `SocketProvider` ("The socket") |
| a background task (bazis-bg), a background request (bazis-async-request) | `TaskProgress` of `@/bazis/ui/task-progress` (by the id of the task), `AsyncResult` of `@/bazis/ui/async-result` (what `useAsyncRequest` resolved to) |
| a field `type: file` (bazis-uploadable) | shown by the components (its name downloads it, a thumbnail of an image, both read with the token from its download route); edited in the forms by `FileField` of `@/bazis/ui/file-field` once `FileFieldProvider` wraps the routes ("Files, points and maps") |
| a field `type: point`, `list.map: {field}` | shown as its coordinates (`55.7558, 37.6173`) and edited as them in the forms, on a map too once `MapProvider` of `@/bazis/ui/map` wraps the routes; `ResourceMap` of `@/bazis/ui/map` beside the `ResourceList` of the screen, with its `filter` ("Files, points and maps") |
| an action of the backend that is no CRUD (an export, a report: a custom action of the route set) | a button calling `useAction(path, '<name>')` of `@/bazis/react`, its error in `StatePanel`, the task of bazis-bg it queues in `TaskProgress` ("Custom actions and background work") |
| `primitive: form`, an action `primitive: form` | `ResourceForm` of `@/bazis/ui/resource-form` (`fields`, then `onSaved` for `then`), an action in `FormSurface` of the same asset (a dialog or a page, as the theme composes the forms) |
| `list.open` (the card of a list) | the card route as the child of the list in `ListCardLayout` of `@/bazis/ui/app-shell` (`composition.list_card`), the open row `selected` |
| an action `primitive: destroy` | an action of the card (`permission: 'delete'`) calling `useDestroy` |
| `states` | the components render them (`state:<state>`); `StatePanel` of `@/bazis/ui/state-panel` for a screen of your own |

```tsx
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useDestroy } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { permitted } from '@/bazis/ui/resource';
import { RelatedList, ResourceCard } from '@/bazis/ui/resource-card';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { toast } from '@/bazis/ui/state-panel';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';
import { StatusHistory } from '@/bazis/ui/status-history';
import { TransitBar } from '@/bazis/ui/transit-bar';
import { Button } from '@/components/ui/button';

const TASKS = ROUTES['tasks.task'];

// spec/screens/task-list.yaml
export function TaskListScreen() {
  const navigate = useNavigate();
  const { id } = useParams();   // the task open next to the list (`list_card: split`)
  const [creating, setCreating] = useState(false);
  return (
    <Screen id="task-list" title="Tasks" description="The tasks of the team.">
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'assignee', 'dt_created']}
        filters={[{ field: 'status', options: statusOptions('tasks.task') }, 'assignee']}
        sort={['-dt_created']}
        search
        selected={id}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
        actions={[{ id: 'create', label: 'New task', icon: Plus, permission: 'add', onClick: () => { setCreating(true); } }]}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
      />
      {/* a dialog or a page, as `composition.forms` of the theme says */}
      <FormSurface open={creating} title="New task" description="The task is created as a draft." onClose={() => { setCreating(false); }}>
        <ResourceForm
          path={TASKS}
          fields={['title', 'assignee']}
          onSaved={(saved) => { setCreating(false); void navigate(`/tasks/${saved.data.id}`); }}
          onCancel={() => { setCreating(false); }}
        />
      </FormSurface>
    </Screen>
  );
}

// spec/screens/task-card.yaml
export function TaskCardScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const destroy = useDestroy(TASKS);
  return (
    <Screen id="task-card" title="Task" actions={<Button asChild variant="ghost" size="sm"><Link to="/tasks">All tasks</Link></Button>}>
      <ResourceCard
        path={TASKS}
        id={id}
        edit
        sections={[{ id: 'main', title: 'Details', fields: ['title', 'status', 'assignee'] }, { id: 'report', title: 'Report', fields: ['report'] }]}
        badge={(item) => <StatusBadge resource={item} />}
        actions={[{
          id: 'delete', label: 'Delete', permission: 'delete', variant: 'destructive',
          onClick: () => { destroy.mutate(id, { onSuccess: () => { toast({ title: 'Deleted' }); void navigate('/tasks'); } }); },
        }]}
      >
        {(item, meta) => (
          <>
            {/* null: the user can no longer view the item */}
            <TransitBar path={TASKS} id={id} onDone={(done) => { if (done === null) void navigate('/tasks'); }} />
            <StatusHistory resource={item} />
            {/* `card.related`: the steps of the task, added here with the task fixed */}
            <RelatedList
              path={ROUTES['tasks.step']}
              entity="step"
              relation="task"
              item={id}
              itemPath={TASKS}
              title="Steps"
              columns={['title', 'dt_created']}
              add={permitted(meta, 'change') ? { id: 'add-step', label: 'Add a step', fields: ['title'] } : undefined}
            />
          </>
        )}
      </ResourceCard>
    </Screen>
  );
}
```

### The routes and the navigation

Add the routes of the screens to `src/app/router.tsx` (inside `RequireSession`), each screen
imported with `lazyScreen` of `src/app/lazy.tsx` as those of the template (its own chunk,
loaded when its route is first shown, under the `Suspense` and the `ErrorBoundary` of the
layout: a static import puts every screen and the libraries it uses, a map, in the one
bundle that every page loads). A chunk that fails to load (a new version deployed since the
page was opened) reloads the page, at most once in 30 s (the time of the reload in
`sessionStorage`; never when the storage is blocked), else shows the error, whose retry loads
it again:

```tsx
const TaskListScreen = lazyScreen(() => import('@/screens/task-list').then((module) => module.TaskListScreen));
```

The screens of the users who do not log in (an `anonymous` role of the specs) are routes
outside `RequireSession`, which sends a user without a session to the login: in a layout of
their own, `AppShell` with their links and `session={null}` (a link to `/login` in its
`tools`), its `ErrorBoundary` and `Suspense` as in `RequireSession`, and their screens
read only what the backend gives anonymous users (a 401/403 of another route is the
`forbidden` state of a screen, never a redirect).

The npm libraries that every page loads (React with the router, TanStack Query, the Radix
primitives of the layout) are chunks of their own, listed by package in `manualChunks` of
`vite.config.ts`, so that the chunk of the entry holds the code of the product: a library
that one screen needs is imported by that screen and stays in its chunk (never add it to the
list); never raise `chunkSizeWarningLimit` to hide a large chunk.

Add their
links, with an icon of `lucide-react`, to `NAVIGATION` there. A link shown only to the users
that the backend allows names what it `requires`, and `AppShell` shows it once the backend
answers (the screens read the same queries: no request of its own):

```tsx
{ screen: 'task-list', label: 'nav.tasks', to: '/tasks', icon: ListChecks, requires: { path: TASKS } },   // may view
{ screen: 'task-new', label: 'nav.new', to: '/tasks/new', icon: Plus, requires: { path: TASKS, can: 'add' } },
{ screen: 'overdue', label: 'nav.overdue', to: '/overdue', icon: AlarmClock, requires: { path: TICKETS, filters: ['is_overdue'] } },
```

`useCan(path, 'view' | 'add')` of `@/bazis/react` gives the same answer to a screen of your
own. The card of a list is the
child route of the list in `ListCardLayout` of `@/bazis/ui/app-shell`, which shows it next to
the list or in its place (`composition.list_card` of the theme):

```tsx
<Route path="tasks" element={<ListCardLayout list={<TaskListScreen />} />}>
  <Route path=":id" element={<TaskCardScreen />} />
</Route>
```

## Composing beyond the specs

The props of every component are in the `API:` sections (the `Props` types of
`src/bazis/ui/`).

- a section of your own in a card: `children` of `ResourceCard` is `(item, meta) => …`,
  the item and its permission meta (`permitted(meta, 'change')` of `@/bazis/ui/resource`,
  from `crud_actions`), without a second `useItem`; it is drawn under the heading, above
  the sections of fields. Sections that follow the fields (the related lists of a long
  card) go after `ResourceCard` in the `Screen`, with the meta of
  `useItem(path, id, {meta: ['crud_actions', 'custom_actions']})`: the query of the card
  (the same key, the meta that the card asks for), not a second request; a `RelatedList`
  there reads the card again after an add as in the `children`;
- the rows of `useList` are typed by `schema.d.ts` (`row.attributes.title`); the rows that
  `ResourceList` gives `cells`, `rowTone` and `onOpen` are plain resource objects: read a
  field there with `fieldValue(row, '<field>')` of `@/bazis/ui/resource` (an attribute, or
  the id of a to-one relationship), never with a cast;
- a to-many relationship (the interviewers of an interview, the participants of a
  booking) is a field of the forms like any other: `ResourceForm` edits it with
  `RelationListPicker` and sends it with the item (see "To-many fields" in
  [Choices, filters, permissions and relationships](#choices-filters-permissions-and-relationships)),
  never write a form of your own for it. A button that adds or removes one item without a
  form (on a card) calls `useRelationship(path).mutate({id, field, operation: 'add' |
  'remove' | 'replace', data: [{type, id}]})`, the item chosen with `RelationPicker({relation,
  value: null, onChange})` of `@/bazis/ui/resource` (it offers the users that the user route
  set shows: see "The users that the pickers offer"); its errors are all in `formErrors()`
  (`FormError`: `message`, and `included`, `field` of an included item, null otherwise);
- the label of a related item (`RelationPicker`, `RelationListPicker`, `RelationLabel`) is
  its display name, else an identifier (see "The label of an item" below); as a text
  (`t('booking.of', {name})`: `{name}` is the parameter `name`), `itemLabel` of
  `@/bazis/ui/resource` of `useRelatedItem(ROUTES[type], id).data`;
- a status: `StatusBadge` in `cells` of a list and in `badge` of a card, the options of its
  filter `statusOptions(type)`, as in the example above;
- a form of your own (a step of the form of a wizard): `useResourceForm(path, {id?, fixed?})`
  with a `FieldInput` of `@/bazis/ui/resource` per field (`field`, `value`, `onChange`,
  `errors`: the control by the type, the choices by their labels, the picker of a
  relationship, of the items of a to-many one), as `ResourceForm` does; a value the screen
  sets is `fixed`, never set by an effect. The steps of the scenarios drive it through its
  marks: a `<form>` with a submit button `action:submit`, the controls of `FieldInput`
  (`field:<name>`) and their errors (`error:<name>`), the other errors of `submitError` in
  `StatePanel` (`state:invalid`); see "A form of your own" in
  [The end-to-end tests](#the-end-to-end-tests);
- numbers and dates in a text of your own: `formatNumber(value, language, options?)`
  (`{style: 'currency', currency: 'RUB'}`), `formatDecimal` (a `DecimalField`, a string of
  the API: a sum, a price), `formatDate`, `formatDateTime` of `@/bazis/i18n`;
- a related item that the user may not view (the author of a message for a client) is
  null in `useRelatedItem`, and `RelationLabel` shows its id: show something of your own
  for null, never request it otherwise;
- the labels of the payload of a transit (`TransitBar`) are the `title` of its fields in
  the runtime schema (`Field(title=_('…'))` of the payload in the backend, in the language
  of the request), else their names;
- an error of a query is returned (`query.error`), never thrown: a refusal (4xx) is not
  retried, a failure of the server or of the network up to three times
  (`createQueryClient` of `src/app/providers.tsx`), a 401 ends the session; show it with
  `StatePanel` (`errorState`).

## Choices, filters, permissions and relationships

### Choices are shown by their labels

**Choices are shown by their labels.** A model field with `choices` is an attribute with
`enum` (the values) and `enumDict` (their labels, translated into the language of the
request) in the runtime schemas; `resourceSchema` reads them as `enum` and `labels` of the
field (`choiceLabel(field, value)` of `@/bazis/react`). `FieldInput` offers them as a select
of the labels (it sends the value), `FieldValue` (the cells of the lists, the values of the
cards) shows the label, and the filter of such a field is a select of its labels
(`choiceOptions`, from the list schema) that filters by the value. Translate the labels in
the backend (`TextChoices` with `gettext_lazy`, the catalogs of the project); never make a
model of the choices for their labels, nor map the values to texts in the frontend. The
scenarios fill, find (`open_item`) and expect a choice by its label in the default language
of the backend (`fill: {priority: High}`).

### Related items, "add here"

**Related items, "add here"**: the items of another resource that reference the item of a
card by a to-one relationship (the items of a request, the steps of a task) are a related
section of the card, `RelatedList` in its `children` or after it (`card.related` of the spec): their
list filtered by the relationship, and `add`, the button `action:<add.id>` that opens the
create form of the related resource with the relationship fixed to the item
(`ResourceForm` `fixed={{request: id}}`: the value is sent, never chosen; a fixed field is
left out of the form, or shown read-only when `fields` names it). `add` is shown when the
backend allows the create (`for_create` of the list); leave it out while the item takes no
more related items (`add={permitted(meta, 'change') ? {...} : undefined}`, the `meta` of
the card), and refuse them in the backend too (`validate_item`, see
[The backend of a product](#the-backend-of-a-product)). A form of your own uses
`useResourceForm(path, {fixed})` the same way; never set the value with an effect.

### The card follows its related items

**The card follows its related items**: a related item added often changes the item of the
card (a computed total, the transits it allows, the fields its status leaves editable).
`RelatedList` reads the item of the card again once an item is added, wherever the screen
places it, in the `children` of `ResourceCard` or after it: `itemPath` and `item` name the
item of the card (`useRefreshItem(itemPath, item)` of `@/bazis/react`: the retrieves of the
item, its schemas, its GET actions; the queries of the related resource are refetched by the
create itself). An action of its rows does the same itself, with `useRefreshItem` of the
card. `rowActions` are the actions of its rows (`{id, label, onClick(rowId), permission:
'change' | 'delete'}`, a button `action:<id>` in a row the backend allows it on):

```tsx
const refresh = useRefreshItem(REQUESTS, id);           // in the screen, the item of the card
const destroyLine = useDestroy(LINES);
// in the RelatedList of the lines of the request
rowActions={[{ id: 'delete-line', label: t('line.delete'), permission: 'delete',
  onClick: (line) => { destroyLine.mutate(line, { onSuccess: () => void refresh() }); } }]}
```

This covers the changes made in the page. A change made elsewhere (another user, a
background task) reaches the card through the socket: the backend publishes the item changed
(`publish_changed(item)` of bazis-ws, also from the save of a related item that changes it;
see [The socket](#the-socket)) and `useLiveQueries` refetches its resource.

### The filters of a list

**The filters of a list** (`filters`): a control per field, by its type in
`route_filter_fields/` (`py_type`): a select of `options` (the statuses:
`statusOptions(type)`; the choices of a field with choices by default) or of yes/no for a boolean, the picker of a relationship, a range
of dates (`<field>__gte`, `<field>__lte`) for a date or a date-time, a number, else a text
whose every word must be in the field (`<field>__$search`); one `filter` expression
(`filterOf`). A field that the backend does not list for the user (hidden by his field
permissions, whose filter it answers with 400) has no control; when the fields cannot be
read (5xx, no network) the bar shows its error (`state:error`), the rows stay. `filter`
is the filter of the screen itself (`list.filter` of the spec, a report): combined (AND)
with those of the user, and its empty list shows `emptyMessage` (the filters of the user:
"nothing matches"). **Its fields must be fields that every user who sees the screen may
filter by**: the backend answers the list of another user with 400 (a field hidden from
him), so guard the link of the screen with `requires: {path, filters: [<its fields>]}`.
`rowTone(row)` highlights a row in a tone of the theme (`list.highlight`: `(row) =>
fieldValue(row, '<field>') === true ? '<tone>' : undefined`), never with classes of the
product, and `rowToneLabel(row)` says it in words (its `label`, `t(label)`): the
`aria-description` of the row, never the color alone.

### The navigation follows the backend

**The navigation follows the backend**: a link with `requires` is shown once the backend
allows the user what it requires, never by his role in the frontend: `{path}` (the route
set of the screen) that he may view its items, `can: 'add'` add one (`useCan(path,
'view' | 'add')` of `@/bazis/react`: the runtime schema of the list or of the create,
which bazis-permit refuses with 403 without a permission of the model for the action;
the screens read the same queries, so no request is made for the links alone), `filters`
that the backend lets him filter its list by these fields (`route_filter_fields/`: a
report by a field hidden from him). A link without `requires` is always shown.

### Field permissions

**Field permissions** (bazis-permit, `<app>.<model>.field.<operation>.<selector>[.<status>]
.<field>.<restriction>`: `enable`, `readonly`, `disable`…) are read from what the backend
returns for the current user and the item (they depend on its selectors and its status),
never from the roles: a field the user may not
see is absent from `schema_retrieve/` of the item and from the documents; one they may
see but not change now is `readOnly` in `schema_update/` of the item. `ResourceCard`
shows only the fields of `schema_retrieve/` (and leaves out a section without any) and,
when the user may change the item, marks read-only the fields its update does not
change; `ResourceForm` leaves out the fields its schema does not have and disables the
read-only ones; `ResourceList` shows a column when a row of the page has its field (the
schema of a list is the union of the field sets of the groups of permissions: its first
member has all the fields any row can show). Check them in the scenarios with `expect: {field_readonly}` and
`expect: {field_absent}`.

### Relationships

**Relationships**: `RelationPicker` (a to-one relationship in a form, a payload, a filter)
is a combobox over the list of the related resource, read page after page (`Load more`),
that clears a nullable value: choose a related item with it, never with a list of every
item. It searches the backend (`search`) only when the route set
of the related resource has search fields (`search` of the resource in the contract; the
prop `searchable` overrides it): the core answers a search of a route set without
`search_fields` with 400 `ERR_FILTER` (bazis 2.9), so without them the picker lists the
items without a search box, and `check` warns of such a picker (S012). **Give the route
sets that the pickers list `search_fields`** (fields of their LIST schema, such as
`username`); `RelationLabel` shows a related item, the
items of a resource shown together (the rows of a page) read with one request
(`useRelatedItem`, `filter=pk=<a>|pk=<b>|…`; a skeleton marked `state:loading` until then,
which the helpers of the end-to-end tests wait for). Both need the route of the related
resource in `ROUTES`; the user sees the items its list returns to them. An item that the
user may not view (the list leaves it out: an agent for a client) is null there, and both
show its id (the start of a long one); never request it otherwise.

### The label of an item

**The label of an item** in the pickers and in `RelationLabel` is its display name, else an
identifier: the first non-empty of `name`, `full_name`, the first and the last name
together (`first_name` and `last_name`, as `get_full_name()` of the users of Django and
bazis-users: a user with names is `Ann Lee`, one without them his username), `title`,
`username`, `email`, `slug`, `code` (`itemLabel` of `@/bazis/ui/resource`), else its id
(the start of a long one). Show these attributes in the LIST schema of the related route
set (the user route set of bazis-users shows the names), and give it `search_fields` that
cover them (`['username', 'first_name', 'last_name']`: every word of a search is in one of
the fields; `check` warns of a picker whose search does not cover them, S017): the pickers
and the scenarios find an item by its label. A name that the
model computes is the field `full_name` of its route set (`@calc_property`, "Calculated
fields" of the guide of the core), never a label made in the frontend. The label as a text (a parameter of a message, `t('booking.of', {name})`) is
`itemLabel` of the item of `useRelatedItem(ROUTES[type], id)`.

### To-many fields

**To-many fields** (a many-to-many field of the model, also through a model of its own:
the interviewers of an interview, the moderators of a venue; `many: true` in the contract
and in the entity of the spec) are fields of the forms like the others: `ResourceForm` and
`FieldInput` edit them with `RelationListPicker` of `@/bazis/ui/resource`, the list of
`RelationPicker` (its search, its pages) in which a click or Enter adds or removes an item
and that stays open (Escape closes it; the option with the placeholder, `data-value=""`,
removes every item), the labels of the items on its button. The form sends the
relationship with all its items, `{data: [{type, id}, …]}` (none: `[]`), with the other
fields in the create or the update, and the backend sets it to these in the same
transaction (`validate_item` sees them; optional with `blank=True` on the model, required
otherwise; read-only when the user may not change it). The relationship is sent only when
the user changed it, and then whole, as the user saw it when the form opened: as for any
other field the last save wins (an item linked meanwhile by someone else is removed by it);
the items the user may not view are in the document all the same (their ids on the button)
and are kept. The button shows the labels of the first 8 items, then `+N`. A reverse
relationship (`reverse` in the contract: the foreign key on the related model, such as the
steps of a task) is left out of a form without `fields`: the core deletes the related items
that it unlinks; a form edits it only when its `fields` name it. Name the field in the `fields` of
the form of the spec, and fill it in the scenarios with the labels of its items:
`fill: {interviewers: [Ann Lee, Bob Stone]}` replaces those it had, `[]` removes them all.
A form of your own takes the ids of the items as the value of the field
(`useResourceForm`).

### The users that the pickers offer

**The users that the pickers offer** are those that the default user route set shows and
lets link: bazis-users (2.9) shows and links to a user who is not staff only himself, in its
list and items (`get_queryset`) and in the relationships of the other routes
(`restrict_queryset`: 403 `ERR_RELATION_ACCESS` for another user). A product whose users pick
each other (the interviewers of an interview, the assignee of a task) declares its user route
set (`<app>/routes.py`, a subclass of that of bazis-users, routed or the default route of the
user model) whose `restrict_queryset` lets a signed-in user view and link the users he picks
(`CrudAccessAction.VIEW`: the team, the users of his organization) and whose `get_queryset`
shows them in its list and items (the picker and the labels read them there), while its
updates and deletes keep the rule of bazis-users (`super().get_queryset()` for a route other
than `collection` and `item`, `self.route_ctx.kind`); the sample of bazis-front does it,
`sample/users/routes.py`. Never widen the frontend instead: the backend refuses the users it
does not let link. `useRelationship` changes one item outside a form (see
[Composing beyond the specs](#composing-beyond-the-specs)).

## Files, points and maps

### Files

**Files** (bazis-uploadable): a model references an uploaded file with a foreign key to
`uploadable.FileUpload`; its field is a to-one relationship to `uploadable.file_upload`
(a resource of `resources` of the capability `uploadable`), `type: file` in the specs.
`FieldValue` shows it (`FileValue`: its name, a button that downloads it, its size, a
thumbnail of an image, read with the retrieve of the route set) in the cards and the
lists. The content (the download, the thumbnail) is read with the token from
`<files>/{id}/download/` (`useDownload`, `useDownloadUrl`), never from the `file` URL of
the media host, which serves it to anyone who has the link; the file of
another user, which bazis-uploadable does not give (a 404), is `file:unavailable`
("File not available"). In the
forms, with `FileFieldProvider` around the routes (`src/app/router.tsx`), `FieldInput`
edits it with `FileField`: a drop zone and a picker, the file uploaded at once with its
progress and a cancel (one file at a time: another one is not taken while it uploads),
its id set as the value of the relationship, a replace and a
remove (when the relationship is nullable); a file larger than `max_size` of the
contract, or of a type that `accept` refuses, is not sent, and the 413
`ERR_FILE_TOO_LARGE` of the backend is the error of the field; `ResourceForm` is not
submitted while a file uploads. Without the provider the field is the picker of a
relationship. The payloads of the transits have no files (a payload has no
relationships).

With bazis-uploadable, `manage.py bazis_front add file-field` and wrap the routes in
`FileFieldProvider`, so that the forms upload the files of their file fields (without it a
file field is the picker of the uploaded files); `accept` limits the types of a field, the
size limit is `max_size` of the contract:

```tsx
import { FileFieldProvider } from '@/bazis/ui/file-field';

<FileFieldProvider accept={{ avatar: 'image/*' }}>
  <BrowserRouter>…</BrowserRouter>
</FileFieldProvider>
```

### The uploaded files belong to their author

**The uploaded files belong to their author** (bazis-uploadable 2.6.0): the bundled
`FileUploadRouteSet` (`bazis.contrib.uploadable.router`) requires a user, makes the user
who uploads a file its `author`, lists and retrieves only his own files and changes or
deletes none: route it as it is (the sample does), a subclass is no longer needed. The
frontend needs its create (the upload) and its retrieve (the file of a field); the file
of another user is a 404, which `FileValue` shows as not available.

### The files of the others are neither linked nor included

**The files of the others are neither linked nor included** (bazis 2.7.0 with
bazis-uploadable 2.6.0): the core links only the objects that the default route of the
related model shows the user, so a relationship to a file the user did not upload fails
with 403 `ERR_RELATION_ACCESS` on a create, an update (the pointer
`/data/relationships/<field>`, the error of the field in the forms) and the relationships
endpoint (`/data`, the body of the request), and
`include` leaves the file out (the relationship keeps its id). The route set of a model
that references files needs no check of its own (`TaskRouteSet` of the sample has none),
but must know the user (`UserRouteBase`, `UserRequiredRouteBase`, or a route set of
bazis-permit or bazis-statusy): on a route without a user even his own file is refused.
A product that shares the attachments of shared items widens `restrict_queryset` of a
subclass of `FileUploadRouteSet` with `default_route = True` (the guide of
bazis-uploadable). The section `uploadable` lists only the route sets with their create.

### Points and maps

**Points and maps**: a `PointField` of a model is GeoJSON in the API, `{"type": "Point",
"coordinates": [<longitude>, <latitude>]}` (the core gives every geometry as the same
object; the contract tells a point by its model field: `format: point`, `type: point` in
the specs). `FieldValue` shows it as its coordinates, `55.7558, 37.6173` (latitude first,
a dot in every language, as maps write them); `FieldInput` of a form (`ResourceForm` gives
it its `path`) edits it as that text (also `55,7558; 37,6173` or `55,7558 37,6173` with a
decimal comma; sent as GeoJSON once it is a point, as the text otherwise, which the backend
refuses at the field), and with `MapProvider` around the routes also on a map: a click
places the point, `action:locate-<field>` places the position of the browser. A point in
the payload of a transit (`TransitBar`: the payload is no resource, its fields have no
route set) is edited as its GeoJSON; give a transit a payload of numbers instead when the
user types it. `bazis_front add map` copies the maps and sets Leaflet in
`package.json` (a version of Leaflet that the product set itself is kept, by `add` and
`update`, and reported); `ResourceMap` is `list.map` of a screen, beside its `ResourceList` with the
same `filter`: a marker per item with a point (`marker:<id>`, a button named and titled
by its label, which the keyboard reaches: Enter or Space opens it like a click,
`onOpen`), the open item `selected` (drawn larger; the view is fitted to the points when
they change, never when another one is selected). The list beside it stays the way of the
items for every user: a map without a list is no screen of the specs. **The tiles** are those of
`MapProvider tiles` (`{url, attribution, maxZoom?}`, a setting of the product such as
`MAP_TILES` in `src/app/product.ts`); the default, OpenStreetMap with its attribution, is
for development and light use under its tile usage policy: a product in production sets
the tiles of its provider (and allows their host in its Content Security Policy,
`img-src`). **What is near**: `useGeolocation()` asks the browser for its position (never
saved in the profile: a field of the user that others may read leaks it),
`nearFilter(field, position, meters)` is the filter of the items within that distance
(`<field>__near=<lon>,<lat>,<meters>`) and `nearSort(field, position)` the order by the
distance, the nearest first (`<field>__distance(<lon>,<lat>)`), for `filter` and `sort`
of `ResourceList` and `ResourceMap` (a new `sort`
of the screen, once the position is known, replaces the order the user chose). The point
field must be in the LIST schema of the route set; declare it `geography=True` (the GiST
index of the distances). Never store a point as two numbers (no index, no lookup of the
core), and never filter a list by a point with a control of the filters (S016).

The maps: `manage.py bazis_front add map`, then `npm install`. Wrap the routes in
`MapProvider` with the tiles of the product, a setting of `src/app/product.ts`; a screen with
`list.map` shows `ResourceMap` beside its list, and a list of what is near the user filters
by the distance from the position of the browser:

```tsx
// src/app/product.ts
export const MAP_TILES: MapTiles = { url: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: '&copy; Example' };

// src/app/router.tsx: the maps draw these tiles, the point fields of the forms get a map
<MapProvider tiles={MAP_TILES}>
  <BrowserRouter>…</BrowserRouter>
</MapProvider>

// spec/screens/site-list.yaml (`list.map: {field: location}`)
const geolocation = useGeolocation();   // locate() asks the browser
const position = geolocation.position;
const near = position ? nearFilter('location', position, 5000) : undefined;
// the nearest first, once the position is known
const sort = position ? [nearSort('location', position)] : ['name'];
<ResourceMap path={SITES} entity="site" field="location" filter={near} sort={sort} me={position} selected={id} onOpen={(site) => void navigate(`/sites/${site}`)} />
<ResourceList path={SITES} entity="site" columns={['name', 'address']} filter={near} sort={sort} selected={id} onOpen={…} />
```

The responses carry no distance: show it from both points if the screen needs it.

## Custom actions and background work

### Custom actions

**Custom actions** (a route of a route set declared with `@http_post('/<name>/')`, kind
`other` in `actions` of the contract: an export, a report, a recount): call them with
`useAction(path, '<name>')` of `@/bazis/react` (`mutate(body)`; `useItemAction` for
`<path><id>/<name>/`, `method` for another method than POST), typed by `schema.d.ts`
(an action declared with `@http_get` that a screen shows is read with `useActionQuery`
or `useItemActionQuery`, a query refetched with its resource, never a query of your own):
a name or a body the backend does not have does not compile. The mutation refetches the
resource after it (`invalidate: false` for an action that changes nothing); its `error`
is the `ApiError` (`StatePanel` `errorState(error)`), and `errors` gives the errors of its
body by field (the core points them to `/<field>` of a JSON body: `ApiError.bodyErrors()`).
An action that queues a task of bazis-bg answers with its id: show it with `TaskProgress`
(`<TaskProgress id={action.data.task} />`). The arguments of an action that are neither in
its path nor in its body (`code: str`, `year: int | None = None`; a list with `Query()`)
are its query parameters: `useActionQuery(path, '<name>', {query: {code}})` (and
`useItemActionQuery`, `client.action(path, name, undefined, {method: 'get', query})`), typed
by its OpenAPI (`query` is required when a parameter is) and in the key of the query, nothing
read while `query` is null. A check that
changes nothing (of a code, of a period) is a GET with a query read when the form is
submitted, not a POST made for want of a query; a secret (a password, a token) never goes in
a query, which the logs of the servers keep: it is the body of a POST. Never `fetch` an
endpoint of the backend by hand: the client sends the token and the language of the session, and turns the errors
into `ApiError`. Offer the button of an action to the users the backend lets call it, from
`custom_actions` of bazis-permit 2.11 (the names of `actions` of the contract, `action` of
`x-bazis`): an action of the collection with `useCan(path, 'action_<name>')`, an action of
an item with `permitted(meta, 'action_<name>')` (the `meta` that `ResourceCard` gives its
children, which requests it) or `can(meta, 'action_<name>')` of the client with
`meta: ['custom_actions']` of your own `useItem`. Never a field of your own such as
`can_report`. It reports what the action declares (`public`, `access_action`), not a check
in the code of the action, which still answers 403 or 422; the transits of bazis-statusy
are `state_actions` (`TransitBar`).

A custom action of a route set (`@http_post('/export/')` in the backend, `action_export:
"other"` in the contract) that queues a task of bazis-bg, its errors and its task:

```tsx
const exporting = useAction(ROUTES['service.work_order'], 'export', { invalidate: false });
<Button data-bz="action:export" disabled={exporting.isPending} onClick={() => { exporting.mutate({ date_from, date_to }); }}>…</Button>
{exporting.errors.date_to && <p data-bz="error:date_to">{exporting.errors.date_to.join(' ')}</p>}
{exporting.isError && <StatePanel inline state={errorState(exporting.error)} error={exporting.error} />}
{exporting.data && <TaskProgress id={exporting.data.task} />}
```

A check declared with `@http_get('/check/')` and an argument `code: str` (a query
parameter), read once the form is submitted:

```tsx
const [code, setCode] = useState<string | null>(null); // the submitted code
const check = useActionQuery(ROUTES['events.registration'], 'check', { query: code === null ? null : { code } });
<form onSubmit={(event) => { event.preventDefault(); setCode(new FormData(event.currentTarget).get('code') as string); }}>…</form>
{check.isError && <StatePanel inline state={errorState(check.error)} error={check.error} />}
{check.data && <p data-bz="field:valid">{check.data.valid ? t('check.valid') : t('check.invalid')}</p>}
```

### Background work

**Background work**: `TaskProgress` shows a task of bazis-bg whose id the endpoint of the
product that queued it returned (`delay(author=user)`; a user reads only their tasks),
read until it is done; the traceback of a failure is not shown; a task with a file (an
export) has `action:download`, read with the token from `<tasks>/{id}/download/` (bazis-bg
2.6), never from its `file` URL. `AsyncResult` shows the
result of `useAsyncRequest` (bazis-async-request) or of a task of
bazis-async-background (`{status: 'queued', taskId}`), read until it is done; a request
that the backend ran at once (no Kafka) is completed at once, and an HTTP error of the
replayed request is a failure.

## The socket

bazis-ws delivers the messages that the backend publishes to the channel of a user
(`user_ws::<pk>`), to the channel of an anonymous token (`user_ws:anon:<token>`, from
`get_anonymous_channel`) and to every user session (`COMMON_CHANNEL`, `user_ws:common`).
The backend publishes the formats below with the helpers of `bazis.contrib.ws.messages`:
`notify(users, lambda user: notification(title, text, item))` (to each user, in his
language) and `publish_changed(item)` (the hint of its resource on the common channel),
both after the commit and robustly. The facts that the hooks rely on:

### Route the socket where the contract sees it

**Route the socket where the contract sees it**, in the module of
`BS_BAZIS_ROUTER_MODULE`: `router.register('bazis.contrib.ws.router')` (the socket under
the prefix of the router, `/api/v1/ws`), or on the application of `BAZIS_APP_MODULE`. The
export imports `bazis.core.app`, never the main module of the project: a socket registered only there (as the guide of bazis-ws
shows) is not known, and `ws.path` is null (`check` reports it when `packages` has `ws`:
P028). bazis-ws is not a Django app and bazis-async-background installs it: the section
`ws` is there whenever the package is, with a null path when nothing routes the socket,
and the frontend then opens none.

### The connection and the token

- The socket is at `CAPABILITIES.ws.path`, as it is routed (`/api/v1/ws` or `/ws`; the dev
  server of the template proxies it, under `/api` too). The token is sent in the first message
  (`{"token": "<token>"}`), never in the URL: a session JWT of bazis-users (`exp` and `sub`
  required: a token without `exp` is refused) subscribes to the channel of its user and to
  the common channel, any other token of 16–128 characters `A-Z a-z 0-9 _ -` to its
  anonymous channel only. The server accepts the connection before it takes the token, and
  sends `{"type": "subscribed"}` once the subscription of the session is active: the socket
  is `open` only then (bazis-ws 2.5.0). A refused token is
  `{"type": "error", "code": "expired_token" | "invalid_token" | "user_not_found"}` and a
  close with 1008: the socket is `rejected`, and the hooks wait for another token (a new
  login); `internal_error` is followed by a close with 1011, as a failure of Redis. A close
  (1011, also right after the session started) is retried after 1 s, doubling up to 30 s, and the backoff starts again only
  after a connection that lasted 10 s, so a server that drops every session is not asked
  every second. Five handshakes that failed in a row (no socket at the path: a 404, the
  server down or restarting, no network) make it `unavailable`: the attempts go on every
  15–30 s, and at once when the browser is online again, the page is shown again or the
  user retries (`LiveQuery`, `action:reconnect`). A JWT that expires later does not close
  the session.

### The messages

- A message is `{"type": "data", "data": "<the published JSON as a string>"}`: the hooks
  parse `data`. `{"type": "ping"}` is answered `{"type": "pong"}`: the hooks ping every 25 s
  and reconnect when nothing answered.
- Pub/sub keeps nothing: a message published while the page is not subscribed is lost. The
  hooks refetch every query after a reconnect that the server took. A message is published
  after the commit, or a client refetches the old data, and robustly: Redis down must not
  fail a change that is committed. `notify` and `publish_changed` do both; the low-level
  `user.ws_publish({...})` of `UserWsMixin` publishes at once, so a write wraps it in
  `transaction.on_commit(partial(...), robust=True)` (the guide of bazis-ws).

#### The common channel is not public data

**The common channel is not public data**: every user session receives it (an anonymous
one only with `BS_BAZIS_WS_ANONYMOUS_COMMON_CHANNEL=true`, when anybody can open one).
Publish there only the invalidation hint `{"resource": "<JSON:API type>"}`, never the id
of an item, its data or a notification: an id tells who may not see the item that it
exists and when it changes. A message about an item (its id, a notification) goes only
to the users who may see it, with `notify(...)` (the author, the assignee).

### The formats that the hooks read

- The formats that the hooks read (bazis-ws carries any JSON):
  `{"resource": "<JSON:API type>", "id"?: "<id>"}` (the resource or the item changed:
  `useLiveQueries` refetches the queries of the resource, each client with its own
  permissions; to `COMMON_CHANNEL` without the id),
  `{"action": "notification", "title": "…", "text"?: "…", "resource"?: "…", "id"?: "…"}`
  (a notification of the user without bazis-notify, `useNotifications`; with a resource, the
  item also changed), `{"action": "notification_created" | "notifications_changed", …}`,
  which bazis-notify sends itself (`useLiveQueries` refetches `useInbox`), and
  `{"action": "async_bg", "task_id", "status"}`, which bazis-async-background sends itself.

### The socket in the frontend

#### The socket

**The socket** (bazis-ws): wrap the routes in `SocketProvider` of `@/bazis/react/ws` with
`path={CAPABILITIES.ws?.path ?? null}` and the token of the session (`useToken()` of the
template; null before the login: no socket), and give `AppShell` the `tools`
`<LiveQuery />` and the bell `NotificationCenter` (the code below).
`LiveQuery` refetches the lists and the items that the backend says changed, and every
query after a reconnect. The bell shows the stored notifications of bazis-notify
(`notifications={useInbox(ROUTES['notify.notification'])}`, `@/bazis/react/notify`:
listed again on its messages `notification_created` and `notifications_changed`, so the
backend sends nothing else; without bazis-ws, `useInbox(path, {poll})`), else, with
bazis-ws only, those received in the session (`notifications={useNotifications()}`: none
of before the page was opened, pub/sub keeps nothing).

In the frontend, with bazis-ws: `manage.py bazis_front add live-query notification-center`,
wrap the routes in `SocketProvider` with the token of the session (none before the login;
the logout closes it) and give the layout the tools. The dev server proxies the socket
(`vite.config.ts` reads its path from the contract):

```tsx
import { CAPABILITIES } from '@/bazis/generated/contract';
import { SocketProvider } from '@/bazis/react/ws';
import { LiveQuery } from '@/bazis/ui/live-query';
import { NotificationCenter } from '@/bazis/ui/notification-center';
import { useInbox } from '@/bazis/react/notify';

// the bell of the stored notifications (bazis-notify): their action opens what they are about
function Notifications() {
  const navigate = useNavigate();
  return (
    <NotificationCenter
      notifications={useInbox(ROUTES['notify.notification'])}
      onOpen={(it) => { if (it.route !== null) void navigate(it.route); }}
    />
  );
}

// AppRouter: useToken() of src/app/session.ts
<SocketProvider path={CAPABILITIES.ws?.path ?? null} token={useToken()}>
  <BrowserRouter>…</BrowserRouter>
</SocketProvider>

// RequireSession: the tools are mounted once
<AppShell
  …
  tools={<><LiveQuery /><Notifications /></>}
>
```

## The design

```bash
python manage.py bazis_front design           # frontend/src/bazis/generated/theme.css and theme.ts from spec/design/
python manage.py bazis_front design --check   # write nothing; exit 1 if the theme differs from the design
```

The design layer is what makes the products look designed rather than like a bare admin
panel: one preset, a few options and the tokens of a brand, compiled into the frontend.
`init` generates the theme; generate it again after every change of `spec/design/` (and
after `bazis_front update`). The text depends on the design only: `--check` and the system
check `front.W005` (when the lock has `design`; without Node and the database) render it
again and compare it byte for byte; `front.W005` also reports a frontend with components and
no theme (made before the design layer: see [Updating the copies](#updating-the-copies)).
The generated files are never edited. The design must have no errors
(`bazis_front check --layer design`).

- `src/bazis/generated/theme.css`, imported by `src/index.css` of the template: every token
  as a CSS variable of `:root` (`color.<name>` is `--<name>`, any other token its dotted name
  with dashes: `radius` is `--radius`, `font.body` `--font-body`, `spacing.gutter`
  `--spacing-gutter`), the variables of the dark mode, the spacing of the density
  (`--space-page-x`, `--space-section`, `--space-card`, `--space-cell-x`, `--space-cell-y`,
  `--space-field`), the Tailwind theme over them (a color utility for every color token:
  `bg-primary`, `text-muted-foreground`, `bg-<token>` of a token of the product; the soft
  colors of the tones, `bg-success-soft text-success-ink`; `font-sans` is `font.body`,
  `font-display` `font.heading`; `rounded-sm` … `rounded-2xl` from `radius`) and the base
  styles of the preset.
- `src/bazis/generated/theme.ts`: `THEME`, typed by `Theme` (`preset`, `navigation`,
  `density`, `composition: {list, list_card, forms}`, `statuses`, `dark`), which the
  components read for their defaults.

| Token | Type | CSS variable | When tokens.json does not define it |
|---|---|---|---|
| `color.background`, `color.foreground`, `color.primary`, `color.primary-foreground`, `color.muted`, `color.muted-foreground`, `color.border`, `color.destructive` | color | `--background`, `--foreground`, `--primary`, … (the name in the group) | required by both presets |
| `radius` | dimension | `--radius` | required by both presets |
| `font.body` | fontFamily | `--font-body` (`font-sans`) | required by both presets |
| `color.sidebar`, `color.sidebar-foreground` | color | `--sidebar`, `--sidebar-foreground` | required by `workspace`; else the background and the foreground |
| `color.accent` | color | `--accent` (the hover and the current link of the top bar) | required by `portal`; else `muted` |
| `font.heading` | fontFamily | `--font-heading` (`h1`–`h3`, `font-display`) | required by `portal`; else `font.body` |
| `color.card`, `color.card-foreground`, `color.popover`, `color.popover-foreground`, `color.secondary`, `color.secondary-foreground`, `color.accent-foreground`, `color.input`, `color.ring` | color | the name in the group | the background, the foreground, the card, `muted`, the border, the primary (`spec/design.py`, `DEFAULTS`) |
| `color.success`, `color.warning`, `color.info` | color | `--success`, `--warning`, `--info` (the tones of the statuses) | a green, an amber and a blue of both modes |
| `color.sidebar-primary`, `color.sidebar-accent`, … | color | the variables of the sidebar of shadcn/ui | from the primary and the sidebar |
| `color.chart-1` … `color.chart-5` | color | `--chart-1` … `--chart-5` (the charts of shadcn/ui) | the primary, info, success, warning, destructive |

### Presets

**Presets.** `workspace` is an internal tool for daily work: a sidebar with the icons of the
screens (a drawer on a phone), a sticky header with the title and the actions of the screen,
tables with a sticky header, aligned numbers and the open row selected, filters in a
toolbar, the card next to the list on a wide screen (`list_card: split`; the list stays
mounted and keeps its search, filters and page, and shows its first two columns next to the
card, `compactColumns` of `ResourceList`), forms in dialogs. A table scrolls in its own
area as high as the screen, with its header at the top: a wide table scrolls sideways
instead of losing columns.
`portal` is a public shell: a top bar, larger type and more air, lists as grids of cards,
the card in place of the list, forms in place of the content of the screen, softer shapes
(the radius of its starter). Both have a light and a dark mode, focus rings, and work down
to the width of a phone.

### Brand

**Brand.** Change `color.primary` and `color.primary-foreground` (and their values of the
dark mode): the focus rings, the current link, the selected row and the soft tints are
derived from the primary in CSS (`color-mix`), so one color brands the product. The starters
are OKLCH (`oklch(L C H)`): keep the lightness and the chroma of the starter and change the
hue for a consistent brand; `check` reports a text color that loses its contrast (D009). Set
`radius` for the shapes and `density` for the spacing. The fonts are system stacks by
default; for a web font, load it in `index.html` (a `<link>` of Google Fonts) or with an npm
package of the font imported in `src/main.tsx`, and put its name first in `font.body` (or
`font.heading`): `["Inter", "ui-sans-serif", "system-ui", "sans-serif"]`.

### Dark mode

**Dark mode.** The tokens of the group `dark` are the values of the dark mode: each
overrides the token of the same name (`dark.color.background`; D007 when there is none of
that name and type), the others keep their value. The theme applies them to the class `dark`
of `<html>` and, until the application starts, to a dark system (unless `<html>` has the
class `light`); `initColorMode()` of `app-shell` (called by `src/main.tsx`) sets the class
from the choice of the user (system, light or dark, kept in the storage of the browser, the
button of `AppShell`). Without the group `dark` there is no dark mode (`THEME.dark` is false).

### Statuses

**Statuses.** `statuses` of `theme.yaml` gives each status of bazis-statusy a tone, by the
id of the status: bazis-statusy has one table of statuses for every model, so an id is the
same status everywhere (`draft` of the tasks is `draft` of the orders). It
draws the `StatusBadge` in the soft colors of the tone, the transits to a status of the tone
`danger` are destructive buttons; a status without a tone is `neutral`.

### The theme in the screens

#### Follow the preset; do not restyle the components screen by screen

**Follow the preset; do not restyle the components screen by screen.** The components
read `THEME` for the defaults of the preset; pass a prop (`layout`, `mode`, `forms`,
`navigation`) only for a screen that needs another one.

#### Colors, radii and fonts only through the tokens

**Colors, radii and fonts only through the tokens.** Use the Tailwind classes of the
theme: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border`,
`bg-primary text-primary-foreground`, `bg-primary-soft text-primary-ink` (and `success`,
`warning`, `info`, `danger`, `neutral` for the tones), `rounded-lg`, `font-display`. Never
a color of the Tailwind palette (`bg-blue-600`), a literal (`#3b82f6`, `oklch(...)` in a
class) or `style={{ color }}`: they break the brand and the dark mode. A color the
product needs is a token (`color.highlight` in `tokens.json` is `bg-highlight`).

#### The spacing of the density

**The spacing of the density**: `p-(--space-card)`, `gap-(--space-section)`,
`px-(--space-cell-x)` for blocks of your own, so that `density: compact` tightens them.

#### The states

**The states**: a screen of your own uses `StatePanel` with a `skeleton` of its content;
after a change that succeeded, `toast()` of `@/bazis/ui/state-panel` (the forms and the
transits already do); the errors stay where they happened.

- Check every screen in both modes and at the width of a phone.

## The end-to-end tests

```bash
python manage.py bazis_front e2e           # frontend/e2e/generated/ from the scenarios of spec/product.yaml
python manage.py bazis_front e2e --check   # write nothing; exit 1 if the generated tests are stale
E2E_PASSWORD=... python manage.py e2e_data   # the test data of the backend (below)
cd frontend && npx playwright install chromium && npm run e2e   # with E2E_PASSWORD, against the backend
```

- `e2e` needs a frontend made by `init` with the helpers (a frontend of an older bazis-front
  gets them with `bazis_front add playwright`) and specs without errors (`bazis_front check`). It
  writes a Playwright test per scenario, `frontend/e2e/generated/<scenario>.spec.ts`, and
  `e2e/generated/product.ts` (`PRODUCT`: the test user of each role, the route of each
  screen), deletes the tests of a scenario removed from the specs, and records in the lock
  the hashes of `spec/product.yaml`, `spec/screens/*.yaml` and the generated files (`e2e`).
  The text depends on the specs only: `--check` and the system check `front.W003` (when
  the lock has `e2e`; without Node and the database) render it again, compare it byte for
  byte, and say which specs changed or which test was edited.

### The generated tests are never edited

**The generated tests are never edited**: change the scenario and generate again. Tests
of your own go to `frontend/e2e/custom/`, with the same helpers (and `language(code)`,
which switches the language of the interface: not a step of the scenarios). `../bazis`
exports `loginAs(page, PRODUCT, role)` (the `App` of the user), the class `App` (its
methods below, and `page`, `screen()`, the current screen, `form()`, the open form),
`bz(kind, id)` (the selector of a mark), `routePattern(route)` and the types `Product`,
`Role`, `ScreenId`, `Values`, `FormValues`, `State`.

### The steps and their helpers

- The helpers, `frontend/e2e/bazis/` (the asset `playwright`, copied by `init` like the
  hooks, not edited), act only through the `data-bz` marks of the screens and wait on their
  states (until no `state:loading` is left), never for a fixed time. Each step of a
  scenario is a `test.step` titled with the step:

  | Step | Calls |
  |---|---|
  | the `role` | `loginAs(page, PRODUCT, role)`: logs in on `/login` (`LoginForm`) as the `test_user` of the role with the password of `E2E_PASSWORD`; no login without bazis-users, nor for an `anonymous` role (the next step opens its screen); the images of other origins than the frontend (the tiles of the maps) are answered with a blank image (`stubForeignImages(page)`): the tests never reach a server outside the product |
  | `open: <screen>` | `open(screen)`: the route of the screen, then `expectScreen` |
  | `open_item: {where}` | `openItem({where})`: the first `row:<id>` whose cells `cell:<name>` have exactly these texts: on the page shown, else searched with the search of the list (`field:$search`, each text of `where` in turn; it waits for the rows of the search, `data-search` and `aria-busy` of `list:<entity>`), else on the next pages (`action:next-page`); then `expectScreen` of `list.open`. The labels of the related items in the cells (`RelationLabel`) are read after the rows: every step waits until no `state:loading` is left on the page, theirs too. A list that the scenarios add to at every run is searched, not read on its first page only (give its route set `search_fields`) |
  | `action: <id>` | `action(id)`: `action:<id>` of the current screen; then `expectScreen` of the `then` of a destroy |
  | `fill`, `upload` | `fill(values)` (a select by the label of its option, the picker of a relationship by the label of the item, searched in its popup, the picker of a to-many relationship by the list of the labels of its items, which replace those it had (its popup, `aria-multiselectable`, cleared with the option `data-value=""`, then each item chosen, closed with Escape; `[]`: none), a checkbox by true or false, a date-time as `YYYY-MM-DDTHH:mm` in the time zone of the browser, UTC: `FieldInput` sends `2030-03-04T10:00` as `2030-03-04T10:00:00.000Z`), `upload(field, file)` (a file of `e2e/fixtures/` of the frontend into the input `field:<field>`; waits until `upload:<field>` is no longer busy, its `aria-busy` absent or `"false"`, and shows the name of the file, or an error is shown) in the open form, the `<form>` with `action:submit`; on a card with `edit: true` whose edit is not open, `action('edit')` first |
  | `submit: {}` | `submit({saved: true})`: waits until the form is closed, and fails the test with the errors that the form shows when it stays open (the save failed); `submit()`, which only waits for the form to close or to show an error of this submit, when the next step expects a refusal (an `error`, or a `state` of a failure: `invalid`, `error`, `forbidden`, `not_found`); a submit that saves is followed by `expectScreen` of the `then` of the form, a refused one by none (the form stays open on its screen) |
  | `transit` | `transit(id, payload?)`: `transit:<id>`, the payload in its dialog; waits until it is no longer offered or an error is shown |
  | `expect` | `expectScreen` (the mark of the screen and its route, since a list may show next to its card), `expectStatus`, `expectState` (a visible one), `expectActionAbsent`, `expectFieldReadonly`, `expectFieldAbsent`, `expectValues` (the text of `field:<name>` of the screen contains the value), `expectRows`, `expectError` (a visible one), `expectNotification` (the bell opens the list of the notifications, which waits for one with the text), in this order |

  The screen after a step is the one that `check` follows (the `then` of a form or a
  destroy, the `list.open` of `open_item`): `check` and the generator read the steps with
  the same code (`spec/scenarios.py`). `expectFieldReadonly` passes when the open form has
  the field read-only or disabled (or not at all), and on a card when it has no edit or its
  edit has the field read-only (it opens the edit and cancels it).

#### A form of your own

**A form of your own** is driven by the steps through the marks that `ResourceForm`
renders: the helpers take as the open form the `<form>` that has the submit button
`action:submit` (`app.form()`), its controls by `field:<name>` (an input, a select, a
checkbox, a picker: `role="combobox"` with its popup in `aria-controls`), the errors of a
submit by `error:<name>` and the states of a failure (`state:invalid`, `state:error`,
`state:forbidden`, `state:not_found`); a submit that saves closes the form or leads to
another screen. Render each field with `FieldInput` (it gives the marks of the control and
of its errors, and the pickers) in such a `<form>`, show `submitError` with `StatePanel`,
and the scenarios fill and submit it as any form. The signatures of the helpers are in
"API: the helpers of the end-to-end tests"; never read the copies in `frontend/e2e/bazis/`.

#### The test data is the job of the backend: `manage.py e2e_data`

**The test data is the job of the backend: `manage.py e2e_data`.** Before `npm run e2e`
the database of the backend is migrated (the roles, statuses and transits of the specs
are the declarations that `migrate` applies; see the contract) and
has the data of the e2e data
command recommended by bazis-front: a management command of the product named
`e2e_data` (the sample of this package has it,
`sample/tasks/management/commands/e2e_data.py`):

```bash
python manage.py migrate
E2E_PASSWORD=... python manage.py e2e_data
```

- it creates only a user per `test_user` of the roles of the specs, with its role (in
  `roles` and `role_current`) and the password of the environment variable
  `E2E_PASSWORD` (it fails without it), and the items that the scenarios open
  (`open_item`) and need;
- it never creates a role, a permission, a status or a transit: a role of a `test_user`
  that the migrations did not create is an error of the command;
- **it runs before every run of the tests and gives the same data every time**: it
  deletes what the previous runs left, the items that the scenarios created (in a
  database of the end-to-end tests of their own: every item of the models they create; in
  a shared one, those of the test users or of a marker such as a prefix of the titles,
  never the data of others) and the items it creates itself, then creates them again in
  their initial state (a scenario may have run a transit on one), and sets the password of
  the test users again, so that the tests log in with the current `E2E_PASSWORD`; it runs
  in one transaction. Never "create it when it is missing": the items of the runs pile up,
  the lists grow (a row leaves the first page), and what they add up to changes (an
  approved request of a previous run spends the budget of a department, and a scenario
  that approves fails one day). The sample resets every task
  (`sample/tasks/e2e.py`).

The scenarios share the database and run one at a time (`playwright.config.ts`); none
should depend on another: a scenario opens an item that `e2e_data` creates, or one it
creates itself.

### Running the tests

- `npm run e2e` starts its own dev server of the frontend on `E2E_PORT` (5173 by default;
  its `/api` goes to `BAZIS_API_URL`, `http://localhost:8000` by default, as for `npm run
  dev`) and runs the tests once the backend answers its health check through it, unless
  `E2E_BASE_URL` names a running frontend; the backend runs separately. It never reuses a
  server already on the port: the run fails instead of testing another frontend (choose
  another `E2E_PORT`, or `E2E_BASE_URL`). The browser is in UTC and in the default language
  of the backend (`timezoneId`, `locale`): the times that the scenarios fill and the dates
  they read are in UTC, like the data of `e2e_data`. In CI, an HTML report is written to
  `frontend/playwright-report/`.

A screen that renders the marks of its spec (the components do) passes its scenarios; a
screen without them fails them, even when it looks right. A submit that is not refused must
save, also on a card where no `then` follows. When the port is taken (`npm run dev` of this
frontend, or another app) choose a free one, `E2E_PORT=5191 BAZIS_API_URL=http://localhost:8031
npm run e2e` (`BAZIS_API_URL` is also read from `frontend/.env.local`), or name a frontend
already running with `E2E_BASE_URL` (`npm run build` and `npm run preview` in CI). A run that
waits for the web server until its timeout has no Bazis backend at `BAZIS_API_URL`.

### The tests of your own

A test of your own (`frontend/e2e/custom/`), for what a scenario does not express, uses the
same helpers (their signatures: "API: the helpers of the end-to-end tests"):

```ts
// e2e/custom/tasks.spec.ts
import { test } from '@playwright/test';

import { loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a manager sees the drafts', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await app.expectState('loaded');
  await app.openItem({ where: { title: 'Write the report' } });
  await app.expectScreen('task-card');
  await app.expectStatus('draft');
});
```

For what they do not cover, `app.page`, `app.screen()` (the current screen), `app.form()`
(the open form) and `bz(kind, id)` of `../bazis` (the selector of a mark): a transit that a
validator restricts is disabled, with the errors of the validators next to it,
`await expect(app.screen().locator(bz('transit', 'reopen'))).toBeDisabled()`.

## The client

```ts
import { createClient, Filter } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

export const api = createClient<paths>({ baseUrl, token: () => session.token });
```

In a frontend made by `init`, the client is created in `src/app/providers.tsx`, given to
the hooks by `BazisProvider` and read with `useApi()` of `@/bazis/react`; the token is
kept by `src/app/session.ts`. Read and change data with the hooks (below); call the client
for what they do not cover (the login, a custom endpoint).

### The paths and the filters

- Address every operation by the path of the route set and the id:
  `api.list(path, …)`, `api.retrieve(path, id, …)`, `api.update(path, id, document)`.
  If a path or an attribute does not compile, the contract is stale or the code is wrong;
  never cast it away.
- Build filters with `Filter.where/and/or/not`; never concatenate the expression or encode
  values yourself. Only the lookups of Bazis work (see `assets/client/README.md`); an
  unknown field or lookup is a 400 `ERR_FILTER` error (silently ignored before bazis 2.5.0).

### The errors

- Show validation errors from `ApiError.fieldErrors()` at their fields, the errors of the
  item that are not of a field (an invariant of `validate_item`, an included item) from
  `ApiError.formErrors()` at the form, and other errors from `ApiError.message`. A form of
  the product does it as `ResourceForm` does (`form.errors` of `useResourceForm`,
  `FieldInput`); any other error, and the state it puts a screen in, is shown with
  `StatePanel` of `@/bazis/ui/state-panel` (`errorState(error)`: 401 and 403 `forbidden`,
  404 `not_found`, 422 `invalid`, else `error`), the only mapping of the errors of the
  backend: the components and the `ErrorBoundary` of `src/app/errors.tsx` use it.

### The permissions and the login

- Request the permission meta (`meta: ['for_change', 'for_delete', 'for_create']` on a
  list, `['crud_actions']` on an item) and read it with `can()`; read the editable fields
  of an item from its runtime schema `schema_update` (`useResourceForm`, `useSchema`).
- Log in with `api.login()` and keep the token in the application; the client reads it
  through the `token` option on every request. With bazis-authing the template logs in
  with `api.auth()`, `api.authLogin()` and `api.authWait()` (see
  [Logins with bazis-authing](#logins-with-bazis-authing)).

### The uploads, the custom actions and the background requests

- Upload a file with `api.upload(path, file, {name?, onProgress?, signal?})` (or
  `useUpload`): a multipart `POST` to the route set of the uploaded files, with
  XMLHttpRequest for its progress.
- Call a custom action of a route set with `api.action(path, name, body?, {method?, query?})`
  (`<path><name>/`, POST by default; `api.itemAction(path, id, name, body?, {method?, query?})`
  for `<path><id>/<name>/`), or `useAction`: the JSON body, the query parameters (`?code=A1`:
  a list repeats the parameter, null and undefined are left out) and the response of its
  OpenAPI; the errors of the body by field are `ApiError.bodyErrors()` (`/<field>`), not
  `fieldErrors()` (the pointers of a JSON:API document).
- Run a request in the background with `api.background(method, path, {body?})` (or
  `useAsyncRequest`, bazis-async-request): `{status: 'queued', taskId}` or `{status:
  'done', response}`; read a task with `api.backgroundResult(resultPath)` (or
  `useAsyncTask`): `{status, response}`.

## The hooks

React hooks over the client and TanStack Query 5, in `src/bazis/react/` of the frontend
(`@/bazis/react`; the hooks of a package in `@/bazis/react/<package>`, copied with it: see
[The frontend](#the-frontend)); their signatures are in "API: the hooks" and "API: the hooks
of the packages and the language". Typed by `schema.d.ts`: a path that does not compile is
not an endpoint of the backend. Every query key starts with `['bazis', path]`; the
mutations refetch the queries of their resource and stay pending until the active ones are
refetched.

### Read and change the data of the backend with the hooks

**Read and change the data of the backend with the hooks**, not with `useQuery` around
the client: their query keys carry the session and their mutations refetch what they
change. The client itself is `useApi()` (login, a request the hooks do not cover). Do not
edit `src/bazis/client/` or `src/bazis/react/`; put what the product needs around them in
`src/app/`, so that a new version of bazis-front replaces the copies without conflicts.

- Take the paths of the resources from `ROUTES` of `contract.ts`; address an item by the
  path and its id (`useItem(ROUTES['app.model'], id)`).

```tsx
import { Filter, can, nextPage, pagination } from '@/bazis/client';
import { CAPABILITIES, ROUTES } from '@/bazis/generated/contract';
import { useDestroy, useItem, useList, useResourceForm } from '@/bazis/react';
import { useTransit, useTransits } from '@/bazis/react/statusy';   // with bazis-statusy
import { useUpload } from '@/bazis/react/uploadable';             // with bazis-uploadable
import { SocketProvider, useChannel, useNotifications } from '@/bazis/react/ws';   // with bazis-ws
import { useInbox } from '@/bazis/react/notify';                  // with bazis-notify
import { useBgTask } from '@/bazis/react/bg';                     // with bazis-bg
import { useAsyncRequest, useAsyncTask } from '@/bazis/react/async';   // with bazis-async-background

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
// readOnly, nullable; attributes: type, format, enum, labels (of the choices: choiceLabel);
// relations: relation, many
form.setValue('title', 'Report');                   // a to-one relation takes the id or null
const saved = await form.submit();                  // null when it failed: form.errors.title
// an item added from the card of its parent: the relationship fixed, never chosen
const step = useResourceForm(ROUTES['tasks.step'], { fixed: { task: id } });
const transits = useTransits(TASKS, id);                             // [{id, allowed, restricts, payload}]
const upload = useUpload(ROUTES['uploadable.file_upload']);           // upload(file) -> the item; progress, abort
useChannel((message) => { … });                                       // the messages of the socket, parsed
const task = useBgTask(ROUTES['bg.task'], taskId);                    // a task of bazis-bg, until it is done
const request = useAsyncRequest();                                    // mutate({method, path, body}) with X-Async-Background
const result = useAsyncTask(CAPABILITIES.async_background.result_path, taskId);   // {status, response, done, error}
```

### Reading and changing the data

- `useList`, `useItem`, `useSchema`, `useFilterFields` read; `useCreate`, `useUpdate`,
  `useDestroy`, `useRelationship` change and then refetch every query of the resource
  (`['bazis', path]`): `mutate(document)`, `mutate({id, document})`, `mutate(id)` and
  `mutate({id, field, operation: 'add' | 'replace' | 'remove', data})` (the relationship
  endpoint, for to-many relationships). `useSchema(path, 'list' | 'create')` and
  `useSchema(path, 'retrieve' | 'update' | 'transit', id)` are the runtime schemas for the
  current user, kept for the session; `useFilterFields(path)` the fields a list can be
  filtered by, with their types: those of the user. `useCan(path, 'view' | 'add')` is
  whether the user may view the items
  of a route set or add one (undefined until the backend answers; false on its 403), read
  from the runtime schema of the list or of the create; `useCan(path, 'action_<name>')`
  whether he may call a custom action of the collection (`custom_actions` of a list of one
  item; allowed without the meta): the button of an export is offered to those only; what
  he may do on an item is its meta (`crud_actions`,
  `custom_actions`, `for_change`, `for_delete`: `can()` of the client).

### The errors and the runtime schemas

- The errors (the template, `src/app/providers.tsx`): a query that the backend refused (4xx)
  is not retried, a failure of the server or of the network at most three times; a 401
  ends the session; the errors are not thrown but returned (`query.error`), and the
  components show them with `StatePanel`. `useAnyList`, `useAnyItem`, `useAnySchema`,
  `useAnyRelated` of `@/bazis/ui/resource` are the same hooks with plain paths, for the
  generic code of the components: a screen uses the typed hooks.
- `resourceSchema(schema)` reads the fields of a runtime schema (of a create, an update, a
  retrieve or a list): `{kind, name, title, required, readOnly, nullable}`, and of an
  attribute `type`, `format`, `enum` (the values of the choices), `labels` (their labels by
  value, `enumDict`: `choiceLabel(field, value)`) and `schema`, of a relationship
  `relation` and `many`; `objectFields(schema)` those of the JSON Schema of an object, such
  as the payload of a transit; the components render them.

### The forms

- `useResourceForm(path, {id?, fixed?})` takes its fields from `schema_create`/`schema_update`
  (those of the current user: type, required, read-only, nullable, choices, the
  related resource of a relationship), its values from the defaults or the item, and
  submits the changed attributes and relationships as one document (a to-many one with all
  its items, its value the list of their ids); a 422 gives `errors` by field. It is `{status: 'loading' | 'error' | 'ready', error, fields, values,
  setValue(name, value), dirty, errors, submitError, isSubmitting, submit(), reset()}`
  (`submit` resolves to the saved document, null when it failed). `fixed` values (the
  parent of an item added from its card, `{request: id}`) are those of their fields whatever
  `setValue` sets, and are sent when they differ from the initial ones. A form of your own
  renders each field with `FieldInput` of `@/bazis/ui/resource` (the control by the type,
  the choices by their labels, the picker of a relationship or of the items of a to-many
  one, its errors), as `ResourceForm` does.
  The form shows the errors of a 422 by field from `errors` and any other error from
  `submitError`; the fields the user may not change now are `readOnly` in `schema_update`
  (shown disabled) and are never sent, and those the field permissions disable are not in
  it.

### The transits (bazis-statusy)

- `useTransits(path, id)` reads `meta.state_actions` of the item: the transits the user may
  run now (`id`; `allowed` unless a validator restricts them, `restricts`; `payload`, the
  JSON Schema of the payload they require, or null; `related`), their names in `TRANSITS`
  of `contract.ts`. `useTransit(path, id)` runs one, `mutate({transit, payload})`: it
  resolves to the item, or to null when the user can no longer view it (leave its screen).

### The uploads and the downloads (bazis-uploadable, bazis-bg)

- `useUpload(path)` uploads one file at a time to a route set of the uploaded files
  (`ROUTES['uploadable.file_upload']`): `upload(file, {name?})` resolves to the created item
  (null when aborted; its id may be a number: `String(item.data.id)` is the value of the
  relationship), with `status` (`idle`, `uploading`, `success`, `error`), `progress`
  (`{loaded, total}` while it uploads), `error` (413 `ERR_FILE_TOO_LARGE`…), `abort()` and
  `reset()`; it refetches the queries of the route set.
- `useDownload(path)` (`mutate(id)`, resolves to the name) saves the file of an item from
  `<path><id>/download/` (bazis-uploadable, bazis-bg) with the token, `useDownloadUrl(path,
  id)` gives its content as an object URL (a thumbnail), read once (a file of an item does
  not change); `client.download(path, id)` and `saveFile` are below them.

### The socket and the notifications (bazis-ws, bazis-notify)

- `SocketProvider({path, token})` opens the socket of bazis-ws at `CAPABILITIES.ws.path`
  with the token of the session, sent in its first message (one a page, none without a
  token; it reconnects with a backoff and a logout closes it; see
  [The socket](#the-socket)); `useSocket()` is its `status` (`idle`, `connecting`, `open`,
  `rejected`, `unavailable`), the `error` of a refused token and `retry()`;
  `useChannel(handler)` gets every message of the channels of the session, parsed;
  `useLiveQueries(ROUTES, {notifications?})` refetches what the messages say changed (also
  the notifications of bazis-notify on its messages, given their resource,
  `CAPABILITIES.notify.resource`, and a task of bazis-async-background), and every query
  after a reconnect (`LiveQuery` mounts it); `useNotifications()` is `{items, unread,
  markRead(key?), clear}` of the session, the newest first (without bazis-notify).
- `useInbox(path, {limit?, poll?})` (bazis-notify, `ROUTES['notify.notification']`) is the
  stored notifications of the user, the newest first (`route` of each: where its action
  leads): `{items, unread, status, error, retry, markRead(key?), markUnread(key),
  deleteAll}` (PATCH of `read_at`, `read_all/`, `clear/`, which deletes them for good: give
  `deleteAll` to `onDeleteAll` of `NotificationCenter` only if the product offers it;
  `unread` is `unread_count/`). It is listed again after its own changes and, with
  bazis-ws, on the messages of bazis-notify (`useLiveQueries`); `poll` (ms) without
  bazis-ws. Both are the source of `NotificationCenter`.
### The custom actions

- `useAction(path, name, {method?, invalidate?})` calls a custom action of a route set
  (`mutate(body)`, `useItemAction`: `mutate({id, body})`), typed by its OpenAPI, then
  refetches the queries of the resource (not with `invalidate: false`); `errors` are those
  of its body by field (`ApiError.bodyErrors()`), `error` the `ApiError`.
- `useActionQuery(path, name, {query?})` and `useItemActionQuery(path, id, name, {query?})`
  read a custom action declared with GET as a query (a summary, a check, the content of a
  screen; no request while `id` or `query` is null), keyed under its resource and by its
  query parameters (`query`, typed by its OpenAPI and required with a required parameter:
  other parameters are another query): a mutation or an action of the resource refetches
  it; `data` is its response typed by its OpenAPI, `error` the `ApiError`.

### The tasks and the background requests (bazis-bg, bazis-async-background)

- `useBgTask(path, id)` reads a task of bazis-bg (`ROUTES['bg.task']`, the user's own; the
  query of `useItem`) every 2 s until it is `done`: `{state, phase, outcome, progress,
  result, …}` (`bgTask(document)`): `state` `waiting`, `starting`, `running` or `done`,
  `progress` `[{key, performed, expected}]`, `outcome` `success`, `error` or `interrupted`.
- `useAsyncRequest()` sends a request with `X-Async-Background`: `{status: 'queued',
  taskId}` (202), or `{status: 'done', response}` when the backend ran it at once (without
  Kafka); nothing is refetched until the task is done. `useAsyncTask(resultPath, taskId)`
  reads the task at `CAPABILITIES.async_background.result_path` every 2 s until it is
  `completed` or `failed` (a status on the socket refetches it at once with
  `useLiveQueries`): `{status, response, done, error}`; `replayedResponse(response)` reads
  the HTTP status and body of a replayed request (an HTTP error there is still
  `completed`).

### The caches and the session

- The template clears the query and mutation caches when the user or the language changes,
  and every query key ends with the scope of `BazisProvider`, the session (a number that
  changes at every login and logout) and the language (`useSessionKey()`), so the data of
  one user is never shown to another, nor the texts of one language in another, even from a
  request still running.
  A 401 of any query or mutation ends the session (`logout()`, `src/app/providers.tsx`);
  the session is `useSession()` of `src/app/session.ts`. A query of your own over data of
  the backend ends its key with `useSessionKey()` too, the scope of `BazisProvider`.

## The language

A product is in the languages of its backend: `LANGUAGES` and `LANGUAGE_CODE` of its
settings (`BS_LANGUAGES='[["en", "English"], ["ru", "Русский"]]'`, `BS_LANGUAGE_CODE=en`),
which the contract exports (`project.languages`; `project.language`, the code of
`LANGUAGES` that `LANGUAGE_CODE` names) and `contract.ts` exposes (`LANGUAGES`,
`LANGUAGE`). The backend translates with gettext (`gettext_lazy` with English msgids in the
models and the route sets; the catalogs of the project, `locale/<language>/LC_MESSAGES/` of
the project and of each app, `.po` and `.mo` both committed, are made, filled and compiled
by `manage.py bazis_messages` of the core: `make`, the translations of what it lists as
`untranslated` or `fuzzy` written to a JSON file kept in the project, `apply <file.json>`;
never a script that edits the `.po` files) and with the translated fields of its data (the
names of the roles of bazis-permit and of the statuses and transits of bazis-statusy have a
column per language: the declarations fill them with the
translations of their English names, `gettext_lazy`, from the catalogs of the project).

### The asset `i18n`

**The asset `i18n`** (`src/bazis/i18n/`, copied by `init` like the hooks, not edited):
`LanguageProvider`, `useLanguage()` (`{language, languages, setLanguage, t}`),
`t(key, params)` over flat dictionaries by language with stable keys (those of the
components in `src/bazis/i18n/messages/<language>.ts`, English and Russian), the plural
forms of `Intl.PluralRules` (`<key>.one`, `<key>.few`, `<key>.many`, `<key>.other`, with
the parameter `count`), `translator(store, messages)` (`t` outside the components), and
`formatNumber(value, language, options?)` (the options of `Intl.NumberFormat`: a sum,
`{style: 'currency', currency: 'RUB'}`), `formatDecimal(value, language, options?)` (a
`DecimalField`, a string of the API, formatted exactly with its digits after the point; a
sum with the same options), `formatDate(value, language)`,
`formatDateTime(value, language)`, `formatTime(date, language)` (`Intl`, in the language
of the interface: `const { language } = useLanguage()`). No i18next.

### The dictionaries of the product

**The dictionaries of the product** are `src/i18n/<language>.ts` of the frontend (the
template has `en` and `ru`, listed in `src/i18n/index.ts`): the texts of its screens, and
the texts of the components it words otherwise (the same key). They are merged over those
of the package and are the product's (`update` merges a new template with their
changes). A language of the
backend without a dictionary shows the texts of the package in it, else the English ones.
Every text of a screen goes through `t()`; never write a text of the interface in the JSX.

### In a screen

**In a screen**: `const { t, language } = useLanguage()` of `@/bazis/i18n`,
`t('tasks.title')`, `t('list.range_of', {from, to, count})`. Dates and numbers are
formatted in the language of the interface, never in that of the browser: `formatNumber`,
`formatDecimal`, `formatDate`, `formatDateTime`, `formatTime` with `language` (`FieldValue`
does it for the fields, but for a `DecimalField`, a string it shows as it is: format it in
`cells` of `ResourceList` and `values` of `ResourceCard`, a sum with the currency of the
product, `formatDecimal(fieldValue(row, 'total'), language, {style: 'currency', currency:
'RUB'})`, `—` for none); the names of the statuses are `statusName(type, id, language)` of
`@/bazis/ui/status-badge`.

### The language of the interface

**The language of the interface** is one of `LANGUAGES`: the language of the profile of
the user (below), else the choice kept in the browser (localStorage), else the languages
of the browser (`navigator.languages`, also by their base code: `ru-RU` is `ru`), else
`LANGUAGE`. `AppShell` shows `LanguageToggle` next to the color mode when there is more
than one language (`action:language`, the code in `data-value`); the `lang` of the page
follows it.

### The backend answers in it

**The backend answers in it**: the client sends `Accept-Language: <language>` on every
request (`language` of `createClient`), the `LanguageMiddleware` of the core activates it
when it is one of `LANGUAGES` (else `LANGUAGE_CODE`). The query keys of the hooks end with
the session and the language, and the template clears the cache when the language changes:
the titles of the runtime schemas and the messages of the errors are those of the language
they were read in. The names of the statuses, the transits and the roles are in
`contract.ts` in every language (`statusName(type, id, language)`).

### The language of the profile

**The language of the profile**: when the users have a language of their own (the
capability `users.profile_language` of the contract: a text field `language` of the user
model, `UserLanguageMixin` of bazis-users 2.7.0, which its built-in user has and a user
model of the product opts in to; a code of `LANGUAGES`, null for none, validated by the
backend; the user reads and changes it on his own item of the user resource), the template makes the interface
follow it (`followSessionLanguage` of `src/app/language.ts`): at a login it adopts the
language of the profile of the user, and a change of the language by the user is saved to
the profile (`PATCH` of the attribute `language` of the user, found by the username of the
session token); a change made while the profile loads wins over it, and a profile without
a language is never written at a login; only codes of `LANGUAGES` are sent. Without the
field (an older bazis-users, a user model without the mixin) the language is kept in the
browser only. A user model of the product opts in with the mixin and `makemigrations`.

### The titles of the schemas

**The titles of the schemas** are in the language of each request (the core translates
them when it answers; `/openapi.json` is built per language and answers with
`Vary: Accept-Language`). The export of the contract is in `LANGUAGE_CODE`
(`translation.override`), whatever the process answered before.

### The tests

**The tests**: the contract tests of the components never depend on a text (`data-bz`,
roles): `renderWithBazis` of `testing` renders in English, `testLanguages('ru', 'en')` in
another language. The end-to-end tests act through `data-bz`; a test of `e2e/custom/`
switches the language with `app.language('<code>')` of the helpers.

## Logins with bazis-authing

bazis-authing (its section `authing` in the contract) signs users in through an
authorization store of its auth endpoint; the session token it gives is the JWT of
bazis-users, sent as the bearer token like the token of `token_url`. The template
(`src/app/session.ts`) logs in so when the contract has `authing.auth_url`:

1. `GET <auth_url>` without a token: a 400 whose error `UNAUTHORIZED` has in `meta.token` the
   token of a new store (and in `meta.actions` the login actions, also in the contract).
   The store token has no `exp`: a request with it is anonymous, never a session.
2. The password (the action `password`, `POST`): `POST <url>` with
   `Authorization: Bearer <store>` and `{username, password}`; it answers 303 to the auth
   endpoint, which answers 200 `{user_id, username, …, token}` (`token` is the session
   token), or 400 with the error `USERNAME_PASSWORD_ERROR` (status 422) of the store.
3. A service in its page (`GET`, Google): the template opens a window at
   `<url>?<token_param>=<store>` (the service ends in that window on a page of
   bazis-authing without tokens, which tries to close it)
   and asks the auth endpoint with the store token every 1.5 s until it is signed in, has an
   error (`GOOGLE_AUTH_ERROR`), or has expired (`BAZIS_AUTH_COOKIE_LIFETIME`: the endpoint
   answers with another store); the login screen offers a cancel meanwhile, also for a user
   who closed the window. The closing of the window is not watched: the sign-in pages of
   Google send Cross-Origin-Opener-Policy, after which the opener sees the window as
   closed while the user still signs in there. The services
   with another body than the password (an own service) are not offered.

The client sends these requests without cookies (`credentials: 'omit'`): the endpoint sets
the store token as a cookie, and a store that is signed in would sign the next user in as
the previous one until it expires. The store token is kept only during the login; a store
gives its session once (bazis-authing 2.6.0). The sign-out of the template (`signOut` of
`src/app/session.ts`) drops the session token, which is stateless, and posts to the logout
endpoint (`logout_url` of the section, `POST /logout/`, `api.authLogout`) with the cookies
of the browser: it deletes the store cookie that a login in a window leaves. Without
the service `password` the login screen has no username and password, and the end-to-end
tests cannot log in (P026).

The login of the template (`src/app/session.ts`, `src/screens/login/`) exists only with
bazis-users (`LOGIN_ENABLED`): the token endpoint of bazis-users, or with bazis-authing
(`CAPABILITIES.authing`) its services: the username and the password through the service
`password` (`login()`, `PASSWORD_LOGIN`), and a button for each service whose page opens in
a window (`WINDOW_LOGINS`, `loginInWindow()`: Google). Only the session token is kept, never
the store token of bazis-authing. The sign-out of `AppShell` is `signOut(api)`: it drops the
session at once and, with bazis-authing, posts to its logout endpoint.

## Protocol facts that are easy to get wrong

- The list filter is one `filter` expression (`price__gte=10&(state=new|state=draft)`),
  not `filter[name]=value`.
- `include` works on retrieve, create and update; list ignores it. The items of a list by
  their ids are `filter=pk=<a>|pk=<b>|…`: there is no `pk__in`, and `pk=<a>,<b>` is one
  value (a 400 `ERR_FILTER` on a UUID). `<app>.<model>=<ids>` filters the objects related to
  those objects of another model, not by their own ids.
- With bazis-permit (2.8.0), an item the user cannot view is 404, as a missing one (a card
  shows `not_found`); 403 (`forbidden`) is an item he views but cannot change or delete, or
  a list of a model he has no permission on.
- With bazis-permit, the schema of a list (`schema_list/`) is the union of the field sets of
  the groups of field permissions (its first member has all the fields any row can show;
  with more than 4 conditional groups of the user, those every row shows): which fields a
  user sees is in the items, which leave out the hidden ones. The schemas of an item
  (`schema_retrieve/`, `schema_update/`) are those of the user for this item.
- Pagination is `page[limit]` and `page[offset]`; sorting is `sort` with `-` for
  descending; meta fields such as `pagination` are returned only when requested with
  `meta`.
- The errors point into the request document (bazis 2.11, `source.pointer`): a field of
  the item is `/data/attributes/<name>` or `/data/relationships/<name>` (and below it, such
  as the id of a related item, `/data/relationships/<name>/data/<index>/id`), whether the
  schema refuses the body (422 `ERR_VALIDATE`), a related item is one the user cannot see
  (403 `ERR_RELATION_ACCESS`) or the item fails `validate_item` of its model (422
  `ERR_ITEM_INVALID`); `/data` is the item as a whole, `/data/id` its id, and an included
  item is `/included/<index>/...`, its index in `included` of the document. The
  relationships endpoints point into their body: `/data` (the value of the relationship),
  `/data/<index>` (a refused identifier of a to-many relationship), `/data/<index>/id`, and
  `ERR_ITEM_INVALID` has the parameter `/related_field_name`. `fieldErrors()` gives the
  errors of the fields of the item (the form shows them at `error:<name>`), `formErrors()`
  the others (the form shows them in its state, an included item with its index and
  field), every error of a relationships endpoint among them. A hook of the product that
  raises `JsonApiBazisError` points with `loc=('body', 'data', 'attributes', '<name>')`:
  `loc=('attributes', '<name>')` is `/attributes/<name>`, which is no field of the form.
- `filter`, `sort` and `search` reach only the fields of the LIST schema of the route set
  (bazis 2.9; through a relation, those of the default route of the related model, and
  only the related items the user can see); `search` searches only its `search_fields`,
  and a route set without them answers it with 400 `ERR_FILTER` (`/query/search`).
- An uploaded file (bazis-uploadable) is the multipart create of its route set (`file`,
  optional `name`), not a JSON:API document; the response is the item with `file` (the URL
  of the file in the storage: the path of `MEDIA_URL` for the file system, which the API
  redirects to `MEDIA_HOST_URL`), `name`, `extension`, `size`. A model references it by a
  to-one relationship, set to its id in the document of a create or an update. A file larger
  than `BAZIS_FILE_UPLOAD_MAX_SIZE` is a 413 `ERR_FILE_TOO_LARGE`, checked after the whole
  body is received. bazis-uploadable does not restrict the types and never deletes a
  replaced file from the storage. The `file` URL is served by the media host to anyone who
  has it: read the content from `GET <path><id>/download/` with the token (bazis-uploadable
  2.7, the files the user sees: 404 otherwise; bazis-bg 2.6 for the file of a task), as
  `useDownload` does, and never link the `file` URL.
- A point (`PointField`) is GeoJSON, `{"type": "Point", "coordinates": [<longitude>,
  <latitude>]}`: the longitude first, as in `<field>__near=<lon>,<lat>[,<meters>]` (100 m
  by default; `<field>=<lon>,<lat>` is within 10 m) and `<field>__in_bbox=<lon1>,<lat1>,
  <lon2>,<lat2>`; `route_filter_fields/` gives it as `object`. A write takes the same
  GeoJSON point (an invalid one is 422 at the field); the distance of `near` takes a unit
  (`500`, `500m`, `2.5km`), and `sort=<field>__distance(<lon>,<lat>)` sorts by the distance
  (`-` for the farthest first).
- A custom action takes and returns plain JSON (`application/json`, not a JSON:API
  document); the core points the errors of its body to `/<field>` (`ApiError.bodyErrors()`),
  and a hook that raises `JsonApiBazisError` points to a field of it with `loc=('body',
  '<field>')`.
- A `DecimalField` is a JSON string of its exact digits (`"45000.10"`), in the responses and
  in `contract.json` (`type: string`); a write takes a string or a number. Never compute
  with it as a float: show it with `formatDecimal`, and let the backend sum it.
- The `id` of an item of a model with an integer primary key (`FileUpload`) is a JSON number
  in its documents, a string in the relationships that reference it: compare them as
  strings.
- A task of bazis-bg (`bg.task`, `BgRoute`: `list` and `retrieve`, authentication required, a
  user reads the tasks whose `author` they are, staff all) goes `waiting` → `starting` →
  `running` → `done`; `phase` is the phase that runs, `expected`/`performed` its counters
  (numbers, or numbers by key), saved every few seconds and cleared when the phase ends;
  done, `phase` is `completed`, `error` or `interrupted`, `error` the traceback of a failure,
  `interrupt` true for an interruption, `result` what the task set. A task runs only with a
  `manage.py bg_scheduler` process (no Kafka); without it, it stays `waiting`.
- bazis-async-request queues a request sent with `X-Async-Background` (its presence is
  enough) and a bearer token that names a channel of bazis-ws (else 401), answering 202
  `{"data": null, "meta": {"async_request_id": <task id>}}`; without Kafka
  (`async_request.W001`) it runs the request at once and answers as usual. The result is
  `GET <result_path>?full_response=true` with the same token (403 with another one, 404
  for an unknown or expired task, `KAFKA_RESPONSE_HOLD_SEC`): `{status, channel_name,
  response}`, the status `created`, `pending`, `processing`, `completed` or `failed`;
  without `full_response` it is the response or `{"status": "not ready"}`, which a response
  cannot be told from. The response of a replayed request is `{task_id, endpoint, status,
  headers, response}`: an HTTP error there is a `completed` task. The queued request keeps
  the token, which must still be valid when the consumer runs it.

## Updating the copies

```bash
pip install -U bazis-front
python manage.py bazis_front update --check     # write nothing; list the changes, exit 1 if a copy is stale
python manage.py bazis_front update             # every copied asset
python manage.py bazis_front update react       # an asset with those it requires
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

The copies in `frontend/` stay those of the version that copied them until `update`
brings them to the installed bazis-front; the system check `front.W004` (run by
`bazis_doctor`, without Node and the database) reports a copy whose lock entry is not that
of the installed version, an asset that bazis-front no longer has or one that a new
version requires, and copies of the JSON Schemas in `spec/schema/` that differ;
`front.W007` a copy changed in the frontend (a file of a vendored asset or a component
whose hash differs from the lock; not the template), which every update merges and which
conflicts when both change the same lines. For each
file of a stale asset, from its pristine copy of the old version in
`.bazis/base/<asset>@<old>/` (the base), the file of the installed package (the upstream)
and the file of the frontend:

| The frontend | bazis-front | `update` |
|---|---|---|
| unchanged | changed or not | replaces it |
| changed | unchanged | keeps it |
| changed | changed | merges them with `git merge-file`; where both changed the same or adjacent lines, writes conflict markers |
| deleted | still has it | leaves it deleted |
| (none) | added it | adds it; a file of the product at its path fails the update |
| unchanged | removed it | deletes it; a file of the template is kept and reported |
| changed | removed it | keeps it: the product's from now on |
| changed, not text (an image) | changed | keeps it and reports it: merge it by hand |

- The merge needs Git (`git merge-file`), only for the files changed on both sides;
  without it such an update fails before anything is written. `\r\n` line ends are not
  supported: the copies and `.bazis/base/` are UTF-8 with `\n`, and a checkout that
  converts them (Git `core.autocrlf`) makes every copy changed in the frontend and every
  pristine copy differ from the lock. Keep the frontend in `\n` (`.gitattributes`:
  `frontend/** text eol=lf`).
- The stamp line `// bazis-front <version> asset <asset>` never conflicts: the three are
  compared at the new version, and every written file has the new stamp.
- The assets that a new version requires and the frontend lacks are copied as `add` copies
  them (a component of a package needs its capability in the contract); `update <asset>`
  also updates the assets it requires.
- Then the pristine copies of the new version replace the old ones in `.bazis/base/`, the
  lock records the new version and hashes, and the copies of the JSON Schemas in
  `spec/schema/` (when the product has it) are those of the package.
- Everything is read and merged first: an asset that cannot be updated (a missing or edited
  pristine copy, a file of the product at the path of a new file, a missing capability)
  fails the command and nothing is written.

### The template is the product's and is updated like the copies

**The template is the product's and is updated like the copies** (`package.json`, the
configs such as `playwright.config.ts` and `vite.config.ts`, `src/app/`, `src/screens/`,
`src/i18n/`, `AGENTS.md`, …; without the stamp line): a file the product did not change
is replaced by the new one, its changes are kept and merged with those of bazis-front
(conflicts as above), a file it deleted (the home screen) stays deleted, and a file that
bazis-front removed or renamed is never deleted: it is kept and reported, the product's
from now on. When `update` brings a new `package.json` (replaced, merged, added), run
`npm install` (`update` says so). A frontend made by a development version of bazis-front
that kept no pristine copy of the template (its lock entry `"template"` has only the
version) has no base for it: `update` adopts it without a merge, writes none of its files,
records the template of the new version as its base (`.bazis/base/template@<version>/`)
and lists the files that differ from it: review each against that copy and take what the
product lacks (a fix of `playwright.config.ts`); from then on they are changes of the
product. A file of the new template that the frontend lacks is listed as missing (new in
that version, or removed by the product): copy it from there if the product needs it.

- The theme is generated, not copied: run `bazis_front design` after `update` (`front.W005`
  reports a theme that the new version renders otherwise). A frontend made before the design
  layer has no theme: run `bazis_front design`, replace the variables of `:root` and `.dark`
  of its `src/index.css` with `@import './bazis/generated/theme.css';` (after the imports of
  Tailwind), and call `initColorMode()` of `@/bazis/ui/app-shell` in `src/main.tsx` before the
  render, as the new template does.

### Conflicts

**Conflicts.** When both changed the same or adjacent lines, `update` writes the file
with the markers of git and fails (exit 1), listing the files; the rest of the update is written, and the
lock and `.bazis/base/` are those of the new version, so a second `update` does not merge
again:

```text
<<<<<<< frontend
the lines of the frontend
=======
the lines of bazis-front <version>
>>>>>>> bazis-front <version>
```

Resolve every conflict in the listed files: keep the change of bazis-front (a fix of the
protocol, a new prop) and apply the change of the product over it, delete the markers,
then `npx tsc --noEmit`, `npm run lint` and `npm test` (the contract tests of the
components) in `frontend/`. `tsc` reports a marker left in a `.ts`/`.tsx` file (`TS1185`),
not in `package.json`, a config or `AGENTS.md`: the lock records the files of the conflicts
(`conflicts`), and until none of them has a marker line left `update --check` and
`front.W004` report them and `update` refuses to run. A file whose own content has such a
line (a marker on purpose, in a test or a document) is released by removing its path from
`conflicts` of the lock. Commit the frontend with
`.bazis/` and the lock. The client, the hooks and the helpers are never edited, so they
are replaced without conflicts; wrap them in the product code instead.

### Migrating the code of the product

`tsc` shows what a new version changes in the API of the copies; the changes so far:

- `NotificationCenter` takes its notifications: `notifications={useInbox(ROUTES['notify.notification'])}`
  with bazis-notify (its `onOpen` gets an `InboxNotification`: open `route`), else
  `notifications={useNotifications()}`; without it the bell is not shown and the console
  says so. The list is no longer read when it opens: a click marks a notification read,
  `action:read-notifications` all of them. The backend notifies with bazis-notify only (no
  second message of bazis-ws).
- `Notification.received` of `@/bazis/react/ws` is `time` (`received` is kept, deprecated).
- `FileView` shows the name of a file as a button that downloads it with the token
  (`onDownload`, `useDownload`), not a link: `UploadedFile.url` (the media URL) is
  deprecated, never link it; the file of a task of bazis-bg is `action:download` of
  `TaskProgress`.
- A custom action has its button only when `custom_actions` allows it (see
  [Custom actions and background work](#custom-actions-and-background-work)), not a meta
  field of the product.
- The query key of a custom action read with GET (`src/bazis/react/keys.ts`) has its query
  parameters after its name: `['bazis', path, 'action', name, <parameters>, scope]` and
  `['bazis', path, 'item', id, 'action', name, <parameters>, scope]` (`{}` without
  parameters, null while `query` is null), and `keys.action`/`keys.itemAction` take the
  parameters before the scope (`undefined` without any). A key of the product written as the
  whole key of the old shape no longer matches: match a prefix (`['bazis', path, 'action',
  name]`, every parameters), as the invalidation of a resource does. `useActionQuery` and
  `useItemActionQuery` require their `query` when the action has a required query parameter.
- `RelatedList` requires `itemPath`, the route set of the item of the card
  (`itemPath={<the path of the ResourceCard>}`): with it a related list placed after the card
  also reads the card again after an add, not only one in its `children`.
- The label of a related item is its display name before its identifiers (see "The label of
  an item"): a user with a first and a last name is `Ann Lee`, no longer his username, an
  item with `full_name` or `name` is shown by it, no longer by its e-mail. Change the
  scenarios that fill or find (`open_item`) a related item by its username or its e-mail to
  its name, give the test users of `e2e_data` the names the scenarios use, and add the
  fields of the label (`first_name`, `last_name`, `full_name`, `name`) to `search_fields` of
  the related route set, as `check` says (S017). `contract.json` is of format 4 (`reverse`):
  export the contract again.
- bazis-users 2.9 restricts the users that the other routes link and include
  (`restrict_queryset`): a user who is not staff links only himself, 403
  `ERR_RELATION_ACCESS` for another user (an assignee, an interviewer). A product whose users
  pick each other declares its user route set that lets them view and link the users they
  pick (see "The users that the pickers offer" in
  [Choices, filters, permissions and relationships](#choices-filters-permissions-and-relationships)).
- `ResourceForm` without `fields` shows and sends the to-many relationships of its schema
  (`RelationListPicker`; not the reverse ones): a section of the screen that changed the
  same relationship with `useRelationship` next to the form now repeats it. Remove the
  section (or name the fields of the form without the relationship), and change the
  scenarios that filled it in the section to fill it in the form (`fill: {field: [<label>,
  …]}`).
- The template formats its code with the prettier of its `package.json` (`npm run format`,
  see [The frontend](#the-frontend)): `update` merges its files formatted, so a file of the
  template that the product changed (`src/app/router.tsx`: the props of `AppShell`) may get a
  conflict once. Resolve it by taking the lines of the template, adding the changes of the
  product to them again, then `npm run format`; the links of `NAVIGATION` stay on their
  line (`// prettier-ignore`).

## API: the client

<!-- Generated by scripts/gen_api_reference.mjs from the TypeScript of the assets: never edit it, run `npm run api-reference`. -->

The exports of the protocol client, `frontend/src/bazis/client/` (see "The client").

### `@/bazis/client`

#### createClient

`createClient<Paths>(options?: ClientOptions): BazisClient<Paths>`: Creates a client of a Bazis API: `createClient<paths>({ baseUrl, token })`.

#### BazisClient

`interface BazisClient<Paths>`: A client of a Bazis API typed by the `paths` generated from its OpenAPI.

- `list<P extends RouteSetWith<Paths, '', 'get'>>(path: P, options?: ListOptions<EndpointOf<Paths, P, '', 'get'>>): Promise<ResponseOf<EndpointOf<Paths, P, '', 'get'>>>`
- `create<P extends RouteSetWith<Paths, '', 'post'>>(path: P, document: BodyOf<EndpointOf<Paths, P, '', 'post'>>, options?: ItemOptions<EndpointOf<Paths, P, '', 'post'>>): Promise<ResponseOf<EndpointOf<Paths, P, '', 'post'>>>`
- `retrieve<P extends RouteSetWith<Paths, Item, 'get'>>(path: P, id: string, options?: ItemOptions<EndpointOf<Paths, P, Item, 'get'>>): Promise<ResponseOf<EndpointOf<Paths, P, Item, 'get'>>>`
- `update<P extends RouteSetWith<Paths, Item, 'patch'>>(path: P, id: string, document: BodyOf<EndpointOf<Paths, P, Item, 'patch'>>, options?: ItemOptions<EndpointOf<Paths, P, Item, 'patch'>>): Promise<ResponseOf<EndpointOf<Paths, P, Item, 'patch'>>>`
- `destroy(path: RouteSetWith<Paths, Item, 'delete'>, id: string, options?: RequestOptions): Promise<void>`
- `relationship(path: RouteSetWith<Paths, Relationship, 'post'>, id: string, field: string, operation: RelationshipOperation, data: ResourceIdentifier | readonly ResourceIdentifier[] | null, options?: RequestOptions): Promise<void>`: Changes a relationship of an item: `add` (POST) adds to a to-many relationship, `replace` (PATCH) sets it, `remove` (DELETE) removes from it.
- `schema<K extends CollectionSchemaKind, P extends RouteSetWith<Paths, SchemaSuffix[K], 'get'>>(path: P, kind: K, options?: RequestOptions & IncludeOption<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>): Promise<ResponseOf<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>>`: The JSON schema of an action for the current user (`schema_list/`, `schema_create/`).
- `schema<K extends ItemSchemaKind, P extends RouteSetWith<Paths, SchemaSuffix[K], 'get'>>(path: P, kind: K, id: string, options?: RequestOptions & IncludeOption<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>): Promise<ResponseOf<EndpointOf<Paths, P, SchemaSuffix[K], 'get'>>>`: The JSON schema of an action on an item for the current user (`schema_update/`...).
- `filterFields<P extends RouteSetWith<Paths, 'route_filter_fields/', 'get'>>(path: P, options?: RequestOptions): Promise<ResponseOf<EndpointOf<Paths, P, 'route_filter_fields/', 'get'>>>`: The fields a list can be filtered by (`route_filter_fields/`).
- `transit<P extends RouteSetWith<Paths, '{item_id}/transit/', 'post'>>(path: P, id: string, transit: string, payload?: unknown, options?: RequestOptions): Promise<ResponseOf<EndpointOf<Paths, P, '{item_id}/transit/', 'post'>> | null>`: Runs a transit of bazis-statusy (`POST {item_id}/transit/`).
- `` action<P extends RouteSetPath<Paths>, N extends ActionName<Paths, P, M>, M extends HttpMethod = 'post'>(path: P, name: N, body?: BodyOf<EndpointOf<Paths, P, `${N}/`, M>>, ...options: ActionOptionsArg<M, QueryParams<EndpointOf<Paths, P, `${N}/`, M>>>): Promise<ResponseOf<EndpointOf<Paths, P, `${N}/`, M>>> ``: Calls a custom action of a route set, `<path><name>/` (a route of the backend declared with `@http_post('/<name>/')`, kind `other` in the contract): its JSON body (none for `get`), its query parameters (`query` of the options, required with a required parameter) and its JSON response, typed by the OpenAPI; resolves to undefined for 204.
- `` itemAction<P extends RouteSetPath<Paths>, N extends ActionName<Paths, P, M, Item>, M extends HttpMethod = 'post'>(path: P, id: string, name: N, body?: BodyOf<EndpointOf<Paths, P, `${Item}${N}/`, M>>, ...options: ActionOptionsArg<M, QueryParams<EndpointOf<Paths, P, `${Item}${N}/`, M>>>): Promise<ResponseOf<EndpointOf<Paths, P, `${Item}${N}/`, M>>> ``: Calls a custom action of an item, `<path><id>/<name>/`, as `action` does.
- `download(path: RouteSetWith<Paths, '{item_id}/download/', 'get'>, id: string, options?: RequestOptions): Promise<DownloadedFile>`: Reads a file from the download route of an item, `<path><id>/download/` (bazis-uploadable `FileUploadRouteSet`, bazis-bg `BgRoute`), with the token: its content and the name of `Content-Disposition`.
- `login(credentials: { username: string; password: string; }, options?: RequestOptions & { path?: string; }): Promise<TokenResponse>`: Gets a token from the token endpoint of bazis-users (an OAuth2 password form).
- `upload<P extends RouteSetWith<Paths, '', 'post'>>(path: P, file: Blob, options?: UploadOptions): Promise<ResponseOf<EndpointOf<Paths, P, '', 'post'>>>`: Uploads a file to a route set of bazis-uploadable (`FileUploadRouteSet` or a subclass): a `POST` of multipart form data with `file` (and `name`), sent with XMLHttpRequest, whose progress `onProgress` reports.
- `auth(path: string, options?: RequestOptions & { store?: string; }): Promise<AuthState>`: bazis-authing: the state of an authorization store, `GET` of its auth endpoint with the store token of `store` (a new store without one).
- `authLogin(path: string, store: string, body: unknown, options?: RequestOptions): Promise<AuthState>`: bazis-authing: a login action with a body in a store (`POST` of the password service, `{username, password}`); resolves to the state of the store, which its redirect to the auth endpoint answers.
- `authWait(path: string, store: string, options?: RequestOptions & { interval?: number; }): Promise<AuthState>`: bazis-authing: waits for a login in a page of a service (Google) in the store: asks the auth endpoint every `interval` ms until the store is signed in, has an error of a login, or has expired (the endpoint answers with another store).
- `authLogout(path: string, options?: RequestOptions): Promise<void>`: bazis-authing: `POST` of its logout endpoint (`logout_url` of the contract), at a sign-out: it deletes the stores of the request and their cookie (204, idempotent).
- `background(method: BackgroundMethod, path: string, options?: RequestOptions & { body?: unknown; }): Promise<BackgroundStart>`: bazis-async-request: sends a request of the API with `X-Async-Background` (a body as `application/vnd.api+json`).
- `backgroundResult(path: string, options?: RequestOptions): Promise<BackgroundResult>`: bazis-async-background: the state of a task, `GET` of its result path (`result_path` of the contract with its id) with `full_response=true`, with the token of the request that queued it (403 with another one, 404 for an unknown or expired task).

#### ClientOptions

`interface ClientOptions`

- `baseUrl?: string`: Prepended to every path, e.g. `https://api.example.com`; empty for the same origin.
- `token?: string | (() => MaybePromise<string | null | undefined>)`: The bearer token, or a function that returns the current one.
- `fetch?: typeof fetch`: The fetch implementation; the global `fetch` by default.
- `xhr?: () => XMLHttpRequest`: Creates the XMLHttpRequest of an upload (fetch reports no progress of a body); `new XMLHttpRequest()` by default.
- `language?: string | (() => string | null | undefined)`: The language of the interface, or a function that returns the current one: sent as `Accept-Language` on every request, so that the backend answers in it (the titles of the runtime schemas, the messages of the errors).

#### SchemaSuffix

`type SchemaSuffix`: The suffix of the endpoint of each runtime schema, after the path of the route set.

- `list: 'schema_list/'`
- `create: 'schema_create/'`
- `retrieve: '{item_id}/schema_retrieve/'`
- `update: '{item_id}/schema_update/'`
- `transit: '{item_id}/schema_transit/'`

#### dispositionName

`dispositionName(header: string | null): string | null`: The file name of a `Content-Disposition` header (Django `content_disposition_header`): `filename*=utf-8''<percent-encoded>` (a name that is not ASCII), else `filename="<name>"`.

#### saveFile

`saveFile(options: DownloadedFile, fallback?: string): void`: Saves a downloaded file in the browser under its name (`fallback` without one).

#### DownloadedFile

`interface DownloadedFile`: A file read from a download route: its content and the name the backend gives it.

- `blob: Blob`
- `name: string | null`: The file name of `Content-Disposition`; null without one.

#### ApiError

`class ApiError extends Error`: A response with an error status: 400 (e.g. `ERR_FILTER`), 401, 403, 404, 422...

- `readonly name: "ApiError"`
- `constructor(status: number, errors: readonly ErrorObject[])`
- `fieldErrors(): Record<string, string[]>`: The messages of the errors of attributes and relationships of the item, by their name (`source.pointer` `/data/attributes/<name>`, `/data/relationships/<name>`), for forms.
- `bodyErrors(): Record<string, string[]>`: The messages of the errors of the fields of a JSON body that is not a JSON:API document (the body of a custom action, `client.action`), by their name: `source.pointer` `/<name>` (an error of a nested value belongs to its field, `/<name>/0`); the others (of the body as a whole, of a parameter: `/query/…`, `/header/…`, `/cookie/…`, of the request) are not given.
- `formErrors(): FormError[]`: The errors that `fieldErrors()` does not give, for the form as a whole: of the item (`/data`), of an included item (`/included/<index>`), of a parameter or of the request; all the errors of a relationships endpoint.

#### ErrorObject

`interface ErrorObject`: An error object of a Bazis error response (`SchemaError` of the core).

- `status?: number | string`
- `title?: string | null`
- `code?: string | null`
- `detail?: string | null`
- `source?: { pointer?: string | null; parameter?: string | null; id?: string | null; type?: string | null; } | null`
- `meta?: Record<string, unknown> | null`
- `traceback?: string | null`

#### FormError

`interface FormError`: An error of a request that is not of a field of its item: of the item as a whole (`/data`, an invariant of `validate_item`: `ERR_ITEM_INVALID`; `/data/id`), of an included item (`/included/<index>`, of its field `field`), of a parameter or of the request.

- `message: string`
- `included: number | null`: The index of the included item in `included` of the document, null for the item itself.
- `field: string | null`: The attribute or relationship of the included item, null for the whole item.

#### Filter

`class Filter`: The `filter` expression of a Bazis list, as parsed by `bazis.core.utils.query_complex`: conditions `key=value` combined with `&` and `|`, grouped with parentheses and negated with `~`.

- `static where(key: string, value: FilterValue | readonly FilterValue[]): Filter`: The condition `key=value`.
- `static and(...filters: readonly Filter[]): Filter`: All the filters must match.
- `static or(...filters: readonly Filter[]): Filter`: At least one of the filters must match.
- `static not(filter: Filter): Filter`: The filter must not match.
- `toString(): string`: The expression, before it is encoded as the `filter` query parameter.

#### nextPage

`nextPage(document: ListDocument): Page | null`: The page after this one, to pass as `page` of the next `list`; null on the last page.

#### pagination

`pagination(document: ListDocument): PaginationMeta | null`: The total count, limit and offset; null unless the list was requested with this meta.

#### prevPage

`prevPage(document: ListDocument): Page | null`: The page before this one; null on the first page.

#### PaginationLinks

`interface PaginationLinks`: `links` of a list response (`PaginationLinks` of the core); absent links are null.

- `first?: string | null`
- `last?: string | null`
- `prev?: string | null`
- `next?: string | null`

#### PaginationMeta

`interface PaginationMeta`: `meta.pagination` of a list response requested with `meta: ['pagination']`.

- `count: number`
- `limit: number`
- `offset: number`

#### can

`can(meta: PermitMeta | null | undefined, action: 'change' | 'delete', id: string): boolean`: Whether the backend reports the action as allowed for the current user.

`can(meta: PermitMeta | null | undefined, action: CrudAccessAction | CustomActionName): boolean`

#### PermitMeta

`interface PermitMeta`: The meta fields of a `PermitRouteBase` route, returned when requested with `meta`: on a list `for_change`, `for_delete` (the ids of the page) and `for_create`; on an item (retrieve, create, update) `crud_actions`; `custom_actions` (bazis-permit 2.11) the custom actions the user may call, those of the collection on a list, those of the item on an item, by what they declare (`public`, `access_action`): a check an action makes in its own code is not in it.

- `for_change?: readonly string[] | null`
- `for_delete?: readonly string[] | null`
- `for_create?: boolean | null`
- `crud_actions?: readonly string[] | null`
- `custom_actions?: readonly string[] | null`

#### ActionOptions

`interface ActionOptions<M extends HttpMethod, Query = never> extends RequestOptions`: The options of a custom action: the method (`post` by default) and the query parameters of its operation (`Query`, those of its OpenAPI), sent as `?<name>=<value>`: a list repeats the parameter, a null or undefined value is left out.

- `method?: M`
- `query?: Query`

#### AuthAction

`interface AuthAction`: A login action of bazis-authing (`meta.actions` of its auth endpoint, `actions` of the contract).

- `code: string`: The service: `password`, `google`...
- `name: string`
- `method: string`: `POST` (a body, such as the username and the password) or `GET` (a page of the service, opened in the browser).
- `url: string`

#### AuthState

`type AuthState`: The state of an authorization store of bazis-authing: signed in, with the user and the session token; or not, with the store token (never a session token: a request with it is anonymous) and the errors of the logins of the store (`USERNAME_PASSWORD_ERROR`, `GOOGLE_AUTH_ERROR`...).

- either: `status: 'signed_in'`; `user: AuthUser`
- or: `status: 'signed_out'`; `store: string`; `errors: readonly ErrorObject[]`

#### AuthUser

`interface AuthUser`: The user that the auth endpoint of bazis-authing returns, with the session token.

- `user_id: string | number`
- `username: string`
- `first_name: string | null`
- `last_name: string | null`
- `email: string | null`
- `token: string`: The session token (a JWT of bazis-users): send it as the bearer token.
- `logout_actions: readonly Readonly<Record<string, unknown>>[] | null`

#### BackgroundResult

`interface BackgroundResult`: The state of a task of bazis-async-background (its result with `full_response=true`): its status and its response, null until the task sets one.

- `status: BackgroundStatus`
- `response: unknown`

#### BackgroundStart

`type BackgroundStart`: How a request sent with `X-Async-Background` was answered: queued (202 of bazis-async-request with Kafka) with the id of its task, or run at once (no Kafka, or the middleware is not added) with the body of its response (undefined for 204).

- either: `status: 'queued'`; `taskId: string`
- or: `status: 'done'`; `response: unknown`

#### ListOptions

`type ListOptions<Operation>`: The query of a list.

- and the members of `RequestOptions`
- and the members of `FieldsOption<Operation>`
- and the members of `MetaOption<Operation>`
- `filter?: Filter`
- `search?: string`
- `sort?: readonly string[]`: Field names, `-` before a name for the descending order.
- `page?: Page`

#### Page

`interface Page`: `page[limit]` and `page[offset]`.

- `limit?: number`
- `offset?: number`

#### ReplayedResponse

`interface ReplayedResponse`: The response of a request replayed by bazis-async-request, the response of its task: an HTTP error is a `completed` task with its status.

- `task_id: string`
- `endpoint: string`
- `status: number`
- `headers: readonly (readonly [ string, string ])[]`
- `response: unknown`

#### RequestOptions

`interface RequestOptions`: Options of every request.

- `signal?: AbortSignal`

#### ResourceIdentifier

`interface ResourceIdentifier`: A resource identifier of a relationship.

- `type: string`
- `id: string`

#### TokenResponse

`interface TokenResponse`: The response of the token endpoint of bazis-users.

- `access_token: string`
- `token_type: string`

#### UploadOptions

`interface UploadOptions extends RequestOptions`: The options of an upload of bazis-uploadable.

- `name?: string`: The name of the file (`name` of the form); the backend takes the name of the file by default.
- `onProgress?: (progress: UploadProgress) => void`: Called while the body is sent.

#### UploadProgress

`interface UploadProgress`: The progress of an upload: the bytes of the body sent, of `total`.

- `loaded: number`
- `total: number`

#### The types and the constants of `@/bazis/client`

- `AUTH_POLL_INTERVAL: 1500`: How often `authWait` asks the auth endpoint of bazis-authing, in milliseconds.
- `BACKGROUND_HEADER: "X-Async-Background"`: The header that asks bazis-async-request to run a request in the background (`async_request` of the contract).
- `TOKEN_PATH: "/api/openapi-token/"`: The default path of the token endpoint of bazis-users (`BAZIS_OPENAPI_TOKEN_URL`).
- `type CollectionSchemaKind = 'list' | 'create'`: Runtime schemas of a route set; `transit` exists on bazis-statusy route sets.
- `type ItemSchemaKind = 'retrieve' | 'update' | 'transit'`
- `type RelationshipOperation = 'add' | 'replace' | 'remove'`
- `type FilterValue = string | number | boolean | null`: A value of a filter condition; `null` is sent as `null`, booleans as `true`/`false`.
- `type CrudAccessAction = 'view' | 'change' | 'add' | 'delete' | 'check'`: The access actions of the core (`CrudAccessAction`) checked by bazis-permit.
- `` type CustomActionName = `action_${string}` ``: A custom action of a route set by its name, `action` of `x-bazis` in the OpenAPI (the method of the route set: `action_export`), as `custom_actions` lists it.
- `` type ActionName<Paths, P extends string, M extends HttpMethod, Prefix extends string = ''> = { [K in keyof Paths & string]: K extends `${P}${Prefix}${infer Name}/` ? Name extends '' | `${string}/${string}` | `{${string}` ? never : [ OperationOf<Paths, K, M> ] extends [ never ] ? never : Name : never; }[keyof Paths & string] ``: The names of the custom actions of the route set `P` for the method `M`: the endpoints `<P><Prefix><name>/` that the backend declares (`@http_post('/<name>/')` of a route set), `Prefix` `{item_id}/` for those of an item.
- `type ActionOptionsArg<M extends HttpMethod, Query> = [ Query ] extends [ never ] ? [ options?: ActionOptions<M> ] : object extends Query ? [ options?: ActionOptions<M, Query> ] : [ options: ActionOptions<M, Query> & { query: Query; } ]`: The options argument of a custom action whose query parameters are `Query`: required, with its `query`, when the operation has a required query parameter (`code: str` of the backend), optional otherwise.
- `type BackgroundMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`: The methods of a request that bazis-async-request runs in the background.
- `type BackgroundStatus = 'created' | 'pending' | 'processing' | 'completed' | 'failed'`: The statuses of a task of bazis-async-background: `created` (registered, not sent to Kafka yet), `pending` (queued), `processing`, then `completed` or `failed`.
- `type BodyOf<Operation> = Operation extends { requestBody: { content: infer Content; }; } ? JsonContent<Content> : never`: The JSON request body of an operation.
- `` type EndpointOf<Paths, P extends string, Suffix extends string, M extends HttpMethod> = OperationOf<Paths, `${P}${Suffix}`, M> ``: The operation of the endpoint `<P><Suffix>` for the method `M`.
- `type HttpMethod = 'get' | 'post' | 'patch' | 'delete'`
- `type ItemOptions<Operation> = RequestOptions & FieldsOption<Operation> & IncludeOption<Operation> & MetaOption<Operation>`: The query of an operation on one item.
- `type QueryParams<Operation> = Operation extends { parameters: { query?: infer Query; }; } ? [ NonNullable<Query> ] extends [ never ] ? never : NonNullable<Query> : never`: The query parameters of an operation as its OpenAPI declares them (`parameters.query`: the arguments of a route of the backend that are neither in its path nor in its body, such as `code: str` of `@http_get('/check/')`); `never` when it has none.
- `type ResponseOf<Operation> = Operation extends { responses: infer Responses; } ? Responses[Extract<keyof Responses, 200 | 201 | '200' | '201'>] extends { content: infer Content; } ? JsonContent<Content> : never : never`: The JSON body of the successful (200 or 201) response of an operation.
- `` type RouteSetPath<Paths> = { [P in keyof Paths & string]: `${P}{item_id}/` extends keyof Paths ? P : never; }[keyof Paths & string] ``: The paths of the route sets: the paths that have an item path `<path>{item_id}/`.
- `` type RouteSetWith<Paths, Suffix extends string, M extends HttpMethod> = { [P in RouteSetPath<Paths>]: [ OperationOf<Paths, `${P}${Suffix}`, M> ] extends [ never ] ? never : P; }[RouteSetPath<Paths>] ``: The route sets whose endpoint `<path><Suffix>` has the method `M`.

## API: the hooks

The exports of the React hooks, `frontend/src/bazis/react/` (see "The hooks").

### `@/bazis/react`

#### BazisProvider

`BazisProvider(props: BazisProviderProps): Element`: Gives the hooks the client, the session and the language; inside the `QueryClientProvider`.


Its props, `BazisProviderProps`:

- `client: Api`: The client of the backend (`createClient<paths>()`).
- `session: string`: The current session: a value that changes whenever a user logs in or out, such as a number of the session (never the token).
- `language?: string | undefined`: The language of the interface, which the client sends to the backend (`Accept-Language`): every query key of the hooks ends with it too, so that the texts of the backend (the titles of the schemas, the names of the statuses) of one language are never shown in another.
- `children: ReactNode`

#### useApi

`useApi(): Api`: The client of the backend.

#### useSessionKey

`useSessionKey(): string`: The scope of `BazisProvider`, the session and the language: the last item of the key of a query of the product's own that reads data of the current user or texts of the backend.

#### useAction

`useAction<P extends ActionPath, N extends ActionName<paths, P, M>, M extends HttpMethod = 'post'>(path: P, name: N, options?: ActionHookOptions<M>): ActionMutation<ActionResponse<P, N, M>, ActionVariables<ActionBody<P, N, M>>>`: A custom action of a route set, `<path><name>/`: `mutate(body)` calls it (`client.action`) and resolves to its response, e.g. the id of a task of bazis-bg to follow.

#### useActionQuery

`useActionQuery<P extends ActionPath, N extends ActionName<paths, P, 'get'>>(path: P, name: N, ...options: ActionQueryArg<ActionQuery<P, N, 'get'>>): UseQueryResult<ActionResponse<P, N, 'get'>>`: A custom action of a route set declared with GET, `<path><name>/`, read as a query (the response of `client.action` with the method `get` and the query parameters of `query`, required with a required parameter): a summary, a report, a check, the content that a screen shows.

#### useItemAction

`useItemAction<P extends ActionPath, N extends ActionName<paths, P, M, Item>, M extends HttpMethod = 'post'>(path: P, name: N, options?: ActionHookOptions<M>): ActionMutation<ActionResponse<P, N, M, Item>, { id: string; body?: ActionBody<P, N, M, Item>; }>`: A custom action of an item, `<path><id>/<name>/`: `mutate({id, body})` (`client.itemAction`).

#### useItemActionQuery

`useItemActionQuery<P extends ActionPath, N extends ActionName<paths, P, 'get', Item>>(path: P, id: string | null, name: N, ...options: ActionQueryArg<ActionQuery<P, N, 'get', Item>>): UseQueryResult<ActionResponse<P, N, 'get', Item>>`: A custom action of an item declared with GET, `<path><id>/<name>/`, read as a query (`client.itemAction` with the method `get` and the query parameters of `query`); nothing is read while `id` or `query` is null.

#### useDownload

`useDownload(path: DownloadPath): UseMutationResult<string | null, Error, string>`: Downloads the file of an item from the download route of its route set (`<path><id>/download/`, with the token: never the URL of the media host, which serves a file to anyone who has its link) and saves it under the name the backend gives it: `mutate(id)` resolves to that name (the content is not kept); its `error` is the `ApiError` (404: a file the user does not see).

#### useDownloadUrl

`useDownloadUrl(path: DownloadPath, id: string | null): string | null`: The content of the file of an item as an object URL (the thumbnail of an image), read from its download route while `id` is not null; null until it is read (or when it fails).

#### ActionHookOptions

`interface ActionHookOptions<M extends HttpMethod>`

- `method?: M`: The method of the action, `post` by default.
- `invalidate?: boolean`: Refetch the queries of the resource after the action (true by default).

#### ActionMutation

`type ActionMutation<Response, Variables>`: A mutation of an action, with the errors of its body by field (`ApiError.bodyErrors()` of the last call: a 422 of the validation of the body, `/<field>`); its `error` is the `ApiError` (`StatePanel` `errorState(error)` shows it).

- and the members of `UseMutationResult<Response, Error, Variables>`
- `errors: Readonly<Record<string, readonly string[]>>`

#### ActionQueryOptions

`interface ActionQueryOptions<Query>`

- `query?: Query | null`: The query parameters of the action (`?<name>=<value>`), typed by its OpenAPI and in the key of the query: other parameters are another query.

#### useCreate

`useCreate<P extends CreatePath>(path: P): UseMutationResult<CreateResponse<P>, Error, CreateDocument<P>>`: Creates an item: `mutate(document)`.

#### useDestroy

`useDestroy(path: DestroyPath): UseMutationResult<void, Error, string>`: Deletes an item: `mutate(id)`.

#### useRefreshItem

`useRefreshItem(path: ItemPath, id: string): () => Promise<void>`: Reads an item again: the function it returns marks every query of the item stale (its retrieves, its schemas, the responses of its GET actions) and refetches the active ones, after a change that the backend makes to it through another resource (a related item added or deleted changes its computed fields, its transits).

#### useRelationship

`useRelationship(path: RelationshipPath): UseMutationResult<void, Error, RelationshipChange>`: Changes a relationship of an item through its relationship endpoint: `mutate({id, field, operation, data})`; `add` and `remove` change a to-many relationship.

#### useUpdate

`useUpdate<P extends UpdatePath>(path: P): UseMutationResult<UpdateResponse<P>, Error, { id: string; document: UpdateDocument<P>; }>`: Updates an item: `mutate({id, document})`.

#### QueryOptions

`interface QueryOptions`: The options of a list or a retrieve, as they are in a key.

- `filter?: Filter | undefined`
- `search?: string | undefined`
- `sort?: readonly string[] | undefined`
- `page?: { limit?: number; offset?: number; } | undefined`
- `fields?: Readonly<Record<string, readonly string[] | undefined>> | undefined`
- `include?: readonly string[] | undefined`
- `meta?: readonly string[] | undefined`

#### useCan

`useCan(path: SchemaPath<'list'>, action: 'view'): boolean | undefined`: Whether the backend lets the current user view the items of a route set (`view`) or add one (`add`): the runtime schema of the list or of the create, which bazis-permit refuses with 403 without a permission of the model for the action (`<app>.<model>.item.view|add.*` of his role).

`useCan(path: SchemaPath<'create'>, action: 'add'): boolean | undefined`

`useCan(path: ListPath, action: CustomActionName): boolean | undefined`

#### useFilterFields

`useFilterFields<P extends FilterFieldsPath>(path: P): UseQueryResult<FilterFields<P>>`: The fields a list can be filtered by (`route_filter_fields/`), with their types.

#### useItem

`useItem<P extends ItemPath>(path: P, id: string, query?: ItemQuery<P>): UseQueryResult<ItemResponse<P>>`: An item: `include`, `fields` and `meta` as in `api.retrieve`.

#### useList

`useList<P extends ListPath>(path: P, query?: ListQuery<P>): UseQueryResult<ListResponse<P>>`: A page of a list: `filter`, `search`, `sort`, `page`, `fields` and `meta` as in `api.list`.

#### useSchema

`useSchema<K extends CollectionSchemaKind>(path: SchemaPath<K>, kind: K): UseQueryResult<JsonSchema>`: The runtime schema of an action for the current user: `list` and `create` of the route set, `retrieve`, `update` and `transit` (bazis-statusy) of an item.

`useSchema<K extends ItemSchemaKind>(path: SchemaPath<K>, kind: K, id: string): UseQueryResult<JsonSchema>`

#### useResourceForm

`useResourceForm<P extends CreatePath>(path: P, options?: { id?: undefined; fixed?: FixedValues; }): ResourceForm<CreateResponse<P>>`: A form of a resource bound to its runtime schema: `schema_create/` without an id, `schema_update/` of the item with one, so that the fields are those the current user may set.

`useResourceForm<P extends UpdatePath>(path: P, options: { id: string; fixed?: FixedValues; }): ResourceForm<UpdateResponse<P>>`

#### ResourceForm

`interface ResourceForm<Saved>`

- `status: 'loading' | 'error' | 'ready'`: `loading` until the schema (and the item) are loaded, `error` if they failed.
- `error: Error | null`: The error of loading the schema or the item (403, 404, ...).
- `type: string`: The JSON:API type of the resource of the schema; empty until it is loaded.
- `fields: readonly FormField[]`: The fields of the runtime schema in its order; the user may not change `readOnly` ones.
- `values: Readonly<Record<string, unknown>>`: The value of every field: the value of an attribute, the id of the related item of a to-one relationship (null for none), the ids of the related items of a to-many one (an array).
- `setValue(name: string, value: unknown): void`
- `dirty: readonly string[]`: The fields whose value differs from the initial one; only they are submitted.
- `errors: Readonly<Record<string, readonly string[]>>`: The validation errors of the last submit by field (`ApiError.fieldErrors()`).
- `submitError: Error | null`: The error of the last submit, also when it has errors by field.
- `isSubmitting: boolean`
- `submit(): Promise<Saved | null>`: Creates or updates the item with the changed fields.
- `reset(): void`: Forgets the changes and the errors of the last submit.

#### choiceLabel

`choiceLabel(field: FormField | undefined, value: unknown): string | null`: The label of a value of a field with choices (`labels`, the `enumDict` of Bazis: in the language of the request), null for a value without one or another field.

#### objectFields

`objectFields(schema: JsonSchema): AttributeField[]`: The properties of the JSON Schema of an object as attributes, such as the payload of a transit (`Transit.payload` of `@/bazis/react/statusy`).

#### resourceSchema

`resourceSchema(schema: JsonSchema): ResourceSchema`: The resource of a runtime schema: of a create or an update (the fields the user may set), of a retrieve or of a list (the fields the user may see, with their titles).

#### useRelatedItem

`useRelatedItem<P extends ListPath>(path: P, id: string): UseQueryResult<ListItem<P> | null>`: A related item, to show its label: an item of the list of the resource (no meta, the fields of the list), read in one request with the other items of the resource that the page asks for at the same time; `null` when the user may not view it.

#### AttributeField

`interface AttributeField extends FieldBase`

- `kind: 'attribute'`
- `type: string | null`: The JSON Schema type (`string`, `integer`, `number`, `boolean`, `object`, `array`).
- `format: string | null`: `date-time`, `date`, `time`, `uuid`, ...
- `enum: readonly unknown[] | null`: The allowed values (the choices of the model field).
- `blank: boolean`: The empty string is a value of the field besides those of its type and format: a `URLField` with `blank=True` (an alternative `{type: 'string', maxLength: 0}` next to the URL).
- `labels: Readonly<Record<string, string>> | null`: The labels of the choices by the value as text (`enumDict` of Bazis: the labels of the choices of the model field, in the language of the request); null without them.
- `schema: JsonSchema`: The schema of the attribute (`maxLength`, `minimum`, `default`, ...).

#### RelationField

`interface RelationField extends FieldBase`

- `kind: 'relation'`
- `relation: string`: The JSON:API type of the related resource.
- `many: boolean`: A to-many relationship: its value in a form is the ids of the related items.

#### ResourceSchema

`interface ResourceSchema`: The resource of a runtime schema: its JSON:API type and its fields in schema order.

- `type: string`
- `fields: FormField[]`

#### RelationshipChange

`interface RelationshipChange`: A change of a relationship of an item: `useRelationship(path).mutate(change)`.

- `id: string`
- `field: string`
- `operation: RelationshipOperation`: `add` to and `remove` from a to-many relationship, `replace` any relationship
- `data: ResourceIdentifier | readonly ResourceIdentifier[] | null`

#### The types and the constants of `@/bazis/react`

- `type Api = BazisClient<paths>`: The client of the backend, typed by the generated `paths`.
- `BazisProviderProps`: the props of `BazisProvider`, listed with it
- `type DownloadPath = RouteSetWith<paths, '{item_id}/download/', 'get'>`: A route set with the download route of its items (bazis-uploadable, bazis-bg).
- `` type ActionBody<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = BodyOf<EndpointOf<paths, P, `${Prefix}${N}/`, M>> ``: The body of the action `N` of the route set `P` (`<P><Prefix><N>/`) for the method `M`.
- `type ActionPath = RouteSetPath<paths>`: A route set: the path of its collection.
- `` type ActionQuery<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = QueryParams<EndpointOf<paths, P, `${Prefix}${N}/`, M>> ``: The query parameters of the action `N` of the route set `P` for the method `M`, as its OpenAPI declares them.
- `type ActionQueryArg<Query> = [ Query ] extends [ never ] ? [ options?: ActionQueryOptions<never> ] : object extends Query ? [ options?: ActionQueryOptions<Query> ] : [ options: ActionQueryOptions<Query> & { query: Query | null; } ]`: The options argument of a query of an action whose query parameters are `Query`: required, with its `query` (or null), when the action has a required query parameter, optional otherwise.
- `` type ActionResponse<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = ResponseOf<EndpointOf<paths, P, `${Prefix}${N}/`, M>> ``: The response of the action `N` of the route set `P` for the method `M`.
- `type ActionVariables<Body> = [ Body ] extends [ never ] ? undefined : Body`: What `mutate` of an action takes: its body, `undefined` for an action without one (a GET).
- `type Can = 'view' | 'add' | CustomActionName`: What a user may do on a route set: view its items (its list), add one, call a custom action of the collection.
- `type FixedValues = Readonly<Record<string, unknown>>`: The values of fields that the screen sets and the user does not change, by name: the attribute value, or the id of the related item of a to-one relationship (the parent of an item added from its card, `{request: id}`).
- `RELATED_BATCH: 50`: The most ids of one request: its URL stays short.
- `type ListItem<P extends ListPath> = ListResponse<P> extends { data: readonly (infer T)[]; } ? T : never`: An item of the list of a resource.
- `type FormField = AttributeField | RelationField`
- `type CreateDocument<P extends CreatePath> = BodyOf<CreateOperation<P>>`
- `type CreatePath = RouteSetWith<paths, '', 'post'>`
- `type CreateResponse<P extends CreatePath> = ResponseOf<CreateOperation<P>>`
- `type ItemPath = RouteSetWith<paths, Item, 'get'>`
- `type ItemQuery<P extends ItemPath> = Omit<ItemOptions<ItemOperation<P>>, 'signal'>`: The options of `retrieve` without `signal`: include, fields, meta.
- `type ItemResponse<P extends ItemPath> = ResponseOf<ItemOperation<P>>`
- `type JsonSchema = Readonly<Record<string, unknown>>`: A JSON Schema as the backend returns it (the runtime schemas, the bodies of transits).
- `type ListPath = RouteSetWith<paths, '', 'get'>`
- `type ListQuery<P extends ListPath> = Omit<ListOptions<ListOperation<P>>, 'signal'>`: The options of `list` without `signal`: filter, search, sort, page, fields, meta.
- `type ListResponse<P extends ListPath> = ResponseOf<ListOperation<P>>`
- `type UpdateDocument<P extends UpdatePath> = BodyOf<UpdateOperation<P>>`
- `type UpdatePath = RouteSetWith<paths, Item, 'patch'>`
- `type UpdateResponse<P extends UpdatePath> = ResponseOf<UpdateOperation<P>>`

## API: the hooks of the packages and the language

The hooks copied with a package (`frontend/src/bazis/react/<package>/`), and the translations and the formats, `frontend/src/bazis/i18n/` (see "The language").

### `@/bazis/react/statusy`

#### transits

`transits(document: { meta?: { state_actions?: readonly (StateAction | readonly StateAction[])[] | null; } | null; }): readonly Transit[]`: The transits of `meta.state_actions` of a retrieve.

#### useTransit

`useTransit<P extends TransitPath>(path: P, id: string): UseMutationResult<TransitResponse<P> | null, Error, { transit: string; payload?: unknown; }>`: Runs a transit of the item: `mutate({transit, payload})`.

#### useTransits

`useTransits(path: TransitPath, id: string): UseQueryResult<readonly Transit[]>`: The transits that the current user may run on the item now, from `meta: ['state_actions']` of its retrieve (the query of `useItem` with this meta).

#### Transit

`interface Transit`: A transit that the current user may run on the item.

- `id: string`: The id of the transit; its name is in `TRANSITS` of `contract.ts`.
- `allowed: boolean`: No validator restricts it: running it is expected to succeed.
- `restricts: readonly TransitRestrict[]`
- `payload: JsonSchema | null`: The JSON Schema of the payload that it requires; null when it takes none.
- `hint: string | null`
- `hintTitle: string | null`
- `hintAction: string | null`
- `resource: { type: string; id: string; }`: The item that it changes: the item itself, or a related one for `related`.
- `related: readonly Transit[]`: The transits of related items that run with it.

#### TransitRestrict

`interface TransitRestrict`: An error of a validator of a transit (`StateActionRestrictsSchema`).

- `title: string`
- `code: string`
- `detail: string | null`
- `meta: Readonly<Record<string, unknown>> | null`

#### The types and the constants of `@/bazis/react/statusy`

- `type TransitPath = RouteSetWith<paths, TransitSuffix, 'post'>`: The route sets of statusy models (`StatusyRouteSetBase`).
- `type TransitResponse<P extends TransitPath> = ResponseOf<EndpointOf<paths, P, TransitSuffix, 'post'>>`

### `@/bazis/react/uploadable`

#### useUpload

`useUpload<P extends UploadPath>(path: P): Upload<UploadResponse<P>>`: The upload of files to a route set of bazis-uploadable (`ROUTES['uploadable.file_upload']`): one at a time, with its progress; it refetches the queries of the route set.

#### Upload

`interface Upload<Item>`: The upload of a file to a route set of bazis-uploadable.

- `upload: (file: File, options?: { name?: string; }) => Promise<Item | null>`: Uploads a file (after the one running is aborted): resolves to the created item, or to null when it is aborted; rejects with the error of the backend (an `ApiError`: 413 `ERR_FILE_TOO_LARGE`, 401, 403...) or of the network, also in `error`.
- `abort: () => void`: Aborts the upload that is running: back to `idle`.
- `reset: () => void`: Forgets the last upload (its item or its error).
- `status: 'idle' | 'uploading' | 'success' | 'error'`
- `progress: UploadProgress | null`: The bytes sent while the file uploads; null otherwise.
- `error: Error | null`
- `data: Item | undefined`: The created item of the last upload.

#### The types and the constants of `@/bazis/react/uploadable`

- `type UploadPath = CreatePath`: The route sets that create an item: those of the uploaded files among them.
- `type UploadResponse<P extends UploadPath> = CreateResponse<P>`

### `@/bazis/react/ws`

#### useLiveQueries

`useLiveQueries(routes: Readonly<Record<string, string>>, options?: LiveQueriesOptions): void`

#### backgroundStatusOf

`backgroundStatusOf(message: unknown): { taskId: string; status: string; } | null`: The status of a task of bazis-async-background that a message carries; null for another message.

#### changedResource

`changedResource(message: unknown): { resource: string; id: string | null; } | null`: The resource (and the item) that a message says changed; null for another message.

#### notificationOf

`notificationOf(message: unknown, key: number, time: Date): Notification | null`: The notification of a message (numbered `key`), null for another message.

#### notificationsChanged

`notificationsChanged(message: unknown): boolean`: Whether a message says that the stored notifications of the user changed (bazis-notify).

#### Notification

`interface Notification`: A notification of the user, as received.

- `key: number`: Its number in the page, from 1: the later, the greater.
- `title: string`
- `text: string | null`
- `resource: string | null`: The JSON:API type and the id of the item it is about.
- `id: string | null`
- `time: Date`: When it was received.
- `received: Date`
- `read: boolean`

#### LiveQueriesOptions

`interface LiveQueriesOptions`: Refetches what the messages of the socket say changed: the queries of a resource (`['bazis', path]`, by its type in `routes`, `ROUTES` of the contract) for `{"resource", "id"}` and a notification about an item, the state of a task of bazis-async-background (`useAsyncTask`) for its status, the stored notifications of bazis-notify (`useInbox`) for a message of theirs, by `notifications`, their resource (`CAPABILITIES.notify.resource`; `LiveQuery` gives it).

- `notifications?: string | null | undefined`: The resource of the stored notifications of bazis-notify (`CAPABILITIES.notify.resource`); none without it.

#### reconnectDelay

`reconnectDelay(failures: number): number`: The delay before the attempt after `failures` failed ones: doubled each time, with jitter.

#### SocketProvider

`SocketProvider(props: SocketProviderProps): Element`: Opens the socket of bazis-ws for the hooks below it (`useSocket`, `useChannel`, `useLiveQueries`, `useNotifications`); inside `BazisProvider`.


Its props, `SocketProviderProps`:

- `path: string | null`: The path of the socket on the origin of the page (`CAPABILITIES.ws.path`; the dev server proxies it), or a `ws://`/`wss://` URL; null for no socket.
- `token: string | null`: The token of the session (a JWT of bazis-users with `exp`), or an anonymous token of bazis-ws (16 to 128 characters `A-Z a-z 0-9 _ -`, generated by the client); null for no socket (a logout closes it).
- `children: ReactNode`

#### socketUrl

`socketUrl(path: string): string`: The URL of the socket: a path on the origin of the page, or a URL.

#### useChannel

`useChannel(handler: (message: unknown) => void): void`: Calls the handler with every message of the channels of the session: the published JSON parsed (its text when it is not JSON).

#### useNotifications

`useNotifications(): { items: readonly Notification[]; unread: number; markRead: (key?: number) => void; clear: () => void; }`: The notifications received in this session, the newest first (at most `NOTIFICATIONS_KEPT`): pub/sub keeps nothing, so those published before the page subscribed are not there (the stored notifications are those of bazis-notify, `useInbox`).

#### useSocket

`useSocket(): { status: SocketStatus; error: string | null; retry: () => void; }`: The state of the socket: `status`, the `error` of a refused token, and `retry()`, an attempt now instead of after the delay (the action of `unavailable`).

#### The types and the constants of `@/bazis/react/ws`

- `NOTIFICATIONS_KEPT: 50`: The notifications kept, the newest first.
- `PING_INTERVAL: 25000`: How often the page pings the server: a socket that answered nothing since the last ping is dead.
- `RECONNECT_MAX: 30000`
- `RECONNECT_MIN: 1000`: The first delay before a new attempt to connect, in milliseconds; it doubles up to `RECONNECT_MAX`.
- `STABLE_AFTER: 10000`: How long a live connection lasts before the backoff starts again from `RECONNECT_MIN`.
- `UNAVAILABLE_AFTER: 5`: The handshakes failed in a row after which the socket is `unavailable`.
- `SocketProviderProps`: the props of `SocketProvider`, listed with it
- `type SocketStatus = 'idle' | 'connecting' | 'open' | 'rejected' | 'unavailable'`: `idle`: no socket (no path or no token); `connecting` (also between two attempts, and until the server sent `subscribed`); `open`: the server took the token, the messages of its channels come; `rejected`: the server refused the token (`error`: `expired_token`, `invalid_token`, `user_not_found`; a close with 1008), no new attempt until the token changes; `unavailable`: `UNAVAILABLE_AFTER` handshakes failed in a row (no socket at the path, the server is down or restarts, no network): the attempts go on at the longest delay, and at once when the network comes back, the page is shown again or `retry()`.

### `@/bazis/react/notify`

#### inboxNotification

`inboxNotification(item: ResourceObject): InboxNotification`: A notification of the list of the inbox API (or of a message `notification_created`, its attributes with its id).

#### useInbox

`useInbox(path: string, options?: InboxOptions): Inbox`: The stored notifications of the user from the route set of bazis-notify (`path`: `ROUTES['notify.notification']`): the newest `limit`, the unread count, the read, the unread, read all and delete all, after which the list and the count are read again (with bazis-ws, also when the backend says they changed: `useLiveQueries`).

#### Inbox

`interface Inbox`

- `items: readonly InboxNotification[]`
- `unread: number`: The unread notifications of the user, all of them (`unread_count/`), not only those listed.
- `status: 'loading' | 'error' | 'ready'`: The reading of the list: `loading`, `error` (`error`, `retry()`), then `ready`.
- `error: Error | null`
- `retry: () => void`
- `markRead: (key?: string) => void`: Marks a notification read (PATCH of `read_at`), or all of them without a key (`read_all/`).
- `markUnread: (key: string) => void`: Marks a notification unread again (`read_at: null`).
- `deleteAll: () => void`: Deletes every stored notification of the user (`clear/`): irreversible, so it is not the `clear` of a source of `NotificationCenter` (`onDeleteAll` there, with a confirmation).

#### InboxNotification

`interface InboxNotification`: A stored notification of the user.

- `key: string`: Its id, the key of the list.
- `type: string`: Its JSON:API type, for its update.
- `notificationType: string`: The type of bazis-notify (`billing.purchase_declined`) and its category (`billing`).
- `category: string`
- `severity: Severity`
- `title: string`
- `text: string | null`: Its body; null when it has none.
- `time: Date`: When it was created.
- `read: boolean`
- `route: string | null`: `route` of its action (`action={'route': '/orders/1'}` of `notify`): where it leads; null without one.
- `action: Readonly<Record<string, unknown>>`
- `metadata: Readonly<Record<string, unknown>>`

#### InboxOptions

`interface InboxOptions`

- `limit?: number`: The notifications listed, the newest first: `INBOX_LIMIT` by default.
- `poll?: number`: Read the list and the count again every `poll` milliseconds: for a backend without bazis-ws, whose notifications come with no live message.

#### The types and the constants of `@/bazis/react/notify`

- `INBOX_LIMIT: 50`: The notifications that the inbox lists, the newest first.
- `type Severity = 'info' | 'success' | 'warning' | 'error'`

### `@/bazis/react/bg`

#### bgProgress

`bgProgress(expected: unknown, performed: unknown): BgProgress[]`: The progress of the phase: `expected` and `performed`, numbers or numbers by key.

#### bgTask

`bgTask(document: { data: { id: string | number; attributes: unknown; }; }): BgTask`: A task of a retrieve of `bg.task`.

#### useBgTask

`useBgTask(path: ItemPath, id: string | null): UseQueryResult<BgTask>`: A task of bazis-bg (`ROUTES[CAPABILITIES.bg.resource]`, null: none), read every `BG_POLL_INTERVAL` until it is done.

#### BgProgress

`interface BgProgress`: The progress of a phase: one counter, or one by key.

- `key: string | null`: The key of the counter; null for a single counter.
- `performed: number | null`
- `expected: number | null`

#### BgTask

`interface BgTask`: A task of bazis-bg as the components show it.

- `id: string`
- `name: string`
- `state: BgState`
- `phase: string`
- `outcome: 'success' | 'error' | 'interrupted' | null`: Done: `success`, `error` or `interrupted`; null before.
- `progress: readonly BgProgress[]`
- `result: unknown`
- `file: boolean`: The task has a file (an export), downloaded from `<path><id>/download/` (`useDownload`).
- `started: string | null`
- `finished: string | null`

#### The types and the constants of `@/bazis/react/bg`

- `BG_POLL_INTERVAL: 2000`: How often a task that is not done is read, in milliseconds.
- `type BgState = 'draft' | 'waiting' | 'starting' | 'running' | 'done'`

### `@/bazis/react/async`

#### finished

`finished(status: BackgroundStatus | null | undefined): boolean`: Whether a task is finished.

#### replayedResponse

`replayedResponse(response: unknown): ReplayedResponse | null`: The response of a request replayed by bazis-async-request (its status and body); null for another response.

#### resultPath

`resultPath(path: string, taskId: string): string`: The result path of a task: `result_path` of the contract with its id.

#### useAsyncRequest

`useAsyncRequest(): UseMutationResult<BackgroundStart, Error, AsyncRequest>`: Sends a request with `X-Async-Background` (bazis-async-request): `mutate({method, path, body})` resolves to `{status: 'queued', taskId}` (202), or `{status: 'done', response}` when the backend ran it at once.

#### useAsyncTask

`useAsyncTask(path: string, taskId: string | null): AsyncTask`: The state of a task (null: none), read at `path` (`CAPABILITIES.async_background.result_path`) every `ASYNC_POLL_INTERVAL` until it is done or the reading fails.

#### AsyncRequest

`interface AsyncRequest`: A request of the API to run in the background: its method, its path and its body (a JSON:API document).

- `method: BackgroundMethod`
- `path: string`
- `body?: unknown`

#### AsyncTask

`interface AsyncTask`: The state of a task of bazis-async-background.

- `status: BackgroundStatus | null`: Null while it is first read, and without a task.
- `response: unknown`: The response of the task once it set one (a `ReplayedResponse` for bazis-async-request), else null.
- `done: boolean`: `completed` or `failed`: it is no longer read.
- `error: Error | null`: The error of the reading: 404 for an unknown or expired task, 403 for another token.

#### The types and the constants of `@/bazis/react/async`

- `ASYNC_POLL_INTERVAL: 2000`: How often the state of a task that is not done is read, in milliseconds.

### `@/bazis/i18n`

#### formatDate

`formatDate(value: string | Date, language: string): string`: A date of the backend (`2026-10-08`, read as that day wherever the user is) or a Date; the text when it is not a date.

#### formatDateTime

`formatDateTime(value: string | Date, language: string): string`: A date-time of the backend (ISO) or a Date, with the date and the time; the text when it is not one.

#### formatDecimal

`formatDecimal(value: unknown, language: string, options?: Intl.NumberFormatOptions): string`: A decimal of the backend: a `DecimalField` is a string in the API and in the contract (`"45000.10"`, its exact digits), formatted exactly with the digits after the point that it has (`45,000.10` in English, `45 000,10` in Russian) unless `options` sets them; a sum is `{style: 'currency', currency: 'RUB'}` (`45 000,10 ₽`).

#### formatNumber

`formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string`: A number: `1,234.5` in English, `1 234,5` in Russian.

#### formatTime

`formatTime(value: Date, language: string): string`: The time of a Date: hours and minutes.

#### baseLanguage

`baseLanguage(code: string): string`: The base code of a language code: `pt` of `pt-BR`.

#### createLanguageStore

`createLanguageStore(options: LanguageStoreOptions): LanguageStore`: The language of the interface, resolved from the choice kept in the browser, the languages of the browser and the default language of the backend.

#### defaultLanguage

`defaultLanguage(languages: readonly Language[], fallback: string): string`: The default language among `languages`: `fallback` (`LANGUAGE`) when it is one of them (or by its base code), else the first language; `fallback` without languages.

#### LanguageProvider

`LanguageProvider(props: LanguageProviderProps): Element`: Gives the components the language of the store and the texts of the dictionaries.


Its props, `LanguageProviderProps`:

- `store?: LanguageStore`: The language of the interface (`createLanguageStore`); English, fixed, without it.
- `messages?: Readonly<Record<string, Messages>>`: The dictionaries of the product by language (`src/i18n/`), merged over those of the package.
- `children: ReactNode`

#### matchLanguage

`matchLanguage(languages: readonly Language[], code: string | null | undefined): string | null`: The language of `languages` that a code names: the same code (whatever its case and separator), else the same base code (`ru` for `ru-RU`); null for none.

#### resolveLanguage

`resolveLanguage(languages: readonly Language[], fallback: string, candidates: readonly (string | null | undefined)[]): string`: The first of the candidates that is a language of `languages`, else the default one.

#### translator

`translator(store: LanguageStore, messages?: Readonly<Record<string, Messages>>): Translate`: `t` outside the components (the errors that the application throws, which a component shows): the texts of the current language of the store, the dictionaries of the product over those of the package.

#### useLanguage

`useLanguage(): LanguageContextValue`: The language of the interface: `{language, languages, setLanguage, t}`.

#### Language

`interface Language`: A language of the backend: its code (`ru`, `pt-br`) and its name.

- `readonly code: string`
- `readonly name: string`

#### LanguageContextValue

`interface LanguageContextValue`: What `useLanguage` gives.

- `language: string`: The code of the current language (`en`); also the locale of `Intl`.
- `languages: readonly Language[]`: The languages the user may choose: those of the backend.
- `setLanguage: (code: string) => void`
- `t: Translate`: The text of a key in the current language.

#### LanguageStore

`interface LanguageStore`: The current language and its changes, outside React too (the client sends it to the backend).

- `readonly languages: readonly Language[]`
- `readonly fallback: string`: The default language of the backend (`LANGUAGE`).
- `get: () => string`
- `set: (code: string) => void`: Changes the language (a language of `languages`; another code is ignored) and keeps it in the browser.
- `subscribe: (listener: () => void) => () => void`: Calls the listener when the language changes; returns the unsubscribe function.

#### LanguageStoreOptions

`interface LanguageStoreOptions`

- `languages: readonly Language[]`: `LANGUAGES` of the contract.
- `fallback: string`: `LANGUAGE` of the contract.
- `storage?: Pick<Storage, 'getItem' | 'setItem'> | null`: Where the choice of the user is kept; localStorage by default, null for nowhere.
- `preferred?: readonly string[]`: The languages of the browser; `navigator.languages` by default.

#### followProfileLanguage

`followProfileLanguage(store: LanguageStore, api: Api, resource: ProfileResource, token: string): () => void`: Makes the language of the store follow the profile of the user of the session token while it lasts: adopts the language of the profile, then saves every change of the language by the user.

#### readProfile

`readProfile(api: Api, resource: ProfileResource, username: string): Promise<Profile | null>`: The profile of the user of this username; null when the user is not found.

#### saveProfileLanguage

`saveProfileLanguage(api: Api, resource: ProfileResource, id: string, language: string): Promise<void>`: Saves the language to the profile: a PATCH of the attribute `language` of the user.

#### tokenSubject

`tokenSubject(token: string): string | null`: The username of a session token of bazis-users (`sub` of its JWT); null for another token.

#### Profile

`interface Profile`: The profile of the user: the id of his item and his language (null: none chosen).

- `id: string`
- `language: string | null`

#### ProfileResource

`interface ProfileResource`: The user resource of the profile: its route set and its JSON:API type.

- `path: string`
- `type: string`

#### translate

`translate(dictionaries: readonly Messages[], locale: string, key: string, params?: Params): string`: The text of a key in the first dictionary that has it (the product's, then the package's, then those of the default language), its parameters replaced; the key itself when no dictionary has it, so that a missing text shows where it is missing.

#### The types and the constants of `@/bazis/i18n`

- `ENGLISH: LanguageContextValue`: The texts of the package in English: the default of the components without a `LanguageProvider`, and of the functions that format outside a component.
- `LANGUAGE_KEY: "bazis.language"`: The key of the language chosen by the user in localStorage.
- `MESSAGES: Readonly<Record<string, Messages>>`: The dictionaries of the package, by language: those of the product are merged over them.
- `LanguageProviderProps`: the props of `LanguageProvider`, listed with it
- `type Messages = Readonly<Record<string, string>>`: A dictionary: the text of each key in one language.
- `type Params = Readonly<Record<string, string | number>>`: The parameters of a text: `{name}` in the text is replaced by `params.name`.
- `type Translate = (key: string, params?: Params) => string`: A translation of a key with its parameters in the current language: `t('list.page', {from, to})`.

## API: the components: app-shell, async-result, file-field, live-query, login-form, map, notification-center

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/app-shell`

#### AppShell

`AppShell(props: AppShellProps): Element`: The layout of the screens of a logged-in user.


Its props, `AppShellProps`:

- `title: ReactNode`: The name of the product.
- `navigation?: Navigation`: `navigation` of the theme by default.
- `items: readonly NavItem[]`
- `session?: ShellSession | null`
- `tools?: ReactNode`: The tools of the product next to the color mode, such as the notifications (`NotificationCenter`) and the state of the socket (`LiveQuery`): in the top bar, else at the foot of the sidebar (a row that wraps, above the session) or, on a phone, in its header.
- `children: ReactNode`

#### Screen

`Screen(props: ScreenProps): Element`: A screen of the specs: `screen:<id>`, its header (the title and the actions; in a working application it stays at the top while the screen scrolls, `--sticky-top` high), its description and its content.


Its props, `ScreenProps`:

- `id: string`: The id of the screen in the specs: `screen:<id>`.
- `title?: ReactNode`
- `description?: ReactNode`: Under the title: what the screen is for.
- `actions?: ReactNode`: Next to the title: the actions of the screen.
- `children: ReactNode`

#### useScreenPage

`useScreenPage(): ScreenPage | null`: The page of the current screen, null outside a `Screen`.

#### NavItem

`interface NavItem`: A link of the navigation to a screen of the specs: `nav:<screen>`.

- `screen: string`
- `label: ReactNode`
- `to: string`
- `end?: boolean`: Active only on this exact path (the home `/`).
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.
- `requires?: NavRequirement`: What the backend must allow the user: the link is shown once it does (always without).

#### NavRequirement

`interface NavRequirement`: What the backend must let the user do for a link to be shown, read from the runtime (the frontend never decides by his role; the backend checks every request anyway).

- `path: string`: The route set of the screen (`ROUTES` of the contract).
- `can?: Can`: View its items (its list), the default, or add one: `useCan` of `@/bazis/react`.
- `filters?: readonly string[]`: Fields that the user may filter its list by (`route_filter_fields/`): the link of a report filtered by a field that his field permissions hide, whose filter the backend answers with 400.

#### ScreenPage

`interface ScreenPage`: The place of a form shown as a page (`forms: page` of the theme, `FormSurface` of resource-form): it takes the place of the content of the screen while it is open.

- `target: HTMLElement | null`
- `claim: (open: boolean) => void`: A form page opens (true) or closes (false).

#### ShellSession

`interface ShellSession`: The session of the user; null without a login (no bazis-users).

- `user?: ReactNode`: Who is logged in.
- `onLogout: () => void`

#### ColorModeToggle

`ColorModeToggle(props: { className?: string; }): Element | null`: A button that switches the mode: system, light, dark; nothing without a dark mode.

#### initColorMode

`initColorMode(): void`: Applies the stored mode and follows the system; `src/main.tsx` calls it before the render.

#### setColorMode

`setColorMode(next: ColorMode): void`

#### useColorMode

`useColorMode(): ColorMode`

#### LanguageToggle

`LanguageToggle(props: { className?: string; }): Element | null`: A button that switches the language of the interface; nothing with fewer than two languages.

#### ListCardLayout

`ListCardLayout(props: ListCardLayoutProps): Element`: The screen of a list with the screen of its card (the child route).


Its props, `ListCardLayoutProps`:

- `list: ReactNode`: The screen of the list.
- `mode?: 'split' | 'pages'`: `composition.list_card` of the theme by default.

#### useBesideCard

`useBesideCard(): boolean`: Whether the list is shown next to an open card (`split` on a wide screen): narrow, it shows only its first columns (`compactColumns` of `ResourceList`).

#### The types and the constants of `@/bazis/ui/app-shell`

- `AppShellProps`: the props of `AppShell`, listed with it
- `type Navigation = 'sidebar' | 'topbar'`
- `ScreenProps`: the props of `Screen`, listed with it
- `type ColorMode = 'light' | 'dark' | 'system'`
- `ListCardLayoutProps`: the props of `ListCardLayout`, listed with it

### `@/bazis/ui/async-result`

#### AsyncResult

`AsyncResult(props: AsyncResultProps): Element`: The result of a request run in the background, until it is done.


Its props, `AsyncResultProps`:

- `start: BackgroundStart`: What `useAsyncRequest` resolved to; a task of the product's own is `{status: 'queued', taskId}`.
- `path?: string | null`: The result path of the tasks: `RESULT_PATH` by default.
- `title?: ReactNode`: The title of the result (`async.title` of the dictionaries by default).
- `onDone?: (result: AsyncOutcome) => void`: Called once, when the task is done.
- `children?: (response: unknown) => ReactNode`: What the response is to the user, once it completed.

#### asyncResult

`asyncResult(status: 'completed' | 'failed', response: unknown): AsyncOutcome`: What a finished task gave: `completed` or `failed`, its response and the message of a failure.

#### AsyncOutcome

`interface AsyncOutcome`

- `view: ResultView`
- `response: unknown`: The response: of a replayed request, the body of the response of its endpoint.
- `message: string | null`: The message of a failure.

#### The types and the constants of `@/bazis/ui/async-result`

- `RESULT_PATH: string | null`: The result path of the tasks (`result_path` of `CAPABILITIES.async_background`); null when it is not routed.
- `AsyncResultProps`: the props of `AsyncResult`, listed with it
- `type ResultView = 'pending' | 'processing' | 'completed' | 'failed'`

### `@/bazis/ui/file-field`

#### accepts

`accepts(file: File, accept: string | undefined): boolean`: Whether a file has a type of `accept` (its MIME types, `type/*`, `.extension`).

#### FileField

`FileField(props: FileFieldProps): Element`: The control of a file field: the file of the field (its name downloads it, a thumbnail of an image) with its replace and remove, or a drop zone; the progress of the upload with its cancel.


Its props, `FileFieldProps`:

- `= FileControlProps & FileFieldOptions`

#### FileFieldProvider

`FileFieldProvider(props: { children: ReactNode; accept?: Readonly<Record<string, string>>; maxSize?: number | null; resources?: readonly string[]; }): Element`: Makes `FileField` the control of the file fields of `FieldInput` below it (put it in `src/app/providers.tsx`, inside `BazisProvider`).

#### FileFieldOptions

`interface FileFieldOptions`

- `maxSize?: number | null`: The largest file, in bytes; `MAX_SIZE` of the contract by default, null for no limit.
- `accept?: string | undefined`: The types of the files that the picker offers and the field takes, as `accept` of an input (`image/*`, `.pdf,.docx`); any by default: bazis-uploadable takes any file.
- `path?: string | undefined`: The route set of the uploaded files; the route of the resource of the field in `ROUTES` by default.

#### The types and the constants of `@/bazis/ui/file-field`

- `MAX_SIZE: number | null`: The largest file of an upload of the backend (`BAZIS_FILE_UPLOAD_MAX_SIZE`); null: no limit.
- `FileFieldProps`: the props of `FileField`, listed with it

### `@/bazis/ui/live-query`

#### LiveQuery

`LiveQuery(props: LiveQueryProps): Element`: Refetches what the socket says changed; shows the state of the socket.


Its props, `LiveQueryProps`:

- `routes?: Readonly<Record<string, string>>`: The paths of the resources by their type: `ROUTES` of the contract by default.
- `notifications?: string | null`: The resource of the stored notifications of bazis-notify: that of the contract by default.

#### The types and the constants of `@/bazis/ui/live-query`

- `LiveQueryProps`: the props of `LiveQuery`, listed with it

### `@/bazis/ui/login-form`

#### LoginForm

`LoginForm(props: LoginFormProps): Element`: The login of a user with a username and a password, and with the other logins of the backend.


Its props, `LoginFormProps`:

- `onLogin?: ((credentials: Credentials) => Promise<void>) | undefined`: Logs in with the username and the password; rejects with the error of the backend.
- `methods?: readonly LoginMethod[]`: The other logins: a button each.
- `onSuccess?: () => void`: Called after a login.
- `title?: ReactNode`
- `description?: ReactNode`: Under the title.

#### Credentials

`interface Credentials`

- `username: string`
- `password: string`

#### LoginMethod

`interface LoginMethod`: A login other than the password, a button `action:login-<id>`.

- `id: string`: The id of the login (the code of a service of bazis-authing: `google`).
- `label: ReactNode`
- `onLogin: (signal: AbortSignal) => Promise<void>`: Logs in (in a window of the service); the signal aborts it (the cancel).

#### The types and the constants of `@/bazis/ui/login-form`

- `LoginFormProps`: the props of `LoginForm`, listed with it

### `@/bazis/ui/map`

#### LeafletMap

`LeafletMap(props: LeafletMapProps): Element`: A Leaflet map with a marker per point (`marker:<id>`, a button with the label as its name and its title when it opens the item: the keyboard reaches it), fitted to them when they change (not when another one is selected); the tiles of `MapProvider`.


Its props, `LeafletMapProps`:

- `markers: readonly MapMarker[]`
- `selected?: string | null | undefined`: The marker drawn larger (the open item).
- `onOpen?: ((id: string) => void) | undefined`: A click on a marker, or Enter or Space on a marker focused with the keyboard.
- `onPick?: ((point: LatLng) => void) | undefined`: A click on the map elsewhere: its point (the map of a point field).
- `me?: LatLng | null | undefined`: The position of the user, drawn apart.
- `className?: string | undefined`
- `'data-bz'?: string | undefined`

#### MapPointControl

`MapPointControl(props: PointControlProps): Element`: The map of a point field in a form (the control that `MapProvider` gives `FieldInput`): the point as a marker, a click places it, the button places the position of the browser.


Its props, `PointControlProps`:

- `field: AttributeField`
- `value: LatLng | null`: The point of the field; null for none.
- `onChange: (value: LatLng | null) => void`
- `disabled: boolean`

#### MapProvider

`MapProvider(props: { tiles?: MapTiles; points?: Readonly<Record<string, readonly string[]>>; children: ReactNode; }): Element`: The tiles of the maps below it, and the map of the point fields in the forms (`FieldInput`: a click places the point).

#### nearFilter

`nearFilter(field: string, options: LatLng, meters: number): Filter`: The filter of the items whose point field is within `meters` of a point (the lookup `near` of the core: `<field>__near=<longitude>,<latitude>,<meters>`), for a list of what is near.

#### nearSort

`nearSort(field: string, options: LatLng, options?: { farthest?: boolean | undefined; }): string`: The sort term of the distance of the point field from a point, the nearest first (`farthest`: the farthest first), the items without a point last: `<field>__distance(<lon>,<lat>)` of the core, for the `sort` of `ResourceList` and `ResourceMap`.

#### useGeolocation

`useGeolocation(): Geolocation`: The position of the user from the browser (`navigator.geolocation`), when `locate()` asks for it: the point of a list of what is near (`nearFilter`, `nearSort`), without a field of the profile.

#### useMapTiles

`useMapTiles(): MapTiles`: The tiles of the maps (`MapProvider`; OpenStreetMap without one).

#### Geolocation

`interface Geolocation`: The position of the browser, asked for by `locate()`: never saved anywhere.

- `position: LatLng | null`
- `locating: boolean`
- `failed: boolean`: The browser has no geolocation, or the user refused it.
- `locate: (then?: (position: LatLng) => void) => void`: Asks the browser for the position; `then` gets it.

#### MapMarker

`interface MapMarker`: A marker of a map: an item at its point.

- `id: string`
- `point: LatLng`
- `label: string`: Its name for the screen readers and its tooltip: the label of the item (text).

#### MapTiles

`interface MapTiles`: The tiles of the maps: the URL template of a tile server and its attribution (HTML).

- `url: string`: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`: `{z}`, `{x}`, `{y}` (and `{s}`) of Leaflet.
- `attribution: string`: The attribution that the terms of the tiles require, HTML of the product (never of the data).
- `maxZoom?: number`

#### ResourceMap

`ResourceMap(props: ResourceMapProps): Element`: A map of the items of a list with a point (`map:<entity>`, `aria-busy` while it loads), the markers `marker:<id>` opening the items.


Its props, `ResourceMapProps`:

- `path: ListPath`: The route set (`ROUTES` of the contract).
- `entity: string`: The entity of the specs: the map is `map:<entity>`, its markers `marker:<id>`.
- `field: string`: The point field of the items (`type: point` of the specs).
- `filter?: Filter | undefined`: The filter of the screen (`list.filter`), or of what is near (`nearFilter`).
- `sort?: readonly string[] | undefined`: The order of the items read (`sort`), the first `pageSize` of them: the nearest first with `nearSort`.
- `pageSize?: number`
- `onOpen?: ((id: string) => void) | undefined`: A click on the marker of an item.
- `selected?: string | null | undefined`: The open item, drawn larger.
- `me?: LatLng | null | undefined`: The position of the user (`useGeolocation`), drawn apart.
- `emptyMessage?: ReactNode`: Under the map when no item has a point.
- `className?: string | undefined`

#### The types and the constants of `@/bazis/ui/map`

- `OSM_TILES: MapTiles`: The tiles of OpenStreetMap, the default: their usage policy allows light use with this attribution; a product in production sets the tiles of its provider (`MapProvider tiles`) and lets their host in its Content Security Policy (`img-src`).
- `LeafletMapProps`: the props of `LeafletMap`, listed with it
- `MAP_PAGE: 200`: The items a map reads at most, the first page of its list.
- `ResourceMapProps`: the props of `ResourceMap`, listed with it

### `@/bazis/ui/notification-center`

#### NotificationCenter

`NotificationCenter<T extends CenterNotification>(props: NotificationCenterProps<T>): Element | null`: The bell of the notifications with their list.


Its props, `NotificationCenterProps`:

- `notifications?: NotificationSource<T> | undefined`: The notifications: `useInbox(ROUTES['notify.notification'])` or `useNotifications()`.
- `onOpen?: (notification: T) => void`: Opens what a notification is about (its card, `route` of a notification of bazis-notify); the list closes.
- `toasts?: boolean`: A toast for each new notification (not for those there when it was mounted).
- `onDeleteAll?: (() => void) | undefined`: Deletes all the notifications (`deleteAll` of `useInbox`: irreversible), offered as `action:delete-notifications` and done after `action:confirm-delete-notifications`; none without it.

#### CenterNotification

`interface CenterNotification`: A notification as the center shows it, as `useInbox` and `useNotifications` give it.

- `key: string | number`: Unique in the page.
- `title: string`
- `text: string | null`
- `time: Date`: When it was created (or received).
- `read: boolean`
- `severity?: string`: `success` and `error` give the tone of its toast (bazis-notify).

#### NotificationSource

`interface NotificationSource<T extends CenterNotification>`: The notifications of the center and their actions: `useInbox(path)` or `useNotifications()`.

- `items: readonly T[]`: The newest first.
- `unread: number`
- `status?: 'loading' | 'error' | 'ready'`: The reading of the notifications (`ready` without it): `loading`, `error` (`error`, `retry()`).
- `error?: Error | null`
- `retry?: () => void`
- `markRead: (key?: T['key']) => void`: Marks a notification read, or all of them without a key.
- `clear?: (() => void) | undefined`: Forgets the notifications (those of the session, `useNotifications`): `action:clear-notifications`.

#### The types and the constants of `@/bazis/ui/notification-center`

- `NotificationCenterProps`: the props of `NotificationCenter`, listed with it

## API: the components: resource, resource-card, resource-form

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/resource`

#### FieldInput

`FieldInput(props: FieldInputProps): Element`: A field of a runtime schema with its label and its errors: the control by the type, format and choices of an attribute (a select of the labels of the choices), the coordinates of a point field of the route set `path` (`PointInput`, with the map of `MapProvider`), the picker of the related item of a to-one relationship (`RelationPicker`) or of the related items of a to-many one (`RelationListPicker`), the upload of a file field (the control of `FilesProvider`, `FileField` of file-field); read-only when the user may not change it.


Its props, `FieldInputProps`:

- `field: FormField`
- `value: unknown`: The value: of an attribute, the id of the related item of a to-one relationship, the ids of the related items of a to-many one.
- `onChange: (value: unknown) => void`
- `errors?: readonly string[] | undefined`: The validation errors of the field.
- `disabled?: boolean`: Disables the control, e.g. while the form is submitted.
- `onBusy?: (busy: boolean) => void`: A file of the field starts or ends uploading: the form waits for it to be submitted.
- `path?: string | undefined`: The route set of the resource of the field: a point field of it (`PointsProvider`, the contract) is edited as a point.

#### FieldValue

`FieldValue(props: { field: FormField | undefined; value: unknown; }): Element`: The value of a field for reading: an attribute formatted by its type and format, the labels of the related items of a relationship, an uploaded file (`FileValue`).

#### choiceOptions

`choiceOptions(field: FormField | undefined): { value: string; label: string; }[] | null`: The choices of an attribute with choices as options (the value as text, the label of `enumDict`, else the value), in their order; null for another field.

#### fieldValue

`fieldValue(resource: ResourceObject, name: string): unknown`: The value of a field of a resource object: an attribute, the id of the related item of a to-one relationship (null for none), the ids of a to-many one; undefined when it is absent.

#### formatValue

`formatValue(field: FormField | undefined, value: unknown, options?: Pick<LanguageContextValue, 'language' | 't'>): string`: The text of the value of an attribute, in the language of the interface (`useLanguage()`; English by default): a choice by its label (`enumDict` of the backend, the choices of an array each), else by its type and format, the numbers and the dates with `Intl`, a point (GeoJSON) as its coordinates (`formatPoint`); `—` for no value.

#### fromLocalDateTime

`fromLocalDateTime(text: string): string | null`: The value of `<input type="datetime-local">` as a date-time of the backend (ISO, UTC).

#### hasSearch

`hasSearch(type: string): boolean`: Whether the route set of a JSON:API type searches (`search`): it has search fields in the contract (`search` of its resource).

#### isLongText

`isLongText(field: FormField | undefined): boolean`: Whether a field is a long text (a string without a format and a maximal length).

#### isNumeric

`isNumeric(field: FormField | undefined): boolean`: Whether a field is a number: aligned to the right, with figures of the same width.

#### isReverse

`isReverse(type: string, name: string): boolean`: Whether a relationship of a resource is a reverse one (`reverse` of its field in the contract): its foreign key or many-to-many field is on the related model, and the core sets it to the items of a create or an update, deleting the unlinked items of a foreign key that is not null.

#### itemLabel

`itemLabel(resource: ResourceObject): string`: The label of an item: its first non-empty name of `LABELS` (`name`, `full_name`, the first and the last name, `title`, `username`, `email`, `slug`, `code`), or its id.

#### permitted

`permitted(meta: PermitMeta | null | undefined, action: 'add' | 'change' | 'delete' | CustomActionName, id?: string): boolean`: Whether the backend allows an action now, from the permission meta of bazis-permit (`can()` of the client): `add` from `for_create` of a list or `crud_actions` of an item, `change` and `delete` of an item of a list from `for_change`/`for_delete` with its id, a custom action (`'action_<name>'`, `action` of `x-bazis`) from `custom_actions` (bazis-permit 2.11; by what the action declares, not the checks of its own code).

#### routeOf

`routeOf(type: string): string | undefined`: The path of the route set of a JSON:API type (`ROUTES` of the contract), if it has one.

#### toLocalDateTime

`toLocalDateTime(value: unknown): string`: A date-time of the backend as the value of `<input type="datetime-local">`.

#### useItemFields

`useItemFields(path: string, id: string, kind?: 'retrieve' | 'update'): Fields`: The fields that the current user may see in an item (`schema_retrieve/`, by default), or may set in its update (`schema_update/`: those they may not change now are `readOnly`), for this item: the field permissions of bazis-permit depend on the item (its selectors, its status).

#### useListFields

`useListFields(path: string): Fields`: The fields of a list (`schema_list/`): their titles and types.

#### Fields

`interface Fields`: The fields of a runtime schema by name, and the state of its query.

- `fields: ReadonlyMap<string, FormField>`
- `title: (name: string) => string`: The title of a field in the language of the backend, its name until the schema loads.
- `ready: boolean`: Whether the schema is loaded (or failed: the names stand for the titles then).
- `loaded: boolean`: Whether the schema is loaded (not failed).
- `has: (name: string) => boolean`: Whether the schema has the field: bazis-permit leaves out the fields that the user may not see (or change, in the schema of an update); every field while the schema is not loaded.

#### ResourceObject

`interface ResourceObject`: A resource object of JSON:API, an item of a list or the `data` of an item.

- `id: string`
- `type: string`
- `attributes?: Readonly<Record<string, unknown>> | null`
- `relationships?: Readonly<Record<string, { data?: unknown; } | null | undefined>> | null`
- `meta?: unknown`

#### FilesProvider

`FilesProvider(props: { control: ComponentType<FileControlProps> | null; resources?: readonly string[]; children: ReactNode; }): Element`: Gives `FieldInput` the control of the file fields (`FileFieldProvider` of file-field), for the forms and the payloads below it.

#### FileValue

`FileValue(props: { relation: string; id: string; path?: string | undefined; preview?: string | null | undefined; }): Element`: An uploaded file by its id, read with the retrieve of its route set.

#### FileView

`FileView(props: FileViewProps): Element`: A file: a thumbnail of an image (`preview`) or an icon, its name (a button that downloads it), its size.


Its props, `FileViewProps`:

- `file: UploadedFile`
- `preview?: string | null | undefined`: The URL of the thumbnail of an image (a local copy, or the content read with the token).
- `onDownload?: (() => void) | null | undefined`: Downloads the file: its name is a button; without it, a text.
- `downloading?: boolean | undefined`: The download runs.
- `failed?: boolean | undefined`: The download failed: said next to the name.

#### formatSize

`formatSize(bytes: number, options?: Pick<LanguageContextValue, 'language' | 't'>): string`: A size in bytes in the language of the interface (English by default): `11 B`, `1.2 KB`, `3 MB` (`1,2 КБ` in Russian).

#### isFile

`isFile(field: FormField | undefined, resources: readonly string[]): field is RelationField`: Whether a field is a file: a to-one relationship to a resource of the uploaded files.

#### isImage

`isImage(name: string): boolean`: Whether a file is an image, by its name or its extension.

#### uploadedFile

`uploadedFile(item: ResourceObject): UploadedFile`: The attributes of an item of a resource of the uploaded files.

#### useFiles

`useFiles(): Files`: The resources of the uploaded files and the control of a file field.

#### ControlProps

`type ControlProps`: The attributes of the input of a field (`FieldInput`): its id, `data-bz="field:<name>"`, aria.

- and the members of `Pick<ComponentProps<'input'>, 'id' | 'required' | 'aria-invalid' | 'aria-describedby'>`
- `'data-bz': string`

#### FileControlProps

`interface FileControlProps`: What `FieldInput` gives the control of a file field.

- `field: RelationField`: A to-one relationship to a resource of the uploaded files.
- `value: string | null`: The id of the uploaded file; null for none.
- `onChange: (value: string | null) => void`
- `disabled: boolean`
- `control: ControlProps`: The attributes of the `<input type="file">`.
- `onBusy: (busy: boolean) => void`: An upload of the field starts or ends: the form is not submitted meanwhile.
- `onError: (message: string | null) => void`: The error of the file (too large, refused by the backend), shown with the errors of the field; null clears it.

#### UploadedFile

`interface UploadedFile`: The attributes of an uploaded file.

- `name: string`
- `size: number | null`
- `url?: string | null | undefined`

#### formatPoint

`formatPoint(options: LatLng): string`: The coordinates as maps write them, whatever the language: `55.7558, 37.6173` (at most 6 decimals).

#### geoJsonPoint

`geoJsonPoint(options: LatLng): GeoJsonPoint`: The GeoJSON of a point, the value of a point field.

#### isPoint

`isPoint(field: { kind: string; name: string; }, path: string | undefined, fields: Points['fields']): boolean`: Whether a field of the route set `path` is a point field (an attribute of `fields`).

#### parsePoint

`parsePoint(text: string): LatLng | null`: The point of the text `<latitude>, <longitude>`: the numbers with a decimal point separated by a comma, a semicolon or a space (`55.7558, 37.6173`), or with a decimal comma separated by a semicolon or a space (`55,7558; 37,6173`, as some languages write them); null when it is not one (`55,7,37,6` is ambiguous).

#### PointInput

`PointInput(props: { field: AttributeField; value: unknown; onChange: (value: unknown) => void; disabled: boolean; control: ControlProps; }): Element`: The input of a point field: its coordinates as text (`field:<name>`), sent as GeoJSON once they are a point, as the text otherwise (the backend refuses it: the error of the field); the control of `PointsProvider` (a map) below it.

#### pointOf

`pointOf(value: unknown): LatLng | null`: The point of a GeoJSON point; null for any other value (another geometry, none).

#### PointsProvider

`PointsProvider(props: { control: ComponentType<PointControlProps> | null; fields?: Readonly<Record<string, readonly string[]>>; children: ReactNode; }): Element`: Gives `FieldInput` the control of the point fields below it (`MapProvider` of map: a map to place the point).

#### usePoints

`usePoints(): Points`: The point fields and the control of a point field.

#### GeoJsonPoint

`interface GeoJsonPoint`: A GeoJSON point, as the backend reads and writes a point field.

- `type: 'Point'`
- `coordinates: [ longitude: number, latitude: number ]`

#### LatLng

`interface LatLng`: A point: the latitude and the longitude in degrees (WGS 84, SRID 4326).

- `latitude: number`
- `longitude: number`

#### PointControlProps

`interface PointControlProps`: What `FieldInput` gives the control of a point field (the map of `MapProvider`).

- `field: AttributeField`
- `value: LatLng | null`: The point of the field; null for none.
- `onChange: (value: LatLng | null) => void`
- `disabled: boolean`

#### text

`text(value: unknown): string`: A value as text: a JSON value that is not a string, a number or a boolean as JSON.

#### FilterFieldsDocument

`interface FilterFieldsDocument`: The fields a list can be filtered by (`route_filter_fields/`).

- `fields: readonly { name: string; py_type: string; }[]`

#### ItemDocument

`interface ItemDocument`: An item and its meta (`crud_actions`).

- `data: ResourceObject`
- `meta?: PermitMeta | null`

#### ListDocument

`interface ListDocument`: A list: its items, its pages and its meta (`pagination`, the permission meta).

- `data: readonly ResourceObject[]`
- `links?: PaginationLinks | null`
- `meta?: (PermitMeta & { pagination?: PaginationMeta | null; }) | null`

#### SavedDocument

`interface SavedDocument`: The document that a create or an update returns.

- `data: ResourceObject`

#### RelationLabel

`RelationLabel(props: { relation: string; id: string; path?: string | undefined; }): Element`: The label of a related item: read from its resource when the contract has a route for it (`useRelatedItem`: the items of a resource shown together are read with one request, and cached), else the start of its id; a skeleton marked `state:loading` while it is read.

#### RelationListPicker

`RelationListPicker(props: RelationListPickerProps): Element`: The picker of the related items of a to-many relationship: a button with the labels of the items (`role="combobox"`, the marks given to it) that opens the list of the related resource (`aria-multiselectable`) as `RelationPicker` does (the labels of the first 8 items, then `+N`, the others not read); a click or Enter adds or removes an item and keeps the list open, the option with the placeholder (`data-value=""`) removes them all, Escape and Tab close it.


Its props, `RelationListPickerProps`:

- `extends Omit<RelationPickerProps, 'value' | 'onChange' | 'nullable'>`
- `value: readonly string[]`: The ids of the related items, in the order they were chosen.
- `onChange: (value: string[]) => void`

#### RelationPicker

`RelationPicker(props: RelationPickerProps): Element`: The picker of the related item of a to-one relationship: a button with the label of the item (`role="combobox"`, the marks given to it) that opens the list of the related resource, page after page, with a search when its route set searches (`searchable`) and an option that clears the value when it is nullable (never the default option).


Its props, `RelationPickerProps`:

- `extends Pick<ComponentProps<'button'>, 'id' | 'className' | 'aria-invalid' | 'aria-describedby' | 'aria-label'>`
- `relation: string`: The JSON:API type of the related resource.
- `path?: string | undefined`: The route set of the related resource, instead of its route in `ROUTES` of the contract.
- `searchable?: boolean | undefined`: Whether the route set searches (`search`): a search box over the items, else the items without a search.
- `value: string | null`: The id of the related item, null for none.
- `onChange: (value: string | null) => void`
- `placeholder?: string`: The text of no item, and the label of the option that clears the value.
- `nullable?: boolean`: Whether the value may be cleared (an option with the placeholder): a nullable relationship.
- `label?: string | undefined`: The name of the field, in the name of the search (`Search <label>`).
- `disabled?: boolean | undefined`
- `required?: boolean | undefined`
- `'aria-readonly'?: boolean | undefined`
- `'data-bz'?: string`

#### The types and the constants of `@/bazis/ui/resource`

- `FieldInputProps`: the props of `FieldInput`, listed with it
- `FILE_RESOURCES: readonly string[]`: The resources of the uploaded files of the contract; none without bazis-uploadable.
- `FileViewProps`: the props of `FileView`, listed with it
- `POINT_FIELDS: Readonly<Record<string, readonly string[]>>`: The point fields of the contract (`format: point`) by the path of each route set of their resource.
- `useAnyFilterFields: (path: string) => UseQueryResult<FilterFieldsDocument>`: `useFilterFields(path)`.
- `useAnyItem: (path: string, id: string, query?: Pick<QueryOptions, "include" | "fields" | "meta"> | undefined) => UseQueryResult<ItemDocument>`: `useItem(path, id, query)`.
- `useAnyList: (path: string, query?: Omit<QueryOptions, "include"> | undefined) => UseQueryResult<ListDocument>`: `useList(path, query)`.
- `useAnyRelated: (path: string, id: string) => UseQueryResult<ResourceObject | null>`: `useRelatedItem(path, id)`: null when the user may not view the item.
- `useAnyResourceForm: (path: string, options: { id?: string | undefined; fixed?: Readonly<Record<string, unknown>> | undefined; }) => ResourceForm<SavedDocument>`: `useResourceForm(path, {id, fixed})`: a create without an id.
- `useAnySchema: (path: string, kind: "list" | "create" | "retrieve" | "update" | "transit", id?: string | undefined) => UseQueryResult<Readonly<Record<string, unknown>>>`: `useSchema(path, kind)` of the route set, `useSchema(path, kind, id)` of an item.
- `PICKER_PAGE: 20`: How many items a page of the picker reads; `Load more` reads the next one.
- `RelationListPickerProps`: the props of `RelationListPicker`, listed with it
- `RelationPickerProps`: the props of `RelationPicker`, listed with it

### `@/bazis/ui/resource-card`

#### RelatedList

`RelatedList(props: RelatedListProps): Element`: The items of a related resource of the item of a card, and their create from it; the card is read again after an item is added, wherever the section is placed.


Its props, `RelatedListProps`:

- `extends Pick<ResourceListProps, 'columns' | 'onOpen' | 'rowActions' | 'cells' | 'emptyMessage' | 'sort' | 'pageSize' | 'layout'>`
- `path: ListPath`: The route set of the related resource (`ROUTES` of the contract): its list, its create for `add`.
- `entity: string`: The entity of the related resource: the list is `list:<entity>`.
- `relation: string`: The to-one relationship of the related resource to the item of the card (`request` of an item of a request): the filter of the list (a field it can be filtered by) and the fixed value of the form.
- `item: string`: The id of the item of the card.
- `itemPath: ItemPath`: The route set of the item of the card (the `path` of the `ResourceCard`): the item read again once a related item is added.
- `title?: ReactNode`: The heading of the section.
- `add?: RelatedAdd | undefined`: "Add here", shown when the backend allows the create (`for_create` of the list); the screen leaves it out when the item takes no more related items (`permitted(meta, 'change')` of the card: a request that is no longer a draft).
- `forms?: 'dialog' | 'page'`: The form in a dialog or as a page; `composition.forms` of the theme by default.

#### RelatedAdd

`interface RelatedAdd`: "Add here": the create of a related item from the card.

- `id: string`: The button `action:<id>` that opens the form.
- `label: ReactNode`
- `fields?: readonly string[]`: The fields of the form (the relationship to the item is fixed and left out).
- `title?: ReactNode`: The title of the form; the label by default.
- `icon?: ComponentType<{ className?: string; }>`
- `onSaved?: (saved: SavedDocument) => void`: Called with the saved item, once the form is closed.

#### ResourceCard

`ResourceCard(props: ResourceCardProps): Element`: The card of an item, with its states, sections, actions and edit.


Its props, `ResourceCardProps`:

- `path: ItemPath`: The route set (`ROUTES` of the contract); for `edit`, one with the update.
- `id: string`
- `sections: readonly CardSection[]`
- `title?: (item: ResourceObject) => ReactNode`: The heading; the label of the item (its name, title...) by default.
- `badge?: (item: ResourceObject) => ReactNode`: Next to the heading: the status of the item (`StatusBadge` of status-badge).
- `edit?: boolean`: An edit button (`action:edit`) when the backend allows the change: the form of the update of the fields of the sections.
- `actions?: readonly CardAction[]`
- `values?: Readonly<Record<string, (item: ResourceObject) => ReactNode>>`: The values of fields, instead of the formatted value.
- `children?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode)`: Under the heading: the transits of the item (`TransitBar` of transit-bar), its status history (`StatusHistory` of status-history, which takes the item), a section of the product, given the permission meta of the item (`crud_actions`: `permitted(meta, 'change')`; `custom_actions`: `permitted(meta, 'action_report')`, the button of a custom action of the item) without a request of its own.
- `forms?: 'dialog' | 'page'`: The edit in a dialog or as a page; `composition.forms` of the theme by default.

#### CardAction

`interface CardAction`: An action of the card, a button `action:<id>`, shown when the user may do it on the item.

- `id: string`
- `label: ReactNode`
- `onClick: () => void`
- `permission?: 'change' | 'delete'`
- `variant?: 'default' | 'outline' | 'destructive'`

#### CardSection

`interface CardSection`: A section of the card: its fields in this order.

- `id: string`
- `title?: ReactNode`
- `fields: readonly string[]`

#### The types and the constants of `@/bazis/ui/resource-card`

- `RelatedListProps`: the props of `RelatedList`, listed with it
- `ResourceCardProps`: the props of `ResourceCard`, listed with it

### `@/bazis/ui/resource-form`

#### FormSurface

`FormSurface(props: FormSurfaceProps): Element`: A form in a dialog or as a page, as the theme composes the forms.


Its props, `FormSurfaceProps`:

- `open: boolean`
- `onClose: () => void`: Called by the close button of the dialog, Escape, or the back button of the page.
- `title: ReactNode`
- `description?: ReactNode`
- `mode?: 'dialog' | 'page'`: `composition.forms` of the theme by default.
- `children: ReactNode`: The form: `ResourceForm`, a form of the screen.

#### ResourceForm

`ResourceForm(props: ResourceFormProps): Element`: A form of a resource bound to its runtime schema.


Its props, `ResourceFormProps`:

- either: `path: CreatePath`; `id?: undefined`
- or: `path: UpdatePath`; `id: string`
- `fields?: readonly string[]`: The fields, in this order (those the runtime schema does not have are left out); by default every field of the schema but the `fixed` ones and the reverse relationships (`isReverse`: the core deletes the unlinked items of a reverse foreign key).
- `fixed?: FixedValues`: The values of fields that the screen sets and the user does not change (`useResourceForm` `fixed`): the item of a card that a related item is added to, `{request: id}`.
- `onSaved?: (saved: SavedDocument) => void`: Called with the saved document.
- `onCancel?: () => void`: Shows a cancel button (`action:cancel`); the changes are dropped.
- `submitLabel?: ReactNode`

#### ResourceFormBody

`ResourceFormBody(props: Omit<ResourceFormProps, 'path' | 'id'> & { path: string; id?: string | undefined; }): Element`: `ResourceForm` over a plain path, for the components that hold the path of another action of the route set (the card holds the path of its retrieve).

#### SavedDocument

`interface SavedDocument`: The document that a create or an update returns.

- `data: ResourceObject`

#### The types and the constants of `@/bazis/ui/resource-form`

- `FormSurfaceProps`: the props of `FormSurface`, listed with it
- `ResourceFormProps`: the props of `ResourceForm`, listed with it

## API: the components: resource-list, state-panel, status-badge, status-history, task-progress, transit-bar

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/resource-list`

#### filterOf

`filterOf(filters: readonly ListFilter[], values: FilterValues, types: ReadonlyMap<string, FieldType>): Filter | undefined`: The `filter` expression of the values, or undefined without any.

#### ListFilter

`interface ListFilter`: A filter of a list: a field of `route_filter_fields/`, its label and its choices.

- `field: string`
- `label?: string`: The label; the title of the field in the list schema by default.
- `options?: readonly { value: string; label: string; }[]`: The choices (value, label), as the statuses of `statusOptions()` of status-badge; those of a field with choices in the list schema (`choiceOptions`) by default in `ResourceList`.

#### ResourceList

`ResourceList(props: ResourceListProps): Element`: A list of a resource, with its states, filters, sort, pages and actions.


Its props, `ResourceListProps`:

- `path: ListPath`: The route set (`ROUTES` of the contract).
- `entity: string`: The entity of the screen: `list:<entity>`.
- `columns: readonly string[]`: The fields of the columns: attributes and relationships of the list; the first is the name of a row.
- `filters?: readonly (string | ListFilter)[]`: The filter fields (`route_filter_fields/`), with their options: a control each, but for a field the backend does not offer the user to filter by (its filter would be a 400).
- `filter?: Filter | undefined`: The filter of the screen itself (`list.filter` of the spec: a report of some of the items), combined (AND) with the filters and the search of the user.
- `sort?: readonly string[]`: The initial order: the sort labels of the contract, `-` for descending, or other terms of the core (`nearSort` of map: the distance from a point); a new one replaces the order the user chose.
- `search?: boolean`: A search field (`field:$search`).
- `pageSize?: number`
- `onOpen?: (id: string) => void`: Called with the id of the row the user opens.
- `selected?: string | undefined`: The id of the open item (the card next to the list): its row is selected.
- `actions?: readonly ListAction[]`
- `rowActions?: readonly RowAction[]`
- `cells?: Readonly<Record<string, (row: ResourceObject) => ReactNode>>`: The content of the cells of a column, instead of the formatted value.
- `rowTone?: (row: ResourceObject) => Tone | undefined`: The tone of the theme that highlights a row (`list.highlight` of the spec), undefined for none: its soft color and a bar of the tone, marked `data-tone`.
- `rowToneLabel?: (row: ResourceObject) => string | undefined`: What the tone of a highlighted row means, in words (`label` of `list.highlight`): its `aria-description`, so that the highlight is not told by its color alone.
- `emptyMessage?: ReactNode`: The message of the empty list.
- `layout?: 'table' | 'cards'`: A table or a grid of cards; `composition.list` of the theme by default.
- `compactColumns?: readonly string[]`: The columns of the table while it is next to an open card (`ListCardLayout`, `split`): the first two by default; the others are hidden (their cells stay, for the scenarios).

#### ListAction

`interface ListAction`: An action of the list, a button `action:<id>`; `add` shows it when the user may create.

- `id: string`
- `label: ReactNode`
- `onClick: () => void`
- `permission?: 'add'`
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.

#### RowAction

`interface RowAction`: An action of a row, a button `action:<id>` in it, shown when the user may do it on the item.

- `id: string`
- `label: ReactNode`
- `onClick: (id: string) => void`
- `permission?: 'change' | 'delete'`

#### The types and the constants of `@/bazis/ui/resource-list`

- `type FilterValues = Readonly<Record<string, string>>`: The values of the filters by field; a date range is `<field>__gte` and `<field>__lte`.
- `ResourceListProps`: the props of `ResourceList`, listed with it

### `@/bazis/ui/state-panel`

#### errorState

`errorState(error: unknown): ErrorState`: The state of an error: 401 and 403 `forbidden`, 404 `not_found`, 422 `invalid`, else `error`.

#### queryState

`queryState(query: { status: 'pending' | 'error' | 'success'; error: unknown; }, empty?: boolean): ViewState`: The state of a query of the hooks: `loading` until it has data, the state of its error, `empty` when the caller says so, else `loaded`.

#### SkeletonLines

`SkeletonLines(props: { lines?: number; className?: string; }): Element`: The skeleton of a block of text, while what it shows loads.

#### StatePanel

`StatePanel(props: StatePanelProps): Element`: Renders a state: the content in `loaded`, its skeleton in `loading`, an icon with a title and a hint in the others, each marked `data-bz="state:<state>"`.


Its props, `StatePanelProps`:

- `state: ViewState`
- `error?: unknown`: The error of the state: its message is shown for `error` and `invalid`.
- `message?: ReactNode`: Replaces the default title of the state.
- `description?: ReactNode`: Replaces the default hint of the state (the message of an error by default).
- `onRetry?: () => void`: Shows a retry button (`action:retry`) in the `error` state.
- `inline?: boolean`: One line, without the frame: inside a form or a bar.
- `skeleton?: ReactNode`: The `loading` state: the skeleton of the content (lines of text by default).
- `children?: ReactNode`: The content of the `loaded` state.
- `className?: string`

#### dismissToast

`dismissToast(id: number): void`: Removes a toast.

#### toast

`toast(options: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone']; }): number`: Shows a toast, the feedback of a change that succeeded (the last three are kept); returns its id.

#### Toaster

`Toaster(): Element`: The toasts, at the bottom of the screen, in one polite live region.

#### Toast

`interface Toast`

- `id: number`
- `title: ReactNode`
- `description?: ReactNode`
- `tone: 'success' | 'info' | 'danger'`

#### The types and the constants of `@/bazis/ui/state-panel`

- `type ErrorState = Extract<ViewState, 'error' | 'forbidden' | 'not_found' | 'invalid'>`
- `StatePanelProps`: the props of `StatePanel`, listed with it
- `type ViewState = 'loading' | 'empty' | 'loaded' | 'error' | 'forbidden' | 'not_found' | 'invalid'`: The states of the specs (`states` of a screen).

### `@/bazis/ui/status-badge`

#### StatusBadge

`StatusBadge(props: { resource: ResourceObject; className?: string; }): Element | null`: The status of the item (a row of a list or the `data` of an item); nothing without one.

#### statusName

`statusName(type: string, status: string, language?: string): string`: The name of a status of the model in a language (`useLanguage().language`; the default language of the backend without it); its id when the contract does not have it.

#### statusOf

`statusOf(resource: ResourceObject): string | null`: The status of an item of a statusy model: the id of its relationship `status`.

#### statusOptions

`statusOptions(type: string, language?: string): { value: string; label: string; }[]`: The statuses of the model as the options of a filter (`filters` of resource-list), named in a language.

#### statusTone

`statusTone(status: string): Tone`: The tone of a status: `statuses` of the theme, neutral for another.

#### transitName

`transitName(type: string, transit: string, language?: string): string`: The name of a transit of the model in a language; its id when the contract does not have it.

#### transitTarget

`transitTarget(type: string, transit: string): string | null`: The status that a transit of the model leads to; null when the contract does not have it.

### `@/bazis/ui/status-history`

#### StatusHistory

`StatusHistory(props: StatusHistoryProps): Element | null`: The status history of the item: its status since its date, by its author (each when the user may see the field).


Its props, `StatusHistoryProps`:

- `resource: ResourceObject`: The item (the `data` of a retrieve, a row of a list) with its fields of bazis-statusy.
- `label?: string`: The name of the history for assistive technologies (`history.label` of the dictionaries by default).

#### The types and the constants of `@/bazis/ui/status-history`

- `StatusHistoryProps`: the props of `StatusHistory`, listed with it

### `@/bazis/ui/task-progress`

#### TaskProgress

`TaskProgress(props: TaskProgressProps): Element`: A background task of bazis-bg with its progress.


Its props, `TaskProgressProps`:

- `id: string`: The id of the task, which the endpoint of the product that queued it returns.
- `path?: string | null`: The route set of the tasks: `BG_TASKS` by default.
- `title?: ReactNode`: The title; the name of the task by default.
- `onDone?: (task: BgTask) => void`: Called once, when the task is done (whatever its outcome).
- `children?: (task: BgTask) => ReactNode`: What the task gave, once it succeeded (its `result`).

#### taskView

`taskView(task: BgTask): TaskView`: What a task is to the user: waiting until it runs, then running, then its outcome.

#### The types and the constants of `@/bazis/ui/task-progress`

- `BG_TASKS: string | null`: The route set of the tasks of bazis-bg (`resource` of `CAPABILITIES.bg`); null when it is not routed.
- `TaskProgressProps`: the props of `TaskProgress`, listed with it
- `type TaskView = 'waiting' | 'running' | 'success' | 'error' | 'interrupted'`

### `@/bazis/ui/transit-bar`

#### payloadErrors

`payloadErrors(error: unknown, names: readonly string[]): { fields: Record<string, string[]>; others: string[]; }`: The errors of a transit: those of the fields of its payload by name (`source.pointer` `/payload/<name>`, a name of `names`), and the others (its validators, a field that the dialog does not show, an error that is not of the backend).

#### TransitBar

`TransitBar(props: TransitBarProps): Element | null`: The transits of an item, with the dialog of their payloads.


Its props, `TransitBarProps`:

- `path: TransitPath`: The route set of the statusy model (`ROUTES` of the contract).
- `id: string`
- `onDone?: (item: unknown) => void`: Called after a transit with the item, or null when the user can no longer view it (leave its screen).

#### The types and the constants of `@/bazis/ui/transit-bar`

- `TransitBarProps`: the props of `TransitBar`, listed with it

## API: the helpers of the end-to-end tests

The exports of `frontend/e2e/bazis/`, imported as `../bazis` by the tests of `e2e/custom/` (see "The end-to-end tests").

### `../bazis`

#### bz

`bz(kind: string, id: string): string`: The selector of the mark `data-bz="<kind>:<id>"`.

#### routePattern

`routePattern(route: string): RegExp`: The pattern of the paths of a route of the specs: `/tasks/:id` is any `/tasks/<id>`, with or without a trailing slash.

#### stubForeignImages

`stubForeignImages(page: Page): Promise<void>`: Answers the images of another origin than the page (the tiles of the maps) with a blank image: the tests never depend on a server outside the product, which limits its use and may not be reachable.

#### loginAs

`loginAs<P extends Product>(page: Page, product: P, role: Role<P>): Promise<App<P>>`: Opens the application as the test user of the role (`test_user` of spec/product.yaml, the password of the environment variable E2E_PASSWORD) through the login screen, the images of other origins stubbed (`stubForeignImages`).

#### Product

`interface Product`: The part of the specs that the helpers read, `PRODUCT` of `e2e/generated/product.ts`: the test user of each role of spec/product.yaml (`test_user`, null without one; `anonymous`: the users who do not log in) and the route of each screen of spec/screens/.

- `readonly roles: Readonly<Record<string, { readonly username: string | null; readonly anonymous?: boolean; }>>`
- `readonly screens: Readonly<Record<string, { readonly route: string; }>>`

#### App

`class App`: The application in a page, at a screen of the specs.

- `constructor(page: Page, product: P)`
- `screen(): Locator`: The current screen, `screen:<id>`.
- `form(): Locator`: The open form.
- `open(screen: ScreenId<P>): Promise<void>`: Opens a screen by its route (one without the id of an item) and waits for its state.
- `openItem(options: { where: Values; }): Promise<void>`: Opens the first row of the list of the current screen whose cells `cell:<name>` have exactly these texts: on the page shown, else searched with the search of the list (`field:$search`), each text of `where` in turn, else on the next pages (`action:next-page`) of the list without a search; fails when no page has it.
- `action(id: string): Promise<void>`: Runs an action of the current screen, `action:<id>`.
- `fill(values: FormValues): Promise<void>`: Fills fields of the open form, `field:<name>`: a text, a number, a date; a select (a choice) by the label of its option; a combobox (the picker of a relationship) by the label of the item, searched in its popup, null by its option that clears the value; the picker of a to-many relationship by the list of the labels of its items, which replace those it had (`[]`: none); a checkbox by true or false.
- `upload(field: string, file: string): Promise<void>`: Uploads a file (a path in `e2e/fixtures/`) into a file field of the open form, its input `field:<name>`, and waits until it is uploaded (the field `upload:<name>` is no longer busy, its `aria-busy` absent or `"false"`, and shows the name of the file) or shows an error of this upload.
- `submit(options?: { saved?: boolean; }): Promise<void>`: Submits the open form and waits until it is closed (saved) or shows an error of this submit (not one of a previous submit), which the next step expects (`expectError`, `expectState`).
- `transit(id: string, payload?: Values): Promise<void>`: Runs a transit of the item of the current screen, `transit:<id>`, with the values of its payload in its dialog, and waits until it is done (the transit is no longer offered) or shows an error.
- `expectScreen(screen: ScreenId<P>): Promise<void>`: The current screen is this one: at its route (another screen may show next to it, such as a list next to its card), with its state rendered.
- `expectStatus(status: string): Promise<void>`: The item of the current screen has this status, `status:<id>`.
- `expectState(state: State): Promise<void>`: The page shows this state, `state:<state>` (a screen kept hidden next to it does not count).
- `expectActionAbsent(id: string): Promise<void>`: The current screen, once loaded, does not offer this action.
- `expectFieldReadonly(field: string): Promise<void>`: The user may not change the field: read-only (or not there) in the open form; on a card without a form, the card has no edit (`action:edit`), or its edit has the field read-only (the edit is opened and cancelled).
- `expectFieldAbsent(field: string): Promise<void>`: The user may not see the field: the current screen, once loaded, has no `field:<name>` (a card, the open form) and no cell `cell:<name>` (a list).
- `expectValues(values: Readonly<Record<string, string>>): Promise<void>`: The fields of the current card show these texts: the text of each `field:<name>` contains its text (a file: its name).
- `expectRows(count: number): Promise<void>`: The list of the current screen has this number of rows, `row:<id>`.
- `expectError(field: string): Promise<void>`: A field shows a validation error, `error:<name>`.
- `expectNotification(text: string): Promise<void>`: The user has a notification whose text contains this text: the bell (`action:notifications`) opens the list of the notifications (`list:notifications`), which waits for it (`notification:<key>`), and is closed again.
- `language(code: string): Promise<void>`: Switches the language of the interface to a language of the backend (`LANGUAGES` of the contract): the button of the layout, `action:language`, until its `data-value` is the code.

#### The types and the constants of `../bazis`

- `type Role<P extends Product> = keyof P['roles'] & string`: A role of the specs.
- `type ScreenId<P extends Product> = keyof P['screens'] & string`: A screen of the specs.
- `type Values = Readonly<Record<string, string | number | boolean | null>>`: The values of fields by name, scalars as in the specs.
- `type FormValues = Readonly<Record<string, string | number | boolean | null | readonly string[]>>`: The values of the fields of a form by name: a scalar, or the labels of the related items of a to-many relationship (a list, `[]` for none).
- `type State = 'loading' | 'empty' | 'loaded' | 'error' | 'forbidden' | 'not_found' | 'invalid'`: The states that the screens render (`state:<state>`).
