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
bazis-uploadable, bazis-ws, bazis-author with bazis-bg, bazis-async-background and
bazis-async-request (the `test` extra) with a project app `users` (its route set of the users,
`users.routes.UserRouteSet`, is that of bazis-users with `search_fields`, which the picker
of the assignee searches: the core 2.9 answers a search of a route set without them with
400) and a statusy model `tasks.Task` (searched by its title; its `priority` has choices, whose
labels the runtime schemas give translated, `enumDict`, which the frontend shows, offers and
filters by; its `location` is a `PointField`, GeoJSON in the API and `format: point` in the
contract, on the map of the list of the tasks (`list.map`; the core 2.13.2 reads points but
fails to write one, so no scenario writes it: `e2e_data` places the task of the viewer,
whose card the scenario `viewer-only-reads` expects with its coordinates); its route set
has the custom action `count` (`TaskRouteSet.action_count`, `POST /api/v1/tasks/task/count/`,
a JSON body `{priority}`, 403 without a user), which queues `tasks.bg.count.CountTasks` and
answers with the id of its task, the reference of `client.action`/`useAction` captured by
`tests/test_react_fixture.py`; its steps, `tasks.Step`, a `PermitRouteBase` route set, are the related section
`card.related` of the card of a task, added there with the task fixed, to a draft only:
`Step.validate_item`, `tests/test_steps.py`), whose `attachment` is a file of bazis-uploadable (a foreign key to
`uploadable.FileUpload`, uploaded through the bundled `FileUploadRouteSet` of
bazis-uploadable, routed as it is: it requires a user and gives him only his own files,
also to the other routes, so the core refuses as the attachment of a task a file of another
user, 403 `ERR_RELATION_ACCESS`, and leaves it out of `included`: `tasks.routes.TaskRouteSet`
has no check of its own); the auth endpoint and the password service of
bazis-authing are routed under `/api/v1/authing/`, so that the login of the frontend of the
sample is that of bazis-authing (the token endpoint of bazis-users stays). The sample is in
English and Russian (`BS_LANGUAGES` of `sample/project.env`, `LANGUAGE_CODE` `en`): the
Russian texts of the tasks are `sample/tasks/locale/ru/LC_MESSAGES/django.po`, compiled to
the `.mo` next to it (both committed, as in the other Bazis repositories; run
`python manage.py compilemessages -l ru` in `sample/tasks/` after a change), also the
Russian names of its roles, statuses and transits. The user model of the sample has a language of its own
(`UserLanguageMixin` of bazis-users, `users.profile_language`, the migration
`sample/users/migrations/0002_user_language.py`), which `tests/test_profile_language.py`
and the end-to-end test `frontend-overlay/e2e/custom/profile-language.spec.ts` check
(`e2e_data` clears the language of the test users). The roles (with their permission
groups) are declared in `sample/tasks/roles.py`, the statuses and transits in
`sample/tasks/workflow.py` (bazis-permit and bazis-statusy 2.9): `migrate` and the flush
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
their password set to `E2E_PASSWORD` at every run, and the task that the scenario of the
viewer opens, after it deleted the tasks of the previous runs (every run starts from the
same data); it never creates a role, a status or a transit. The user model has
`UserWsMixin`, `sample/router.py` routes the socket of bazis-ws
(`router.register('bazis.contrib.ws.router')`, `/api/v1/ws`, where the export sees it) and
`sample/main.py` adds `AsyncRequestMiddleware`; `tasks.models.Task` publishes with the
helpers of bazis-ws 2.6 (after the commit and robustly: Redis down does not fail the
change) every save of a task to the common channel (`publish_changed`, `{"resource"}` only:
an invalidation hint, never data) and the notification of the assignee of a finished task
(`notify` with `notification`, to the channel of the assignee, in the language of his
profile), which the scenario `manager-is-notified-of-a-finished-task` expects (Redis
only; `tests/test_notify.py` replaces the Redis of bazis-ws). The sample has no Kafka and
no `bg_scheduler`: a request with `X-Async-Background` runs at once
(`async_request.W001` is silenced in `sample/settings.py`), and the task of bazis-bg of the
sample (`tasks.bg.count.CountTasks`) is run by the tests in their process; the 202, the
result route and the statuses on the socket are captured with the publication to Kafka
replaced (`tests/test_react_fixture.py`), the rest of the background work is covered by the
tests of the hooks and the contract tests of the components. The
title of a task is not empty (`MinLengthValidator`), for the scenario of a failing
submit. `sample/spec/` is a complete valid spec of the sample: the permissions
of the declared roles cover its `access`, and `tests/test_spec.py` checks it against
the contract. `sample/frontend-overlay/` holds the screens of the sample (product code, the
reference of screens written from specs; `src/app/router.tsx` wraps the routes in
`FileFieldProvider`) and `e2e/fixtures/` (the files that the scenarios upload), copied over a
frontend made from the sample by the `e2e` job of CI.

