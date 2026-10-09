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
| `src/bazis/generated/` | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API); `theme.css` and `theme.ts` (the design: the tokens as CSS variables, `THEME`) | only `manage.py bazis_front contract`; the theme only `manage.py bazis_front design` |
| `src/bazis/client/` | the client of the Bazis protocol | bazis-front; not edited, wrapped in `src/app/` |
| `src/bazis/react/` | the React hooks over the client and TanStack Query (`@/bazis/react`); `statusy/` (`@/bazis/react/statusy`) when the backend has bazis-statusy, `uploadable/` (`@/bazis/react/uploadable`) when it has bazis-uploadable, `ws/` with bazis-ws, `bg/` with bazis-bg, `async/` with bazis-async-background | bazis-front; not edited |
| `src/bazis/ui/<component>/` | the components (`@/bazis/ui/<component>`), each with its contract test; `init` copies `state-panel`, `app-shell`, `login-form`, `manage.py bazis_front add` the others | the product, keeping the contract tests passing |
| `src/app/` | providers (query cache, `BazisProvider`), session, router (the layout and the navigation), errors | the product |
| `src/screens/<screen>/` | the screens, composed from the components | the product |
| `src/components/ui/`, `src/lib/` | shadcn/ui components: those of the components copied by bazis-front, others with `npx shadcn add <name>` | the product |
| `../spec/` | the specs: `product.yaml` (roles, entities, access, scenarios), `screens/<id>.yaml`, `design/` | the product; checked by `manage.py bazis_front check` |
| `e2e/generated/` | the end-to-end tests of the scenarios of `../spec/product.yaml`, and `product.ts` (the test users and the routes of the specs) | only `manage.py bazis_front e2e` |
| `e2e/bazis/` | the helpers of the end-to-end tests (Playwright, through `data-bz`) | bazis-front; not edited |
| `e2e/custom/` | the end-to-end tests written by hand | the product |
| `bazis-front.lock.json`, `.bazis/base/` | the versions and hashes of the contract, of the generated files and of the copied assets; the pristine copies of the assets, from which `bazis_front update` merges a new version | bazis-front; commit them, never edit them |

## Commands

From the product root, after every change of the models, routes, roles, statuses or
transits of the backend (with a migrated database):

```bash
python manage.py bazis_front contract          # contract/, src/bazis/generated/, the lock
python manage.py bazis_front contract --check  # write nothing; exit 1 if anything is stale (CI)
python manage.py bazis_front check             # the specs against the contract; exit 1 on errors
python manage.py bazis_front design            # src/bazis/generated/theme.* from ../spec/design/ (after every change of it)
python manage.py bazis_front design --check    # write nothing; exit 1 if the theme is stale (CI)
python manage.py bazis_front add resource-list  # copy a component with what it requires
python manage.py bazis_front e2e               # e2e/generated/ from the scenarios of the specs
python manage.py bazis_front e2e --check       # write nothing; exit 1 if they are stale (CI)
python manage.py bazis_front update            # after `pip install -U bazis-front`: the copies of the new version, merged
python manage.py bazis_front update --check    # write nothing; exit 1 if a copy is of another version
```

The files of the template (`package.json`, the configs, `src/app/`, `src/screens/`,
`src/i18n/`, this file) are the product's, and `update` brings them to the new version like
the copies: an unchanged file is replaced, the changes of the product are merged with
those of bazis-front (conflict markers where both changed the same lines, see below), a
deleted file stays deleted. Run `npm install` when it says that `package.json` changed.

From `frontend/`:

