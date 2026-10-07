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
transits of the tests are created by the fixture `workflow` (`tests/conftest.py`).
`sample/spec/` is a complete valid spec of the sample: the permissions of the roles of
`workflow` cover its `access`, and `tests/test_spec.py` checks it against the contract.

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
  issue of the specs (see below).

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
- The lock does not record the specs: the generator of the e2e tests will need their
  hashes, nothing reads them before.

### The frontend of a product

- `vendor/registry.py` reads `assets/registry.json`, the only list of the files that an
  asset copies (`vendored`: stamped, kept pristine in `.bazis/base/`, hashed in the lock;
  `template`: copied once, only its version in the lock). Add a file of an asset to the
  registry; `tests/test_assets.py` checks that the registry lists every file of the
  template and every `src/*.ts` of the client.
- `vendor/copy.py` creates the frontend (`bazis_front init`) in a temporary directory next
  to it and renames it; `vendor/lock.py` is `frontend/bazis-front.lock.json` (format
  `lock: 1`).
- `contract/typescript.py` renders `contract.ts` from contract.json; `contract/generated.py`
  writes it, runs openapi-typescript for `schema.d.ts` (`npx --no-install` in the
  frontend), updates the lock and finds the stale generated files for `--check` and
  `front.W001` without Node. `typescript.SECTION_TYPES` has the TypeScript type of the
  section of every capability: a new capability adds its type there. The tests replace `subprocess.run` and `shutil.which`; the real Node run is the
  `frontend` job of CI.

## TypeScript assets

The Node tooling is dev-only: it checks the assets in this repository and is never shipped.
The root `package.json` (private) has a workspace for every asset that is checked in place
(the client). Node 22 and npm 10 (no pnpm or yarn); from the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

- `package.json`, `tsconfig.json`, `test/` and `scripts/` of the client exist only for these
  checks: `pyproject.toml` excludes them from the wheel (they stay in the sdist), and
  `scripts/check_wheel.py` (run in CI) checks the wheel against `assets/registry.json`: it
  has every file of the registry and, of the assets, nothing else than the registry and
  the READMEs. A new asset adds its own entries to `[tool.setuptools.exclude-package-data]`.
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

### The template (`assets/template`)

- The frontend of a product, copied once by `init`: `package.json` with pinned versions,
  `vite.config.ts` (the `@/` alias, the `/api` proxy to `BAZIS_API_URL`), `tsconfig.json`,
  `eslint.config.js`, shadcn/ui setup (`components.json`, `src/index.css`,
  `src/lib/utils.ts`), `src/app/` (providers, session, router, errors), `src/screens/`
  (login, home) and `AGENTS.md`, the guide of the frontend.
- Its package.json is the product's, every file of it is copied: it is not a workspace and
  the root eslint ignores it, because it compiles only with the generated files of a
  product. The `frontend` job of CI checks it: on the sample (with `BS_BASE_DIR` outside the
  checkout) `init`, `contract`, `contract --check`, `check` (the starters of the specs
  against the contract), then `tsc --noEmit`, lint, tests and build of the generated
  frontend. Run the same locally after a change of the template.

CI (`.github/workflows/tests.yml`) runs ruff, pytest, the wheel check, the Node checks and
the frontend job on every push to `main` and on every pull request; all of them must pass
before a merge.

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