### The contract export

- `manage.py bazis_front` is one command with argparse subcommands
  (`management/commands/bazis_front.py`); a subcommand is a `handle_<name>` method.
- `contract/export.py` renders the files (`render`), compares them byte for byte
  (`stale_files`) and writes them; `contract/openapi.py` is the canonical JSON and the hash
  of the operation surface, `contract/resources.py` the resources read from the OpenAPI
  (and, from the model, the `PointField`s: `format: point` of their GeoJSON object, which
  the OpenAPI gives for every geometry alike).
- The export is in `LANGUAGE_CODE` whatever the language of the process: `render` reads the
  OpenAPI under `translation.override` (the core builds it per language), and the names of
  the roles, statuses and transits are maps of every language of `LANGUAGES`
  (`capabilities.translated`); `tests/test_contract.py` renders under two process languages
  and expects the same bytes. `CONTRACT_FORMAT` changes with the shape of contract.json (2:
  the languages; 3: the search fields of the resources, `search`, read from the route set
  with `route_search_fields` of the core (bazis 2.10.1) because every list of the OpenAPI
  has the parameter, and the selectors of the permission
  models, `permit.selectors`, those of `get_selector_fields` of bazis-permit, which P020
  checks).
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
  `front.W004`: copies of another version (`update --check`: `update.stale`, without Node
  and the database). `front.W007`: copies changed in the frontend (`update.changed`: a file
  of a vendored asset or a component whose hash differs from the lock, not the template;
  kept apart from W004 because a changed copy is not stale and may be silenced alone). `front.W005`: a stale theme (`design --check`, without the database;
  only when the lock has `design` and the design has no errors). A new check id gets its pitfall in `bazis_manifest.toml`
  (`tests/test_manifest.py` checks that the ids exist).

### The specs

- `spec/schemas/*.schema.json` (Draft 2020-12) are the formats: `product`
  (`bazis-product/1`), `screen` (`bazis-screen/1`), `design` (`bazis-design/1`, theme.yaml)
  and `tokens` (a subset of DTCG). They are package data, copied to `spec/schema/` of a
  product by `init` (`spec/create.py`, with the starters of `spec/starters/`). The
  `packages` enum of the product schema is `capabilities.CAPABILITIES` (tested).
- `spec/validate.py` loads the files (YAML with the implicit types of YAML 1.2: no
  timestamps, only true/false booleans; JSON), checks their
  shape, then calls `refs.py` (the references, the comparison with contract.json),
  `scenarios.py` (the scenarios followed screen by screen), `access.py` (`access` compiled to the permissions
  of bazis-permit; the grammar is in its docstring, from bazis-permit and bazis-statusy)
  and `design.py` (the tokens of the presets and their defaults, the CSS variables of the
  tokens, the dark mode of the group `dark`, the tones of the statuses, the contrast of the
  text colors computed by `color.py`: `tests/test_spec.py` checks that the starters of both
  presets, `spec/starters/design/<preset>/`, reach WCAG AA). Only the documents valid against their
  schema are checked further, so that one broken file does not cascade.
- `spec/issues.py` has the codes (`CODES`, with their severity); a code never changes its
  meaning. A new code gets a case in `tests/test_spec.py` (`CASES` must cover every code)
  and a row in the table of `bazis/contrib/front/AGENTS.md` (tested).
- `bazis_front check` (`--json`, `--layer`) exits 1 on errors and skips the system checks
  (they would repeat its issues). `checks.check_spec` reports every issue as the warning
  `front.W002`: an error there would block every management command (`migrate`,
  `contract`) through `SystemCheckError`.
- `spec/scenarios.py` is the only reading of the steps of a scenario: its walk reports the
  issues and returns the steps (`Step`: the name, the value, whether it starts the edit of
  a card, the screen it leads to, whether a `submit` is refused: `fails`, the next `expect`
  has an `error` or a `state` of a failure, the one rule of the walk and of the generator; a
  refused submit keeps its form open, without its `then` and with no other `screen`
  expected, and every other submit is generated as `submit({saved: true})`, which fails the
  test when the form stays open) in `validate.Result.specs`, which `spec/e2e.py` turns into
  calls of the Playwright helpers. A new step or `expect` key changes both, the schema, the
  helpers (`assets/playwright`) and the tables of the AGENTS.md files.