```bash
npm install
npm run dev        # the dev server; /api goes to BAZIS_API_URL (http://localhost:8000)
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium   # once
npm run e2e        # the end-to-end tests, against the running backend of BAZIS_API_URL (E2E_PASSWORD)
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
  `row:<id>` with its cells `cell:<column>`, `field:<field>`, `error:<field>`,
  `upload:<field>` (a file field), `action:<id>`, `transit:<id>`, `status:<id>`,
  `nav:<screen>`; the components of the packages add `socket:<status>`,
  `action:notifications`, `list:notifications`, `notification:<key>`, `bg:<state>`,
  `async:<status>`): the scenarios of the
  product spec act through them (see [End-to-end tests](#end-to-end-tests)).
- `access` is what the backend must grant, checked against the permissions of the roles
  in the contract. It does not decide what the frontend shows: that is the permission
  meta and the runtime schemas (see below).
- The design is `spec/design/` (`theme.yaml`: the preset and its options; `tokens.json`:
  the brand), compiled into `src/bazis/generated/theme.css` and `theme.ts` by
  `manage.py bazis_front design`; see [Design](#design).

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
  `ApiError.fieldErrors()`, as `FieldInput` does: the pointers `/data/attributes/<name>`
  and `/data/relationships/<name>` of the backend), the errors of the item that are not of
  a field (`ApiError.formErrors()`: the item as a whole, `/data`, such as an invariant of
  `validate_item`, 422 `ERR_ITEM_INVALID`; an included item, `/included/<index>`; all the
  errors of `useRelationship`, whose endpoint points into its own body) in the form, as
  `ResourceForm` does, any other error and the state it puts a
  screen in with `StatePanel` of `@/bazis/ui/state-panel` (`errorState(error)`: 401 and 403
  `forbidden`, 404 `not_found`, 422 `invalid`, else `error`), the only mapping of the
  errors of the backend; the components and the `ErrorBoundary` of `src/app/errors.tsx`
  use it.
- **The backend decides the rights.** Do not encode roles or permissions here: request
  the permission meta (`for_change`, `for_delete`, `for_create` on a list, `crud_actions`
  on an item), read it with `can()`, and take the fields of a form from its runtime schema
  (`useResourceForm`). Hide or disable what the backend does not allow; a link of the
  navigation names what it `requires` (below), never a role.
- Check for an optional package with `CAPABILITIES.<name> !== null` (`contract.ts`): the
  login exists only with bazis-users (`LOGIN_ENABLED` of `src/app/session.ts`).
- **The login** (`src/app/session.ts`, `src/screens/login/`): the token endpoint of
  bazis-users; with bazis-authing (`CAPABILITIES.authing`), its services: the username and
  the password through the service `password` (`login()`, `PASSWORD_LOGIN`), and a button
  for each service whose page opens in a window (`WINDOW_LOGINS`, `loginInWindow()`:
  Google). Keep the store token of bazis-authing out of the session: only the session
  token it gives is kept, and the client sends its requests without cookies. The sign-out
  of `AppShell` is `signOut(api)`: it drops the session at once and, with bazis-authing,
  posts to its logout endpoint (`CAPABILITIES.authing.logout_url`, `api.authLogout`), which
  deletes the store cookie that a login in a window may leave.
- A 401 of any query or mutation ends the session (`logout()`, `src/app/providers.tsx`). Cached data
  belongs to the user who loaded it: logging in or out clears the query and mutation
  caches, and every query key of the hooks ends with the session (`useSession()` of
  `src/app/session.ts`, a number that changes at every login and logout), so that a
  request still running for the previous user never fills a query of the next one. A query
  of your own over data of the backend ends its key with `useSessionKey()` too.
- **The language of the interface** (`src/app/language.ts`, the asset `@/bazis/i18n`): one
  of `LANGUAGES` of the contract, chosen with `LanguageToggle` of `AppShell`
  (`action:language`, shown with more than one language) and kept in the browser, else the
  language of the browser, else `LANGUAGE` (the default of the backend); with
  `CAPABILITIES.users.profile_language` (a field `language` of the user resource) the
  language of the profile of the user wins at a login and every change is saved to it. The
  client sends it (`Accept-Language`: the backend answers its titles and its errors in it),
  every query key of the hooks ends with it, and a change clears the cache
  (`src/app/providers.tsx`).
- **Every text of a screen goes through `t()`**: `const { t, language } = useLanguage()` of
  `@/bazis/i18n`, `t('tasks.title')`, `t('list.range_of', {from, to, count})`; plural forms
  are `<key>.one`, `<key>.few`, `<key>.many`, `<key>.other` with the parameter `count`
  (`Intl.PluralRules`). The texts of the product are in `src/i18n/<language>.ts`, one
  dictionary per language of the backend, listed in `src/i18n/index.ts`; they are merged
  over those of the components (`src/bazis/i18n/messages/`), so a text of a component is
  changed with its key in the dictionary of the product, never in the copy. A language
  without a dictionary of the product shows the English one. Never write a text of the
  interface in the JSX.
- Dates and numbers are formatted in the language of the interface, never in that of the
  browser: `formatNumber`, `formatDate`, `formatDateTime`, `formatTime` of `@/bazis/i18n`
  with `language` (`FieldValue` does it for the fields). The labels of the fields are the
  titles of the runtime schemas, in the language the backend answers in; the names of the
  statuses, the transits and the roles are in `contract.ts` in every language
  (`statusName(type, id, language)` of `@/bazis/ui/status-badge`).

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
| `useFilterFields(path)` | the fields a list can be filtered by, with their types: those of the user |
| `useCan(path, 'view' \| 'add')` | whether the user may view the items of the route set or add one: undefined until the backend answers, false when it refuses (403 of the runtime schema of the list or of the create) |
| `useCreate(path)`, `useUpdate(path)`, `useDestroy(path)` | `mutate(document)`, `mutate({id, document})`, `mutate(id)` |
| `useRelationship(path)` | `mutate({id, field, operation: 'add' \| 'replace' \| 'remove', data})`: the relationship endpoint, for to-many relationships |
| `useResourceForm(path, {id?})` | a form bound to `schema_create`/`schema_update`: fields, values, dirty, submit of the changed attributes and to-one relationships, `errors` of a 422 by field |
| `useApi()`, `useSessionKey()` | the client; the scope (the session and the language), the last item of a query key of your own |

With bazis-statusy, `@/bazis/react/statusy`:

| Hook | What |
|---|---|
| `useTransits(path, id)` | the transits the user may run on the item now (`meta.state_actions`): `id`, `allowed` (no `restricts` of its validators), `restricts`, `payload` (the JSON Schema of the payload it requires, or null), `related`; the names are in `TRANSITS` of `contract.ts` |
| `useTransit(path, id)` | `mutate({transit, payload})`; resolves to the item, or to null when the user can no longer view it (leave its screen) |

With bazis-uploadable, `@/bazis/react/uploadable`:

| Hook | What |
|---|---|
| `useUpload(path)` | uploads a file to the route set of the uploaded files (`ROUTES['uploadable.file_upload']`): `upload(file, {name?})` resolves to the created item (its id may be a number: `String(item.data.id)` is the value of the relationship), null when aborted; `status`, `progress` (`{loaded, total}`), `error` (413 `ERR_FILE_TOO_LARGE`...), `abort()`, `reset()` |

With bazis-ws, `@/bazis/react/ws` (the socket: see below):

| Hook | What |
|---|---|
| `SocketProvider({path, token})` | opens the socket at `CAPABILITIES.ws.path` with the token of the session, sent in its first message; none without a token; reconnects with a backoff, closed by a logout |
| `useSocket()` | `{status: 'idle' \| 'connecting' \| 'open' \| 'rejected' \| 'unavailable', error}`: `open` once the server subscribed the session (`{"type": "subscribed"}`); `rejected` with `expired_token`, `invalid_token`, `user_not_found` or a close with 1008 (no new attempt until the token changes: log in again); `unavailable` when no socket answers at the path (five failed handshakes; it keeps trying every 15–30 s and at once when the browser is online or the page shown again); `retry()` tries at once |
| `useChannel(handler)` | every message of the channels of the session, the published JSON parsed |
| `useLiveQueries(ROUTES)` | refetches the queries of a resource that a message says changed, a task of bazis-async-background, and every query after a reconnect; `LiveQuery` mounts it |
| `useNotifications()` | `{items, unread, markRead, clear}`: the notifications received in the session, the newest first |

With bazis-bg, `@/bazis/react/bg`:

| Hook | What |
|---|---|
| `useBgTask(path, id)` | a task of `ROUTES['bg.task']` (the user's own), read every 2 s until it is done: `state` (`waiting`, `starting`, `running`, `done`), `phase`, `progress` (`[{key, performed, expected}]`), `outcome` (`success`, `error`, `interrupted`), `result` |

With bazis-async-background (and bazis-async-request), `@/bazis/react/async`:

| Hook | What |
|---|---|
| `useAsyncRequest()` | `mutate({method, path, body})` with `X-Async-Background`: `{status: 'queued', taskId}` (202), or `{status: 'done', response}` when the backend ran it at once (no Kafka); nothing is refetched until the task is done |
| `useAsyncTask(resultPath, taskId)` | `{status, response, done, error}` of a task, read at `CAPABILITIES.async_background.result_path` every 2 s until it is `completed` or `failed`; `replayedResponse(response)`: the HTTP status and body of a replayed request (an HTTP error there is still `completed`) |

A form shows the errors of a 422 by field from `form.errors` and any other error from
`form.submitError`; the fields a user may not change now are `readOnly` in `schema_update`
(show them disabled) and are never sent, those permissions disable are not in it. To-many relationships are in `form.fields` (`many: true`)
but not in its values: change them with `useRelationship`. The field permissions of
bazis-permit depend on the item (its selectors, its status): read the fields of an item from
its own schemas (`schema_retrieve`: those the user sees, `schema_update`: those they may
change now), never from the roles; a field hidden from the user is also absent from the
documents, and the schema of a list has every field (the items leave out the hidden ones).
Show a related item with `RelationLabel` (`useRelatedItem`: the items of a resource shown
together are read with one request) and choose one with `RelationPicker` of
`@/bazis/ui/resource`, never with a list of every item. **The route set of a resource that a
picker lists declares `search_fields`** (fields of its LIST schema, such as `username`;
`search` of the resource in the contract): the backend answers a search of a route set
without them with 400, so the picker then lists the items without a search, page after
page, and `bazis_front check` warns (S012); a list screen with `search` needs them too
(S013).

## Screens from the components

The screens are written here, from their specs; nothing generates them. Compose them from
the components of `src/bazis/ui/` (the guide of bazis-front, `bazis/contrib/front/AGENTS.md`
of the installed package, lists their props and their `data-bz`):

| Spec | Component |
|---|---|
| a screen (`screen:<id>`, its title, its actions) | `Screen` of `@/bazis/ui/app-shell`; the layout, the navigation (`nav:<screen>`, `navigation` of `spec/design/theme.yaml`) and the logout are `AppShell` in `src/app/router.tsx` |
| `primitive: list` (`columns`, `filters`, `sort`, `search`, `open`) | `ResourceList` of `@/bazis/ui/resource-list` (a filter the backend does not offer the user has no control) |
| `list.filter` (a report), `list.highlight: {field, tone}` | `filter={Filter.where('<field>', <value>)}` of `ResourceList` (`Filter.and` for several), combined with the filters of the user; `rowTone={(row) => fieldValue(row, '<field>') === true ? '<tone>' : undefined}` (`fieldValue` of `@/bazis/ui/resource`) |
| `primitive: card` (`sections`, `edit`, `transitions`, `history`) | `ResourceCard` of `@/bazis/ui/resource-card` (only the fields the user may see; with `edit`, those its update does not change marked read-only), with `StatusBadge`, `TransitBar` and `StatusHistory` of `@/bazis/ui/status-badge`, `@/bazis/ui/transit-bar` and `@/bazis/ui/status-history` (bazis-statusy) |
| the notifications and the live updates (bazis-ws) | `NotificationCenter` of `@/bazis/ui/notification-center` and `LiveQuery` of `@/bazis/ui/live-query` in the `tools` of `AppShell`, under `SocketProvider` (below) |
| a background task (bazis-bg), a background request (bazis-async-request) | `TaskProgress` of `@/bazis/ui/task-progress` (by the id of the task), `AsyncResult` of `@/bazis/ui/async-result` (what `useAsyncRequest` resolved to) |
| a field `type: file` (bazis-uploadable) | shown by the components (a link to the file, a thumbnail of an image); edited in the forms by `FileField` of `@/bazis/ui/file-field` once `FileFieldProvider` wraps the routes (below) |
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
import { ResourceCard } from '@/bazis/ui/resource-card';
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
        {(item) => (
          <>
            {/* null: the user can no longer view the item */}
            <TransitBar path={TASKS} id={id} onDone={(done) => { if (done === null) void navigate('/tasks'); }} />
            <StatusHistory resource={item} />
          </>
        )}
      </ResourceCard>
    </Screen>
  );
}
```

