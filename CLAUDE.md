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

The sample (`sample/`) installs bazis-users, bazis-permit and bazis-statusy (the `test`
extra) with a project app `users` and a statusy model `tasks.Task`; the roles, statuses and
transits are defined once in `sample/tasks/workflow.py`, created for the tests by the
fixture `workflow` (`tests/conftest.py`) and outside pytest by `manage.py sample_data`
(with the test users of the roles, their password set to `E2E_PASSWORD` at every run, and
the task that the scenario of the viewer opens: the data of the end-to-end tests). The
title of a task is not empty (`MinLengthValidator`), for the scenario of a failing
submit. `sample/spec/` is a complete valid spec of the sample: the permissions
of the roles of `workflow` cover its `access`, and `tests/test_spec.py` checks it against
the contract. `sample/frontend-overlay/` holds the screens of the sample (product code, the
reference of screens written from specs), copied over a frontend made from the sample by
the `e2e` job of CI.

### The contract export

- `manage.py bazis_front` is one command with argparse subcommands
  (`management/commands/bazis_front.py`); a subcommand is a `handle_<name>` method.
- `contract/export.py` renders the files (`render`), compares them byte for byte
  (`stale_files`) and writes them; `contract/openapi.py` is the canonical JSON and the hash
  of the operation surface, `contract/resources.py` the resources read from the OpenAPI.
- `capabilities/__init__.py` lists the capabilities with their distribution and app; a
  module `capabilities/<name>.py` returns its section (`section()`) and is imported only
  when the package is installed and its app is in `INSTALLED_APPS`.
- Bazis imports every subpackage of `bazis.contrib` while it configures the settings: the
  `__init__.py` of a subpackage must not import models, the database or `bazis.core`
  modules that do.
- `checks.py`: `front.W001` (stale contract or generated files of the frontend, the
  comparison of `contract --check`: `export.stale`), `front.I001` (not checked: the database
  is not migrated); the command fails with `front.E002` in that case. `front.W002`: an
  issue of the specs (see below). `front.W003`: stale end-to-end tests (`e2e --check`,
  without the database; only when the lock has `e2e` and the specs have no errors).
  `front.W004`: copies of another version (`update --check`: `update.stale`, without Node
  and the database). A new check id gets its pitfall in `bazis_manifest.toml`
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
  and `design.py` (the tokens of the presets, each a CSS variable of `:root` in the
  template's `src/index.css`: `tests/test_spec.py` checks the starter against it). Only the documents valid against their
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
  a card, the screen it leads to; a `submit` followed by an `expect` of an `error` fails and
  keeps its form open) in `validate.Result.specs`, which `spec/e2e.py` turns into
  calls of the Playwright helpers. A new step or `expect` key changes both, the schema, the
  helpers (`assets/playwright`) and the tables of the AGENTS.md files.
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
  same way by `add`, and by `init` with `init: true`; `template`: copied once, only its
  version in the lock). Add a file of an asset to the registry; `tests/test_assets.py`
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
  PyPI are GPL. The template is never updated: `dependency_changes` reports the npm
  versions of its `package.json` that differ from the product's. `tests/test_update.py` simulates an
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

- `src/`: `client.ts` (the operations), `types.ts` (types read from the generated `paths`),
  `filter.ts` (the filter grammar of `bazis.core.utils.query_complex`), `errors.ts`,
  `pagination.ts`, `permit.ts`.
- Unit tests (`test/*.test.ts`) assert the exact URLs, headers and bodies against a mocked
  `fetch`. Type tests (`test/types.typecheck.ts`) are checked by `npm run typecheck` with
  `@ts-expect-error` for what must not compile.
- The types of the type tests come from the OpenAPI of the core `sample/`
  (`test/fixtures/`). Regenerate both files after a change of the core schemas:
  `npm run fixture -w bazis-front-client -- <openapi.json of the core sample>`.
- Every protocol rule is taken from the code of the core and of the packages, not from
  JSON:API in general; `assets/client/README.md` documents the rules the client follows.

### The hooks (`assets/react`)

- `src/`: `context.tsx` (`BazisProvider`, `useApi`, `useSessionKey`), `keys.ts` (the query
  keys), `queries.ts`, `mutations.ts`, `schema.ts` (the fields of a runtime schema),
  `form.ts` (`useResourceForm`), `types.ts`; `src/statusy/` is the separate asset
  `react-statusy` (`requires` the capability `statusy`). `README.md` documents the API, the
  keys and the protocol facts they rely on.
- They import `@/bazis/client` and `@/bazis/generated/schema` as a product does; in this
  repository `tsconfig.json` (`paths`) and `vitest.config.ts` (`alias`) point them to the
  client asset and to `test/fixtures/schema.d.ts` (the fixture of the client plus the
  endpoints of bazis-statusy). The root eslint applies the rules of the hooks of the
  template to them.
