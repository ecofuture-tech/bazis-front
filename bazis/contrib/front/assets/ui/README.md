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
the `package.json` of the template. The library of an optional component (Leaflet of `map`)
is `npm` of its asset in the registry: `add` sets it in the `package.json` of the product
(keeping a version that the product set itself) and `update` brings it to each release.

The labels of the data come from the backend (the titles of the runtime schemas, in the
language it answers in; the names of the statuses and transits of `contract.ts`, in every
language) and from the props. Every other text is a key of the dictionaries of `@/bazis/i18n`
(`useLanguage().t`: `state.error.title`, `list.next`, `socket.open`, …,
`src/bazis/i18n/messages/<language>.ts`), in the language of `LanguageProvider` (English
without it), and the dates and numbers are formatted in that language with `Intl`. A
product changes a text with its key in its own dictionary (`src/i18n/<language>.ts`), not in
the copy (the close buttons of the shadcn/ui `dialog` and `sheet` too: `action.close`). The contract tests never depend on a text: `renderWithBazis` of `testing` renders
in English (`language: testLanguages('ru', 'en')` for a test of another language).

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
  `aria-busy`; the other states an icon, a title and a hint (the texts
  `state.<state>.title` and `state.<state>.hint`); a change that succeeded shows a toast (`toast`, the `Toaster` of
  `AppShell`);
- the tone of a status badge is `statuses` of the theme (`statusTone`), neutral by default.

In this repository `@/bazis/generated/theme` is `test/fixtures/theme.ts`, the theme of the
sample (`tests/test_design.py` checks it; write it again with
`BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_design.py`).

## The components