Add the routes of the screens to `src/app/router.tsx` (inside `RequireSession`) and their
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

With bazis-uploadable, `manage.py bazis_front add file-field` and wrap the routes in
`FileFieldProvider`, so that the forms upload the files of their file fields (without it a
file field is the picker of the uploaded files); `accept` limits the types of a field, the
size limit is `max_size` of the contract. The backend protects the route set of the
uploaded files: the frontend needs only its create and its retrieve, and a list, an update
or a delete open to every user would give each one the files of the others (see the guide
of bazis-front, "Protect the route set of the uploaded files"):

```tsx
import { FileFieldProvider } from '@/bazis/ui/file-field';

<FileFieldProvider accept={{ avatar: 'image/*' }}>
  <BrowserRouter>…</BrowserRouter>
</FileFieldProvider>
```

With bazis-ws, `manage.py bazis_front add live-query notification-center`, wrap the routes
in `SocketProvider` with the token of the session (none before the login; the logout
closes it) and give the layout the tools. A notification is
`{"action": "notification", "title", "text"?, "resource"?, "id"?}` published by the
backend to the user (`user.ws_publish(...)`, after the commit); a change is
`{"resource": "<type>"}` on `COMMON_CHANNEL` of bazis-ws, which every session receives,
anonymous ones too: never an id, data or a notification there. The backend routes
`ws_route` in its router module, where the contract finds its path (null otherwise: no
socket):

