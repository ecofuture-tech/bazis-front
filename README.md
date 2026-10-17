# bazis-front

The frontend layer of [Bazis](https://github.com/ecofuture-tech/bazis), the JSON:API
framework on Django + FastAPI + Pydantic. A product built on Bazis gets a React +
TypeScript + Vite frontend whose contract is generated from its own backend and whose
protocol code is copied from this package.

**Status: below 1.0.** The API may change in the minor versions; what each release brings
is in [docs/releases](docs/releases).

bazis-front is a Python package (`pip install bazis-front`, module `bazis.contrib.front`),
released together with the other Bazis packages. It has no npm packages: its TypeScript
code is shipped as package data and copied into the frontend of a product, which owns the
copy and gets fixes through new versions of the package.

| Part | What it is | State |
|---|---|---|
| [`assets/client`](bazis/contrib/front/assets/client) | The JSON:API protocol of Bazis in TypeScript, typed by the OpenAPI types generated from a product | available |
| [`assets/react`](bazis/contrib/front/assets/react) | React hooks over the client and TanStack Query: lists, items, runtime schemas, mutations, forms bound to the runtime schema, the transits of bazis-statusy, the uploads of bazis-uploadable, the socket of bazis-ws, the tasks of bazis-bg, the background requests of bazis-async-request | available |
| [`assets/template`](bazis/contrib/front/assets/template) | The frontend of a product: React, TypeScript, Vite, TanStack Query, Tailwind with shadcn/ui | available |
| `manage.py bazis_front init` | Creates the frontend of a product from the template, with copies of the client and the hooks and a lock, and the starters of its specs | available |
| `manage.py bazis_front contract` | Exports the contract of a product (`contract/openapi.json`, `contract/contract.json`), generates its TypeScript in the frontend and checks that both are up to date | available |
| `manage.py bazis_front check` | Validates the specs of a product (`spec/`: the product with the display and the label of its fields, the screens with their primitives `list`, `card`, `form`, `dashboard`, `board` and `calendar`, the design) against their JSON Schemas, each other and the contract | available |
| `manage.py bazis_front design` | Compiles the design of the specs (a preset, the layers of its tokens: a palette, a pair of fonts, a shape, a surface, the dark mode; the tokens of a brand) into the theme and the fonts of the frontend | available |
| [`assets/ui`](bazis/contrib/front/assets/ui) | Components on shadcn/ui and Tailwind 4 over the hooks: layout, states, list (with its bulk actions), card (with its tabs), form, login (with the logins of bazis-authing), the dashboard with its tiles and charts, the board and its drag and drop and the transits of bazis-statusy, the calendar, the date picker, the empty state, the status of bazis-statusy, the file field of bazis-uploadable, the map, the notifications and the live queries of bazis-ws, the progress of a task of bazis-bg, the result of a background request, each with its contract test | available |
| `manage.py bazis_front add` | Copies components into the frontend of a product, with the assets they require | available |
| [`assets/playwright`](bazis/contrib/front/assets/playwright) | Playwright helpers that run the steps of the scenarios through the `data-bz` marks of the screens | available |
| `manage.py bazis_front e2e` | Generates a Playwright test per scenario of the specs and checks that they are up to date | available |
| `manage.py bazis_front shots` | Takes the screenshots of every screen of the specs, at the width of a desktop and of a phone, in each color mode, and checks what they render (the codes V001-V010) | available |
| `manage.py bazis_front update` | Brings the copied assets to a new version of the package, merging them with the changes of the product, and copies those that the new version requires | available |
| `manage.py bazis_front status` | Shows the state of the frontend: the copies, the generated files and what brings each up to date | available |

The layers and the principles are described in [docs/architecture.md](docs/architecture.md).
AI agents building a product read
[bazis/contrib/front/AGENTS.md](bazis/contrib/front/AGENTS.md).

## License

Apache License 2.0, see [LICENSE](LICENSE). The components of shadcn/ui in
`bazis/contrib/front/assets/ui/shadcn/` are under the MIT License of shadcn/ui, whose notice
is in their headers.
