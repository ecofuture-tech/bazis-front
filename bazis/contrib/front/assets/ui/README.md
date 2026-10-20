# Components

The visual building blocks of the frontend of a product on
[Bazis](https://github.com/ecofuture-tech/bazis): React components on shadcn/ui and
Tailwind 4 over the hooks (`assets/react`). Status: pre-release.

The components are not an npm package: `manage.py bazis_front add <component>...` copies
them into the frontend of a product, to `frontend/src/bazis/ui/<component>/` (imported as
`@/bazis/ui/<component>`), with the assets they require, their pristine copies in
`.bazis/base/` and their hashes in the lock; `init` copies `state-panel`, `app-shell` and
`login-form` (with what they require), which the template uses and requires (`update`
copies those that a new template requires), and `bazis_front screens` those that the
generated screens import. Unlike the client and the hooks, the product owns the
copies and changes them freely; each component comes with its contract test
(`<component>.contract.test.tsx`), which checks the `data-bz` marks and the states that the
scenarios of the specs rely on: keep it passing.

The shadcn/ui components they use (`button`, `input`, `label`, `native-select`, `select`,
`checkbox`, `dropdown-menu`, `table`, `badge`, `card`, `dialog`, `popover`, `sheet`,
`skeleton`) are assets as well, copied into `src/components/ui/` as
`components.json` of the template places them, so that `add` needs neither the network nor
the shadcn CLI; so are the others on Radix for the screens of a product (`tabs`, `tooltip`,
`switch`, `avatar`, `separator`, `scroll-area`), copied by `add <name>`; `calendar` (on
react-day-picker) is that of `date-picker`. Their npm dependencies (`radix-ui`, `class-variance-authority`,
`lucide-react`) and those of the contract tests (`@testing-library/react`, `jsdom`) are in
the `package.json` of the template. The library of an optional component (Leaflet of `map`,
recharts of `charts`, react-day-picker of `calendar`, @dnd-kit of `board-dnd`) is `npm` of
its asset in the registry: `add` sets it in the `package.json` of the product (keeping a
version that the product set itself) and `update` brings it to each release. Each is loaded
lazily, in a chunk of its own, with the first view that draws with it (`scripts/check_chunks.py`
of CI checks the build); until it is loaded the view shows a skeleton marked `state:loading`, so
that the helpers of the end-to-end tests and the screenshots wait for it.

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
  of `AppShell`, the table or the cards of `ResourceList` (`layout`; cards on a phone,
  `phoneLayout`) and the density of its rows (`density`), the list with its card
  of `ListCardLayout` (`mode`), the dialog or the page of `FormSurface` and of the edit of
  `ResourceCard` (`mode`, `forms`); a prop overrides it, which the contract tests use to
  check both;
- the loading states are skeletons of what loads, still marked `state:loading` with
  `aria-busy`;
- a value of an item never widens the page: a grid that holds them has its column
  `grid-cols-[minmax(0,1fr)]` (an implicit column grows to the longest word), and the
  titles and the values that wrap break a word without a space (`wrap-anywhere`); a column of
  texts of a table has a `min-w-*` and the same `max-w-*`, so that the table shares its width
  by them and, while it has room, a long text does not narrow the column of a short word until
  the word breaks; the others are cut with their whole text in their title (`truncate`,
  `titleFromText`). The
  end-to-end test `layout.spec.ts` of the sample checks it with a long title, at the width
  of a phone and of a desktop;
- on a touch screen (`pointer-coarse:`) the buttons, the fields, the selects, the tabs and the
  other targets of a finger are 44 px at least (WCAG 2.5.5), without changing them for a mouse; the other states an icon, a title and a hint (the texts
  `state.<state>.title` and `state.<state>.hint`); a change that succeeded shows a toast (`toast`, the `Toaster` of
  `AppShell`);
- the tone of a status badge is `statuses` of the theme (`statusTone`), neutral by default;
  a status is shown by `StatusLabel` of `resource` (the badge of `StatusBadge` and of the
  column `status` of a list), the soft colors of a tone by `SOFT_TONES`.

In this repository `@/bazis/generated/theme` is `test/fixtures/theme.ts`, the theme of the
sample (`tests/test_design.py` checks it; write it again with
`BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_design.py`).

## The components

Their props and signatures are in the API reference of the guide (the sections "API: the
components: …" of `bazis/contrib/front/AGENTS.md`, generated from the sources).

| Component | Exports | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel`; `errorState`, `queryState`, `SkeletonLines`; `toast`, `Toaster` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell`; `Screen` (`parent`: the link back to the screen it was opened from); `ListCardLayout`, `useBesideCard`, `useBesideList`; `initColorMode`, `ColorModeToggle`, `setColorMode`; `LanguageToggle` (with more than one language); `useScreenPage`; `useWide` | `nav:<screen>` (also the link of `parent`), `nav:more` (the menu of the links that the top bar has no room for), `screen:<id>`, `action:logout`, `action:sign-in` (without a session), `action:language` (its code in `data-value`) | |
| `login-form` | `LoginForm` | `field:username`, `field:password`, `action:submit`, `action:login-<id>`, `state:error` | |
| `resource-list` | `ResourceList`; `FilterBar`; `BulkAction` | `list:<entity>` (`aria-busy` until its rows are those of its search and page, their search in `data-search`), `row:<id>` (`data-tone` and `aria-description` when highlighted) with its cells `cell:<column>` and its checkbox `select:<id>` (`select:all`), `status:<id>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>`, `field:$search`, `action:<id>`, `action:view` (`menu:view` with `toggle:<column>` and `density:<density>`), `action:prev-page`, `action:next-page`; the bulk actions `bulk:<id>`, `action:clear-selection`, `action:confirm-bulk`, `error:bulk` | |
| `empty-state` | `EmptyState` | `state:empty`, the `action:<id>` of its actions | |
| `stat-card` | `StatCard` | `tile:<id>` (its number in `data-value`), `state:<loading\|loaded\|error\|forbidden>` | |
| `dashboard` | `Dashboard`; `RecentList` | `screen:<id>` (`state:loaded`), the `tile:<id>` of `stat-card`, `link:<screen>`, `recent:<id>` with `row:<id>` and `cell:<field>`, `state:<loading\|empty\|loaded\|error\|forbidden>` of each list | |
| `charts` | `Chart`, `StatusChart`, `TimeChart` | `chart:<id>` with `value:<key>` (its number in `data-value`), `state:<loading\|empty\|loaded\|error\|forbidden>` | npm `recharts` |
| `date-picker` | `DatePicker`, `DatePickerProvider` | the input of the field it replaces (`field:<name>`) | npm `react-day-picker` (of `calendar`) |
| `resource-board` | `ResourceBoard`; `BoardDragProvider`, `useBoardDrag` | `board:<entity>`, `column:<status>` (`data-count`), `row:<id>` with `cell:<field>`, with `move`: `action:move` (`move:<status>`) and `error:move`; `action:more`, `state:<loading\|empty\|loaded\|error\|forbidden>` | capability `statusy` |
| `board-dnd` | `BoardDnd` | `state:loading` until @dnd-kit is loaded, then the marks of the board | npm `@dnd-kit/core` |
| `resource-calendar` | `ResourceCalendar` | `calendar:<entity>` (`data-from`, `data-to`), `day:<YYYY-MM-DD>` (`data-count`), `row:<id>` with `cell:<field>`, `action:previous-period`, `action:next-period`, `action:today`, `view:<month\|week>`, `action:<add.id>`, `state:<loading\|empty\|loaded\|error\|forbidden>` | |
| `resource-card` | `ResourceCard`; `RelatedList`; `CardTab` | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>`; a related section `list:<entity>`, `action:<add.id>`; `tab:<id>` (`role="tab"`) | |
| `resource-form` | `ResourceForm`; `FormSurface` | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge`; `statusOf`, `statusName`, `statusOptions`, `statusTone`, `transitName`, `transitTarget` | `status:<id>` | capability `statusy` |
| `status-history` | `StatusHistory` | none (the status of the card is the `status:<id>` of its badge) | capability `statusy` |
| `transit-bar` | `TransitBar`; `useRunTransit`; `payloadErrors` | `transit:<id>`, `state:<loading\|error\|forbidden>`, in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | capability `statusy` |
| `file-field` | `FileFieldProvider`; `FileField` (the control of a file field of `FieldInput`); `accepts`, `MAX_SIZE` | the input `field:<name>`, the field `upload:<name>` (`aria-busy` while its file uploads); its errors are `error:<name>` of `FieldInput` | capability `uploadable` |
| `live-query` | `LiveQuery` (the routes of `ROUTES` and the notifications of `CAPABILITIES.notify.resource` by default); the texts `socket.<status>` | `socket:<idle\|connecting\|open\|rejected\|unavailable>`, `action:reconnect` | capability `ws` |
| `notification-center` | `NotificationCenter`: `notifications` is `useInbox` (bazis-notify) or `useNotifications` (bazis-ws); `CenterNotification`, `NotificationSource` | `action:notifications`, `list:notifications` with `notification:<key>`, `action:read-notifications`, `action:clear-notifications`, `action:delete-notifications`, `action:confirm-delete-notifications` | none (its source) |
| `task-progress` | `TaskProgress`; `taskView`, `BG_TASKS`; the texts `bg.<view>` | `bg:<waiting\|running\|success\|error\|interrupted>`, `action:download`, `state:<loading\|error\|forbidden\|not_found>` | capability `bg` |
| `async-result` | `AsyncResult`; `asyncResult`, `RESULT_PATH`; the texts `async.<view>` | `async:<pending\|processing\|completed\|failed>`, `state:<error\|forbidden\|not_found>` | capability `async_background` |
| `map` | `ResourceMap`; `MapProvider`, `OSM_TILES`, `useMapTiles`; `LeafletMap`, `MapPointControl`; `nearFilter`, `nearSort`, `useGeolocation`; the texts `map.<text>` | `map:<entity>` (`aria-busy` while it loads) with `marker:<id>`; the map of a point field `map:<field>`, `action:locate-<field>` | npm `leaflet` (`add` sets it in package.json) |
| `screens` | `CreateFormAction` (its state `CreateFormAction.use()`), `ScreenAction`, `useDestroyCardAction` (`{action, confirm}`), `useCustomAction` (`{action, row, bulk, dialog}`); `ActionForm`, `ActionFields`, `ActionResult`; `ScreenExtension`, `extended` | those of `resource-form` in the form; `action:<id>` of a header action, of the deletion of a card and of a custom action, `action:confirm-<id>` of their confirmation; `field:<property>`, `action:submit` and `action:cancel` in the dialog of a custom action with fields; `state:loaded` (its `<form>`), `field:<property>`, `error:<property>`, `state:invalid` and `action:submit` in the form of a custom action, then `state:done`, `nav:<screen>` and `action:again` of its result | |

`resource` is what they share: `FieldInput` (the input of a field of a runtime schema, the
only one: the forms and the payloads of the transits use it; the choices of a field are a
select of their labels; a decimal, `format: decimal` of a `DecimalField` in the contract,
`contractFormat`, or a number or a string of Pydantic, is typed on one line with a point or
a comma and given as its digits with a point, `'2.5'`), `FieldValue` (with `formatValue`: the value in the language of the
interface, a choice by its label, a value by its `display`: `plain` without the separators
of its thousands, `phone` a link to call it, `{currency}`, `{unit}`, `{bar}` a `meter` of its
share; the `status` of an item of a statusy model by its name in the contract,
`statusName`; `choiceOptions`: the choices as options of a filter; `itemName`/`itemLabel`:
the `label` attributes of the resource in the contract, the names of `LABELS` for a type
that the contract does not label or an item without a value of them),
`RelationPicker`, `RelationListPicker` (the ids of the items of a to-many relationship) and
`RelationLabel` (the related resource by its route in `ROUTES`, or `path`; `hasSearch`:
whether the contract gives the resource search fields), `useListFields`/`useItemFields`
(the titles and types of the list, retrieve and update schemas, the title of the contract
without them, a title that is the name of its field or the default `verbose_name` of Django
as words, `is_overdue` as `Is overdue`, `status author` as `Status author`;
`has`: whether the schema of the user has the field), `permitted` (the permission meta of bazis-permit; allowed when
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
  date: a range; a string: `<field>__$search`; a boolean: a chip for each value, pressed
  again for every item, `aria-pressed`, in the group `field:<field>`; on a phone, below the breakpoint `sm`, each
  filter is a row of the full width, its control taking the rest of it; `options` for choices such as the statuses,
  those of the list schema by their labels for a field with choices;
  no control for a field that the backend does not list for the user; the inline
  `state:error` when they cannot be read), the sort labels from
  `RESOURCES` of the contract. An action with `permission` is shown only when the
  permission meta allows it; those with `permission: 'add'` of a list without items are in
  its empty state (`EmptyState`, with the `icon` of the entity), not in the toolbar, so that
  each is once on the screen. A filter of `options` is the select of Radix (`Select` of
  shadcn/ui), named by the title of the field, its option of every item `data-value=""`.
  Below the breakpoint `md` (`useWide` of `app-shell`) the rows are cards (`phoneLayout`,
  `composition.list_phone` of the theme), a table there scrolling sideways. A text of a cell
  (a string, the label of a related item) wraps in the width that the table gives its
  column, at least 8rem (12rem the first), never a date, a time or a number: a long value
  makes a row higher, not the table wider. The column `status` of an item of a statusy model is the
  badge of its status (`status:<id>`, the tone of the theme). The menu of its view
  (`action:view`) hides the columns but the first (their cells stay, hidden, for the
  scenarios that find a row by them) and sets the density of the rows of the table
  (`data-density` of its scroll area, whose spacing of the cells the theme gives each
  density; `density` of the theme by default). With
  `onSelectionChange` each row has a checkbox (`select:<id>`, the rows of the page
  `select:all`, in the header of the table or above the cards), which never opens it; the ids of other pages stay selected. `filter` (the filter of the screen) is combined (AND) with
  those of the user; `rowTone(row)` highlights a row in a tone of the theme (`Tone` of the
  generated theme: its soft color and a bar of the tone) and `rowToneLabel(row)` is its
  `aria-description`, the meaning in words. With `bulk` (`list.bulk` of the specs) the rows
  are selectable without `onSelectionChange` too, and a bar above them, while rows are
  selected, has their number, a button per action (`bulk:<id>`; with `permission`, run only
  on the rows of the page that the meta allows) and `action:clear-selection`; an action asks
  to confirm (`action:confirm-bulk`), then runs on each item in turn (`run`, a request each:
  the core has no bulk endpoint; a transit without a payload, `useItemsTransit` of
  `@/bazis/react/statusy`, or a deletion; nothing is read per row first, the backend refuses
  a row it does not allow), shows its progress, clears the selection when all succeeded (a
  toast) and keeps the refused rows selected with `error:bulk` otherwise (how many, and the
  errors).
- **`app-shell`**: a link with `requires` is shown once the backend allows the user what it
  requires (`useCan` of the hooks: the runtime schema of the list of `path`, or
  `for_create` of its list, or a custom action in `custom_actions` of its list by its key in
  the contract, `customActionKey(path, '<name>')` of `resource`; `filters`: those fields in
  `route_filter_fields/` of the user), never before.
  The top bar never widens the page: its row shows the links it has room for and the
  others, from the first that does not fit, in the menu `nav:more` (a dropdown menu of
  Radix, used with the keys; a group with its heading, the same `nav:<screen>` once it is
  open), which is shown as the current link (`data-current`) while the current link is in
  it. The row is measured on a hidden copy of it laid out whole (without its marks) when
  its place or the copy changes its size (`ResizeObserver`: the fonts, the language and the
  links that the backend allows change it) and when the current link changes; without
  `ResizeObserver` (jsdom) the row shows every link. Below `md` the drawer has every link.
  `ListCardLayout` renders the screen of a list and, as its child route, the
  screen of its card: next to the list on a wide screen (`split`; the list keeps its state
  and shows only its `compactColumns`, the first two by default, while the card is open) or
  in its place (`pages`).
  `Screen` hosts a form page of `FormSurface`, which takes the place of its content; its
  `parent` is a link back before its title (`nav:<screen>`): a breadcrumb from the
  breakpoint `xl`, an arrow named by the parent below it.
- **`empty-state`**: nothing to show, with the actions that fill it (`state:empty`); the
  icon of the entity, a title and a hint (`state.empty.title`, `state.empty.hint` by
  default).
- **`stat-card`** (a figure of a dashboard): the aggregates of the core over the list of
  `path` with its `filter` (a list of one item with `meta.aggregates`, bazis 2.17): the
  number of its items, or the `{sum}`, `{avg}`, `{min}` or `{max}` of a field of `value`
  (a sum in the `currency` or a quantity in the `unit` of its `display`, an average of a
  decimal with the decimal places of its field, `places` of the contract, a date of `min` or
  `max` as a date); `tile:<id>` with the number in `data-value` once loaded (a date as its
  ISO text), the states of the list (the message of a 400 `ERR_AGGREGATE` as its error);
  `onOpen` makes the whole tile a button named by its label.
- **`dashboard`** (`primitive: dashboard`, the home of the starters): its title in the header
  of the screen, or as a hero (`data-slot="hero"`, the default of a portal), the tiles of
  `stat-card` (a tile of a `value` takes the whole row of a phone, a count half of it), the
  links to the other screens of the navigation (`link:<screen>`, each once
  the backend allows what it `requires`; the numbers are those of the tiles), the
  charts it is given and the last items of route sets (`RecentList`, `recent:<id>`: a list
  of `limit` items in the order of `sort`, a row `row:<id>` with a cell `cell:<field>` each, a
  button when it opens). Never a path of the API or the name of a resource; the screen is
  marked `state:loaded`, so that a dashboard of links only has a state too.
- **`charts`**: the number of the items of a route set, or the `{sum}` or `{avg}` of a
  field of `value`, per status (`StatusChart`, the statuses of the workflow by default, the
  initial one first, `workflowStatuses` of `resource`) or per day, week or month of a date
  field (`TimeChart`, the last periods to the current one; the bounds `<field>__gte` and
  `<field>__lt` of the range are dates, of a date-time field too, which the backend reads in
  its time zone, `TIME_ZONE` of the project, as it groups the items: the axis is in that time
  zone), one list of one item with the groups of the aggregates of the core (`group=status`,
  `group=<field>:day|month`; the days folded into the weeks of the language; an average is a
  sum and a count, the group without a value never shown), drawn by recharts (`chart-view.tsx`,
  lazy) as a ring, bars or a line in the colors of the series of the theme (`--chart-1` …
  `--chart-6`), a status in the color of its tone (`statuses` of the theme, that of its badge,
  `--color-<tone>`; `tone` of a value of `Chart`); `chart:<id>` with the states of its list (`empty` when every value is 0, the message of a 400 `ERR_AGGREGATE` as its error) and
  each value as text, `value:<key>` with its number in `data-value` (the legend of a ring, a
  list for the screen readers under bars and a line).
- **`date-picker`**: under `DatePickerProvider`, the date fields of the forms and the ranges
  of the date filters (`DateInput` of `resource`, a plain `<input type="date">` without it)
  are the input of the browser, marked as the input it replaces (a scenario fills it with
  `2026-10-07`), with a button that opens the month of the date in a popover (`calendar` of
  shadcn/ui on react-day-picker, `calendar-view.tsx`, lazy; the names of the months and the
  days of `Intl`, the first day of the week of the language). A read-only input has no
  button.
- **`resource-board`** (`primitive: board`, a statusy model): a column `column:<status>` per
  status (`columns`, those of the workflow by default; the number of its items in
  `data-count`), a list of one page per column filtered by its status (`action:more` adds a
  page), the filters of the user as those of a list (`FilterBar`); a card `row:<id>` with its
  title (the button that opens it: the whole card), its fields `cell:<field>`, a badge of a
  boolean field while it is true (`badge`) and, with `move` (not by default), its menu `action:move`: the
  transits that the user may run on it now (`meta.for_transit` of the list of its column,
  bazis-statusy 2.13, in the same request: their ids, without the validators, whose refusal
  is the 422 of the transit; a card without one has no menu and cannot be dragged),
  `move:<status>` (the status the transit leads to; the transit itself when the contract
  does not know it). A click on the menu never opens the card. A transit whose action
  takes a payload (the contract says which, `TRANSITS`) asks for it in the dialog of `useRunTransit` of `transit-bar`, which reads the item first; the columns
  are read again after it. The refusal of a transit run without the dialog (by the menu or a
  drop) is shown above the columns, `error:move`. **`board-dnd`** (`BoardDnd` around a board
  with `move`): a card dragged with
  the mouse (8 px) or a long touch onto a column runs the transit of the item that leads to
  its status, if the user may run it now (a toast otherwise); @dnd-kit is a chunk of its
  own (`dnd-view.tsx`), the boards below it in the loading state until it is loaded (shown
  without it first, they would be mounted again, losing an open menu and their filters).
- **`resource-calendar`** (`primitive: calendar`): the items of a route set on the days of a
  date or a date-time field (to the day of `end`, an item that spans days; the days of a
  date-time in the time zone of the browser), a month (whole weeks from the first day of
  the week of the language) or a week at a time (`views`, `view:<view>`): `calendar:<entity>`
  with the days it shows in `data-from` and `data-to`, `action:previous-period`,
  `action:next-period` and `action:today`. A day `day:<YYYY-MM-DD>` has the number of all its
  items in `data-count` and its first three items in a month (all in a week), `row:<id>` with
  a cell `cell:<field>` per field of `label` (the `label` of the resource of the contract by
  default), each on a line of its own, cut to the width of the day with its whole text in its
  title, the first after the time of a date-time on the day it starts (on the next line when
  they do not fit together), in a tone of the theme while the boolean field of `tone` is
  true; a week at the width of a phone is a list of its days; a click on a
  day selects it, and the list of the selected day (today at first) has all its items,
  `row:<id>` again (below `md` the days of a month have a dot and only the list has the items,
  so that no hidden copy of a row is in the page). One
  list of the period (`<field>__gte`, `<field>__lt`; the first 500 items, a warning when
  there are more), `state:empty` with the days still shown. `add` is the button
  `action:<id>` (when the backend allows the create) that gives the screen the value of the
  field on the selected day, which its create form starts with: the day of a date, the start
  of the day in the time zone of the browser of a date-time, whose time the user sets.
- **`resource-card`** reads the item with `crud_actions` and `custom_actions` and its fields from
  `schema_retrieve/` of the item; its heading is the name of the item (`itemName`), else the
  values of its `label` fields (the first two fields of the sections by default), never its
  id while one of them has a value; with `edit`, an edit button (when the backend allows the
  change) opens the form of the update of their fields in a dialog or as a page
  (`FormSurface`). `RelatedList` is a related section of a card: the list of a related
  resource filtered by its to-one relationship to the item (`Filter.where(relation, item)`)
  and `add`, its create form (`ResourceFormBody` in `FormSurface`) with the relationship
  fixed to the item, shown when the backend allows the create (`for_create`); an item added
  reads the item of the card again (`useRefreshItem(itemPath, item)` of the hooks: its query
  keys, so in the card or after it alike). `children` (under the heading) and `after` (under
  the sections and the tabs: the related sections and the history of a card without tabs)
  may be functions of the item and its permission meta (`StatusHistory` takes the item;
  `permitted(meta, 'change')` for a section of the product).
  With `tabs` (`card.tabs` of the specs) the sections are in tabs of Radix (`tab:<id>`,
  `role="tab"` with `aria-controls`), each with its sections and its `content` (a related
  section, the history: a function of the item and its meta, as `children`), a section that
  no tab names in the first one; `children` (the transits) stay above them. Every panel stays
  in the page, hidden while its tab is not selected, so that a scenario finds what it acts
  on (the helpers of the end-to-end tests select its tab first).
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
- **`transit-bar`** shows the transits of `meta.state_actions` of the item (disabled with
  the errors of their validators when restricted), in the request of the card
  (`ITEM_META` of `resource`: the meta of `ResourceCard`); a transit whose action takes a typed payload opens a
  dialog with its fields, and the errors of a 422 (`/payload/<name>`) are shown by field.
  `onDone(null)`: the user can no longer view the item. `useRunTransit(path)` runs the
  transit of any item of the route set with this dialog (the board): the dialog of a payload
  reads `state_actions` of the item once as it opens, in the request of its card
  (`ITEM_META`: no request beside the card that shows it), `state:loading` without fields until then,
  so that the fields have the titles of the backend in the language of the user, and the
  hint of the transit (the JSON Schema of `TRANSITS` of the contract if it cannot be read);
  a transit without a payload reads nothing.
- **`screens`** is what the screens generated from the specs use besides the components of
  their primitives: the create form of an action (`CreateFormAction` in `FormSurface`, opened
  by `onOpen`, the `onClick` of an action, or `onOpenWith` with the values that it starts
  with, which the user may change, the day of a calendar; closed when saved or cancelled,
  then `onSaved`), an action of the header of a
  screen (`ScreenAction`, shown once the backend allows what it `requires`), the deletion of
  the item of a card (`useDestroyCardAction`: `action`, an action of `ResourceCard` shown when
  the user may delete the item, opens `confirm`, the dialog to render in the screen, whose
  button `action:confirm-<id>` deletes it once, whatever the clicks; a toast after it, then
  the route `then`; a refusal is a toast of its error, the card stays), a custom action of
  the route set or of its items (`useCustomAction`, by its `target`: `action`, a button of a card or of the toolbar of a list
  shown when `custom_actions` of the meta has it, `row` and `bulk`, shown on the rows that
  the user may change or delete as its `access_action` requires, and `dialog`, the dialog of
  its `fields` or of its confirmation; once per item at a time; done, a toast, the queries of
  the resource refetched), the form of a custom action of the route set as a page
  (`ActionForm`: the fields of its body, `ActionFields`, read from the contract, never from a
  runtime schema, a property named as a relationship of the resource its picker; done, its
  `result` from the JSON answer, `ActionResult`, or a toast and `onDone`)
  and the extension of a generated screen (`ScreenExtension<P>` of the
  props `P` of the component of its primitive, so that the asset requires none of them;
  `extended` joins the actions, `actions`, `rowActions`, `bulk`, and the `children` and
  `after` of the extension with the generated ones, and replaces the other props).

## A screen

```tsx
import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceList } from '@/bazis/ui/resource-list';
import { statusOptions } from '@/bazis/ui/status-badge';

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