```tsx
import { CAPABILITIES } from '@/bazis/generated/contract';
import { SocketProvider } from '@/bazis/react/ws';
import { LiveQuery } from '@/bazis/ui/live-query';
import { NotificationCenter } from '@/bazis/ui/notification-center';

// AppRouter: useToken() of src/app/session.ts
<SocketProvider path={CAPABILITIES.ws?.path ?? null} token={useToken()}>
  <BrowserRouter>…</BrowserRouter>
</SocketProvider>

// RequireSession: the tools are mounted once (the bell opens the card of a task)
<AppShell
  …
  tools={<><LiveQuery /><NotificationCenter onOpen={(it) => { if (it.resource === 'tasks.task') void navigate(`/tasks/${String(it.id)}`); }} /></>}
>
```

The dev server proxies the socket (`vite.config.ts` reads its path from the contract).
Pub/sub keeps nothing: the notifications published while the page was closed are not
shown, and `LiveQuery` refetches every query after a reconnect.

- **Composing beyond the specs** (the props of every component are in the table of the
  guide of bazis-front, "The components", and in the `Props` types of `src/bazis/ui/`):
  - a section of your own in a card: `children` of `ResourceCard` is `(item, meta) => …`,
    the item and its permission meta (`permitted(meta, 'change')` of `@/bazis/ui/resource`,
    from `crud_actions`), without a second `useItem`;
  - a to-many relationship (the participants of a booking): the card shows it read-only; a
    section of your own changes it with `useRelationship(path).mutate({id, field, operation:
    'add' | 'remove' | 'replace', data: [{type, id}]})`, the item chosen with
    `RelationPicker({relation, value: null, onChange})` of `@/bazis/ui/resource`; its errors
    are all in `formErrors()`;
  - the label of a related item (`RelationPicker`, `RelationLabel`) is its first non-empty
    attribute of `name`, `title`, `username`, `email`, `slug`, `code`, else its id; as a text
    (`t('booking.of', {name})`: `{name}` is the parameter `name`), `itemLabel` of
    `@/bazis/ui/resource` of `useRelatedItem(ROUTES[type], id).data`;
  - a status: `StatusBadge` in `cells` of a list and in `badge` of a card, the options of its
    filter `statusOptions(type)`, as in the example above;
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
- **The components are the product's.** Change their look, texts and layout in
  `src/bazis/ui/` as the product needs; keep `npm test` passing: the contract test of a
  component (`<component>.contract.test.tsx`) checks the `data-bz` marks and the states
  that the scenarios act through. A change that breaks it breaks the scenarios.