- Tests (vitest, jsdom, `@testing-library/react`) render the hooks against a mocked `fetch`
  of the client (`test/support.tsx`) and assert the requests, the exact query keys, the
  invalidations, the documents of the form and the transits; `test/types.typecheck.ts` has
  the type tests. `test/fixtures/sample.json` holds responses of the sample of this
  repository (runtime schemas, retrieves with `state_actions`, a 422) reduced to what the
  hooks read and normalized so that they do not depend on the versions of Python and
  Pydantic (the keywords of the schemas the hooks read, the titles of fields only, the
  definitions renamed, fixed ids, dates and error messages):
  `tests/test_react_fixture.py` captures them through the API and fails when they differ. After a change of the core or of bazis-statusy, write the
  fixture again with `BAZIS_FRONT_WRITE_FIXTURES=1 python -m pytest ../tests/test_react_fixture.py`
  (from `sample/`, as the other tests) and run the tests of the hooks.
- Every query key ends with the session of `BazisProvider`, against the requests still
  running at a login or a logout; the template also clears the query and mutation caches
  then (`clearOnSessionChange`, for what is not keyed by the session). Keep both.

### The components (`assets/ui`)

- A directory per component (`ui/<component>/`: its sources, `index.ts`, its contract test
  `<component>.contract.test.tsx`), copied to `src/bazis/ui/<component>/`; `ui/resource/`
  is what they share (`FieldInput`, the only input of a field; `FieldValue`, relations,
  `permitted`, and `hooks.ts`, the hooks with plain paths: the only casts of the
  components, so that the lint of a product does not depend on its types); `ui/testing/`
  the support of the contract tests; `ui/shadcn/` the shadcn/ui components they use (style
  new-york-v4 with the aliases of `components.json`, their MIT notice in the header of each
  file), each an asset copied to `src/components/ui/`. `README.md` documents them.
- The contract tests are copied into products and run there by `npm test` (jsdom, set in
  `vite.config.ts` of the template): they are package data, and must pass against any
  product. They use the route set `ITEMS` of `testing` (of no product) and the documents
  and schemas of `testing`, never a resource of the sample.
- In this repository `tsconfig.json` and `vitest.config.ts` alias the `@/` imports to the
  other assets, to `src/lib/utils.ts` of the template and to `test/fixtures/contract.ts`
  (`contract.ts` of the sample, rendered by `contract/typescript.py` from its
  `contract.json`: render it again when the sample changes). The root eslint applies the
  rules of the hooks of the template to them.
- The npm dependencies of the components are in `package.json` of the template, with the
  versions of the workspace; `add` never changes the `package.json` of a product.
- Colors, radii and fonts only through the CSS variables of the template (Tailwind classes
  such as `bg-primary`), no literal colors (the shadcn/ui files keep theirs); every
  element that a scenario acts on has its `data-bz`.

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
  loaded); `test/types.typecheck.ts` has the type tests. The template declares
  `@playwright/test` with the version of this workspace.

### The template (`assets/template`)

- The frontend of a product, copied once by `init`: `package.json` with pinned versions,
  `vite.config.ts` (the `@/` alias, the `/api` proxy to `BAZIS_API_URL`, the jsdom of the
  tests), `tsconfig.json`, `eslint.config.js`, shadcn/ui setup (`components.json`,
  `src/index.css`, `src/lib/utils.ts`), `src/app/` (providers with `BazisProvider`,
  session with its number for the query keys, router with the layout `AppShell`, errors),
  `src/screens/` (login with `LoginForm`, home with the counts of `useList`),
  `playwright.config.ts` (`npm run e2e`: `e2e/generated/` and `e2e/custom/`, one worker,
  `E2E_BASE_URL` or the dev server) and `AGENTS.md`, the guide of the frontend (how to
  compose screens from the components, the end-to-end tests). The versions of React and
  TanStack Query in the workspace of the hooks are those of its package.json.
- Its package.json is the product's, every file of it is copied: it is not a workspace and
  the root eslint ignores it, because it compiles only with the generated files of a
  product. The `frontend` job of CI checks it: on the sample (with `BS_BASE_DIR` outside the
  checkout) `init`, `contract`, `contract --check`, `check` (the starters of the specs
  against the contract), `add` of every component, then `tsc --noEmit`, lint, tests (the
  contract tests of the components) and build of the generated frontend. Run the same
  locally after a change of the template or of a component.
- The `e2e` job of CI runs the scenarios of the sample: the specs of the sample copied to
  the product root, `migrate`, `sample_data`, `init`, `contract`, `check`, `add` of the
  components, the screens of `sample/frontend-overlay/src/` copied over `src/`,
  `bazis_front e2e` and `--check`, the build, then the backend
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
