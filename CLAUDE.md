# bazis-front

The frontend layer of Bazis: npm packages for the products built on Bazis (React +
TypeScript + Vite). The layers and the principles are in `docs/architecture.md`; the guide
for the agents that use the packages in a product is `AGENTS.md`.

An npm workspaces monorepo: every package is in `packages/<name>` and is published as
`@bazis/<name>`.

## Commands

Node 22 and npm 10 (no pnpm or yarn). From the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

CI (`.github/workflows/tests.yml`) runs the same commands on every push to `main` and on
every pull request; all of them must pass before a merge.

## Conventions

- Code, comments, documentation and commit messages are in English.
- Every source file starts with the Apache-2.0 license header
  (`Copyright 2026 EcoFuture Technology Services LLC and contributors`), like the other
  Bazis repositories. Generated files keep the header of their generator.
- The contract of a product (layer 0) is generated from its backend and never written by
  hand; the packages are generic over the generated types and never depend on a particular
  project.
- The frontend is not a security boundary: permissions are checked by the backend
  (bazis-permit); the packages only read what the backend reports.

## Authorship

Every commit, tag and pull request of the Bazis repositories is authored by the maintainer,
Ilya Kharyn <ilya.tt07@gmail.com>. AI assistants never appear as an author, committer or
co-author: no `Co-Authored-By` or session trailers in commit messages, no "Generated with"
lines in pull requests. Set `git config user.name "Ilya Kharyn"` and
`git config user.email "ilya.tt07@gmail.com"` in every clone before committing, and check
`git log -1 --format='%an <%ae>'` before pushing.

## Releasing

The packages are not published yet. Releases will go through a GitHub Actions workflow
started on `main`, like the other Bazis repositories; Claude Code sessions do not publish
packages or push tags themselves.