- Add a component with `manage.py bazis_front add <component>` rather than by hand: it
  copies what it requires and records the pristine copy for the updates. It never
  overwrites a copy that was changed here. `manage.py bazis_front update` brings the
  copies (and the files of the template) to a new version of bazis-front: a file changed
  only here is kept, a file changed here and in bazis-front is merged by `git merge-file`
  (Git is needed then). Where both
  changed the same or adjacent lines it writes git conflict markers (`<<<<<<< frontend`,
  `=======`, `>>>>>>> bazis-front <version>`) and fails, listing the files: keep the change of bazis-front, apply the change of the product
  over it, delete the markers, and run `npm run typecheck` (it reports a marker left in a
  `.ts`/`.tsx` file only), `npm run lint`, `npm test` and `manage.py bazis_front update
  --check` (it reports the files of the conflicts that still have a marker, `package.json`
  and the configs too). A file of the template that bazis-front removed is kept, the
  product's; an image changed on both sides is kept and reported, to merge by hand.
- The components decide nothing: the fields and their titles come from the runtime
  schemas, the actions from the permission meta (`permission`), the states from the errors
  of the backend (`StatePanel`). Pass the field ids of the specs and the paths of
  `ROUTES`.


## Design

The look of the product is `../spec/design/`, compiled by `manage.py bazis_front design` into
`src/bazis/generated/theme.css` (imported by `src/index.css`) and `theme.ts` (`THEME`). The
guide of bazis-front lists the tokens and their CSS variables.