- `spec/theme.py` (`bazis_front design`, also run by `init`) compiles the design into
  `frontend/src/bazis/generated/theme.css` (the variables of the tokens and of the dark mode,
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
  generator or of the specs of the sample).

### The frontend of a product

- `vendor/registry.py` reads `assets/registry.json`, the only list of the files that an
  asset copies (`vendored`: stamped, kept pristine in `.bazis/base/`, hashed in the lock,
  copied by `init`; `ui`: the components and the shadcn/ui components they use, copied the
  same way by `add`, and by `init` with `init: true`; `template`: copied by `init` and
  tracked as the vendored ones, but without the stamp, `copy.copied`). `npm` of an asset
  (`{section: {package: version}}`, the versions of the workspace of the components: the
  map and Leaflet) is the npm dependency it brings that the template does not declare:
  `add` sets it in `package.json` of the frontend and records it in the entry of the lock
  (`vendor/npm.py`, `copy.lock_entry`). Add a file of an asset to the registry; `tests/test_assets.py`
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
  (`spec/create.schema_updates`) and writes the lock last. The merge is `git merge-file`
  (`merge_file`: temporary files, the labels of the markers, without the configuration of
  the user; Git is looked for only when a file needs a merge, and its absence fails the
  plan). Do not write a merge of our own: a diff3 that aligns the base with each side
  separately loses or duplicates lines in runs of the same line, and the merge libraries of
  PyPI are GPL. The template is updated the same way (`Plan.dependencies_changed` asks for
  `npm install`); the npm dependencies of the assets are set in the base (those of the old
  entries) and in the upstream (those of the new ones) of the merge of `package.json`, so
  that they never conflict, and set alone when the template is not merged (`Plan.package`); a lock entry of the template without files (a frontend of a version that
  kept no pristine copy of it) is adopted without a merge (`untracked_files`: the files that
  differ are `DIFFERS`, those it lacks `MISSING`, reported for a review by hand). A file of the template removed
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
npm test
```

- `package.json`, `tsconfig.json`, `test/` and `scripts/` of the client (and
  `vitest.config.ts` of the hooks and of the components) exist only for these checks:
  `pyproject.toml` excludes them from the wheel (they stay in the sdist), and
  `scripts/check_wheel.py` (run in CI) checks the wheel against `assets/registry.json`: it
  has every file of the registry (the contract tests of the components too: they are
  copied into products) and, of the assets, nothing else than the registry and the READMEs
  of their directories. A new asset adds its own entries to `[tool.setuptools.exclude-package-data]`.
  setuptools reuses a stale `build/` directory: delete it before building the wheel locally;
  it packages the files tracked by Git (`git add` a new file first).
- `node_modules/` and `dist/` are ignored by Git and excluded from package discovery in
  `pyproject.toml`, so they never reach the wheel. Check the wheel after changing the
  layout: `python -m build` and list its files.

### The client (`assets/client`)

- `src/`: `client.ts` (the operations, with the custom actions of the route sets
  (`action`, `itemAction`: plain JSON, their errors by field `ApiError.bodyErrors()`), the
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
  actions of the route sets, `client.action`), `related.ts` (`useRelatedItem`: the related items
  asked for together read with one list filtered by `pk=<a>|pk=<b>`), `schema.ts` (the fields of a runtime schema),
  `form.ts` (`useResourceForm`), `types.ts`; `src/statusy/` is the separate asset
  `react-statusy` (`requires` the capability `statusy`), `src/uploadable/` the asset
  `react-uploadable` (`useUpload`, the capability `uploadable`), `src/ws/` the asset
  `react-ws` (`SocketProvider`, `useSocket`, `useChannel`, `useLiveQueries`,
  `useNotifications`, the capability `ws`), `src/bg/` the asset `react-bg` (`useBgTask`,
  `bg`), `src/async/` the asset `react-async` (`useAsyncRequest`, `useAsyncTask`,
  `async_background`), `src/i18n/` the asset `i18n` (copied to `src/bazis/i18n/` of every
  product: `LanguageProvider`, `useLanguage`, `t`, the dictionaries `messages/en.ts` and
  `messages/ru.ts`, the `Intl` formats, the language of the profile; the components import
  it as `@/bazis/i18n`, aliased in the configs of `ui`). `README.md` documents the API, the keys and the protocol facts they
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
  `tests/test_react_fixture.py` captures them through the API and fails when they differ. After a change of the core or of bazis-statusy, write the
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
  file), each an asset copied to `src/components/ui/`. `README.md` documents them.
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
  versions of the workspace; an optional library of one component (Leaflet of `map`) is
  `npm` of its asset instead, which `add` sets in the `package.json` of a product
  (`tests/test_assets.py` checks every import of the components against both). The contract
  test of `map` replaces Leaflet with a fake (`vi.mock`).
- Colors, radii and fonts only through the tokens of the generated theme (Tailwind classes
  such as `bg-primary`, `bg-success-soft`), the spacing through the variables of the
  density (`p-(--space-card)`), no literal colors (the shadcn/ui files keep theirs); every
  element that a scenario acts on has its `data-bz`; a loading state stays `state:loading`
  whatever it draws (a skeleton).

### The helpers of the end-to-end tests (`assets/playwright`)

- `bazis/index.ts`, the vendored asset `playwright` copied to `frontend/e2e/bazis/` (the
  directory is named as in a product, next to `generated/`): `loginAs(page, PRODUCT, role)`
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
  loaded); `test/picker.spec.ts` runs them against the real `RelationPicker`, the page
  `assets/ui/test/browser/` served by Vite with the aliases of the components (where Radix
  puts the focus, the display of an empty list: what jsdom does not have; only the rules of
  the Tailwind utilities it relies on); `test/types.typecheck.ts` has the type tests. The template declares
  `@playwright/test` with the version of this workspace.

### The template (`assets/template`)

- The frontend of a product, copied by `init` and merged by `update`: `package.json` with pinned versions,
  `vite.config.ts` (the `@/` alias, the `/api` proxy to `BAZIS_API_URL`, the jsdom of the
  tests), `tsconfig.json`, `eslint.config.js`, shadcn/ui setup (`components.json`,
  `src/index.css`, `src/lib/utils.ts`), `src/app/` (providers with `BazisProvider`,
  session with its number for the query keys, router with the layout `AppShell`, errors),
  `src/screens/` (login with `LoginForm`, home with the counts of `useList`),
  `playwright.config.ts` (`npm run e2e`: `e2e/generated/` and `e2e/custom/`, one worker,
  `E2E_BASE_URL` or a dev server of its own on `E2E_PORT`, never one already running, ready
  when the backend of `BAZIS_API_URL` answers through its proxy; the browser in UTC and in
  `LANGUAGE` of the contract, `tests/test_assets.py`) and `AGENTS.md`, the guide of the
  frontend (how to compose screens from the components, the end-to-end tests). The versions of React and
  TanStack Query in the workspace of the hooks are those of its package.json.
- Its package.json is the product's, every file of it is copied: it is not a workspace and
  the root eslint ignores it, because it compiles only with the generated files of a
  product. The `frontend` job of CI checks it, once per preset (`init --preset workspace`
  and `portal`: the components take their defaults from the theme, and a contract test
  passes the prop of a default it relies on): on the sample (with `BS_BASE_DIR` outside the
  checkout) `init`, `contract`, `contract --check`, `check` (the starters of the specs
  against the contract), `design --check`, `add` of every component, then `tsc --noEmit`, lint, tests (the
  contract tests of the components) and build of the generated frontend. Its variant
  `empty` is a new product before its first model: the sample with the settings of
  `bazis new` (only `bazis.contrib.front` installed, the default router, the user model of
  Django: environment variables over `sample/project.env`), whose contract has no
  resources; the template and the components without a capability must compile, lint,
  pass their tests and build with it, so the generic code (the home screen, the
  components) reads the contract as plain records and never derives types from its
  literal maps (empty, they collapse to `never`/`unknown`). Run the same locally after a
  change of the template or of a component.
- The `e2e` job of CI runs the scenarios of the sample: the specs of the sample copied to
  the product root, `migrate`, `e2e_data`, `init`, `contract`, `check`, `add` of the
  components (with `map`, then `npm install` for Leaflet), the screens of `sample/frontend-overlay/src/` copied over `src/`,
  `bazis_front e2e` and `--check`, `design --check`, the build, then the backend
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

The package is not released yet. A release will be the tag `vX.Y.Z` on `main`, like the
other Bazis packages: the Build and Publish workflow builds the package (the version comes
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
