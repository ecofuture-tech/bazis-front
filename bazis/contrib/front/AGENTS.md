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

## Setup

`pip install bazis-front` (needs bazis 2.5.0 or newer) and add `"bazis.contrib.front"` to
`BS_INSTALLED_APPS`.

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

- the files of the template (`assets/template`), which the product owns from then on,
  among them `frontend/AGENTS.md`, the guide of the frontend for agents;
- the protocol client in `src/bazis/client/` and the React hooks in `src/bazis/react/`,
  each file stamped with `// bazis-front <version> asset <asset>` after its license header,
  and the same pristine copy in `.bazis/base/<asset>@<version>/` for the merge of later
  versions. The hooks of a package are copied only when the product has it at `init` (its
  app in `INSTALLED_APPS`, as the capabilities of the contract): with bazis-statusy the
  asset `react-statusy` in `src/bazis/react/statusy/`, with bazis-uploadable `react-uploadable`
  in `src/bazis/react/uploadable/`. A package installed after `init` has
  no hooks in the frontend until `bazis_front add react-statusy` (or a component that
  requires them) copies them: `check` reports it (`C003`);
- the components that the template uses, `state-panel`, `app-shell` and `login-form`, in
  the same way, with the shadcn/ui components they use (see [The components](#the-components));
- the helpers of the end-to-end tests in `e2e/bazis/` (the asset `playwright`, copied like
  the hooks), with `playwright.config.ts` and `e2e/custom/` of the template (see
  [The end-to-end tests](#the-end-to-end-tests));
- `bazis-front.lock.json`: the version of bazis-front, the hashes of the contract and of
  the generated files (see below), and the version and the file hashes of every copied
  asset (`"template"` has only its version); an asset that was not copied is not in it.
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

## The components

```bash
python manage.py bazis_front add resource-list resource-card resource-form   # the core
python manage.py bazis_front add status-badge status-history transit-bar     # with bazis-statusy
python manage.py bazis_front add file-field                                  # with bazis-uploadable
```

The components are the visual building blocks of the screens: React components on
shadcn/ui and Tailwind 4 over the hooks, in `frontend/src/bazis/ui/<component>/`
(`@/bazis/ui/<component>`). `add` copies them like `init` copies the hooks (stamped, with
their pristine copies in `.bazis/base/` and their hashes in the lock), with the assets
they require: the other components, the hooks, and the shadcn/ui components they use
(`button`, `input`, `label`, `native-select`, `table`, `badge`, `card`, `dialog`, `popover`,
`sheet`, `skeleton`) in
`src/components/ui/`, where `components.json` puts them. It needs neither the network nor
the shadcn CLI, and never changes `package.json`: the template declares every npm
dependency of the components (`radix-ui`, `class-variance-authority`, `lucide-react`, and
`@testing-library/react` with `jsdom` for their tests).

- A component of a package needs its capability in `contract/contract.json` (export the
  contract first): `transit-bar`, `status-badge` and `status-history` need `statusy`,
  `file-field` needs `uploadable`; `add` fails with the
  missing capability and copies nothing.
- An asset already in the frontend is kept as it is; `add` of it again does nothing when
  it is unchanged. `add` never overwrites: a component named again that was changed in the
  frontend, any asset it needs (also `client` and `react`) that the frontend has in another
  version of bazis-front, or a file of the product at the path of a copy (a shadcn/ui
  component added with the shadcn CLI) fail the command, and nothing is written. So after
  `pip install -U bazis-front`, `add` refuses until `bazis_front update` has brought the
  copies to the new version (see [Updating the copies](#updating-the-copies)).
- **The product owns the copies** and changes them freely (the look, the texts, the
  layout). Each component comes with its contract test, `<component>.contract.test.tsx`,
  run by `npm test` of the frontend: it checks the `data-bz` marks and the states that the
  scenarios of the specs rely on. Keep it passing when the component is changed.
- There is no generator of screens: the screens are written in `src/screens/<id>/` from
  their specs, composed from the components; the template's `AGENTS.md` shows how.
- No translations: the labels are the titles of the runtime schemas and the names of the
  statuses and transits in the language of the backend, and the props.
- They look as the design of the specs says (see [The design](#the-design)): the colors,
  radii and fonts are the tokens (Tailwind classes such as `bg-primary`, `text-muted-foreground`,
  `bg-success-soft text-success-ink`, never literal colors), the spacing is that of the
  density, and the navigation, the lists, the list with its card and the forms follow the
  composition of the preset (`THEME` of `src/bazis/generated/theme.ts`; a prop overrides it).
  The loading states are skeletons of what loads (still `state:loading`), the other states
  an icon with a title and a hint, and a change that succeeded shows a toast.

| Component | Props | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel({state, error?, message?, description?, onRetry?, inline?, skeleton?, children})`, `errorState(error)`, `queryState(query, empty?)`, `SkeletonLines`; `toast({title, description?, tone?})`, `Toaster` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell({title, navigation?: 'sidebar' \| 'topbar', items: [{screen, label, to, end?, icon?}], session: {user?, onLogout} \| null, children})`, `Screen({id, title?, description?, actions?, children})`, `ListCardLayout({list, mode?})`, `useBesideCard`, `initColorMode`, `ColorModeToggle`, `useScreenPage` | `nav:<screen>`, `screen:<id>`, `action:logout` | |
| `login-form` | `LoginForm({onLogin?(credentials), methods?: [{id, label, onLogin(signal)}], onSuccess?, title?, description?})`: the password form with `onLogin`, a button per method (a login in a window, with a cancel while it waits) | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource-list` | `ResourceList({path, entity, columns, filters?, sort?, search?, pageSize?, onOpen?, selected?, actions?: [{id, label, onClick, permission?, icon?}], rowActions?, cells?, emptyMessage?, layout?: 'table' \| 'cards', compactColumns?})` | `list:<entity>`, `row:<id>` with its cells `cell:<column>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>`, `field:$search`, `action:<id>`, `action:prev-page`, `action:next-page` | |
| `resource-card` | `ResourceCard({path, id, sections: [{id, title?, fields}], title?, badge?, edit?, actions?, values?, children?: node \| (item) => node, forms?: 'dialog' \| 'page'})` | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>` | |
| `resource-form` | `ResourceForm({path, id?, fields?, onSaved?, onCancel?, submitLabel?})`, `FormSurface({open, onClose, title, description?, mode?: 'dialog' \| 'page', children})` | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge({resource})` (in the tone of its status), `statusOf`, `statusName`, `statusOptions`, `statusTone`, `transitName`, `transitTarget` | `status:<id>` | `statusy` |
| `status-history` | `StatusHistory({resource, label?})`: the status since `status_dt`, by `status_author` | none | `statusy` |
| `transit-bar` | `TransitBar({path, id, onDone?})` | `transit:<id>`, `state:<loading\|error\|forbidden>`; in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | `statusy` |
| `file-field` | `FileFieldProvider({accept?: {field: types}, maxSize?, children})`: `FileField` becomes the control of the file fields of `FieldInput` (the forms); `FileField(props)`, `accepts(file, accept)`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads), its errors `error:<name>` | `uploadable` |

They read what the backend reports and decide nothing: `state-panel` maps the errors of the
backend to the states (401 and 403 `forbidden`, 404 `not_found`, 422 `invalid`, else
`error`) in one place; the fields, their titles and what is read-only come from the
runtime schemas; an action with a `permission` (`add` on a list, `change` or `delete` on a
row or an item) is shown when the permission meta of bazis-permit allows it, and always
when the backend does not report the meta. The shared parts are the asset `resource`
(`FieldInput`, the only input of a field: the forms and the payloads of the transits use
it; `FieldValue`, `RelationLabel`, `RelationPicker`, `FileValue`, `FilesProvider`,
`permitted`) and `testing` (the support of the contract tests). `assets/ui/README.md` of
the package documents each component.

- **Field permissions** (bazis-permit, `<app>.<model>.field.<operation>.<selector>[.<status>]
  .<field>.<restriction>`: `enable`, `readonly`, `disable`…) are read from what the backend
  returns for the current user and the item, never from the roles: a field the user may not
  see is absent from `schema_retrieve/` of the item and from the documents; one they may
  see but not change now is `readOnly` in `schema_update/` of the item. `ResourceCard`
  shows only the fields of `schema_retrieve/` (and leaves out a section without any) and,
  when the user may change the item, marks read-only the fields its update does not
  change; `ResourceForm` leaves out the fields its schema does not have and disables the
  read-only ones; `ResourceList` shows a column when a row of the page has its field (the
  schema of a list is the union of the field sets of the groups of permissions: its first
  member has every field). Check them in the scenarios with `expect: {field_readonly}` and
  `expect: {field_absent}`.
- **Relationships**: `RelationPicker` (a to-one relationship in a form, a payload, a filter)
  is a combobox that searches the related resource on the backend (`search`) page after
  page (`Load more`) and clears a nullable value; `RelationLabel` shows a related item, the
  items of a resource shown together (the rows of a page) read with one request
  (`useRelatedItem`, `filter=pk=<a>|pk=<b>|…`). Both need the route of the related resource
  in `ROUTES`; the user sees the items its list returns to them. To-many relationships are
  shown, not edited, by the components: change them with `useRelationship`.
- **Files** (bazis-uploadable): a model references an uploaded file with a foreign key to
  `uploadable.FileUpload`; its field is a to-one relationship to `uploadable.file_upload`
  (a resource of `resources` of the capability `uploadable`), `type: file` in the specs.
  `FieldValue` shows it (`FileValue`: a link to the file with its size, a thumbnail of an
  image, read with the retrieve of the route set) in the cards and the lists. In the
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
- **Protect the route set of the uploaded files.** The frontend needs only its create (the
  upload) and its retrieve (the file of a field). `FileUpload` has no owner: a list, an
  update or a delete open to every user gives each one the files of the others (their ids
  are integers), and the bundled `FileUploadRouteSet` has no access control at all
  (`uploadable.W001`). Register a subclass that requires a user, without the update and the
  delete and with a list that returns no file (as the sample does: `actions =
  ['action_create', 'action_retrieve', 'action_list']` and `get_queryset_for_list()` that
  returns `.none()`; the core needs the list of the route set of a related model for the
  filter fields of the models that reference it, `route_filter_fields/`), or with the
  permissions of bazis-permit on a model of your own (`FileUploadAbstract` with an owner).
  The section `uploadable` lists only the route sets with their create.
- **The status history** (`StatusHistory`) is what bazis-statusy exposes: the current
  status with `status_dt` and `status_author`. bazis-statusy records every transit
  (`<Model>StatusyTransit`) but has no endpoint that reads them, so the earlier transits
  are not shown.

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
    "authing": {"auth_url": "/api/v1/authing/auth/", "token_param": "bazis_auth",
                "actions": [{"code": "password", "name": "Login/Password", "method": "POST",
                             "url": "/api/v1/authing/password/"}]},
    "uploadable": {"max_size": null, "resources": ["uploadable.file_upload"]},
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
  `INSTALLED_APPS`: `users` (the token endpoint, the resource of the user model), `authing`
  (the auth endpoint of bazis-authing, null when it is not routed; the login actions of
  the services of `BAZIS_AUTH_KINDS` as the endpoint lists them in `meta.actions`, in the
  order of the setting, without those whose route is not registered; the query parameter
  of the store token, `BAZIS_AUTH_COOKIE_NAME`), `uploadable` (`max_size`, the
  `BAZIS_FILE_UPLOAD_MAX_SIZE` of an upload in bytes, null for no limit; `resources`, the
  JSON:API types of the route sets of `FileUploadRouteSet` and its subclasses: a to-one
  relationship to one of them is a file), `permit`
  (the roles with the slugs of their permission groups and their effective permissions:
  the union of the permissions of the groups, as bazis-permit checks them for the current
  role of a user; a role has no permissions of its own), `statusy` (per statusy model: the
  initial status, the statuses of its transits, the transits with the JSON Schema of the
  payload they require, `null` without one). Names are in `LANGUAGE_CODE`; lists are
  sorted.

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

The specs of the sample of this package (its roles, statuses and transits are those of
its tests):

```yaml
# yaml-language-server: $schema=./schema/product.schema.json
spec: bazis-product/1
product: {id: tasks, name: Tasks, summary: The tasks of a team}
packages: [users, authing, permit, statusy, uploadable]   # each needs its section in the contract
roles:
  - {id: manager, permit: manager, title: Manager, test_user: {username: manager}}
  - {id: viewer, permit: viewer, title: Viewer, test_user: {username: viewer}}
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

- **Fields** are those of the resource in the API (`fields` of contract.json), with `type`
  (`string`, `text`, `integer`, `number`, `boolean`, `date`, `datetime`, `time`, `json`,
  `file`) or `relation` (the id of an entity) and `many`. A `file` is a to-one
  relationship to a resource of the uploaded files of bazis-uploadable (`resources` of the
  capability `uploadable`; P013 otherwise): declare such a relationship as a `file`, not as
  a `relation`; it needs no entity. A payload of a transit has no `file`. What is required, writable or
  visible for the current user is not in the spec: the runtime schemas of the backend
  decide it.
- **Workflow**: the statuses and the transits of bazis-statusy; a transit has one `from`
  (a Transit row has one source status), and `payload` when an action of the transit takes
  a typed payload. The ids are those of the Status and Transit rows, including those that
  bazis-statusy generates for a Transit created without one (`task#draft_to_done`,
  `task#draft_to_done#1`); any characters but `.` and white space.
- **Access** says what a role may do; it is compiled to permissions of bazis-permit that
  the permit role of the role must have (through its permission groups). An operation
  (`view`, `add`, `change`, `delete`) takes a selector: `all`, `none` (not granted, as an
  absent operation), `self` (the object is the selector source itself, such as the user),
  a relationship that links the object to the user (`author`, `org_owner`) or a path of
  relationships to it (`parent__author`); on a statusy model also `{selector, statuses}` to grant it only in these statuses.
  `transit` is a list of transits (selector `all`) or `{transit: selector}`. The
  permissions, as bazis-permit and bazis-statusy name them:

  | Access | Model without statuses | Statusy model |
  |---|---|---|
  | `view: all` | `app.model.item.view.all` | `app.model.item.view.all.all` |
  | `change: author` | `app.model.item.change.author` | `app.model.item.change.author.all` |
  | `change: {selector: all, statuses: [draft]}` | | `app.model.item.change.all.draft` |
  | `transit: [finish]` | | `app.model.item.transit.all.in_progress.finish` (the source status of the transit) |

  A permission of the role with the selector `all` covers any selector, and the status
  `all` any status. Missing permissions are errors (P019); permissions the role has beyond
  the access are not reported (the absence of an operation is what the scenarios check,
  with `expect: {action_absent: ...}`). A selector whose relationships are not in the
  contract is a warning (P020; each hop is checked while the contract has the related
  resource).
- **Scenarios** are the end-to-end tests of the product: steps over the screens, each one
  key: `open: <screen>`, `open_item: {where: {field: value}}` (a row of the current list,
  which opens the screen of its `list.open`), `action: <action of the screen>`,
  `fill: {field: value}` and `upload: {field, file}` (in the open form, or on a card with
  `edit: true`; a `file` field is uploaded, a file of `e2e/fixtures/` of the frontend,
  never filled: P022), `submit: {}`, `transit: <id>` or `{id, payload}` (on a card with
  `transitions: true`), `expect` with `screen`, `status`, `state`, `action_absent`,
  `field_readonly`, `field_absent` (a field the screen shows that the user may not see:
  not on the screen once it is loaded), `values` (`{field: text}`: the fields of the
  current card, without an open form, show these texts; a file its name), `rows`,
  `error`. The validator follows the steps from screen to screen
  and checks each against the screen it acts on: `open` takes a screen without an item in
  its route (an item is reached with `open_item` or the `then` of a form), a form with
  `fields` is filled only in them, `action_absent` names an action of the screen and
  `field_absent` a field it shows (a column, a field of a section or of the open form). A
  `submit` followed by an `expect` with `error` fails: its form stays open on its screen
  (no `then`), and the next steps fix it and submit again. Only an `error` marks a failing
  submit: `expect: {state: invalid}` after a submit still follows the `then`. When the
  product logs in (`packages` has `users`), the role of a scenario has a `test_user`, the
  user its end-to-end test logs in as (P025) with its password: with bazis-authing, through
  its service `password` (P026). `bazis_front e2e` turns each scenario into a
  Playwright test (see [The end-to-end tests](#the-end-to-end-tests)).

### `spec/screens/<id>.yaml` (`spec: bazis-screen/1`)

```yaml
# yaml-language-server: $schema=../schema/screen.schema.json
spec: bazis-screen/1
id: task-list                    # the name of the file
title: Tasks
route: /tasks
entity: task
roles: [manager, viewer]         # the navigation and the scenarios; the backend decides access
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

A `form` screen has `form: {mode: create | update, fields, then}`. Actions are `form`
(`mode: create` on a list or a card, `mode: update` on a card) and `destroy` (on a card).
The states that a primitive must render are required: list `loading, empty, error,
forbidden`; card `loading, error, forbidden, not_found`; form `loading, error, forbidden,
invalid`.

**`data-bz`**: the screens mark their elements, and the scenarios act through them:
`screen:<id>`, `state:<loading|empty|loaded|error|forbidden|not_found|invalid>`,
`list:<entity>`, `row:<id>` (its cells `cell:<column>`), `field:<field>`,
`error:<field>`, `upload:<field>` (a file field, `aria-busy` while its file uploads; the
input of the file is its `field:<field>`), `action:<id>`, `transit:<id>`, `status:<id>`,
`nav:<screen>`.

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

### The issues

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
| `P020` | warning | a selector of `access` is not a relationship (or a path of relationships) of the resource in the contract |
| `P021` | error | a scenario step references an unknown screen |
| `P022` | error | a scenario step is not possible on the current screen |
| `P023` | error | a scenario step references a field that the entity of the screen does not declare |
| `P024` | error | a scenario step references an unknown status or transition, or its payload differs |
| `P025` | error | the role of a scenario has no `test_user`, and the product logs in (`packages` has `users`) |
| `P026` | error | the scenarios log in with a password, and the bazis-authing of the contract has no service `password` |
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
| `D001` | error | a design file is not valid YAML or JSON |
| `D002` | error | spec/design/theme.yaml does not follow design.schema.json |
| `D003` | error | spec/design/tokens.json does not follow tokens.schema.json |
| `D004` | error | a token references an undefined token, or references itself through other tokens |
| `D005` | error | a token required by the preset is undefined or of another type |
| `D006` | error | a token references a token of another type |
| `D007` | error | a token of the dark mode (the group `dark`) overrides no token of the same name and type |
| `D008` | warning | a status of `statuses` in theme.yaml is not a status of the contract |
| `D009` | warning | a text color has a contrast below 4.5:1 (WCAG AA) on its background, in the light or the dark mode |

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

**Brand.** Change `color.primary` and `color.primary-foreground` (and their values of the
dark mode): the focus rings, the current link, the selected row and the soft tints are
derived from the primary in CSS (`color-mix`), so one color brands the product. The starters
are OKLCH (`oklch(L C H)`): keep the lightness and the chroma of the starter and change the
hue for a consistent brand; `check` reports a text color that loses its contrast (D009). Set
`radius` for the shapes and `density` for the spacing. The fonts are system stacks by
default; for a web font, load it in `index.html` (a `<link>` of Google Fonts) or with an npm
package of the font imported in `src/main.tsx`, and put its name first in `font.body` (or
`font.heading`): `["Inter", "ui-sans-serif", "system-ui", "sans-serif"]`.

**Dark mode.** The tokens of the group `dark` are the values of the dark mode: each
overrides the token of the same name (`dark.color.background`; D007 when there is none of
that name and type), the others keep their value. The theme applies them to the class `dark`
of `<html>` and, until the application starts, to a dark system (unless `<html>` has the
class `light`); `initColorMode()` of `app-shell` (called by `src/main.tsx`) sets the class
from the choice of the user (system, light or dark, kept in the storage of the browser, the
button of `AppShell`). Without the group `dark` there is no dark mode (`THEME.dark` is false).

**Statuses.** `statuses` of `theme.yaml` gives each status of bazis-statusy a tone, by the
id of the status: bazis-statusy has one table of statuses for every model, so an id is the
same status everywhere (`draft` of the tasks is `draft` of the orders). It
draws the `StatusBadge` in the soft colors of the tone, the transits to a status of the tone
`danger` are destructive buttons; a status without a tone is `neutral`.

## The end-to-end tests

```bash
python manage.py bazis_front e2e           # frontend/e2e/generated/ from the scenarios of spec/product.yaml
python manage.py bazis_front e2e --check   # write nothing; exit 1 if the generated tests are stale
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
- **The generated tests are never edited**: change the scenario and generate again. Tests
  of your own go to `frontend/e2e/custom/`, with the same helpers.
- The helpers, `frontend/e2e/bazis/` (the asset `playwright`, copied by `init` like the
  hooks, not edited), act only through the `data-bz` marks of the screens and wait on their
  states (until no `state:loading` is left), never for a fixed time. Each step of a
  scenario is a `test.step` titled with the step:

  | Step | Calls |
  |---|---|
  | the `role` | `loginAs(page, PRODUCT, role)`: logs in on `/login` (`LoginForm`) as the `test_user` of the role with the password of `E2E_PASSWORD`; no login without bazis-users |
  | `open: <screen>` | `open(screen)`: the route of the screen, then `expectScreen` |
  | `open_item: {where}` | `openItem({where})`: the first `row:<id>` of the page whose cells `cell:<name>` have exactly these texts; then `expectScreen` of `list.open` |
  | `action: <id>` | `action(id)`: `action:<id>` of the current screen; then `expectScreen` of the `then` of a destroy |
  | `fill`, `upload` | `fill(values)` (a select by the label of its option, the picker of a relationship by the label of the item, searched in its popup, a checkbox by true or false), `upload(field, file)` (a file of `e2e/fixtures/` of the frontend into the input `field:<field>`; waits until `upload:<field>` is no longer busy and shows the name of the file, or an error is shown) in the open form, the `<form>` with `action:submit`; on a card with `edit: true` whose edit is not open, `action('edit')` first |
  | `submit: {}` | `submit()`: waits until the form is closed or shows an error of this submit; then `expectScreen` of the `then` of the form, unless the next step expects an `error` (a failing submit: the form stays open) |
  | `transit` | `transit(id, payload?)`: `transit:<id>`, the payload in its dialog; waits until it is no longer offered or an error is shown |
  | `expect` | `expectScreen` (the mark of the screen and its route, since a list may show next to its card), `expectStatus`, `expectState` (a visible one), `expectActionAbsent`, `expectFieldReadonly`, `expectFieldAbsent`, `expectValues` (the text of `field:<name>` of the screen contains the value), `expectRows`, `expectError` (a visible one), in this order |

  The screen after a step is the one that `check` follows (the `then` of a form or a
  destroy, the `list.open` of `open_item`): `check` and the generator read the steps with
  the same code (`spec/scenarios.py`). `expectFieldReadonly` passes when the open form has
  the field read-only or disabled (or not at all), and on a card when it has no edit or its
  edit has the field read-only (it opens the edit and cancels it).
- **The test data is the job of the backend.** Before `npm run e2e`, its database has the
  roles, statuses and transits of the specs, a user per `test_user` with its role (in
  `roles` and `role_current`) and the password of `E2E_PASSWORD`, and the items that the
  scenarios open (`open_item`). Create them with a management command or a fixture of the
  product (the sample of this package: `manage.py sample_data`, which also sets the password
  of the test users again when it runs again). The scenarios share the database and run one
  at a time (`playwright.config.ts`); none should depend on another: a scenario opens an
  item that the test data creates, or one it creates itself.
- `npm run e2e` starts the dev server of the frontend (its `/api` goes to `BAZIS_API_URL`)
  unless `E2E_BASE_URL` names a running frontend; the backend runs separately. In CI, an
  HTML report is written to `frontend/playwright-report/`.

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
version requires, and copies of the JSON Schemas in `spec/schema/` that differ. For each
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
| unchanged | removed it | deletes it |
| changed | removed it | keeps it: the product's from now on |

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
- **The template is the product's** (`package.json`, `vite.config.ts`, `src/app/`,
  `src/screens/`, `AGENTS.md`, …): `update` never changes it, and the lock keeps the
  version of `init` for it. It prints the npm dependencies whose versions in the
  `package.json` of the new template differ from those of `frontend/package.json`
  (`dependencies react: 19.2.0 -> 19.3.0`): bump those that the new copies need and run
  `npm install`.
- The theme is generated, not copied: run `bazis_front design` after `update` (`front.W005`
  reports a theme that the new version renders otherwise). A frontend made before the design
  layer has no theme: run `bazis_front design`, replace the variables of `:root` and `.dark`
  of its `src/index.css` with `@import './bazis/generated/theme.css';` (after the imports of
  Tailwind), and call `initColorMode()` of `@/bazis/ui/app-shell` in `src/main.tsx` before the
  render, as the new template does.

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
then `npx tsc --noEmit` (it reports a marker left behind, `TS1185`), `npm run lint` and
`npm test` (the contract tests of the components) in `frontend/`. Commit the frontend with
`.bazis/` and the lock. The client, the hooks and the helpers are never edited, so they
are replaced without conflicts; wrap them in the product code instead.

## Layers

| Layer | What | In the product |
|---|---|---|
| 0. Contract | the OpenAPI, `contract.json`, `contract.ts` and the TypeScript types of the API | `contract/`, `frontend/src/bazis/generated/`, only generated |
| 1. Protocol | the client (`assets/client`) | `frontend/src/bazis/client/`, copied by `init`, not edited |
| 2. Hooks | React hooks over the client and TanStack Query (`assets/react`) | `frontend/src/bazis/react/`, copied, not edited |
| 3. Components | visual building blocks on shadcn/ui (`assets/ui`) | `frontend/src/bazis/ui/` (and `src/components/ui/`), copied by `init` and `add`, owned by the product |
| 4. Specs | product, screens and design specs | `spec/`, validated against the contract by `bazis_front check`; its scenarios generate the end-to-end tests (`bazis_front e2e`, `frontend/e2e/generated/`) run with the helpers of `frontend/e2e/bazis/`; its design generates the theme (`bazis_front design`, `frontend/src/bazis/generated/theme.*`) |
| App | the template (`assets/template`): providers, session, router, errors, screens | `frontend/`, copied once by `init`, owned by the product |

## Rules

- **Generate the contract, never write it.** `contract/` and
  `frontend/src/bazis/generated/` come from `manage.py bazis_front contract`. Generate
  them again after every change of the backend and fix what the compiler reports; do not
  edit the generated files and do not declare resource types by hand.
- **Describe the product in `spec/` and keep `bazis_front check` green.** Build the
  backend to satisfy the specs (models, route sets, roles with their permissions, statuses
  and transits), export the contract, and fix every issue that `check` reports, in the spec
  or in the backend, as its hint says.
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
  the backend with its test data; write the other tests in `frontend/e2e/custom/`.

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
  of an item from its runtime schema `schema_update` (`useResourceForm`, `useSchema`).
- Log in with `api.login()` and keep the token in the application; the client reads it
  through the `token` option on every request. With bazis-authing the template logs in
  with `api.auth()`, `api.authLogin()` and `api.authWait()` (see
  [Logins with bazis-authing](#logins-with-bazis-authing)).
- Upload a file with `api.upload(path, file, {name?, onProgress?, signal?})` (or
  `useUpload`): a multipart `POST` to the route set of the uploaded files, with
  XMLHttpRequest for its progress.

## The hooks

React hooks over the client and TanStack Query 5, in `src/bazis/react/` of the frontend
(`assets/react/README.md` of the package documents them in full; `frontend/AGENTS.md` has
examples):

```tsx
import { ROUTES } from '@/bazis/generated/contract';
import { useList, useResourceForm } from '@/bazis/react';
import { useTransit, useTransits } from '@/bazis/react/statusy';   // with bazis-statusy
import { useUpload } from '@/bazis/react/uploadable';             // with bazis-uploadable

const list = useList(ROUTES['tasks.task'], { sort: ['-dt_created'], page: { limit: 20 }, meta: ['pagination'] });
const form = useResourceForm(ROUTES['tasks.task'], { id });          // without id: a create
const transits = useTransits(ROUTES['tasks.task'], id);               // [{id, allowed, restricts, payload}]
const upload = useUpload(ROUTES['uploadable.file_upload']);           // upload(file) -> the item; progress, abort
```

- `useList`, `useItem`, `useSchema`, `useFilterFields` read; `useCreate`, `useUpdate`,
  `useDestroy`, `useRelationship` change and then refetch every query of the resource
  (`['bazis', path]`).
- `resourceSchema(schema)` reads the fields of a runtime schema (of a create, an update, a
  retrieve or a list: name, title, type, format, choices, read-only, the related resource)
  and `objectFields(schema)` those of the JSON Schema of an object, such as the payload of
  a transit; the components render them.
- `useResourceForm(path, {id?})` takes its fields from `schema_create`/`schema_update`
  (those of the current user: type, required, read-only, nullable, choices, the
  related resource of a relationship), its values from the defaults or the item, and
  submits the changed attributes and to-one relationships as one document; a 422 gives
  `errors` by field. To-many relationships go through `useRelationship`.
- `useTransits(path, id)` reads `meta.state_actions` of the item: the transits the user may
  run now, `allowed` unless a validator restricts them, with the JSON Schema of their
  payload. `useTransit(path, id)` runs one; null when the user can no longer view the item.
- `useUpload(path)` uploads one file at a time to a route set of the uploaded files:
  `upload(file, {name?})` resolves to the created item (null when aborted), with `status`
  (`idle`, `uploading`, `success`, `error`), `progress` (`{loaded, total}` while it uploads),
  `error`, `abort()` and `reset()`; it refetches the queries of the route set.
- The template clears the query and mutation caches when the user changes, and every query
  key ends with the session of `BazisProvider` (a number that changes at every login and
  logout), so the data of one user is never shown to another, even from a request still
  running.

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
   `<url>?<token_param>=<store>` (the service returns to the auth endpoint in that window)
   and asks the auth endpoint with the store token every 1.5 s until it is signed in, has an
   error (`GOOGLE_AUTH_ERROR`), or has expired (`BAZIS_AUTH_COOKIE_LIFETIME`: the endpoint
   answers with another store) or the user closes the window (the store is asked once
   more); the login screen offers a cancel meanwhile. The services
   with another body than the password (an own service) are not offered.

The client sends these requests without cookies (`credentials: 'omit'`): the endpoint sets
the store token as a cookie, and a store that is signed in would sign the next user in as
the previous one until it expires. The store token is kept only during the login. Without
the service `password` the login screen has no username and password, and the end-to-end
tests cannot log in (P026).

## Protocol facts that are easy to get wrong

- The list filter is one `filter` expression (`price__gte=10&(state=new|state=draft)`),
  not `filter[name]=value`.
- `include` works on retrieve, create and update; list ignores it. The items of a list by
  their ids are `filter=pk=<a>|pk=<b>|…`: there is no `pk__in`, and `pk=<a>,<b>` is one
  value (a 400 `ERR_FILTER` on a UUID). `<app>.<model>=<ids>` filters the objects related to
  those objects of another model, not by their own ids.
- With bazis-permit, the schema of a list (`schema_list/`) is the union of the field sets of
  the groups of field permissions (its first member has every field): which fields a user
  sees is in the items, which leave out the hidden ones. The schemas of an item
  (`schema_retrieve/`, `schema_update/`) are those of the user for this item.
- Pagination is `page[limit]` and `page[offset]`; sorting is `sort` with `-` for
  descending; meta fields such as `pagination` are returned only when requested with
  `meta`.
- Validation errors are 422 with `errors[].source.pointer` such as `/attributes/name`.
- An uploaded file (bazis-uploadable) is the multipart create of its route set (`file`,
  optional `name`), not a JSON:API document; the response is the item with `file` (the URL
  of the file in the storage: the path of `MEDIA_URL` for the file system, which the API
  redirects to `MEDIA_HOST_URL`), `name`, `extension`, `size`. A model references it by a
  to-one relationship, set to its id in the document of a create or an update. A file larger
  than `BAZIS_FILE_UPLOAD_MAX_SIZE` is a 413 `ERR_FILE_TOO_LARGE`, checked after the whole
  body is received. bazis-uploadable does not restrict the types and never deletes a
  replaced file from the storage.
- The `id` of an item of a model with an integer primary key (`FileUpload`) is a JSON number
  in its documents, a string in the relationships that reference it: compare them as
  strings.
