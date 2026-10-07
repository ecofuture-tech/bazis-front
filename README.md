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
| `manage.py bazis_front contract` | Exports the contract of a product (`contract/openapi.json`, `contract/contract.json`) and checks that it is up to date | available |
| `manage.py bazis_front` (other subcommands) | Generated TypeScript of the contract, spec validation, copying and updating the assets | planned |
| `assets/react`, `assets/ui`, `assets/template` | React hooks, components on shadcn/ui, the frontend project template | planned |

The layers and the principles are described in [docs/architecture.md](docs/architecture.md).
AI agents building a product read
[bazis/contrib/front/AGENTS.md](bazis/contrib/front/AGENTS.md).

## License

Apache License 2.0, see [LICENSE](LICENSE).