- **Follow the preset; do not restyle the components screen by screen.** `workspace` (a
  working application): the sidebar, the sticky header of `Screen` with the title and the
  actions, tables, the card next to the list (`ListCardLayout`), forms in dialogs
  (`FormSurface`), the density of the theme. `portal` (a public shell): the top bar, larger
  type, grids of cards, forms in place of the screen. The components read `THEME` for these
  defaults; pass a prop (`layout`, `mode`, `forms`, `navigation`) only for a screen that
  needs another one.
- **Colors, radii and fonts only through the tokens.** Use the Tailwind classes of the
  theme: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border`,
  `bg-primary text-primary-foreground`, `bg-primary-soft text-primary-ink` (and `success`,
  `warning`, `info`, `danger`, `neutral` for the tones), `rounded-lg`, `font-display`. Never
  a color of the Tailwind palette (`bg-blue-600`), a literal (`#3b82f6`, `oklch(...)` in a
  class) or `style={{ color }}`: they break the brand and the dark mode. A color the
  product needs is a token (`color.highlight` in `tokens.json` is `bg-highlight`).
- **The spacing of the density**: `p-(--space-card)`, `gap-(--space-section)`,
  `px-(--space-cell-x)` for blocks of your own, so that `density: compact` tightens them.
- **The states**: the components draw the loading states as skeletons (still marked
  `state:loading`) and the others with an icon, a title and a hint; a screen of your own uses
  `StatePanel` with a `skeleton` of its content. After a change that succeeded, `toast()` of
  `@/bazis/ui/state-panel` (the forms and the transits already do); the errors stay where
  they happened.
- **Statuses**: `statuses` of `theme.yaml` is keyed by the id of the status; bazis-statusy
  has one table of statuses, so an id is the same status in every model.
- **The brand** is a change of the tokens (`color.primary` and `dark.color.primary`,
  `radius`, `font.body`), then `bazis_front design` and `bazis_front check` (D009 reports a
  text color that lost its contrast). The tones of the statuses are `statuses` of
  `theme.yaml`.
- **Dark mode**: the tokens of the group `dark`; `initColorMode()` (in `src/main.tsx`) and the
  button of `AppShell` set the class `dark` of `<html>`. Check every screen in both modes and
  at the width of a phone.

## End-to-end tests

