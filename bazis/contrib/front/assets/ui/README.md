# Components

The visual building blocks of the frontend of a product on
[Bazis](https://github.com/ecofuture-tech/bazis): React components on shadcn/ui and
Tailwind 4 over the hooks (`assets/react`). Status: pre-release.

The components are not an npm package: `manage.py bazis_front add <component>...` copies
them into the frontend of a product, to `frontend/src/bazis/ui/<component>/` (imported as
`@/bazis/ui/<component>`), with the assets they require, their pristine copies in
`.bazis/base/` and their hashes in the lock; `init` copies `state-panel`, `app-shell` and
`login-form`, which the template uses. Unlike the client and the hooks, the product owns the
copies and changes them freely; each component comes with its contract test
(`<component>.contract.test.tsx`), which checks the `data-bz` marks and the states that the
scenarios of the specs rely on: keep it passing.

The shadcn/ui components they use (`button`, `input`, `label`, `native-select`, `table`,
`badge`, `card`, `dialog`, `popover`, `sheet`, `skeleton`) are assets as well, copied into `src/components/ui/` as
`components.json` of the template places them, so that `add` needs neither the network nor
the shadcn CLI. Their npm dependencies (`radix-ui`, `class-variance-authority`,
`lucide-react`) and those of the contract tests (`@testing-library/react`, `jsdom`) are in
the `package.json` of the template: `add` never changes the `package.json` of a product.

Labels come from the backend (the titles of the runtime schemas, the names of the statuses
and transits in `contract.ts`) and from the props; there are no translations.

## The design

The components look as the design of the product says (`spec/design/`, compiled by
`manage.py bazis_front design` into `src/bazis/generated/theme.css` and `theme.ts`):

- colors, radii and fonts only through the Tailwind classes of the tokens (`bg-primary`,
  `text-muted-foreground`, `bg-success-soft text-success-ink`, `rounded-lg`, `font-display`),
  never literal colors (the shadcn/ui files keep theirs), so that a brand and the dark mode
  apply everywhere; the spacing of the density through its variables (`p-(--space-card)`,
  `py-(--space-cell-y)`);
- the defaults of the composition from `THEME` (`@/bazis/generated/theme`): the navigation
  of `AppShell`, the table or the cards of `ResourceList` (`layout`), the list with its card
  of `ListCardLayout` (`mode`), the dialog or the page of `FormSurface` and of the edit of
  `ResourceCard` (`mode`, `forms`); a prop overrides it, which the contract tests use to
  check both;
- the loading states are skeletons of what loads, still marked `state:loading` with
  `aria-busy`; the other states an icon, a title and a hint (`STATE_MESSAGES`,
  `STATE_HINTS`); a change that succeeded shows a toast (`toast`, the `Toaster` of
  `AppShell`);
- the tone of a status badge is `statuses` of the theme (`statusTone`), neutral by default.

In this repository `@/bazis/generated/theme` is `test/fixtures/theme.ts`, the theme of the
sample (`tests/test_design.py` checks it; write it again with
`BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_design.py`).

## The components

| Component | Props | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel({state, error?, message?, description?, onRetry?, inline?, skeleton?, children})`; `errorState(error)`, `queryState(query, empty?)`, `SkeletonLines`; `toast({title, description?, tone?})`, `Toaster` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell({title, navigation?: 'sidebar' \| 'topbar', items: [{screen, label, to, end?, icon?}], session: {user?, onLogout} \| null, tools?, children})`; `Screen({id, title?, description?, actions?, children})`; `ListCardLayout({list, mode?})`, `useBesideCard`; `initColorMode`, `ColorModeToggle`, `setColorMode`; `useScreenPage` | `nav:<screen>`, `screen:<id>`, `action:logout` | |
| `login-form` | `LoginForm({onLogin?(credentials), methods?: [{id, label, onLogin(signal)}], onSuccess?, title?, description?})` | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource-list` | `ResourceList({path, entity, columns, filters?, sort?, search?, pageSize?, onOpen?, selected?, actions?, rowActions?, cells?, emptyMessage?, layout?, compactColumns?})` | `list:<entity>`, `row:<id>` with its cells `cell:<column>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>`, `field:$search`, `action:<id>`, `action:prev-page`, `action:next-page` | |
| `resource-card` | `ResourceCard({path, id, sections: [{id, title?, fields}], title?, badge?, edit?, actions?, values?, children?: node \| (item) => node, forms?})` | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>` | |
| `resource-form` | `ResourceForm({path, id?, fields?, onSaved?, onCancel?, submitLabel?})`; `FormSurface({open, onClose, title, description?, mode?, children})` | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge({resource})`; `statusOf`, `statusName`, `statusOptions`, `statusTone`, `transitName`, `transitTarget` | `status:<id>` | capability `statusy` |
| `status-history` | `StatusHistory({resource, label?})` | none (the status of the card is the `status:<id>` of its badge) | capability `statusy` |
| `transit-bar` | `TransitBar({path, id, onDone?})`; `payloadErrors(error, names)` | `transit:<id>`, `state:<loading\|error\|forbidden>`, in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | capability `statusy` |
| `file-field` | `FileFieldProvider({accept?, maxSize?, resources?, children})`; `FileField(props)` (the control of a file field of `FieldInput`, with `maxSize?`, `accept?`, `path?`); `accepts(file, accept)`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads); its errors are `error:<name>` of `FieldInput` | capability `uploadable` |
| `live-query` | `LiveQuery({routes?})` (`ROUTES` by default); `SOCKET_LABELS` | `socket:<idle\|connecting\|open\|rejected\|unavailable>` | capability `ws` |
| `notification-center` | `NotificationCenter({onOpen?(notification), toasts?})` | `action:notifications`, `list:notifications` with `notification:<key>`, `action:clear-notifications` | capability `ws` |
| `task-progress` | `TaskProgress({id, path?, title?, onDone?, children?: (task) => node})`; `taskView(task)`, `BG_TASKS`, `TASK_LABELS` | `bg:<waiting\|running\|success\|error\|interrupted>`, `state:<loading\|error\|forbidden\|not_found>` | capability `bg` |
| `async-result` | `AsyncResult({start, path?, title?, onDone?, children?: (response) => node})`; `asyncResult(status, response)`, `RESULT_PATH`, `RESULT_LABELS` | `async:<pending\|processing\|completed\|failed>`, `state:<error\|forbidden\|not_found>` | capability `async_background` |

`resource` is what they share: `FieldInput` (the input of a field of a runtime schema, the
only one: the forms and the payloads of the transits use it), `FieldValue`,
`RelationPicker({relation, value, onChange, label?, placeholder?, nullable?, disabled?, path?})` and
`RelationLabel({relation, id, path?})` (the related resource by its route in `ROUTES`, or
`path`), `useListFields`/`useItemFields` (the titles and types of the list, retrieve and
update schemas, `has(name)`: whether the schema of the user has the field),
`permitted(meta, action, id?)` (the permission meta of bazis-permit; allowed when the
backend does not report it), the files of bazis-uploadable (`FilesProvider({control,
resources?})`, which gives `FieldInput` the control of the file fields; `FileValue({relation,
id, path?, preview?})`, `FileView`, `isFile`, `formatSize`, `FILE_RESOURCES`: the resources
of `uploadable` of the contract), and the hooks with plain paths for the bodies of the
components. `testing` is the support of the contract tests: a backend for the mocked
`fetch` of the client, the documents and runtime schemas of Bazis, `renderWithBazis`, and
`getByTestId` reading `data-bz`, and `FakeSocket`, the WebSocket of the page in a test.

- **`state-panel`** is the only place where an error of the backend becomes a state: 401
  and 403 are `forbidden`, 404 `not_found`, 422 `invalid`, any other `error`.
- **`resource-list`** reads the list with `useList` (`meta`: `pagination`, `for_create`,
  `for_change`, `for_delete`), the titles of the columns from `schema_list/`, the types of
  the filters from `route_filter_fields/` (a relation: the picker of the related resource; a
  date: a range; a string: `<field>__$search`; `options` for choices such as the statuses),
  the sort labels from `RESOURCES` of the contract. An action with `permission` is shown
  only when the permission meta allows it.
- **`app-shell`**: `ListCardLayout` renders the screen of a list and, as its child route, the
  screen of its card: next to the list on a wide screen (`split`; the list keeps its state
  and shows only its `compactColumns`, the first two by default, while the card is open) or
  in its place (`pages`).
  `Screen` hosts a form page of `FormSurface`, which takes the place of its content.
- **`resource-card`** reads the item with `crud_actions` and its fields from
  `schema_retrieve/` of the item; with `edit`, an edit button (when the backend allows the
  change) opens the form of the update of their fields in a dialog or as a page
  (`FormSurface`). `children` may be a function of the item (`StatusHistory` takes it).
- **The field permissions of bazis-permit** (`<app>.<model>.field.<operation>.<selector>…
  .<field>.<restriction>`, restrictions `enable`, `readonly`, `disable`, …) are read from
  what the backend returns, never from the roles: a field that the user may not see is left
  out of `schema_retrieve/` of the item and of the documents (its attribute or relationship
  is absent), one that they may see but not change now is `readOnly` in `schema_update/` of
  the item, and both depend on the item (its selectors and, with bazis-statusy, its
  status). The card shows only the fields of `schema_retrieve/` (a section without any is
  left out) and, when the user may change the item, marks read-only (a lock, `(read-only)`
  for screen readers) the fields that its update does not change; the form leaves out the
  fields that `schema_update/` does not have and disables the read-only ones. The schema of a
  list is the union of the field sets of the groups of permissions (its first member has
  every field), so the list shows a column when a row of the page has its field.
- **The labels of related items** (`RelationLabel`: the cells of a relationship in a
  list, its value in a card, the value of a picker) are read with `useRelatedItem` of the
  hooks: the items of a resource asked for at the same time (the rows of a page) are read
  with one list of the related resource filtered by their primary keys
  (`filter=pk=<a>|pk=<b>|…`, at most 50 ids a request), cached by item and shared with every
  other place that shows it; an item the user may not view (the list leaves it out) shows
  its id. Bazis ignores `include` on a list, and the core has no `pk__in` lookup.
- **`RelationPicker`** (the input of a to-one relationship in a form and in the payload of a
  transit, and of the filter of a relationship) is a combobox: a button
  (`role="combobox"`, the marks of the field) with the label of the item opens a popover
  with a search sent to the backend (`search`, every word in a text field of the related
  resource) and the items of the list of the related resource, the next page of 20 with
  `Load more` (by `page[offset]`: a larger `page[limit]` would pass the maximum of the
  backend); a nullable relationship has an option that clears the value (`data-value=""`,
  which the helpers of the end-to-end tests choose for null). The keyboard follows the
  combobox pattern of WAI-ARIA: Enter, Space or ArrowDown opens with the selected item
  active, typing searches with the first item found active (the option that clears is
  never the default one), ArrowUp/ArrowDown move, Enter selects (not while the options are
  still those of another search), Escape and Tab close and give the focus back to the
  button. The search is named after the field (`label`: `Search <label>`) and the state of
  the search (loading, nothing found, an error) is announced (`role="status"`). The popover
  is modal, so that it scrolls and keeps the focus inside a dialog. A related resource
  without a route is an input of the id.
- **`resource-form`** is `useResourceForm`: the fields of `schema_create/` or
  `schema_update/` of the current user, read-only ones disabled and never sent; a to-one
  relationship is a `RelationPicker` (a file field the control of `FilesProvider`); to-many
  relationships are left out (`useRelationship`). It is not submitted while a file of a
  field uploads (`onBusy` of `FieldInput`).
- **Files** (bazis-uploadable): a field is a file when it is a to-one relationship to a
  resource of `resources` of the capability `uploadable` (`uploadable.file_upload`, whose
  items have `file`, the URL in the storage, `name`, `extension`, `size`). `FieldValue`
  shows it with `FileValue` in the cards and the lists: a link to the file (in a new tab)
  with its size and a thumbnail of an image (by its extension), read with the retrieve of
  the route set (`useItem`: a route set of the uploaded files needs no list).
  **`file-field`**: `FileField` is a drop zone with a
  picker (the input is hidden, `field:<name>`; the label of the field opens it), the file
  uploaded at once with `useUpload` (its progress, a cancel; no other file is taken, chosen
  or dropped, while it uploads), then the field set to the id
  of the created item (a string); the file of the value with a replace and, for a nullable
  relationship, a remove; a thumbnail of an image chosen is its local copy until it is
  saved. A file larger than `maxSize` (`max_size` of the contract) or of a type that
  `accept` refuses is not sent; these errors and those of the backend (413
  `ERR_FILE_TOO_LARGE`, 401, 403) are the errors of the field. A form closed while its file
  uploads aborts the upload; a replaced file stays in the storage (bazis-uploadable never
  deletes one). `FileFieldProvider` makes it the control of every file field of the forms
  below it, with `accept` by the name of a field.
- **`status-history`** shows what bazis-statusy exposes of the history of an item: its
  status since `status_dt`, by `status_author` (the user of the transit that set it; none
  for the initial status), each when the user may see the field. bazis-statusy records
  every transit (`<Model>StatusyTransit`: transit, status, date, author, `extra`) but has no
  endpoint that reads them, and does not store the payload of a transit: the earlier
  transits and their payloads are not shown until it has one.
- **`app-shell`** renders the `tools` of the product (the notifications, the state of the
  socket) next to the color mode once: in the top bar, at the foot of the sidebar, or in
  the header of a phone (the sidebar is shown from the breakpoint `md`, read with
  `matchMedia`), so that a component there mounts its hooks once.
- **`live-query`** (bazis-ws): `LiveQuery` mounts `useLiveQueries` (the queries of a
  resource refetched when a message of the socket says it changed, a task of
  bazis-async-background when its status comes, every query after a reconnect) and shows the
  state of the socket as a dot with its label for assistive technologies
  (`socket:<status>`). Mount it once, under `SocketProvider` of `@/bazis/react/ws`.
- **`notification-center`** (bazis-ws): a bell with the count of the unread notifications
  (`action:notifications`, its label says the count) opens their list
  (`list:notifications`, newest first, each `notification:<key>`: the title, the text, the
  time), which marks them read, also those that come while it is open; `Clear` empties it.
  A notification about an item is a button when `onOpen` is given. Each new notification
  is a toast (`tone: 'info'`) once in the page, whatever the number of centers; those
  received before the center was mounted are not. The notifications are those received in
  the session: pub/sub keeps nothing.
- **`task-progress`** (bazis-bg): a task by its id (the route set of `bg.task`, `BG_TASKS`),
  read until it is done: its name, its state, the phase that runs with a progress bar per
  counter (without a maximum when nothing is expected), then its outcome and, once it
  succeeded, what `children` renders of it. The traceback of a failure is not shown.
  `onDone` is called once.
- **`async-result`** (bazis-async-background, bazis-async-request): the result of what
  `useAsyncRequest` resolved to (`start`): a queued task read at `RESULT_PATH` until it is
  done, a request run at once completed at once. The response given to `children` is that
  of the endpoint for a replayed request, whose HTTP error is a failure with its message
  (`errors[0].detail`), as is a `failed` task (`error` of its response). `onDone` is called
  once for each `start`.
- **`transit-bar`** shows the transits of `meta.state_actions` (disabled with the errors of
  their validators when restricted); a transit whose action takes a typed payload opens a
  dialog with its fields, and the errors of a 422 (`/payload/<name>`) are shown by field.
  `onDone(null)`: the user can no longer view the item.

## A screen

```tsx
import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceList } from '@/bazis/ui/resource-list';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';

const TASKS = ROUTES['tasks.task'];

export function TaskListScreen() {
  const navigate = useNavigate();
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
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
      />
    </Screen>
  );
}
```

## Checks in this repository

`package.json`, `tsconfig.json`, `vitest.config.ts` and `test/` exist only for the checks
of this repository (`npm run typecheck`, `npm test` from the root) and are not in the
wheel; the contract tests are, since they are copied into products. In this repository the
`@/` imports point to the assets next to them, to `src/lib/utils.ts` of the template and to
`test/fixtures/contract.ts`, the `contract.ts` of the sample of this repository (rendered by
`contract/typescript.py` from its `contract.json`).

## The license of shadcn/ui

The files of `shadcn/` are the components of [shadcn/ui](https://ui.shadcn.com) (style
`new-york-v4`) with the aliases of `components.json`; each keeps this notice in its header:

```
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
