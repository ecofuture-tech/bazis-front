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
2. Describe the product top down: `spec/product.yaml` (the roles with their `test_user`, or
   `anonymous: true` for the users who do not log in, the entities with their fields,
   workflows and access, the scenarios, the languages), "The
   specs"; then a file `spec/screens/<id>.yaml` per screen (the home, `/`, a dashboard:
   fill the starter of `init`) and the design, "The specs of the screens and the design".
3. Build the backend to satisfy the specs: the models and route sets, the roles with their
   permissions in `roles.py`, the workflows in `workflow.py`, the `e2e_data` command, "The
   backend of a product" (and the guides of bazis-permit and bazis-statusy).
4. Migrate the database and export the contract, `python manage.py bazis_front contract`:
   "The contract".
5. Run `python manage.py bazis_front check` and fix the spec or the backend as the hint of
   each issue says until it reports no errors, exporting the contract again after every
   change of the backend: "The issues of check".
6. Generate the screens, `python manage.py bazis_front screens` (it copies the components
   that they import), and write what their specs cannot say in their extensions (`extend`)
   or the screens that they do not fit (`custom: true`) in `frontend/src/screens/<id>/` (as
   "The specs of the screens and the design" says): "The components", "Writing the screens" and "Composing beyond
   the specs"; by topic "Choices, filters, permissions and relationships", "Files, points and
   maps", "Custom actions and background work", "The socket" and "The language"; the data
   through "The hooks" and "The client".
7. Design the product: choose the palette, the fonts, the shape and the surface of
   `spec/design/theme.yaml` for its domain, the icon of every entity and the tones of the
   statuses, then generate the theme, `python manage.py bazis_front design`: "The design".
8. Generate the end-to-end tests, `python manage.py bazis_front e2e`, and run them with
   `npm run e2e` against the migrated backend with the data of `e2e_data`: "The end-to-end
   tests".
9. Take the screenshots, `python manage.py bazis_front shots` (the backend running as for
   `npm run e2e`), read `frontend/.scratch/shots/report.json` and look at the screenshots,
   fix every error and take them again, at most three rounds: "The visual check".
10. Check the frontend in `frontend/`: `npm run format`, `npx tsc --noEmit`, `npm run lint`,
   `npm test` and `npm run build`; after the last edit of a file run `npm run format` and
   `npm run lint` again; `python manage.py bazis_front status` lists what is stale.

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
- **Generate the screens, never edit them.** `bazis_front screens` writes
  `frontend/src/screens/generated/` from the specs: run it after every change of `spec/`;
  what a spec cannot say goes to a custom screen (`custom`) or an extension (`extend`), never
  into the generated files.
- **Generate the end-to-end tests, never edit them.** Run `bazis_front e2e` after every
  change of the scenarios or the screens of the specs and keep `npm run e2e` green against
  the migrated backend with the data of `manage.py e2e_data`; write the other tests in
  `frontend/e2e/custom/`.
- **Look at the screens, not only at the tests.** After the screens, `bazis_front shots`
  checks what they render on a desktop and a phone, in the light and the dark mode; fix its
  errors and the checklist of the screenshots before the screens are done.

### The sections

| Section | Read it when |
|---|---|
| The frontend | you create the frontend (`init`), need the files of `frontend/` and who changes them, the npm commands, the lock, `status` |
| The specs | you write `spec/product.yaml`: the roles, entities, fields, workflows, access (with the permissions it requires), scenarios and their steps |
| The specs of the screens and the design | you write `spec/screens/<id>.yaml` (list, card, form, dashboard, board, calendar, `card.related`, `card.tabs`, `list.filter`, `list.map`, `list.bulk`, the custom actions), which primitive a part of the product takes, the `data-bz` marks, `spec/design/theme.yaml` |
| The issues of check | `bazis_front check` reports a code (`C…`, `P…`, `S…`, `D…`) |
| The backend of a product | you build the backend the frontend relies on: the declared roles and workflows, the test data, the changes and the notifications, the invariants, the labels |
| The contract | you export the contract or read `contract.json` and `contract.ts` (`ROUTES`, `CAPABILITIES`, the sections of the capabilities) |
| The components | you choose the components and copy them (`add`): what each one is, its `data-bz`, what it requires |
| Writing the screens | you generate the screens (`bazis_front screens`) or write a custom one from its spec: the component of each part of a spec, the routes, the navigation, the card next to the list |
| Composing beyond the specs | a screen needs more than the specs say: a section of your own, a form of your own (and the marks that the tests need), numbers and dates in a text |
| Choices, filters, permissions and relationships | the choices and their labels, the related items ("add here"), the filters of a list, the navigation, the field permissions, the pickers and the labels of related items, the to-many fields in a form |
| Files, points and maps | the files of bazis-uploadable, the points and the maps, what is near |
| Custom actions and background work | an action of the backend that is no CRUD (an export, a report), its permission, a task of bazis-bg, a background request |
| The socket | bazis-ws: the live updates, the notifications and the bell, the protocol of the socket |
| The design | the presets, the tokens, the brand, the dark mode, the tones of the statuses, the classes of the theme |
| The end-to-end tests | `bazis_front e2e`, the steps and their helpers, `e2e_data`, `npm run e2e` and its ports, the tests of your own |
| The visual check | `bazis_front shots`: the screenshots, their report and its codes (`V…`), the checklist of the screenshots, when the screens are done |
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
python manage.py bazis_front screens               # the screens of the specs in src/screens/generated/
python manage.py bazis_front screens --check       # fails when they differ from the specs (CI)
```

`init` creates `frontend/` next to `manage.py`, a React 19 + TypeScript + Vite 7 app with
TanStack Query, React Router 7 and Tailwind 4 set up for shadcn/ui (`components.json`),
with the layout of the application (`app-shell`), a login screen (`login-form`) and the
screens of the specs. It never overwrites an existing `frontend/`. It writes:

- `spec/` next to `manage.py`, when the product has none (an existing one is kept): the
  JSON Schemas of the specs in `spec/schema/` (for the editors) and starters of
  `spec/product.yaml`, `spec/screens/home.yaml` (the home, a dashboard at `/` without
  tiles: the product has no entity to count yet) and `spec/design/theme.yaml` and
  `spec/design/tokens.json` (those of the preset of `--preset`); see [The specs](#the-specs);
- the theme of the frontend, `src/bazis/generated/fonts.css`, `theme.css` and `theme.ts`, compiled from
  `spec/design/` as `bazis_front design` does (see [The design](#the-design)); a design with
  errors is reported and the theme is left to `bazis_front design`;
- the screens of the specs, as `bazis_front screens` generates them (see
  [Writing the screens](#writing-the-screens)), with the components that they import; specs
  with errors are reported and left to `bazis_front screens`;

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
- `bazis-front.lock.json`: the hashes of the generated files and of the OpenAPI they were
  made from (see below), and the version and the file hashes of every copied asset, the
  template too; an asset that was not copied is not in it.
  `bazis_front e2e` adds the hashes of the specs and of the tests it generates (`e2e`),
  `init` and `bazis_front design` those of the design and of the theme (`design`), `init`
  and `bazis_front screens` those of the specs and of the screens (`screens`).

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
| `frontend/src/bazis/generated/` | 0. Contract | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API); `fonts.css`, `theme.css` and `theme.ts` (the design: the fonts, the tokens as CSS variables, `THEME`) | only `manage.py bazis_front contract`; the theme only `manage.py bazis_front design` |
| `frontend/src/bazis/client/` | 1. Protocol (`assets/client`) | the client of the Bazis protocol | bazis-front, copied by `init`; not edited, wrapped in `src/app/` |
| `frontend/src/bazis/react/` | 2. Hooks (`assets/react`) | the React hooks over the client and TanStack Query (`@/bazis/react`); `statusy/` (`@/bazis/react/statusy`) when the backend has bazis-statusy, `uploadable/` (`@/bazis/react/uploadable`) when it has bazis-uploadable, `ws/` with bazis-ws, `bg/` with bazis-bg, `async/` with bazis-async-background | bazis-front, copied; not edited |
| `frontend/src/bazis/ui/<component>/` | 3. Components (`assets/ui`) | the components (`@/bazis/ui/<component>`), each with its contract test; `init` copies those that the template requires (`state-panel`, `app-shell`, `login-form`), `manage.py bazis_front screens` those that the generated screens import, `manage.py bazis_front add` the others (`add map` also sets Leaflet in `package.json`: `npm install` then) | the product, keeping the contract tests passing |
| `frontend/src/components/ui/`, `frontend/src/lib/` | 3. Components | shadcn/ui components: those of the components copied by bazis-front, others with `npx shadcn add <name>` | the product |
| `spec/` (in the product root) | 4. Specs | the specs: `product.yaml` (roles, entities, access, scenarios), `screens/<id>.yaml`, `design/`; validated against the contract, its scenarios generate the end-to-end tests and its design the theme | the product; checked by `manage.py bazis_front check` |
| `frontend/src/screens/generated/` | 4. Specs | the screens of the specs, their routes (`PUBLIC_ROUTES`, `SCREEN_ROUTES`), the navigation of `spec/product.yaml`, the texts of the specs (`GENERATED_MESSAGES`), the providers and the tools of the layout | only `manage.py bazis_front screens` |
| `frontend/e2e/generated/` | 4. Specs | the end-to-end tests of the scenarios of `spec/product.yaml`, and `product.ts` (the test users and the routes of the specs); `shots.ts`, the screenshots of the screens | only `manage.py bazis_front e2e` (`shots`: `bazis_front shots`) |
| `frontend/.scratch/shots/` | 4. Specs | the screenshots and `report.json` of the last `bazis_front shots`; ignored by Git | only `manage.py bazis_front shots` |
| `frontend/e2e/bazis/` | 4. Specs | the helpers of the end-to-end tests (Playwright, through `data-bz`) | bazis-front; not edited |
| `frontend/e2e/custom/` | 4. Specs | the end-to-end tests written by hand | the product |
| `frontend/src/app/` | App (the template, `assets/template`) | providers (query cache, `BazisProvider`), session, router (the layout with the generated routes and navigation), errors | the product; merged with a new version by `update` |
| `frontend/src/screens/<screen>/` | App | the custom screens (`custom`) and the extensions (`extend`), composed from the components; the login | the product |
| `frontend/package.json`, the configs, `frontend/src/i18n/`, `frontend/AGENTS.md` | App | the rest of the template | the product; merged with a new version by `update` |
| `frontend/bazis-front.lock.json`, `frontend/.bazis/base/` | | the hashes of the OpenAPI and of the generated files, the versions and hashes of the copied assets; the pristine copies of the assets, from which `bazis_front update` merges a new version | bazis-front; commit them, never edit them |

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

`overrides` of `package.json` keeps the vite of the template for every package
(`"vite": "$vite"`): keep it. Without it npm 10 (Node 22) fails with `Cannot read properties
of null (reading 'edgesOut')` once vitest has a release newer than the one of
`package.json`. A frontend made before the override gets it from `bazis_front update`; never
work around the error with `legacy-peer-deps` or `--force`, which hide the real conflicts of
the peer dependencies.
If the product has its own `overrides`, `update` leaves a second key that JSON parsers read
instead: add `"vite": "$vite"` to the product's `overrides` by hand and keep one key
(`grep -c '"overrides"' package.json` is 1).

```bash
python manage.py bazis_front status         # the copies, the generated files, every stale or changed one
python manage.py bazis_front status --json  # {bazis_front, frontend, assets, generated, issues}
```

`status` writes nothing and exits with 0: it shows the installed bazis-front, the assets of
the lock with their versions, which generated files the frontend has (`contract`: the
TypeScript of the contract; `design`: the theme; `screens`: the generated screens; `e2e`:
the end-to-end tests; `shots`: the screenshots), and the
issues of the checks of bazis-front, each with its id, level, message, hint and `command`,
the subcommand that brings up to date what it reports stale (`contract`, `update`, `design`,
`screens`, `e2e`, `shots`; null for the others):
`front.W006` (an outdated package), `front.W001` (a stale contract or generated file; the
database must be migrated, else `front.I001`), `front.W002` (an issue of the specs),
`front.W004` (stale copies), `front.W007` (changed copies), `front.W005` (a stale theme),
`front.W010` (stale, edited or missing generated screens, none at all in a frontend made
before them whose router, updated, imports them, or the components that they import
missing), `front.W003` (stale
end-to-end tests), `front.W008` (a stale `shots.ts`), `front.W009` (a
report of the screenshots with errors, or none: the screenshots were not taken; not stale,
its `command` is null). The `--check` of
`contract`, `update`, `design`, `screens`, `e2e` and `shots`, and `check`, fail on their own state in
CI. No subcommand of `bazis_front` runs
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
The texts of the specs (`product.name`, the titles of the entities, the titles and the labels
of the screens) are in each of them: see "Texts" in
[The specs of the screens and the design](#the-specs-of-the-screens-and-the-design).

#### Navigation

**Navigation** (optional): the links of the navigation in their order, `{screen}` each,
and groups of them under a heading, `{group: <id>, title: <text>, items: [...]}`. A link
is labelled by its `label` (a text, shorter than the title of its screen: `Catalog` for
`Book catalog`), else by the title of its screen, and shown to the users whom the backend lets view
the items of its entity (a report: filter them by the fields of its `list.filter`);
`requires: {can: add}` asks that they may add one too (a link of a screen of an entity
whose route set creates). Its `icon` is a name of lucide
(D013), by default the icon of its entity (`icons` of theme.yaml), `square-kanban` for a
board, `calendar-days` for a calendar, `list-filter` for a report, `house` for the home.
A link opens a screen without an item in its route, not a form, once (S030). The
generated navigation is made from it (`src/screens/generated/navigation.ts`). Without
`navigation`: the home, then of each entity in the order of `entities` its list, its
board, its calendar and its reports, but the screens with `nav: false`.

```yaml
navigation:
  - {screen: home}
  - {screen: loan-list}
  - {screen: loan-board, requires: {can: add}}
  - group: catalog
    title: {en: Catalog, ru: Каталог}
    items: [{screen: book-list, label: {en: Books, ru: Книги}}, {screen: author-list}]
  - {screen: overdue-loans, icon: alarm-clock}
```

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
decide it. The label of a field is not in the spec either: it is its title in the backend
(`title` of the field in the contract; S018 when it is the name of the field, see "The
labels of the fields").

#### Display

**Display** (optional) of an attribute says how the screens show its value, the only
place where the spec speaks of it: `plain`, a number without the separators of its
thousands (a code: `18770`, not `18,770`); `{currency: RUB}`, a sum in the currency
(ISO 4217); `{unit: pcs}`, a quantity followed by its unit; `{bar: 100}`, a number as a bar
of its share of the maximum (a progress); `phone`, a phone number to call. `plain` and
`bar` are of an `integer` or a `number`, `currency` and `unit` also of a `string` (a
DecimalField), `phone` of a `string` (S020). The screen gives it to the components, as
it gives them the columns of a list: `display={{code: 'plain', price: {currency: 'RUB'}}}`
of `ResourceList` and `ResourceCard` (`display` of `FieldValue` for a value of its own). The
components group every number by thousands from five digits, as most languages write it
(`formatNumber` of `@/bazis/i18n`: a year `2020` and `1234` as they are, `12,345`), so a
year needs no `display`. A phone is a link to call it (a number
written without separators shown in groups, `+7 916 123-45-67`), a bar a `meter` next to
the number.

#### Label

**Label** (optional) of an entity names its fields that label an item (the book and the
reader of a loan: `label: [book, reader]`, fields of the entity, P031), for a resource
that has no attribute of a label in the contract (`label` of the resource: a `name`, a
`title`, the names of a person...; see "The label of an item"): `check` warns of an
entity without either (S019), whose items the frontend would show by their id. The screen
gives them to the card, `label={['book', 'reader']}` of `ResourceCard`, which is headed by
their values (`Idiot · Ann Lee`); without it, a card of an item without a label attribute is
headed by the values of the first two fields of its sections.

#### Workflow

**Workflow**: the statuses and the transits of bazis-statusy; a transit has one `from`
(a Transit row has one source status), and `payload` when an action of the transit takes
a typed payload. The ids are those of the Status and Transit rows, including those that
bazis-statusy generates for a Transit created without one (`task#draft_to_done`,
`task#draft_to_done#1`); any characters but `.` and white space.

The order of `transitions` is the order of the buttons of a card and of the moves of a
board, the first the main button: put the usual next step first (`complete` before
`cancel`), not the order of the ids, which the backend answers. `confirm: true` asks the
user in a dialog before the transit runs (`action:confirm-<id>`): give it to a transit that
cannot be undone and matters, a payment, a cancellation; not to the routine next step,
which a question would only slow down (a transit is never confirmed by default). A transit
with a `payload` is confirmed by the dialog of its payload. The scenarios run a confirmed
transit as any other (`transit: <id>`, `move`): the helpers confirm it.