The scenarios of `spec/product.yaml` are the end-to-end tests of the product:
`manage.py bazis_front e2e` writes one Playwright test per scenario in
`e2e/generated/<scenario>.spec.ts` (never edited: change the scenario, generate again,
commit both; `bazis_front e2e --check` and `front.W003` report stale ones), and
`npm run e2e` runs them with the tests of `e2e/custom/`.

- **They act through `data-bz` only.** The helpers of `e2e/bazis/` open the route of a
  screen of the specs and wait for `screen:<id>` at the route of the screen (a list may show
  next to its card) and its state (no `state:loading` left),
  click `action:<id>`, `transit:<id>` and `row:<id>` (found by its cells `cell:<name>`),
  fill `field:<name>` in the open form (the `<form>` with `action:submit`), upload a file of
  `e2e/fixtures/` into the input `field:<name>` of a file field and wait while its
  `upload:<name>` is busy, and check `status:<id>`, `state:<state>`, `error:<name>`, the
  texts of `field:<name>` of a card, the absence of an action, the read-only fields and a
  notification (`expect: {notification: <text>}`: the bell `action:notifications` opens
  `list:notifications`, which waits for a `notification:<key>` with the text). A screen that renders the marks of its spec (the components do) passes its
  scenarios; a screen without them fails them, even when it looks right.
- **The test data is the backend's job**, never created by the tests: the tests run
  against a migrated backend (its data migrations create the roles, statuses and transits)
  after `python manage.py e2e_data` (the e2e data command recommended by bazis-front; see
  its guide, "The end-to-end tests"), with the same
  `E2E_PASSWORD`. It creates only a user per `test_user` of the roles of the specs (with its
  role and that password) and the items that the scenarios open, never a role, a status or
  a transit, and can run again (it sets the passwords again). The tests share that
  database and run one at a time; no scenario relies on what another one created.
- A `submit` followed by `expect: {error: <field>}` is a failing submit: the test expects
  the error of the backend in the open form, which stays open for the next steps.
- `npm run e2e` starts its own dev server on `E2E_PORT` (5173 by default), whose `/api` goes
  to `BAZIS_API_URL` (`http://localhost:8000` by default, also read from `.env.local`, as
  for `npm run dev`), and starts the tests once the backend answers its health check
  through it. The backend runs separately: start it first, at that address. It never
  reuses a server: when the port is taken (`npm run dev` of this frontend, or another app)
  the run fails, so that the tests never pass against another frontend; choose a free
  port, `E2E_PORT=5191 BAZIS_API_URL=http://localhost:8031 npm run e2e`, or name a frontend
  already running with `E2E_BASE_URL` (`npm run build` and `npm run preview` in CI). A run
  that waits for the web server until its timeout has no Bazis backend at `BAZIS_API_URL`.
- The browser of the tests is in UTC and in the default language of the backend
  (`timezoneId` and `locale` of `playwright.config.ts`), whatever the machine: the times
  that a scenario fills (`dt_start: '2030-03-04T10:00'`) and the dates it reads are in UTC,
  like the data of `e2e_data`. Without bazis-users there is no login; with bazis-authing the
  tests log in through its service `password`.
- The files that the scenarios upload (`upload: {field, file}`) are in `e2e/fixtures/`.
- A test of your own, for what a scenario does not express, uses the same helpers:

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

  `loginAs`, `open`, `openItem`, `action`, `fill`, `upload` (a file of `e2e/fixtures/`),
  `submit`, `transit(id, payload?)`, `expectScreen`, `expectStatus`, `expectState`,
  `expectActionAbsent`, `expectFieldReadonly`, `expectFieldAbsent`, `expectRows`,
  `expectError`, `expectNotification`, and `language(code)` (switches the language of the
  interface, for a test of `e2e/custom/`): the guide of
  bazis-front lists what each one waits for. For what they do not cover, `app.page`,
  `app.screen()` (the current screen), `app.form()` (the open form) and `bz(kind, id)` of
  `../bazis` (the selector of a mark): a transit that a validator restricts is disabled,
  with the errors of the validators next to it,
  `await expect(app.screen().locator(bz('transit', 'reopen'))).toBeDisabled()`.
