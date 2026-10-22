# bazis-front

The frontend layer of Bazis, a Python package (`bazis-front`, module `bazis.contrib.front`)
like the other Bazis packages. Its TypeScript code is not published to npm: it lives in
`bazis/contrib/front/assets/<asset>/`, is shipped in the wheel as package data and is
copied into the frontend of a product. The layers and the principles are in
`docs/architecture.md`; the guide for the agents that build a product is
`bazis/contrib/front/AGENTS.md`.

The package code is in `bazis/contrib/front`, the sample project used by the tests is in
`sample/`, the tests are in `tests/`.

## Python

The tests need PostgreSQL 15 or newer with PostGIS, and Redis (see
`.github/workflows/tests.yml`): the contract reads the roles and the transits of the sample
from the database. Run them from the `sample` directory:

```bash
cd sample
export BS_DEBUG=true \
BS_SECRET_KEY=local-secret-key-that-is-long-enough-0123456789 \
BS_DATABASES__DEFAULT__HOST=localhost BS_DATABASES__DEFAULT__PORT=5432 \
BS_DATABASES__DEFAULT__NAME=bazis BS_DATABASES__DEFAULT__USER=postgres \
BS_DATABASES__DEFAULT__PASSWORD=postgres \
BS_CACHES__DEFAULT__LOCATION=redis://localhost:6379/1
python manage.py makemigrations --check --dry-run
python -m pytest ../tests -o addopts="" -p no:cacheprovider
```

Lint: `ruff check bazis tests sample scripts`.

