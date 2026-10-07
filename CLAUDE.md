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
- `checks.py`: `front.W001` (stale contract), `front.I001` (not checked: the database is
  not migrated); the command fails with `front.E002` in that case.

## TypeScript assets

The Node tooling is dev-only: it checks the assets in this repository and is never shipped.
The root `package.json` (private) has a workspace for every asset. Node 22 and npm 10 (no
pnpm or yarn); from the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

- `package.json`, `tsconfig.json`, `test/` and `scripts/` of an asset exist only for these
  checks: `pyproject.toml` excludes them from the wheel (they stay in the sdist), and
  `scripts/check_wheel.py` (run in CI) checks that the wheel has the sources and none of
  them. A new asset adds its own entries to `[tool.setuptools.exclude-package-data]`.
  setuptools reuses a stale `build/` directory: delete it before building the wheel locally.
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

CI (`.github/workflows/tests.yml`) runs ruff, pytest and the Node checks on every push to
`main` and on every pull request; all of them must pass before a merge.

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
