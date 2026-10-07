# Frontend — guide for AI agents

The frontend of this product: React 19, TypeScript (strict), Vite 7, React Router 7,
TanStack Query 5, Tailwind 4 with shadcn/ui. It was created by
`manage.py bazis_front init` of bazis-front: its contract with the backend is generated
from the backend, its protocol client is copied from bazis-front. The backend and its
contract are one directory up (`manage.py`, `contract/`).

## Layers

| Path | What | Changed by |
|---|---|---|
| `src/bazis/generated/` | `contract.ts` (resources, roles, transits, capabilities as constants), `schema.d.ts` (the types of the API) | only `manage.py bazis_front contract` |
| `src/bazis/client/` | the client of the Bazis protocol | bazis-front; not edited, wrapped in `src/app/` |
| `src/app/` | providers (client, query cache), session, router, errors | the product |
| `src/screens/<screen>/` | the screens | the product |
| `src/components/ui/`, `src/lib/` | shadcn/ui components (`npx shadcn add <name>`) | the product |
| `bazis-front.lock.json`, `.bazis/base/` | the versions and hashes of the contract, of the generated files and of the copied assets; the pristine copies of the assets | bazis-front; commit them |

## Commands

From the product root, after every change of the models, routes, roles, statuses or
transits of the backend (with a migrated database):

```bash
python manage.py bazis_front contract          # contract/, src/bazis/generated/, the lock
python manage.py bazis_front contract --check  # write nothing; exit 1 if anything is stale (CI)
```

From `frontend/`:

```bash
npm install
npm run dev        # the dev server; /api goes to BAZIS_API_URL (http://localhost:8000)
npm run typecheck
npm run lint
npm test
npm run build
```

`schema.d.ts` is generated with the `openapi-typescript` of this `package.json`: run
`npm install` before `bazis_front contract`.

## Rules

- **`src/bazis/generated/` is never edited**, and the types of the backend are never
  written by hand. When the backend changes, generate again and fix what the compiler
  reports; never cast an error away.
- **Use the client through `useApi()`** (`src/app/providers.tsx`): requests, errors,
  pagination, login and permission meta go through it. Do not edit `src/bazis/client/`;
  put what the product needs around it in `src/app/`, so that a new version of
  bazis-front replaces the copy without conflicts.
- Take the paths of the resources from `ROUTES` of `contract.ts`; address an item by the
  path and its id (`api.retrieve(ROUTES['app.model'], id)`).
- **Filter with `Filter`** (`Filter.where/and/or/not`): one `filter` expression, never
  built by hand.
- Show validation errors by field from `ApiError.fieldErrors()`, other errors with
  `errorMessage()` (`src/app/errors.tsx`).
- **The backend decides the rights.** Do not encode roles or permissions here: request
  the permission meta (`for_change`, `for_delete`, `for_create` on a list, `crud_actions`
  on an item), read it with `can()`, and read the editable fields from
  `api.schema(path, 'update', id)`. Hide or disable what the backend does not allow.
- Check for an optional package with `CAPABILITIES.<name> !== null` (`contract.ts`): the
  login exists only with bazis-users (`LOGIN_ENABLED` of `src/app/session.ts`).
- No translations: the labels come from the backend (its schemas and names are already in
  the language of the product) and from the screens.