```yaml
workflow:
  initial: issued
  statuses: [issued, paid, overdue]
  transitions:
    - {id: pay, from: issued, to: paid, confirm: true}
    - {id: mark_overdue, from: issued, to: overdue}
```

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
which opens the screen of its `list.open`; an item of a board or a calendar, its `open`; on a
dashboard a row of its last items, `open_item: {in: <recent>, where: {...}}`),
`select: {where: {...}}` and `bulk: <id>` (rows of a list with `bulk` selected, then a bulk
action run on them; P022 without a selection), `move: {where: {...}, to: <status>}` (an item
of a board with `move: true` moved to a column that a transition without a payload leads to:
P024), `action: <action of the screen>` (a custom action, `primitive: custom`, on a card,
or one of the route set in the toolbar of a list: P022 for one of `list.row_actions`, run
as a bulk action; one with `fields` opens its dialog, filled with `fill` and run with
`submit`, P023 for a property it does not ask for; one with `confirm: true` is confirmed),
`fill: {field: value}` and `upload: {field, file}` (in the open form, or on a card with
`edit: true`; a `file` field is uploaded, a file of `e2e/fixtures/` of the frontend,
never filled: P022; a to-many relationship, `many: true`, is filled with the list of the
labels of its items, `fill: {interviewers: [Ann Lee, Bob Stone]}`, which replace those it
had, `[]` for none: P022 for one value; a date or a date-time takes a day of the run too,
`today`, `today+3`, `today-1 10:30`, in UTC, as `day`), `submit: {}`, `transit: <id>` or `{id, payload}` (on a card with
`transitions: true`), `expect` with `screen`, `status`, `state`, `action_absent`,
`field_readonly`, `field_absent` (a field the screen shows that the user may not see:
not on the screen once it is loaded), `values` (`{field: text}`: the fields of the
current card, without an open form, show these texts; a file its name), `rows`,
`tile` (`{<tile>: count}`: the counts of tiles of the current dashboard), `day`
(`{today: count}`, `{today+3: count}`, `{2026-10-07: count}`: the items of days of the
current calendar; a day from the day of the run, `today±<n>` in UTC, for the dates that
`e2e_data` sets from the day of the run),
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
(no `access` then); anonymous users match no selector but `all` (P030). A screen is public
when one of its `roles` is anonymous: the frontend routes it outside the screens of a
session, and a scenario of the role opens only public screens (P035; see
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
primitive: list                  # list | card | form | dashboard | board | calendar, with its section of the same name
list:
  columns: [title, status, assignee, dt_created]
  filters: [status, assignee]    # fields with `filter` in the contract
  sort: [-dt_created]            # the order by default, each field once: fields with `order` in the contract
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

A deletion is confirmed in a dialog titled by its `title`, a question (`{en: 'Delete the
task?', ru: 'Удалить задачу?'}`, quoted in a flow mapping; `Delete this item?` by default),
not by the `label` of its button, which confirms it, and saying its `description` (that it
cannot be undone by default).

A card shows the items that reference its item in `related` sections: a list of the related
entity filtered by its to-one relationship to the entity of the card (`relation`, a field of
the related entity with `relation: <entity of the card>`, S015; one the contract filters by,
S008), its `columns`, the card a row opens (`open`), and `add`, "add here": the action
`add.id` of the card opens the create form of the related entity (`add.fields`, all its
fields but the relationship when omitted) with the relationship fixed to the item. A scenario
runs it as an action of the card (`action: add-step`), fills the form (never the fixed
relationship: P022) and submits it; the card stays. A card lists by default the items of
every entity of the product that references its entity by a to-one relationship and has a
list screen (the loans of a book and of a reader); the contract has no reverse relationship
for them unless the route set of the card shows one. In the screen it is `RelatedList`
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
(`mode: create` on a list, a card, a board or a calendar, `mode: update` on a card) and
`destroy` (on a card), and `custom` (on a list or a card, see below). The states that a primitive must render are required (S009): list
`loading, empty, error, forbidden`; card `loading, error, forbidden, not_found`; form
`loading, error, forbidden, invalid`; dashboard `loading, error`; board and calendar
`loading, empty, error, forbidden`.

#### Custom actions of the specs

A **custom action** (`primitive: custom`) is a button that calls a custom action of the route
set of the entity, a POST declared with `http_post` (`custom_actions` of its resource in the
contract, with the JSON Schema of its body): `action` is its name in its path
(`escalate` of `/{item_id}/escalate/`), `label` its button (required). On a card it is an
action of the item; on a list an action of the route set in the toolbar, or one of an item on
each row when its id is in `list.row_actions`; `list.bulk` runs one of an item on the
selected rows (`{id, action, label}`) with an empty body. A route set may have an action of
an item and one of the route set of the same name (`/{item_id}/export/` and `/export/`): the
toolbar runs the second, the card, the rows and a bulk action the first. `fields` are the properties of its
body that its dialog asks for (a property named as a field of the entity takes its title and
the labels of its choices), `confirm: true` confirms one without fields in a dialog (`title`,
`description`), `message` is the toast once it is done; the queries of the resource are
refetched. The button shows when the backend lets the user run it: on a card and in the
toolbar by `custom_actions` of the meta of bazis-permit, on the rows and in a bulk action
when the row may be changed (or deleted) as its `access_action` requires: a list tells of each
row only these (`for_change`, `for_delete`), so an action that requires another access of the
item runs on its card (S032). On a public screen an action is one declared `public=True`,
`public` of its `custom_actions` in the contract (S046). A click on a row while its action runs sends nothing; on
another row it runs beside it. S032 checks it
against the contract; an action declared with GET reads and belongs to an extension
(`useActionQuery`), what the contract cannot say (its response shown, a task followed) too:

```yaml
actions:
  - id: escalate
    primitive: custom
    action: escalate
    label: {en: Escalate, ru: Эскалировать}
    fields: [priority]             # the properties of its body asked for
    message: {en: Escalated, ru: Эскалирована}
# a list: row_actions: [escalate], bulk: [{id: escalate-all, action: escalate, label: Escalate}]
```

#### Texts

**Texts** of a screen: its `title` and `description` (the subtitle), `list.empty` (the
text of a list without items), the `label` of an action (its button, the title of its
form) and its `description`, of a bulk action, of "add here" (`card.related[].add.label`)
and of the add of a calendar, the titles of the sections, related sections and tabs of a
card, the label of a highlight and of the parts of a dashboard. A text is the text in each
language of the product, `{en: New loan, ru: Новая выдача}`, a text in its default
language, or a key of the dictionaries of the frontend (lowercase words joined by dots,
`tiles.on_hand`), which have every language. `check` warns about a text that is not in
every language of `languages` (S027). `bazis_front screens` writes the texts of every spec
in the dictionaries of the generated screens (`GENERATED_MESSAGES` of
`src/screens/generated/messages.ts`) by the key of their place, `screens.<id>.title`,
`screens.<id>.card.sections.<section>.title`, `navigation.<group>.title`,
`navigation.<screen>.label` (`navigation.<group>.items.<screen>.label` in a group), `product.name`,
`entities.<id>.title` (the `title` of an entity, a text like the others; `ENTITIES.<id>.title` is
the key of its text).
A map without the default language gives it the text of the first language of the product
that it has (the others fall back to the default). The dictionaries of the product
(`src/i18n/<language>.ts`) override them key by key.

#### Custom screens and extensions

A screen is generated from its spec; what the spec cannot say goes to an **extension** of the
generated screen, and a screen that the generated one does not fit is **custom**, written by
hand. Never edit `src/screens/generated/`: `bazis_front screens` owns it, refuses to overwrite
an edited file (`--force` drops the edits) and `front.W010` reports it.

- **`extend: true`** — the generated screen with additions: a panel before or after its
  component (counts, a summary, a custom action and its progress), buttons in its header,
  some props of its component (an empty text, the content of a cell, the tiles of a map, a
  row action). The spec keeps the rest, and a change of the spec still changes the screen.
- **`custom: true`** — the screen is the export `<Id in PascalCase>Screen` of
  `frontend/src/screens/<id>/index.tsx` (`LoanListScreen` of `loan-list`); `custom: {module:
  '@/screens/loan', export: LoanListScreen}`: an export of another module there (several
  screens in one file; never one of `src/screens/generated/`). For a layout or a flow that
  the primitive does not have. Its route, its link, the routes of the cards beside it and
  its texts are generated all the same (a generated card at `<its route>/:id` beside a
  custom list, a custom card beside a generated list); it composes the same components.

`check` reports a missing module or export (S028); once the frontend generates its screens, a
`frontend/src/screens/<id>/index.tsx` of a screen that is not custom (S029: two
implementations; the code of an extension is `extend.tsx`; `screens` refuses it also on its
first run, before the lock has `screens`, and `--force` does not lift it; `check` tells it also
before the lock has `screens`, once `src/app/router.tsx` imports `@/screens/generated`, and
says nothing while the router is the product's own); a screen with `extend` without
`export const extension` in `frontend/src/screens/<id>/extend.tsx`, or a custom screen with
`extend` (S031: a custom screen extends itself in its own code).

The extension is `export const extension: ScreenExtension<Props>` (`@/bazis/ui/screens`), the
props of the component of its primitive: `ResourceListProps` (with a map,
`ScreenExtension<ResourceListProps, ResourceMapProps>`), `ResourceCardProps`,
`ResourceBoardProps`, `ResourceCalendarProps`, `ResourceFormProps`, `DashboardProps`:

```tsx
// frontend/src/screens/loan-list/extend.tsx
export const extension: ScreenExtension<ResourceListProps, ResourceMapProps> = {
  before: <OverdueCount />, // before the component (and the map of a list)
  after: <LoanHelp />, // after it, before the forms of its actions
  actions: <ExportButton />, // in the header, after the actions of the spec
  props: { emptyMessage: <LoanEmpty />, cells: { due_date: (row) => <DueDate row={row} /> } },
  map: { tiles: LIBRARY_TILES }, // the props of the map beside the list (`list.map`)
};
```

- **The props merge with those of the spec** (`extended`): the lists of actions and tiles
  (`actions`, `rowActions`, `bulk`, `tiles`) by the `id` of their items — an item with the id
  of a generated one replaces it in its place, the others follow, so that no id is shown twice;
  the records of the fields (`cells`, `values`, `display`) field by field; `children` and
  `after` (a card's render props of its item, under its heading and under its sections)
  both, the generated first; any other prop replaces the
  generated one. A merged prop set to `undefined` keeps the generated one.
- **A dashboard is its screen**: its `props` are those of its parts (`tiles`, `charts`,
  `recent`); its header is `actions` of the extension after the create forms of the spec,
  `before` after its heading, `after` after its parts. Its `props` take no `actions`,
  `title` or `before` (a type error).
- **The extension is a constant**, not a hook: the generated screen keeps its own hooks and
  their order, and imports nothing from it but `extension`. What needs a hook (a count, a
  mutation, a translated text, `useParams`) is a component of the product rendered in a slot
  or by a render prop (`cells`, `children`); its texts are keys of its own in
  `src/i18n/<language>.ts`, outside `screens.` (S037).
- The tiles of the maps of the product are those of `MapProvider` (`OSM_TILES` by default);
  `map.tiles` of an extension sets those of one map.

**Ejecting.** An extended screen that has outgrown its spec becomes custom: copy
`src/screens/generated/<id>.tsx` to `src/screens/<id>/index.tsx`, write the extension into it
(its slots in place of `extension.before`..., its props in place of `extended(...)`), delete
`extend.tsx`, set `custom: true` and remove `extend`; `bazis_front screens` then deletes the
generated file and routes the custom one. Back to generated: delete the code of the custom
screen (keep what the spec cannot say in `extend.tsx`) and remove `custom`.

A screen of an item, a card or an update form, has `:id` in its route (S038): its screen reads
the item there, and every screen opens it with the id of the item; a custom one may find its
item itself (`/me`, the card of the user). The screen after a form
or an action (`then`) is a screen without an item, or the card of the saved item (S006); none
of an item after a deletion. A generated card is headed by the label of its item: its
`title` is not shown, and not among the texts of the specs. `nav: false` leaves the screen
out of the navigation generated without `navigation` of product.yaml.
`card.related[].add.when` is when "add here" is shown: `changeable` (the default, while the
user may change the item of the card) or `always`.

#### Tabs and bulk actions

A card with many parts is in tabs, `card.tabs`: each section, each related section and the
history (`history: true`, of a card with `history`) in exactly one tab (S024); the transits
stay above the tabs. Without `tabs` the parts are one below the other: the transits under
the heading, then the sections, then the related sections and the history. The scenarios do not
name the tabs: the helpers of the tests show the tab of what a step acts on.

```yaml
card:
  sections: [{id: main, fields: [full_name, card_number, phone]}, {id: notes, fields: [notes]}]
  history: true
  related: [{id: loans, entity: loan, relation: reader, columns: [book, due_date, status], open: loan-card, add: {id: issue}}]
  tabs:
    - {id: details, title: Details, sections: [main, notes]}
    - {id: loans, title: Loans, related: [loans]}
    - {id: history, title: History, history: true}
```

A list acts on the rows that the user selects with `bulk`: a transition of the workflow of
the entity (one without a payload, S025; one with a payload is run on the card of each
item), the deletion, `primitive: destroy`, or a custom action of an item, `action` (with an
empty body, see [Custom actions of the specs](#custom-actions-of-the-specs)). The screen runs it on each selected item in
turn (a transit, a delete or an action per item, bazis-bulk is not needed) after a confirmation; it
reads nothing per item first: the backend refuses an item it does not allow (a transition
its status does not have now), which stays selected, with the error shown (`error:bulk`):

```yaml
list:
  columns: [book, reader, due_date, status]
  bulk:
    - {id: return-all, transit: return}
    - {id: delete, primitive: destroy}
```

#### Dashboard, board and calendar

**The home of the frontend is a dashboard**, `spec/screens/home.yaml` at the route `/`: the
counts that matter to the users (tiles by the statuses and the dates of the entities with a
workflow or dates), the last items of the main entity, the create forms of the entities.
Without it `/` leads to the first link of the navigation. `init` writes it without tiles,
and `check` warns once `product.yaml` declares entities (S026: no screen at `/`, another
primitive there, or a dashboard without tiles): fill it then. A dashboard has no `entity`:
each part names its own.

```yaml
spec: bazis-screen/1
id: home
title: Library
route: /
roles: [librarian, reader]
primitive: dashboard
dashboard:
  tiles:                         # tile:<id>, the count in data-value; a click opens the list `open`
    - {id: on-hand, entity: loan, filter: {status: issued}, tone: info, label: tiles.on_hand}
    - {id: overdue, entity: loan, filter: {is_overdue: true}, tone: danger, label: tiles.overdue, open: overdue-loans}
    - {id: books, entity: book, label: tiles.books, open: book-list}
  charts:                        # chart:<id>: by the status of a workflow, or by a date per bucket
    - {id: by-status, entity: loan, by: status, kind: donut, label: charts.by_status}
    - {id: issued-by-week, entity: loan, by: dt_issued, bucket: week, last: 12, kind: bar, label: charts.issued}
  recent:                        # recent:<id>, its rows row:<id> with their cells cell:<column>
    - {id: last-loans, entity: loan, columns: [book, reader, due_date, status], sort: [-dt_issued], limit: 5, open: loan-card, label: recent.loans}
  actions:                       # action:<id>, a create form of its entity
    - {id: issue, primitive: form, entity: loan, mode: create, fields: [book, reader, due_date], then: loan-card}
states: [loading, error]
```

The `label` of a part is a key of the dictionaries of the frontend or a text. A tile counts
the items of its entity with its `filter` (as `list.filter`: S008, S014); `open` is a list
of the entity, that of a row of the last items a card of it (S006). **A tile, a chart and
the last items are shown to the users whom the backend lets view their entity**
(`useCan(path, 'view')`, `Viewable` of the dashboard): one dashboard serves every role of the
screen, the tiles of the invoices shown to the receptionist and not to the doctor who may
not view them, without an `extend` (a part of an entity that no role of the screen may view
is never shown). A chart is by `status`
(an entity with a workflow: a count for each status) or by a field `date` or `datetime`, a
count for each `bucket` (`day`, `week`, `month`; a week by default), the `last` ones up to the
current one (12 by default) (S021).

**The data of a dashboard, a board and a calendar comes from the lists of the API**: the
core has no aggregates, and none is needed. A count is a list of one item with its
pagination, `GET <path>?page[limit]=1&meta=pagination&filter=<filter>`, its
`meta.pagination.count` (`useList` and `pagination` of the hooks); a chart by status is one
count per status of the workflow (`filter=status=<id>`, the statuses of
`CAPABILITIES.statusy.models`), a chart by date one count per bucket
(`filter=<field>__gte=<start>&<field>__lt=<end>`); the last items are a list sorted by
`sort` with `page[limit]`; a board lists each column with `filter=status=<id>` (more items
by its pagination), a calendar the items of the period shown with a range of its field (a
month in one list of up to 500 items). A dashboard over thousands of items is a few count
requests, which the cache of the queries keeps and the live updates refresh; a sum
(`sum(amount)`) needs a custom action of the backend, read with `useActionQuery`. The fields
they filter and sort by are those of the contract (S008).

A board shows the items of an entity with a workflow (S022) in a column for each status of
`columns` (the statuses of the workflow, all of them in their order by default); an item
shows its `card.title`, its `card.fields` and a badge while its boolean field `card.badge` is
true (S022). With `move: true` an item moves to the column of a status that a transit
allowed to it leads to (the transits of the item, `useTransits`); a transit with a payload
opens its dialog, a column without a transit takes nothing.

```yaml
primitive: board
entity: loan
board:
  by: status                     # the status of the workflow, the only field of the columns
  columns: [issued, returned]
  card: {title: book, fields: [reader, due_date], badge: is_overdue}
  filters: [reader]
  move: true
  open: loan-card
states: [loading, empty, error, forbidden]
```

A calendar shows the items of an entity on the days of a field `date` or `datetime`
(`field`; `end`, a second one, for the items that span days), a month or a week at a time
(`views`), each item by its `label` fields (the label of the entity by default), in the tone
of `tone` while its boolean field is true (S023). `filters` are those of a list (S008,
S040): the schedule of one doctor, one room, one master is a filter by the relation, not a
screen of your own; the backend still decides what each user sees (a doctor who views only
his own appointments sees only them, whatever he filters). `add` is the create form of the
entity, the action `add.id`, with `field` filled with the day selected (today by default) at
`time` (`HH:MM`, the start of the day by default) for a date-time, its `end` `duration`
minutes later (S042; without it the form shows the end empty, S043), and the related item or
the choice that a filter of the user selects, for a field of its form (a visit booked with
the doctor of the schedule shown).

```yaml
primitive: calendar
entity: appointment
calendar:
  field: starts_at
  end: ends_at
  label: [pet, doctor]
  tone: {field: is_today, tone: info}
  views: [week, month]
  filters: [doctor]
  open: appointment-card
  add: {id: book, fields: [pet, doctor, starts_at, ends_at, reason], time: '09:00', duration: 30}
states: [loading, empty, error, forbidden]
```

#### Which primitive

| The product has | The screens |
|---|---|
| any entity | the home, a `dashboard` at `/`: tiles by the statuses and the dates, the last items of the main entity |
| an entity | a `list` and its `card` |
| an entity with a workflow | a `board` too, its columns the statuses, `move: true` |
| a date or a date-time field of a term (`due_*`, a planned `*_at`) | a `calendar` too, by that field |
| a card with two related sections or more, or a history | `card.tabs` |
| a list whose items are transited | `list.bulk` with the transitions without a payload |
| a custom action of the route set (`custom_actions` of the contract, POST) | `primitive: custom` on the card, in `list.row_actions` or `list.bulk` for an action of an item; in the toolbar of the list for one of the route set |

#### `data-bz`

**`data-bz`**: the screens mark their elements, and the scenarios act through them:
`screen:<id>`, `state:<loading|empty|loaded|error|forbidden|not_found|invalid>`,
`list:<entity>`, `row:<id>` (its cells `cell:<column>`), `field:<field>`,
`error:<field>`, `upload:<field>` (a file field, `aria-busy` while its file uploads; the
input of the file is its `field:<field>`), `file:unavailable` (a file the user may not
read), `action:<id>` (in a row too: a row action), its confirmation `action:confirm-<id>`
(a destroy action, a custom action with `confirm`), `transit:<id>`, `status:<id>`,
`nav:<screen>`, `map:<entity>` with `marker:<id>` (`list.map`); `select:<id>` (a row,
`select:all` the rows of the page), `bulk:<id>`, its confirmation `action:confirm-bulk` and
its failures `error:bulk` (`list.bulk`); `tab:<id>` (`role="tab"`, its panel, `role="tabpanel"`
named by its `aria-controls`, kept in the page, hidden, while another tab is shown:
`card.tabs`); `tile:<id>` (its count in `data-value`), `chart:<id>`, `recent:<id>` (a
dashboard); `board:<entity>`, `column:<status>`, the menu of an item `action:move` with
`move:<status>` (a board); `calendar:<entity>` (the days shown, `data-from` and `data-to`,
`YYYY-MM-DD`; `action:previous-period`, `action:next-period`), `day:<YYYY-MM-DD>` (the
number of its items in `data-count`) (a calendar); the items of a board, a calendar and the
last items are `row:<id>` with their cells `cell:<field>`, without a `list:<entity>`; of the components of the
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
palette: forest            # indigo | forest | ember | slate | ocean | plum
fonts: inter               # system | inter | manrope | ibm-plex | geist | source-serif-display,
                           # or a family of Google Fonts: {google: "Inter:wght@400..700"}
shape: soft                # sharp | soft | round
surface: elevated          # flat | bordered | elevated
mode: both                 # both (switched by the user) | light | dark
navigation: sidebar        # sidebar | topbar
density: comfortable       # comfortable | compact
composition:
  list: table              # table | cards
  list_phone: cards        # cards | table (scrolled sideways)
  list_card: split         # split (the list and the card side by side) | pages
  forms: dialog            # dialog | page
icons:                     # the lucide icon of each entity, by its id
  book: book-open
  reader: users
  loan: clipboard-list
statuses:                  # the tone of the badge of each status of bazis-statusy
  draft: neutral           # neutral | primary | info | success | warning | danger
  in_progress: info
  done: success
```

`spec/design/` is optional (without it the theme is that of the starter of `workspace`
before the layers: the palette `indigo`, the fonts of the system, the shape `soft`). The
tokens are layers: those of the starters that `palette`, `fonts`, `shape` and `surface`
name, then `tokens.json` over them, which is optional; together they must define the
tokens of the preset (D005). An option of `theme.yaml` that is left out is that of the
preset. `tokens.json` is a subset of the DTCG format: groups of tokens with `$value` and
`$type` (`color`, `dimension` in `px`/`rem`/`em`, `fontFamily`, `fontWeight`, `number`,
`duration` in `ms`, `shadow`, `cubicBezier`) on every token, and references
`{group.token}` to a token of the same type (D006), never coming back to the token they
start from (D004). `bazis_front design` compiles them into the theme of the frontend (see
[The design](#the-design)); `check` reports the statuses of `statuses` that the contract
does not have (D008), the text colors below the contrast of WCAG AA (D009), `mode: dark`
without the values of the dark mode (D010), an entity with a screen and no icon
(D011), a layer of theme.yaml that `tokens.json` hides, replacing more than half of its
tokens (D012), and the name of an icon that lucide-react does not have (D013).

## The issues of check

An issue is `{layer, file, path, code, severity, message, hint}`: `file` is relative to
the product root, `path` the JSON Pointer of the value, `hint` the fix. The codes are
stable. Errors fail `check` (exit 1); warnings do not. When `spec/` exists, the system
check `front.W002` (run by `bazis_doctor`) reports each error with its code and place, and
all the warnings as one message with the count of each code (`25 warnings of the specs (S027
x14, …)`: every management command prints the system checks); `bazis_front check` lists
the warnings with their places and fixes. The system checks run before every management
command, so an error of the specs is a warning there, never blocking `migrate` or `contract`.

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
| `P031` | error | the `label` of an entity names a field that the entity does not declare |
| `P032` | error | the generated screens would name two entities alike (`task-step` and `task_step`: `TASK_STEP`), or an entity by a name of their own (`ENTITIES`, `FILTER`) |
| `P033` | warning | a scenario changes an item that it did not create (a transit, a move, an edit, a custom or a bulk action, a deletion, a related item added to it): an item of the test data, which the other scenarios and the next runs expect as it is |
| `P034` | warning | a scenario finds an item that it did not create by the texts of the items that a scenario creates: on a database that keeps the items of the previous runs it may find one of theirs |
| `P035` | error | a scenario of an anonymous role opens a screen that is not public (no anonymous role in its `roles`), by `open`, `open_item` or the `then` of a form: the frontend sends a user without a session to the login. List the role in `roles` of the screen, or give the scenario a role that logs in |
| `S001` | error | a screen file is not valid YAML |
| `S002` | error | a screen does not follow screen.schema.json |
| `S003` | error | the id of a screen differs from its file name, or its route is taken |
| `S004` | error | a screen references an unknown entity |
| `S005` | error | a screen references an unknown role |
| `S006` | error | a screen references an unknown screen, or one of another primitive, or opens an item in a card without `:id` in its route (a custom card that finds its item itself); a form or an action leads to a screen of an item (`:id` in its route) that is not a card of the saved item, or a deletion to one |
| `S007` | error | a screen references a field that its entity does not declare |
| `S008` | error | a filter or a sort field cannot be filtered or sorted by in the contract |
| `S009` | error | a state required by the primitive is missing |
| `S010` | error | an action is not valid: a duplicate id (`edit` on a card with `edit: true`, which is its edit), or not possible on the primitive (a custom action is one of a list or a card), or a row action (`list.row_actions`) is not a custom action of the screen |
| `S011` | error | transitions or history on a card whose entity has no workflow |
| `S012` | warning | a screen edits or filters a relationship with a picker (a filter of a list, a field of a form or of a card with `edit`), and the related resource has no search fields in the contract: its picker lists the items without a search |
| `S013` | error | a list has `search`, and the resource of its entity has no search fields in the contract: the search is 400 `ERR_FILTER` |
| `S014` | error | a value of the filter of a list or a tile does not fit the type of its field in the contract, or the highlight of a list is not by a boolean field or has no label |
| `S015` | error | the relation of a related section of a card is not a to-one relationship of the related entity to the entity of the card |
| `S016` | error | the map of a list is not by a point field of its entity, or a point field is a filter of a list |
| `S017` | warning | a screen edits or filters a relationship with a picker, and the search fields of the related resource do not cover the fields that give the label of its items (`first_name`, `last_name`, `name`…: see "The label of an item"): a search by the label shown finds nothing |
| `S018` | warning | the title of a field of an entity in the contract is its name (`is_overdue`) or the default `verbose_name` of Django (`status author`): the backend gives the field no label (a calculated field without a title), or one that reads as its name; give it one in the backend (see "The labels of the fields"), never in the dictionaries of the frontend |
| `S019` | warning | the resource of an entity has no attribute that labels its items in the contract (`label`: a `name`, a `title`, the names of a person…), and the entity has no `label`: the frontend shows an item by its id |
| `S020` | error | the `display` of a field does not fit its type: `plain` and `bar` of an `integer` or a `number`, `currency` and `unit` also of a `string` (a DecimalField), `phone` of a `string`, none of a relationship |
| `S021` | error | a chart of a dashboard is neither by the `status` of an entity with a workflow nor by a `date` or `datetime` field, or has a `bucket` or `last` without a date |
| `S022` | error | a board is of an entity without a workflow, has a column that is not a status of its workflow, or a `badge` that is not a boolean field |
| `S023` | error | a calendar is not by a `date` or `datetime` field (`field`, `end`), or its `tone` is not by a boolean field |
| `S024` | error | the tabs of a card are inconsistent: a tab names an unknown section or related section, or is empty, or is declared twice; a section or a related section is in no tab or in two; the history is in no tab, or a tab has a history that the card does not have |
| `S025` | error | a bulk action of a list runs a transition that its entity does not have (or has no workflow), or one with a payload |
| `S026` | warning | the frontend has no home of its own: the product declares entities, and no screen has the route `/` (it leads to the first link of the navigation), the screen there is not a dashboard, or a dashboard has no tile |
| `S027` | warning | a text of the specs is not in every language of the product (`languages`): a text without the map of its languages, or a map without one of them (a key of the dictionaries is in all); the frontend shows the text of another language |
| `S028` | error | a custom screen has no code: the module of `custom` (`frontend/src/screens/<id>/index.tsx` for `custom: true`) is missing, or does not export its component |
| `S029` | error | a screen has two implementations: `frontend/src/screens/<id>/index.tsx` is there, and the screen is not `custom` (once the frontend generates its screens: the lock has `screens`, `src/app/router.tsx` imports `@/screens/generated`, or `screens` is run) |
| `S030` | error | the navigation of spec/product.yaml links an unknown screen, a screen of an item (`:id` in its route), a form or a screen with `nav: false`, or a screen twice, or declares a group twice; a link `requires` a screen without an entity, or `can: add` of a resource without a create route |
| `S031` | error | a screen with `extend` has no extension: `frontend/src/screens/<id>/extend.tsx` is missing or does not export `extension`, or the screen is `custom` |
| `S032` | error | a custom action (`primitive: custom`) or a custom bulk action is not a custom action of the route set of the entity in the contract (`custom_actions` of its resource) declared with POST (one declared with GET reads: `useActionQuery` in the code of the screen), of an item on a card, in `list.row_actions` and in a bulk action, of the route set in the toolbar of a list (an action of an item and one of the route set may share a name, `/{item_id}/export/` and `/export/`); in `list.row_actions` and in a bulk action one whose `access_action` is not `view`, `change` or `delete` (a list has no meta of another per row: run it on the card); or its `fields` name a property that its body does not have, or leave out one that it requires (a bulk action sends an empty body) |
| `S033` | error | the generated code would name two screens alike (`task-list` and `task_list`: `TaskListScreen`), or two actions of a screen (`add-step` and `add_step`: `addStep`), or two custom bulk actions of a list |
| `S034` | error | the add of a calendar creates the item on the selected day, in a field that the create route of its resource does not take (a date that the backend sets, such as that of the creation: the day is lost), or the resource has no create route |
| `S035` | warning | the buttons of the create forms of a screen cannot be told apart: two create actions (or the add of a calendar) with the same label, or without one (both say `Create`), or a create action of a dashboard without a label |
| `S036` | warning | a text of the specs is a key that no dictionary of the frontend has (src/i18n/<language>.ts of the product, nor those of the components): the screen would show the key, unless the product gives it otherwise (the dictionaries are read as text) |
| `S037` | warning | a dictionary of the product (src/i18n/<language>.ts) has a key of the texts of the specs (`screens.<id>...`) that no text of the specs has: of a screen, a section, a tab or an action that is not there, or a text that the spec does not give |
| `S038` | error | a screen of an item has no `:id` in its route: a card or an update form that is not custom (the id of the item is in the route; a custom one finds its item itself) |
| `S039` | error | a sort names a field twice (`planned_date` and `-planned_date`): a sort is the order of the items by default, by its first field, then by the next one for the items equal by it; keep the field once (the user sorts a list by the headers of its columns) |
| `S040` | error | a list, a board or a calendar has filters, or a list is a report (a `filter`, whose link in the navigation reads them), and the route set of its resource does not route the fields that the user may filter by (`route_filter_fields/`): its `actions` leave out `get_route_filter_fields`, and the filters show an error. Add it to `actions` (the frontend needs the routes of the list, of the item, of their schemas and of the fields of the filters), never remove the filters for it. A report that the navigation does not link (`nav: false`, a route with `:`, or not in the `navigation` of the product) is not checked |
| `S041` | warning | the add of a calendar whose `field` is a date-time, which the create route takes (else S034), lists `fields` without it: the item is created at the start of the selected day (00:00) and the user cannot pick the time. Add the field to `fields` of `add` (or omit `fields`: all the writable fields) |
| `S042` | error | the add of a calendar has a `time` or a `duration` that it cannot use: `field` (and `end`, for a duration) is not a date-time, the calendar has no `end`, or the form of the add does not send the end (left out of its `fields`, or not taken by the create route). Remove the key, or give the calendar its date-time `end` and the form the field |
| `S043` | warning | the add of a calendar by date-times shows `end` in its form without `duration`: the form starts with the end empty, which the user fills for every item. Give the add the usual length of an item in minutes (`duration: 30`), which the user may change |
| `S044` | error | a public screen (an anonymous role in its `roles`) creates, changes or deletes through the routes of the entities, which bazis-permit always refuses to anonymous users: a form (a create or an update action, a form screen, `card.edit`, "add here", the add of a calendar, a create form of a dashboard), a deletion, `list.bulk` or `board.move`. A guest writes through a custom action declared `public=True` (`primitive: custom`) |
| `S045` | error | a public screen leads to a screen that is not public (`open`, `then`, a tile, the last items, a related section), or a card is in the layout of a list (its route continues the route of the list) that is not public when the card is, or public when it is not, or a public card links back to a list that is not public |
| `S046` | error | a custom action of a public screen (`primitive: custom`) is not declared `public=True` in the contract (`public` of its `custom_actions`): bazis-permit refuses it to anonymous users. Declare it `public=True` (with its throttle) and export the contract again |
| `S047` | warning | the product has an anonymous role that no screen lists in its `roles`: the users who do not log in have no screen |
| `S048` | error | `src/app/router.tsx` routes the generated screens (it imports `@/screens/generated/routes`) without the public ones: it does not import `PUBLIC_ROUTES`, and a user without a session never reaches them (a router of the product changed before 0.4.0). Run `bazis_front update` and take the router of the template, or route `PUBLIC_ROUTES` in its layout outside `RequireSession`, as the template does |
| `D001` | error | a design file is not valid YAML or JSON |
| `D002` | error | spec/design/theme.yaml does not follow design.schema.json |
| `D003` | error | spec/design/tokens.json does not follow tokens.schema.json |
| `D004` | error | a token references an undefined token, or references itself through other tokens |
| `D005` | error | a token required by the preset is undefined or of another type |
| `D006` | error | a token references a token of another type |
| `D007` | error | a token of the dark mode (the group `dark`) overrides no token of the same name and type |
| `D008` | warning | a status of `statuses` in theme.yaml is not a status of the contract |
| `D009` | warning | a text color (at the opacity of the components that use it translucent) has a contrast below 4.5:1 (WCAG AA) on its background, in the light or the dark mode |
| `D010` | error | `mode: dark` in theme.yaml, and the design has no tokens of the dark mode (the group `dark`): name a palette, or define them in tokens.json |
| `D011` | warning | an entity with a screen has no icon in `icons` of theme.yaml |
| `D012` | warning | spec/design/tokens.json replaces more than half of the tokens of a layer that theme.yaml names (palette, fonts, shape, surface): the layer barely shows; the issue names the tokens |
| `D013` | warning | an icon of the specs (`icons` of theme.yaml, `icon` of the navigation or of a tile of a dashboard) is not an icon of the lucide-react of the template |

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

### The labels of the fields

**The labels of the fields** are their titles in the backend, which the runtime schemas
give in the language of the request and the contract in `LANGUAGE_CODE`: the
`verbose_name` of a model field (`_('Assignee')`, other than the name of the field), and the
title of a calculated field (`calc_property`, an annotation) in the fields of its route set,
which the core otherwise titles by its name (`is_overdue`):

```python
fields = {None: SchemaFields(include={
    'available': SchemaField(title=_('Available')),
    'is_overdue': SchemaField(title=_('Overdue')),
})}
```

A reverse relationship (the books of an author), which has no `verbose_name`, and a field
of a package (the username of Django, whose `verbose_name` is its name in English) get
their titles the same way, in the route set of the product. `check` warns of a field of
the specs whose title is its name, or the default `verbose_name` of Django (`status author`
of a field `status_author` without one: it is in English only), S018: give it a label in the
backend, with its translations in the catalogs of the project, never in the dictionaries of
the frontend. Until then the components show such a title as words (`is_overdue` as
`Is overdue`, `status author` as `Status author`), never
as an identifier; a field that the runtime schema does not title has the title of the
contract.

### The labels of the payload of a transit

**The labels of the payload of a transit** are the titles of the fields of its payload
model (`report: str = Field(title=_('Report'))`): the runtime schemas (`state_actions`)
give them in the language of the request, the contract in `LANGUAGE_CODE`.

### A time in a text of the backend

**The frontend shows a date-time in the time zone of the browser**; a text that the backend
writes with a time in it (the title of an appointment `Rex · 2026-10-18 09:00` made with
`timezone.localtime`) is in `TIME_ZONE` of the project, UTC unless `BS_TIME_ZONE` sets it: the
two differ for every user outside it. Label such an item by its fields (`label: [pet,
starts_at]` of the entity, or the `label` of the contract), which the frontend formats,
rather than by a text with the time; a text that must have one is written in the zone of the
business, `BS_TIME_ZONE=Europe/Moscow`. The end-to-end tests and the screenshots run in UTC,
as the dates of `e2e_data` and of the scenarios do: they never show the difference, so check
the texts of your backend that have a time yourself.

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
  "format": 5,
  "generated_by": {"bazis": "2.5.0", "bazis-front": "0.1.0", "bazis-permit": "2.4.1"},
  "project": {
    "language": "en",
    "languages": [{"code": "en", "name": "English"}, {"code": "ru", "name": "Русский"}],
    "resources": {
      "tasks.task": {
        "model": "tasks.Task", "route_set": "tasks.routes.TaskRouteSet", "path": "/api/v1/tasks/task/",
        "actions": {"action_list": "collection", "action_retrieve": "item", "action_transit": "other"},
        "fields": {
          "title": {"title": "Title", "type": "string", "filter": "title", "order": "title"},
          "dt_created": {"title": "Creation time", "type": "string", "format": "date-time", "filter": "dt_created", "order": "dt_created"},
          "assignee": {"title": "Assignee", "relation": "users.user", "many": false, "filter": "assignee", "order": "assignee"}
        },
        "label": ["title"],
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
  distributions whose apps the project installs.
- `project.languages` are the languages of the backend (`LANGUAGES`, in their order, with
  their names) and `project.language` its default language (the code of `LANGUAGES` that
  `LANGUAGE_CODE` names: the same code, else the same base code): those the interface may be in.
- `project.resources` is keyed by the JSON:API type. A resource is described by the route
  set that the core uses as the default route of its model; other route sets of the model
  are listed in `other_routes`. `actions` maps the name of each route to its `kind` (a custom action of the route set is
  `other`: `client.action`). A route set that narrows its `actions` keeps those that the
  frontend reads: `action_list`, `action_retrieve` and their schemas (`action_schema_list`,
  `action_schema_retrieve`), the create and the update with theirs when the screens change
  the items, and `get_route_filter_fields` while a list or a board filters them, or a linked report reads them (S040).
  `fields` are the attributes and relationships of the item response: `title`, the title
  of the field in the OpenAPI in `LANGUAGE_CODE` (that of the route set, else the
  `verbose_name` of the model field, else the name of the field: S018), `type` (and
  `format`) of an attribute (`format: point` for a `PointField` of the model, whose GeoJSON
  object is that of any geometry), `relation` (the JSON:API type) and `many` of a
  relationship, and `reverse: true` for one whose foreign key or many-to-many field is on
  the related model (the steps of a task, the tasks a user watches by the `related_name`):
  written in a create or an update, the core sets it to the items sent and deletes the
  unlinked items of a reverse foreign key that is not null, so a form edits it only when it
  names it;
  `label` lists the attributes that label an item, the first group of `name`,
  `full_name`, `first_name` and `last_name`, `title`, `username`, `email`, `slug`, `code`
  that the resource has (as `itemLabel` of the components reads them; empty: an item is
  shown by its id, S019);
  `filter` and `order` are the labels for `filter` and `sort`, absent when the field cannot
  be filtered or sorted: they are those the core takes (bazis 2.9), the fields of the LIST
  schema of the route set that can filter or order (`query_fields`), so a field of the item
  schema that the LIST schema does not have has neither. `search` lists the search fields of
  the route set (`search_fields`, as declared) that its LIST schema reaches, those the core
  searches with `search`; empty, the route set has no search, and a `search` is 400
  `ERR_FILTER`. Both are read for the LIST schema of the route set itself: a package that
  narrows it per user (the field permissions of bazis-permit) may refuse a field for some
  users.

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
python manage.py bazis_front add stat-card                                   # the figures of a dashboard (`dashboard` is copied with the generated home)
python manage.py bazis_front add charts                                      # the charts of a dashboard (recharts): then `npm install`
python manage.py bazis_front add resource-board board-dnd                    # a board, with bazis-statusy; its drag and drop (@dnd-kit): then `npm install`
python manage.py bazis_front add resource-calendar                           # a calendar
python manage.py bazis_front add date-picker                                 # the dates picked in a calendar (react-day-picker): then `npm install`
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
(`button`, `input`, `label`, `native-select`, `select`, `checkbox`, `dropdown-menu`, `table`,
`badge`, `card`, `dialog`, `popover`, `sheet`, `skeleton`) in
`src/components/ui/`, where `components.json` puts them. The other shadcn/ui components on
Radix that the template already has the npm package of (`tabs`, `tooltip`, `switch`,
`avatar`, `separator`, `scroll-area`) are assets too, for the screens of the product: `add
tabs tooltip` copies them the same way, never the shadcn CLI. It needs neither the network nor
the shadcn CLI. The template declares the npm dependencies of the components (`radix-ui`,
`class-variance-authority`, `lucide-react`, and `@testing-library/react` with `jsdom` for
their tests); an optional component that brings a library of its own, `map` (Leaflet),
`charts` (recharts), `date-picker` (react-day-picker, of its shadcn/ui `calendar`) or
`board-dnd` (@dnd-kit), sets it in `package.json` when it is added (`leaflet`,
`@types/leaflet`, recorded in its entry of the lock): run `npm install` then, as `add` says.
Each library is loaded with the first view that draws with it, in a chunk of its own. `update` brings these
dependencies to the versions of the new release without a conflict in `package.json`.

- A component of a package needs its capability in `contract/contract.json` (export the
  contract first): `transit-bar`, `status-badge`, `status-history`, `resource-board` and
  `board-dnd` need `statusy`,
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

- The screens of the specs are generated from them, composed from the components
  (`bazis_front screens`, `src/screens/generated/`), and the custom ones written in
  `src/screens/<id>/` from the same components (see
  [Writing the screens](#writing-the-screens)): a change of a component reaches both.

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
| `app-shell` | `AppShell` (`navigation`: `'sidebar'` or `'topbar'`; `items`: the links, each with its `screen`, `to`, `icon` and `requires`, see [The navigation](#choices-filters-permissions-and-relationships); `session`: null without a login or before it, with `signIn` then, see [The public screens](#the-public-screens); `tools`: next to the color mode, mounted once; at the foot of the sidebar on a row that wraps, above the session), `Screen`, `ListCardLayout`, `useBesideCard` (the list next to its card shows its first columns), `useBesideList` (a list in the card next to its list, a related list, shows the cards of a phone), `initColorMode`, `ColorModeToggle`, `LanguageToggle` (next to the color mode, with more than one language), `useScreenPage`, `useWide` (from the breakpoint `md`); `Screen` with `parent` (`{screen, label, to}`): the link back to the screen it was opened from, a breadcrumb from `xl`, an arrow below | `nav:<screen>` (the navigation and the link of `parent`), `screen:<id>`, `action:logout`, `action:sign-in`, `action:language` (the current code in `data-value`) | |
| `login-form` | `LoginForm`: the password form with `onLogin`, a button per method of `methods` (a login in a window, with a cancel while it waits) | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource` (shared, copied with the components) | `FieldInput` (the only input of a field of a runtime schema; `path`: its route set, for its point fields), `FieldValue`, `formatValue`, `choiceOptions`, `fieldValue`, `itemLabel`, `permitted(meta, 'add' \| 'change' \| 'delete' \| 'action_<name>', id?)`, `ItemValue` (a field of an item as a cell: the status of a statusy model as its badge), `workflowStatuses(type)` (the statuses of a workflow, the initial one first, then in the order of its transits), `DateInput` with `DatesProvider` (the control of the dates, the calendar of `date-picker`), `RelationPicker`, `RelationListPicker` (the items of a to-many relationship), `RelationLabel`, `useListFields`, `useItemFields`; `StatusLabel` (a status by its id, the badge of `StatusBadge` and of the column `status` of a list, in the tone of `statusTone`), `SOFT_TONES` (the soft colors of each tone); the points: `pointOf`, `geoJsonPoint`, `formatPoint`, `parsePoint`, `PointsProvider` | `field:<name>`, `error:<name>` | |
| `resource-list` | `ResourceList` (its `filters`, `filter`, `rowTone` and `rowToneLabel`: see [The filters of a list](#choices-filters-permissions-and-relationships); `layout`: `'table'` or `'cards'`; `phoneLayout`: the list below `md`, `composition.list_phone` of the theme by default; `compactColumns`: next to a card; `density`: the rows of the table, `'comfortable'` or `'compact'`, the density of the theme by default; `selection` and `onSelectionChange`: the rows selected, a checkbox each; `bulk`: the bulk actions on the rows selected, `{id, label, run(id)}` run on each in turn after a confirmation, those the backend refused kept selected with the error; `icon`: of the entity, in the empty state). The user hides columns and changes the density in its view; the status of an item of a statusy model is its badge; an empty list offers its actions with `permission: 'add'` in its empty state, not in the toolbar. `filterOf` | `list:<entity>` (`aria-busy` until its rows are those of its search and page, their search in `data-search`), `row:<id>` (`data-tone` and `aria-description` when highlighted) with its cells `cell:<column>` (those of a column hidden are still there) and its checkbox `select:<id>` (`select:all` for the page), `status:<id>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>` (`state:error` in the bar when its fields cannot be read), `field:$search`, `action:<id>`, `action:view` (its menu `menu:view` with `toggle:<column>` and `density:<density>`; the table has its density in `data-density`), `action:prev-page`, `action:next-page`; `bulk:<id>` (while rows are selected), `action:clear-selection`, `action:confirm-bulk`, `error:bulk` | |
| `empty-state` | `EmptyState`: the icon of the entity, a title, a hint and the actions that fill it (`children`) | `state:empty`, the `action:<id>` of its actions | |
| `stat-card` | `StatCard`: the number of the items of `path` that `filter` selects (the count of the pagination of a list of one item), its `label`, `icon` and `tone`; `onOpen`: a click on the tile | `tile:<id>` (the number in `data-value` once loaded), `state:<loading\|loaded\|error\|forbidden>` | |
| `dashboard` | `Dashboard` (`tiles`: the props of `StatCard`; `links`: the items of the navigation of `AppShell` by default, each once the backend allows it; `charts`; `recent`: the props of `RecentList`; `actions`; `hero`: the title as the hero of a portal, the preset by default), `RecentList` (the last items: `columns`, `sort`, `limit`, `onOpen`); a tile, the last items and a chart in `Viewable` shown once the backend lets the user view their route set | `screen:<id>` with `state:loaded`, `tile:<id>`, `link:<screen>`, `recent:<id>` with `row:<id>` and `cell:<field>`, the states of each list | |
| `charts` | `StatusChart` (by status: `statuses`, those of the workflow by default), `TimeChart` (by `field`, `bucket`, `last`), `Chart` (values of your own); `kind`: `donut`, `bar`, `line`, in the colors of the series of the theme, a status in that of its tone (`statuses` of the theme, the color of its badge), a value of `Chart` with `tone` too | `chart:<id>` with `value:<key>` (its number in `data-value`), `state:<loading\|empty\|loaded\|error\|forbidden>` | npm `recharts` |
| `date-picker` | `DatePickerProvider`: the dates of the forms and of the filters below it are picked in a calendar (`DatePicker`, the input of the browser with a button that opens the month) | the input of the field (`field:<name>`) | npm `react-day-picker` |
| `resource-board` | `ResourceBoard` (`columns`, `title`, `fields`, `badge`, `filters`, `move`: the moves, none by default, `transits`: their order and confirmation, `onOpen`); `BoardDragProvider` (the drag and drop of `board-dnd`) | `board:<entity>`, `column:<status>` (`data-count`), `row:<id>` with `cell:<field>`, with `move` `action:move` with `move:<status>` (read when it opens; with none, the menu says so and the card hides `action:move` once it is closed, while its status stays) and the refusal of a move `error:move`, `action:more`, `state:<loading\|empty\|loaded\|error\|forbidden>`; the dialog of a payload as `transit-bar` | `statusy` |
| `board-dnd` | `BoardDnd` around a `ResourceBoard` with `move`: a card dropped on a column runs the transit to its status; the screen readers are told the drag in the language of the interface, by the name of the item and of the status, never an id | `state:loading` until @dnd-kit is loaded | npm `@dnd-kit/core` |
| `resource-calendar` | `ResourceCalendar` (`field`, `end`, `label`, `tone`, `views`, `filters`: those of a list, `onOpen`, `add`: `{id, label, time, duration, fields, onAdd(initial)}`, the values the form starts with: `field` on the selected day (the day of a date, of a date-time the moment of `time` in the time zone of the browser), `end` `duration` minutes later, the related item or the choice of a filter of the user by a field of `fields`); an item shows its time to its `end` on the same day (`10:00–11:30`), in a day of a month its start with the range in its title | `calendar:<entity>` (`data-from`, `data-to`), `day:<YYYY-MM-DD>` (`data-count`), `row:<id>` with `cell:<field>`, `action:previous-period`, `action:next-period`, `action:today`, `view:<view>`, `action:<add.id>`, `state:<loading\|empty\|loaded\|error\|forbidden>` | |
| `resource-card` | `ResourceCard` (`children`: a node or `(item, meta) => node`, `meta` the permission meta of the item, `crud_actions` and `custom_actions`; `forms`: `'dialog'` or `'page'`; `tabs`: `{id, title, sections, content}`, `content` a node or `(item, meta) => node`, the children above them); `RelatedList`: a related section, its `rowActions`, the card (`itemPath`, `item`) read again after an add, in its `children` or after it, see [Related items](#choices-filters-permissions-and-relationships) | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>`; a related section `list:<entity>` and `action:<add.id>`; `tab:<id>` | |
| `resource-form` | `ResourceForm` (`fixed`: the values the screen sets), `FormSurface` (a dialog or a page, `mode`) | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge` (in the tone of its status), `statusOf`, `statusName(type, id, language?)`, `statusOptions(type, language?)`, `statusTone`, `transitName(type, id, language?)`, `transitTarget` | `status:<id>` | `statusy` |
| `status-history` | `StatusHistory`: the status since `status_dt`, by `status_author` | none | `statusy` |
| `transit-bar` | `TransitBar`: the transits of an item (`transits`: their order, the first the main button, and their confirmation); `useRunTransit(path, onDone, transits)`: a transit of any item with the dialog of its payload or of its confirmation | `transit:<id>`, `state:<loading\|error\|forbidden>`; in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel`; in that of a confirmation `action:confirm-<id>`, `action:cancel` | `statusy` |
| `file-field` | `FileFieldProvider` (`accept` by field, `maxSize`): `FileField` becomes the control of the file fields of `FieldInput` (the forms); `FileField`, `accepts(file, accept)`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads), its errors `error:<name>` | `uploadable` |
| `live-query` | `LiveQuery`: refetches what the messages of the socket say changed (`useLiveQueries`, `ROUTES` and `CAPABILITIES.notify.resource` by default) and shows the state of the socket (the texts `socket.<status>`) | `socket:<idle\|connecting\|open\|rejected\|unavailable>`, `action:reconnect` (unavailable) | `ws` |
| `notification-center` | `NotificationCenter`: a bell with the count of the unread notifications, their list (a click marks one read and opens it, `onOpen`), mark all read, a toast for each new one (`toasts`); `notifications` is `useInbox(ROUTES['notify.notification'])` (bazis-notify) or `useNotifications()` (bazis-ws only, which also has `clear`: forget those of the session); the stored notifications are deleted only with `onDeleteAll={inbox.deleteAll}`, after a confirmation | `action:notifications`, `list:notifications` with `notification:<key>`, `action:read-notifications`, `action:clear-notifications` (`useNotifications`), `action:delete-notifications` and `action:confirm-delete-notifications` (`onDeleteAll`) | none (its source: `notify` or `ws`) |
| `task-progress` | `TaskProgress` (the task of its `id`), `taskView`, `BG_TASKS` (the texts `bg.<view>`); a task with a file (an export) has its download | `bg:<waiting\|running\|success\|error\|interrupted>`, a progress bar per counter, `action:download`, `state:<loading\|error\|forbidden\|not_found>` | `bg` |
| `async-result` | `AsyncResult` (`start`: what `useAsyncRequest` resolved to), `asyncResult(status, response)`, `RESULT_PATH` (the texts `async.<view>`) | `async:<pending\|processing\|completed\|failed>`, `state:<error\|forbidden\|not_found>` | `async_background` |
| `map` | `ResourceMap` (`list.map`: the items with a point in `field`), `MapProvider` (the tiles of the maps, `OSM_TILES` by default, and the map of the point fields of the forms), `nearFilter(field, point, meters)`, `nearSort(field, point, {farthest?})`, `useGeolocation()`, `LeafletMap`, `MapPointControl` | `map:<entity>` (`aria-busy` while it loads) with `marker:<id>` (44 px under a finger); in a form `map:<field>` and `action:locate-<field>` | npm `leaflet` |
| `screens` (copied with the generated screens) | the parts of the generated screens: `ScreenAction` (an action in the header of a screen, shown when its `requires` is allowed), `CreateFormAction` (the create form of an action, `CreateFormAction.use()` its state), `useDestroyCardAction` (the delete of a card: its `action` and its confirmation `confirm`), `useCustomAction` (a custom action of the route set or of its items, `target`: its `action` of a card or of the toolbar of a list, `row`, `bulk` and its `dialog`), `extended` and `ScreenExtension` (the extension of a screen, `extend`) | `action:<id>`, `action:confirm-<id>` (the confirmation of a delete or of a custom action), `action:submit` and `action:cancel` (the dialog of a custom action with fields, its fields `field:<property>`), the marks of `FormSurface` and `ResourceForm` | |

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

`python manage.py bazis_front screens` generates the screens in
`frontend/src/screens/generated/` from their specs, never edited: the screen of each spec
(`<id>.tsx`), their routes, the navigation of `spec/product.yaml`, the texts of the specs,
the providers of the fields of the specs (`SocketProvider`, `FileFieldProvider`,
`MapProvider`, `DatePickerProvider`) and the tools of the layout (the notifications, the
live queries), which `src/app/router.tsx` of the template renders. It copies the components
that they import that the frontend lacks (their npm dependencies set in `package.json`: run
`npm install` then), deletes the files of a screen that is no longer generated, and never
overwrites a generated file edited since it was generated (`--force` drops the edits);
`--check` and `front.W010` compare them with the specs byte for byte, without Node. What a
spec cannot say goes to the extension of its screen, and a screen that the generated one does
not fit is written by hand in `frontend/src/screens/<id>/` (`custom: true`) from the same
components, as the table says, and routed and linked as the others (see "Custom screens and
extensions" in "The specs of the screens and the design"). A screen is one primitive (`list`, `card`, `form`, `board` or `calendar`) over an
entity, or a `dashboard`:
implement it with the route of its spec, from the components of `src/bazis/ui/` (their
`data-bz` in [The components](#the-components), their props in the `API:` sections), and
render every state that it lists. The components decide nothing: pass them the field ids
of the specs and the paths of `ROUTES`.

| Spec | Component |
|---|---|
| a screen (`screen:<id>`, its title, its actions) | `Screen` of `@/bazis/ui/app-shell` (a card: `parent`, the link back to its list, and no `title`: the card heads the screen with the label of its item, its `h1`, instead of the name of the entity); the layout, the navigation (`nav:<screen>`, `navigation` of `spec/design/theme.yaml`) and the logout are `AppShell` in `src/app/router.tsx` |
| `primitive: list` (`columns`, `filters`, `sort`, `search`, `open`) | `ResourceList` of `@/bazis/ui/resource-list` (a filter the backend does not offer the user has no control; `display` of the entity; the `status` of a statusy model is its badge, no `cells` needed; the icon of the entity in `icon`) |
| `list.filter` (a report), `list.highlight: {field, tone, label}` | `filter={Filter.where('<field>', <value>)}` of `ResourceList` (`Filter.and` for several), combined with the filters of the user: fields that every role that sees the screen may filter by, its link `requires: {path, filters: [<field>]}` (else the list answers 400 to the others); `rowTone={(row) => fieldValue(row, '<field>') === true ? '<tone>' : undefined}` (`fieldValue` of `@/bazis/ui/resource`) and `rowToneLabel={() => t('<label>')}`, the words of the highlight for those who do not see the color |
| `primitive: card` (`sections`, `edit`, `transitions`, `history`) | `ResourceCard` of `@/bazis/ui/resource-card` (only the fields the user may see; with `edit`, those its update does not change marked read-only; `label` and `display` of the entity), with `StatusBadge`, `TransitBar` and `StatusHistory` of `@/bazis/ui/status-badge`, `@/bazis/ui/transit-bar` and `@/bazis/ui/status-history` (bazis-statusy); `<TransitBar path={…} id={id} transits={ENTITY.transits} onDone={…} />`, `transits` of the entity in `src/screens/generated/entities.ts`: the order of `workflow.transitions` (the first the main button) and their `confirm`; leave it out and the buttons follow the order of the backend |
| `card.related` (the items that reference the item, "add here") | `RelatedList` of `@/bazis/ui/resource-card`: `path`, `entity`, `relation`, `item={id}`, `itemPath` (the `path` of the card), `columns`, `add={{id, label, fields}}` (the create form with the relationship fixed; leave it out while the item takes no more of them: `permitted(meta, 'change')`). In `after` of the card it is drawn under the sections of fields (a card without tabs), in its `children` under the heading, above them; one placed after the card reads it again too ("Composing beyond the specs"). They read the card again after an add |
| a field with choices (a column, a field of a card or a form, a filter) | nothing to do: the components show, offer and filter it by the labels of its choices (`enumDict` of the runtime schemas, in the language of the interface) |
| the notifications and the live updates (bazis-notify, bazis-ws) | `NotificationCenter` of `@/bazis/ui/notification-center` (its `notifications`: `useInbox` with bazis-notify, else `useNotifications`) and `LiveQuery` of `@/bazis/ui/live-query` in the `tools` of `AppShell`, under `SocketProvider` ("The socket") |
| a background task (bazis-bg), a background request (bazis-async-request) | `TaskProgress` of `@/bazis/ui/task-progress` (by the id of the task), `AsyncResult` of `@/bazis/ui/async-result` (what `useAsyncRequest` resolved to) |
| a field `type: file` (bazis-uploadable) | shown by the components (its name downloads it, a thumbnail of an image, both read with the token from its download route); edited in the forms by `FileField` of `@/bazis/ui/file-field` once `FileFieldProvider` wraps the routes ("Files, points and maps") |
| a field `type: point`, `list.map: {field}` | shown as its coordinates (`55.7558, 37.6173`) and edited as them in the forms, on a map too once `MapProvider` of `@/bazis/ui/map` wraps the routes; `ResourceMap` of `@/bazis/ui/map` beside the `ResourceList` of the screen, with its `filter` ("Files, points and maps") |
| an action of the backend that is no CRUD (an export, a report: a custom action of the route set) | `primitive: custom` in the spec when a button, its fields and its toast say it all ("Custom actions of the specs"); else a button calling `useAction(path, '<name>')` of `@/bazis/react`, its error in `StatePanel`, the task of bazis-bg it queues in `TaskProgress` ("Custom actions and background work") |
| `card.tabs` | `tabs` of `ResourceCard`: `{id, title, sections: [...]}`, a related section or the history as its `content` (`(item, meta) => <RelatedList …/>`, `(item) => <StatusHistory resource={item} />`); the `TransitBar` in the `children`, above the tabs |
| `list.bulk` (a transition, a deletion) | `bulk` of `ResourceList`: `{id, label, run: (id) => transit.mutateAsync({id, transit: '<transit>'})}` with `const transit = useItemsTransit(path)` of `@/bazis/react/statusy`, or `run: (id) => destroy.mutateAsync(id)` with `permission: 'delete'` |
| `primitive: dashboard` (the home) | `Dashboard` of `@/bazis/ui/dashboard`: `tiles` (`{id, path, filter, label, tone, icon, onOpen}`), the links of the navigation of the layout (`links` only for others), `charts` (`StatusChart` and `TimeChart` of `@/bazis/ui/charts`: `by: status`, `by: <field>` with `bucket` and `last`; each in `<Viewable path={…}>` of `@/bazis/ui/dashboard`, as a tile and the last items, so that a role the backend does not let view the entity sees none of them), `recent` (`{id, path, label, columns, sort, limit, onOpen}`), `actions` (the buttons `action:<id>` of the create forms in `FormSurface`, shown when `useCan(path, 'add')`) |
| `primitive: board` | `ResourceBoard` of `@/bazis/ui/resource-board` (`title` and `fields` of `card`, `badge`, `columns`, `filters`, `move` and `transits={ENTITY.transits}` for `move: true` (the moves in the order of `workflow.transitions`, with their `confirm`), `onOpen`), in `BoardDnd` of `@/bazis/ui/board-dnd` for its drag and drop |
| `primitive: calendar` | `ResourceCalendar` of `@/bazis/ui/resource-calendar` (`field`, `end`, `label`, `tone`, `views`, `onOpen`; `add={{id, label, onAdd: (initial) => …}}`: `initial` is an object of the values the create form starts with (`{<field>: day}`, the moment of `time` for a date-time, `end`, the choice of a filter), given as `initial={initial}` to the `ResourceForm` in `FormSurface`, which the user may change; the generated screen passes `onAdd: <form>.onOpenWith` of `CreateFormAction.use()`) |
| the dates of the forms and the filters | `DatePickerProvider` of `@/bazis/ui/date-picker` around the routes (as `FileFieldProvider`) |
| `primitive: form`, an action `primitive: form` | `ResourceForm` of `@/bazis/ui/resource-form` (`fields`, then `onSaved` for `then`), an action in `FormSurface` of the same asset (a dialog or a page, as the theme composes the forms) |
| `list.open` (the card of a list) | the card route as the child of the list in `ListCardLayout` of `@/bazis/ui/app-shell` (`composition.list_card`), the open row `selected` |
| an action `primitive: destroy` | `useDestroyCardAction` of `@/bazis/ui/screens`: its `action` in the `actions` of the card, its `confirm` in the screen (the dialog `action:confirm-<id>`, titled by `title` of the action, a question, `Delete this item?` by default, and saying its `description`: the deletion runs once confirmed) |
| an action `primitive: custom`, `list.row_actions`, a bulk action with `action` | `useCustomAction` of `@/bazis/ui/screens` (`path`, `action`, `target`: `route` in the toolbar of a list, else `item`, `item` of a card, `fields`, `confirm`, `message`): its `action` in the `actions` of the card or of the list, its `row` in `rowActions`, its `bulk` in `bulk`, its `dialog` in the screen |
| `states` | the components render them (`state:<state>`); `StatePanel` of `@/bazis/ui/state-panel` for a screen of your own |

```tsx
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { Screen } from '@/bazis/ui/app-shell';
import { permitted } from '@/bazis/ui/resource';
import { RelatedList, ResourceCard } from '@/bazis/ui/resource-card';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { useDestroyCardAction } from '@/bazis/ui/screens';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';
import { StatusHistory } from '@/bazis/ui/status-history';
import { TransitBar } from '@/bazis/ui/transit-bar';

const TASKS = ROUTES['tasks.task'];
// `workflow.transitions` of the spec: the first the main button; generated screens read it from `TASK.transits`
const TASK_TRANSITS = [{ id: 'finish' }, { id: 'start', confirm: true }];

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
  const destroy = useDestroyCardAction({ id: 'delete', label: 'Delete', path: TASKS, item: id, then: '/tasks' });
  return (
    <Screen id="task-card" parent={{ screen: 'task-list', label: 'Tasks', to: '/tasks' }}>
      <ResourceCard
        path={TASKS}
        id={id}
        edit
        sections={[{ id: 'main', title: 'Details', fields: ['title', 'assignee'] }, { id: 'report', title: 'Report', fields: ['report'] }]}
        badge={(item) => <StatusBadge resource={item} />}
        actions={[destroy.action]}
        after={(item, meta) => (
          <>
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
            <StatusHistory resource={item} />
          </>
        )}
      >
        {/* null: the user can no longer view the item */}
        <TransitBar path={TASKS} id={id} transits={TASK_TRANSITS} onDone={(done) => { if (done === null) void navigate('/tasks'); }} />
      </ResourceCard>
      {destroy.confirm}
    </Screen>
  );
}
```

### The routes and the navigation

The routes of the screens of the specs are `PUBLIC_ROUTES` and `SCREEN_ROUTES` of
`src/screens/generated/routes.tsx`, the public screens and the others, which
`src/app/router.tsx` puts in its layout, the others inside `RequireSession`: the
route of each spec, `/` the index (the layout route `/` of a list there with its cards;
without a screen at `/`, a redirect to the first link of the navigation, public when that
screen is), a card under the
list whose route its route continues (below). Each screen is imported with `lazyScreen` of `src/app/lazy.tsx`, a custom one from
its module (its own chunk,
loaded when its route is first shown, under the `ErrorBoundary` of the layout: a static
import puts every screen and the libraries it uses, a map, in the one bundle that every page
loads). Until its chunk is loaded a screen shows the loading state of the screens in a
`Suspense` of its own: a navigation of React Router is a transition, which a `Suspense`
above the routes would keep on the previous screen, a row opened with no sign of it. A chunk that fails to load (a new version deployed since the
page was opened) reloads the page, at most once in 30 s (the time of the reload in
`sessionStorage`; never when the storage is blocked), else shows the error, whose retry loads
it again:

```tsx
const TaskListScreen = lazyScreen(() => import('@/screens/task-list').then((module) => module.TaskListScreen));
```

The npm libraries that every page loads (React with the router, TanStack Query, the Radix
primitives of the layout) are chunks of their own, listed by package in `manualChunks` of
`vite.config.ts`, so that the chunk of the entry holds the code of the product: a library
that one screen needs is imported by that screen and stays in its chunk (never add it to the
list); never raise `chunkSizeWarningLimit` to hide a large chunk.

Their links are `navigation` of `spec/product.yaml`, generated as `navigation(t)` of
`src/screens/generated/navigation.ts` (the items of `AppShell`, a group under its heading,
shown with its first allowed link; a link after a group is set apart from it by a line). A
link shown only to the users that the backend allows names what it `requires`, and `AppShell` shows it once the backend answers (the screens read
the same queries: no request of its own):

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

#### The public screens

**The public screens**, those of the users who do not log in, are generated: a screen is
public when one of its `roles` is an anonymous role of `spec/product.yaml` (`anonymous:
true`), and its route is in `PUBLIC_ROUTES`, outside `RequireSession`, which sends a user
without a session to the login. The specs say nothing else (no key `public`): a screen
without `roles` is never public. The layout is the same `AppShell`, one route around every
screen (`RequireSession` within it), mounted once across them: with a session, every
link, the logout and the tools; without one (`session={null}`), only the links of the
public screens (`public: true` of their `NavItem`, a group with its public links), no tools
(the notifications and the live queries need a session) and the sign-in `action:sign-in`
(`signIn` of `AppShell`), which opens `/login` and comes back to the screen after the
login. Their screens read only what the backend gives anonymous users (a permit role
`for_anonymous`; a 401/403 is the `forbidden` state of a screen, never a redirect). A
guest writes only through a custom action declared `public=True` (S046; its throttle,
`BAZIS_THROTTLE_PUBLIC`, limits him): bazis-permit refuses every create, change and deletion
of the routes of the entities to anonymous users, so a public screen has no form, deletion,
bulk action or move (S044). A public screen leads only to public screens, and a card is in
the layout of its list when both are public or neither (S045). A product without anonymous
roles has `PUBLIC_ROUTES` null and the router of before. Registration and the reset of a
password are not in the packages: a guest who needs an account is given one.

## Composing beyond the specs

The props of every component are in the `API:` sections (the `Props` types of
`src/bazis/ui/`).

- a section of your own in a card: `children` of `ResourceCard` is `(item, meta) => …`,
  the item and its permission meta (`permitted(meta, 'change')` of `@/bazis/ui/resource`,
  from `crud_actions`), without a second `useItem`; it is drawn under the heading, above
  the sections of fields. `after`, the same render prop, is drawn under the sections (and
  the tabs): the related lists and the history of a card without tabs. A part placed after
  `ResourceCard` in the `Screen` takes the meta of
  `useItem(path, id, {meta: ['crud_actions', 'custom_actions']})`: the query of the card
  (the same key, the meta that the card asks for), not a second request; a `RelatedList`
  there reads the card again after an add as in the card;
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
- a status: the column `status` of a list is its badge (no `cells`), `StatusBadge` in
  `badge` of a card, the options of its filter `statusOptions(type)`, as in the example
  above; not also in the sections of the
  card, where `status` is its name (`statusName` of the contract, never its id) without
  the tone;
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
section of the card, `RelatedList` in its `after` (`card.related` of the spec), its `children` or after it: their
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
`route_filter_fields/` (`py_type`): a select of `options` (the select of Radix, named by
the title of the field, its option of every item `data-value=""`; the statuses:
`statusOptions(type)`; the choices of a field with choices by default), the chips yes and
no for a boolean (under the title of the field; pressed again: every item), the picker of a relationship, a range
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
'view' | 'add')` of `@/bazis/react`: the runtime schema of the list, which bazis-permit
refuses with 403 without a permission of the model, and `for_create` of a list of one item
(the runtime schema of the create without that meta); the screens read the same schema of
the list, so a user who may not add is told so without a refused request), `filters`
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
`username`, `email`, `slug`, `code` (`itemLabel` of `@/bazis/ui/resource`: the attributes
of `label` of its resource in the contract, these names for a type that the contract does
not label or an item without a value of them), else its id (the start of a long one). Show these attributes in the LIST schema of the related route
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
forms, with `FileFieldProvider` around the routes (`GeneratedProviders`, once an entity of
the specs has a file field), `FieldInput`
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
`MapProvider tiles` (`{url, attribution, maxZoom?}`, a setting of the product); the
default, OpenStreetMap with its attribution, is
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

The maps: `manage.py bazis_front add map`, then `npm install`. The generated providers
(`GeneratedProviders` of `src/screens/generated/providers.tsx`) wrap the routes in
`MapProvider` once an entity has a point field; a product sets the tiles of its own once, a
`MapProvider tiles` around `GeneratedProviders` in `src/app/router.tsx` (a `MapProvider`
without `tiles` keeps those of the one above it, OpenStreetMap without one); `map.tiles` of
the extension of a screen sets those of its map alone. A screen with `list.map` shows `ResourceMap` beside its
list, and a list of what is near the user filters by the distance from the position of the
browser:

```tsx
// src/app/router.tsx: the maps draw these tiles, the point fields of the forms get a map
const MAP_TILES: MapTiles = { url: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: '&copy; Example' };
<MapProvider tiles={MAP_TILES}>
  <GeneratedProviders>
    <BrowserRouter>…</BrowserRouter>
  </GeneratedProviders>
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
`other` in `actions` of the contract: an export, a report, a recount): a button that asks
for some properties of its body and says it is done is `primitive: custom` of the specs
(see [Custom actions of the specs](#custom-actions-of-the-specs)); in the code of a screen, call them with
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

In the frontend, with bazis-ws (`ws` in `packages` of product.yaml, with `notify` for the
stored notifications), `bazis_front screens` does it: `GeneratedProviders` wraps the routes
in `SocketProvider` with the token of the session (none before the login; the logout closes
it) and `TOOLS` gives the layout the tools, both of `src/screens/generated/`, with
`live-query` and `notification-center` copied. The dev server proxies the socket
(`vite.config.ts` reads its path from the contract). What they render:

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

// the layout of src/app/router.tsx: the tools are mounted once, with a session only
<AppShell
  …
  tools={<><LiveQuery /><Notifications /></>}
>
```

## The design

```bash
python manage.py bazis_front design           # frontend/src/bazis/generated/fonts.css, theme.css and theme.ts from spec/design/
python manage.py bazis_front design --check   # write nothing; exit 1 if the theme differs from the design
```

The design layer is what makes the products look designed rather than like a bare admin
panel: one preset, the layers of its tokens (a palette, a pair of fonts, a shape and a
surface, starters of the package named in `theme.yaml`), the tokens of a brand over them
and a few options, compiled into the frontend.
`init` generates the theme; generate it again after every change of `spec/design/` (and
after `bazis_front update`). The text depends on the design only: `--check` and the system
check `front.W005` (when the lock has `design`; without Node and the database) render it
again and compare it byte for byte; `front.W005` also reports a frontend with components and
no theme (an `init` whose design had errors).
The generated files are never edited. The design must have no errors
(`bazis_front check --layer design`).

- `src/bazis/generated/fonts.css`, imported first by `src/index.css` of the template: the
  imports of the fonts of the design, only those of its pair (an `@import` after a rule is
  dropped, so a stylesheet of Google Fonts goes before Tailwind).
- `src/bazis/generated/theme.css`, imported by `src/index.css` after Tailwind: every token
  as a CSS variable of `:root` (`color.<name>` is `--<name>`, any other token its dotted name
  with dashes: `radius` is `--radius`, `font.body` `--font-body`, `shadow.md` `--shadow-md`,
  `spacing.gutter` `--spacing-gutter`), the variables of the dark mode, the spacing of the density
  (`--space-page-x`, `--space-section`, `--space-card`, `--space-cell-x`, `--space-cell-y`,
  `--space-field`; and `--space-cell-x`, `--space-cell-y` of each density under
  `[data-density]`, the rows of a table whose density the user chooses in the view of a
  list), the Tailwind theme over them (a color utility for every color token:
  `bg-primary`, `text-muted-foreground`, `bg-<token>` of a token of the product; the soft
  colors of the tones, `bg-success-soft text-success-ink`; `font-sans` is `font.body`,
  `font-display` `font.heading`, `font-mono` `font.mono`; `rounded-sm` … `rounded-2xl` from
  `radius`; `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg` from `shadow.*`; `ease-standard` and the
  duration and the curve of every `transition` from `motion.*`) and the base styles of the
  preset (`h1`–`h3` in `font.heading` with `font.weight-heading` and
  `font.tracking-heading`).
- `src/bazis/generated/theme.ts`: `THEME`, typed by `Theme` (`preset`, `navigation`,
  `density`, `composition: {list, list_phone, list_card, forms}`, `statuses`, `icons`, and
  `dark`: whether the user switches to a dark mode), which the components read for their
  defaults.

| Token | Type | CSS variable | When no layer defines it |
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
| `color.chart-1` … `color.chart-6` | color | `--chart-1` … `--chart-6` (the charts of shadcn/ui) | the primary, info, success, warning, destructive, the muted foreground |
| `font.mono` | fontFamily | `--font-mono` (`font-mono`) | the monospace fonts of Tailwind |
| `font.weight-heading`, `font.tracking-heading` | fontWeight, dimension | `--font-weight-heading`, `--font-tracking-heading` (`h1`–`h3`) | 600; `0em` (`-0.02em` for `portal`) |
| `shadow.xs`, `shadow.sm`, `shadow.md`, `shadow.lg` | shadow | `--shadow-xs` … (`shadow-xs` of the cards, the tables and the fields, `shadow-md` of the popovers, `shadow-lg` of the dialogs) | the shadows of Tailwind |
| `motion.fast`, `motion.base`, `motion.slow`, `motion.ease` | duration, cubicBezier | `--motion-fast` … (`duration-(--motion-fast)`, `ease-standard`; `motion.base` and `motion.ease` are those of every `transition`) | 100ms, 150ms, 300ms and the curve of Tailwind |

The defaults keep the look of a design that names no layer, such as one of an older version
of bazis-front: `update` and `design` add the new tokens without changing it until
`theme.yaml` names a palette, fonts, a shape or a surface.

### Presets

**Presets.** `workspace` is an internal tool for daily work: a sidebar with the icons of the
screens (a drawer on a phone), a sticky header with the title and the actions of the screen,
tables with a sticky header, aligned numbers and the open row selected, filters in a
toolbar, the card next to the list on a wide screen (`list_card: split`; the list stays
mounted and keeps its search, filters and page, and shows its first two columns next to the
card, `compactColumns` of `ResourceList`; a list in the card, a related list, shows the cards of
a phone there), forms in dialogs. A table scrolls in its own
area as high as the screen, with its header at the top: a wide table scrolls sideways
instead of losing columns. On a phone a list shows cards (`composition.list_phone: cards`,
the default of both presets; `table` keeps the table scrolled sideways).
`portal` is a public shell: a top bar, larger type and more air, lists as grids of cards,
the card in place of the list, forms in place of the content of the screen, softer shapes
(the shape `round` of its starter). Both have a light and a dark mode, focus rings, and work
down to the width of a phone.

### The layers: palette, fonts, shape, surface

**The layers.** Choose the look in `theme.yaml`, never by writing colors: each option names a
starter of tokens of the package (`init` names those of the preset: `indigo`, `inter`,
`soft`, `elevated` for `workspace`; `ocean`, `source-serif-display`, `round`, `elevated` for
`portal`), and `tokens.json` defines only what the product adds over them. Every palette has
both modes and reaches the contrast of WCAG AA with every pair of fonts, shape and surface.

| Option | Starters |
|---|---|
| `palette` | `indigo` (cool, neutral), `forest` (book-cloth green on warm paper), `ember` (burnt orange, warm), `slate` (quiet blue-grey), `ocean` (deep teal on warm neutrals), `plum` (plum on rosy neutrals) |
| `fonts` | `inter` (Inter), `manrope` (Manrope, bold headings), `ibm-plex` (IBM Plex Sans, headings in IBM Plex Serif), `geist` (Geist), `source-serif-display` (Source Sans 3, headings in Source Serif 4), `system` (the fonts of the system, nothing to load) |
| `shape` | `sharp` (0.25rem), `soft` (0.5rem), `round` (0.875rem) |
| `surface` | the shadows (`shadow.*`, the cards with `shadow.xs`): `flat` (borders, no shadow on the cards and almost none elsewhere), `bordered` (borders with the light shadows of Tailwind), `elevated` (soft layered shadows) |

Choose them for the domain of the product, one decision for the whole product:

| Domain | Palette | Fonts | Shape |
|---|---|---|---|
| finance, law, government, internal tools of a company | `slate`, `indigo` | `ibm-plex`, `inter` | `sharp`, `soft` |
| library, education, publishing, culture | `forest`, `plum` | `source-serif-display`, `ibm-plex` | `soft`, `round` |
| health, travel, logistics, the sea | `ocean` | `manrope`, `inter` | `round` |
| retail, food, hospitality, events | `ember` | `manrope` | `round` |
| developer tools, analytics | `slate`, `indigo` | `geist` | `sharp` |

### Fonts

**Fonts.** The pairs are shipped with the frontend: the template declares their
`@fontsource` packages (OFL), and `fonts.css` imports only those of the pair it names, so
nothing is downloaded at run time and the frontend works offline. `fonts: {google:
"Inter:wght@400..700"}` loads a family of Google Fonts from its stylesheet instead (online
only). A font of the product is a token of `tokens.json` with its import:
`"body": {"$type": "fontFamily", "$value": ["Brand Sans", "ui-sans-serif", "sans-serif"],
"$extensions": {"bazis": {"import": "@fontsource-variable/brand-sans"}}}` (an npm package
that the product installs, or the `https://` URL of a stylesheet).

### Brand

**Brand.** The brand of a customer goes over the palette, in `tokens.json`: change
`color.primary` and `color.primary-foreground` (and their values of the dark mode,
`dark.color.primary`): the focus rings, the current link, the selected row and the soft
tints are derived from the primary in CSS (`color-mix`), so one color brands the product.
The palettes are OKLCH (`oklch(L C H)`): keep the lightness and the chroma of the palette and
change the hue for a consistent brand; `check` reports a text color that loses its contrast
(D009). A token of `tokens.json` replaces that of the layers: a `tokens.json` that defines
every color (that of an older version) hides the palette, so remove the colors it should
take from the palette (`check` reports a layer whose tokens it mostly replaces, D012). Set `density` for the spacing.

### Icons

**Icons.** `icons` gives every entity with a screen the name of a lucide icon
([lucide.dev](https://lucide.dev), kebab-case; `check` reports an entity without one, D011,
and a name that the lucide-react of the template does not have, D013);
the components and the screens read it from `THEME.icons[entity]` (the navigation, the
empty states, the dashboard). Choose by the meaning of the entity: people `users` (one
person `user`), a document `file-text`, money `wallet`, a deadline or a booking
`calendar-clock`, a task `square-check`, a book `book-open`, a loan or a request
`clipboard-list`, an order `shopping-cart`, a product `package`, a place `map-pin`, a company
`building-2`, a message `message-square`, a report `chart-column`.

### Dark mode

**Dark mode.** The tokens of the group `dark` are the values of the dark mode (every palette
has them): each overrides the token of the same name (`dark.color.background`; D007 when
there is none of that name and type), the others keep their value. The theme applies them to the class `dark`
of `<html>` and, until the application starts, to a dark system (unless `<html>` has the
class `light`); `initColorMode()` of `app-shell` (called by `src/main.tsx`) sets the class
from the choice of the user (system, light or dark, kept in the storage of the browser, the
button of `AppShell`). Without the group `dark` there is no dark mode (`THEME.dark` is false).
`mode: light` keeps the light mode only; `mode: dark` puts the values of the dark mode in
`:root` and turns the variant `dark:` on for every element (D010 without them): neither has
the button, `THEME.dark` is false.

### Statuses

**Statuses.** `statuses` of `theme.yaml` gives each status of bazis-statusy a tone, by the
id of the status: bazis-statusy has one table of statuses for every model, so an id is the
same status everywhere (`draft` of the tasks is `draft` of the orders). It
draws the `StatusBadge` in the soft colors of the tone, the transits to a status of the tone
`danger` are destructive buttons; a status without a tone is `neutral`. Give the tones by
meaning: the initial status `neutral`, in progress `info`, done or accepted `success`,
waiting or near a deadline `warning`, refused, cancelled or overdue `danger`.

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

- `e2e` needs a frontend made by `init` (with the helpers, `e2e/bazis/`) and specs without
  errors (`bazis_front check`). It
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
  | `open_item: {where, in}` | `openItem({where, in, created})`: the first `row:<id>` whose cells `cell:<name>` have exactly these texts, in the list of the screen (`list:<entity>`), else in the screen (the items of a board or a calendar), or in the last items `recent:<in>` of a dashboard: on the page shown, else searched with the search of the list (`field:$search`, each text of `where` in turn; it waits for the rows of the search, `data-search` and `aria-busy` of `list:<entity>`), else on the next pages (`action:next-page`), or with more items of the columns of a board (`action:more`); then `expectScreen` of `list.open`. `created: true` when the scenario created an item with these texts before (the walk of `check`: the values filled in a create form that saves, then in its edits, have the texts of `where`): only a row of an item that this test created, its id among those of the creates of its submits, never an item of a previous run with the same texts. The labels of the related items in the cells (`RelationLabel`) are read after the rows: every step waits until no `state:loading` is left on the page, theirs too. A list that the scenarios add to at every run is searched, not read on its first page only (give its route set `search_fields`) |
  | `select: {where}` | `select({where, created})`: the checkbox `select:<id>` of the row that `openItem` would open, checked; those selected before stay selected |
  | `bulk: <id>` | `bulk(id)`: `bulk:<id>` of the screen, then `action:confirm-bulk` of its confirmation; waits until it is no longer offered (the selection is cleared) or an error is shown (`error:bulk`) |
  | `move: {where, to}` | `move({where, to, created})`: the item that `openItem` would open, its menu `action:move`, then `move:<to>` (confirmed in its dialog when the workflow confirms the transit); waits until it is in `column:<to>`, fails as soon as the move is refused (`error:move`) with its error |
  | `action: <id>` | `action(id)`: `action:<id>` of the current screen; a destroy is confirmed in its dialog once the lock has `screens`, `confirm(id)` (`action:confirm-<id>`, waits until the dialog is closed; a generated screen must show it, and on a custom screen `confirm(id, { optional: true })` goes on when no dialog is shown within 2 s: a hand-written screen should delete with `useDestroyCardAction`, its dialog), and so is a custom action with `confirm: true`; one with `fields` opens its dialog, which `fill` and `submit` take as a form; then `expectScreen` of the `then` of a destroy |
  | `fill`, `upload` | `fill(values)` (a select by the label of its option, the native one or that of Radix, a combobox whose popup is its listbox, null by its option `data-value=""`; the picker of a relationship by the label of the item, searched in its popup, the picker of a to-many relationship by the list of the labels of its items, which replace those it had (its popup, `aria-multiselectable`, cleared with the option `data-value=""`, then each item chosen, closed with Escape; `[]`: none), a checkbox (also the checkbox and the switch of Radix, `role="checkbox"`, `role="switch"`) by true or false, a date-time as `YYYY-MM-DDTHH:mm` in the time zone of the browser, UTC: `FieldInput` sends `2030-03-04T10:00` as `2030-03-04T10:00:00.000Z`; `today`, `today+3` or `today-1 10:30` is a day of the run in UTC, as `expectDay`), `upload(field, file)` (a file of `e2e/fixtures/` of the frontend into the input `field:<field>`; waits until `upload:<field>` is no longer busy, its `aria-busy` absent or `"false"`, and shows the name of the file, or an error is shown) in the open form, the `<form>` with `action:submit`; on a card with `edit: true` whose edit is not open, `action('edit')` first |
  | `submit: {}` | `submit({saved: true})`: waits until the form is closed, and fails the test with the errors that the form shows when it stays open (the save failed); the items that it creates are those of the test (the answers 201 in JSON of the POSTs meanwhile, a create of the core, their item in `data.id`), which `created` finds; `submit()`, which only waits for the form to close or to show an error of this submit, when the next step expects a refusal (an `error`, or a `state` of a failure: `invalid`, `error`, `forbidden`, `not_found`); a submit that saves is followed by `expectScreen` of the `then` of the form, a refused one by none (the form stays open on its screen) |
  | `transit` | `transit(id, payload?)`: `transit:<id>`, the payload in its dialog, or its confirmation (`action:confirm-<id>`) when the workflow confirms it; waits until it is no longer offered or an error is shown |
  | `expect` | `expectScreen` (the mark of the screen and its route, since a list may show next to its card), `expectStatus`, `expectState` (a visible one), `expectActionAbsent`, `expectFieldReadonly`, `expectFieldAbsent`, `expectValues` (the text of `field:<name>` of the screen contains the value), `expectRows`, `expectTile(id, count)` (`data-value` of `tile:<id>`, once for each tile), `expectDay(day, count)` (`data-count` of `day:<date>`, `today±<n>` the date of the day of the run in UTC, the calendar moved to its period first, once for each day), `expectError` (a visible one), `expectNotification` (the bell opens the list of the notifications, which waits for one with the text that came since the test started, by its time `<time datetime>`: one of a previous run does not count), in this order |

  The screen after a step is the one that `check` follows (the `then` of a form or a
  destroy, the `list.open` of `open_item`): `check` and the generator read the steps with
  the same code (`spec/scenarios.py`). `expectFieldReadonly` passes when the open form has
  the field read-only or disabled (or not at all), and on a card when it has no edit or its
  edit has the field read-only (it opens the edit and cancels it). On a card in tabs,
  `action`, `fill`, `expectValues` and `expectFieldReadonly` first show the tab of the mark
  they act on (the tab whose `aria-controls` is the hidden panel that has it).

#### A form of your own

**A form of your own** is driven by the steps through the marks that `ResourceForm`
renders: the helpers take as the open form the `<form>` that has the submit button
`action:submit` (`app.form()`), its controls by `field:<name>` (an input, a select, a
checkbox, a picker or a select of Radix: `role="combobox"` with its popup in
`aria-controls`), the errors of a
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
  (`open_item`) and need, and an item at least for each list, board, calendar and part of a
  dashboard that a role sees, so that the screenshots show them (V016);
- **its dates are relative to the day of the run** (`timezone.now() + timedelta(days=3)`,
  its date in UTC, the day that `expectDay` counts, never `timezone.localdate()`; some of
  them in the current month and the next days), never fixed (`2030-03-04`): a
  calendar opens on the month of today, the last items and the deadlines of a dashboard are
  those of the next days, and a fixed date leaves them empty once it is past or far. A
  scenario expects the day of such an item as `today+3` (`expect: {day: {today+3: 1}}`);
- it never creates a role, a permission, a status or a transit: a role of a `test_user`
  that the migrations did not create is an error of the command;
- **it only adds, and runs before every run of the tests**: it never deletes a user or a
  record, neither those of the previous runs and of the scenarios nor its own (no option
  of its own such as `--clean`, also at the end of a task): they stay for the user to log in
  and look at, and a database shared with others is never emptied. Run again, it finds its
  records by a key of their own (`update_or_create` by the title) and creates those that
  are missing, sets their dates relative to the day of the run again, and sets the password
  of the test users again, so that the tests log in with the current `E2E_PASSWORD`; it runs
  in one transaction. The sample creates its task once and moves its date
  (`sample/tasks/e2e.py`).
- **the scenarios run again on the same database**, which keeps the items of the previous
  runs, and pass every time:
  - a scenario that changes an item (a transit, a move, an edit, a custom or a bulk action,
    a deletion, a related item added to it) creates that item itself: the records of
    `e2e_data` are only read, so that the other scenarios and the next runs find them as
    they are (P033 reports a change of an item that the scenario did not create);
  - a scenario finds the items it created by their ids: when the values that it filled in a
    create form (then in its edits) have the texts of a `where`, the test takes only an item
    that it created (`created: true` of `openItem`, `select`, `move`; the ids of the creates
    of its submits), never an item of a previous run with the same texts (a task already
    moved). An item of `e2e_data` is found by texts that no scenario gives the items it
    creates (P034 reports them);
  - a count (`rows`, `tile`, `day`) is of the records of `e2e_data` alone: a filter or a
    title that no scenario gives its items (the tile `review` of the sample counts the task
    of `e2e_data` by its title), never the items that the scenarios add at every run;
  - a notification is one that came since its test started (`expectNotification`, by its
    time): those of the previous runs stay in the list.

The scenarios share the database and run one at a time (`playwright.config.ts`); none
should depend on another: a scenario opens an item that `e2e_data` creates, or one it
creates itself.

### Running the tests

- `npm run e2e` starts its own dev server of the frontend on `E2E_PORT` (5173 by default;
  its `/api` goes to `BAZIS_API_URL`, `http://localhost:8000` by default, as for `npm run
  dev`) and runs the tests once the backend answers its health check through it, unless
  `E2E_BASE_URL` names a running frontend; the backend runs separately. It never reuses a
  server already on the port: the run fails instead of testing another frontend (choose
  another `E2E_PORT`, or `E2E_BASE_URL`). Its dev server optimizes the dependencies again as
  it starts (`--force`): a dependency imported since the last start (the charts of a new
  dashboard) would be optimized once a page imports it, and the server would reload the
  pages of the tests (a login that fails, a blank screenshot); a running frontend of
  `E2E_BASE_URL` may do so. It keeps them in a cache of its own,
  `frontend/node_modules/.vite-e2e` (`BAZIS_VITE_CACHE_DIR`, the `cacheDir` of
  `vite.config.ts`), never in that of `npm run dev` (`node_modules/.vite`): a dev server of
  the developer running beside the tests keeps its modules, and its optimizations never
  reload the pages of the tests. The browser is in UTC and in the default language
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
  await app.openItem({ where: { title: 'Review the plan' } }); // the task of `e2e_data`
  await app.expectScreen('task-card');
  await app.expectStatus('draft');
});
```

A test of your own runs again on the same database too: it reads the records of `e2e_data`,
and finds an item that it created with `created: true` (`openItem`, `select`, `move`), never
one of a previous run with the same texts.

For what they do not cover, `app.page`, `app.screen()` (the current screen), `app.form()`
(the open form) and `bz(kind, id)` of `../bazis` (the selector of a mark): a transit that a
validator restricts is disabled, with the errors of the validators next to it,
`await expect(app.screen().locator(bz('transit', 'reopen'))).toBeDisabled()`.

## The visual check

The scenarios check what the screens do; the screenshots check how they look. `shots` takes
a screenshot of every screen of the specs and checks what each one renders, so that an agent
fixes what it would not see in the code: a page wider than a phone, a raw name, a text without
contrast, a value of an item longer than the data of the tests.

```bash
python manage.py bazis_front shots           # e2e/generated/shots.ts, the screenshots and .scratch/shots/report.json
python manage.py bazis_front shots --no-run  # shots.ts only
python manage.py bazis_front shots --check   # shots.ts is that of the specs (CI: no Node, no database)
```

### What it shoots

- Every screen as the first of its `roles` (the first role of the product that logs in for a
  screen without: it is not public), in each color mode of the theme (`mode`, and the tokens of the dark mode), at the
  width of a desktop (1280×800) and of a phone (390×844): the projects `desktop` and `phone`
  of `frontend/playwright.shots.config.ts`. The screen of an item is reached through the
  first item of a screen that opens it (`open` of a list, of a board or a calendar, of the
  last items of a dashboard: the first item of that part, `recent:<id>`), one of a role of
  the screen of the item, which is shot as the first of its roles that one is for: a list
  first, all the items before a report (a list with a `filter` of its own); a screen that
  none opens is not shot, listed at the top of `shots.ts` (`// Not shot: …`).
- Every screen also as each other of its roles, in the first color mode only (the role that
  the screens opening an item are not for is not shot on it): `<screen> as <role>` in
  `shots.ts`, `role` in the report and in the names of the files. What the screen shows to
  each role (its actions, its moves, its empty parts) is checked once; the other color modes
  are those of the first role.
- A list is also shot searched for a text that no item has (its empty state, when it has
  `search`; the empty state of a search offers no creation, so V008 checks its text only)
  and with its first create form open, as the first of its roles that the `access` of the
  entity of the form lets create (`add`; any role of an entity without an `access`; none:
  `// Not shot: <screen>.form`): the variants `empty` and `form` of the screen,
  `<screen>.<variant>` in `shots.ts`, in the names of the files and `variant` in the report.
  A calendar with `add` is shot with its add form open too (the variant `form`, as the
  first of its roles that may create). The dialogs of the custom actions are not shot: an
  item may not allow its action.
- Once the test user is logged in, the shot also listens to the page: an error that nothing
  caught (V011), an error written to the console (V012) and a request to the API (`/api/`)
  that failed or was answered with an error status (V013); a 403 or a 404 of a `GET`, which
  a screen shows as its state, and a request that the page cancelled are not reported, nor
  the requests of the login. The fields of the filters (`route_filter_fields/`) are never a
  state: their 404 is reported (a route set whose `actions` leave out
  `get_route_filter_fields`, which `check` reports as S040), and a 500 of the proxy of the dev
  server that did not reach the backend (a `text/plain` without a body) says so: not an error
  of the backend.
- A screen is shot once again, the user still logged in, when the proxy of the dev server did
  not reach the backend (from the login on) or when the page loaded again between its check
  and its screenshot (the dev server of Vite reloads the pages once it has optimized a
  dependency that it found late: the screenshot would be a blank page); `retried` of the
  report, the result is that of the second time, and the summary of the command counts the
  screens shot again. The second time the proxy is reported as V013, the page that loaded
  again as V019.
- It runs as `npm run e2e` does (the same `playwright.config.ts`, which the config of the
  shots extends): the backend running, migrated and with the data of `manage.py e2e_data`,
  `E2E_PASSWORD` set, a dev server of its own on `E2E_PORT` (a free port without it, not
  5173, which a dev server of the developer may have) or a running frontend at
  `E2E_BASE_URL`, and Chromium (`npx playwright install chromium` in `frontend/`). A screen
  with no item (an empty list before its card) cannot be shot: the data of `e2e_data` has
  one.
- It writes `frontend/.scratch/shots/<screen>[.<variant>]-<role>-<mode>-<width>.png` and `report.json`,
  after it emptied the directory. `.scratch/` is in the `.gitignore` of the frontend: never
  commit it.
- It exits with 0 when the report has no error, 1 when it has errors, 2 when no screen could
  be shot (no Node, no browser, no backend or frontend, no `E2E_PASSWORD`, a port of
  `E2E_PORT` already used: the output of Playwright says which).
- `shots.ts` is generated like the end-to-end tests: never edited, the hashes of the specs
  and of the file in the lock (`shots`), `--check`; the system check `front.W008` reports a
  stale `shots.ts`, `front.W009` a report with errors or no report that can be read (the
  screenshots not taken yet; a warning, CI has none). It is not a `.spec.ts`: `npm run e2e`
  does not run it.

### The report

```json
{"errors": 1, "warnings": 1,
 "shots": [{"screen": "task-list", "role": "manager", "mode": "dark", "width": 390, "variant": null,
            "retried": false, "file": "task-list-manager-dark-390.png",
            "issues": [{"code": "V002", "severity": "error", "selector": "[data-bz=\"list:task\"]",
                        "message": "The page is 812 px wide at 390 px."},
                       {"code": "V009", "severity": "warning", "selector": "[data-bz=\"action:edit\"] button",
                        "message": "3 controls are smaller than 44×44 px: [data-bz=\"action:edit\"] button 24×24, …"}]},
           {"screen": "task-list", "role": "manager", "mode": "dark", "width": 390, "variant": "form",
            "retried": false, "file": "task-list.form-manager-dark-390.png",
            "issues": [{"code": "V013", "severity": "error", "selector": "GET /api/v1/tasks/task/schema_create/",
                        "message": "500 Internal Server Error"}]}]}
```

`selector` is the nearest `data-bz` mark of the element (with its tag when the element is
inside it): the component or the cell to fix; for V011 and V012 `page` and `console`, for
V013 the method and the path of the request. A code reports at most ten elements of a
screenshot, the last with the number of the others; V009 is one issue for the screenshot,
with the number of the small controls and the first five of them.

### The codes of the report

| Code | Severity | Meaning, and what to do |
|---|---|---|
| `V001` | error | the screen was not shot: the login, the route, the item to open or the run failed (the message says which); run the backend with the data of `e2e_data`, give the role its `test_user`, render the marks of the screen and of its states `state:<state>` (a custom screen too) |
| `V002` | error | the page scrolls sideways at the width of a phone: a list shown as a table, a fixed width, a long word; show the cards of the list on a phone (the components do), let the texts wrap |
| `V003` | warning | a part of the page scrolls sideways at the width of a phone: a table where cards would fit (a board, `board:<entity>`, scrolls its columns: it is not reported) |
| `V004` | error | a label shows a raw name: a column, a term of a card, a label of a field or a filter, a heading that is a snake_case name, an id or a key of the translations; give the field its title in the backend (S018) or the text its key in `src/i18n/` |
| `V005` | error | the screen shows a UUID, the id of an item instead of its label: show a related item by its label (`RelationLabel`, the `label` of the entity) |
| `V006` | error | a text has a contrast below 4.5:1 (3:1 for a large text) on its background, as rendered: a literal color, or a text color of the tokens on a background it was not made for; use the pairs of the tokens (`text-foreground` on `bg-background`, `text-<tone>-ink` on `bg-<tone>-soft`) |
| `V007` | warning | a light surface in the dark mode: a literal color that ignores the tokens of the theme; use the classes of the tokens |
| `V008` | warning | an empty state without a text, or without the action that creates an item when the user may create one: put the create action in the empty state |
| `V009` | warning | controls smaller than 44×44 px at the width of a phone, one issue for the screenshot with their number: give them the size of the components (an icon button of shadcn/ui is `size="icon"`; on a touch screen the components are 44 px at least); the `<label>` around a control and its stretched `::after` count in its size |
| `V010` | warning | a text cut by an ellipsis without its whole text in a title or a tooltip: give it `title`, or let it wrap |
| `V011` | error | an error of the page that nothing caught (`pageerror`): fix the code of the screen that throws it (the message says which) |
| `V012` | warning | an error written to the console (`console.error`: a warning of React, a failure that the page handles): fix what React warns of (a key, a nested form), and handle the failure without writing it |
| `V013` | error | a request of the page to the API failed or was answered with an error status, but a 403 or a 404 of a `GET` that a screen shows as its state: a 500 of the backend (its log), a 400 of a filter or a sort the route set does not have, a 404 of `route_filter_fields/` or a 405 of an action it does not route (its `actions`, S040); a 500 of the proxy of the dev server that did not reach the backend says so (the screen was shot again: the proxy failed twice); restart the dev server or the backend (the output of the dev server says why) and take the screenshots again |
| `V014` | error | the page scrolls sideways at the width of a desktop: a fixed width, a grid whose implicit column grows to a long word; give the grid its column (`grid-cols-[minmax(0,1fr)]`), let the texts wrap |
| `V015` | error | the page scrolls sideways once the texts of its items are long: before the screenshot, for the check only, the texts of the items in their cells and fields (`data-text` of `FieldValue` in `cell:<name>`, `field:<name>`, not in a form: a string without a choice or a format, the label of a related item; not a date, a number or the label of a choice, short by their nature, nor a cell of the product) are made 120 characters long with a word of 40, then given back; the data of `e2e_data` are short, the data of the users are not. Bound the column of the grid that holds them and let them wrap (`wrap-anywhere`) or cut them with their text in a title (`truncate`) |
| `V016` | warning | a list, a board, a calendar (neither a row nor a day with items) or the last items of a dashboard show no item (but the list searched for nothing): the screenshot does not show them, nor what a long value does there; give `e2e_data` items for them, their dates relative to the day of the run (a calendar opens on the month of today) |
| `V017` | warning | a text cut by an ellipsis to a few characters, its box narrower than 4 em: the item of a narrow day of a calendar, a narrow column; give it the width of a line of its own or let it wrap |
| `V018` | warning | a part of the page that scrolls sideways (a table) grows wider than it is once the texts of its items are long (the texts of V015): a column whose texts do not wrap; let them wrap (`whitespace-normal wrap-anywhere` with a `min-w-*` and the same `max-w-*`, so that a long text does not narrow the columns of short words either) |
| `V019` | error | the page loaded again between its check and its screenshot, also when the screen was shot again: the screenshot (a blank page, a page that loads) is not of the screen checked; the dev server reloads the pages (a dependency optimized late by a running frontend of `E2E_BASE_URL`, a file of the frontend changed during the run): take the screenshots again |
| `V020` | error | the screen was not shot: the router sent the user to the login, the route of the screen needs a session that the role does not have. An anonymous role shoots only public screens; a frontend whose `src/app/router.tsx` is its own (from before 0.4.0) routes no public screen: take the router of the template |

### The checklist of the screenshots

Open the screenshots (the PNG files) and look at what no check measures:

- one `h1` per screen, the subtitles and the secondary texts muted;
- the first column of a list is the label of its items, the numbers aligned right, a status
  a badge in its tone, the dates and numbers in the format of the language;
- an empty state says what is missing and offers to create it;
- on a phone: the list as cards, the actions within reach, no text cut or overlapping;
- in the dark mode: no light surface, the same hierarchy as in the light one;
- the icon of every entity, the tones of the statuses by their meaning, no raw name or id.

### When the screens are done

A screen is done when `shots` reports no error for it, its screenshots pass the checklist
and its scenarios pass (`npm run e2e`). Fix in the specs, the screens, the design or the
backend (the labels of the fields are titles of the backend, S018), never in `shots.ts` or
the report, and take the screenshots again: at most three rounds; after the third, report
what is left with the codes and the screenshots. The errors left, or
screenshots never taken, are the warning `front.W009` of `status`, not a stale part of the
frontend.

## The client

```ts
import { createClient, Filter } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

export const api = createClient<paths>({ baseUrl, token: () => session.token });
```

In a frontend made by `init`, the client is created in `src/app/providers.tsx`, given to
the hooks by `BazisProvider` and read with `useApi()` of `@/bazis/react`; the token is
kept by `src/app/session.ts`. Read and change data with the hooks (below); call the client
for what they do not cover (the login, a custom endpoint). Its signatures are in "API: the
client".

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
  `FieldInput`). The messages are in the language of the interface: `errorMessage` of
  `@/bazis/i18n` translates the validation errors of Pydantic by their type (`Field
  required` as `validation.required` of the dictionaries) and leaves the messages of the
  validators of the product as the backend says them; `BazisProvider` of
  `src/app/providers.tsx` gives it to the hooks (`form.errors`, `errors` of `useAction`), and
  `useErrorMessage()` to the code of the product (`error.formErrors(message)`). Any other
  error, and the state it puts a screen in, is shown with
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

- Upload a file with `api.upload` (or `useUpload`): a multipart `POST` to the route set of
  the uploaded files, with XMLHttpRequest for its progress.
- Call a custom action of a route set with `api.action` (`<path><name>/`, POST by default;
  `api.itemAction` for `<path><id>/<name>/`), or `useAction`: the JSON body, the query
  parameters (`?code=A1`: a list repeats the parameter, null and undefined are left out) and
  the response of its OpenAPI; the errors of the body by field are `ApiError.bodyErrors()`
  (`/<field>`), not `fieldErrors()` (the pointers of a JSON:API document).
- Run a request in the background with `api.background` (or `useAsyncRequest`,
  bazis-async-request): it is queued with the id of its task, or done with its response
  when the backend ran it at once; read the task with `api.backgroundResult` (or
  `useAsyncTask`).

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
form.setValue('title', 'Report');                   // a to-one relation takes the id or null
const saved = await form.submit();                  // null when it failed: form.errors.title
// an item added from the card of its parent: the relationship fixed, never chosen
const step = useResourceForm(ROUTES['tasks.step'], { fixed: { task: id } });
const transits = useTransits(TASKS, id);                             // those the user may run now
const upload = useUpload(ROUTES['uploadable.file_upload']);           // upload(file) -> the item
useChannel((message) => { … });                                       // the messages of the socket, parsed
const task = useBgTask(ROUTES['bg.task'], taskId);                    // a task of bazis-bg, until it is done
const request = useAsyncRequest();                                    // a request with X-Async-Background
const result = useAsyncTask(CAPABILITIES.async_background.result_path, taskId);
```

### Reading and changing the data

- `useList`, `useItem`, `useSchema`, `useFilterFields` read; `useCreate`, `useUpdate`,
  `useDestroy`, `useRelationship` change and then refetch every query of the resource
  (`['bazis', path]`; `useDestroy` reads the deleted item no more: a screen still showing it
  shows it not found, unless `{leaving: true}` says that it is left, and its queries are
  removed once nothing shows them); `useRelationship` changes a to-many relationship through its
  relationship endpoint (`add`, `replace`, `remove`). `useSchema` gives the runtime schemas
  for the current user (of the list and the create; of the retrieve, the update and a
  transit of an item), kept for the session; `useFilterFields(path)` the fields a list can
  be filtered by, with their types: those of the user. `useCan(path, 'view' | 'add')` is
  whether the user may view the items
  of a route set or add one (undefined until the backend answers; false on its 403, or
  `for_create: false`), read from the runtime schema of the list and from `for_create` of a
  list of one item (the runtime schema of the create without that meta); `useCan(path, 'action_<name>')`
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
  retrieve or a list), with the labels of the choices by value (`enumDict`:
  `choiceLabel(field, value)`); `objectFields(schema)` those of the JSON Schema of an
  object, such as the payload of a transit; the components render them.

### The forms

- `useResourceForm(path, {id?, fixed?})` takes its fields from `schema_create`/`schema_update`
  (those of the current user: type, required, read-only, nullable, choices, the
  related resource of a relationship), its values from the defaults or the item, and
  submits the changed attributes and relationships as one document (a to-many one with all
  its items, its value the list of their ids); a 422 gives `errors` by field, and `submit`
  resolves to the saved document, null when it failed. `fixed` values (the
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
  run now (allowed unless a validator restricts them, with the JSON Schema of the payload
  they require), their names in `TRANSITS` of `contract.ts`. `useTransit(path, id)` runs
  one: it resolves to the item, or to null when the user can no longer view it (leave its
  screen).

### The uploads and the downloads (bazis-uploadable, bazis-bg)

- `useUpload(path)` uploads one file at a time to a route set of the uploaded files
  (`ROUTES['uploadable.file_upload']`): `upload(file)` resolves to the created item (null
  when aborted; its id may be a number: `String(item.data.id)` is the value of the
  relationship), with its progress and its error (413 `ERR_FILE_TOO_LARGE`…); it refetches
  the queries of the route set.
- `useDownload(path)` saves the file of an item from `<path><id>/download/`
  (bazis-uploadable, bazis-bg) with the token, `useDownloadUrl(path, id)` gives its content
  as an object URL (a thumbnail), read once (a file of an item does not change);
  `client.download` and `saveFile` are below them.

### The socket and the notifications (bazis-ws, bazis-notify)

- `SocketProvider({path, token})` opens the socket of bazis-ws at `CAPABILITIES.ws.path`
  with the token of the session, sent in its first message (one a page, none without a
  token; it reconnects with a backoff and a logout closes it; see
  [The socket](#the-socket)); `useSocket()` is its state (with the error of a refused token
  and a retry); `useChannel(handler)` gets every message of the channels of the session,
  parsed; `useLiveQueries(ROUTES)` refetches what the messages say changed (also the
  notifications of bazis-notify on its messages, given their resource,
  `CAPABILITIES.notify.resource`, and a task of bazis-async-background), and every query
  after a reconnect (`LiveQuery` mounts it); `useNotifications()` is the notifications of
  the session, the newest first (without bazis-notify).
- `useInbox(path)` (bazis-notify, `ROUTES['notify.notification']`) is the stored
  notifications of the user, the newest first (`route` of each: where its action leads),
  read and marked read through the route set (its unread count is `unread_count/`);
  `deleteAll` (`clear/`) deletes them for good: give it to `onDeleteAll` of
  `NotificationCenter` only if the product offers it. It is listed again after its own
  changes and, with bazis-ws, on the messages of bazis-notify (`useLiveQueries`); its option
  `poll` (ms) without bazis-ws. Both are the source of `NotificationCenter`.

### The custom actions

- `useAction(path, name)` calls a custom action of a route set (`useItemAction`: of an
  item), typed by its OpenAPI, then refetches the queries of the resource (not with
  `invalidate: false`); its `errors` are those of its body by field
  (`ApiError.bodyErrors()`).
- `useActionQuery(path, name)` and `useItemActionQuery(path, id, name)` read a custom
  action declared with GET as a query (a summary, a check, the content of a screen; no
  request while `id` or `query` is null), keyed under its resource and by its query
  parameters (`query`, typed by its OpenAPI and required with a required parameter: other
  parameters are another query): a mutation or an action of the resource refetches it.

### The tasks and the background requests (bazis-bg, bazis-async-background)

- `useBgTask(path, id)` reads a task of bazis-bg (`ROUTES['bg.task']`, the user's own; the
  query of `useItem`) every 2 s until it is done: its state, the phase that runs, its
  progress by counter and its outcome (`bgTask(document)`).
- `useAsyncRequest()` sends a request with `X-Async-Background`: queued (202) with the id
  of its task, or done with its response when the backend ran it at once (without Kafka);
  nothing is refetched until the task is done. `useAsyncTask(resultPath, taskId)` reads
  the task at `CAPABILITIES.async_background.result_path` every 2 s until it is
  `completed` or `failed` (a status on the socket refetches it at once with
  `useLiveQueries`); `replayedResponse(response)` reads the HTTP status and body of a
  replayed request (an HTTP error there is still `completed`).

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
follows it, and so does its title, the name of the product (`product.name`).

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
  response}`, the status `pending`, `processing`, `completed` or `failed`;
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
  them (a component of a package needs its capability in the contract), each reported as
  `<asset>: copied (<version>), required by a new version.`: also the components that a new
  template requires (its home is a `Dashboard`: `dashboard`); `update <asset>` also updates
  the assets it requires.
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
`npm install` (`update` says so).

- The theme is generated, not copied: run `bazis_front design` after `update` (`front.W005`
  reports a theme that the new version renders otherwise).

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

`tsc` shows what a new version changes in the API of the copies (a name removed from them
is an error there); the changes so far:

- `NotificationCenter` requires its notifications: `notifications={useInbox(ROUTES['notify.notification'])}`
  with bazis-notify (its `onOpen` gets an `InboxNotification`: open `route`), else
  `notifications={useNotifications()}`. The list is no longer read when it opens: a click
  marks a notification read, `action:read-notifications` all of them. The backend notifies
  with bazis-notify only (no second message of bazis-ws).
- `Notification.received` of `@/bazis/react/ws` is removed: read `time`.
- `FileView` shows the name of a file as a button that downloads it with the token
  (`onDownload`, `useDownload`), not a link: `UploadedFile.url` (the media URL) is removed,
  never link a file; the file of a task of bazis-bg is `action:download` of
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
  product to them again, then `npm run format` (the router of a product of 0.1.0 is replaced
  as a whole in the migration to 0.3.0 below, step 2).

A product of 0.1.0 goes to 0.3.0 in one run (0.2.0 was never published, its changes are in 0.3.0),
with the steps of both versions in this order:

```bash
pip install -U bazis-front
python manage.py bazis_front update      # exit 1 with conflicts is expected; resolve those it lists (steps 2, 3)
(cd frontend && npm install)             # before the contract; `tsc` stays red until `screens` (step 8)
python manage.py bazis_front contract    # contract.json of format 6, schema.d.ts
python manage.py bazis_front design      # theme.css and the new fonts.css
# steps 5 and 6: `custom` in the specs of the screens written by hand, `navigation` in product.yaml
python manage.py bazis_front check
python manage.py bazis_front screens     # also copies the components that they import
(cd frontend && npm install)             # their npm dependencies, which `screens` adds
python manage.py bazis_front e2e
python manage.py bazis_front shots --no-run
cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build
```

1. `update` copies the components that the template of the new version needs and the
   frontend lacks (the shadcn/ui ones on Radix, such as `select`, `tabs`, `checkbox`,
   `dropdown-menu`, and `empty-state`), merges the template and the copies, and lists the
   files that conflict. It does not copy `dashboard`, `stat-card`, the charts or the drag and
   drop: `screens` adds them with the first screen that uses them (step 8). It then ends
   with exit 1: the files are updated, and a second `update` does not merge again. Run
   `npm install` at once (the `@fontsource` packages, the new libraries), before `contract`,
   which generates `schema.d.ts` with the frontend. `npx tsc --noEmit` and `npm test` fail
   with `TS2307` (`@/screens/generated/*`) until `screens` (step 8): `update` says so, and
   asks for them only once they can pass.
2. A `src/app/router.tsx` that the product changed conflicts: replace the whole file by that
   of the template, `frontend/.bazis/base/template@<version>/src/app/router.tsx`. Taking the
   side of bazis-front in each conflict is not enough: the lines of the product merged
   without a conflict, such as its imports, stay. Then apply the other changes of the
   product to it again: its own providers, the routes that are not screens of the specs,
   the tiles of its maps (a `MapProvider tiles` around `GeneratedProviders`). Move its links
   to `navigation` (step 6).
3. `src/i18n/en.ts` and `src/i18n/ru.ts` that the product changed conflict too, the template
   having removed the texts of its home: keep the side of the frontend while its screens use
   them, and remove the keys that no screen reads once they are generated (the texts of a
   generated screen are those of its spec, in `GENERATED_MESSAGES`). `src/app/product.ts`
   and the home `src/screens/home/index.tsx` are no longer in the template: `update` keeps
   them and says what replaces them. The name of the product is `product.name` of
   `product.yaml` (it replaces `PRODUCT_NAME`). If the product put `MAP_TILES` in
   `product.ts` (the guide of 0.1.0 suggested it), move it to `router.tsx` (or another file)
   before you delete `product.ts`: the `MapProvider` of the router imports it; delete the
   file when `grep -r app/product src` finds nothing (the generated screens read the name
   from `product.name`). The home was the overview of the resources of the template: delete
   it (`/` then leads to the first link of the navigation, and `check` warns of the missing
   dashboard, S026), or replace it by a dashboard of the specs, `spec/screens/home.yaml` with
   `primitive: dashboard` and its `dashboard.tiles`, not `custom`. A home kept by hand
   (`custom: true`) must render the states of a dashboard (`state:loading`, `state:error`,
   with `StatePanel`): `check` reports S009 for a spec without them in `states`, and `shots`
   V001 for a screen that renders none.
4. `design` after `update`: `src/index.css` imports `src/bazis/generated/fonts.css`, which
   only `design` writes, and the theme of 0.1.0 lacks `list_phone`. `theme.yaml` may name
   the layers of its tokens (see [The design](#the-design)); a design that names none keeps
   its look. The `tokens.json` of 0.1.0 defines every color, font and radius, which hide the
   layers named over it (D012): remove the colors and the fonts from `tokens.json` (and the
   radius, with a `shape`), keeping there only what the product changes, such as its brand.
   `contract.json` is of format 6 (the titles of the fields, the labels of the resources,
   `create`, `custom_actions`): `check` reports `C002` until it is exported again, then the
   fields without a title (S018), the entities shown by their id (S019) and the entities
   without an icon in `icons` of `theme.yaml` (D011). Declare `display` (`currency`, `unit`,
   `bar`, `phone`, `plain`) of the fields that are money, measures, shares or phones, and
   `label` of an entity whose resource labels nothing (product.yaml).
5. Give every screen written by hand `custom` in its spec (`true` for
   `src/screens/<id>/index.tsx` exporting `<Id>Screen`, `{module, export}` otherwise, the
   usual form for 0.1.0, whose screens are by entity: `custom: {module: '@/screens/book',
   export: BookListScreen}`, the module quoted as YAML reserves `@`), before `check` and
   `screens`: every screen of 0.1.0 is one. A custom screen keeps the states of its primitive
   (S009, V001): it renders `state:<state>` as `ResourceList` and `ResourceCard` do, and a
   screen of bare JSX fails `shots`. `screens` refuses a screen that has
   `src/screens/<id>/index.tsx` and no `custom` (S029) and writes nothing, also on the
   first run; `check` tells it too once the router of the updated template imports the
   generated screens. Then `e2e` and `shots` behave as before. Later, screen by screen, remove
   `custom` and the file, move its texts to the spec and run `screens` and `shots` again;
   what the specs do not say goes to `extend`.
6. Move the links of the router to `navigation` of `product.yaml` with their `icon` and
   `requires`. The `label` of a link is the title of the screen by default, a text in one
   language: a link whose old label was a key of the dictionaries of the product
   (`t('nav.tasks')`) keeps it as `label: nav.tasks` (the dictionaries `src/i18n/*.ts`
   stay), or becomes `{en: …, ru: …}`; so does the `title` of a screen (S027 warns of the
   texts that miss a language of the product), and `product.name` and the `title` of an
   entity: `name: {ru: Библиотека, en: Library}`, `title: {ru: Автор, en: Author}` (or a key
   of `src/i18n/*.ts`, `entities.author.title`). S027 is a warning: until the texts are
   given, the product shows the one it has in every language.
7. `check` has no errors (S029 is told for `src/screens/<id>/index.tsx` without `custom`; `check` does not see the modules by entity, `src/screens/book/index.tsx` with `BookListScreen`: `custom` is set for them by step 5). The template renders the screens of the specs
   (`src/screens/generated/`) and has no home of its own: `/` is the screen of the specs at
   `/`, else the first link of the navigation. Once the product declares its entities,
   `check` asks for a screen of the specs at `/` that is a `dashboard` with tiles (S026).
8. `screens` renders `src/screens/generated/` (`front.W010` until then) and copies the
   components that the generated screens import and the frontend lacks (`calendar` and
   `date-picker` for the dates of the forms, `charts`, `stat-card` and `dashboard` for the
   first dashboard, `board-dnd` for a board), setting their npm dependencies
   (`react-day-picker`, `recharts`, …): run `npm install` after each `screens` that says so,
   else `tsc` fails (`TS2307`). From here `npx tsc --noEmit` is green again.
9. `e2e`, `shots --no-run`, then `tsc`, lint, tests and the build: `tsc` finds the code of
   the product that uses what changed (below). The end-to-end tests (Playwright) and `shots`
   need the backend of the product: migrated, with `manage.py e2e_data` and `E2E_PASSWORD`,
   served by the ASGI application of the project (for example `uvicorn app.main:app`), not
   `runserver`: only the application answers `/api/healthcheck`, which the tests wait for.

The API of the copies that 0.2.0 changed (never published):

- `lazyScreen` shows the loading state of the screens in its own `Suspense`, and the router
  of the template has none: a `src/app/router.tsx` that the product changed may conflict on
  its imports once. Take the lines of the template and remove the imports of `Suspense` and
  `StatePanel` that nothing uses any more (`npm run lint` reports them); a `Suspense` of the
  product around its own routes may stay.
- The filters of a list are the select of Radix, a boolean filter its chips: a test of the
  product that chose a filter with `selectOption` chooses it with `fill` of the helpers, as
  the generated tests do. The panels of the tabs of a card (`card.tabs`) stay in the DOM,
  hidden: a test opens the tab before it fills or reads a control of it.

The API of the copies that 0.3.0 changed:

- `payloadErrors` of `@/bazis/ui/transit-bar` takes `message`, a function of an error to
  its text (`useErrorMessage()` of `@/bazis/react`), in place of `t`.
- `BoardDrag` of `@/bazis/ui/resource-board` (a drag and drop of the product in place of
  `board-dnd`): its `Column` takes `label` (the name of its status) and its `Card` takes
  `label` (the name of its item, null without one), told to the screen readers.
- `useCan(path, 'add')` (the create actions, the links with `can: 'add'`) reads
  `GET <path>?page[limit]=1&meta=for_create` instead of `<path>schema_create/` (which it
  still reads without that meta): a mock of the backend in a test of the product answers
  that list.
- `useDestroy(path)` shows a deleted item still shown as not found (an error 404 without a
  request) instead of reading it again; `useDestroy(path, {leaving: true})` keeps its data
  while its screen is left.
- The helpers of the end-to-end tests: `App.confirm(id)` confirms the dialog of an action
  (`action:confirm-<id>`), which a deletion of a card shows: a test of the product that
  deletes by `action(id)` confirms it then; `expectDay` takes `today±N`.
- `formatNumber` and `formatDecimal` of `@/bazis/i18n` (and the numbers of the texts)
  group the digits by thousands from five digits only: `1234` (it was `1,234`), `12,345`;
  `{useGrouping: true}` groups them as before. A test of the product that reads a number
  of four digits reads it without the separator.
- The validation errors of the forms and of the actions (`errors` of `useResourceForm`,
  `ActionMutation`) are in the language of the interface (`useErrorMessage`), no longer
  the text of the backend: a test of the product that reads one reads the translated
  text.
- `ResourceCard` takes `after`, rendered under its sections and its tabs: the related
  lists and the history of a card without tabs go there (`children` stays under the
  heading, for the transits).
- The deletion of a card (`useDestroyCardAction` of `@/bazis/ui/screens`, new) asks
  `card.delete_title` (a question) and says `card.delete_confirm` (what the deletion
  does).
- `add.onAdd` of `ResourceCalendar` gets the values that the create form starts with,
  `{[field]: value}` and more, instead of the value of its field: the day of a date as
  before, of a date-time the moment of `add.time` (the start of the day by default) in the
  time zone of the browser (ISO) instead of the day, `end` `add.duration` minutes later, and
  the related item or the choice of a filter of the user (`filters`) by a field of
  `add.fields`; give them to the form as `initial` (the user may change them), not `fixed`:
  `onAdd: form.onOpenWith`.
- `onFilter` of `FilterBar` also gets the values of the filters of one value
  (`equalValues`); `listFilters` gives the filters of a list, a board or a calendar their
  choices.
- `permission` of a `ListAction` and of a `CardAction` also takes the name of a custom
  action (`action_<name>`), allowed by `custom_actions` of the meta.
- New: `@/bazis/ui/screens` (the actions and the extensions of the generated screens,
  `useCustomAction`), `customActionAt`, `useAnyAction` and `useAnyItemAction` of
  `@/bazis/ui/resource`, `useErrorMessage` and the type `DestroyPath` of `@/bazis/react`, `errorText` of the
  client, `useBesideList`, `NavEntry` and `NavGroup` of `@/bazis/ui/app-shell` (`items`
  of `AppShell` takes groups of links; `useNavItems` still gives the links), `initial` of
  `useResourceForm` and `ResourceForm`, `fieldTitle` of `@/bazis/ui/resource`.
- New errors of `check` and `screens` that a product of 0.1.0 may meet: two entities that the
  generated code would name alike (P032), the screens of an item without `:id` (S038), the
  links of the navigation (S030), the code of a custom screen (S028, S029), a field twice in
  a sort (S039), filters of a route set that does not route the fields of its filters (S040), the add of a
  calendar by a date-time field without it among its `fields` (S041, a warning), and its end
  shown empty in the form (S043, a warning: `duration`).

The API of the copies that 0.4.0 changes:

- `src/app/router.tsx` of the template routes the public screens (`PUBLIC_ROUTES`, see
  [The public screens](#the-public-screens)) in the layout of the screens, outside
  `RequireSession`: `update` merges a router that the product changed, with a conflict where
  it changed the same lines (the routes, the layout), and `check` refuses one that routes the
  generated screens without `PUBLIC_ROUTES` (S048). For a conflict, take the file of the
  template and apply the changes of the product to it again; a product that routed the
  screens of its anonymous users by hand lists the anonymous role in `roles` of their specs
  and removes its own routes and layout.
- `AppShell` takes `signIn`, the sign-in shown in the place of the session while it is null
  (`action:sign-in`), and a `NavItem` takes `public`; `LOGIN_ROUTE` of the helpers of the
  end-to-end tests is the route of the login.
- `contract.json` is of format 7 (`public` of the custom actions, which S046 reads): `check`
  reports `C002` until it is exported again.
- New errors of `check`: a scenario of an anonymous role on a screen that is not public
  (P035), a public screen that writes through the routes of the entities (S044), that leads
  to a screen that is not public (S045) or whose custom action is not `public=True` (S046),
  an anonymous role without a screen (S047, a warning) and a router without the public
  screens (S048); of `shots`, a screen that sent
  its role to the login (V020).

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
- `fieldErrors(message?: (error: ErrorObject) => string): Record<string, string[]>`: The messages of the errors of attributes and relationships of the item, by their name (`source.pointer` `/data/attributes/<name>`, `/data/relationships/<name>`), for forms.
- `bodyErrors(message?: (error: ErrorObject) => string): Record<string, string[]>`: The messages of the errors of the fields of a JSON body that is not a JSON:API document (the body of a custom action, `client.action`), by their name: `source.pointer` `/<name>` (an error of a nested value belongs to its field, `/<name>/0`); the others (of the body as a whole, of a parameter: `/query/…`, `/header/…`, `/cookie/…`, of the request) are not given.
- `formErrors(message?: (error: ErrorObject) => string): FormError[]`: The errors that `fieldErrors()` does not give, for the form as a whole: of the item (`/data`), of an included item (`/included/<index>`), of a parameter or of the request; all the errors of a relationships endpoint.

#### errorText

`errorText(error: ErrorObject): string`: The text of an error as the backend gives it: its `detail`, else its `title` or its `code`.

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
- `BACKGROUND_HEADER: "X-Async-Background"`: The header that asks bazis-async-request to run a request in the background: the value of `async_request.header` of the contract, which the client does not read.
- `type CollectionSchemaKind = 'list' | 'create'`: Runtime schemas of a route set; `transit` exists on bazis-statusy route sets.
- `type ItemSchemaKind = 'retrieve' | 'update' | 'transit'`
- `type RelationshipOperation = 'add' | 'replace' | 'remove'`
- `type FilterValue = string | number | boolean | null`: A value of a filter condition; `null` is sent as `null`, booleans as `true`/`false`.
- `type CrudAccessAction = 'view' | 'change' | 'add' | 'delete' | 'check'`: The access actions of the core (`CrudAccessAction`) checked by bazis-permit.
- `` type CustomActionName = `action_${string}` ``: A custom action of a route set by its name, `action` of `x-bazis` in the OpenAPI (the method of the route set: `action_export`), as `custom_actions` lists it.
- `` type ActionName<Paths, P extends string, M extends HttpMethod, Prefix extends string = ''> = { [K in keyof Paths & string]: K extends `${P}${Prefix}${infer Name}/` ? Name extends '' | `${string}/${string}` | `{${string}` ? never : [ OperationOf<Paths, K, M> ] extends [ never ] ? never : Name : never; }[keyof Paths & string] ``: The names of the custom actions of the route set `P` for the method `M`: the endpoints `<P><Prefix><name>/` that the backend declares (`@http_post('/<name>/')` of a route set), `Prefix` `{item_id}/` for those of an item.
- `type ActionOptionsArg<M extends HttpMethod, Query> = [ Query ] extends [ never ] ? [ options?: ActionOptions<M> ] : object extends Query ? [ options?: ActionOptions<M, Query> ] : [ options: ActionOptions<M, Query> & { query: Query; } ]`: The options argument of a custom action whose query parameters are `Query`: required, with its `query`, when the operation has a required query parameter (`code: str` of the backend), optional otherwise.
- `type BackgroundMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`: The methods of a request that bazis-async-request runs in the background.
- `type BackgroundStatus = 'pending' | 'processing' | 'completed' | 'failed'`: The statuses of a task of bazis-async-background: `pending` (queued), `processing`, then `completed` or `failed`.
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
- `errorMessage?: ((error: ErrorObject) => string) | undefined`: The text of an error of the backend for the user, in the language of the interface (`errorMessage` of `@/bazis/i18n`): that of the errors of the fields of the forms and of the actions.
- `children: ReactNode`

#### useApi

`useApi(): Api`: The client of the backend.

#### useErrorMessage

`useErrorMessage(): (error: ErrorObject) => string`: The text of an error of the backend for the user: `errorMessage` of `BazisProvider`.

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

`type ActionMutation<Response, Variables>`: A mutation of an action, with the errors of its body by field (`ApiError.bodyErrors()` of the last call: a 422 of the validation of the body, `/<field>`, in the language of the interface: `useErrorMessage`); its `error` is the `ApiError` (`StatePanel` `errorState(error)` shows it).

- and the members of `UseMutationResult<Response, Error, Variables>`
- `errors: Readonly<Record<string, readonly string[]>>`

#### ActionQueryOptions

`interface ActionQueryOptions<Query>`

- `query?: Query | null`: The query parameters of the action (`?<name>=<value>`), typed by its OpenAPI and in the key of the query: other parameters are another query.

#### useCreate

`useCreate<P extends CreatePath>(path: P): UseMutationResult<CreateResponse<P>, Error, CreateDocument<P>>`: Creates an item: `mutate(document)`.

#### useDestroy

`useDestroy(path: DestroyPath, options?: DestroyOptions): UseMutationResult<void, Error, string>`: Deletes an item: `mutate(id)`.

#### useRefreshItem

`useRefreshItem(path: ItemPath, id: string): () => Promise<void>`: Reads an item again: the function it returns marks every query of the item stale (its retrieves, its schemas, the responses of its GET actions) and refetches the active ones, after a change that the backend makes to it through another resource (a related item added or deleted changes its computed fields, its transits).

#### useRelationship

`useRelationship(path: RelationshipPath): UseMutationResult<void, Error, RelationshipChange>`: Changes a relationship of an item through its relationship endpoint: `mutate({id, field, operation, data})`; `add` and `remove` change a to-many relationship.

#### useUpdate

`useUpdate<P extends UpdatePath>(path: P): UseMutationResult<UpdateResponse<P>, Error, { id: string; document: UpdateDocument<P>; }>`: Updates an item: `mutate({id, document})`.

#### DestroyOptions

`interface DestroyOptions`: The options of `useDestroy`.

- `leaving?: boolean`: The screens of the item are left once it is deleted (a navigation in the callbacks of `mutate`): they keep its data until then.

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

`useCan(path: SchemaPath<'list'>, action: 'view'): boolean | undefined`: Whether the backend lets the current user view the items of a route set (`view`) or add one (`add`).

`useCan(path: SchemaPath<'create'>, action: 'add'): boolean | undefined`

`useCan(path: ListPath, action: CustomActionName): boolean | undefined`

#### useFilterFields

`useFilterFields<P extends FilterFieldsPath>(path: P): UseQueryResult<FilterFields<P>>`: The fields a list can be filtered by (`route_filter_fields/`), with their types.

#### useItem

`useItem<P extends ItemPath>(path: P, id: string, query?: ItemQuery<P>): UseQueryResult<ItemResponse<P>>`: An item: `include`, `fields` and `meta` as in `api.retrieve`.

#### useList

`useList<P extends ListPath>(path: P, query?: ListQuery<P>): UseQueryResult<ListResponse<P>>`: A page of a list: `filter`, `search`, `sort`, `page`, `fields` and `meta` as in `api.list`.

#### useLists

`useLists<P extends ListPath>(path: P, queries: readonly ListQuery<P>[]): UseQueryResult<ListResponse<P>>[]`: Several lists of a route set at once, a query each, keyed as `useList` keys them (the same request shares its cache): the numbers of the items of the statuses of a workflow, or of the weeks of a date (`page: {limit: 1}`, `meta: ['pagination']`, the `filter` of each), the columns of a board.

#### useSchema

`useSchema<K extends CollectionSchemaKind>(path: SchemaPath<K>, kind: K): UseQueryResult<JsonSchema>`: The runtime schema of an action for the current user: `list` and `create` of the route set, `retrieve`, `update` and `transit` (bazis-statusy) of an item.

`useSchema<K extends ItemSchemaKind>(path: SchemaPath<K>, kind: K, id: string): UseQueryResult<JsonSchema>`

#### useResourceForm

`useResourceForm<P extends CreatePath>(path: P, options?: { id?: undefined; fixed?: FixedValues; initial?: Readonly<Record<string, unknown>>; }): ResourceForm<CreateResponse<P>>`: A form of a resource bound to its runtime schema: `schema_create/` without an id, `schema_update/` of the item with one, so that the fields are those the current user may set.

`useResourceForm<P extends UpdatePath>(path: P, options: { id: string; fixed?: FixedValues; }): ResourceForm<UpdateResponse<P>>`

#### ResourceForm

`interface ResourceForm<Saved>`

- `status: 'loading' | 'error' | 'ready'`: `loading` until the schema (and the item) are loaded, `error` if they failed.
- `error: Error | null`: The error of loading the schema or the item (403, 404, ...).
- `type: string`: The JSON:API type of the resource of the schema; empty until it is loaded.
- `fields: readonly FormField[]`: The fields of the runtime schema in its order; the user may not change `readOnly` ones.
- `values: Readonly<Record<string, unknown>>`: The value of every field: the value of an attribute, the id of the related item of a to-one relationship (null for none), the ids of the related items of a to-many one (an array).
- `setValue(name: string, value: unknown): void`
- `dirty: readonly string[]`: The fields whose value differs from that of the schema or of the item (the `initial` and the `fixed` values among them); only they are submitted.
- `errors: Readonly<Record<string, readonly string[]>>`: The validation errors of the last submit by field (`ApiError.fieldErrors()`), in the language of the interface (`useErrorMessage`).
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
- `type DestroyPath = RouteSetWith<paths, Item, 'delete'>`
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

#### useItemsTransit

`useItemsTransit<P extends TransitPath>(path: P): UseMutationResult<TransitResponse<P> | null, Error, { id: string; transit: string; payload?: unknown; }>`: Runs a transit of any item of the route set, `mutate({id, transit, payload})`: those of the rows that the user selects in a list (its bulk actions), as `useTransit` runs that of one.

#### useTransit

`useTransit<P extends TransitPath>(path: P, id: string): UseMutationResult<TransitResponse<P> | null, Error, { transit: string; payload?: unknown; }>`: Runs a transit of the item: `mutate({transit, payload})`.

#### useTransits

`useTransits(path: TransitPath, id: string): UseQueryResult<readonly Transit[]>`: The transits that the current user may run on the item now, from `meta: ['state_actions']` of its retrieve (the query of `useItem` with this meta).

#### useTransitsOf

`useTransitsOf(path: TransitPath): (id: string) => Promise<readonly Transit[]>`: Reads the transits of any item of the route set when asked (the drop of an item on a column of a board): the query of `useTransits`, fetched again unless it is fresh.

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

- `limit?: number`: The notifications listed, the newest first: 50 by default.
- `poll?: number`: Read the list and the count again every `poll` milliseconds: for a backend without bazis-ws, whose notifications come with no live message.

#### The types and the constants of `@/bazis/react/notify`

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

#### errorMessage

`errorMessage(error: ErrorObject, t: Translate): string`: The text of an error of the backend in the language of the interface: a validation error of Pydantic (`ERR_VALIDATE`, its type in `title`: `missing`, `string_too_short`…) by the key `validation.<key>` of the dictionaries, its limit as `count`; else, and when its limit is not a number (a date), its text (`errorText`: a validator of the product says it in the language of the request).

#### formatDate

`formatDate(value: string | Date, language: string): string`: A date of the backend (`2026-10-08`, read as that day wherever the user is) or a Date; the text when it is not a date.

#### formatDateTime

`formatDateTime(value: string | Date, language: string): string`: A date-time of the backend (ISO) or a Date, with the date and the time; the text when it is not one.

#### formatDecimal

`formatDecimal(value: unknown, language: string, options?: Intl.NumberFormatOptions): string`: A decimal of the backend: a `DecimalField` is a string in the API and in the contract (`"45000.10"`, its exact digits), formatted exactly with the digits after the point that it has (`45,000.10` in English, `45 000,10` in Russian, grouped as `formatNumber` groups) unless `options` sets them; a sum is `{style: 'currency', currency: 'RUB'}` (`45 000,10 ₽`).

#### formatNumber

`formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string`: A number: `12,345.5` in English, `12 345,5` in Russian, grouped by thousands from five digits (`1234.5`); `{useGrouping: false}` never groups it.

#### formatTime

`formatTime(value: Date, language: string): string`: The time of a Date: hours and minutes.

#### isoDate

`isoDate(date: Date): string`: The day of a Date in the time zone of the browser as the backend writes a date: `2026-10-07`.

#### weekStart

`weekStart(language: string): number`: The first day of the week in a language, `1` (Monday) to `7` (Sunday), as `Intl.Locale` gives it (`7` in American English); Monday where the browser does not tell.

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
- `MESSAGES: Readonly<Record<string, Messages>>`: The dictionaries of the package, by language: those of the product are merged over them.
- `LanguageProviderProps`: the props of `LanguageProvider`, listed with it
- `type Messages = Readonly<Record<string, string>>`: A dictionary: the text of each key in one language.
- `type Params = Readonly<Record<string, string | number>>`: The parameters of a text: `{name}` in the text is replaced by `params.name`.
- `type Translate = (key: string, params?: Params) => string`: A translation of a key with its parameters in the current language: `t('list.page', {from, to})`.

## API: the components: app-shell, async-result, board-dnd, charts, dashboard, date-picker, empty-state, file-field, live-query, login-form, map

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/app-shell`

#### Allowed

`Allowed(props: { requirement: NavRequirement | undefined; children: ReactNode; }): string | number | bigint | boolean | Element | Iterable<ReactNode> | Promise<AwaitedReactNode> | null | undefined`: Its children once the backend allows the user what a link requires (`requires` of a `NavItem`), nothing until then; at once without a requirement: the links of the navigation, the quick links of a dashboard.

#### AppShell

`AppShell(props: AppShellProps): Element`: The layout of the screens.


Its props, `AppShellProps`:

- `title: ReactNode`: The name of the product.
- `navigation?: Navigation`: `navigation` of the theme by default.
- `items: readonly NavEntry[]`: The links of the navigation and their groups.
- `session?: ShellSession | null`
- `signIn?: (() => void) | undefined`: The sign-in of a user without a session (`action:sign-in`), shown in the place of the session while it is null: it opens the login.
- `tools?: ReactNode`: The tools of the product next to the color mode, such as the notifications (`NotificationCenter`) and the state of the socket (`LiveQuery`): in the top bar, else at the foot of the sidebar (a row that wraps, above the session) or, on a phone, in its header.
- `children: ReactNode`

#### Screen

`Screen(props: ScreenProps): Element`: A screen of the specs: `screen:<id>`, its header (the link back to its parent, the title and the actions; in a working application it stays at the top while the screen scrolls, `--sticky-top` high), its description and its content.


Its props, `ScreenProps`:

- `id: string`: The id of the screen in the specs: `screen:<id>`.
- `title?: ReactNode`
- `parent?: ScreenParent`: The screen it was opened from: before the title, a breadcrumb to it on a wide screen (`xl`), a button back to it below.
- `description?: ReactNode`: Under the title: what the screen is for.
- `actions?: ReactNode`: Next to the title: the actions of the screen.
- `children: ReactNode`

#### useNavItems

`useNavItems(): readonly NavItem[]`: The links of the navigation of the layout (`items` of `AppShell`, those of its groups in their place), none outside it.

#### useScreenPage

`useScreenPage(): ScreenPage | null`: The page of the current screen, null outside a `Screen`.

#### useWide

`useWide(): boolean`: Whether the screen is at least the breakpoint `md` of Tailwind wide: the sidebar is shown, and a list is not the one of a phone (true when the browser cannot tell, as in jsdom).

#### NavGroup

`interface NavGroup`: Links of the navigation under a heading, shown while the backend allows the user one of them.

- `group: string`: The id of the group in the specs.
- `label: ReactNode`
- `items: readonly NavItem[]`

#### NavItem

`interface NavItem`: A link of the navigation to a screen of the specs: `nav:<screen>`.

- `screen: string`
- `label: ReactNode`
- `to: string`
- `end?: boolean`: Active only on this exact path (the home `/`).
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.
- `requires?: NavRequirement`: What the backend must allow the user: the link is shown once it does (always without).
- `public?: boolean`: The link of a public screen (an anonymous role of the specs), also shown without a session.

#### NavRequirement

`interface NavRequirement`: What the backend must let the user do for a link to be shown, read from the runtime (the frontend never decides by his role; the backend checks every request anyway).

- `path: string`: The route set of the screen (`ROUTES` of the contract).
- `can?: Can`: View its items (its list), the default, or add one: `useCan` of `@/bazis/react`.
- `filters?: readonly string[]`: Fields that the user may filter its list by (`route_filter_fields/`): the link of a report filtered by a field that his field permissions hide, whose filter the backend answers with 400.

#### ScreenPage

`interface ScreenPage`: The place of a form shown as a page (`forms: page` of the theme, `FormSurface` of resource-form): it takes the place of the content of the screen while it is open.

- `target: HTMLElement | null`
- `claim: (open: boolean) => void`: A form page opens (true) or closes (false).
- `titled: boolean`: The screen has a title, its `h1`; without one, its card is headed by its item, `h1`.

#### ScreenParent

`interface ScreenParent`: The screen that a screen was opened from, such as the list of a card.

- `screen: string`: Its id in the specs: the link back to it is `nav:<screen>`.
- `label: ReactNode`
- `to: string`

#### ShellSession

`interface ShellSession`: The session of the user; null without a login (no bazis-users), or before the user logs in.

- `user?: ReactNode`: Who is logged in.
- `onLogout: () => void`

#### ColorModeToggle

`ColorModeToggle(props: { className?: string; }): Element | null`: A button that switches the mode: system, light, dark; nothing without a dark mode.

#### initColorMode

`initColorMode(): void`: Applies the stored mode and follows the system; `src/main.tsx` calls it before the render.

#### setColorMode

`setColorMode(next: ColorMode): void`

#### LanguageToggle

`LanguageToggle(props: { className?: string; }): Element | null`: A button that switches the language of the interface; nothing with fewer than two languages.

#### ListCardLayout

`ListCardLayout(props: ListCardLayoutProps): Element`: The screen of a list with the screen of its card (the child route).


Its props, `ListCardLayoutProps`:

- `list: ReactNode`: The screen of the list.
- `mode?: 'split' | 'pages'`: `composition.list_card` of the theme by default.

#### useBesideCard

`useBesideCard(): boolean`: Whether the list is shown next to an open card (`split` on a wide screen): narrow, it shows only its first columns (`compactColumns` of `ResourceList`).

#### useBesideList

`useBesideList(): boolean`: Whether the card is shown next to its list (`split` from the breakpoint `xl`): narrow, a list in it (a related list) shows its rows as the cards of a phone, never wider than the card.

#### The types and the constants of `@/bazis/ui/app-shell`

- `AppShellProps`: the props of `AppShell`, listed with it
- `type Navigation = 'sidebar' | 'topbar'`
- `type NavEntry = NavItem | NavGroup`: An entry of the navigation: a link, or a group of links.
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

### `@/bazis/ui/board-dnd`

#### BoardDnd

`BoardDnd(props: { children: ReactNode; }): Element`: The boards below it move their cards by drag and drop too.

### `@/bazis/ui/charts`

#### Chart

`Chart(props: ChartProps): Element`: A chart of values in a card: its title, the drawing, the values as text.


Its props, `ChartProps`:

- `id: string`: The id of the chart in the specs: `chart:<id>`.
- `label: ReactNode`
- `kind?: ChartKind`
- `values: readonly ChartValue[]`
- `series?: boolean`: A color of the series per value (the statuses); one color for all by default (the periods).
- `state?: ViewState`: The state of what it shows: `empty` when every value is 0.
- `error?: unknown`
- `className?: string`

#### StatusChart

`StatusChart(props: StatusChartProps): Element`: The number of the items of a statusy model by status: a list of one item per status.


Its props, `StatusChartProps`:

- `id: string`
- `path: ListPath`: The route set of a statusy model (`ROUTES` of the contract).
- `label: ReactNode`
- `kind?: ChartKind`: A ring by default.
- `filter?: Filter | undefined`: The items it counts; every item that the user may view without.
- `statuses?: readonly string[] | undefined`: The statuses it shows, in this order; all of the workflow by default.
- `className?: string`

#### TimeChart

`TimeChart(props: TimeChartProps): Element`: The number of the items by period of a date field, the last periods to the current one: a list of one item per period (`<field>__gte` its first day, `<field>__lt` the next one; the first moment of a day in the time zone of the browser for a date-time).


Its props, `TimeChartProps`:

- `id: string`
- `path: ListPath`
- `field: string`: The date or date-time field whose periods it counts (`dt_created`, `due_date`).
- `label: ReactNode`
- `kind?: ChartKind`: Bars by default.
- `bucket?: ChartBucket`: A week by default (from the first day of the week of the language).
- `last?: number`: The number of the periods, the current one the last: 12 by default.
- `filter?: Filter | undefined`
- `now?: Date | undefined`: The current moment (the tests); the moment of the first render by default.
- `className?: string`

#### ChartValue

`interface ChartValue`: A value of a chart.

- `key: string`: Its key: `value:<key>` (a status, the first day of a period `2026-10-05`).
- `label: string`
- `value: number`
- `tone?: Tone | undefined`: Its tone (a status: `statuses` of the theme), drawn in the color of the tone rather than of a series.

#### The types and the constants of `@/bazis/ui/charts`

- `type ChartBucket = 'day' | 'week' | 'month'`: The period of a value of `TimeChart`.
- `type ChartKind = 'donut' | 'bar' | 'line'`: A ring of the shares (`donut`), bars, or a line.
- `ChartProps`: the props of `Chart`, listed with it
- `StatusChartProps`: the props of `StatusChart`, listed with it
- `TimeChartProps`: the props of `TimeChart`, listed with it

### `@/bazis/ui/dashboard`

#### Dashboard

`Dashboard(props: DashboardProps): Element`: The home of a product: its numbers, its links, its charts and its last items, in this order.


Its props, `DashboardProps`:

- `id?: string`: The id of the screen in the specs: `screen:<id>`; `home` by default.
- `title?: ReactNode`
- `description?: ReactNode`: What the product is for (`summary` of the product, under the title of a hero).
- `actions?: ReactNode`: The actions of the screen, such as the forms that create an item (`action:<id>`).
- `hero?: boolean`: The title, the description and the actions as a hero: a portal (`preset` of the theme) by default.
- `before?: ReactNode`: What the screen shows before its parts (after the hero), such as the extension of a generated screen.
- `tiles?: readonly StatCardProps[]`
- `links?: readonly NavItem[]`: The links to the screens, the items of the navigation of `AppShell` by default: all but the dashboard itself, each once the backend allows what it `requires`.
- `charts?: ReactNode`: The charts: `StatusChart` and `TimeChart` of `@/bazis/ui/charts`, each in `Viewable`.
- `recent?: readonly RecentListProps[]`
- `children?: ReactNode`: What the screen shows after its parts, such as the create forms of its actions: in the screen, so that a form composed as a page takes its place.

#### RecentList

`RecentList(props: RecentListProps): Element`: The last items of a route set: a row each, its first field as its title.


Its props, `RecentListProps`:

- `id: string`: The id of the list in the specs: `recent:<id>`.
- `path: ListPath`: The route set of its items (`ROUTES` of the contract).
- `label: ReactNode`
- `columns: readonly string[]`: The fields it shows, the first as the title of a row.
- `sort?: readonly string[] | undefined`: Its order: the last created first (`['-dt_created']`), say.
- `limit?: number`: The number of its items: 5 by default.
- `filter?: Filter | undefined`
- `display?: Readonly<Record<string, FieldDisplay>>`: How a field is shown (`display` of the entity of the specs).
- `onOpen?: ((id: string) => void) | undefined`: Opens an item (`open` of the specs): a click on its row.
- `className?: string`

#### Viewable

`Viewable(props: { path: ListPath; children: ReactNode; }): ReactNode`: A part of a dashboard once the backend lets the user view the items of its route set (`useCan(path, 'view')`): nothing when it does not, its loading state until it tells.

#### The types and the constants of `@/bazis/ui/dashboard`

- `DashboardProps`: the props of `Dashboard`, listed with it
- `RecentListProps`: the props of `RecentList`, listed with it

### `@/bazis/ui/date-picker`

#### DatePicker

`DatePicker(props: DateInputProps): Element`: The input of a date and its calendar: the button of the calendar in the input (the picker of the browser hidden where it can be), none when the input is read-only.


Its props, `DateInputProps`:

- and the members of `Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'>`
- `value: string`: `2026-10-07`, or the empty string for none.
- `onChange: (value: string) => void`
- `'data-bz'?: string | undefined`

#### DatePickerProvider

`DatePickerProvider(props: { children: ReactNode; }): Element`: The dates of the forms and of the filters below it are picked in a calendar (`DatePicker`).

### `@/bazis/ui/empty-state`

#### EmptyState

`EmptyState(props: EmptyStateProps): Element`: Nothing to show, with what fills it: `state:empty`.


Its props, `EmptyStateProps`:

- `icon?: ComponentType<{ className?: string; }>`: The icon of the entity, such as an icon of lucide-react; an empty tray by default.
- `title?: ReactNode`: The title; the text `state.empty.title` by default.
- `description?: ReactNode`: The hint under the title; the text `state.empty.hint` by default.
- `children?: ReactNode`: The actions, buttons marked `action:<id>`: what the user may do to fill it.
- `className?: string`

#### The types and the constants of `@/bazis/ui/empty-state`

- `EmptyStateProps`: the props of `EmptyState`, listed with it

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

`LeafletMap(props: LeafletMapProps): Element`: A Leaflet map with a marker per point (`marker:<id>`, a button with the label as its name and its title when it opens the item: the keyboard reaches it), fitted to them when they change (not when another one is selected); its tiles, else those of `MapProvider`.


Its props, `LeafletMapProps`:

- `markers: readonly MapMarker[]`
- `selected?: string | null | undefined`: The marker drawn larger (the open item).
- `onOpen?: ((id: string) => void) | undefined`: A click on a marker, or Enter or Space on a marker focused with the keyboard.
- `onPick?: ((point: LatLng) => void) | undefined`: A click on the map elsewhere: its point (the map of a point field).
- `me?: LatLng | null | undefined`: The position of the user, drawn apart.
- `tiles?: MapTiles | undefined`: The tiles of this map, over those of `MapProvider`.
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

`MapProvider(props: { tiles?: MapTiles | undefined; points?: Readonly<Record<string, readonly string[]>>; children: ReactNode; }): Element`: The tiles of the maps below it, and the map of the point fields in the forms (`FieldInput`: a click places the point).

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
- `tiles?: MapTiles | undefined`: The tiles of the map, over those of `MapProvider`.
- `className?: string | undefined`

#### The types and the constants of `@/bazis/ui/map`

- `OSM_TILES: MapTiles`: The tiles of OpenStreetMap, the default: their usage policy allows light use with this attribution; a product in production sets the tiles of its provider (`MapProvider tiles`) and lets their host in its Content Security Policy (`img-src`).
- `LeafletMapProps`: the props of `LeafletMap`, listed with it
- `ResourceMapProps`: the props of `ResourceMap`, listed with it

## API: the components: notification-center

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/notification-center`

#### NotificationCenter

`NotificationCenter<T extends CenterNotification>(props: NotificationCenterProps<T>): Element`: The bell of the notifications with their list.


Its props, `NotificationCenterProps`:

- `notifications: NotificationSource<T>`: The notifications: `useInbox(ROUTES['notify.notification'])` or `useNotifications()`.
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

## API: the components: resource

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/resource`

#### DateInput

`DateInput(props: DateInputProps): Element`: The input of a date: the control of `DatesProvider`, else `<input type="date">`.


Its props, `DateInputProps`:

- and the members of `Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'>`
- `value: string`: `2026-10-07`, or the empty string for none.
- `onChange: (value: string) => void`
- `'data-bz'?: string | undefined`

#### DatesProvider

`DatesProvider(props: { control: ComponentType<DateInputProps> | null; children: ReactNode; }): Element`: Gives the inputs of the dates below it their control (`DatePickerProvider` of date-picker).

#### useDates

`useDates(): Dates`: The inputs of the dates: their control of `DatesProvider`.

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

`FieldValue(props: FieldValueProps): Element`: The value of a field for reading: an attribute formatted by its type, its format and `display` (a phone as a link to call it, a share as a bar), the labels of the related items of a relationship (the status of an item of bazis-statusy by its name), an uploaded file (`FileValue`).


Its props, `FieldValueProps`:

- `field: FormField | undefined`
- `value: unknown`
- `type?: string`: The JSON:API type of the item: the `status` of an item of a statusy model is named by the contract.
- `display?: FieldDisplay | undefined`: How the value is shown (`display` of the field of the entity of the specs).

#### ItemValue

`ItemValue(props: ItemValueProps): Element`: The value of a field of an item as a cell shows it: the status of an item of a statusy model as a badge of its tone (`status:<id>`), any other field as `FieldValue`.


Its props, `ItemValueProps`:

- `item: ResourceObject`
- `name: string`: The name of the field.
- `fields: Fields`: The fields of the item's route set (`useListFields`, `useItemFields`).
- `display?: FieldDisplay | undefined`

#### titleFromText

`titleFromText(element: HTMLElement | null): (() => void) | undefined`: A ref that gives an element its text as its title, kept as the text changes (the label of a related item read later): the whole text of a value that `truncate` may cut.

#### choiceOptions

`choiceOptions(field: FormField | undefined): { value: string; label: string; }[] | null`: The choices of an attribute with choices as options (the value as text, the label of `enumDict`, else the value), in their order; null for another field.

#### customActionAt

`customActionAt(path: string, name: string, item: boolean): (ContractCustomAction & { readonly key: CustomActionName; }) | undefined`: The custom action `name` (its name in the path) of the items (`item`) or of the route set of `path` in the contract, with its name in the permission meta (`action_<name>` of `custom_actions`); undefined when the contract does not have it.

#### fieldTitle

`fieldTitle(path: string, name: string, title?: string): string`: The title of a field of the route set of `path`: that of its runtime schema (`title`), else that of the contract, else its name as words; never a name of the code.

#### fieldValue

`fieldValue(resource: ResourceObject, name: string): unknown`: The value of a field of a resource object: an attribute, the id of the related item of a to-one relationship (null for none), the ids of a to-many one; undefined when it is absent.

#### formatValue

`formatValue(field: FormField | undefined, value: unknown, options?: Pick<LanguageContextValue, 'language' | 't'>, display?: FieldDisplay): string`: The text of the value of an attribute, in the language of the interface (`useLanguage()`; English by default): a choice by its label (`enumDict` of the backend, the choices of an array each), else by its type and format, the numbers, the sums, the quantities and the phones as `display` says and the dates with `Intl`, a point (GeoJSON) as its coordinates (`formatPoint`); `—` for no value.

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

`itemLabel(resource: ResourceObject): string`: The label of an item: its name (`itemName`), or its id.

#### itemName

`itemName(resource: ResourceObject): string | null`: The name of an item: the values of the attributes of `label` of its resource in the contract, the backend's own; for a type that the contract does not label, or an item without a value of them (a user without his names), its first non-empty name of `LABELS` (`name`, `full_name`, the first and the last name, `title`, `username`, `email`, `slug`, `code`); null without any.

#### localizedName

`localizedName(item: ContractName | undefined, id: string, language: string): string`: A name of the contract in a language: that of the language, of its base language, of the default language of the backend; its id without any.

#### permitted

`permitted(meta: PermitMeta | null | undefined, action: 'add' | 'change' | 'delete' | CustomActionName, id?: string): boolean`: Whether the backend allows an action now, from the permission meta of bazis-permit (`can()` of the client): `add` from `for_create` of a list or `crud_actions` of an item, `change` and `delete` of an item of a list from `for_change`/`for_delete` with its id, a custom action (`'action_<name>'`, `action` of `x-bazis`) from `custom_actions` (bazis-permit 2.11; by what the action declares, not the checks of its own code).

#### resourceAt

`resourceAt(path: string): ContractResource | undefined`: The resource of the contract whose route set has this path, if it has one.

#### routeOf

`routeOf(type: string): string | undefined`: The path of the route set of a JSON:API type (`ROUTES` of the contract), if it has one.

#### statusName

`statusName(type: string, status: string, language?: string): string`: The name of a status of the model in a language (`useLanguage().language`; the default language of the backend without it); its id when the contract does not have it.

#### statusyModel

`statusyModel(type: string): StatusyModel | undefined`: The statusy model of a JSON:API type, undefined for a type that is not one.

#### typeAt

`typeAt(path: string): string | undefined`: The JSON:API type of the route set of a path (`ROUTES` of the contract), as `routeOf` the other way.

#### useItemFields

`useItemFields(path: string, id: string, kind?: 'retrieve' | 'update'): Fields`: The fields that the current user may see in an item (`schema_retrieve/`, by default), or may set in its update (`schema_update/`: those they may not change now are `readOnly`), for this item: the field permissions of bazis-permit depend on the item (its selectors, its status).

#### useListFields

`useListFields(path: string): Fields`: The fields of a list (`schema_list/`): their titles and types.

#### workflowStatuses

`workflowStatuses(type: string): readonly string[]`: The statuses of a statusy model in the order of its workflow (the contract sorts them by id): the initial one, then those its transits reach, in the order of the transits; the statuses no transit reaches last.

#### ContractCustomAction

`interface ContractCustomAction`: A custom action of a route set in the contract (`custom_actions` of its resource).

- `readonly name: string`: Its name in the path: `<path><name>/`, or `<path><id>/<name>/` for an item.
- `readonly item: boolean`: Whether it is an action of an item.
- `readonly method: string`
- `readonly access_action: string | null`: What the route requires of the user on the item (`change`), null for nothing more than the route.
- `readonly body: JsonSchema | null`: The JSON Schema of its body, null without one.

#### Fields

`interface Fields`: The fields of a runtime schema by name, and the state of its query.

- `fields: ReadonlyMap<string, FormField>`
- `title: (name: string) => string`: The title of a field in the language of the backend; its title in the contract (in the default language of the backend) until the schema loads or when the schema does not have it; a title that is the name itself (a calculated field without one) or the default `verbose_name` of Django (`status author`), S018 of `check`, as words (`Status author`), never shown as an identifier.
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

#### formatPoint

`formatPoint(options: LatLng): string`: The coordinates as maps write them, whatever the language: `55.7558, 37.6173` (at most 6 decimals).

#### geoJsonPoint

`geoJsonPoint(options: LatLng): GeoJsonPoint`: The GeoJSON of a point, the value of a point field.

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

#### StatusLabel

`StatusLabel(props: StatusLabelProps): Element`: A status by its id: its name in a badge of its tone, `status:<id>` with `data-tone`.


Its props, `StatusLabelProps`:

- `type: string`: The JSON:API type of the model, whose statuses name it.
- `status: string`: The id of the status.
- `className?: string`

#### statusTone

`statusTone(status: string): Tone`: The tone of a status: `statuses` of the theme, neutral for another.

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

- `DateInputProps`: the props of `DateInput`, listed with it
- `FieldInputProps`: the props of `FieldInput`, listed with it
- `FieldValueProps`: the props of `FieldValue`, listed with it
- `ItemValueProps`: the props of `ItemValue`, listed with it
- `type FieldDisplay = 'plain' | 'phone' | { currency: string; } | { unit: string; } | { bar: number; }`: How the value of a field is shown (`display` of the field of an entity of the specs): `plain`, a number without the separators of its thousands (a code of five digits or more: a number below 10,000 has none anyway, a year as it is written); `phone`, a phone number to call; `{currency}`, a sum in the currency (ISO 4217); `{unit}`, a quantity followed by its unit; `{bar}`, a number with a bar of its share of the maximum.
- `FILE_RESOURCES: readonly string[]`: The resources of the uploaded files of the contract; none without bazis-uploadable.
- `FileViewProps`: the props of `FileView`, listed with it
- `POINT_FIELDS: Readonly<Record<string, readonly string[]>>`: The point fields of the contract (`format: point`) by the path of each route set of their resource.
- `useAnyAction: (path: string, name: string) => ActionMutation<unknown, Readonly<Record<string, unknown>>>`: `useAction(path, name)`: a custom action of the route set (POST), `mutateAsync(body)`.
- `useAnyFilterFields: (path: string) => UseQueryResult<FilterFieldsDocument>`: `useFilterFields(path)`.
- `useAnyItem: (path: string, id: string, query?: Pick<QueryOptions, "include" | "fields" | "meta"> | undefined) => UseQueryResult<ItemDocument>`: `useItem(path, id, query)`.
- `useAnyItemAction: (path: string, name: string) => ActionMutation<unknown, { id: string; body: Readonly<Record<string, unknown>>; }>`: `useItemAction(path, name)`: a custom action of an item (POST), `mutateAsync({id, body})`.
- `useAnyList: (path: string, query?: Omit<QueryOptions, "include"> | undefined) => UseQueryResult<ListDocument>`: `useList(path, query)`.
- `useAnyLists: (path: string, queries: readonly Omit<QueryOptions, "include">[]) => UseQueryResult<ListDocument>[]`: `useLists(path, queries)`: several lists of a route set, a query each.
- `useAnyRelated: (path: string, id: string) => UseQueryResult<ResourceObject | null>`: `useRelatedItem(path, id)`: null when the user may not view the item.
- `useAnyResourceForm: (path: string, options: { id?: string | undefined; fixed?: Readonly<Record<string, unknown>> | undefined; initial?: Readonly<Record<string, unknown>> | undefined; }) => ResourceForm<...>`: `useResourceForm(path, {id, fixed, initial})`: a create without an id.
- `useAnySchema: (path: string, kind: "list" | "create" | "retrieve" | "update" | "transit", id?: string | undefined) => UseQueryResult<Readonly<Record<string, unknown>>>`: `useSchema(path, kind)` of the route set, `useSchema(path, kind, id)` of an item.
- `SOFT_TONES: Readonly<Record<Tone, string>>`: The soft colors of each tone that the theme derives from the tokens: a background and the text on it.
- `StatusLabelProps`: the props of `StatusLabel`, listed with it
- `PICKER_PAGE: 20`: How many items a page of the picker reads; `Load more` reads the next one.
- `RelationListPickerProps`: the props of `RelationListPicker`, listed with it
- `RelationPickerProps`: the props of `RelationPicker`, listed with it

## API: the components: resource-board, resource-calendar, resource-card, resource-form, resource-list

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/resource-board`

#### BoardDragProvider

`BoardDragProvider(props: { drag: BoardDrag; children: ReactNode; }): Element`: Gives the boards below it their drag and drop (`BoardDnd` of board-dnd).

#### useBoardDrag

`useBoardDrag(move: boolean): BoardDrag`: The drag and drop of a board whose cards `move`: none without `BoardDragProvider`, or when they do not.

#### BoardDrag

`interface BoardDrag`: The parts of the drag and drop of a board.

- `Area: ComponentType<{ onDrop: (id: string, status: string) => void; children: ReactNode; }>`: The board: `onDrop` gets the id of a card dropped on another column, and the status of that one.
- `Column: ComponentType<{ status: string; label: string; children: ReactNode; }>`: A column, where a card is dropped; `label`: the name of its status, for the screen readers.
- `Card: ComponentType<{ id: string; label: string | null; children: ReactNode; }>`: A card, which is dragged; `label`: the name of its item, for the screen readers (none without one).

#### ResourceBoard

`ResourceBoard(props: ResourceBoardProps): Element`: The board of the items of a statusy model by status, with their moves.


Its props, `ResourceBoardProps`:

- `path: TransitPath`: The route set of a statusy model (`ROUTES` of the contract).
- `entity: string`: The entity of the screen: `board:<entity>`.
- `columns?: readonly string[]`: The statuses of the columns, in this order; those of the workflow by default.
- `title: string`: The field that titles a card (`card.title` of the spec).
- `fields?: readonly string[]`: The other fields of a card (`card.fields`).
- `badge?: string`: A boolean field: a badge of its title on a card while it is true (`card.badge`, such as `is_overdue`).
- `badgeTone?: Tone`: The tone of the badge; warning by default.
- `filter?: Filter | undefined`: The items of the board (the filter of the screen); every item that the user may view without.
- `filters?: readonly (string | ListFilter)[]`: The filters of the user, as those of a list (`FilterBar` of resource-list), above the columns.
- `sort?: readonly string[]`: The order of the cards in a column.
- `move?: boolean`: Whether a card moves to another column by a transit (`move: true` of the spec); not by default.
- `transits?: readonly DeclaredTransit[]`: The transits of the workflow of the specs (`transits` of the generated entities): the order of the moves, those confirmed first.
- `onOpen?: (id: string) => void`: Called with the id of the card the user opens.
- `pageSize?: number`: The cards of a column at first, and the more shown each time.
- `display?: Readonly<Record<string, FieldDisplay>>`: How the values of fields are shown (`display` of the fields of the entity of the specs).
- `emptyMessage?: ReactNode`: The message of an empty board, with the icon of the entity.
- `icon?: ComponentType<{ className?: string; }>`

#### The types and the constants of `@/bazis/ui/resource-board`

- `ResourceBoardProps`: the props of `ResourceBoard`, listed with it

### `@/bazis/ui/resource-calendar`

#### ResourceCalendar

`ResourceCalendar(props: ResourceCalendarProps): Element`: The calendar of the items of a route set by day, with the list of the selected day.


Its props, `ResourceCalendarProps`:

- `path: ListPath`: The route set (`ROUTES` of the contract).
- `entity: string`: The entity of the screen: `calendar:<entity>`.
- `field: string`: The date or date-time field of the day of an item.
- `end?: string | undefined`: The date or date-time field of the last day of an item that spans days.
- `label?: readonly string[] | undefined`: The fields that an item shows; the label of the resource of the contract by default.
- `tone?: { field: string; tone: Tone; } | undefined`: The items whose boolean field is true, in a tone of the theme.
- `views?: readonly CalendarView[]`: The views the user switches between, the first shown at first: a month by default.
- `filter?: Filter | undefined`: The items of the calendar (the filter of the screen).
- `filters?: readonly (string | ListFilter)[]`: The filters of the user, as those of a list (`FilterBar` of resource-list), above the days.
- `onOpen?: ((id: string) => void) | undefined`: Called with the id of the item the user opens.
- `add?: CalendarAdd | undefined`
- `display?: Readonly<Record<string, FieldDisplay>>`: How the values of fields are shown (`display` of the fields of the entity of the specs).
- `now?: Date | undefined`: The current moment (the tests); the moment of the first render by default.

#### CalendarAdd

`interface CalendarAdd`: The action that creates an item on the selected day, a button `action:<id>`, shown when the user may create.

- `id: string`
- `label: ReactNode`
- `onAdd: (initial: Readonly<Record<string, unknown>>) => void`: Called with the values that the create form of the screen starts with, which the user may change: `field` on the selected day, the day (`YYYY-MM-DD`) of a date, of a date-time the moment of `time` on that day in the time zone of the browser (ISO); `end` of a date-time `duration` later; and the value of each filter of the user that selects a related item or a choice, of a field of `fields`.
- `time?: string | undefined`: The time of a date-time on the selected day, `HH:MM`: the start of the day (00:00) by default.
- `duration?: number | undefined`: The minutes from `field` to `end` of a date-time: the form starts without its end by default.
- `fields?: readonly string[] | undefined`: The fields of its form, which the values of the filters may start: any field by default.
- `icon?: ComponentType<{ className?: string; }>`

#### The types and the constants of `@/bazis/ui/resource-calendar`

- `type CalendarView = 'month' | 'week'`: A month or a week at a time.
- `ResourceCalendarProps`: the props of `ResourceCalendar`, listed with it

### `@/bazis/ui/resource-card`

#### RelatedList

`RelatedList(props: RelatedListProps): Element`: The items of a related resource of the item of a card, and their create from it; the card is read again after an item is added, wherever the section is placed.


Its props, `RelatedListProps`:

- `extends Pick<ResourceListProps, 'columns' | 'onOpen' | 'rowActions' | 'cells' | 'emptyMessage' | 'sort' | 'pageSize' | 'layout' | 'display' | 'icon'>`
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
- `title?: (item: ResourceObject) => ReactNode`: The heading; by default the name of the item (`itemName`: its name, title...), else the values of its `label` fields (its id only when none has a value).
- `label?: readonly string[]`: The fields whose values head an item without a name (`label` of the entity of the specs: a loan by its book and its reader); the first two fields of the sections by default, or when it is empty.
- `badge?: (item: ResourceObject) => ReactNode`: Next to the heading: the status of the item (`StatusBadge` of status-badge).
- `edit?: boolean`: An edit button (`action:edit`) when the backend allows the change: the form of the update of the fields of the sections.
- `actions?: readonly CardAction[]`
- `values?: Readonly<Record<string, (item: ResourceObject) => ReactNode>>`: The values of fields, instead of the formatted value.
- `display?: Readonly<Record<string, FieldDisplay>>`: How the values of fields are shown (`display` of the fields of the entity of the specs).
- `children?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode)`: Under the heading: the transits of the item (`TransitBar` of transit-bar), a section of the product, given the item and its permission meta (`crud_actions`: `permitted(meta, 'change')`; `custom_actions`: `permitted(meta, 'action_report')`, the button of a custom action of the item) without a request of its own.
- `after?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode)`: Under the sections (and the tabs), given the item and its permission meta as `children`: what relates to the item, its related lists (`RelatedList`) and its status history (`StatusHistory` of status-history, which takes the item), of a card without tabs.
- `tabs?: readonly CardTab[]`: The sections and the related content in tabs (`card.tabs` of the specs), under the children; the sections one under the other without.
- `forms?: 'dialog' | 'page'`: The edit in a dialog or as a page; `composition.forms` of the theme by default.

#### CardTab

`interface CardTab`: A tab of a card: `tab:<id>`.

- `id: string`
- `title: ReactNode`
- `sections?: readonly string[]`: The ids of the sections it shows (`sections` of the card).
- `content?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode)`: What it shows after them, given the item and its permission meta, as the children of the card.

#### CardAction

`interface CardAction`: An action of the card, a button `action:<id>`, shown when the user may do it on the item.

- `id: string`
- `label: ReactNode`
- `onClick: () => void`
- `permission?: 'change' | 'delete' | CustomActionName`: `change`, `delete`, or a custom action of the item (`action_<name>`, in `custom_actions` of its meta).
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

- either: `path: CreatePath`: A create: the route set.; `id?: undefined`; `initial?: Readonly<Record<string, unknown>> | undefined`: The values that the create starts with in place of the defaults of the schema, which the user may change (`useResourceForm` `initial`): the day of a calendar.
- or: `path: UpdatePath`; `id: string`; `initial?: undefined`
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

### `@/bazis/ui/resource-list`

#### BulkAction

`interface BulkAction`: An action on the selected rows: `bulk:<id>`.

- `id: string`
- `label: ReactNode`
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.
- `permission?: 'change' | 'delete'`: What the backend must allow on a row of the page (`for_change`, `for_delete` of its meta): the others are left out.
- `variant?: 'default' | 'outline' | 'destructive'`
- `run: (id: string) => Promise<unknown>`: Runs the action on an item, rejected when its request fails: `useItemsTransit(path)` of `@/bazis/react/statusy` (`mutateAsync({id, transit})`), `useDestroy(path)`.

#### equalValues

`equalValues(filters: readonly ListFilter[], values: FilterValues, types: ReadonlyMap<string, FieldType>): FilterValues`: The values of the filters that select one value of their field, a related item or a choice: those that a new item of the filtered items takes (the add of a calendar).

#### FilterBar

`FilterBar(props: FilterBarProps): Element`: The controls of the filters of a list (their types from `route_filter_fields/`), but for the fields that the backend does not offer the user to filter by; the state of the error when the filter fields cannot be read (not every filter hidden in silence).


Its props, `FilterBarProps`:

- `path: string`
- `filters: readonly ListFilter[]`
- `ready?: boolean`: Whether the titles of the fields are loaded: until then, and until the types of the filters are, a skeleton.
- `title: (name: string) => string`: The titles of the fields.
- `onFilter: (filter: Filter | undefined, equal: FilterValues) => void`: Called with the expression of the filters when a value changes, and the values of those that select one value of their field (`equalValues`).

#### filterOf

`filterOf(filters: readonly ListFilter[], values: FilterValues, types: ReadonlyMap<string, FieldType>): Filter | undefined`: The `filter` expression of the values, or undefined without any.

#### listFilters

`listFilters(filters: readonly (string | ListFilter)[], fields: Fields): ListFilter[]`: The filters of a list, a board or a calendar, given by the name of their field or as they are: a field with choices in the list schema is filtered by a select of its choices, by their labels.

#### ListFilter

`interface ListFilter`: A filter of a list: a field of `route_filter_fields/`, its label and its choices.

- `field: string`
- `label?: string`: The label; the title of the field in the list schema by default.
- `options?: readonly { value: string; label: string; }[]`: The choices (value, label), as the statuses of `statusOptions()` of status-badge; those of a field with choices in the list schema (`choiceOptions`) by default (`listFilters`).

#### ResourceList

`ResourceList(props: ResourceListProps): Element`: A list of a resource, with its states, filters, sort, view, selection, pages and actions.


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
- `display?: Readonly<Record<string, FieldDisplay>>`: How the values of fields are shown (`display` of the fields of the entity of the specs).
- `rowTone?: (row: ResourceObject) => Tone | undefined`: The tone of the theme that highlights a row (`list.highlight` of the spec), undefined for none: its soft color and a bar of the tone, marked `data-tone`.
- `rowToneLabel?: (row: ResourceObject) => string | undefined`: What the tone of a highlighted row means, in words (`label` of `list.highlight`): its `aria-description`, so that the highlight is not told by its color alone.
- `emptyMessage?: ReactNode`: The message of the empty list.
- `icon?: ComponentType<{ className?: string; }>`: The icon of the entity (such as an icon of lucide-react), in the empty state.
- `layout?: 'table' | 'cards'`: A table or a grid of cards; `composition.list` of the theme by default.
- `phoneLayout?: 'table' | 'cards'`: The list on a phone, below the breakpoint `md` (cards, where a table would scroll sideways); `composition.list_phone` of the theme by default.
- `density?: Theme['density']`: The density of the rows of the table, which the user may change; that of the theme by default.
- `selection?: readonly string[]`: The ids of the selected rows (`selection` of `onSelectionChange`).
- `onSelectionChange?: (ids: readonly string[]) => void`: Makes the rows selectable, a checkbox each (`select:<id>`, and `select:all` for the rows of the page): called with the ids selected, also those of other pages.
- `bulk?: readonly BulkAction[]`: The actions on the selected rows (`list.bulk` of the spec), in a bar over them once a row is selected (`bulk:<id>`): the rows are selectable, the list keeping their selection unless `onSelectionChange` does.
- `compactColumns?: readonly string[]`: The columns of the table while it is next to an open card (`ListCardLayout`, `split`): the first two by default; the others are hidden (their cells stay, for the scenarios).

#### ListAction

`interface ListAction`: An action of the list, a button `action:<id>`; `add` shows it when the user may create, a custom action of the route set (`action_<name>`) when the backend lists it in `custom_actions` of the list.

- `id: string`
- `label: ReactNode`
- `onClick: () => void`
- `permission?: 'add' | CustomActionName`
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.

#### RowAction

`interface RowAction`: An action of a row, a button `action:<id>` in it, shown when the user may do it on the item.

- `id: string`
- `label: ReactNode`
- `onClick: (id: string) => void`
- `permission?: 'change' | 'delete'`

#### The types and the constants of `@/bazis/ui/resource-list`

- `FilterBarProps`: the props of `FilterBar`, listed with it
- `type FilterValues = Readonly<Record<string, string>>`: The values of the filters by field; a date range is `<field>__gte` and `<field>__lte`.
- `ResourceListProps`: the props of `ResourceList`, listed with it

## API: the components: screens, stat-card, state-panel, status-badge, status-history, task-progress, transit-bar

The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The components" for their `data-bz` and what they require).

### `@/bazis/ui/screens`

#### CreateFormAction

`CreateFormAction(props: CreateFormActionProps): Element`: The create form of an action in `FormSurface` (a dialog or a page, as the theme composes the forms), closed when it is saved or cancelled; its state is `CreateFormAction.use()`.


Its props, `CreateFormActionProps`:

- `open: boolean`
- `onClose: () => void`
- `path: CreatePath`: The route set of the entity (`ROUTES` of the contract).
- `fields?: readonly string[]`: The fields of the form (`fields` of the action); every field of the create schema by default.
- `initial?: Readonly<Record<string, unknown>> | undefined`: The values that the form starts with, which the user may change (`ResourceForm` `initial`).
- `title: ReactNode`
- `description?: ReactNode`
- `onSaved?: (saved: SavedDocument) => void`: Called with the saved document once the form is closed: the screen `then` of the action.
- `mode?: 'dialog' | 'page'`: `composition.forms` of the theme by default (`FormSurface`).

#### ScreenAction

`ScreenAction(props: ScreenActionProps): Element`: An action in the header of a screen (`actions` of `Screen` or of `Dashboard`), a button `action:<id>`, shown once the backend allows what it `requires`.


Its props, `ScreenActionProps`:

- `id: string`: The id of the action in the specs: `action:<id>`.
- `label: ReactNode`
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as an icon of lucide-react.
- `requires?: NavRequirement`: What the backend must allow the user for the action to be shown: `{path, can: 'add'}` for a create form.
- `onClick: () => void`

#### UpdateFormAction

`UpdateFormAction(props: UpdateFormActionProps): Element`: The update form of an item in `FormSurface` (a dialog or a page, as the theme composes the forms), closed when it is saved or cancelled; its state is `UpdateFormAction.use()`.


Its props, `UpdateFormActionProps`:

- `extends Omit<CreateFormActionProps, 'path' | 'initial'>`
- `path: UpdatePath`: The route set of the entity (`ROUTES` of the contract).
- `id: string`: The id of the item that it updates.

#### useDestroyCardAction

`useDestroyCardAction(options: DestroyCardActionOptions): DestroyCardAction`: The deletion of the item of a card, an action of `ResourceCard` (`actions`) shown when the user may delete it, run once confirmed in its dialog (once, whatever the clicks): a toast once it is deleted, then the route `then`; a toast of the error when the backend refuses it.

#### CreateForm

`interface CreateForm`: Whether the create form of a screen is open, and with which values: `CreateFormAction.use()`.

- `open: boolean`
- `initial: Readonly<Record<string, unknown>> | undefined`: The values that the form starts with, of the last `onOpenWith`; none after `onOpen`.
- `onOpen: () => void`: Opens the form: the `onClick` of an action (its event is not read).
- `onOpenWith: (initial: Readonly<Record<string, unknown>>) => void`: Opens the form starting with these values, which the user may change: the day of a calendar, `{due_date: day}`.
- `onClose: () => void`

#### DestroyCardAction

`interface DestroyCardAction`: The deletion of the item of a card: its action and the dialog that confirms it.

- `action: CardAction`: The action of `ResourceCard` (`actions`), shown when the user may delete the item: it opens the confirmation.
- `confirm: ReactNode`: The confirmation, rendered in the screen: the deletion runs from its button `action:confirm-<id>`.

#### DestroyCardActionOptions

`interface DestroyCardActionOptions`

- `id: string`: The id of the action in the specs: `action:<id>`, its confirmation `action:confirm-<id>`.
- `label: ReactNode`: The label of the action and of the button that confirms it.
- `title?: ReactNode`: The title of the confirmation, a question (`title` of the action): `Delete this item?` by default.
- `description?: ReactNode`: What the confirmation says (`description` of the action); that the deletion cannot be undone by default.
- `path: DestroyPath`: The route set of the entity (`ROUTES` of the contract).
- `item: string`: The id of the item of the card.
- `then?: string | undefined`: The route shown once the item is deleted (the screen `then` of the action); the card stays without it.

#### useCustomAction

`useCustomAction(options: CustomActionOptions): CustomAction`: A custom action of the specs, of the route set of `path` or of its items: what its buttons do, and the dialog of its fields or of its confirmation.

#### CustomAction

`interface CustomAction`: A custom action of a screen: its buttons, its run and its dialog.

- `action: { id: string; label: ReactNode; permission: CustomActionName; onClick: () => void; }`: The button of the card of its item (`ResourceCard` `actions`), or of the toolbar of a list for an action of the route set (`ResourceList` `actions`): shown when the backend lists it in `custom_actions` of the meta.
- `row: RowAction`: The button of the rows of a list (`ResourceList` `rowActions`): shown on a row that the list lets the user change (or delete) when the action requires it (`access_action`).
- `bulk: BulkAction`: The action on the selected rows of a list (`ResourceList` `bulk`, `bulk:<id>`), called on each with an empty body, on the rows that it lets the user change (or delete) as `row`, with the same rule of S032.
- `dialog: ReactNode`: Its dialog, rendered in the screen.

#### CustomActionOptions

`interface CustomActionOptions`

- `id: string`: The id of the action in the specs: `action:<id>`, its confirmation `action:confirm-<id>`.
- `label: ReactNode`: The label of its button, also the title of its dialog by default.
- `path: string`: The route set of the entity (`ROUTES` of the contract).
- `action: string`: The name of the custom action in its path (`escalate` of `<path><id>/escalate/`), as `custom_actions` of the contract has it.
- `target: 'item' | 'route'`: Whether it is the action of an item (`<path><id>/<action>/`: on a card, the rows and the selected rows of a list) or of the route set (`<path><action>/`: the toolbar of a list); a route set may have both under one name.
- `item?: string`: The item of a card, whose action it is; none on a list (a row or the selected rows give theirs).
- `fields?: readonly string[]`: The properties of the body that its dialog asks for, in this order; none by default (an empty body).
- `title?: ReactNode`: The title of its dialog: the label by default.
- `description?: ReactNode`: What its dialog says.
- `confirm?: boolean`: Whether an action without fields is confirmed in a dialog first.
- `message?: ReactNode`: What the toast says once it is done.

#### extended

`extended<P extends object>(props: P, added: ExtensionProps<P> | undefined): P`: The props of the component of a generated screen with those of its extension: the lists of actions and of tiles (`actions`, `rowActions`, `bulk`, `tiles`) by the `id` of their items, the records of the fields (`cells`, `values`, `display`) by field, the `children` and the `after` of a card of both, the generated ones first; the other props of the extension replace the generated ones (an undefined one too, but of a merged prop, which keeps the generated one).

#### ScreenExtension

`interface ScreenExtension<P extends object, M extends object = object>`: What a product adds to a screen generated from the specs (`export const extension` of `src/screens/<id>/extend.tsx`), the component of its primitive with props `P` (and `M`, the map of a list: `ScreenExtension<ResourceListProps, ResourceMapProps>`).

- `before?: ReactNode`: In the screen, before the component of its primitive (and the map of a list).
- `after?: ReactNode`: In the screen, after the component of its primitive (before the forms of its actions).
- `actions?: ReactNode`: In the header of the screen, after the actions of the specs: on every primitive, a dashboard too.
- `props?: ExtensionProps<P>`: Props of the component of the primitive, merged with those of the specs (`extended`): the lists of actions and of tiles by their `id`, the records of the fields by field, the `children` and the `after` of a card of both; the other props replace the generated ones.
- `map?: Partial<M>`: Props of the map beside a list (`list.map`), merged the same way.

#### The types and the constants of `@/bazis/ui/screens`

- `CreateFormActionProps`: the props of `CreateFormAction`, listed with it
- `ScreenActionProps`: the props of `ScreenAction`, listed with it
- `UpdateFormActionProps`: the props of `UpdateFormAction`, listed with it
- `type ExtensionProps<P extends object> = Partial<'tiles' | 'recent' | 'charts' extends keyof P ? Omit<P, DashboardScreenProps> : P>`: The props that an extension gives the component of its screen: any of them, but those of the screen for a dashboard, whose component is the screen.

### `@/bazis/ui/stat-card`

#### StatCard

`StatCard(props: StatCardProps): Element`: The number of the items that a filter selects, as a tile.


Its props, `StatCardProps`:

- `id: string`: The id of the tile in the specs: `tile:<id>`.
- `path: ListPath`: The route set whose items it counts (`ROUTES` of the contract).
- `filter?: Filter | undefined`: The items it counts (`filter` of the tile); every item that the user may view without.
- `label: ReactNode`
- `tone?: Tone`: The tone of the theme of its icon; neutral by default.
- `icon?: ComponentType<{ className?: string; }>`: Its icon, such as the icon of the entity (lucide-react).
- `onOpen?: () => void`: Opens what it counts (`open` of the tile): a click anywhere on it.
- `className?: string`

#### The types and the constants of `@/bazis/ui/stat-card`

- `StatCardProps`: the props of `StatCard`, listed with it

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

#### inDeclaredOrder

`inDeclaredOrder<T extends { id: string; }>(transits: readonly T[], declared: readonly DeclaredTransit[]): T[]`: The transits of the backend in the order of the specs, those that the specs do not declare after them.

#### payloadErrors

`payloadErrors(error: unknown, names: readonly string[], message?: (error: ErrorObject) => string): { fields: Record<string, string[]>; others: string[]; }`: The errors of a transit: those of the fields of its payload by name (`source.pointer` `/payload/<name>`, a name of `names`), and the others (its validators, a field that the dialog does not show, an error that is not of the backend), each the text that `message` gives (in the language of the interface with `useErrorMessage`).

#### useRunTransit

`useRunTransit(path: TransitPath, onDone?: (item: unknown) => void, declared?: readonly DeclaredTransit[]): TransitRun`: Runs the transits of the items of a route set (of an item, of the cards of a board); `onDone` gets the item after one (null when the user can no longer view it); those that `declared` confirms are asked for first.

#### DeclaredTransit

`interface DeclaredTransit`: A transit of the workflow of the specs (`workflow.transitions` of the entity, `transits` of the generated entities): their order is that of the transits shown, the first the main one; one with `confirm` is asked for before it runs.

- `id: string`
- `confirm?: boolean`

#### TransitRun

`interface TransitRun`: The run of the transits of the items of a route set: `start` one, the `dialog` of its payload or its confirmation to render.

- `start: (id: string, transit: Transit) => void`: Runs a transit of an item, once the dialog has its payload when it takes one.
- `mutation: ReturnType<typeof useItemsTransit>`
- `open: { id: string; transit: Transit; } | null`: The transit whose payload the dialog asks for, and its item; null while it is closed.
- `dialog: ReactNode`

#### TransitBar

`TransitBar(props: TransitBarProps): Element | null`: The transits of an item, with the dialog of their payloads.


Its props, `TransitBarProps`:

- `path: TransitPath`: The route set of the statusy model (`ROUTES` of the contract).
- `id: string`
- `transits?: readonly DeclaredTransit[]`: The transits of the workflow of the specs (`transits` of the generated entities): their order (the first the main button), and those confirmed first; the order of the backend by default.
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

`loginAs<P extends Product>(page: Page, product: P, role: Role<P>): Promise<App<P>>`: Opens the application as the test user of the role (`test_user` of spec/product.yaml, the password of the environment variable E2E_PASSWORD) through the login screen, the images of other origins stubbed (`stubForeignImages`), until the application has its logout (`action:logout`, also in a menu hidden at the width of a phone).

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
- `openItem(options: { where: Values; in?: string; created?: boolean; }): Promise<void>`: Opens the first item of the current screen whose cells `cell:<name>` have exactly these texts: a row of its list (`list:<entity>`; without one, an item `row:<id>` of the screen, of a board or a calendar), or of its last items `recent:<in>` (a dashboard): on the page shown, else searched with the search of the list (`field:$search`), each text of `where` in turn, else on the next pages (`action:next-page`) of the list without a search, or with more items of the columns of a board (`action:more`); fails when no page has it.
- `select(options: { where: Values; created?: boolean; }): Promise<void>`: Selects the row of the list of the current screen that `openItem` would open, its checkbox `select:<id>`, for a bulk action; the rows selected before stay selected.
- `bulk(id: string): Promise<void>`: Runs a bulk action of the list of the current screen on the selected rows, `bulk:<id>`, confirmed in its dialog (`action:confirm-bulk`), and waits until it is done (the action is no longer offered: the selection is cleared) or shows an error (`error:bulk`).
- `move(options: { where: Values; to: string; created?: boolean; }): Promise<void>`: Moves the item of the board of the current screen that `openItem` would open to the column of a status, by its menu (`action:move`, then `move:<status>`), confirmed in its dialog when the specs confirm the transit, and waits until it is in the column `column:<status>`; fails as soon as the move is refused (`error:move`, or another error shown), with the error.
- `action(id: string): Promise<void>`: Runs an action of the current screen, `action:<id>` (in the tab of a card that has it).
- `confirm(id: string, options?: { optional?: boolean; }): Promise<void>`: Confirms the action `<id>` of the current screen in its dialog, `action:confirm-<id>` (the deletion of the item of a card), and waits until the dialog is closed; the dialog must be shown, but with `optional` (a hand-written screen may run the action without a confirmation), where nothing is done when none is shown within 2 s.
- `fill(values: FormValues): Promise<void>`: Fills fields of the open form, `field:<name>`: a text, a number, a date; a select (a choice) by the label of its option, the native one of the browser or that of Radix (a combobox whose popup is its listbox), null by its option that clears the value (`data-value=""` in that of Radix); a combobox (the picker of a relationship) by the label of the item, searched in its popup, null by its option that clears the value; the picker of a to-many relationship by the list of the labels of its items, which replace those it had (`[]`: none); a checkbox, or a checkbox or a switch of Radix (`role`), by true or false; an input of a date or a date-time also by a day of the run (`today`, `today+1 10:30`: `dateOfRun`).
- `upload(field: string, file: string): Promise<void>`: Uploads a file (a path in `e2e/fixtures/`) into a file field of the open form, its input `field:<name>`, and waits until it is uploaded (the field `upload:<name>` is no longer busy, its `aria-busy` absent or `"false"`, and shows the name of the file) or shows an error of this upload.
- `submit(options?: { saved?: boolean; }): Promise<void>`: Submits the open form and waits until it is closed (saved) or shows an error of this submit (not one of a previous submit), which the next step expects (`expectError`, `expectState`).
- `transit(id: string, payload?: Values): Promise<void>`: Runs a transit of the item of the current screen, `transit:<id>`, with the values of its payload in its dialog, or confirmed in its dialog when the specs confirm it, and waits until it is done (the transit is no longer offered) or shows an error.
- `expectScreen(screen: ScreenId<P>): Promise<void>`: The current screen is this one: at its route (another screen may show next to it, such as a list next to its card), with its state rendered.
- `expectStatus(status: string): Promise<void>`: The item of the current screen has this status, `status:<id>`.
- `expectState(state: State): Promise<void>`: The page shows this state, `state:<state>` (a screen kept hidden next to it does not count).
- `expectActionAbsent(id: string): Promise<void>`: The current screen, once loaded, does not offer this action.
- `expectFieldReadonly(field: string): Promise<void>`: The user may not change the field: read-only (or not there) in the open form; on a card without a form, the card has no edit (`action:edit`), or its edit has the field read-only (the edit is opened and cancelled).
- `expectFieldAbsent(field: string): Promise<void>`: The user may not see the field: the current screen, once loaded, has no `field:<name>` (a card, the open form) and no cell `cell:<name>` (a list).
- `expectValues(values: Readonly<Record<string, string>>): Promise<void>`: The fields of the current card show these texts: the text of each `field:<name>` contains its text (a file: its name).
- `expectRows(count: number): Promise<void>`: The list of the current screen has this number of rows, `row:<id>`.
- `expectTile(id: string, count: number): Promise<void>`: The tile of the current dashboard counts this number of items, `tile:<id>` (its `data-value`).
- `expectDay(day: string, count: number): Promise<void>`: The day of the calendar of the current screen has this number of items, `day:<date>` (its `data-count`): the calendar (`calendar:<entity>`, the days it shows from `data-from` to `data-to`) is first moved to the period of the day (`action:previous-period`, `action:next-period`).
- `expectError(field: string): Promise<void>`: A field shows a validation error, `error:<name>`.
- `expectNotification(text: string): Promise<void>`: The user has a notification whose text contains this text, that came since this test started (its time, `<time datetime>`; one of a previous run does not count): the bell (`action:notifications`) opens the list of the notifications (`list:notifications`), which waits for it (`notification:<key>`), and is closed again.
- `language(code: string): Promise<void>`: Switches the language of the interface to a language of the backend (`LANGUAGES` of the contract): the button of the layout, `action:language`, until its `data-value` is the code.
- `search(text: string): Promise<void>`: Searches the list of the current screen (`field:$search`) and waits for its rows.

#### The types and the constants of `../bazis`

- `type Role<P extends Product> = keyof P['roles'] & string`: A role of the specs.
- `type ScreenId<P extends Product> = keyof P['screens'] & string`: A screen of the specs.
- `type Values = Readonly<Record<string, string | number | boolean | null>>`: The values of fields by name, scalars as in the specs.
- `type FormValues = Readonly<Record<string, string | number | boolean | null | readonly string[]>>`: The values of the fields of a form by name: a scalar, or the labels of the related items of a to-many relationship (a list, `[]` for none).
- `type State = 'loading' | 'empty' | 'loaded' | 'error' | 'forbidden' | 'not_found' | 'invalid'`: The states that the screens render (`state:<state>`).
- `LOGIN_ROUTE: "/login"`: The login screen of the template (`LoginForm`), where the router sends a user without a session.