Their props and signatures are in the API reference of the guide (the sections "API: the
components: …" of `bazis/contrib/front/AGENTS.md`, generated from the sources).

| Component | Exports | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel`; `errorState`, `queryState`, `SkeletonLines`; `toast`, `Toaster` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell`; `Screen`; `ListCardLayout`, `useBesideCard`; `initColorMode`, `ColorModeToggle`, `setColorMode`; `LanguageToggle` (with more than one language); `useScreenPage` | `nav:<screen>`, `screen:<id>`, `action:logout`, `action:language` (its code in `data-value`) | |
| `login-form` | `LoginForm` | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource-list` | `ResourceList` | `list:<entity>` (`aria-busy` until its rows are those of its search and page, their search in `data-search`), `row:<id>` (`data-tone` and `aria-description` when highlighted) with its cells `cell:<column>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>`, `field:$search`, `action:<id>`, `action:prev-page`, `action:next-page` | |
| `resource-card` | `ResourceCard`; `RelatedList` | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>`; a related section `list:<entity>`, `action:<add.id>` | |
| `resource-form` | `ResourceForm`; `FormSurface` | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge`; `statusOf`, `statusName`, `statusOptions`, `statusTone`, `transitName`, `transitTarget` | `status:<id>` | capability `statusy` |
| `status-history` | `StatusHistory` | none (the status of the card is the `status:<id>` of its badge) | capability `statusy` |
| `transit-bar` | `TransitBar`; `payloadErrors` | `transit:<id>`, `state:<loading\|error\|forbidden>`, in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | capability `statusy` |
| `file-field` | `FileFieldProvider`; `FileField` (the control of a file field of `FieldInput`); `accepts`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads); its errors are `error:<name>` of `FieldInput` | capability `uploadable` |
| `live-query` | `LiveQuery` (the routes of `ROUTES` and the notifications of `CAPABILITIES.notify.resource` by default); the texts `socket.<status>` | `socket:<idle\|connecting\|open\|rejected\|unavailable>`, `action:reconnect` | capability `ws` |
| `notification-center` | `NotificationCenter`: `notifications` is `useInbox` (bazis-notify) or `useNotifications` (bazis-ws); `CenterNotification`, `NotificationSource` | `action:notifications`, `list:notifications` with `notification:<key>`, `action:read-notifications`, `action:clear-notifications`, `action:delete-notifications`, `action:confirm-delete-notifications` | none (its source) |
| `task-progress` | `TaskProgress`; `taskView`, `BG_TASKS`; the texts `bg.<view>` | `bg:<waiting\|running\|success\|error\|interrupted>`, `action:download`, `state:<loading\|error\|forbidden\|not_found>` | capability `bg` |
| `async-result` | `AsyncResult`; `asyncResult`, `RESULT_PATH`; the texts `async.<view>` | `async:<pending\|processing\|completed\|failed>`, `state:<error\|forbidden\|not_found>` | capability `async_background` |
| `map` | `ResourceMap`; `MapProvider`, `OSM_TILES`, `useMapTiles`; `LeafletMap`, `MapPointControl`; `nearFilter`, `nearSort`, `useGeolocation`; the texts `map.<text>` | `map:<entity>` (`aria-busy` while it loads) with `marker:<id>`; the map of a point field `map:<field>`, `action:locate-<field>` | npm `leaflet` (`add` sets it in package.json) |

`resource` is what they share: `FieldInput` (the input of a field of a runtime schema, the
only one: the forms and the payloads of the transits use it; the choices of a field are a
select of their labels), `FieldValue` (with `formatValue`: the value in the language of the
interface, a choice by its label; `choiceOptions`: the choices as options of a filter),
`RelationPicker`, `RelationListPicker` (the ids of the items of a to-many relationship) and
`RelationLabel` (the related resource by its route in `ROUTES`, or `path`; `hasSearch`:
whether the contract gives the resource search fields), `useListFields`/`useItemFields`
(the titles and types of the list, retrieve and update schemas, `has`: whether the schema
of the user has the field), `permitted` (the permission meta of bazis-permit; allowed when
the backend does not report it), the points (`pointOf`, `geoJsonPoint`, `formatPoint`,
`parsePoint`, `POINT_FIELDS`: the point fields of the contract by the path of their route
set, and `PointsProvider`, which gives `FieldInput` the control of the point fields: the
map of `MapProvider`), the files of bazis-uploadable (`FilesProvider`, which gives
`FieldInput` the control of the file fields; `FileValue`, `FileView`, `isFile`,
`formatSize`, `FILE_RESOURCES`: the resources of `uploadable` of the contract), and the
hooks with plain paths for the bodies of the components. `testing` is the support of the
contract tests: a backend for the mocked `fetch` of the client (each request with the
language it asked for, `calls[].language`), the documents and runtime schemas of Bazis,
`renderWithBazis` (in English, or in the language of `testLanguages`), and `getByTestId`
reading `data-bz`, and `FakeSocket`, the WebSocket of the page in a test.

- **`state-panel`** is the only place where an error of the backend becomes a state: 401
  and 403 are `forbidden`, 404 `not_found`, 422 `invalid`, any other `error`.
- **`resource-list`** reads the list with `useList` (`meta`: `pagination`, `for_create`,
  `for_change`, `for_delete`), the titles of the columns from `schema_list/`, the types of
  the filters from `route_filter_fields/` (a relation: the picker of the related resource; a
  date: a range; a string: `<field>__$search`; on a phone, below the breakpoint `sm`, each
  filter is a row of the full width, its control taking the rest of it; `options` for choices such as the statuses,
  those of the list schema by their labels for a field with choices;
  no control for a field that the backend does not list for the user; the inline
  `state:error` when they cannot be read), the sort labels from
  `RESOURCES` of the contract. An action with `permission` is shown only when the
  permission meta allows it. `filter` (the filter of the screen) is combined (AND) with
  those of the user; `rowTone(row)` highlights a row in a tone of the theme (`Tone` of the
  generated theme: its soft color and a bar of the tone) and `rowToneLabel(row)` is its
  `aria-description`, the meaning in words.
- **`app-shell`**: a link with `requires` is shown once the backend allows the user what it
  requires (`useCan` of the hooks: the runtime schema of the list or of the create of
  `path`; `filters`: those fields in `route_filter_fields/` of the user), never before.
  `ListCardLayout` renders the screen of a list and, as its child route, the
  screen of its card: next to the list on a wide screen (`split`; the list keeps its state
  and shows only its `compactColumns`, the first two by default, while the card is open) or
  in its place (`pages`).
  `Screen` hosts a form page of `FormSurface`, which takes the place of its content.
- **`resource-card`** reads the item with `crud_actions` and `custom_actions` and its fields from
  `schema_retrieve/` of the item; with `edit`, an edit button (when the backend allows the
  change) opens the form of the update of their fields in a dialog or as a page
  (`FormSurface`). `RelatedList` is a related section of a card: the list of a related
  resource filtered by its to-one relationship to the item (`Filter.where(relation, item)`)
  and `add`, its create form (`ResourceFormBody` in `FormSurface`) with the relationship
  fixed to the item, shown when the backend allows the create (`for_create`); an item added
  reads the item of the card again (`useRefreshItem(itemPath, item)` of the hooks: its query
  keys, so in the `children` of the card or after it alike). `children` may be a function of the item and its permission meta
  (`StatusHistory` takes the item; `permitted(meta, 'change')` for a section of the product).
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
  all the fields any row can show), so the list shows a column when a row of the page has its field.
- **The labels of related items** (`RelationLabel`: the cells of a relationship in a
  list, its value in a card, the value of a picker) are read with `useRelatedItem` of the
  hooks: the items of a resource asked for at the same time (the rows of a page) are read
  with one list of the related resource filtered by their primary keys
  (`filter=pk=<a>|pk=<b>|…`, at most 50 ids a request), cached by item and shared with every
  other place that shows it; an item the user may not view (the list leaves it out) shows
  its id; a label being read is a skeleton marked `state:loading`, which the helpers of the
  end-to-end tests wait for. Bazis ignores `include` on a list, and the core has no `pk__in`
  lookup. The label of an item (here and in the pickers) is `itemLabel`: its display name,
  else an identifier, the first non-empty of `name`, `full_name`, the first and the last
  name together (`first_name`, `last_name`: as `get_full_name()` of a user), `title`,
  `username`, `email`, `slug`, `code`, else its id.
- **`RelationPicker`** (the input of a to-one relationship in a form and in the payload of a
  transit, and of the filter of a relationship) is a combobox: a button
  (`role="combobox"`, the marks of the field) with the label of the item opens a popover
  with a search sent to the backend (`search`, every word in a search field of the route set
  of the related resource) and the items of the list of the related resource, the next page
  of 20 with `Load more` (by `page[offset]`: a larger `page[limit]` would pass the maximum
  of the backend; the option without `data-value`); a nullable relationship has an option
  that clears the value (`data-value=""`, which the helpers of the end-to-end tests choose
  for null). The search is there only when the route set has search fields (`searchable`;
  by default `search` of the resource in the contract, `hasSearch`): the core answers a
  search of a route set without `search_fields` with 400 `ERR_FILTER`, so such a picker
  lists the items without a search box, the list taking the focus and the keys, also while
  its first page loads (and the
  helpers of the end-to-end tests read its pages until the item is listed). The keyboard follows the
  combobox pattern of WAI-ARIA: Enter, Space or ArrowDown opens with the selected item
  active, typing searches with the first item found active (the option that clears is
  never the default one), ArrowUp/ArrowDown move, Enter selects (not while the options are
  still those of another search), Escape and Tab close and give the focus back to the
  button. The search is named after the field (`label`: `Search <label>`, the list without
  a search `Choose <label>`) and the state of
  the search (loading, nothing found, an error) is announced (`role="status"`). The popover
  is modal, so that it scrolls and keeps the focus inside a dialog. A related resource
  without a route is an input of the id.
- **`RelationListPicker`** (the input of a to-many relationship in a form) is the same
  combobox over the same list, `aria-multiselectable`: its button shows the labels of the
  items, a click or Enter adds or removes an item and the popover stays open (Escape and
  Tab close it), the option with the placeholder (`data-value=""`) removes every item, which
  the helpers of the end-to-end tests choose first when they fill it with a list. Without a
  route for the related resource it is an input of the ids separated by commas.
- **`resource-form`** is `useResourceForm`: the fields of `schema_create/` or
  `schema_update/` of the current user, read-only ones disabled and never sent; `fixed`
  values (the parent of an added item) are sent and never changed by the user, their fields
  left out or, named in `fields`, read-only; a to-one
  relationship is a `RelationPicker` (a file field the control of `FilesProvider`), a
  to-many one a `RelationListPicker`, sent with all its items when it changed (its button
  shows the labels of the first 8 items, then `+N`); a reverse relationship (`reverse` in
  the contract, `isReverse`) is left out unless `fields` names it. A 422 is `state:invalid`: the errors of
  the fields at their fields (`error:<name>`), the others in the state (`ApiError.formErrors()`:
  an error of the item as a whole, `/data`, such as an invariant of `validate_item`,
  `ERR_ITEM_INVALID`; of an included item, `form.included_error`; of a field the form does
  not show, with its name). It is not submitted while a file of a
  field uploads (`onBusy` of `FieldInput`).
- **Files** (bazis-uploadable): a field is a file when it is a to-one relationship to a
  resource of `resources` of the capability `uploadable` (`uploadable.file_upload`, whose
  items have `file`, the URL in the storage, `name`, `extension`, `size`). `FieldValue`
  shows it with `FileValue` in the cards and the lists: its name, a button that downloads
  it (`useDownload`: `<path><id>/download/` with the token, saved under the name the backend
  gives; never the `file` URL, which the media host serves to anyone), with its size and a
  thumbnail of an image (by its extension; its content read the same way,
  `useDownloadUrl`), read with the retrieve of the route set (`useItem`). bazis-uploadable gives a user only the files he uploaded: the
  file of another user (the attachment of a shared item) is a 404, shown as
  `file:unavailable` ("File not available", with a hint; "File not loaded" for another
  error), never as an id.
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
  socket) next to the color mode once: in the top bar, at the foot of the sidebar (on the
  row of the toggles, which wraps, with the session on a row of its own under it), or in
  the header of a phone (the sidebar is shown from the breakpoint `md`, read with
  `matchMedia`), so that a component there mounts its hooks once.
- **`live-query`** (bazis-ws): `LiveQuery` mounts `useLiveQueries` (the queries of a
  resource refetched when a message of the socket says it changed, a task of
  bazis-async-background when its status comes, every query after a reconnect) and shows the
  state of the socket as a dot with its label for assistive technologies
  (`socket:<status>`); when no socket answers (`unavailable`) a `Retry`
  (`action:reconnect`) tries at once. Mount it once, under `SocketProvider` of `@/bazis/react/ws`.
- **`notification-center`**: a bell with the count of the unread notifications
  (`action:notifications`, its label says the count) opens their list
  (`list:notifications`, newest first, each `notification:<key>`: the title, the text, the
  time, the unread ones marked); a click on one marks it read and calls `onOpen` (the list
  closes), `action:read-notifications` marks them all read, `action:clear-notifications`
  forgets them when the source can (`clear` of `useNotifications`); the stored ones are
  deleted only with `onDeleteAll` (`deleteAll` of `useInbox`), after
  `action:delete-notifications` and `action:confirm-delete-notifications`. Each new unread notification is a toast once in the page, whatever the
  number of centers (`success` and `error` of bazis-notify in their tone, else `info`);
  those there when the notifications were first read, or that came while the list was open,
  are not. It needs no package: its
  `notifications` are the stored ones of bazis-notify (`useInbox(path)`, with a loading and
  an error state) or those received on the socket of bazis-ws in the session
  (`useNotifications()`: pub/sub keeps nothing).
- **`task-progress`** (bazis-bg): a task by its id (the route set of `bg.task`, `BG_TASKS`),
  read until it is done: its name, its state, the phase that runs with a progress bar per
  counter (without a maximum when nothing is expected), then its outcome and, once it
  succeeded, what `children` renders of it and, when it has a file (an export),
  `action:download`: the file read with the token from `<path><id>/download/` (bazis-bg
  2.6), never its `file` URL. The traceback of a failure is not shown. `onDone` is called
  once.
- **`async-result`** (bazis-async-background, bazis-async-request): the result of what
  `useAsyncRequest` resolved to (`start`): a queued task read at `RESULT_PATH` until it is
  done, a request run at once completed at once. The response given to `children` is that
  of the endpoint for a replayed request, whose HTTP error is a failure with its message
  (`errors[0].detail`), as is a `failed` task (`error` of its response). `onDone` is called
  once for each `start`.
- **`map`**: Leaflet (the npm dependency that `add map` sets in package.json; `leaflet-map.tsx`,
  a chunk of its own loaded with the first map shown, `aria-busy` meanwhile, so that the main
  chunk of a product does not carry it) with the tiles
  of `MapProvider` (`OSM_TILES`, OpenStreetMap with its attribution, by default: set those of
  the product in production, with their host in its CSP), a circle marker per point in the
  colors of the theme (the classes of its tokens, `bg-primary`, `border-background`), a
  button named and titled by the label of the item that the keyboard reaches (Enter or Space
  opens it); the view is fitted to the points when they change, not when one is selected. `ResourceMap` reads the first `pageSize` (200) items of the
  list with its `filter` and `sort`; the items without a point are left out, the list beside
  it shows them. Its contract test replaces Leaflet with a fake (jsdom draws no map). A point
  field of a form (`FieldInput` with the `path` of its route set) is the text `<latitude>,
  <longitude>` and, under `MapProvider`, a map where a click places it.
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
