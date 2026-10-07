# bazis-front

The frontend layer of [Bazis](https://github.com/ecofuture-tech/bazis), the JSON:API
framework on Django + FastAPI + Pydantic. A product built on Bazis gets a React +
TypeScript + Vite frontend whose contract is generated from its own backend and whose
protocol code is copied from this package.

**Status: pre-release.** Nothing is published to PyPI yet; the API may change.

bazis-front is a Python package (`pip install bazis-front`, module `bazis.contrib.front`),
released together with the other Bazis packages. It has no npm packages: its TypeScript
code is shipped as package data and copied into the frontend of a product, which owns the
copy and gets fixes through new versions of the package.

| Part | What it is | State |
|---|---|---|
| [`assets/client`](bazis/contrib/front/assets/client) | The JSON:API protocol of Bazis in TypeScript, typed by the OpenAPI types generated from a product | available |
| [`assets/react`](bazis/contrib/front/assets/react) | React hooks over the client and TanStack Query: lists, items, runtime schemas, mutations, forms bound to the runtime schema, the transits of bazis-statusy | available |
| [`assets/template`](bazis/contrib/front/assets/template) | The frontend of a product: React, TypeScript, Vite, TanStack Query, Tailwind with shadcn/ui | available |
| `manage.py bazis_front init` | Creates the frontend of a product from the template, with copies of the client and the hooks and a lock, and the starters of its specs | available |
| `manage.py bazis_front contract` | Exports the contract of a product (`contract/openapi.json`, `contract/contract.json`), generates its TypeScript in the frontend and checks that both are up to date | available |
| `manage.py bazis_front check` | Validates the specs of a product (`spec/`: product, screens, design) against their JSON Schemas, each other and the contract | available |
| `manage.py bazis_front` (other subcommands) | Adding and updating the assets, end-to-end tests from the scenarios | planned |
| `assets/ui` | Components on shadcn/ui | planned |

The layers and the principles are described in [docs/architecture.md](docs/architecture.md).
AI agents building a product read
[bazis/contrib/front/AGENTS.md](bazis/contrib/front/AGENTS.md).

## License

Apache License 2.0, see [LICENSE](LICENSE).
