# Frontend — guide for AI agents

The frontend of this product: React 19, TypeScript (strict), Vite 7, React Router 7,
TanStack Query 5, Tailwind 4 with shadcn/ui. It was created by
`manage.py bazis_front init` of bazis-front: its contract with the backend is generated
from the backend, its protocol client, its React hooks and its components are copied from
bazis-front. The
backend, its contract and the specs of the product are one directory up (`manage.py`,
`contract/`, `spec/`).

## Layers

| Path | What | Changed by |
|---|---|---|
| `src/bazis/generated/` | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API) | only `manage.py bazis_front contract` |
| `src/bazis/client/` | the client of the Bazis protocol | bazis-front; not edited, wrapped in `src/app/` |
| `src/bazis/react/` | the React hooks over the client and TanStack Query (`@/bazis/react`); `statusy/` (`@/bazis/react/statusy`) when the backend has bazis-statusy | bazis-front; not edited |
| `src/bazis/ui/<component>/` | the components (`@/bazis/ui/<component>`), each with its contract test; `init` copies `state-panel`, `app-shell`, `login-form`, `manage.py bazis_front add` the others | the product, keeping the contract tests passing |
| `src/app/` | providers (query cache, `BazisProvider`), session, router (the layout and the navigation), errors | the product |
| `src/screens/<screen>/` | the screens, composed from the components | the product |
| `src/components/ui/`, `src/lib/` | shadcn/ui components: those of the components copied by bazis-front, others with `npx shadcn add <name>` | the product |
| `../spec/` | the specs: `product.yaml` (roles, entities, access, scenarios), `screens/<id>.yaml`, `design/` | the product; checked by `manage.py bazis_front check` |
| `bazis-front.lock.json`, `.bazis/base/` | the versions and hashes of the contract, of the generated files and of the copied assets; the pristine copies of the assets | bazis-front; commit them |

## Commands

From the product root, after every change of the models, routes, roles, statuses or
transits of the backend (with a migrated database):

```bash
python manage.py bazis_front contract          # contract/, src/bazis/generated/, the lock
python manage.py bazis_front contract --check  # write nothing; exit 1 if anything is stale (CI)
python manage.py bazis_front check             # the specs against the contract; exit 1 on errors
python manage.py bazis_front add resource-list  # copy a component with what it requires
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
  `src/screens/<id>/` with the route of its spec, from the components (below), and render
  every state that it lists.
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
  `ApiError.fieldErrors()`, as `FieldInput` does), any other error and the state it puts a
  screen in with `StatePanel` of `@/bazis/ui/state-panel` (`errorState(error)`: 401 and 403
  `forbidden`, 404 `not_found`, 422 `invalid`, else `error`), the only mapping of the
  errors of the backend; the components and the `ErrorBoundary` of `src/app/errors.tsx`
  use it.
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

## Screens from the components

The screens are written here, from their specs; nothing generates them. Compose them from
the components of `src/bazis/ui/` (the guide of bazis-front, `bazis/contrib/front/AGENTS.md`
of the installed package, lists their props and their `data-bz`):

| Spec | Component |
|---|---|
| a screen (`screen:<id>`, its title, its actions) | `Screen` of `@/bazis/ui/app-shell`; the layout, the navigation (`nav:<screen>`, `navigation` of `spec/design/theme.yaml`) and the logout are `AppShell` in `src/app/router.tsx` |
| `primitive: list` (`columns`, `filters`, `sort`, `search`, `open`) | `ResourceList` of `@/bazis/ui/resource-list` |
| `primitive: card` (`sections`, `edit`, `transitions`) | `ResourceCard` of `@/bazis/ui/resource-card`, with `StatusBadge` and `TransitBar` of `@/bazis/ui/status-badge` and `@/bazis/ui/transit-bar` (bazis-statusy) |
| `primitive: form`, an action `primitive: form` | `ResourceForm` of `@/bazis/ui/resource-form` (`fields`, then `onSaved` for `then`) |
| an action `primitive: destroy` | an action of the card (`permission: 'delete'`) calling `useDestroy` |
| `states` | the components render them (`state:<state>`); `StatePanel` of `@/bazis/ui/state-panel` for a screen of your own |

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useDestroy } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceCard } from '@/bazis/ui/resource-card';
import { ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';
import { TransitBar } from '@/bazis/ui/transit-bar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TASKS = ROUTES['tasks.task'];

// spec/screens/task-list.yaml
export function TaskListScreen() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <Screen id="task-list" title="Tasks">
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'assignee', 'dt_created']}
        filters={[{ field: 'status', options: statusOptions('tasks.task') }, 'assignee']}
        sort={['-dt_created']}
        search
        onOpen={(id) => void navigate(`/tasks/${id}`)}
        actions={[{ id: 'create', label: 'Create', permission: 'add', onClick: () => { setCreating(true); } }]}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>The task is created as a draft.</DialogDescription>
          </DialogHeader>
          <ResourceForm
            path={TASKS}
            fields={['title', 'assignee']}
            onSaved={(saved) => void navigate(`/tasks/${saved.data.id}`)}
            onCancel={() => { setCreating(false); }}
          />
        </DialogContent>
      </Dialog>
    </Screen>
  );
}

// spec/screens/task-card.yaml
export function TaskCardScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const destroy = useDestroy(TASKS);
  return (
    <Screen id="task-card" title="Task">
      <ResourceCard
        path={TASKS}
        id={id}
        edit
        sections={[{ id: 'main', fields: ['title', 'status', 'assignee'] }, { id: 'report', title: 'Report', fields: ['report'] }]}
        badge={(item) => <StatusBadge resource={item} />}
        actions={[{
          id: 'delete', label: 'Delete', permission: 'delete', variant: 'destructive',
          onClick: () => { destroy.mutate(id, { onSuccess: () => void navigate('/tasks') }); },
        }]}
      >
        {/* null: the user can no longer view the item */}
        <TransitBar path={TASKS} id={id} onDone={(item) => { if (item === null) void navigate('/tasks'); }} />
      </ResourceCard>
    </Screen>
  );
}
```

Add the routes of the screens to `src/app/router.tsx` (inside `RequireSession`) and their
links to `NAVIGATION` there.

- **The components are the product's.** Change their look, texts and layout in
  `src/bazis/ui/` as the product needs; keep `npm test` passing: the contract test of a
  component (`<component>.contract.test.tsx`) checks the `data-bz` marks and the states
  that the scenarios act through. A change that breaks it breaks the scenarios.
- Add a component with `manage.py bazis_front add <component>` rather than by hand: it
  copies what it requires and records the pristine copy for the updates. It never
  overwrites a copy that was changed here; the update with a merge of the changes will be
  `bazis_front update`.
- The components decide nothing: the fields and their titles come from the runtime
  schemas, the actions from the permission meta (`permission`), the states from the errors
  of the backend (`StatePanel`). Pass the field ids of the specs and the paths of
  `ROUTES`.

