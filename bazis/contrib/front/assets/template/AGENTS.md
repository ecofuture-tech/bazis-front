# Frontend — guide for AI agents

The frontend of this product: React 19, TypeScript (strict), Vite 7, React Router 7,
TanStack Query 5, Tailwind 4 with shadcn/ui. It was created by
`manage.py bazis_front init` of bazis-front: its contract with the backend is generated
from the backend, its protocol client, its React hooks and its components are copied from
bazis-front. The
backend, its contract and the specs of the product are one directory up (`manage.py`,
`contract/`, `spec/`).

Its guide is the guide of bazis-front: `package_guide("bazis-front")` of the MCP server of
Bazis, else `bazis/contrib/front/AGENTS.md` of the installed package. Read its introduction
(the steps of building a frontend, the rules, the map of its sections), then a section when
a step needs it; `guide_search` finds the section that answers a question. Its `API:`
sections give the props of the components and the signatures of the hooks, the client and
the helpers of the end-to-end tests, so the copies in `src/bazis/` and `e2e/bazis/` need not
be read. This file only says where to look:

| In this frontend | The sections of the guide of bazis-front |
|---|---|
| its files and who changes them, the npm commands | The frontend |
| `../spec/` | The specs; The specs of the screens and the design; The issues of check |
| `src/screens/`, the routes and the navigation in `src/app/router.tsx` | Writing the screens; Composing beyond the specs |
| the components in `src/bazis/ui/` | The components; the `API:` sections |
| the data of the backend (`@/bazis/react`, `@/bazis/client`) | The hooks; The client; Protocol facts that are easy to get wrong |
| the choices, the filters, the permissions, the files, the maps, the custom actions | Choices, filters, permissions and relationships; Files, points and maps; Custom actions and background work |
| the socket, the live updates and the notifications | The socket |
| the texts (`src/i18n/`), the dates and the numbers | The language |
| the login (`src/app/session.ts`) | Logins with bazis-authing |
| the theme (`../spec/design/`, `src/bazis/generated/theme.*`) | The design |
| `e2e/` | The end-to-end tests |
| `manage.py bazis_front update` and its conflicts | Updating the copies |

Never edit `src/bazis/generated/`, `src/bazis/client/`, `src/bazis/react/`,
`src/bazis/i18n/`, `e2e/bazis/`, `e2e/generated/`, `bazis-front.lock.json` or `.bazis/`:
they are generated or copied by `manage.py bazis_front`, which brings them to a new version.
This file, like the rest of the template, is the product's: `update` merges a new version of
it with the changes of the product.