The sample (`sample/`) installs bazis-users, bazis-authing, bazis-permit, bazis-statusy,
bazis-uploadable, bazis-ws, bazis-notify, bazis-author with bazis-bg, bazis-async-background and
bazis-async-request (the `test` extra) with a project app `users` (its route set of the users,
`users.routes.UserRouteSet`, is that of bazis-users with `search_fields`, the username and
the first and the last name, by which the frontend labels a user, which the pickers of the
assignee and of the watchers search: the core 2.9 answers a search of a route set without
them with 400; a signed-in user views and links every active user, the team, in its list and
items and in the relationships of the other routes, `restrict_queryset`, while its changes
keep the rule of bazis-users 2.9, himself only: `tests/test_watchers.py`) and a statusy model `tasks.Task` (searched by its title; its `watchers` are a
many-to-many field to the users, edited in the forms with `RelationListPicker` and sent with
the task, the scenario `manager-adds-a-watcher`; its `priority` has choices, whose
labels the runtime schemas give translated, `enumDict`, which the frontend shows, offers and
filters by; its `location` is a geography `PointField`, GeoJSON in the API and `format: point`
in the contract, on the map of the list of the tasks (`list.map`), written through the API by
the scenario `manager-places-a-task` (`e2e_data` places no point); its `due` is a date-time
that the create takes, the field of the calendar of the tasks (filtered by the assignee and
the priority) whose `add` at 09:00 the scenarios run (`e2e_data` creates the task of the
viewer due now); its `hours` is a `DecimalField` (`type: string` in the spec, the format
`decimal` in the contract, shown with `display: {unit: h}`, typed with the decimal comma by
the scenario `manager-sets-the-priority`), whose sum the home shows in the tile `review-hours` (2.5, the hours that
`e2e_data` gives the task of the viewer) and in the chart `hours-by-month` (the aggregates
of the core); its route set
has the custom action `count` (`TaskRouteSet.action_count`, `POST /api/v1/tasks/task/count/`,
a JSON body `{priority}`, 403 without a user), which queues `tasks.bg.count.CountTasks` and
answers with the id of its task, the reference of `client.action`/`useAction` captured by
`tests/test_react_fixture.py`, and the custom action of an item `escalate`
(`POST /api/v1/tasks/task/{id}/escalate/`, a JSON body `{priority}`, high by default, with
`access_action` change: listed in `custom_actions` of the drafts of the manager only, 403 on
the others, `tests/test_escalate.py`), and the custom action `suggest` open to anonymous
users (`public=True`, `POST /api/v1/tasks/task/suggest/`, a JSON body `{title}`), which
creates a task: the action of the public screen `public-tasks` of the anonymous role
`visitor` of the specs (the permit role `viewer`, `for_anonymous`), whom bazis-permit refuses
the create route (`tests/test_suggest.py`), also from the public form of the action
`suggest-task` (`primitive: form` with `form.action`, its result showing the `task` of the
answer, whose `title` the scenario `manager-opens-a-suggested-task` remembers in the session of
the guest, `as` and `remember`, to open the task in that of the manager), and the custom action `export` (`POST /api/v1/tasks/task/export/`, a JSON body
`{priority}`, `access_action` view, `tests/test_export.py`), which answers the CSV of the tasks the user views, `tasks.csv` (a
`response_class` of `text/csv`: `file` of its custom action in the contract), saved by the form
of the action `export-tasks` (its result showing `{filename}`), the custom actions of the
specs of the sample; its steps, `tasks.Step`, a `PermitRouteBase` route set, are the related section
`card.related` of the card of a task, added there with the task fixed, to a draft only:
`Step.validate_item`, `tests/test_steps.py`), whose `attachment` is a file of bazis-uploadable (a foreign key to
`uploadable.FileUpload`, uploaded through the bundled `FileUploadRouteSet` of
bazis-uploadable, routed as it is: it requires a user and gives him only his own files,
also to the other routes, so the core refuses as the attachment of a task a file of another
user, 403 `ERR_RELATION_ACCESS`, and leaves it out of `included`: `tasks.routes.TaskRouteSet`
has no check of its own), and whose `photos` are the files that a guest attaches to the task he
suggests (`photos: list[UploadedFileId]` of the body of `suggest`: the anonymous uploads of
bazis-uploadable 2.8, on in `sample/project.env` with a size limit, read by the team through
`files_visible`; `tests/test_suggest.py`); the auth endpoint and the password service of
bazis-authing are routed under `/api/v1/authing/`, so that the login of the frontend of the
sample is that of bazis-authing (the token endpoint of bazis-users stays). The sample is in
English and Russian (`BS_LANGUAGES` of `sample/project.env`, `LANGUAGE_CODE` `en`): the
Russian texts are the catalogs of the project, `sample/tasks/locale/ru/LC_MESSAGES/django.po`
and `sample/locale/ru/LC_MESSAGES/django.po` (the tag of `users/router.py`), with their `.mo`
(all committed, as in the other Bazis repositories), kept by `bazis_messages` of the core:
after a change of the texts run `python manage.py bazis_messages make` in `sample/`, add the
translations of what it lists as `untranslated` or `fuzzy` to `sample/locale/translations.json`
and run `python manage.py bazis_messages apply locale/translations.json --check` (never edit
the `.po` files with a script); also the Russian names of its roles, statuses and transits.
The user model of the sample has a language of its own
(`UserLanguageMixin` of bazis-users, `users.profile_language`, the migration
`sample/users/migrations/0002_user_language.py`), which `tests/test_profile_language.py`
and the end-to-end test `frontend-overlay/e2e/custom/profile-language.spec.ts` check
(`e2e_data` clears the language of the test users). The roles (with their permission
groups) are declared in `sample/tasks/roles.py`, the statuses and transits in
`sample/tasks/workflow.py` (bazis-permit and bazis-statusy 2.9; the payload of `reopen` is the
id of a user, `relation: user` of the specs, asked for with the picker of the assignee in its
dialog, `manager-reopens-a-task-for-a-user`): `migrate` and the flush
of a `transaction=True` test apply them, so no fixture of the tests creates them (the
pytest plugin of bazis-test-utils 2.5 also installs the triggers of `pgtrigger`), and
`tests/test_e2e.py` checks the contract of the migrated database against `sample/spec/`;
the data migrations `0005_workflow` and `0006_workflow_ru` that created them before are
kept as history without effect, and the e2e data module is `tasks/e2e.py`, not
`workflow.py`. The roles have
field permissions (the viewer does not see the report, the manager may not change it) that
the scenarios check with `field_absent` and `field_readonly`. `manage.py e2e_data` is the
e2e data command that bazis-front recommends to products (the module AGENTS.md, "The
end-to-end tests"): on top of the migrations it creates only the test users of the roles,
with their first and last names (`Mary Manager`: the labels that the scenarios pick and find)
and their password set to `E2E_PASSWORD` at every run, and the task that the scenario of the
viewer opens, after it deleted the tasks of the previous runs (every run starts from the
same data); it never creates a role, a status or a transit. The user model has
`UserWsMixin`, `sample/router.py` routes the socket of bazis-ws
(`router.register('bazis.contrib.ws.router')`, `/api/v1/ws`, where the export sees it) and
`sample/main.py` adds `AsyncRequestMiddleware`; `tasks.models.Task` publishes with the
helpers of bazis-ws 2.6 (after the commit and robustly: Redis down does not fail the
change) every save of a task to the common channel (`publish_changed`, `{"resource"}` only:
an invalidation hint, never data), and notifies the assignee of a finished task with
`notify` of bazis-notify (the type `tasks.finished` of `tasks/notifications.py`, stored, in
the language of his profile, delivered live by bazis-notify itself: never published a
second time), which the scenario `manager-is-notified-of-a-finished-task` expects (the
bell lists it with `useInbox`; `e2e_data` only adds, so a notification of a previous run stays,
which `expectNotification` does not count: it takes those since its test started;
`tests/test_notify.py` replaces the Redis of bazis-ws). The sample has no Kafka and
no `bg_scheduler`: a request with `X-Async-Background` runs at once
(`async_request.W001` is silenced in `sample/settings.py`), and the task of bazis-bg of the
sample (`tasks.bg.count.CountTasks`) is run by the tests in their process; the 202, the
result route and the statuses on the socket are captured with the publication to Kafka
replaced (`tests/test_react_fixture.py`), the rest of the background work is covered by the
tests of the hooks and the contract tests of the components. The
title of a task is not empty (`MinLengthValidator`), for the scenario of a failing
submit. `sample/spec/` is a complete valid spec of the sample: the permissions
of the declared roles cover its `access`, and `tests/test_spec.py` checks it against
the contract. `sample/frontend-overlay/` holds the code of the screens of the sample (the
extension of the list of the tasks, `extend: true`: what its spec cannot say, the counts by
status, the custom action `count` and the height of its map; no custom screen) with the texts
it uses (`src/i18n/`) and
`e2e/` (`fixtures/`, the files that the scenarios upload, and
`custom/`, the tests of what no scenario says: the custom actions, the downloads, the
language, the card read again after a step is added in the section after it, a row found by
the label of a related item read after the rows (`late-labels.spec.ts`), the layout with the styles of a product, `layout.spec.ts`: the foot of the sidebar
with the tools of the sample, the filters of the list of the tasks, a date range among
them, at the width of a phone, and a long title that no screen lets widen the page; the public screen of the guest, its sign-in
and the layout kept across it and a screen of a session, `public.spec.ts`), copied over a frontend made from the sample by the `e2e`
job of CI.

### The contract export

- `manage.py bazis_front` is one command with argparse subcommands
  (`management/commands/bazis_front.py`); a subcommand is a `handle_<name>` method.
- `contract/export.py` renders the files (`render`), compares them byte for byte
  (`stale_files`) and writes them; `contract/openapi.py` is the canonical JSON,
  `contract/resources.py` the resources read from the OpenAPI
  (and, from the model, the `PointField`s: `format: point` of their GeoJSON object, which
  the OpenAPI gives for every geometry alike; the `DecimalField`s: `format: decimal` and
  `places`).
- The export is in `LANGUAGE_CODE` whatever the language of the process: `render` reads the
  OpenAPI under `translation.override` (the core builds it per language), and the names of
  the roles, statuses and transits are maps of every language of `LANGUAGES`
  (`capabilities.translated`); `tests/test_contract.py` renders under two process languages
  and expects the same bytes. `CONTRACT_FORMAT` changes with the shape of contract.json (2:
  the languages; 3: the search fields of the resources, `search`, read from the route set
  with `route_search_fields` of the core (bazis 2.10.1) because every list of the OpenAPI
  has the parameter, and the selectors of the permission
  models, `permit.selectors`, those of `get_selector_fields` of bazis-permit, which P020
  checks; 4: `reverse` of the relationships whose foreign key or many-to-many field is on
  the related model, read from the model, which a `ResourceForm` without `fields` leaves
  out; 5: `title` of the fields, their titles in the OpenAPI, which S018 compares with
  their names, and `label` of the resources, the attributes that label an item, the groups
  of `resources.LABEL_FIELDS`, which S017 and S019 read; 6: `create` of the resources, the
  attributes and the relationships of the request of their create route, which S034 reads,
  and `custom_actions`, the routes of the kind `other` of their route set (but the ids of
  the list of the core, the transits and their history of bazis-statusy 2.15,
  `resources.NOT_CUSTOM`) with the standalone JSON
  Schema of their body, which S032 reads; 7: `public` of the custom actions, open to
  anonymous users, which S046 reads; 8: the format `decimal` of the attributes of a
  `DecimalField`, read from the model, which S049 reads; 9: `places` of those attributes,
  the `decimal_places` of the model, with which `StatCard` rounds an average, and `response`
  of the custom actions, the standalone JSON Schema of their JSON answer 200, which S053
  reads; 10: `token_param` of the section `authing` removed, the store token of
  bazis-authing 2.8 being in no URL).
- `capabilities/__init__.py` lists the capabilities with their distribution and app; a
  module `capabilities/<name>.py` returns its section (`section()`) and is imported only
  when the package is installed and its app is in `INSTALLED_APPS` (`app=False`: the
  package is not a Django app, bazis-ws, and its installed distribution is enough). The
  export imports `bazis.core.app`, not the main module of the project: what the main
  module adds (`ws_route`, a middleware) is not seen, so `ws.path` is null unless the
  socket is routed in the router module (or BAZIS_APP_MODULE), and `async_request` states
  its header only.
- Bazis imports every subpackage of `bazis.contrib` while it configures the settings: the
  `__init__.py` of a subpackage must not import models, the database or `bazis.core`
  modules that do.
- `checks.py`: `front.W001` (stale contract or generated files of the frontend, the
  comparison of `contract --check`: `export.stale`), `front.I001` (not checked: the database
  is not migrated); the command fails with `front.E002` in that case. `front.W006`: an
  installed package of a capability older than `minimum` of `capabilities.CAPABILITIES`
  (the version whose protocol the assets follow; a warning, never blocking `migrate`;
  the error `C004` of `check`). `front.W002`: an
  issue of the specs (see below). `front.W003`: stale end-to-end tests (`e2e --check`,
  without the database; only when the lock has `e2e` and the specs have no errors).
  `front.W008`: a stale `shots.ts` (`shots --check`, only when the lock has `shots` and
  the specs have no errors); `front.W009`: a report of the last screenshots with errors, or
  none that can be read (not stale: no command in `COMMANDS`, so `front_status` of bazis-mcp
  lists it apart).
  `front.W004`: copies of another version (`update --check`: `update.stale`, without Node
  and the database). `front.W007`: copies changed in the frontend (`update.changed`: a file
  of a vendored asset or a component whose hash differs from the lock, not the template;
  kept apart from W004 because a changed copy is not stale and may be silenced alone). `front.W005`: a stale theme (`design --check`, without the database;
  only when the lock has `design` and the design has no errors). `front.W010`: stale,
  edited or missing generated screens, or the components that they import missing
  (`screens --check`, without Node and the database; only when the lock has `screens` and
  the specs have no errors), or none at all while `src/app/router.tsx` imports them
  (`validate.needs_screens`: a frontend made before them, once `update` gave it the router of
  the template; before, its router is its own, and generated screens would be refused
  beside its own, S029; `update` says it too). A new check id gets its pitfall in `bazis_manifest.toml`
  (`tests/test_manifest.py` checks that the ids exist).

### The specs

- `spec/schemas/*.schema.json` (Draft 2020-12) are the formats: `product`
  (`bazis-product/1`), `screen` (`bazis-screen/1`), `design` (`bazis-design/1`, theme.yaml)
  and `tokens` (a subset of DTCG). They are package data, copied to `spec/schema/` of a
  product by `init` (`spec/create.py`, with the starters of `spec/starters/`: `product.yaml`,
  the home `screens/home.yaml`, a dashboard without tiles, which S026 leaves alone until
  `product.yaml` declares entities and `init` generates, and the design of the preset). The
  `packages` enum of the product schema is `capabilities.CAPABILITIES` (tested).
- `spec/validate.py` loads the files (YAML with the implicit types of YAML 1.2: no
  timestamps, only true/false booleans; JSON), checks their
  shape, then calls `refs.py` (the references, the comparison with contract.json),
  `scenarios.py` (the scenarios followed screen by screen), `access.py` (`access` compiled to the permissions
  of bazis-permit; the grammar is in its docstring, from bazis-permit and bazis-statusy)
  and `design.py` (the tokens of the presets and their defaults, the layers of the tokens:
  the preset, then the starters that theme.yaml names, `spec/starters/design/{palettes,
  fonts,shapes,surfaces}/<name>.json`, then tokens.json; the CSS variables of the tokens,
  the dark mode of the group `dark` and `mode`, the tones of the statuses, the icons of the
  entities with a screen, the contrast of the text colors computed by `color.py`:
  `tests/test_spec.py` checks that every palette reaches WCAG AA in both modes, and
  `tests/test_design.py` that every combination of the starters of both presets has no
  issue). The defaults of the tokens keep the look of a design that names no layer (one
  of an older version): the shadows, the transitions and the monospace fonts of
  Tailwind. Only the documents valid against their
  schema are checked further, so that one broken file does not cascade. The names of the
  icons of the specs are checked (D013) against `spec/lucide-icons.json`, package data
  written by `scripts/gen_lucide_icons.mjs` from the lucide-react of the workspace of the
  components (the version of the template), so that `check` needs neither Node nor the
  network. The texts of the specs (`$defs/text` of the schemas: a key of the dictionaries,
  a text, or a map of the languages) are found in the documents by their schema
  (`validate.text_paths`) and checked against `languages` (S027); `check` also reads the
  code of the screens of the product in `frontend/src/screens/` (`custom`, `extend`: S028,
  S029, S031) and its router, which routes the public screens once it routes the generated
  ones (`PUBLIC_ROUTES`: S048).
- `spec/issues.py` has the codes (`CODES`, with their severity); a code never changes its
  meaning. A new code gets a case in `tests/test_spec.py` (`CASES` must cover every code)
  and a row in the table of `bazis/contrib/front/AGENTS.md` (tested).
- `bazis_front check` (`--json`, `--layer`) exits 1 on errors. No subcommand runs the
  system checks (`requires_system_checks = []`): they would repeat the issues of each
  subcommand, and the warnings of other packages would mix with its output.
  `bazis_front status` (`--json`) runs the checks of `checks.STATUS` itself and shows them
  with the assets of the lock and its generated files, each issue with the subcommand that
  brings up to date what it reports stale (`checks.COMMANDS`, which `front_status` of
  bazis-mcp groups them by); it exits 0. A new check of the state of the frontend is added
  to `STATUS`. `checks.check_spec` reports each error as the warning
  `front.W002`, and all the warnings as one `front.W002` with the count of each code (every
  management command prints the system checks; `bazis_front check` lists them): an error
  there would block every management command (`migrate`, `contract`) through
  `SystemCheckError`.
- `spec/scenarios.py` is the only reading of the steps of a scenario: its walk reports the
  issues and returns the steps (`Step`: the name, the value, whether it starts the edit of
  a card, the screen it leads to, whether a `submit` is refused: `fails`, the next `expect`
  has an `error` or a `state` of a failure, the one rule of the walk and of the generator; a
  refused submit keeps its form open, without its `then` and with no other `screen`
  expected, and every other submit is generated as `submit({saved: true})`, which fails the
  test when the form stays open; whether an `open_item`, `select` or `move` finds an item that
  the scenario created: `created`, its `where` has the values filled in a create form of the
  scenario before, generated as `created: true`, so that the test takes the item it created
  and not one of a previous run, the scenarios running again on a database that keeps them;
  P033 and P034 report the scenarios that would not; the sessions of `as`, each with its
  `_State` and its card, and the values of `remember`, `$<name>`, are walked there too: `taken`
  of a `remember` is the names that a next step takes, the only constants that its test
  declares, the lint of a product refusing an unused one) in
  `validate.Result.specs`, which
  `spec/e2e.py` turns into calls of the Playwright helpers. A new step or `expect` key changes both, the schema, the
  helpers (`assets/playwright`) and the table of the steps in `bazis/contrib/front/AGENTS.md`.
- `spec/theme.py` (`bazis_front design`, also run by `init`) compiles the design into
  `frontend/src/bazis/generated/fonts.css` (the imports of the fonts of the tokens, their
  `$extensions` `bazis.import`: the `@fontsource` packages of the template or a stylesheet
  of Google Fonts, imported first by `src/index.css`, because an @import after a rule is
  dropped), `theme.css` (the variables of the tokens and of the dark mode,
  the density, the Tailwind theme, the base styles of the preset) and `theme.ts` (`THEME`,
  read by the components) from a design without errors; the text depends on the design
  only, so `--check` and `front.W005` render again and compare byte for byte, and the lock
  records the hashes (`design`). `tests/test_design.py` compares the theme of the sample with
  `assets/ui/test/fixtures/theme.ts` (write it again with `BAZIS_FRONT_WRITE_FIXTURES=1`).
- `spec/e2e.py` (`bazis_front e2e`) renders `frontend/e2e/generated/<scenario>.spec.ts` and
  `product.ts` from specs without errors; the text depends on the specs only, so `--check`
  and `front.W003` render again and compare byte for byte. The lock records the hashes of
  the specs and of the generated files (`e2e`); the files of the lock that the specs no
  longer generate are deleted. `tests/test_e2e.py` compares the tests of the sample with
  `assets/playwright/generated/` (the fixture of the helpers: write it again with
  `BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_e2e.py` after a change of the
  generator or of the specs of the sample). Once the lock has `screens`, a destroy is
  confirmed in its dialog (`Step.confirm`, `app.confirm(id)`, which goes on when a
  hand-written screen shows no dialog).
- `spec/screens.py` (`bazis_front screens`, also run by `init`) renders
  `frontend/src/screens/generated/` from specs without errors: a module per screen that is
  not custom (`<id>.tsx`), `entities.ts`, `screens.ts` (`routeTo`), `routes.tsx`
  (`PUBLIC_ROUTES`, the screens with an anonymous role in their `roles`, `refs.is_public`,
  outside `RequireSession` of `src/app/router.tsx` of the template, and `SCREEN_ROUTES`,
  the others, inside it; custom screens by `lazyScreen` of their modules), `navigation.ts`,
  `messages.ts` (`GENERATED_MESSAGES`: every text of the specs by the key of its place,
  merged under the dictionaries of the product by `src/i18n/index.ts`), `product.ts`,
  `providers.tsx` and `tools.tsx`. The code is printed by `spec/tsx.py`, a port of the
  printer of prettier (its documents, groups, conditional groups and the rules of the
  assignments, the arguments, the arrows and JSX that the generator uses), so the text is
  that of `prettier` 3 of the template without Node: the `frontend` job checks it with
  prettier. Every primitive is generated with every key of its spec (a key is a prop of its
  component, nothing inferred); a screen with `extend` takes its extension
  (`extended<Props>` of the props of its component, `extension.before`/`after`/`actions`:
  the extension is a constant of the product, so the generated hooks stay those of the
  screen); a screen of an item has `:id` in its route (S038). `--check` and `front.W010` render again and compare byte
  for byte; the lock records the hashes of the specs (product.yaml, the screens,
  theme.yaml) and of the files (`screens`); a file edited since is not overwritten without
  `--force`, the files of the lock outside `src/screens/generated/` are never touched, and
  the components that the code imports are copied (`copy.add_assets`). It refuses a screen that is not `custom` and has
  `src/screens/<id>/index.tsx` (S029) also on the first run, when the lock has no `screens`
  (`validate(generating=True)`). `check` tells it from the same moment as soon as the router of the
  frontend imports the generated screens (`validate.needs_screens`), before the lock has `screens`;
  while the router is the product's own, `check` says nothing. `tests/test_screens.py`
  compares the screens of the sample with `tests/fixtures/screens/` (write it again with
  `BAZIS_FRONT_WRITE_FIXTURES=1`) and renders the kitchen sink of
  `tests/fixtures/kitchen-sink/` (the screens that the generator composes beyond the
  sample, with the code of their extensions and of custom screens in its `src/`, which the
  `frontend` job also builds), an extension and a custom screen of every primitive. The names that the code gives
  the ids (components, entity constants, the states of the actions) are those of
  `spec/names.py`, whose clashes the checks refuse (P032, S033).
- `spec/shots.py` (`bazis_front shots`) renders `frontend/e2e/generated/shots.ts` from specs
  without errors (every screen as the first of its roles, in each color mode of the theme,
  and as each other role in the first color mode;
  the screen of an item through the first item of a screen that opens it; a list also
  searched for nothing and with its create form open, and a calendar with its add form open,
  as the first of its roles that `access` lets create), checked and
  locked like the end-to-end tests (`--check`, `front.W008`, the lock `shots`; the errors of
  the last report, or no report that can be read, are `front.W009`), runs it with
  `npx playwright test --config playwright.shots.config.ts` (`BAZIS_SHOTS_DIR` set to
  `frontend/.scratch/shots/`) and gathers the results that the helper `shoot` writes there
  into `report.json` (`collect`: a shot without a result is V001); exit 1 on errors, 2 when
  nothing was shot or without Node. It is not a `.spec.ts`, so `npm run e2e` never runs it.
  `tests/test_shots.py` compares the shots of the sample with
  `assets/playwright/shots/shots.ts` (write it again with `BAZIS_FRONT_WRITE_FIXTURES=1`) and
  replaces Node and Playwright for the run; the codes `V0xx` are `CODES` of
  `assets/playwright/bazis/shots.ts`, each with a row in the table of the guide (tested).

### The frontend of a product

- `vendor/registry.py` reads `assets/registry.json`, the only list of the files that an
  asset copies (`vendored`: stamped, kept pristine in `.bazis/base/`, hashed in the lock,
  copied by `init`; `ui`: the components and the shadcn/ui components they use, copied the
  same way by `add`, and by `init` and `update` when the template requires them (its
  `requires`, the components its files import); `template`: copied by `init` and
  tracked as the vendored ones, but without the stamp, `copy.copied`). `npm` of an asset
  (`{section: {package: version}}`, the versions of the workspace of the components: the
  map and Leaflet) is the npm dependency it brings that the template does not declare:
  `add` sets it in `package.json` of the frontend and records it in the entry of the lock
  (`vendor/npm.py`, `copy.lock_entry`), keeping a version that the product set itself
  (`npm.pinned`, reported by `add` and `update`). Add a file of an asset to the registry; `tests/test_assets.py`
  checks that the registry lists every file of the template, every source of the client
  and of the hooks and every file of `assets/ui` but its tooling.
- `requires` of an asset: `capabilities` (the hooks and the components of a package, such
  as `react-statusy`, `transit-bar`) are those the product must have; `assets` the assets
  it imports, copied before it (`registry.resolve`). `bazis_front init` passes
  `capabilities.enabled()` (the installed apps, the same as the sections of the contract,
  without the database) to `vendor/copy.py`; `add` reads the capabilities of
  `contract/contract.json`, only when an asset to copy requires one. The lock lists the
  copied assets, and `spec/validate.py` (`check_assets`) reports the warning `C003` when a
  vendored asset of a capability of `contract.json` is missing, or an asset is there
  without its capability.
- `vendor/copy.py` creates the frontend (`bazis_front init`) in a temporary directory next
  to it and renames it, and copies the components into an existing one (`add_assets`):
  everything is checked first (unknown assets, capabilities, a changed copy named again,
  another version, a file of the product at the path of a copy) and nothing is written on
  a `CopyError`; an asset already there is kept. `vendor/lock.py` is
  `frontend/bazis-front.lock.json` (format `lock: 1`).
- `vendor/update.py` (`bazis_front update`) brings the copies to the installed version: a
  copy is stale when its lock entry is not the one this version writes (`is_stale`), its
  asset left the registry, or an asset it requires is missing. `plan` reads and merges
  everything in memory (base: `.bazis/base/<asset>@<old>/`, checked against the hash of the
  lock; upstream: the stamped package file; local: the file of the frontend; the stamp
  lines made those of the new version first, `copy.restamp`), raising a `CopyError` before
  anything is written; `apply` writes the files (conflicts with git markers), copies the
  new requirements, replaces the pristine copies, refreshes `spec/schema/`
  (`spec/create.schema_updates`) and writes the lock last; after `apply` (never in `--check`)
  the command names the file of bazis-front of each conflict, its pristine copy of the new
  version (`upstream_copy`), to take whole when the lines merged without markers clash; none
  for `package.json` of the template, whose upstream has the npm dependencies of the assets
  (`with_dependencies`) that the pristine copy has not. The merge is `git merge-file`
  (`merge_file`: temporary files, the labels of the markers, without the configuration of
  the user; Git is looked for only when a file needs a merge, and its absence fails the
  plan). Do not write a merge of our own: a diff3 that aligns the base with each side
  separately loses or duplicates lines in runs of the same line, and the merge libraries of
  PyPI are GPL. The template is updated the same way (`Plan.dependencies_changed` asks for
  `npm install`); the npm dependencies of the assets are set in the base (those of the old
  entries) and in the upstream (those of the new ones) of the merge of `package.json`, so
  that they never conflict, and set alone when the template is not merged (`Plan.package`). A file of the template removed
  upstream is never deleted (`ORPHANED`); a file that is not UTF-8 text is never merged
  (`BINARY` when both changed it). `apply` records the files of the conflicts in the lock
  (`conflicts`), and `unresolved` (`update --check`, `front.W004`, and a refusal of `plan`)
  reports those that still have a marker line. `tests/test_update.py` simulates an
  older version by writing an asset again as that of the version `0.0.1` (its copies, its
  pristine copy and its lock entry). After a change of it, run the `frontend` job locally
  with an update cycle: a frontend of the sample made as there, its copies rewritten as
  those of an older version with changes on both sides, `update`, `update --check`, then
  `tsc`, lint, tests and build.
- `contract/typescript.py` renders `contract.ts` from contract.json; `contract/generated.py`
  writes it, runs openapi-typescript for `schema.d.ts` (`npx --no-install` in the
  frontend), updates the lock and finds the stale generated files for `--check` and
  `front.W001` without Node. `typescript.SECTION_TYPES` has the TypeScript type of the
  section of every capability: a new capability adds its type there. The tests replace `subprocess.run` and `shutil.which`; the real Node run is the
  `frontend` job of CI.

## TypeScript assets

The Node tooling is dev-only: it checks the assets in this repository and is never shipped.
The root `package.json` (private) has a workspace for every asset that is checked in place
(the client, the hooks, the components, the Playwright helpers). Node 22 and npm 10 (no pnpm or yarn); from the repository root:

```bash
npm ci
npx playwright install chromium   # the tests of the Playwright helpers
npm run lint
npm run typecheck
npm test                  # also `npm run api-reference -- --check` and `npm run lucide-icons -- --check`
npm run api-reference     # the API reference of the guide, after a change of an exported API
npm run lucide-icons      # spec/lucide-icons.json, after a change of the version of lucide-react
```

- `bazis/contrib/front/AGENTS.md` is the guide of the agents that build a product (served by
  `package_guide` and `guide_search` of bazis-mcp): a short introduction (the setup, the
  steps of building a frontend with the section of each, the rules, the map of the
  sections), then `## ` sections that are read one at a time, each under 30,000 bytes of
  JSON (`GUIDE_LIMIT` of bazis-mcp; larger ones are cut into parts), with a `###` heading
  for each topic (a bullet or a paragraph led by a phrase in bold gets one), the parts that
  `guide_search` finds. A fact is written once: `assets/template/AGENTS.md` (the
  `frontend/AGENTS.md` of a product) only points to its sections. Its end, from the first
  `## API: ` heading, is generated by `scripts/gen_api_reference.mjs` (the TypeScript
  compiler over the index of each asset, with the tsconfig of `ui` and of `playwright`): the
  exports of the client, the hooks, the components (with their props) and the helpers of
  the end-to-end tests, each with its signature and the first sentence of its
  documentation. Never edit it: change the TypeScript or its documentation and run
  `npm run api-reference`; `npm test` fails while it is stale.
- `package.json`, `tsconfig.json`, `test/` and `scripts/` of the client (and
  `vitest.config.ts` of the hooks and of the components) exist only for these checks:
  `pyproject.toml` excludes them from the wheel (they stay in the sdist), and
  `scripts/check_wheel.py` (run in CI) checks the wheel against `assets/registry.json`: it
  has every file of the registry (the contract tests of the components too: they are
  copied into products) and, of the assets, nothing else than the registry and the READMEs
  of their directories. A new asset adds its own entries to `[tool.setuptools.exclude-package-data]`.
  setuptools reuses a stale `build/` directory: delete it before building the wheel locally;
  it packages the files tracked by Git (`git add` a new file first). Build the wheel only
  from a Git clone: setuptools-scm takes the version and the list of the asset files from
  Git, so a `git archive` or a tarball has no version, and with a forced one loses the
  assets that are not `.py` files without an error.
- `node_modules/` and `dist/` are ignored by Git and excluded from package discovery in
  `pyproject.toml`, so they never reach the wheel. Check the wheel after changing the
  layout: `python -m build` and list its files.

### The client (`assets/client`)

- `src/`: `client.ts` (the operations, with the custom actions of the route sets
  (`action`, `itemAction`: plain JSON, their query parameters typed by `parameters.query` of
  the operation, `QueryParams`, their errors by field `ApiError.bodyErrors()`), the
  upload of bazis-uploadable over XMLHttpRequest, the authorization store of bazis-authing and the background requests of
  bazis-async-request with the results of bazis-async-background), `types.ts` (types read from
  the generated `paths`), `filter.ts` (the filter grammar of
  `bazis.core.utils.query_complex`), `errors.ts`, `pagination.ts`, `permit.ts`.
- Unit tests (`test/*.test.ts`) assert the exact URLs, headers and bodies against a mocked
  `fetch` (the uploads against a fake XMLHttpRequest of the option `xhr`). Type tests (`test/types.typecheck.ts`) are checked by `npm run typecheck` with
  `@ts-expect-error` for what must not compile.
- The types of the type tests come from the OpenAPI of the core `sample/`
  (`test/fixtures/`). Regenerate both files after a change of the core schemas:
  `npm run fixture -w bazis-front-client -- <openapi.json of the core sample>`.
- Every protocol rule is taken from the code of the core and of the packages, not from
  JSON:API in general; `assets/client/README.md` documents the rules the client follows.

### The hooks (`assets/react`)

- `src/`: `context.tsx` (`BazisProvider` with the session and the language, `useApi`,
  `useSessionKey`: the scope of the keys), `keys.ts` (the query
  keys), `queries.ts`, `mutations.ts`, `actions.ts` (`useAction`, `useItemAction`: the custom
  actions of the route sets, `client.action`; `useActionQuery`, `useItemActionQuery`: those
  declared with GET as queries, keyed under their resource and by their query parameters,
  `query`, none read while it is null), `related.ts` (`useRelatedItem`: the related items
  asked for together read with one list filtered by `pk=<a>|pk=<b>`), `schema.ts` (the fields of a runtime schema),
  `form.ts` (`useResourceForm`), `types.ts`; `src/statusy/` is the separate asset
  `react-statusy` (`requires` the capability `statusy`), `src/uploadable/` the asset
  `react-uploadable` (`useUpload`, the capability `uploadable`), `src/ws/` the asset
  `react-ws` (`SocketProvider`, `useSocket`, `useChannel`, `useLiveQueries`,
  `useNotifications`, the capability `ws`), `src/notify/` the asset `react-notify` (`useInbox`,
  the capability `notify`), `src/bg/` the asset `react-bg` (`useBgTask`,
  `bg`), `src/async/` the asset `react-async` (`useAsyncRequest`, `useAsyncTask`,
  `async_background`), `src/i18n/` the asset `i18n` (copied to `src/bazis/i18n/` of every
  product: `LanguageProvider`, `useLanguage`, `t`, the dictionaries `messages/en.ts` and
  `messages/ru.ts`, the `Intl` formats (`formatDecimal`: a `DecimalField`, a string of the
  API, formatted exactly), the language of the profile; the components import
  it as `@/bazis/i18n`, aliased in the configs of `ui`). `README.md` documents the requests, the keys and the protocol facts they
  rely on. The tests of the socket use a fake WebSocket (`test/socket.ts`; the components
  have theirs in `testing`).
- They import `@/bazis/client` and `@/bazis/generated/schema` as a product does; in this
  repository `tsconfig.json` (`paths`) and `vitest.config.ts` (`alias`) point them to the
  client asset and to `test/fixtures/schema.d.ts` (the fixture of the client plus the
  endpoints of bazis-statusy). The root eslint applies the rules of the hooks of the
  template to them.
- Tests (vitest, jsdom, `@testing-library/react`) render the hooks against a mocked `fetch`
  of the client (`test/support.tsx`) and assert the requests, the exact query keys, the
  invalidations, the documents of the form and the transits; `test/types.typecheck.ts` has
  the type tests. `test/fixtures/sample.json` holds responses of the sample of this
  repository (runtime schemas, retrieves with `state_actions`, a 422, the messages of the
  socket, the documents of a task of bazis-bg, the answers of a background request) reduced
  to what the
  hooks read and normalized so that they do not depend on the versions of Python and
  Pydantic (the keywords of the schemas the hooks read, the titles of fields only, the
  definitions renamed, fixed ids, dates and error messages):
  `tests/test_react_fixture.py` captures them through the API and fails when they differ, so
  the lower bounds of the dependencies and of the `test` extra are the versions it is
  captured from (bazis 2.17.0: the runtime schema of a list has the meta `aggregates`;
  bazis-statusy 2.13.0: the meta `for_transit`, which the boards read; the `lowest-direct`
  job of CI installs them). After a change of the core or of bazis-statusy, write the
  fixture again with `BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_react_fixture.py`
  (from `sample/`, as the other tests) and run the tests of the hooks.
- Every query key ends with the session of `BazisProvider`, against the requests still
  running at a login or a logout; the template also clears the query and mutation caches
  then (`clearOnSessionChange`, for what is not keyed by the session). Keep both. The key
  also ends with the language of the interface (`BazisProvider` `language`,
  `<session>:<language>`), and the template clears the caches when it changes
  (`clearOnLanguageChange`).
- Every text of the components is a key of `src/i18n/messages/<language>.ts`
  (`useLanguage().t`); a new text adds its key to every dictionary (`test/i18n.test.tsx`
  checks that `ru` has every key of `en`). The contract tests never depend on a text.

### The components (`assets/ui`)

- A directory per component (`ui/<component>/`: its sources, `index.ts`, its contract test
  `<component>.contract.test.tsx`), copied to `src/bazis/ui/<component>/`; `ui/resource/`
  is what they share (`FieldInput`, the only input of a field, with the control of a file
  field that `FilesProvider` gives it, and the coordinates of a point field of the route
  set of its `path`, `points.tsx`, with the map that `PointsProvider` gives it; `FieldValue`, `FileValue`, `RelationLabel`,
  `RelationPicker`, `permitted`, and `hooks.ts`, the hooks with plain paths: the only casts of the
  components, so that the lint of a product does not depend on its types; `file-field` casts
  `useUpload` of its own, and `task-progress` `useBgTask`); `AppShell` mounts its `tools`
  (`notification-center`, `live-query`) once, in the place of the current width; `ui/testing/`
  the support of the contract tests (its `Backend` also answers the uploads of the client,
  `xhr`; `FakeSocket` is the WebSocket of the tests of the socket); `ui/shadcn/` the shadcn/ui components they use (style
  new-york-v4 with the aliases of `components.json`, their MIT notice in the header of each
  file), each an asset copied to `src/components/ui/`. `README.md` documents their marks and
  behaviour; the signatures of the hooks and the props of the components are those of the
  API reference of the guide, never copied into a README.
- The contract tests are copied into products and run there by `npm test` (jsdom, set in
  `vite.config.ts` of the template): they are package data, and must pass against any
  product. They use the route set `ITEMS` of `testing` (of no product) and the documents
  and schemas of `testing`, never a resource of the sample (a related resource is given
  by its `path`, as `RelationPicker` and `RelationLabel` take it, and the resources of the
  uploaded files by `resources` of `FilesProvider`/`FileFieldProvider`). jsdom has no
  `ResizeObserver` and no `scrollIntoView`: a contract test that opens a popover stubs them.
- In this repository `tsconfig.json` and `vitest.config.ts` alias the `@/` imports to the
  other assets, to `src/lib/utils.ts` of the template, to `test/fixtures/contract.ts`
  (`contract.ts` of the sample, rendered by `contract/typescript.py` from its
  `contract.json`: render it again when the sample changes) and to `test/fixtures/theme.ts`
  (the theme of the sample, checked by `tests/test_design.py`). The defaults that the
  components take from `THEME` have a prop, so that the contract tests check every variant
  whatever the theme of the product. The root eslint applies the
  rules of the hooks of the template to them.
- The npm dependencies of the components are in `package.json` of the template, with the
  versions of the workspace; an optional library of one component (Leaflet of `map`,
  recharts of `charts`, react-day-picker of the shadcn/ui `calendar` of `date-picker`,
  @dnd-kit of `board-dnd`) is `npm` of its asset instead, which `add` sets in the
  `package.json` of a product (`tests/test_assets.py` checks every import of the components
  against both), loaded lazily with its first view. The contract tests of `map`, `charts` and
  `board-dnd` replace their library with a fake (`vi.mock`).
- Colors, radii and fonts only through the tokens of the generated theme (Tailwind classes
  such as `bg-primary`, `bg-success-soft`), the spacing through the variables of the
  density (`p-(--space-card)`), no literal colors (the shadcn/ui files keep theirs); every
  element that a scenario acts on has its `data-bz`; a loading state stays `state:loading`
  whatever it draws (a skeleton).

### The helpers of the end-to-end tests (`assets/playwright`)

- `bazis/index.ts`, the vendored asset `playwright` copied to `frontend/e2e/bazis/` (the
  directory is named as in a product, next to `generated/`): `loginAs(page, PRODUCT, role)`
  (which first answers the images of other origins, the tiles of the maps, with a blank
  image: `stubForeignImages`)
  and the class `App` with a method per step and per `expect` key. They act only through
  `data-bz` (and the `<form>` with `action:submit` as the open form), and wait with the
  auto-waiting of Playwright, `expect.poll` and the absence of `state:loading`, never for a
  fixed time. They take `PRODUCT` of the generated `product.ts` as a parameter (generic
  over it), so that a frontend compiles before `bazis_front e2e` has run; they read
  `CAPABILITIES` of `@/bazis/generated/contract` (no login without bazis-users).
- `generated/` is the output of the generator for the sample (the fixture: type-checked
  against the helpers and linted); `test/helpers.spec.ts` runs the helpers in Chromium
  against pages served by the test with the marks of the components and delays of a
  backend (also the negative cases: an expectation must not pass before the screen has
  loaded); `test/picker.spec.ts` runs them against the real `RelationPicker` and
  `RelationListPicker`, the page
  `assets/ui/test/browser/` served by Vite with the aliases of the components (where Radix
  puts the focus, the display of an empty list: what jsdom does not have; only the rules of
  the Tailwind utilities it relies on); `test/shell.spec.ts` runs the top bar of `AppShell`
  on the page `shell.html` there with the Tailwind of a product (its Vite plugin, a
  devDependency of this workspace): the links that the row has no room for in its menu
  `nav:more` (a group shared by the row and the menu, the header as wide as the window), the
  page never wider than the window; `test/types.typecheck.ts` has the type
  tests.
- `bazis/shots.ts` (copied with them) is `shoot`, the screenshot of a screen with the checks
  of what it renders (`check`, run in the page: the colors computed by the browser, converted
  to sRGB by a canvas; no axe-core), and their codes (`CODES`); `test/shots.spec.ts` runs
  the checks against pages that have what each one finds and pages without it. The template declares
  `@playwright/test` with the version of this workspace.

### The template (`assets/template`)

- The frontend of a product, copied by `init` and merged by `update`: `package.json` with pinned versions
  (prettier among them, with the style of the template in its `prettier` key: `npm run format`
  formats the code of the product, `.prettierignore` leaves out the copies, the generated
  files and the files that the end-to-end tests upload (`e2e/fixtures/`); the `frontend` job checks that the template is formatted, `prettier --check`)
  and one vite for every package (`overrides`: `$vite`, without which `npm install` of npm 10
  fails on the optional peers of vitest; why, and the product's own `overrides` after
  `update`: the guide and `tests/test_assets.py`),
  `vite.config.ts` (the `@/` alias, the `/api` proxy to `BAZIS_API_URL`, the jsdom of the
  tests, the npm libraries that every page loads in chunks of their own, `manualChunks`, and
  `cacheDir`, `BAZIS_VITE_CACHE_DIR`: the cache of the dev server of the end-to-end tests), `tsconfig.json`, `eslint.config.js`, shadcn/ui setup (`components.json`,
  `src/index.css`, `src/lib/utils.ts`), `src/app/` (providers with `BazisProvider`,
  session with its number for the query keys, router with the layout `AppShell` and the
  screens loaded by `lazyScreen` (`lazy.tsx`: each screen in a `Suspense` of its own with the
  loading state of the screens, shown at once although the navigation is a transition; a chunk that fails reloads the page at most once per
  `RELOAD_WINDOW`, the time of the reload in sessionStorage, which a screen that loads never
  clears: two screens of a route load together; then it is loaded again by the retry of
  `ErrorBoundary`), errors),
  `src/screens/login/` (`LoginForm`; the other screens, their routes, the navigation, the
  providers and the tools of the layout are generated in `src/screens/generated/`, ignored
  by its prettier and imported by `src/app/router.tsx`),
  `playwright.config.ts` (`npm run e2e`: `e2e/generated/` and `e2e/custom/`, one worker,
  `E2E_BASE_URL` or a dev server of its own on `E2E_PORT` (`--force`, with a cache of its own,
  `node_modules/.vite-e2e`), never one already running, ready
  when the backend of `BAZIS_API_URL` answers through its proxy; the browser in UTC and in
  `LANGUAGE` of the contract, `tests/test_assets.py`), `playwright.shots.config.ts` (the
  screenshots of `bazis_front shots`: that config with the projects of a desktop and a phone),
  `.gitignore` (with `.scratch/`, the screenshots) and `AGENTS.md`, which points the
  agents of a product to the sections of the guide of the package. The versions of React and
  TanStack Query in the workspace of the hooks are those of its package.json.
- Its package.json is the product's, every file of it is copied: it is not a workspace and
  the root eslint ignores it, because it compiles only with the generated files of a
  product. The `frontend` job of CI checks it, once per preset (`init --preset workspace`
  and `portal`: the components take their defaults from the theme, and a contract test
  passes the prop of a default it relies on): on the sample (with `BS_BASE_DIR` outside the
  checkout) `init`, `contract`, `contract --check`, `check` (the starters of the specs
  against the contract), `design --check`, `add` of every component, then the product and
  the screens of the sample with the kitchen sink of `tests/fixtures/kitchen-sink/` (its
  `src/` too: extensions and custom screens) and the code of the screens of the sample over
  the starters (the design of the preset kept), `check`,
  `screens` and `screens --check`, then `tsc --noEmit`, lint, prettier (also of the generated
  screens), tests (the
  contract tests of the components) and build of the generated frontend, whose chunks
  loaded with the entry `scripts/check_chunks.py` checks (none over 400 kB, the budget that
  leaves a product 100 kB under the warning of Vite; Leaflet, recharts, react-day-picker, @dnd-kit
  and the file field lazy). Its variant
  `empty` is a new product before its first model: the sample with the settings of
  `bazis new` (only `bazis.contrib.front` installed, the default router, the user model of
  Django: environment variables over `sample/project.env`), whose contract has no
  resources; the template, the home generated from the starters (`screens --check`) and the
  components without a capability must compile, lint, pass their tests and build with it, so
  the generic code (the generated screens, the components) reads the contract as plain records and never derives types from its
  literal maps (empty, they collapse to `never`/`unknown`). Run the same locally after a
  change of the template or of a component.
- The `e2e` job of CI runs the scenarios of the sample: the specs of the sample copied to
  the product root, `migrate`, `e2e_data`, `init` (which leaves the screens: the extension
  has no code yet), `contract`, `add` of the components (with `map`, then `npm install`
  for Leaflet), the code of the screens of `sample/frontend-overlay/src/` copied over `src/`,
  `check`, `screens` and `--check`, `bazis_front e2e` and `--check`, `design --check`, the build, then the backend
  (`uvicorn sample.main:app`) and `vite preview` (its `/api` proxied to the backend) and
  `npm run e2e` with `E2E_BASE_URL`; the report of Playwright is uploaded on a failure. Run
  the same locally after a change of the helpers, the generator, a component or the
  screens of the sample.

CI (`.github/workflows/tests.yml`) runs ruff, pytest, the wheel check, the Node checks, the
frontend job and the e2e job on every push to `main` and on every pull request; all of them
must pass before a merge.

## Conventions

- Code, comments, documentation and commit messages are in English.
- Every source file starts with the Apache-2.0 license header
  (`Copyright 2026 EcoFuture Technology Services LLC and contributors`), like the other
  Bazis repositories. Generated files keep the header of their generator.
- The contract of a product (layer 0) is generated from its backend and never written by
  hand; the assets are generic over the generated types and never depend on a particular
  project.
- The frontend is not a security boundary: permissions are checked by the backend
  (bazis-permit); the assets only read what the backend reports.

## Authorship

Every commit, tag and pull request of the Bazis repositories is authored by the maintainer,
Ilya Kharyn <ilya.tt07@gmail.com>. AI assistants never appear as an author, committer or
co-author: no `Co-Authored-By` or session trailers in commit messages, no "Generated with"
lines in pull requests. Set `git config user.name "Ilya Kharyn"` and
`git config user.email "ilya.tt07@gmail.com"` in every clone before committing, and check
`git log -1 --format='%an <%ae>'` before pushing.

## Releasing

A release is the tag `vX.Y.Z` on `main`, like the other Bazis packages: the Build and Publish workflow builds the package (the version comes
from the tag through setuptools-scm) and publishes it to PyPI (pre-releases
`-alphaN`/`-betaN`/`-rcN` go to Test PyPI) and creates the GitHub release.

Claude Code sessions cannot push tags. Release through the **Release** workflow instead:

1. Make sure the changes are merged into `main` and the Tests workflow is green on the
   `main` head commit (the Release workflow checks this and refuses otherwise).
2. Add the release notes as `docs/releases/X.Y.Z.md` in the change being released.
3. Start the workflow `release.yml` on `ref: main` with the input `version: X.Y.Z`
   (GitHub API: `POST /repos/ecofuture-tech/bazis-front/actions/workflows/release.yml/dispatches`;
   with the GitHub MCP tools: `actions_run_trigger`, method `run_workflow`).
4. The Release run creates the annotated tag and starts Build and Publish on it. Check
   that both runs succeed and that the version appears on https://pypi.org/project/bazis-front/.

Release the Bazis packages in dependency order: a package is tested in CI against the
versions of its Bazis dependencies published on PyPI. bazis-front is released after
bazis-statusy and bazis-async-request, before bazis-mcp.
